import time
import json
from typing import Optional, List, Dict, Any, Tuple
from fastapi import APIRouter, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse

from . import state
from ..digital_twin.engine import DigitalTwinEngine
from ..disruption.manager import DisruptionManager
from ..disruption.models import DisruptionStatus
from ..disruption.impact import analyze_disruption_impact, analyze_twin_impact
from ..schemas.dashboard import (
    DashboardHealthResponse,
    TrafficSummarySchema,
    InventoryRiskSummarySchema,
    DashboardSummaryResponse,
    MapNodeSchema,
    MapEdgeSchema,
    DashboardMapResponse,
    LiveShipmentSchema,
    LiveShipmentsResponse,
    LiveDisruptionSchema,
    LiveDisruptionsResponse,
    RecoveryPlanSummarySchema,
    RecoveryCommitSummarySchema,
    RecoveryDashboardResponse,
    DashboardKpiResponse,
    ScenarioDashboardItemSchema,
    ScenariosDashboardResponse,
    SimulationAdvanceRequest,
    SimulationAdvanceResponse,
)

router = APIRouter(tags=["dashboard"])


# ==========================================
# State Resolution Helper
# ==========================================

def _resolve_twin(scenario_id: Optional[str] = None) -> Tuple[DigitalTwinEngine, str, Optional[str]]:
    """
    Authoritative twin resolution.
    If scenario_id is provided, securely retrieves the isolated scenario twin.
    Otherwise returns the active baseline twin.
    Guarantees strict separation between baseline and scenario twins.
    """
    if scenario_id:
        scen = state.scenarios.get(scenario_id)
        if scen is None:
            raise HTTPException(
                status_code=404,
                detail=f"Scenario '{scenario_id}' not found in registry."
            )
        return scen, "scenario", scenario_id
    return state.active_twin, "active_twin", None


def _calculate_traffic_summary(twin: DigitalTwinEngine) -> TrafficSummarySchema:
    congestions = [
        data.get("congestion", 0.0)
        for _, _, data in twin.graph.graph.edges(data=True)
    ]
    avg_cong = sum(congestions) / max(1, len(congestions))
    congested_count = sum(1 for c in congestions if c >= 0.5)
    return TrafficSummarySchema(
        current_hour=round(twin.simulator.current_hour, 2),
        active_incidents_count=len(twin.simulator.incidents),
        average_congestion=round(avg_cong, 4),
        congested_links_count=congested_count,
    )


def _calculate_inventory_risk(twin: DigitalTwinEngine) -> InventoryRiskSummarySchema:
    items = list(twin.inventory.values())
    stockout_count = sum(1 for it in items if (it.on_hand - it.reserved) <= it.safety_stock)
    reorder_count = sum(1 for it in items if (it.on_hand - it.reserved) <= it.reorder_point)
    total_avail = sum(max(0.0, it.on_hand - it.reserved) for it in items)
    total_res = sum(it.reserved for it in items)
    return InventoryRiskSummarySchema(
        total_items=len(items),
        stockout_risk_count=stockout_count,
        at_reorder_count=reorder_count,
        total_available_stock=round(total_avail, 2),
        total_reserved_stock=round(total_res, 2),
    )


# ==========================================
# Health Endpoint
# ==========================================

@router.get("/health", response_model=DashboardHealthResponse)
def get_health():
    """
    Lightweight health check endpoint returning service status, digital twin availability,
    simulation clock, and server timestamp without executing heavy optimization.
    """
    twin = state.active_twin
    return DashboardHealthResponse(
        service_status="healthy",
        api_status="online",
        digital_twin_available=(twin is not None),
        simulation_time=twin.simulation_time if twin else 0.0,
        active_twin_name=twin.name if twin else "none",
        timestamp=time.time(),
    )


# ==========================================
# Dashboard Summary
# ==========================================

@router.get("/dashboard/summary", response_model=DashboardSummaryResponse)
def get_dashboard_summary(
    scenario_id: Optional[str] = Query(None, description="Optional scenario ID for what-if branch")
):
    """
    Returns a unified operational overview of the active Digital Twin or specified scenario branch.
    Aggregates node/edge counts, entity counts, live disruption metrics, traffic, and inventory risk.
    """
    twin, source_type, s_id = _resolve_twin(scenario_id)
    traffic_sum = _calculate_traffic_summary(twin)
    inv_risk = _calculate_inventory_risk(twin)
    impact = analyze_twin_impact(twin)
    dm = DisruptionManager(twin)
    active_disruptions = dm.list_disruptions(active_only=True)

    if s_id:
        matching_plans = [p for p in state.recovery_plans.values() if getattr(p, "scenario_id", None) == s_id]
        matching_commits = [c for c in state.recovery_commits.values() if getattr(c, "scenario_id", None) == s_id]
    else:
        matching_plans = list(state.recovery_plans.values())
        matching_commits = list(state.recovery_commits.values())

    active_vehicles = [
        v for v in twin.vehicles.values()
        if (v.status.value if hasattr(v.status, "value") else str(v.status)) != "OUT_OF_SERVICE"
    ]

    return DashboardSummaryResponse(
        source_twin=source_type,
        scenario_id=s_id,
        twin_name=twin.name,
        version=twin.version,
        simulation_time=round(twin.simulation_time, 2),
        last_updated=twin.last_updated,
        node_count=twin.graph.graph.number_of_nodes(),
        edge_count=twin.graph.graph.number_of_edges(),
        supplier_count=len(twin.suppliers),
        warehouse_count=len(twin.warehouses),
        customer_count=len(twin.customers),
        active_vehicle_count=len(active_vehicles),
        order_count=len(twin.orders),
        shipment_count=len(twin.shipments),
        active_disruption_count=len(active_disruptions),
        affected_shipment_count=impact["affected_shipments_count"],
        affected_order_count=impact["affected_orders_count"],
        recovery_plan_count=len(matching_plans),
        committed_recovery_count=len(matching_commits),
        traffic_summary=traffic_sum,
        inventory_risk=inv_risk,
    )


# ==========================================
# Digital Twin Map API
# ==========================================

@router.get("/dashboard/map", response_model=DashboardMapResponse)
def get_dashboard_map(
    scenario_id: Optional[str] = Query(None, description="Optional scenario ID for what-if branch")
):
    """
    Returns graph topology and multimodal link telemetry specifically structured for UI map rendering.
    Preserves exact geographic coordinates, facility metadata, and road/rail/ocean/air mode tags.
    """
    twin, source_type, s_id = _resolve_twin(scenario_id)

    nodes: List[MapNodeSchema] = []
    for n, data in twin.graph.graph.nodes(data=True):
        nodes.append(MapNodeSchema(
            node_id=int(n),
            type=str(data.get("type", "junction")),
            label=str(data.get("label", f"Node {n}")),
            lat=float(data["lat"]),
            lon=float(data["lon"]),
            status=str(data.get("status", "ACTIVE")),
            capacity=float(data["capacity"]) if "capacity" in data else None,
            facility_id=data.get("facility_id"),
            name=data.get("name"),
            region=data.get("region"),
        ))

    edges: List[MapEdgeSchema] = []
    for u, v, data in twin.graph.graph.edges(data=True):
        edges.append(MapEdgeSchema(
            source=int(u),
            target=int(v),
            mode=str(data.get("mode", "road")),
            distance=float(data.get("distance", 0.0)),
            speed=float(data.get("speed", 0.0)),
            capacity=float(data.get("capacity", 0.0)),
            lanes=int(data.get("lanes", 1)),
            road_type=str(data.get("road_type", "arterial")),
            road_status=str(data.get("road_status", "open")),
            current_travel_time=round(float(data.get("current_travel_time", data.get("base_travel_time", 0.1))), 4),
            congestion=round(float(data.get("congestion", 0.0)), 4),
            risk=round(float(data.get("risk", 0.0)), 4),
            reliability=round(float(data.get("reliability", 1.0)), 4),
            transport_cost=round(float(data.get("transport_cost", 0.0)), 2),
            carbon_kg=round(float(data.get("carbon_kg", 0.0)), 2),
        ))

    return DashboardMapResponse(
        source_twin=source_type,
        scenario_id=s_id,
        node_count=len(nodes),
        edge_count=len(edges),
        nodes=nodes,
        edges=edges,
    )


# ==========================================
# Live Shipment Monitoring
# ==========================================

@router.get("/dashboard/shipments/live", response_model=LiveShipmentsResponse)
def get_live_shipments(
    scenario_id: Optional[str] = Query(None, description="Optional scenario ID for what-if branch")
):
    """
    Returns shipment-centric operational monitoring data:
    assigned vehicle, active route sequence, corridor feasibility, estimated travel time,
    delivery delay, disruption impact, and telemetry sanity flags.
    """
    twin, source_type, s_id = _resolve_twin(scenario_id)
    twin_impact = analyze_twin_impact(twin)
    affected_ids = set(twin_impact["affected_shipments"])

    live_shipments: List[LiveShipmentSchema] = []
    for sid, shp in twin.shipments.items():
        route = shp.route
        is_feasible = True
        inval_reason = None
        route_time = 0.0

        if len(route) >= 2:
            for i in range(len(route) - 1):
                u, v = route[i], route[i+1]
                if not twin.graph.graph.has_edge(u, v):
                    is_feasible = False
                    inval_reason = f"Link ({u}, {v}) missing from network graph"
                    break
                edata = twin.graph.graph.edges[u, v]
                if edata.get("road_status") == "closed":
                    is_feasible = False
                    inval_reason = f"Link ({u}, {v}) is closed"
                    break
                route_time += edata.get("current_travel_time", edata.get("base_travel_time", 0.0))

        delay = 0.0
        if shp.departure_time is not None and shp.eta is not None:
            expected_duration = max(0.0, shp.eta - shp.departure_time)
            if route_time > expected_duration:
                delay = round(route_time - expected_duration, 2)
        if shp.eta is not None and twin.simulation_time > shp.eta:
            sh_status_str = shp.status.value if hasattr(shp.status, "value") else str(shp.status)
            if sh_status_str in {"IN_TRANSIT", "DELAYED"}:
                delay = max(delay, round(twin.simulation_time - shp.eta, 2))

        is_affected = (sid in affected_ids) or (not is_feasible)

        # Sanity check: In-transit shipment without vehicle is flagged suspect
        sh_status = shp.status.value if hasattr(shp.status, "value") else str(shp.status)
        is_suspect = (sh_status == "IN_TRANSIT" and not shp.vehicle_id)

        live_shipments.append(LiveShipmentSchema(
            shipment_id=shp.id,
            order_id=shp.order_id,
            vehicle_id=shp.vehicle_id,
            origin_id=shp.origin_id,
            destination_id=shp.destination_id,
            quantity=shp.quantity,
            route=shp.route,
            status=sh_status,
            is_feasible=is_feasible,
            invalidation_reason=inval_reason,
            current_travel_time=round(route_time, 4) if len(route) >= 2 else None,
            departure_time=shp.departure_time,
            eta=shp.eta,
            delay=delay,
            affected_by_disruption=is_affected,
            is_suspect=is_suspect,
        ))

    return LiveShipmentsResponse(
        source_twin=source_type,
        scenario_id=s_id,
        count=len(live_shipments),
        shipments=live_shipments,
    )


# ==========================================
# Live Disruption Monitoring
# ==========================================

@router.get("/dashboard/disruptions/live", response_model=LiveDisruptionsResponse)
def get_live_disruptions(
    scenario_id: Optional[str] = Query(None, description="Optional scenario ID for what-if branch")
):
    """
    Returns active disruptions for the target twin with detailed impact propagation:
    affected nodes, edges, freight shipments, customer orders, and causal explanation chain.
    """
    twin, source_type, s_id = _resolve_twin(scenario_id)
    dm = DisruptionManager(twin)
    active_list = dm.list_disruptions(active_only=True)
    disruptions_out: List[LiveDisruptionSchema] = []

    for d in active_list:
        impact = analyze_disruption_impact(d, twin)
        affected_nodes = sorted(list({u for link in impact["affected_links"] for u in link}))
        if not affected_nodes and str(d.target_id).isdigit():
            affected_nodes = [int(d.target_id)]

        disruptions_out.append(LiveDisruptionSchema(
            disruption_id=d.id,
            disruption_type=d.type.value if hasattr(d.type, "value") else str(d.type),
            target_id=d.target_id,
            status=d.status.value if hasattr(d.status, "value") else str(d.status),
            severity=d.severity,
            start_time=d.start_time,
            duration_hours=d.duration_hours,
            end_time=d.end_time,
            description=d.description or "",
            affected_nodes=affected_nodes,
            affected_edges=impact["affected_links"],
            affected_shipments=impact["affected_shipments"],
            affected_orders=impact["affected_orders"],
            affected_warehouses=impact["affected_warehouses"],
            affected_customers=impact["affected_customers"],
            affected_suppliers=impact["affected_suppliers"],
            impact_chain=impact["impact_chain"],
        ))

    return LiveDisruptionsResponse(
        source_twin=source_type,
        scenario_id=s_id,
        count=len(disruptions_out),
        disruptions=disruptions_out,
    )


# ==========================================
# Recovery Monitoring
# ==========================================

@router.get("/dashboard/recovery", response_model=RecoveryDashboardResponse)
def get_dashboard_recovery(
    scenario_id: Optional[str] = Query(None, description="Optional scenario ID to filter recovery operations")
):
    """
    Returns history and current status of recovery plans and commit transactions.
    Exposes plan identifiers, solvers used, feasibility, actions, and rollback readiness.
    """
    plans = list(state.recovery_plans.values())
    commits = list(state.recovery_commits.values())

    if scenario_id:
        if scenario_id not in state.scenarios:
            raise HTTPException(
                status_code=404,
                detail=f"Scenario '{scenario_id}' not found in registry."
            )
        plans = [p for p in plans if getattr(p, "scenario_id", None) == scenario_id]
        commits = [c for c in commits if getattr(c, "scenario_id", None) == scenario_id]

    plans_out = [
        RecoveryPlanSummarySchema(
            plan_id=p.plan_id,
            scenario_id=p.scenario_id,
            problem_id=p.problem_id,
            solver=p.solver,
            solver_execution_time=round(p.solver_execution_time, 4),
            affected_shipments=p.affected_shipments,
            affected_orders=p.affected_orders,
            actions_count=len(p.actions),
            feasibility_status=p.feasibility_status,
            is_committed=p.is_committed,
            baseline_metrics=p.baseline_metrics,
            projected_metrics=p.projected_metrics,
            explanation=p.explanation,
        )
        for p in plans
    ]

    commits_out = [
        RecoveryCommitSummarySchema(
            commit_id=c.commit_id,
            plan_id=c.plan_id,
            scenario_id=c.scenario_id,
            snapshot_id=c.snapshot_id,
            status=c.status,
            committed_at=c.committed_at,
            rollback_available=c.rollback_available,
            shipment_changes_count=len(c.shipment_changes),
            inventory_changes_count=len(c.inventory_changes),
            order_changes_count=len(c.order_changes),
            created_shipments_count=len(c.created_shipments),
        )
        for c in commits
    ]

    return RecoveryDashboardResponse(
        plans_count=len(plans_out),
        commits_count=len(commits_out),
        plans=plans_out,
        commits=commits_out,
    )


# ==========================================
# Measurable Operational KPIs
# ==========================================

@router.get("/dashboard/kpis", response_model=DashboardKpiResponse)
def get_dashboard_kpis(
    scenario_id: Optional[str] = Query(None, description="Optional scenario ID for what-if branch")
):
    """
    Computes rigorous operational KPIs from authoritative state:
    orders, shipments, disruption count, stockout risks, transit times, transport cost,
    carbon emissions, route risk, and SLA fulfillment percentage.
    """
    twin, source_type, s_id = _resolve_twin(scenario_id)
    impact = analyze_twin_impact(twin)
    inv_risk = _calculate_inventory_risk(twin)

    active_shps = [
        s for s in twin.shipments.values()
        if (s.status.value if hasattr(s.status, "value") else str(s.status)) in {"IN_TRANSIT", "DELAYED"}
    ]

    delayed_count = 0
    tot_time = 0.0
    tot_cost = 0.0
    tot_carbon = 0.0
    tot_risk = 0.0
    counted_routes = 0

    for s in active_shps:
        r = s.route
        if len(r) >= 2:
            r_time = 0.0
            r_cost = 0.0
            r_carb = 0.0
            r_risk = 0.0
            is_valid = True
            for i in range(len(r) - 1):
                u, v = r[i], r[i+1]
                if twin.graph.graph.has_edge(u, v):
                    edata = twin.graph.graph.edges[u, v]
                    r_time += edata.get("current_travel_time", edata.get("base_travel_time", 0.0))
                    r_cost += edata.get("transport_cost", 0.0)
                    r_carb += edata.get("carbon_kg", 0.0)
                    r_risk = max(r_risk, edata.get("risk", 0.0))
                else:
                    is_valid = False
                    break
            if is_valid:
                tot_time += r_time
                tot_cost += r_cost
                tot_carbon += r_carb
                tot_risk += r_risk
                counted_routes += 1
                if s.eta is not None and s.departure_time is not None:
                    exp = max(0.0, s.eta - s.departure_time)
                    if r_time > exp:
                        delayed_count += 1
                elif s.eta is not None and twin.simulation_time > s.eta:
                    delayed_count += 1

    disrupted_links_count = sum(
        1 for _, _, data in twin.graph.graph.edges(data=True)
        if data.get("road_status") == "closed" or len(data.get("incidents", [])) > 0
    )

    avg_route_risk = round(tot_risk / max(1, counted_routes), 4) if counted_routes > 0 else 0.0

    total_orders = len(twin.orders)
    fulfilled = sum(
        1 for o in twin.orders.values()
        if (o.status.value if hasattr(o.status, "value") else str(o.status)) in {"DELIVERED", "IN_TRANSIT", "ALLOCATED"}
    )
    fulfillment_rate = round(100.0 * fulfilled / max(1, total_orders), 2) if total_orders > 0 else 100.0

    return DashboardKpiResponse(
        source_twin=source_type,
        scenario_id=s_id,
        simulation_time=round(twin.simulation_time, 2),
        total_orders=total_orders,
        active_shipments=len(active_shps),
        affected_shipments=impact["affected_shipments_count"],
        delayed_shipments=delayed_count,
        disrupted_warehouses=impact["affected_warehouses_count"],
        disrupted_links=disrupted_links_count,
        available_inventory=inv_risk.total_available_stock,
        stockout_risk_count=inv_risk.stockout_risk_count,
        total_travel_time=round(tot_time, 4) if counted_routes > 0 else 0.0,
        total_transport_cost=round(tot_cost, 2) if counted_routes > 0 else 0.0,
        total_carbon=round(tot_carbon, 2) if counted_routes > 0 else 0.0,
        average_route_risk=avg_route_risk,
        fulfillment_rate_pct=fulfillment_rate,
    )


# ==========================================
# What-If Scenario Overview
# ==========================================

@router.get("/dashboard/scenarios", response_model=ScenariosDashboardResponse)
def get_dashboard_scenarios():
    """
    Returns an overview of all cloned what-if scenarios in the registry,
    reporting disruption impact, recovery plan status, and commit readiness.
    """
    scenarios_out: List[ScenarioDashboardItemSchema] = []
    for scen_id, scen_twin in state.scenarios.items():
        impact = analyze_twin_impact(scen_twin)
        dm = DisruptionManager(scen_twin)
        active_disr = dm.list_disruptions(active_only=True)
        plan_count = sum(1 for p in state.recovery_plans.values() if getattr(p, "scenario_id", None) == scen_id)
        has_commit = any(getattr(c, "scenario_id", None) == scen_id for c in state.recovery_commits.values())
        commit_status = "COMMITTED" if has_commit else ("PLANNED" if plan_count > 0 else "NONE")

        scenarios_out.append(ScenarioDashboardItemSchema(
            scenario_id=scen_id,
            scenario_name=getattr(scen_twin, "scenario_name", scen_twin.name),
            twin_name=scen_twin.name,
            source_twin_version=getattr(scen_twin, "source_twin_version", 1),
            simulation_time=round(scen_twin.simulation_time, 2),
            last_updated=scen_twin.last_updated,
            disruption_count=len(active_disr),
            shipment_impact_count=impact["affected_shipments_count"],
            order_impact_count=impact["affected_orders_count"],
            recovery_plan_count=plan_count,
            commit_status=commit_status,
            is_committed=has_commit,
        ))

    return ScenariosDashboardResponse(
        count=len(scenarios_out),
        scenarios=scenarios_out,
    )


# ==========================================
# Simulation Clock Control
# ==========================================

@router.post("/dashboard/simulation/advance", response_model=SimulationAdvanceResponse)
def advance_simulation(payload: SimulationAdvanceRequest):
    """
    Advances simulation clock forward by a bounded step (0.1 to 48.0 hours).
    Updates diurnal traffic cycles, edge travel times, and incident/disruption expiries.
    """
    twin, source_type, s_id = _resolve_twin(payload.scenario_id)
    prev_time = twin.simulation_time
    new_time = (prev_time + payload.hours) % 24.0
    twin.update_simulation_time(new_time)

    dm = DisruptionManager(twin)
    expired_ids = dm.check_expiry(new_time)

    return SimulationAdvanceResponse(
        success=True,
        source_twin=source_type,
        scenario_id=s_id,
        previous_time=round(prev_time, 2),
        current_time=round(new_time, 2),
        advanced_hours=round(payload.hours, 2),
        expired_incidents=len(expired_ids),
        message=f"Simulation advanced {payload.hours:.2f} hours to virtual hour {new_time:.2f}.",
    )


# ==========================================
# Live State Stream (SSE & WebSocket)
# ==========================================

@router.get("/dashboard/stream")
def get_dashboard_stream(
    scenario_id: Optional[str] = Query(None, description="Optional scenario ID for stream")
):
    """
    Server-Sent Events (SSE) endpoint providing lightweight live streaming updates
    of simulation ticks, disruptions, and active freight movements.
    """
    twin, source_type, s_id = _resolve_twin(scenario_id)

    def event_generator():
        summary = {
            "event": "tick",
            "source_twin": source_type,
            "scenario_id": s_id,
            "simulation_time": round(twin.simulation_time, 2),
            "active_disruptions": len([d for d in twin.disruptions.values() if getattr(d, 'status', None) in ('ACTIVE', DisruptionStatus.ACTIVE)]),
            "active_shipments": len(twin.shipments),
            "timestamp": time.time(),
        }
        yield f"event: tick\ndata: {json.dumps(summary)}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.websocket("/dashboard/stream")
@router.websocket("/dashboard/ws")
async def dashboard_websocket_endpoint(websocket: WebSocket, scenario_id: Optional[str] = None):
    """
    Lightweight bidirectional WebSocket streaming endpoint for frontend real-time sync.
    Broadcasts initial operational snapshot and responds to ping/heartbeat frames.
    """
    await websocket.accept()
    try:
        twin, source_type, s_id = _resolve_twin(scenario_id)
        init_payload = {
            "type": "init",
            "source_twin": source_type,
            "scenario_id": s_id,
            "simulation_time": round(twin.simulation_time, 2),
            "active_disruptions": len(twin.disruptions),
            "active_shipments": len(twin.shipments),
            "timestamp": time.time(),
        }
        await websocket.send_json(init_payload)

        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_json({
                    "type": "pong",
                    "simulation_time": round(twin.simulation_time, 2),
                    "timestamp": time.time(),
                })
            else:
                await websocket.send_json({"type": "ack", "message": data})
    except WebSocketDisconnect:
        pass
    except Exception:
        await websocket.close()

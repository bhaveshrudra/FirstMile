from typing import Dict, Any, List, Optional, Tuple, Set

from ..digital_twin.engine import DigitalTwinEngine
from ..disruption.models import Disruption, DisruptionStatus
from ..disruption.impact import analyze_disruption_impact, analyze_twin_impact
from ..optimization.exact_solver import dijkstra_shortest_path
from ..optimization.fitness import RouteEvaluator
from ..models.warehouse import WarehouseStatus

from .models import (
    RecoveryObjectiveType,
    RecoveryObjective,
    RecoveryConstraintType,
    RecoveryConstraint,
    RecoveryActionType,
    RecoveryAction,
    CandidateRoute,
    AffectedShipment,
    CandidateAlternateWarehouse,
    AffectedWarehouseInventory,
    BaselineRecoveryMetrics,
    RecoveryProblem,
)


def _get_node_id(twin: DigitalTwinEngine, facility_id: str) -> Optional[int]:
    """Resolves facility string identifier to integer graph node ID."""
    # 1. Check warehouses
    wh = twin.get_warehouse(facility_id)
    if wh is not None and wh.node_id is not None:
        return wh.node_id

    # 2. Check suppliers
    sup = twin.get_supplier(facility_id)
    if sup is not None and sup.node_id is not None:
        return sup.node_id

    # 3. Check customers
    cust = twin.get_customer(facility_id)
    if cust is not None and cust.node_id is not None:
        return cust.node_id

    # 4. Check port facility in graph node metadata
    for n, data in twin.graph.graph.nodes(data=True):
        if data.get("facility_id") == facility_id or (facility_id == "P1" and data.get("type") == "port"):
            return n

    # 5. Check if string is already numeric
    if str(facility_id).isdigit():
        node_int = int(facility_id)
        if twin.graph.graph.has_node(node_int):
            return node_int

    return None


def get_default_objectives() -> List[RecoveryObjective]:
    """Returns the standard multi-objective formulation for PNT1 recovery."""
    return [
        RecoveryObjective(name=RecoveryObjectiveType.TRAVEL_TIME, weight=1.0, enabled=True),
        RecoveryObjective(name=RecoveryObjectiveType.TRANSPORT_COST, weight=0.8, enabled=True),
        RecoveryObjective(name=RecoveryObjectiveType.RISK, weight=0.5, enabled=True),
        RecoveryObjective(name=RecoveryObjectiveType.DELIVERY_DELAY, weight=1.0, enabled=True),
        RecoveryObjective(name=RecoveryObjectiveType.FUEL_COST, weight=0.3, enabled=False),
        RecoveryObjective(name=RecoveryObjectiveType.CARBON, weight=0.3, enabled=False),
        RecoveryObjective(name=RecoveryObjectiveType.SLA_BREACH, weight=1.0, enabled=False),
        RecoveryObjective(name=RecoveryObjectiveType.STOCKOUT_RISK, weight=0.5, enabled=False),
    ]


def get_default_constraints() -> List[RecoveryConstraint]:
    """Returns the baseline physical and contractual constraints for PNT1 recovery."""
    return [
        RecoveryConstraint(
            name="Route Availability",
            type=RecoveryConstraintType.ROUTE_AVAILABILITY,
            enabled=True,
            parameters={"allow_closed_roads": False, "max_travel_time_threshold": 999.0}
        ),
        RecoveryConstraint(
            name="Vehicle Payload Capacity",
            type=RecoveryConstraintType.VEHICLE_CAPACITY,
            enabled=True,
            parameters={"enforce_weight_limit": True}
        ),
        RecoveryConstraint(
            name="Delivery SLA Deadline",
            type=RecoveryConstraintType.DELIVERY_DEADLINE,
            enabled=True,
            parameters={"max_delay_hours_allowed": 6.0}
        ),
        RecoveryConstraint(
            name="Warehouse Throughput Capacity",
            type=RecoveryConstraintType.WAREHOUSE_CAPACITY,
            enabled=True,
            parameters={"enforce_throughput_limit": True}
        ),
        RecoveryConstraint(
            name="Inventory Stock Availability",
            type=RecoveryConstraintType.INVENTORY_AVAILABILITY,
            enabled=True,
            parameters={"allow_stockout": False}
        ),
    ]


def build_recovery_problem(
    twin: DigitalTwinEngine,
    disruption_ids: Optional[List[str]] = None,
    scenario_id: Optional[str] = None
) -> RecoveryProblem:
    """
    Translates the state of a disrupted Digital Twin into a formal RecoveryProblem formulation.
    Identifies affected entities, evaluates candidate bypass paths for invalidated shipments,
    inspects candidate alternate warehouses for depleted inventory, and computes baseline metrics.
    Does NOT solve the optimization problem or mutate the twin state.
    """
    g = twin.graph.graph
    scen_id = scenario_id or getattr(twin, "scenario_id", twin.name)

    # 1. Identify active disruptions
    selected_disruptions: List[Disruption] = []
    if disruption_ids:
        for did in disruption_ids:
            d = twin.disruptions.get(did)
            if d is not None:
                if isinstance(d, dict):
                    d = Disruption(**d)
                selected_disruptions.append(d)
    else:
        for d in twin.disruptions.values():
            if isinstance(d, dict):
                d = Disruption(**d)
            if d.status == DisruptionStatus.ACTIVE:
                selected_disruptions.append(d)

    # 2. Collect affected entities using impact analyzer
    affected_shipments_ids: Set[str] = set()
    affected_orders_ids: Set[str] = set()
    affected_warehouses_ids: Set[str] = set()
    affected_customers_ids: Set[str] = set()
    affected_suppliers_ids: Set[str] = set()
    affected_links: Set[Tuple[int, int]] = set()

    for d in selected_disruptions:
        imp = analyze_disruption_impact(d, twin)
        affected_shipments_ids.update(imp["affected_shipments"])
        affected_orders_ids.update(imp["affected_orders"])
        affected_warehouses_ids.update(imp["affected_warehouses"])
        affected_customers_ids.update(imp["affected_customers"])
        affected_suppliers_ids.update(imp["affected_suppliers"])
        affected_links.update(imp["affected_links"])

    # 3. Detect any additional closed edges in graph directly
    for u, v, data in g.edges(data=True):
        if data.get("road_status") == "closed" or data.get("current_travel_time", 0.0) >= 999.0:
            affected_links.add((u, v))
            for sid, shp in twin.shipments.items():
                route = shp.route
                if len(route) >= 2:
                    for i in range(len(route) - 1):
                        if (route[i], route[i+1]) == (u, v) or (route[i+1], route[i]) == (u, v):
                            affected_shipments_ids.add(sid)

    # 4. Evaluate each affected shipment & discover candidate bypass routes
    affected_shipment_objects: List[AffectedShipment] = []
    infeasible_shipments: List[str] = []
    evaluator = RouteEvaluator(twin.graph)

    for sid in sorted(list(affected_shipments_ids)):
        shp = twin.get_shipment(sid)
        if not shp:
            continue

        origin_node = _get_node_id(twin, shp.origin_id) or (shp.route[0] if shp.route else 0)
        dest_node = _get_node_id(twin, shp.destination_id) or (shp.route[-1] if shp.route else 0)

        # Determine if current route is invalid
        is_route_invalid = False
        invalidation_reason = None

        if not shp.route or len(shp.route) < 2:
            is_route_invalid = True
            invalidation_reason = "Empty or incomplete route."
        else:
            # Check closed nodes
            for n in shp.route:
                if g.has_node(n) and g.nodes[n].get("status") in {"CLOSED", "OFFLINE"}:
                    is_route_invalid = True
                    invalidation_reason = f"Node {n} is closed/offline."
                    break

            # Check closed or missing edges
            if not is_route_invalid:
                for u, v in zip(shp.route, shp.route[1:]):
                    if not g.has_edge(u, v):
                        is_route_invalid = True
                        invalidation_reason = f"Link ({u}, {v}) not found in graph."
                        break
                    ed = g.edges[u, v]
                    if ed.get("road_status") == "closed" or ed.get("current_travel_time", 0.0) >= 999.0:
                        is_route_invalid = True
                        invalidation_reason = f"Link ({u}, {v}) is blocked/closed."
                        break

        # Discover Candidate Routes
        candidate_routes: List[CandidateRoute] = []
        if is_route_invalid:
            # Run Dijkstra to find optimal alternative bypass path
            alt_path, alt_metrics = dijkstra_shortest_path(twin.graph, origin_node, dest_node)
            if alt_path and alt_metrics.get("travel_time", 999.0) < 999.0:
                cost = sum(g[u][v].get("transport_cost", 0.0) for u, v in zip(alt_path, alt_path[1:]))
                carbon = sum(g[u][v].get("carbon_kg", 0.0) for u, v in zip(alt_path, alt_path[1:]))
                candidate_routes.append(CandidateRoute(
                    path=alt_path,
                    distance_km=round(alt_metrics["distance"], 2),
                    travel_time_hours=round(alt_metrics["travel_time"], 2),
                    risk=round(alt_metrics["risk"], 2),
                    fuel_cost=round(alt_metrics["fuel_cost"], 2),
                    transport_cost=round(cost, 2),
                    carbon_kg=round(carbon, 2),
                    is_feasible=True,
                    explanation=f"Feasible bypass corridor discovered via nodes {alt_path}"
                ))
            else:
                # No alternate route exists
                infeasible_shipments.append(sid)
                candidate_routes.append(CandidateRoute(
                    path=[],
                    distance_km=999.0,
                    travel_time_hours=999.0,
                    risk=1.0,
                    fuel_cost=999.0,
                    transport_cost=999.0,
                    carbon_kg=999.0,
                    is_feasible=False,
                    explanation=f"Infeasible: no connected open path exists from node {origin_node} to {dest_node}"
                ))
        else:
            # Current route remains valid
            cur_metrics = evaluator.evaluate_path(shp.route)
            cost = sum(g[u][v].get("transport_cost", 0.0) for u, v in zip(shp.route, shp.route[1:]))
            carbon = sum(g[u][v].get("carbon_kg", 0.0) for u, v in zip(shp.route, shp.route[1:]))
            candidate_routes.append(CandidateRoute(
                path=shp.route,
                distance_km=round(cur_metrics["distance"], 2),
                travel_time_hours=round(cur_metrics["travel_time"], 2),
                risk=round(cur_metrics["risk"], 2),
                fuel_cost=round(cur_metrics["fuel_cost"], 2),
                transport_cost=round(cost, 2),
                carbon_kg=round(carbon, 2),
                is_feasible=True,
                explanation="Current route is open and functional."
            ))

        affected_shipment_objects.append(AffectedShipment(
            shipment_id=shp.id,
            order_id=shp.order_id,
            origin_id=shp.origin_id,
            destination_id=shp.destination_id,
            origin_node=origin_node,
            destination_node=dest_node,
            current_route=shp.route,
            is_route_invalid=is_route_invalid,
            candidate_routes=candidate_routes,
            assigned_vehicle_id=shp.vehicle_id,
            invalidation_reason=invalidation_reason
        ))

    # 5. Analyze Affected Warehouse Inventory (without moving stock)
    affected_inventory_objects: List[AffectedWarehouseInventory] = []
    for wh_id in sorted(list(affected_warehouses_ids)):
        wh = twin.get_warehouse(wh_id)
        if wh and wh.status in {WarehouseStatus.OFFLINE, WarehouseStatus.DISRUPTED}:
            for item in twin.list_inventory(warehouse_id=wh_id):
                alt_warehouses: List[CandidateAlternateWarehouse] = []
                for other_id, other_wh in twin.warehouses.items():
                    if other_id != wh_id and other_wh.status == WarehouseStatus.ACTIVE:
                        alt_item = twin.get_inventory(other_id, item.sku)
                        if alt_item:
                            alt_warehouses.append(CandidateAlternateWarehouse(
                                warehouse_id=other_id,
                                sku=item.sku,
                                available_stock=alt_item.available,
                                safety_stock=alt_item.safety_stock,
                                can_fulfill=alt_item.available > 0
                            ))
                affected_inventory_objects.append(AffectedWarehouseInventory(
                    warehouse_id=wh_id,
                    sku=item.sku,
                    current_stock=item.on_hand,
                    reserved_stock=item.reserved,
                    available_stock=item.available,
                    safety_stock=item.safety_stock,
                    candidate_alternate_warehouses=alt_warehouses
                ))

    # 6. Formulate Candidate Recovery Actions
    candidate_actions: List[RecoveryAction] = []
    for aff_shp in affected_shipment_objects:
        if aff_shp.is_route_invalid:
            feasible_candidates = [r for r in aff_shp.candidate_routes if r.is_feasible]
            if feasible_candidates:
                candidate_actions.append(RecoveryAction(
                    action_type=RecoveryActionType.REROUTE_SHIPMENT,
                    target_id=aff_shp.shipment_id,
                    parameters={"candidate_path": feasible_candidates[0].path},
                    description=f"Reroute shipment {aff_shp.shipment_id} via bypass path {feasible_candidates[0].path}"
                ))
            else:
                candidate_actions.append(RecoveryAction(
                    action_type=RecoveryActionType.DEFER_ORDER,
                    target_id=aff_shp.order_id,
                    description=f"Defer order {aff_shp.order_id}: corridor severed without alternative path"
                ))

    for wh_inv in affected_inventory_objects:
        for alt in wh_inv.candidate_alternate_warehouses:
            if alt.can_fulfill:
                candidate_actions.append(RecoveryAction(
                    action_type=RecoveryActionType.USE_ALTERNATE_WAREHOUSE,
                    target_id=wh_inv.warehouse_id,
                    parameters={"alternate_warehouse_id": alt.warehouse_id, "sku": alt.sku},
                    description=f"Candidate alternate warehouse {alt.warehouse_id} identified for SKU {alt.sku} ({alt.available_stock} units available)"
                ))

    for s_id in sorted(list(affected_suppliers_ids)):
        candidate_actions.append(RecoveryAction(
            action_type=RecoveryActionType.USE_ALTERNATE_SUPPLIER,
            target_id=s_id,
            description=f"Secondary supplier procurement required for disrupted supplier {s_id}"
        ))

    # 7. Compute Baseline Metrics for the Disrupted Network State
    total_time = 0.0
    total_dist = 0.0
    total_cost = 0.0
    total_risk = 0.0
    total_fuel = 0.0
    total_carbon = 0.0

    for aff_shp in affected_shipment_objects:
        if aff_shp.candidate_routes:
            top_route = aff_shp.candidate_routes[0]
            total_time += top_route.travel_time_hours
            total_dist += top_route.distance_km
            total_cost += top_route.transport_cost
            total_risk += top_route.risk
            total_fuel += top_route.fuel_cost
            total_carbon += top_route.carbon_kg

    baseline_metrics = BaselineRecoveryMetrics(
        total_travel_time=round(total_time, 2),
        total_distance=round(total_dist, 2),
        transport_cost=round(total_cost, 2),
        risk=round(total_risk, 2),
        fuel_cost=round(total_fuel, 2),
        carbon=round(total_carbon, 2),
        affected_shipments_count=len(affected_shipment_objects),
        affected_orders_count=len(affected_orders_ids),
        affected_customers_count=len(affected_customers_ids),
        affected_warehouses_count=len(affected_warehouses_ids),
        affected_suppliers_count=len(affected_suppliers_ids),
        disrupted_links_count=len(affected_links),
    )

    # 8. Feasibility Assessment
    is_feasible = len(infeasible_shipments) == 0
    if not is_feasible:
        feasibility_status = "PARTIALLY_INFEASIBLE"
        explanation = (
            f"Recovery problem formulated. Warning: Shipment(s) {infeasible_shipments} "
            f"have no accessible alternate bypass path around active network blockages."
        )
    else:
        feasibility_status = "FEASIBLE"
        explanation = (
            f"Recovery problem successfully formulated with {len(candidate_actions)} "
            f"candidate recovery actions across {len(affected_shipment_objects)} affected shipment(s)."
        )

    return RecoveryProblem(
        scenario_id=scen_id,
        disruption_ids=[d.id for d in selected_disruptions],
        affected_shipments=affected_shipment_objects,
        affected_orders=sorted(list(affected_orders_ids)),
        affected_warehouses=sorted(list(affected_warehouses_ids)),
        affected_customers=sorted(list(affected_customers_ids)),
        affected_suppliers=sorted(list(affected_suppliers_ids)),
        affected_links=sorted(list(affected_links)),
        affected_inventory=affected_inventory_objects,
        candidate_actions=candidate_actions,
        objectives=get_default_objectives(),
        constraints=get_default_constraints(),
        baseline_metrics=baseline_metrics,
        is_feasible=is_feasible,
        feasibility_status=feasibility_status,
        explanation=explanation,
    )

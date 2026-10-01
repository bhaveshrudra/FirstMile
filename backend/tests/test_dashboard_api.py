import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.api import state
from backend.app.digital_twin.seed import create_pnt1_seed_twin
from backend.app.disruption.models import Disruption, DisruptionType, DisruptionStatus
from backend.app.disruption.manager import DisruptionManager

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_seed_twin():
    """Ensures each test operates on a fresh, deterministic PNT1 logistics twin."""
    state.active_twin = create_pnt1_seed_twin()
    state.scenarios.clear()
    state.recovery_plans.clear()
    state.recovery_commits.clear()


# ==========================================
# 1. Module & Schema Imports
# ==========================================

def test_dashboard_module_import():
    """1. Dashboard module import test."""
    from backend.app.api import dashboard
    assert dashboard.router is not None
    assert hasattr(dashboard, "get_dashboard_summary")
    assert hasattr(dashboard, "get_dashboard_map")
    assert hasattr(dashboard, "get_live_shipments")


def test_dashboard_schema_import():
    """2. Dashboard schema import test."""
    from backend.app.schemas import dashboard as dash_schemas
    assert hasattr(dash_schemas, "DashboardHealthResponse")
    assert hasattr(dash_schemas, "DashboardSummaryResponse")
    assert hasattr(dash_schemas, "DashboardMapResponse")
    assert hasattr(dash_schemas, "LiveShipmentsResponse")
    assert hasattr(dash_schemas, "LiveDisruptionsResponse")
    assert hasattr(dash_schemas, "RecoveryDashboardResponse")
    assert hasattr(dash_schemas, "DashboardKpiResponse")
    assert hasattr(dash_schemas, "ScenariosDashboardResponse")


# ==========================================
# 2. Health Endpoint
# ==========================================

def test_health_endpoint():
    """3. Health endpoint test (/api/health and /health)."""
    res1 = client.get("/api/health")
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["service_status"] == "healthy"
    assert data1["api_status"] == "online"
    assert data1["digital_twin_available"] is True
    assert data1["simulation_time"] == 12.0
    assert "PNT1" in data1["active_twin_name"]
    assert "timestamp" in data1

    res2 = client.get("/health")
    assert res2.status_code == 200
    assert res2.json()["service_status"] == "healthy"


# ==========================================
# 3. Dashboard Summary
# ==========================================

def test_dashboard_summary():
    """4. Dashboard summary endpoint test."""
    res = client.get("/api/dashboard/summary")
    assert res.status_code == 200
    data = res.json()
    assert data["source_twin"] == "active_twin"
    assert data["scenario_id"] is None
    assert data["node_count"] == 16
    assert data["edge_count"] > 0
    assert data["supplier_count"] == 2
    assert data["warehouse_count"] == 2
    assert data["customer_count"] == 6
    assert data["shipment_count"] == 5
    assert data["order_count"] == 10
    assert data["active_disruption_count"] == 0
    assert "traffic_summary" in data
    assert "inventory_risk" in data


# ==========================================
# 4. Digital Twin Map API
# ==========================================

def test_map_endpoint():
    """5. Map endpoint structure test."""
    res = client.get("/api/dashboard/map")
    assert res.status_code == 200
    data = res.json()
    assert data["source_twin"] == "active_twin"
    assert data["node_count"] == len(data["nodes"])
    assert data["edge_count"] == len(data["edges"])
    assert data["node_count"] == 16


def test_map_nodes():
    """6. Map nodes attribute completeness test."""
    res = client.get("/api/dashboard/map")
    assert res.status_code == 200
    nodes = res.json()["nodes"]
    assert len(nodes) == 16
    for node in nodes:
        assert "node_id" in node
        assert "type" in node
        assert "label" in node
        assert "lat" in node
        assert "lon" in node
        assert "status" in node
        assert isinstance(node["lat"], float)
        assert isinstance(node["lon"], float)

    types = {n["type"] for n in nodes}
    assert "supplier" in types
    assert "warehouse" in types
    assert "port" in types
    assert "customer" in types
    assert "junction" in types


def test_map_edges():
    """7. Map edges attribute completeness test."""
    res = client.get("/api/dashboard/map")
    assert res.status_code == 200
    edges = res.json()["edges"]
    assert len(edges) > 0
    for edge in edges:
        assert "source" in edge
        assert "target" in edge
        assert "mode" in edge
        assert "distance" in edge
        assert "speed" in edge
        assert "capacity" in edge
        assert "current_travel_time" in edge
        assert "congestion" in edge
        assert "risk" in edge
        assert "reliability" in edge
        assert "transport_cost" in edge
        assert "carbon_kg" in edge


def test_multimodal_edge_mode():
    """8. Multimodal edge mode distinction (road, rail, ocean)."""
    res = client.get("/api/dashboard/map")
    assert res.status_code == 200
    edges = res.json()["edges"]
    modes = {edge["mode"] for edge in edges}
    assert "road" in modes
    assert "rail" in modes
    assert "ocean" in modes


# ==========================================
# 5. Live Shipment Monitoring
# ==========================================

def test_shipment_live_endpoint():
    """9. Live shipment monitoring endpoint test."""
    res = client.get("/api/dashboard/shipments/live")
    assert res.status_code == 200
    data = res.json()
    assert data["source_twin"] == "active_twin"
    assert data["count"] == 5
    assert len(data["shipments"]) == 5

    for shp in data["shipments"]:
        assert "shipment_id" in shp
        assert "order_id" in shp
        assert "origin_id" in shp
        assert "destination_id" in shp
        assert "route" in shp
        assert "status" in shp
        assert "is_feasible" in shp
        assert "delay" in shp
        assert "affected_by_disruption" in shp
        assert isinstance(shp["route"], list)
        assert isinstance(shp["is_feasible"], bool)


# ==========================================
# 6. Live Disruption Monitoring
# ==========================================

def test_disruption_live_endpoint():
    """10. Live disruption monitoring endpoint test."""
    # Initially 0 active disruptions
    res = client.get("/api/dashboard/disruptions/live")
    assert res.status_code == 200
    data = res.json()
    assert data["source_twin"] == "active_twin"
    assert data["count"] == 0
    assert data["disruptions"] == []


# ==========================================
# 7. Recovery Monitoring
# ==========================================

def test_recovery_endpoint():
    """11. Recovery monitoring endpoint test."""
    res = client.get("/api/dashboard/recovery")
    assert res.status_code == 200
    data = res.json()
    assert data["plans_count"] == 0
    assert data["commits_count"] == 0
    assert data["plans"] == []
    assert data["commits"] == []


# ==========================================
# 8. Operational KPIs
# ==========================================

def test_kpi_endpoint():
    """12. Measurable KPI endpoint test."""
    res = client.get("/api/dashboard/kpis")
    assert res.status_code == 200
    data = res.json()
    assert data["source_twin"] == "active_twin"
    assert data["simulation_time"] == 12.0
    assert data["total_orders"] == 10
    assert data["active_shipments"] >= 4
    assert data["affected_shipments"] == 0
    assert data["delayed_shipments"] == 0
    assert data["disrupted_warehouses"] == 0
    assert data["available_inventory"] > 0
    assert data["stockout_risk_count"] == 0
    assert data["total_travel_time"] > 0
    assert data["total_transport_cost"] > 0
    assert data["fulfillment_rate_pct"] >= 50.0


# ==========================================
# 9. What-If Scenarios
# ==========================================

def test_scenario_endpoint():
    """13. What-if scenarios dashboard endpoint test."""
    res = client.get("/api/dashboard/scenarios")
    assert res.status_code == 200
    data = res.json()
    assert data["count"] == 0
    assert data["scenarios"] == []

    # Clone a scenario and verify it appears
    clone_res = client.post("/api/twin/scenario/clone", json={"scenario_name": "earthquake_test"})
    assert clone_res.status_code == 200
    scen_id = clone_res.json()["scenario_id"]

    res2 = client.get("/api/dashboard/scenarios")
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["count"] == 1
    assert data2["scenarios"][0]["scenario_id"] == scen_id
    assert data2["scenarios"][0]["scenario_name"] == "earthquake_test"
    assert data2["scenarios"][0]["commit_status"] == "NONE"


# ==========================================
# 10. Simulation Clock Control
# ==========================================

def test_simulation_endpoint():
    """14. Simulation clock advance endpoint test."""
    res = client.post("/api/dashboard/simulation/advance", json={"hours": 2.5})
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["source_twin"] == "active_twin"
    assert data["previous_time"] == 12.0
    assert data["current_time"] == 14.5
    assert data["advanced_hours"] == 2.5
    assert state.active_twin.simulation_time == 14.5


# ==========================================
# 11. Live Stream Endpoint (SSE)
# ==========================================

def test_stream_endpoint():
    """15. Stream endpoint (Server-Sent Events) test."""
    res = client.get("/api/dashboard/stream")
    assert res.status_code == 200
    assert "text/event-stream" in res.headers["content-type"]
    text = res.text
    assert "event: tick" in text
    assert '"active_twin"' in text


# ==========================================
# 12. Active Twin Identification
# ==========================================

def test_active_twin_identification():
    """16. Summary response correctly identifies authoritative active twin."""
    res = client.get("/api/dashboard/summary")
    assert res.status_code == 200
    data = res.json()
    assert data["source_twin"] == "active_twin"
    assert data["scenario_id"] is None
    assert "PNT1" in data["twin_name"]


# ==========================================
# 13. Scenario Isolation
# ==========================================

def test_scenario_isolation():
    """17. Injected disruption on scenario clone does not leak to active twin."""
    clone_res = client.post("/api/twin/scenario/clone", json={"scenario_name": "isolated_branch"})
    scen_id = clone_res.json()["scenario_id"]

    # Inject disruption on scenario only
    disr_res = client.post(f"/api/twin/scenario/{scen_id}/disruptions", json={
        "type": "ROAD_CLOSURE",
        "target_id": "2-11",
        "severity": 1.0,
        "start_time": 12.0,
        "duration_hours": 6.0,
        "description": "Bay Bridge Closed"
    })
    assert disr_res.status_code == 200

    # Baseline active twin disruptions remains 0
    base_disr = client.get("/api/dashboard/disruptions/live")
    assert base_disr.status_code == 200
    assert base_disr.json()["count"] == 0

    # Scenario disruptions reflects 1 active disruption
    scen_disr = client.get(f"/api/dashboard/disruptions/live?scenario_id={scen_id}")
    assert scen_disr.status_code == 200
    assert scen_disr.json()["count"] == 1
    assert scen_disr.json()["disruptions"][0]["target_id"] == "2-11"


# ==========================================
# 14. Baseline / Scenario Separation
# ==========================================

def test_baseline_scenario_separation():
    """18. Baseline and scenario responses are cleanly distinct."""
    clone_res = client.post("/api/twin/scenario/clone", json={"scenario_name": "branch_alpha"})
    scen_id = clone_res.json()["scenario_id"]

    # Baseline summary
    base_res = client.get("/api/dashboard/summary")
    assert base_res.json()["source_twin"] == "active_twin"
    assert base_res.json()["scenario_id"] is None

    # Scenario summary
    scen_res = client.get(f"/api/dashboard/summary?scenario_id={scen_id}")
    assert scen_res.json()["source_twin"] == "scenario"
    assert scen_res.json()["scenario_id"] == scen_id


# ==========================================
# 15. JSON Serialization
# ==========================================

def test_json_serialization():
    """19. Responses across all dashboard endpoints are valid, parseable JSON."""
    endpoints = [
        "/api/health",
        "/api/dashboard/summary",
        "/api/dashboard/map",
        "/api/dashboard/shipments/live",
        "/api/dashboard/disruptions/live",
        "/api/dashboard/recovery",
        "/api/dashboard/kpis",
        "/api/dashboard/scenarios"
    ]
    for ep in endpoints:
        res = client.get(ep)
        assert res.status_code == 200
        # Will raise if invalid JSON
        parsed = res.json()
        assert isinstance(parsed, dict)


# ==========================================
# 16. Invalid Scenario Handling
# ==========================================

def test_invalid_scenario_handling():
    """20. Querying non-existent scenario ID returns 404."""
    res = client.get("/api/dashboard/summary?scenario_id=scen-non-existent")
    assert res.status_code == 404
    assert "not found" in res.json()["detail"].lower()


# ==========================================
# 17. Invalid Request Handling
# ==========================================

def test_invalid_request_handling():
    """21. Advance request with invalid hours (negative or out-of-bounds) returns 422."""
    res_neg = client.post("/api/dashboard/simulation/advance", json={"hours": -5.0})
    assert res_neg.status_code == 422

    res_huge = client.post("/api/dashboard/simulation/advance", json={"hours": 999.0})
    assert res_huge.status_code == 422


# ==========================================
# 18. 404 Handling Across Endpoints
# ==========================================

def test_404_handling():
    """22. Consistent 404 handling across all scenario-targeted endpoints."""
    bad_id = "scen-missing-404"
    endpoints = [
        f"/api/dashboard/summary?scenario_id={bad_id}",
        f"/api/dashboard/map?scenario_id={bad_id}",
        f"/api/dashboard/shipments/live?scenario_id={bad_id}",
        f"/api/dashboard/disruptions/live?scenario_id={bad_id}",
        f"/api/dashboard/recovery?scenario_id={bad_id}",
        f"/api/dashboard/kpis?scenario_id={bad_id}",
    ]
    for ep in endpoints:
        res = client.get(ep)
        assert res.status_code == 404
        assert bad_id in res.json()["detail"]


# ==========================================
# 19. Active Disruption Reporting
# ==========================================

def test_active_disruption_reporting():
    """23. Active disruption reporting includes affected nodes, edges, and impact chain."""
    dm = DisruptionManager(state.active_twin)
    d = Disruption(
        type=DisruptionType.ROAD_CLOSURE,
        target_id="2-11",
        severity=1.0,
        start_time=12.0,
        duration_hours=4.0,
        description="Bay Bridge maintenance closure"
    )
    dm.inject_disruption(d)

    res = client.get("/api/dashboard/disruptions/live")
    assert res.status_code == 200
    data = res.json()
    assert data["count"] == 1
    item = data["disruptions"][0]
    assert item["disruption_type"] == "ROAD_CLOSURE"
    assert item["target_id"] == "2-11"
    assert item["severity"] == 1.0
    assert len(item["affected_edges"]) >= 1
    assert "SHP-001" in item["affected_shipments"]
    assert len(item["impact_chain"]) > 0


# ==========================================
# 20. Congestion Reporting
# ==========================================

def test_congestion_reporting():
    """24. Traffic summary reports average congestion and congested link counts."""
    res = client.get("/api/dashboard/summary")
    assert res.status_code == 200
    ts = res.json()["traffic_summary"]
    assert "current_hour" in ts
    assert "average_congestion" in ts
    assert "congested_links_count" in ts
    assert ts["average_congestion"] >= 0.0
    assert ts["congested_links_count"] >= 0


# ==========================================
# 21. Shipment Route Reporting
# ==========================================

def test_shipment_route_reporting():
    """25. Shipment monitoring includes valid route sequence and feasibility status."""
    res = client.get("/api/dashboard/shipments/live")
    assert res.status_code == 200
    shipments = res.json()["shipments"]
    for s in shipments:
        assert isinstance(s["route"], list)
        assert len(s["route"]) > 0
        assert s["is_feasible"] is True


# ==========================================
# 22. Inventory Risk Reporting
# ==========================================

def test_inventory_risk_reporting():
    """26. Inventory risk summary computes stockout risks and reorder thresholds."""
    res = client.get("/api/dashboard/summary")
    assert res.status_code == 200
    ir = res.json()["inventory_risk"]
    assert ir["total_items"] == 6
    assert ir["stockout_risk_count"] == 0
    assert ir["total_available_stock"] > 0
    assert ir["total_reserved_stock"] > 0


# ==========================================
# 23. Recovery Plan Identifiers
# ==========================================

def test_recovery_plan_identifiers():
    """27. Recovery plans formulated on a scenario appear with proper identifiers."""
    clone_res = client.post("/api/twin/scenario/clone", json={"scenario_name": "reroute_demo"})
    scen_id = clone_res.json()["scenario_id"]

    # Inject disruption on scenario
    client.post(f"/api/twin/scenario/{scen_id}/disruptions", json={
        "type": "ROAD_CLOSURE",
        "target_id": "2-11",
        "severity": 1.0,
        "start_time": 12.0,
        "duration_hours": 6.0
    })

    # Execute recovery optimization
    rec_res = client.post(f"/api/twin/scenario/{scen_id}/recover", json={"solver": "iqpso", "iterations": 10})
    assert rec_res.status_code == 200
    plan_id = rec_res.json()["plan_id"]

    # Check dashboard recovery endpoint
    dash_rec = client.get(f"/api/dashboard/recovery?scenario_id={scen_id}")
    assert dash_rec.status_code == 200
    data = dash_rec.json()
    assert data["plans_count"] == 1
    assert data["plans"][0]["plan_id"] == plan_id
    assert data["plans"][0]["scenario_id"] == scen_id
    assert data["plans"][0]["solver"] == "IQPSO"


# ==========================================
# 24. Rollback Identifiers
# ==========================================

def test_rollback_identifiers():
    """28. Committed recovery operations display snapshot_id and rollback availability."""
    clone_res = client.post("/api/twin/scenario/clone", json={"scenario_name": "commit_demo"})
    scen_id = clone_res.json()["scenario_id"]

    # Inject disruption on scenario
    client.post(f"/api/twin/scenario/{scen_id}/disruptions", json={
        "type": "ROAD_CLOSURE",
        "target_id": "2-11",
        "severity": 1.0,
        "start_time": 12.0,
        "duration_hours": 6.0
    })

    # Execute recovery
    rec_res = client.post(f"/api/twin/scenario/{scen_id}/recover", json={"iterations": 10})
    plan_id = rec_res.json()["plan_id"]

    # Commit recovery
    commit_res = client.post(f"/api/twin/scenario/{scen_id}/commit", json={"plan_id": plan_id, "approval": True})
    assert commit_res.status_code == 200
    commit_id = commit_res.json()["commit_id"]
    snapshot_id = commit_res.json()["snapshot_id"]

    # Check dashboard recovery
    dash_rec = client.get(f"/api/dashboard/recovery?scenario_id={scen_id}")
    assert dash_rec.status_code == 200
    data = dash_rec.json()
    assert data["commits_count"] == 1
    commit_entry = data["commits"][0]
    assert commit_entry["commit_id"] == commit_id
    assert commit_entry["snapshot_id"] == snapshot_id
    assert commit_entry["rollback_available"] is True
    assert commit_entry["status"] == "COMMITTED"


# ==========================================
# 25. CORS Behavior
# ==========================================

def test_cors_behavior():
    """29. Response headers include CORS configuration allowing web client requests."""
    res = client.get("/api/health", headers={"Origin": "http://localhost:3000"})
    assert res.status_code == 200
    assert "access-control-allow-origin" in res.headers


# ==========================================
# 26. Backward Compatibility
# ==========================================

def test_existing_apis_remain_functional():
    """30. Existing Digital Twin, Disruption, and Optimization APIs remain 100% operational."""
    # Twin APIs
    res1 = client.get("/api/twin/state")
    assert res1.status_code == 200
    res2 = client.get("/api/twin/summary")
    assert res2.status_code == 200
    res3 = client.get("/api/twin/snapshots")
    assert res3.status_code == 200

    # Logistics domain entities
    res4 = client.get("/api/suppliers")
    assert res4.status_code == 200
    assert len(res4.json()) == 2
    res5 = client.get("/api/warehouses")
    assert res5.status_code == 200
    assert len(res5.json()) == 2
    res6 = client.get("/api/vehicles")
    assert res6.status_code == 200
    assert len(res6.json()) == 6
    res7 = client.get("/api/customers")
    assert res7.status_code == 200
    assert len(res7.json()) == 6
    res8 = client.get("/api/orders")
    assert res8.status_code == 200
    assert len(res8.json()) == 10
    res9 = client.get("/api/shipments")
    assert res9.status_code == 200
    assert len(res9.json()) == 5

    # Disruptions
    res10 = client.get("/api/disruptions")
    assert res10.status_code == 200


# ==========================================
# 27. Bounded Simulation Advance Validation
# ==========================================

def test_simulation_advance_boundary_validation():
    """31. Bounded validation: accepts 0.1h and 48.0h, rejects 0.0h and 48.1h."""
    # Valid lower and upper bounds
    res_low = client.post("/api/dashboard/simulation/advance", json={"hours": 0.1})
    assert res_low.status_code == 200

    res_high = client.post("/api/dashboard/simulation/advance", json={"hours": 48.0})
    assert res_high.status_code == 200

    # Invalid boundary values
    res_zero = client.post("/api/dashboard/simulation/advance", json={"hours": 0.0})
    assert res_zero.status_code == 422

    res_excess = client.post("/api/dashboard/simulation/advance", json={"hours": 48.1})
    assert res_excess.status_code == 422


# ==========================================
# 28. Invalidation of Shipments Traversing Disrupted Corridor
# ==========================================

def test_shipment_invalidation_under_disruption():
    """32. Closing link (2, 11) flags shipment SHP-001 as affected and infeasible."""
    dm = DisruptionManager(state.active_twin)
    d = Disruption(
        type=DisruptionType.ROAD_CLOSURE,
        target_id="2-11",
        severity=1.0,
        start_time=12.0,
        duration_hours=4.0
    )
    dm.inject_disruption(d)

    res = client.get("/api/dashboard/shipments/live")
    assert res.status_code == 200
    shipments = {s["shipment_id"]: s for s in res.json()["shipments"]}

    shp_1 = shipments["SHP-001"]
    assert shp_1["is_feasible"] is False
    assert shp_1["affected_by_disruption"] is True
    assert "closed" in shp_1["invalidation_reason"].lower()

    # SHP-002 (route [2, 7]) is not on (2, 11) so remains feasible
    shp_2 = shipments["SHP-002"]
    assert shp_2["is_feasible"] is True


# ==========================================
# 29. WebSocket Stream Communication
# ==========================================

def test_websocket_stream():
    """33. Bidirectional WebSocket stream connects, receives init event, and responds to ping."""
    with client.websocket_connect("/api/dashboard/ws") as websocket:
        init_msg = websocket.receive_json()
        assert init_msg["type"] == "init"
        assert init_msg["source_twin"] == "active_twin"
        assert "simulation_time" in init_msg

        # Send ping, verify pong
        websocket.send_text("ping")
        pong_msg = websocket.receive_json()
        assert pong_msg["type"] == "pong"
        assert "simulation_time" in pong_msg

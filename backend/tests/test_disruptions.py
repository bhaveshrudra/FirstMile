import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.api import state
from backend.app.digital_twin.seed import create_pnt1_seed_twin
from backend.app.disruption.models import Disruption, DisruptionType, DisruptionStatus
from backend.app.disruption.manager import DisruptionManager
from backend.app.disruption.impact import analyze_disruption_impact, analyze_twin_impact
from backend.app.scenarios.simulation import run_scenario_simulation
from backend.app.models.supplier import SupplierStatus
from backend.app.models.warehouse import WarehouseStatus

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_seed_twin():
    """Ensure every test starts with a fresh PNT1 seed twin."""
    state.active_twin = create_pnt1_seed_twin()
    state.scenarios.clear()
    state.snapshot_manager.clear()


# 1. Road Closure Injection
def test_road_closure_injection():
    twin = state.active_twin
    dm = DisruptionManager(twin)

    disruption = Disruption(
        type=DisruptionType.ROAD_CLOSURE,
        target_id="2-11",
        severity=1.0,
        duration_hours=12.0
    )
    dm.inject_disruption(disruption)

    # Edge (2, 11) must be closed with travel time 999.0
    assert twin.graph.graph.edges[2, 11]["road_status"] == "closed"
    assert twin.graph.graph.edges[2, 11]["current_travel_time"] == 999.0

    # Resolve and check reversion
    dm.resolve_disruption(disruption.id)
    assert twin.graph.graph.edges[2, 11]["road_status"] == "open"
    assert twin.graph.graph.edges[2, 11]["current_travel_time"] < 999.0


# 2. Road Accident Injection
def test_road_accident_injection():
    twin = state.active_twin
    dm = DisruptionManager(twin)

    base_time = twin.graph.graph.edges[2, 11]["current_travel_time"]
    disruption = Disruption(
        type=DisruptionType.ROAD_ACCIDENT,
        target_id="2-11",
        severity=0.7,
        duration_hours=4.0
    )
    dm.inject_disruption(disruption)

    # Incident must be active in simulator and travel time increased
    assert len(twin.simulator.incidents) > 0
    assert twin.graph.graph.edges[2, 11]["current_travel_time"] > base_time

    dm.resolve_disruption(disruption.id)
    assert len(twin.simulator.incidents) == 0


# 3. Extreme Weather Injection
def test_extreme_weather_injection():
    twin = state.active_twin
    dm = DisruptionManager(twin)

    disruption = Disruption(
        type=DisruptionType.EXTREME_WEATHER,
        target_id="3-13",
        severity=0.6,
        duration_hours=8.0
    )
    dm.inject_disruption(disruption)

    assert len(twin.simulator.incidents) > 0
    dm.resolve_disruption(disruption.id)
    assert len(twin.simulator.incidents) == 0


# 4. Port Disruption
def test_port_disruption():
    twin = state.active_twin
    dm = DisruptionManager(twin)

    disruption = Disruption(
        type=DisruptionType.PORT_CLOSURE,
        target_id="P1",
        severity=1.0,
        duration_hours=24.0
    )
    dm.inject_disruption(disruption)

    # Node 4 (Port of Oakland) should be marked CLOSED
    assert twin.graph.graph.nodes[4]["status"] == "CLOSED"
    # Intermodal maritime edge (4, 2) should be closed
    assert twin.graph.graph.edges[4, 2]["road_status"] == "closed"

    dm.resolve_disruption(disruption.id)
    assert twin.graph.graph.nodes[4]["status"] == "ACTIVE"
    assert twin.graph.graph.edges[4, 2]["road_status"] == "open"


# 5. Supplier Failure
def test_supplier_failure():
    twin = state.active_twin
    dm = DisruptionManager(twin)

    s1 = twin.get_supplier("S1")
    assert s1.status == SupplierStatus.ACTIVE
    orig_cap = s1.available_capacity

    disruption = Disruption(
        type=DisruptionType.SUPPLIER_FAILURE,
        target_id="S1",
        severity=1.0,
        duration_hours=24.0
    )
    dm.inject_disruption(disruption)

    assert s1.status == SupplierStatus.OFFLINE
    assert s1.available_capacity == 0.0

    dm.resolve_disruption(disruption.id)
    assert s1.status == SupplierStatus.ACTIVE
    assert s1.available_capacity == orig_cap


# 6. Warehouse Failure
def test_warehouse_failure():
    twin = state.active_twin
    dm = DisruptionManager(twin)

    w1 = twin.get_warehouse("W1")
    assert w1.status == WarehouseStatus.ACTIVE
    orig_tp = w1.throughput_capacity

    disruption = Disruption(
        type=DisruptionType.WAREHOUSE_FAILURE,
        target_id="W1",
        severity=1.0,
        duration_hours=48.0
    )
    dm.inject_disruption(disruption)

    assert w1.status == WarehouseStatus.OFFLINE
    assert w1.throughput_capacity == 0.0

    dm.resolve_disruption(disruption.id)
    assert w1.status == WarehouseStatus.ACTIVE
    assert w1.throughput_capacity == orig_tp


# 7. Demand Spike
def test_demand_spike():
    twin = state.active_twin
    dm = DisruptionManager(twin)

    o1 = twin.get_order("ORD-001")
    orig_qty = o1.quantity  # 50.0

    disruption = Disruption(
        type=DisruptionType.DEMAND_SPIKE,
        target_id="C1",
        severity=0.5,
        duration_hours=12.0,
        parameters={"multiplier": 1.5}
    )
    dm.inject_disruption(disruption)

    assert o1.quantity == 75.0

    dm.resolve_disruption(disruption.id)
    assert o1.quantity == orig_qty


# 8. Data Blackout Representation
def test_data_blackout_representation():
    twin = state.active_twin
    dm = DisruptionManager(twin)

    v1 = twin.get_vehicle("V1")
    assert v1.telemetry_freshness == 1.0

    disruption = Disruption(
        type=DisruptionType.DATA_BLACKOUT,
        target_id="V1",
        severity=0.8,
        duration_hours=6.0
    )
    dm.inject_disruption(disruption)

    assert v1.telemetry_freshness == pytest.approx(0.2, 0.01)
    assert "V1" in twin.vehicles  # Entity not deleted

    dm.resolve_disruption(disruption.id)
    assert v1.telemetry_freshness == 1.0


# 9. GPS Spoof Representation
def test_gps_spoof_representation():
    twin = state.active_twin
    dm = DisruptionManager(twin)

    v1 = twin.get_vehicle("V1")
    orig_loc = v1.current_location
    assert v1.is_suspect is False

    disruption = Disruption(
        type=DisruptionType.GPS_SPOOF,
        target_id="V1",
        severity=1.0,
        duration_hours=12.0
    )
    dm.inject_disruption(disruption)

    assert v1.is_suspect is True
    assert v1.actual_location == orig_loc
    assert v1.reported_location is not None
    assert v1.current_location != orig_loc

    dm.resolve_disruption(disruption.id)
    assert v1.is_suspect is False
    assert v1.current_location == orig_loc


# 10. Disruption Listing
def test_disruption_listing():
    twin = state.active_twin
    dm = DisruptionManager(twin)

    d1 = Disruption(type=DisruptionType.ROAD_CLOSURE, target_id="2-11", severity=1.0, duration_hours=10.0)
    d2 = Disruption(type=DisruptionType.SUPPLIER_FAILURE, target_id="S1", severity=1.0, duration_hours=10.0)
    dm.inject_disruption(d1)
    dm.inject_disruption(d2)

    all_d = dm.list_disruptions()
    assert len(all_d) == 2

    dm.resolve_disruption(d1.id)
    active_d = dm.list_disruptions(active_only=True)
    assert len(active_d) == 1
    assert active_d[0].id == d2.id


# 11. Disruption Retrieval
def test_disruption_retrieval():
    twin = state.active_twin
    dm = DisruptionManager(twin)

    d = Disruption(type=DisruptionType.ROAD_CLOSURE, target_id="2-11", severity=1.0, duration_hours=10.0)
    dm.inject_disruption(d)

    found = dm.get_disruption(d.id)
    assert found is not None
    assert found.id == d.id
    assert dm.get_disruption("nonexistent_id") is None


# 12. Disruption Resolution
def test_disruption_resolution():
    twin = state.active_twin
    dm = DisruptionManager(twin)

    d = Disruption(type=DisruptionType.ROAD_CLOSURE, target_id="2-11", severity=1.0, duration_hours=10.0)
    dm.inject_disruption(d)
    assert d.status == DisruptionStatus.ACTIVE

    resolved = dm.resolve_disruption(d.id)
    assert resolved.status == DisruptionStatus.RESOLVED


# 13. Impact Analysis
def test_impact_analysis():
    twin = state.active_twin
    disruption = Disruption(
        type=DisruptionType.ROAD_CLOSURE,
        target_id="2-11",
        severity=1.0,
        duration_hours=12.0
    )

    impact = analyze_disruption_impact(disruption, twin)
    assert (2, 11) in impact["affected_links"]
    # Shipment SHP-001 has route [2, 11, 5]
    assert "SHP-001" in impact["affected_shipments"]
    assert "ORD-001" in impact["affected_orders"]
    assert "C1" in impact["affected_customers"]
    assert len(impact["impact_chain"]) >= 2


# 14. Basic Cascade Analysis
def test_basic_cascade_analysis():
    twin = state.active_twin
    disruption = Disruption(
        type=DisruptionType.PORT_CLOSURE,
        target_id="P1",
        severity=1.0,
        duration_hours=24.0
    )

    impact = analyze_disruption_impact(disruption, twin)
    # SHP-005 runs from Port P1 to Warehouse W1
    assert "SHP-005" in impact["affected_shipments"]
    assert "W1" in impact["affected_warehouses"]
    assert "ORD-001" in impact["affected_orders"]
    chain_text = " ".join(impact["impact_chain"])
    assert "Port" in chain_text
    assert "terminal" in chain_text.lower()


# 15. Scenario-Specific Disruption via API
def test_scenario_specific_disruption():
    # 1. Clone scenario
    res_clone = client.post("/api/twin/scenario/clone", json={"scenario_name": "what_if_disaster"})
    assert res_clone.status_code == 200
    scen_id = res_clone.json()["scenario_id"]

    # 2. Inject disruption into scenario
    res_inject = client.post(
        f"/api/twin/scenario/{scen_id}/disruptions",
        json={
            "type": "ROAD_CLOSURE",
            "target_id": "2-11",
            "severity": 1.0,
            "duration_hours": 24.0
        }
    )
    assert res_inject.status_code == 200
    disr_data = res_inject.json()
    disr_id = disr_data["id"]

    # 3. Verify scenario has disruption
    res_list = client.get(f"/api/twin/scenario/{scen_id}/disruptions")
    assert res_list.status_code == 200
    assert any(d["id"] == disr_id for d in res_list.json())

    # 4. Check scenario impact endpoint
    res_imp = client.get(f"/api/twin/scenario/{scen_id}/impact")
    assert res_imp.status_code == 200
    assert res_imp.json()["active_disruptions_count"] == 1


# 16. Scenario Does Not Mutate Baseline
def test_scenario_does_not_mutate_baseline():
    # Ensure baseline has 0 disruptions
    assert len(state.active_twin.disruptions) == 0

    # Clone scenario
    res_clone = client.post("/api/twin/scenario/clone", json={"scenario_name": "isolated_test"})
    scen_id = res_clone.json()["scenario_id"]

    # Ingest disruption in scenario
    client.post(
        f"/api/twin/scenario/{scen_id}/disruptions",
        json={
            "type": "PORT_CLOSURE",
            "target_id": "P1",
            "severity": 1.0,
            "duration_hours": 12.0
        }
    )

    # Scenario has 1 disruption, baseline has 0
    scen_twin = state.scenarios[scen_id]
    assert len(scen_twin.disruptions) == 1
    assert scen_twin.graph.graph.nodes[4]["status"] == "CLOSED"

    # Baseline remains 100% untouched
    assert len(state.active_twin.disruptions) == 0
    assert state.active_twin.graph.graph.nodes[4]["status"] == "ACTIVE"


# 17. Virtual Time Advancement
def test_virtual_time_advancement():
    twin = state.active_twin
    assert twin.simulation_time == 12.0

    twin.update_simulation_time(18.5)
    assert twin.simulation_time == 18.5
    assert twin.simulator.current_hour == 18.5


# 18. Simulation with Multiple Steps
def test_simulation_with_multiple_steps():
    # Clone scenario
    res_clone = client.post("/api/twin/scenario/clone", json={"scenario_name": "sim_run"})
    scen_id = res_clone.json()["scenario_id"]

    # Inject disruption
    client.post(
        f"/api/twin/scenario/{scen_id}/disruptions",
        json={
            "type": "ROAD_CLOSURE",
            "target_id": "2-11",
            "severity": 1.0,
            "duration_hours": 18.0
        }
    )

    # Run simulation: 24h with 6h steps
    sim_res = client.post(
        f"/api/twin/scenario/{scen_id}/simulate",
        json={"duration_hours": 24.0, "step_hours": 6.0}
    )
    assert sim_res.status_code == 200
    data = sim_res.json()
    assert data["total_steps"] == 5  # Step 0, 1, 2, 3, 4
    timeline = data["timeline"]
    assert len(timeline) == 5
    assert timeline[0]["elapsed_hours"] == 0.0
    assert timeline[-1]["elapsed_hours"] == 24.0


# 19. Disruption Expiry
def test_disruption_expiry():
    twin = state.active_twin
    dm = DisruptionManager(twin)

    # Disruption lasts 6 hours
    d = Disruption(
        type=DisruptionType.ROAD_CLOSURE,
        target_id="2-11",
        severity=1.0,
        start_time=12.0,
        duration_hours=6.0
    )
    dm.inject_disruption(d)
    assert d.status == DisruptionStatus.ACTIVE
    assert twin.graph.graph.edges[2, 11]["road_status"] == "closed"

    # Advance time past end time (12 + 6 = 18.0)
    twin.update_simulation_time(19.0)
    expired = dm.check_expiry(19.0)

    assert d.id in expired
    assert d.status == DisruptionStatus.EXPIRED
    assert twin.graph.graph.edges[2, 11]["road_status"] == "open"


# 20. Clear / Reset Behavior
def test_clear_reset_behavior():
    twin = state.active_twin
    dm = DisruptionManager(twin)

    dm.inject_disruption(Disruption(type=DisruptionType.ROAD_CLOSURE, target_id="2-11", severity=1.0, duration_hours=12.0))
    dm.inject_disruption(Disruption(type=DisruptionType.SUPPLIER_FAILURE, target_id="S1", severity=1.0, duration_hours=12.0))
    assert len(dm.list_disruptions(active_only=True)) == 2

    # Clear all
    dm.clear_all_disruptions()
    assert len(dm.list_disruptions(active_only=True)) == 0
    assert twin.graph.graph.edges[2, 11]["road_status"] == "open"
    assert twin.get_supplier("S1").status == SupplierStatus.ACTIVE

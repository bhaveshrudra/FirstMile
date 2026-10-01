import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.api import state
from backend.app.digital_twin.seed import create_pnt1_seed_twin
from backend.app.disruption.models import Disruption, DisruptionType, DisruptionStatus
from backend.app.disruption.manager import DisruptionManager

# 1. Recovery package imports
from backend.app.recovery import (
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
    RecoveryPlan,
    build_recovery_problem,
    get_default_objectives,
    get_default_constraints,
    RecoveryPlanner,
)

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_seed_twin():
    """Reset to clean deterministic seed twin and empty scenarios."""
    state.active_twin = create_pnt1_seed_twin()
    state.scenarios.clear()
    state.snapshot_manager.clear()


# 1. Verify recovery package imports
def test_recovery_package_imports():
    assert RecoveryProblem is not None
    assert RecoveryPlanner is not None
    assert build_recovery_problem is not None
    assert RecoveryActionType.REROUTE_SHIPMENT == "REROUTE_SHIPMENT"


# 2. Recovery Objective Validation
def test_recovery_objective_validation():
    obj = RecoveryObjective(name=RecoveryObjectiveType.TRAVEL_TIME, weight=1.5, enabled=True)
    assert obj.name == RecoveryObjectiveType.TRAVEL_TIME
    assert obj.weight == 1.5
    assert obj.enabled is True

    # Default objectives
    defaults = get_default_objectives()
    assert len(defaults) >= 4
    names = {o.name for o in defaults}
    assert RecoveryObjectiveType.TRAVEL_TIME in names
    assert RecoveryObjectiveType.TRANSPORT_COST in names
    assert RecoveryObjectiveType.RISK in names
    assert RecoveryObjectiveType.DELIVERY_DELAY in names


# 3. Recovery Constraint Validation
def test_recovery_constraint_validation():
    con = RecoveryConstraint(
        name="Test Vehicle Limit",
        type=RecoveryConstraintType.VEHICLE_CAPACITY,
        enabled=True,
        parameters={"max_weight": 250.0}
    )
    assert con.type == RecoveryConstraintType.VEHICLE_CAPACITY
    assert con.parameters["max_weight"] == 250.0

    defaults = get_default_constraints()
    assert len(defaults) >= 4


# 4. Recovery Action Validation
def test_recovery_action_validation():
    act = RecoveryAction(
        action_type=RecoveryActionType.REROUTE_SHIPMENT,
        target_id="SHP-001",
        parameters={"candidate_path": [2, 12, 11, 5]},
        description="Reroute via alternate junction"
    )
    assert act.action_type == RecoveryActionType.REROUTE_SHIPMENT
    assert act.target_id == "SHP-001"
    assert act.parameters["candidate_path"] == [2, 12, 11, 5]


# 5. Recovery Problem Construction
def test_recovery_problem_construction():
    twin = state.active_twin
    prob = build_recovery_problem(twin, scenario_id="baseline-test")

    assert prob.problem_id.startswith("prob-")
    assert prob.scenario_id == "baseline-test"
    assert isinstance(prob.objectives, list)
    assert isinstance(prob.constraints, list)
    assert isinstance(prob.baseline_metrics, BaselineRecoveryMetrics)
    assert prob.is_feasible is True


# 6. Affected Shipment Detection
def test_affected_shipment_detection():
    twin = state.active_twin
    dm = DisruptionManager(twin)

    # Close corridor 2-11
    dm.inject_disruption(Disruption(
        type=DisruptionType.ROAD_CLOSURE,
        target_id="2-11",
        severity=1.0,
        duration_hours=24.0
    ))

    prob = build_recovery_problem(twin)
    aff_ids = [s.shipment_id for s in prob.affected_shipments]
    # In PNT1 seed, SHP-001 has route [2, 11, 5]
    assert "SHP-001" in aff_ids


# 7. Candidate Route Discovery
def test_candidate_route_discovery():
    twin = state.active_twin
    dm = DisruptionManager(twin)

    dm.inject_disruption(Disruption(
        type=DisruptionType.ROAD_CLOSURE,
        target_id="2-11",
        severity=1.0,
        duration_hours=24.0
    ))

    prob = build_recovery_problem(twin)
    shp_001 = next(s for s in prob.affected_shipments if s.shipment_id == "SHP-001")
    assert len(shp_001.candidate_routes) > 0

    candidate = shp_001.candidate_routes[0]
    assert candidate.is_feasible is True
    # The alternate candidate route must NOT use closed edge (2, 11)
    edge_pairs = list(zip(candidate.path, candidate.path[1:]))
    assert (2, 11) not in edge_pairs
    assert candidate.travel_time_hours > 0.0
    assert candidate.distance_km > 0.0


# 8. Disrupted Route Detection
def test_disrupted_route_detection():
    twin = state.active_twin
    dm = DisruptionManager(twin)

    dm.inject_disruption(Disruption(
        type=DisruptionType.ROAD_CLOSURE,
        target_id="2-11",
        severity=1.0,
        duration_hours=24.0
    ))

    prob = build_recovery_problem(twin)
    shp_001 = next(s for s in prob.affected_shipments if s.shipment_id == "SHP-001")
    assert shp_001.is_route_invalid is True
    assert shp_001.invalidation_reason is not None
    assert "closed" in shp_001.invalidation_reason.lower() or "blocked" in shp_001.invalidation_reason.lower()


# 9. Baseline Metric Collection
def test_baseline_metric_collection():
    twin = state.active_twin
    dm = DisruptionManager(twin)

    dm.inject_disruption(Disruption(
        type=DisruptionType.ROAD_CLOSURE,
        target_id="2-11",
        severity=1.0,
        duration_hours=24.0
    ))

    prob = build_recovery_problem(twin)
    bm = prob.baseline_metrics
    assert bm.affected_shipments_count >= 1
    assert bm.total_travel_time > 0.0
    assert bm.total_distance > 0.0


# 10. Recovery Plan Placeholder Creation
def test_recovery_plan_placeholder_creation():
    twin = state.active_twin
    dm = DisruptionManager(twin)

    dm.inject_disruption(Disruption(
        type=DisruptionType.ROAD_CLOSURE,
        target_id="2-11",
        severity=1.0,
        duration_hours=24.0
    ))

    planner = RecoveryPlanner(twin)
    prob = planner.formulate_problem()
    plan = planner.generate_plan_placeholder(prob)

    assert plan.plan_id.startswith("plan-")
    assert plan.problem_id == prob.problem_id
    assert plan.feasibility_status == "FEASIBLE"
    assert "Phase 2B" in plan.explanation


# 11. Invalid Scenario Returns 404 via API
def test_invalid_scenario_returns_404():
    res = client.post("/api/twin/scenario/invalid-scenario-id/recovery/problem")
    assert res.status_code == 404


# 12. Recovery Problem Building Does Not Mutate Scenario
def test_recovery_problem_building_does_not_mutate_scenario():
    # Clone scenario
    res_clone = client.post("/api/twin/scenario/clone", json={"scenario_name": "scen_freeze"})
    scen_id = res_clone.json()["scenario_id"]
    twin = state.scenarios[scen_id]

    dm = DisruptionManager(twin)
    dm.inject_disruption(Disruption(
        type=DisruptionType.ROAD_CLOSURE,
        target_id="2-11",
        severity=1.0,
        duration_hours=12.0
    ))

    # Capture state before building problem
    orig_orders = {oid: o.quantity for oid, o in twin.orders.items()}
    orig_shipment_routes = {sid: list(s.route) for sid, s in twin.shipments.items()}
    orig_inventory = {k: inv.on_hand for k, inv in twin.inventory.items()}

    # Build problem via API
    res = client.post(f"/api/twin/scenario/{scen_id}/recovery/problem")
    assert res.status_code == 200

    # Verify scenario was not mutated
    assert {oid: o.quantity for oid, o in twin.orders.items()} == orig_orders
    assert {sid: list(s.route) for sid, s in twin.shipments.items()} == orig_shipment_routes
    assert {k: inv.on_hand for k, inv in twin.inventory.items()} == orig_inventory


# 13. Building Recovery Problem Does Not Mutate Baseline
def test_building_recovery_problem_does_not_mutate_baseline():
    baseline_disruptions = len(state.active_twin.disruptions)
    assert baseline_disruptions == 0

    res_clone = client.post("/api/twin/scenario/clone", json={"scenario_name": "scen_test"})
    scen_id = res_clone.json()["scenario_id"]

    # Inject disruption on scenario
    client.post(
        f"/api/twin/scenario/{scen_id}/disruptions",
        json={"type": "PORT_CLOSURE", "target_id": "P1", "severity": 1.0, "duration_hours": 24.0}
    )

    # Build recovery problem on scenario
    res = client.post(f"/api/twin/scenario/{scen_id}/recovery/problem")
    assert res.status_code == 200

    # Baseline remains 100% clean
    assert len(state.active_twin.disruptions) == 0
    assert state.active_twin.graph.graph.nodes[4]["status"] == "ACTIVE"


# 14. Port Closure Produces Affected Recovery Entities
def test_port_closure_produces_affected_recovery_entities():
    twin = state.active_twin
    dm = DisruptionManager(twin)

    dm.inject_disruption(Disruption(
        type=DisruptionType.PORT_CLOSURE,
        target_id="P1",
        severity=1.0,
        duration_hours=24.0
    ))

    prob = build_recovery_problem(twin)
    # Port P1 failure affects SHP-005 (route [4, 2]), warehouse W1, and order ORD-001
    aff_shipments = [s.shipment_id for s in prob.affected_shipments]
    assert "SHP-005" in aff_shipments
    assert "W1" in prob.affected_warehouses
    assert "ORD-001" in prob.affected_orders


# 15. Road Closure Produces Alternate Candidate Route
def test_road_closure_produces_alternate_candidate_route():
    twin = state.active_twin
    dm = DisruptionManager(twin)

    # Close link 2-11
    dm.inject_disruption(Disruption(
        type=DisruptionType.ROAD_CLOSURE,
        target_id="2-11",
        severity=1.0,
        duration_hours=24.0
    ))

    prob = build_recovery_problem(twin)
    shp_001 = next(s for s in prob.affected_shipments if s.shipment_id == "SHP-001")

    # Confirm candidate alternate route exists and starts at 2 and ends at 5
    assert len(shp_001.candidate_routes) > 0
    candidate = shp_001.candidate_routes[0]
    assert candidate.path[0] == 2
    assert candidate.path[-1] == 5
    # The alternate route must avoid (2, 11)
    edge_tuples = list(zip(candidate.path, candidate.path[1:]))
    assert (2, 11) not in edge_tuples


# 16. Warehouse Disruption Produces Affected Orders & Alternate Warehouse Candidates
def test_warehouse_disruption_produces_affected_orders():
    twin = state.active_twin
    dm = DisruptionManager(twin)

    dm.inject_disruption(Disruption(
        type=DisruptionType.WAREHOUSE_FAILURE,
        target_id="W1",
        severity=1.0,
        duration_hours=48.0
    ))

    prob = build_recovery_problem(twin)
    assert "W1" in prob.affected_warehouses
    # In PNT1 seed, ORD-001, ORD-002, ORD-003, ORD-004 are sourced from W1
    assert "ORD-001" in prob.affected_orders

    # Inventory identification without movement
    assert len(prob.affected_inventory) > 0
    w1_skus = {item.sku for item in prob.affected_inventory}
    assert "SKU-MED-CHIP" in w1_skus

    # Check candidate alternate warehouses
    item = next(i for i in prob.affected_inventory if i.sku == "SKU-MED-CHIP")
    alt_ids = [alt.warehouse_id for alt in item.candidate_alternate_warehouses]
    assert "W2" in alt_ids  # W2 also stocks SKU-MED-CHIP in seed


# 17. Supplier Disruption Produces Affected Entities
def test_supplier_disruption_produces_affected_entities():
    twin = state.active_twin
    dm = DisruptionManager(twin)

    dm.inject_disruption(Disruption(
        type=DisruptionType.SUPPLIER_FAILURE,
        target_id="S1",
        severity=1.0,
        duration_hours=24.0
    ))

    prob = build_recovery_problem(twin)
    assert "S1" in prob.affected_suppliers
    # Candidate action for alternative supplier must be present
    action_types = {act.action_type for act in prob.candidate_actions}
    assert RecoveryActionType.USE_ALTERNATE_SUPPLIER in action_types

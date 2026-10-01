import pytest
import numpy as np
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.api import state
from backend.app.digital_twin.seed import create_pnt1_seed_twin
from backend.app.disruption.models import Disruption, DisruptionType
from backend.app.disruption.manager import DisruptionManager
from backend.app.optimization.improved_qpso import ImprovedQPSO

from backend.app.recovery import (
    RecoveryObjectiveType,
    RecoveryObjective,
    RecoveryConstraintType,
    RecoveryConstraint,
    RecoveryActionType,
    RecoveryAction,
    CandidateRoute,
    AffectedShipment,
    BaselineRecoveryMetrics,
    RecoveryProblem,
    RecoveryPlan,
    ShipmentRecoveryResult,
    build_recovery_problem,
    RecoveryPlanner,
    RecoverySolverAdapter,
    evaluate_route_metrics,
    compute_recovery_fitness,
    make_shipment_fitness_fn,
)

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_seed_twin():
    """Reset to clean deterministic seed twin and empty scenarios."""
    state.active_twin = create_pnt1_seed_twin()
    state.scenarios.clear()
    state.snapshot_manager.clear()


# ==========================================
# 1. Adapter Imports
# ==========================================
def test_adapter_imports():
    assert RecoverySolverAdapter is not None
    assert evaluate_route_metrics is not None
    assert compute_recovery_fitness is not None
    assert make_shipment_fitness_fn is not None
    assert ShipmentRecoveryResult is not None
    assert RecoveryPlan is not None


# ==========================================
# 2. Solver Adapter Initialization
# ==========================================
def test_solver_adapter_initialization():
    twin = state.active_twin
    adapter = RecoverySolverAdapter(twin=twin, swarm_size=25, iterations=40, seed=123)
    assert adapter.twin == twin
    assert adapter.swarm_size == 25
    assert adapter.iterations == 40
    assert adapter.seed == 123


# ==========================================
# 3. Recovery Fitness Calculation
# ==========================================
def test_recovery_fitness_calculation():
    # Infeasible route -> penalized heavily
    infeasible_metrics = {"is_feasible": False, "travel_time": 999.0, "transport_cost": 999.0, "risk": 1.0, "delivery_delay": 999.0}
    weights = {"TRAVEL_TIME": 1.0, "TRANSPORT_COST": 0.8, "RISK": 0.5, "DELIVERY_DELAY": 1.0}
    score_infeasible = compute_recovery_fitness(infeasible_metrics, weights)
    assert score_infeasible == 1e6

    # Feasible routes: lower travel time/cost yields lower (better) score
    m1 = {"is_feasible": True, "travel_time": 10.0, "transport_cost": 50.0, "risk": 0.1, "delivery_delay": 0.0}
    m2 = {"is_feasible": True, "travel_time": 25.0, "transport_cost": 120.0, "risk": 0.3, "delivery_delay": 5.0}
    ref = {"travel_time": 10.0, "transport_cost": 50.0, "delivery_delay": 1.0}

    score1 = compute_recovery_fitness(m1, weights, ref)
    score2 = compute_recovery_fitness(m2, weights, ref)
    assert score1 < score2


# ==========================================
# 4. Single Affected Shipment Rerouting
# ==========================================
def test_single_affected_shipment_rerouting():
    twin = state.active_twin
    dm = DisruptionManager(twin)
    # Disrupt edge (2, 11) used by SHP-001 ([2, 11, 5])
    dm.inject_disruption(Disruption(
        type=DisruptionType.ROAD_CLOSURE,
        target_id="2-11",
        severity=1.0,
        duration_hours=24.0
    ))

    prob = build_recovery_problem(twin, scenario_id="test-scen")
    adapter = RecoverySolverAdapter(twin, swarm_size=20, iterations=30, seed=42)
    plan = adapter.solve_recovery(prob)

    assert len(plan.shipment_results) >= 1
    shp1_res = next((sr for sr in plan.shipment_results if sr.shipment_id == "SHP-001"), None)
    assert shp1_res is not None
    assert shp1_res.route_changed is True
    assert shp1_res.original_route == [2, 11, 5]
    assert shp1_res.optimized_route != [2, 11, 5]


# ==========================================
# 5. IQPSO Produces a Valid Route
# ==========================================
def test_iqpso_produces_a_valid_route():
    twin = state.active_twin
    dm = DisruptionManager(twin)
    dm.inject_disruption(Disruption(
        type=DisruptionType.ROAD_CLOSURE,
        target_id="2-11",
        severity=1.0,
        duration_hours=24.0
    ))

    prob = build_recovery_problem(twin)
    adapter = RecoverySolverAdapter(twin, swarm_size=25, iterations=35, seed=42)
    plan = adapter.solve_recovery(prob)

    shp1_res = next(sr for sr in plan.shipment_results if sr.shipment_id == "SHP-001")
    opt_route = shp1_res.optimized_route

    assert len(opt_route) >= 2
    assert opt_route[0] == 2  # Origin W1
    assert opt_route[-1] == 5  # Destination C1
    assert shp1_res.feasibility_status == "FEASIBLE"

    # Verify each edge in optimized_route exists and is not closed
    g = twin.graph.graph
    for u, v in zip(opt_route, opt_route[1:]):
        assert g.has_edge(u, v)
        assert g.edges[u, v].get("road_status") != "closed"


# ==========================================
# 6. Closed Edge is Not Used
# ==========================================
def test_closed_edge_is_not_used():
    twin = state.active_twin
    dm = DisruptionManager(twin)
    dm.inject_disruption(Disruption(
        type=DisruptionType.ROAD_CLOSURE,
        target_id="2-11",
        severity=1.0,
        duration_hours=24.0
    ))

    prob = build_recovery_problem(twin)
    adapter = RecoverySolverAdapter(twin, swarm_size=20, iterations=30, seed=42)
    plan = adapter.solve_recovery(prob)

    shp1_res = next(sr for sr in plan.shipment_results if sr.shipment_id == "SHP-001")
    route_edges = list(zip(shp1_res.optimized_route, shp1_res.optimized_route[1:]))

    assert (2, 11) not in route_edges
    assert (11, 2) not in route_edges


# ==========================================
# 7. Candidate Route Comparison (IQPSO vs Dijkstra)
# ==========================================
def test_candidate_route_comparison():
    twin = state.active_twin
    dm = DisruptionManager(twin)
    dm.inject_disruption(Disruption(
        type=DisruptionType.ROAD_CLOSURE,
        target_id="2-11",
        severity=1.0,
        duration_hours=24.0
    ))

    prob = build_recovery_problem(twin)
    adapter = RecoverySolverAdapter(twin, swarm_size=25, iterations=30, seed=42)
    plan = adapter.solve_recovery(prob)

    shp1_res = next(sr for sr in plan.shipment_results if sr.shipment_id == "SHP-001")

    # Dijkstra comparison metadata is present
    assert shp1_res.dijkstra_comparison is not None
    assert "travel_time" in shp1_res.dijkstra_comparison
    assert "fitness" in shp1_res.dijkstra_comparison
    assert "path" in shp1_res.dijkstra_comparison

    # IQPSO comparison metadata is present
    assert shp1_res.iqpso_comparison is not None
    assert "travel_time" in shp1_res.iqpso_comparison
    assert "fitness" in shp1_res.iqpso_comparison
    assert "execution_time" in shp1_res.iqpso_comparison


# ==========================================
# 8. Dijkstra Fallback Mechanism
# ==========================================
def test_dijkstra_fallback():
    twin = state.active_twin
    dm = DisruptionManager(twin)
    dm.inject_disruption(Disruption(
        type=DisruptionType.ROAD_CLOSURE,
        target_id="2-11",
        severity=1.0,
        duration_hours=24.0
    ))

    prob = build_recovery_problem(twin)
    # With 1 iteration and swarm_size 5, IQPSO might find sub-optimal or fallback
    adapter = RecoverySolverAdapter(twin, swarm_size=5, iterations=2, seed=999)
    plan = adapter.solve_recovery(prob)

    shp1_res = next(sr for sr in plan.shipment_results if sr.shipment_id == "SHP-001")
    assert shp1_res.solver_used in {"IQPSO", "DIJKSTRA_FALLBACK"}
    # The selected route must be strictly feasible regardless of solver
    assert shp1_res.feasibility_status == "FEASIBLE"
    assert shp1_res.optimized_metrics["is_feasible"] is True


# ==========================================
# 9. Infeasible Network Handling (Port Closure & Disconnected Node)
# ==========================================
def test_infeasible_network_handling():
    twin = state.active_twin
    dm = DisruptionManager(twin)
    # Port closure on P1 (Node 4) isolates maritime shipment SHP-005 ([4, 2])
    dm.inject_disruption(Disruption(
        type=DisruptionType.PORT_CLOSURE,
        target_id="P1",
        severity=1.0,
        duration_hours=24.0
    ))

    prob = build_recovery_problem(twin)
    adapter = RecoverySolverAdapter(twin, swarm_size=15, iterations=20, seed=42)
    plan = adapter.solve_recovery(prob)

    shp5_res = next((sr for sr in plan.shipment_results if sr.shipment_id == "SHP-005"), None)
    assert shp5_res is not None
    assert shp5_res.feasibility_status == "INFEASIBLE"
    assert len(shp5_res.optimized_route) == 0
    assert "unreachable" in shp5_res.explanation.lower() or "closed" in shp5_res.explanation.lower() or "cannot" in shp5_res.explanation.lower()
    assert plan.feasibility_status in {"PARTIALLY_INFEASIBLE", "INFEASIBLE"}


# ==========================================
# 10. Delivery Delay Calculation
# ==========================================
def test_delivery_delay_calculation():
    twin = state.active_twin
    # SHP-001 corresponds to ORD-001 with promised_delivery_time=14.0, simulation_time=12.0
    metrics_fast = evaluate_route_metrics(twin, [2, 11, 5], shipment_id="SHP-001")
    # Travel time for [2, 11, 5] is ~1.5h, so 12.0 + 1.5 = 13.5 <= 14.0 -> delay is 0.0
    assert metrics_fast["delivery_delay"] == 0.0

    # Test delivery delay when arrival exceeds SLA
    order = twin.get_order("ORD-001")
    original_sla = order.promised_delivery_time
    try:
        order.promised_delivery_time = 12.2  # Very tight SLA
        metrics_delayed = evaluate_route_metrics(twin, [2, 11, 5], shipment_id="SHP-001")
        assert metrics_delayed["delivery_delay"] > 0.0
    finally:
        order.promised_delivery_time = original_sla


# ==========================================
# 11. Transport Cost Calculation
# ==========================================
def test_transport_cost_calculation():
    twin = state.active_twin
    m = evaluate_route_metrics(twin, [2, 11, 5])
    assert m["transport_cost"] > 0.0

    dm = DisruptionManager(twin)
    dm.inject_disruption(Disruption(
        type=DisruptionType.ROAD_CLOSURE,
        target_id="2-11",
        severity=1.0,
        duration_hours=24.0
    ))
    prob = build_recovery_problem(twin)
    adapter = RecoverySolverAdapter(twin, swarm_size=20, iterations=25, seed=42)
    plan = adapter.solve_recovery(prob)

    shp1_res = next(sr for sr in plan.shipment_results if sr.shipment_id == "SHP-001")
    assert "transport_cost" in shp1_res.optimized_metrics
    assert "transport_cost_delta" in shp1_res.metric_delta


# ==========================================
# 12. Risk Calculation
# ==========================================
def test_risk_calculation():
    twin = state.active_twin
    m = evaluate_route_metrics(twin, [2, 11, 5])
    assert "risk" in m
    assert 0.0 <= m["risk"] <= 1.0

    # Infeasible route has maximum risk 1.0
    m_inf = evaluate_route_metrics(twin, [])
    assert m_inf["risk"] == 1.0


# ==========================================
# 13. Recovery Plan Structure
# ==========================================
def test_recovery_plan_structure():
    twin = state.active_twin
    dm = DisruptionManager(twin)
    dm.inject_disruption(Disruption(
        type=DisruptionType.ROAD_CLOSURE,
        target_id="2-11",
        severity=1.0,
        duration_hours=24.0
    ))

    planner = RecoveryPlanner(twin)
    plan = planner.optimize_recovery(swarm_size=20, iterations=20, seed=42)

    assert plan.plan_id.startswith("plan-")
    assert plan.problem_id.startswith("prob-")
    assert plan.solver == "IQPSO"
    assert isinstance(plan.solver_execution_time, float)
    assert isinstance(plan.shipment_results, list)
    assert isinstance(plan.actions, list)
    assert isinstance(plan.affected_shipments, list)
    assert isinstance(plan.baseline_metrics, dict)
    assert isinstance(plan.projected_metrics, dict)
    assert plan.feasibility_status in {"FEASIBLE", "PARTIALLY_INFEASIBLE"}
    assert len(plan.explanation) > 0


# ==========================================
# 14. Solver Execution Time Recorded
# ==========================================
def test_solver_execution_time_recorded():
    twin = state.active_twin
    dm = DisruptionManager(twin)
    dm.inject_disruption(Disruption(
        type=DisruptionType.ROAD_CLOSURE,
        target_id="2-11",
        severity=1.0,
        duration_hours=24.0
    ))

    adapter = RecoverySolverAdapter(twin, swarm_size=20, iterations=25, seed=42)
    plan = adapter.solve_recovery(build_recovery_problem(twin))

    assert plan.solver_execution_time > 0.0
    shp1_res = next(sr for sr in plan.shipment_results if sr.shipment_id == "SHP-001")
    if shp1_res.iqpso_comparison:
        assert shp1_res.iqpso_comparison["execution_time"] >= 0.0


# ==========================================
# 15. Scenario Remains Unchanged After Optimization
# ==========================================
def test_scenario_remains_unchanged_after_optimization():
    res_clone = client.post("/api/twin/scenario/clone", json={"scenario_name": "scen_test_immutable"})
    scen_id = res_clone.json()["scenario_id"]
    twin = state.scenarios[scen_id]

    dm = DisruptionManager(twin)
    dm.inject_disruption(Disruption(
        type=DisruptionType.ROAD_CLOSURE,
        target_id="2-11",
        severity=1.0,
        duration_hours=24.0
    ))

    # Capture scenario state before recovery
    shipments_before = {sid: list(s.route) for sid, s in twin.shipments.items()}
    orders_before = {oid: o.quantity for oid, o in twin.orders.items()}
    inventory_before = {k: inv.on_hand for k, inv in twin.inventory.items()}

    planner = RecoveryPlanner(twin)
    planner.optimize_recovery(scenario_id=scen_id, swarm_size=15, iterations=15, seed=42)

    # Verify scenario was not mutated
    assert {sid: list(s.route) for sid, s in twin.shipments.items()} == shipments_before
    assert {oid: o.quantity for oid, o in twin.orders.items()} == orders_before
    assert {k: inv.on_hand for k, inv in twin.inventory.items()} == inventory_before


# ==========================================
# 16. Baseline Remains Unchanged After Optimization
# ==========================================
def test_baseline_remains_unchanged_after_optimization():
    baseline_twin = state.active_twin
    baseline_routes = {sid: list(s.route) for sid, s in baseline_twin.shipments.items()}
    baseline_disruptions = len(baseline_twin.disruptions)

    res_clone = client.post("/api/twin/scenario/clone", json={"scenario_name": "scen_baseline_guard"})
    scen_id = res_clone.json()["scenario_id"]
    scenario_twin = state.scenarios[scen_id]

    dm = DisruptionManager(scenario_twin)
    dm.inject_disruption(Disruption(
        type=DisruptionType.ROAD_CLOSURE,
        target_id="2-11",
        severity=1.0,
        duration_hours=24.0
    ))

    planner = RecoveryPlanner(scenario_twin)
    planner.optimize_recovery(scenario_id=scen_id, swarm_size=15, iterations=15, seed=42)

    # Baseline remains 100% untouched
    assert {sid: list(s.route) for sid, s in baseline_twin.shipments.items()} == baseline_routes
    assert len(baseline_twin.disruptions) == baseline_disruptions


# ==========================================
# 17. Shipment Route is NOT Mutated (Analysis Only)
# ==========================================
def test_shipment_route_is_not_mutated():
    twin = state.active_twin
    dm = DisruptionManager(twin)
    dm.inject_disruption(Disruption(
        type=DisruptionType.ROAD_CLOSURE,
        target_id="2-11",
        severity=1.0,
        duration_hours=24.0
    ))

    shp1 = twin.get_shipment("SHP-001")
    assert shp1.route == [2, 11, 5]

    planner = RecoveryPlanner(twin)
    plan = planner.optimize_recovery(swarm_size=20, iterations=20, seed=42)

    # Result recommended a new route
    shp1_res = next(sr for sr in plan.shipment_results if sr.shipment_id == "SHP-001")
    assert shp1_res.route_changed is True
    assert shp1_res.optimized_route != [2, 11, 5]

    # BUT physical shipment route in twin state must NOT be mutated
    assert twin.get_shipment("SHP-001").route == [2, 11, 5]


# ==========================================
# 18. Existing Optimization Algorithm Integrity
# ==========================================
def test_existing_optimization_tests_still_pass():
    # Verify ImprovedQPSO optimizer executes directly without regression
    iqpso = ImprovedQPSO(swarm_size=20, iterations=25, dimensions=5, lower_bound=-5.0, upper_bound=5.0)
    best_pos, best_fit = iqpso.solve(lambda pos: float(np.sum(pos ** 2)))
    assert len(best_pos) == 5
    assert best_fit >= 0.0
    assert best_fit < 5.0  # Should easily converge near 0 on sphere


# ==========================================
# 19. Recovery API Returns Valid Response
# ==========================================
def test_recovery_api_returns_valid_response():
    res_clone = client.post("/api/twin/scenario/clone", json={"scenario_name": "scen_api_test"})
    assert res_clone.status_code == 200
    scen_id = res_clone.json()["scenario_id"]

    # Inject disruption on scenario via API
    res_disr = client.post(f"/api/twin/scenario/{scen_id}/disruptions", json={
        "type": "ROAD_CLOSURE",
        "target_id": "2-11",
        "severity": 1.0,
        "duration_hours": 24.0
    })
    assert res_disr.status_code == 200

    # Call recovery endpoint
    res_rec = client.post(f"/api/twin/scenario/{scen_id}/recover", json={
        "solver": "iqpso",
        "swarm_size": 20,
        "iterations": 25,
        "seed": 42
    })
    assert res_rec.status_code == 200
    data = res_rec.json()

    assert data["solver"] == "IQPSO"
    assert data["scenario_id"] == scen_id
    assert len(data["shipment_results"]) >= 1
    assert "projected_metrics" in data
    assert "baseline_metrics" in data
    assert "solver_execution_time" in data


# ==========================================
# 20. Invalid Scenario Returns 404
# ==========================================
def test_invalid_scenario_returns_404():
    res = client.post("/api/twin/scenario/nonexistent-scenario-id/recover", json={
        "solver": "iqpso",
        "swarm_size": 20,
        "iterations": 20
    })
    assert res.status_code == 404
    assert "not found" in res.json()["detail"].lower()


# ==========================================
# Additional Test: Warehouse Failure Scenario (W1)
# ==========================================
def test_warehouse_failure_scenario():
    twin = state.active_twin
    dm = DisruptionManager(twin)
    # Warehouse failure on W1
    dm.inject_disruption(Disruption(
        type=DisruptionType.WAREHOUSE_FAILURE,
        target_id="W1",
        severity=1.0,
        duration_hours=24.0
    ))

    prob = build_recovery_problem(twin)
    assert "W1" in prob.affected_warehouses
    adapter = RecoverySolverAdapter(twin, swarm_size=15, iterations=20, seed=42)
    plan = adapter.solve_recovery(prob)
    assert plan is not None
    assert plan.feasibility_status in {"FEASIBLE", "PARTIALLY_INFEASIBLE"}

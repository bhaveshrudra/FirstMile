import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.api import state
from backend.app.digital_twin.seed import create_pnt1_seed_twin
from backend.app.disruption.models import Disruption, DisruptionType
from backend.app.disruption.manager import DisruptionManager
from backend.app.models.warehouse import WarehouseStatus
from backend.app.models.order import Order, OrderStatus
from backend.app.models.inventory import InventoryItem

from backend.app.recovery import (
    RecoveryProblem,
    RecoveryPlan,
    RecoveryActionType,
    RecoveryPlanner,
    InventoryReallocationResult,
    InventoryReallocationEngine,
    build_recovery_problem,
)

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_seed_twin():
    """Reset to clean deterministic seed twin and empty scenarios."""
    state.active_twin = create_pnt1_seed_twin()
    state.scenarios.clear()
    state.snapshot_manager.clear()


# ==========================================
# 1. Allocator Imports
# ==========================================
def test_allocator_imports():
    assert InventoryReallocationEngine is not None
    assert InventoryReallocationResult is not None
    assert RecoveryPlan is not None
    assert RecoveryPlanner is not None


# ==========================================
# 2. Allocator Initialization
# ==========================================
def test_allocator_initialization():
    twin = state.active_twin
    custom_weights = {"TRAVEL_TIME": 1.5, "STOCKOUT_RISK": 3.0}
    engine = InventoryReallocationEngine(twin=twin, allow_partial=True, weights=custom_weights)

    assert engine.twin == twin
    assert engine.allow_partial is True
    assert engine.weights["TRAVEL_TIME"] == 1.5
    assert engine.weights["STOCKOUT_RISK"] == 3.0


# ==========================================
# 3. Affected Order Detection
# ==========================================
def test_affected_order_detection():
    twin = state.active_twin
    dm = DisruptionManager(twin)
    # Inject warehouse failure on W1
    dm.inject_disruption(Disruption(
        type=DisruptionType.WAREHOUSE_FAILURE,
        target_id="W1",
        severity=1.0,
        duration_hours=24.0
    ))

    prob = build_recovery_problem(twin)
    engine = InventoryReallocationEngine(twin)
    affected = engine.detect_affected_orders(problem=prob)

    assert len(affected) > 0
    aff_ids = [o.id for o in affected]
    # In PNT1 seed: ORD-001, ORD-002, ORD-003, ORD-004, ORD-008, ORD-009 are sourced from W1
    assert "ORD-001" in aff_ids
    assert "ORD-002" in aff_ids

    # Delivered order ORD-006 (from W2) must NOT be in affected orders
    assert "ORD-006" not in aff_ids


# ==========================================
# 4. Inventory Availability Calculation
# ==========================================
def test_inventory_availability_calculation():
    twin = state.active_twin
    item_w2 = twin.get_inventory("W2", "SKU-MED-CHIP")
    assert item_w2 is not None

    # Available stock must be strictly on_hand - reserved
    expected_avail = max(0.0, item_w2.on_hand - item_w2.reserved)
    assert item_w2.available == expected_avail
    assert item_w2.reserved > 0.0  # In seed, reserved is 100.0


# ==========================================
# 5. Alternate Warehouse Discovery
# ==========================================
def test_alternate_warehouse_discovery():
    twin = state.active_twin
    dm = DisruptionManager(twin)
    dm.inject_disruption(Disruption(
        type=DisruptionType.WAREHOUSE_FAILURE,
        target_id="W1",
        severity=1.0,
        duration_hours=24.0
    ))

    engine = InventoryReallocationEngine(twin)
    order1 = twin.get_order("ORD-001")
    v_stock = {(i.warehouse_id, i.sku): i.available for i in twin.list_inventory()}
    v_cap = {w.id: w.available_storage for w in twin.list_warehouses()}

    candidates = engine.find_candidate_warehouses(order1, v_stock, v_cap)
    assert len(candidates) >= 1

    cand_w2 = next((c for c in candidates if c["warehouse_id"] == "W2"), None)
    assert cand_w2 is not None
    assert cand_w2["allocated_quantity"] == order1.quantity
    assert cand_w2["cand_status"] == "FEASIBLE"
    assert len(cand_w2["path"]) >= 2


# ==========================================
# 6. Offline Warehouse Rejection
# ==========================================
def test_offline_warehouse_rejection():
    twin = state.active_twin
    # Mark both W1 and W2 as OFFLINE
    w1 = twin.get_warehouse("W1")
    w2 = twin.get_warehouse("W2")
    w1.status = WarehouseStatus.OFFLINE
    w2.status = WarehouseStatus.OFFLINE

    engine = InventoryReallocationEngine(twin)
    order1 = twin.get_order("ORD-001")
    v_stock = {(i.warehouse_id, i.sku): i.available for i in twin.list_inventory()}
    v_cap = {w.id: w.available_storage for w in twin.list_warehouses()}

    candidates = engine.find_candidate_warehouses(order1, v_stock, v_cap)
    assert len(candidates) == 0


# ==========================================
# 7. Insufficient Inventory Handling
# ==========================================
def test_insufficient_inventory_handling():
    twin = state.active_twin
    w1 = twin.get_warehouse("W1")
    w1.status = WarehouseStatus.OFFLINE

    # Order requiring massive quantity that exceeds available stock in W2
    huge_order = Order(
        id="ORD-HUGE",
        customer_id="C1",
        sku="SKU-MED-CHIP",
        quantity=5000.0,
        priority=3,
        order_time=12.0,
        promised_delivery_time=18.0,
        status=OrderStatus.PENDING,
        source_warehouse_id="W1"
    )

    # A. With allow_partial = False -> Candidate rejected (INFEASIBLE)
    engine_strict = InventoryReallocationEngine(twin, allow_partial=False)
    v_stock = {(i.warehouse_id, i.sku): i.available for i in twin.list_inventory()}
    v_cap = {w.id: w.available_storage for w in twin.list_warehouses()}
    candidates_strict = engine_strict.find_candidate_warehouses(huge_order, v_stock, v_cap)
    assert len(candidates_strict) == 0

    # B. With allow_partial = True -> Candidate proposed with partial quantity
    engine_partial = InventoryReallocationEngine(twin, allow_partial=True)
    candidates_partial = engine_partial.find_candidate_warehouses(huge_order, v_stock, v_cap)
    assert len(candidates_partial) >= 1
    assert candidates_partial[0]["cand_status"] == "PARTIALLY_FEASIBLE"
    assert candidates_partial[0]["allocated_quantity"] < 5000.0


# ==========================================
# 8. Warehouse Capacity Validation
# ==========================================
def test_warehouse_capacity_validation():
    twin = state.active_twin
    order1 = twin.get_order("ORD-001")
    v_stock = {(i.warehouse_id, i.sku): i.available for i in twin.list_inventory()}
    # Set virtual storage capacity of W2 to 0
    v_cap = {"W1": 0.0, "W2": 0.0}

    engine = InventoryReallocationEngine(twin)
    candidates = engine.find_candidate_warehouses(order1, v_stock, v_cap)
    assert len(candidates) == 0


# ==========================================
# 9. Route Feasibility Validation
# ==========================================
def test_route_feasibility_validation():
    twin = state.active_twin
    dm = DisruptionManager(twin)
    dm.inject_disruption(Disruption(
        type=DisruptionType.WAREHOUSE_FAILURE,
        target_id="W1",
        severity=1.0,
        duration_hours=24.0
    ))

    # Close customer C1 node (node 5)
    twin.graph.graph.nodes[5]["status"] = "CLOSED"

    engine = InventoryReallocationEngine(twin)
    order1 = twin.get_order("ORD-001")  # Targets C1 (Node 5)
    v_stock = {(i.warehouse_id, i.sku): i.available for i in twin.list_inventory()}
    v_cap = {w.id: w.available_storage for w in twin.list_warehouses()}

    candidates = engine.find_candidate_warehouses(order1, v_stock, v_cap)
    # Candidate route to closed node 5 must be rejected
    assert len(candidates) == 0


# ==========================================
# 10. Transport Cost Calculation
# ==========================================
def test_transport_cost_calculation():
    twin = state.active_twin
    dm = DisruptionManager(twin)
    dm.inject_disruption(Disruption(
        type=DisruptionType.WAREHOUSE_FAILURE,
        target_id="W1",
        severity=1.0,
        duration_hours=24.0
    ))

    planner = RecoveryPlanner(twin)
    plan = planner.reallocate_inventory()

    res_001 = next(r for r in plan.inventory_reallocation_results if r.order_id == "ORD-001")
    assert res_001.optimized_metrics["transport_cost"] > 0.0
    assert "transport_cost_delta" in res_001.metric_delta


# ==========================================
# 11. Risk Calculation
# ==========================================
def test_risk_calculation():
    twin = state.active_twin
    dm = DisruptionManager(twin)
    dm.inject_disruption(Disruption(
        type=DisruptionType.WAREHOUSE_FAILURE,
        target_id="W1",
        severity=1.0,
        duration_hours=24.0
    ))

    planner = RecoveryPlanner(twin)
    plan = planner.reallocate_inventory()

    res_001 = next(r for r in plan.inventory_reallocation_results if r.order_id == "ORD-001")
    assert 0.0 <= res_001.optimized_metrics["risk"] <= 1.0


# ==========================================
# 12. Delivery Delay Calculation
# ==========================================
def test_delivery_delay_calculation():
    twin = state.active_twin
    order1 = twin.get_order("ORD-001")

    # With generous SLA (promised_delivery_time=18.0, current_simulation_time=12.0)
    orig_sla = order1.promised_delivery_time
    order1.promised_delivery_time = 20.0

    engine = InventoryReallocationEngine(twin)
    m = engine.compute_allocation_score(
        metrics={"is_feasible": True, "travel_time": 1.5, "transport_cost": 40.0, "risk": 0.1, "delivery_delay": 0.0},
        allocated_qty=50.0,
        requested_qty=50.0
    )
    assert m > 0.0

    # With tight SLA causing delay
    m_delayed = engine.compute_allocation_score(
        metrics={"is_feasible": True, "travel_time": 3.0, "transport_cost": 40.0, "risk": 0.1, "delivery_delay": 2.5},
        allocated_qty=50.0,
        requested_qty=50.0
    )
    assert m_delayed > m  # Higher delay results in higher penalty score
    order1.promised_delivery_time = orig_sla


# ==========================================
# 13. Stockout Before Calculation
# ==========================================
def test_stockout_before_calculation():
    twin = state.active_twin
    dm = DisruptionManager(twin)
    dm.inject_disruption(Disruption(
        type=DisruptionType.WAREHOUSE_FAILURE,
        target_id="W1",
        severity=1.0,
        duration_hours=24.0
    ))

    planner = RecoveryPlanner(twin)
    plan = planner.reallocate_inventory()

    res_001 = next(r for r in plan.inventory_reallocation_results if r.order_id == "ORD-001")
    # For disrupted W1, stockout before reallocation equals order requested quantity
    assert res_001.stockout_before == 50.0


# ==========================================
# 14. Stockout After Calculation
# ==========================================
def test_stockout_after_calculation():
    twin = state.active_twin
    dm = DisruptionManager(twin)
    dm.inject_disruption(Disruption(
        type=DisruptionType.WAREHOUSE_FAILURE,
        target_id="W1",
        severity=1.0,
        duration_hours=24.0
    ))

    planner = RecoveryPlanner(twin)
    plan = planner.reallocate_inventory()

    res_001 = next(r for r in plan.inventory_reallocation_results if r.order_id == "ORD-001")
    # When fully reallocated, stockout after is 0.0
    assert res_001.stockout_after == 0.0
    assert res_001.remaining_quantity == 0.0


# ==========================================
# 15. Full Allocation
# ==========================================
def test_full_allocation():
    twin = state.active_twin
    dm = DisruptionManager(twin)
    dm.inject_disruption(Disruption(
        type=DisruptionType.WAREHOUSE_FAILURE,
        target_id="W1",
        severity=1.0,
        duration_hours=24.0
    ))

    planner = RecoveryPlanner(twin)
    plan = planner.reallocate_inventory()

    res_001 = next(r for r in plan.inventory_reallocation_results if r.order_id == "ORD-001")
    assert res_001.feasibility_status == "FEASIBLE"
    assert res_001.allocated_quantity == 50.0
    assert res_001.remaining_quantity == 0.0
    assert res_001.proposed_warehouse_id == "W2"
    assert res_001.allocation_changed is True


# ==========================================
# 16. Partial Allocation
# ==========================================
def test_partial_allocation():
    twin = state.active_twin
    # Artificially set W2 available stock for SKU-MED-CHIP to only 20 units
    item_w2 = twin.get_inventory("W2", "SKU-MED-CHIP")
    orig_on_hand = item_w2.on_hand
    orig_reserved = item_w2.reserved
    item_w2.on_hand = 20.0
    item_w2.reserved = 0.0

    w1 = twin.get_warehouse("W1")
    w1.status = WarehouseStatus.OFFLINE

    # Prioritize ORD-001 so it receives first allocation from limited stock
    ord1 = twin.get_order("ORD-001")
    orig_prio1 = ord1.priority
    ord1.priority = 5
    ord5 = twin.get_order("ORD-005")
    orig_prio5 = ord5.priority
    ord5.priority = 1

    try:
        planner = RecoveryPlanner(twin)
        plan = planner.reallocate_inventory(allow_partial=True)

        res_001 = next(r for r in plan.inventory_reallocation_results if r.order_id == "ORD-001")
        assert res_001.feasibility_status == "PARTIALLY_FEASIBLE"
        assert res_001.allocated_quantity == 20.0
        assert res_001.remaining_quantity == 30.0  # 50 - 20 = 30
        assert res_001.stockout_after == 30.0
    finally:
        item_w2.on_hand = orig_on_hand
        item_w2.reserved = orig_reserved
        ord1.priority = orig_prio1
        ord5.priority = orig_prio5


# ==========================================
# 17. Infeasible Allocation
# ==========================================
def test_infeasible_allocation():
    twin = state.active_twin
    # Both warehouses offline
    twin.get_warehouse("W1").status = WarehouseStatus.OFFLINE
    twin.get_warehouse("W2").status = WarehouseStatus.OFFLINE

    planner = RecoveryPlanner(twin)
    plan = planner.reallocate_inventory()

    assert plan.feasibility_status == "INFEASIBLE"
    assert plan.orders_infeasible > 0
    for r in plan.inventory_reallocation_results:
        assert r.feasibility_status == "INFEASIBLE"
        assert r.allocated_quantity == 0.0
        assert r.remaining_quantity == r.requested_quantity
        assert r.proposed_warehouse_id is None


# ==========================================
# 18. Result Structure
# ==========================================
def test_result_structure():
    twin = state.active_twin
    dm = DisruptionManager(twin)
    dm.inject_disruption(Disruption(
        type=DisruptionType.WAREHOUSE_FAILURE,
        target_id="W1",
        severity=1.0,
        duration_hours=24.0
    ))

    planner = RecoveryPlanner(twin)
    plan = planner.reallocate_inventory()

    assert plan.plan_id.startswith("plan-")
    assert plan.solver == "DETERMINISTIC_INVENTORY_ALLOCATOR"
    assert plan.solver_execution_time >= 0.0
    assert len(plan.inventory_reallocation_results) > 0
    assert plan.orders_fully_reallocated > 0
    assert plan.total_requested_quantity > 0.0
    assert plan.total_allocated_quantity > 0.0
    assert "orders_fully_reallocated" in plan.projected_metrics

    # Check recovery action generated
    assert len(plan.actions) > 0
    act = plan.actions[0]
    assert act.action_type in {RecoveryActionType.REALLOCATE_INVENTORY, RecoveryActionType.DEFER_ORDER}


# ==========================================
# 19. Scenario Remains Unchanged
# ==========================================
def test_scenario_remains_unchanged():
    res_clone = client.post("/api/twin/scenario/clone", json={"scenario_name": "scen_alloc_freeze"})
    scen_id = res_clone.json()["scenario_id"]
    scenario_twin = state.scenarios[scen_id]

    dm = DisruptionManager(scenario_twin)
    dm.inject_disruption(Disruption(
        type=DisruptionType.WAREHOUSE_FAILURE,
        target_id="W1",
        severity=1.0,
        duration_hours=24.0
    ))

    inv_before = {k: (i.on_hand, i.reserved) for k, i in scenario_twin.inventory.items()}
    orders_before = {k: o.source_warehouse_id for k, o in scenario_twin.orders.items()}
    wh_before = {k: w.status for k, w in scenario_twin.warehouses.items()}

    planner = RecoveryPlanner(scenario_twin)
    planner.reallocate_inventory(scenario_id=scen_id)

    # Verify scenario was not mutated
    assert {k: (i.on_hand, i.reserved) for k, i in scenario_twin.inventory.items()} == inv_before
    assert {k: o.source_warehouse_id for k, o in scenario_twin.orders.items()} == orders_before
    assert {k: w.status for k, w in scenario_twin.warehouses.items()} == wh_before


# ==========================================
# 20. Baseline Remains Unchanged
# ==========================================
def test_baseline_remains_unchanged():
    baseline_twin = state.active_twin
    b_inv = {k: (i.on_hand, i.reserved) for k, i in baseline_twin.inventory.items()}
    b_orders = {k: o.source_warehouse_id for k, o in baseline_twin.orders.items()}
    b_disruptions = len(baseline_twin.disruptions)

    res_clone = client.post("/api/twin/scenario/clone", json={"scenario_name": "scen_guard_b"})
    scen_id = res_clone.json()["scenario_id"]
    scenario_twin = state.scenarios[scen_id]

    dm = DisruptionManager(scenario_twin)
    dm.inject_disruption(Disruption(
        type=DisruptionType.WAREHOUSE_FAILURE,
        target_id="W1",
        severity=1.0,
        duration_hours=24.0
    ))

    planner = RecoveryPlanner(scenario_twin)
    planner.reallocate_inventory(scenario_id=scen_id)

    # Baseline is 100% untouched
    assert {k: (i.on_hand, i.reserved) for k, i in baseline_twin.inventory.items()} == b_inv
    assert {k: o.source_warehouse_id for k, o in baseline_twin.orders.items()} == b_orders
    assert len(baseline_twin.disruptions) == b_disruptions


# ==========================================
# 21. Inventory Remains Unchanged
# ==========================================
def test_inventory_remains_unchanged():
    twin = state.active_twin
    dm = DisruptionManager(twin)
    dm.inject_disruption(Disruption(
        type=DisruptionType.WAREHOUSE_FAILURE,
        target_id="W1",
        severity=1.0,
        duration_hours=24.0
    ))

    w2_med_before = (twin.get_inventory("W2", "SKU-MED-CHIP").on_hand, twin.get_inventory("W2", "SKU-MED-CHIP").reserved)

    planner = RecoveryPlanner(twin)
    planner.reallocate_inventory()

    w2_med_after = (twin.get_inventory("W2", "SKU-MED-CHIP").on_hand, twin.get_inventory("W2", "SKU-MED-CHIP").reserved)
    assert w2_med_before == w2_med_after


# ==========================================
# 22. Order Remains Unchanged (Analysis Only)
# ==========================================
def test_order_remains_unchanged():
    twin = state.active_twin
    dm = DisruptionManager(twin)
    dm.inject_disruption(Disruption(
        type=DisruptionType.WAREHOUSE_FAILURE,
        target_id="W1",
        severity=1.0,
        duration_hours=24.0
    ))

    assert twin.get_order("ORD-001").source_warehouse_id == "W1"

    planner = RecoveryPlanner(twin)
    plan = planner.reallocate_inventory()

    # Plan recommends W2
    res_001 = next(r for r in plan.inventory_reallocation_results if r.order_id == "ORD-001")
    assert res_001.proposed_warehouse_id == "W2"

    # BUT physical order in twin state is STILL W1
    assert twin.get_order("ORD-001").source_warehouse_id == "W1"


# ==========================================
# 23. API Returns Valid Response
# ==========================================
def test_api_returns_valid_response():
    res_clone = client.post("/api/twin/scenario/clone", json={"scenario_name": "scen_api_realloc"})
    assert res_clone.status_code == 200
    scen_id = res_clone.json()["scenario_id"]

    # Inject WAREHOUSE_FAILURE on W1 via API
    res_disr = client.post(f"/api/twin/scenario/{scen_id}/disruptions", json={
        "type": "WAREHOUSE_FAILURE",
        "target_id": "W1",
        "severity": 1.0,
        "duration_hours": 24.0
    })
    assert res_disr.status_code == 200

    # Call reallocate endpoint
    res_alloc = client.post(f"/api/twin/scenario/{scen_id}/reallocate", json={
        "allow_partial": True
    })
    assert res_alloc.status_code == 200
    data = res_alloc.json()

    assert data["solver"] == "DETERMINISTIC_INVENTORY_ALLOCATOR"
    assert data["scenario_id"] == scen_id
    assert len(data["inventory_reallocation_results"]) > 0
    assert data["orders_fully_reallocated"] > 0
    assert "projected_metrics" in data
    assert "total_allocated_quantity" in data


# ==========================================
# 24. Invalid Scenario Returns 404
# ==========================================
def test_invalid_scenario_returns_404():
    res = client.post("/api/twin/scenario/nonexistent-scenario-id/reallocate", json={
        "allow_partial": True
    })
    assert res.status_code == 404
    assert "not found" in res.json()["detail"].lower()

import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.api import state
from backend.app.digital_twin.seed import create_pnt1_seed_twin
from backend.app.disruption.models import Disruption, DisruptionType
from backend.app.disruption.manager import DisruptionManager
from backend.app.models.warehouse import WarehouseStatus
from backend.app.models.order import Order, OrderStatus
from backend.app.models.shipment import Shipment, ShipmentStatus

from backend.app.recovery import (
    RecoveryProblem,
    RecoveryPlan,
    RecoveryPlanner,
    RecoveryCommitEngine,
    RecoveryCommitResult,
    RecoveryRollbackResult,
    ShipmentCommitRecord,
    InventoryCommitRecord,
    OrderCommitRecord,
)

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_seed_twin():
    """Reset to clean deterministic seed twin, empty scenarios and plan registries."""
    state.active_twin = create_pnt1_seed_twin()
    state.scenarios.clear()
    state.snapshot_manager.clear()
    state.recovery_plans.clear()
    state.recovery_commits.clear()


# ==========================================
# 1. Commit Engine Imports
# ==========================================
def test_commit_engine_imports():
    assert RecoveryCommitEngine is not None
    assert RecoveryCommitResult is not None
    assert RecoveryRollbackResult is not None
    assert ShipmentCommitRecord is not None
    assert InventoryCommitRecord is not None
    assert OrderCommitRecord is not None


# ==========================================
# 2. Commit Engine Initialization
# ==========================================
def test_commit_engine_initialization():
    twin = state.active_twin
    engine = RecoveryCommitEngine(twin, state.snapshot_manager)
    assert engine.twin == twin
    assert engine.snapshot_manager == state.snapshot_manager


# ==========================================
# 3. Plan Registry
# ==========================================
def test_plan_registry():
    res_clone = client.post("/api/twin/scenario/clone", json={"scenario_name": "scen_reg_test"})
    scen_id = res_clone.json()["scenario_id"]

    # Inject disruption and call recover
    client.post(f"/api/twin/scenario/{scen_id}/disruptions", json={
        "type": "ROAD_CLOSURE",
        "target_id": "2-11",
        "severity": 1.0,
        "duration_hours": 24.0
    })

    res_rec = client.post(f"/api/twin/scenario/{scen_id}/recover", json={"swarm_size": 15, "iterations": 15})
    assert res_rec.status_code == 200
    plan_id = res_rec.json()["plan_id"]

    assert plan_id in state.recovery_plans
    assert state.recovery_plans[plan_id].plan_id == plan_id


# ==========================================
# 4. Valid Commit Request
# ==========================================
def test_valid_commit_request():
    res_clone = client.post("/api/twin/scenario/clone", json={"scenario_name": "scen_valid_commit"})
    scen_id = res_clone.json()["scenario_id"]

    client.post(f"/api/twin/scenario/{scen_id}/disruptions", json={
        "type": "ROAD_CLOSURE",
        "target_id": "2-11",
        "severity": 1.0,
        "duration_hours": 24.0
    })

    res_rec = client.post(f"/api/twin/scenario/{scen_id}/recover", json={"swarm_size": 15, "iterations": 15})
    plan_id = res_rec.json()["plan_id"]

    res_commit = client.post(f"/api/twin/scenario/{scen_id}/commit", json={
        "plan_id": plan_id,
        "approval": True
    })
    assert res_commit.status_code == 200
    commit_data = res_commit.json()
    assert commit_data["success"] is True
    assert commit_data["status"] == "COMMITTED"
    assert len(commit_data["snapshot_id"]) > 0


# ==========================================
# 5. Missing Scenario 404
# ==========================================
def test_missing_scenario_404():
    res = client.post("/api/twin/scenario/nonexistent-scen/commit", json={
        "plan_id": "plan-123",
        "approval": True
    })
    assert res.status_code == 404


# ==========================================
# 6. Missing Plan 404
# ==========================================
def test_missing_plan_404():
    res_clone = client.post("/api/twin/scenario/clone", json={"scenario_name": "scen_missing_plan"})
    scen_id = res_clone.json()["scenario_id"]

    res = client.post(f"/api/twin/scenario/{scen_id}/commit", json={
        "plan_id": "plan-nonexistent-999",
        "approval": True
    })
    assert res.status_code == 404


# ==========================================
# 7. Wrong Scenario Plan Rejection
# ==========================================
def test_wrong_scenario_plan_rejection():
    # Scenario A
    res_a = client.post("/api/twin/scenario/clone", json={"scenario_name": "scen_A"})
    scen_a = res_a.json()["scenario_id"]
    # Scenario B
    res_b = client.post("/api/twin/scenario/clone", json={"scenario_name": "scen_B"})
    scen_b = res_b.json()["scenario_id"]

    # Generate plan for scenario A
    client.post(f"/api/twin/scenario/{scen_a}/disruptions", json={
        "type": "ROAD_CLOSURE",
        "target_id": "2-11",
        "severity": 1.0,
        "duration_hours": 24.0
    })
    res_rec = client.post(f"/api/twin/scenario/{scen_a}/recover", json={"swarm_size": 15, "iterations": 15})
    plan_id_a = res_rec.json()["plan_id"]

    # Try to commit Plan A to Scenario B
    res_wrong = client.post(f"/api/twin/scenario/{scen_b}/commit", json={
        "plan_id": plan_id_a,
        "approval": True
    })
    assert res_wrong.status_code == 400


# ==========================================
# 8. Explicit Approval Validation
# ==========================================
def test_explicit_approval_validation():
    res_clone = client.post("/api/twin/scenario/clone", json={"scenario_name": "scen_approval_guard"})
    scen_id = res_clone.json()["scenario_id"]

    client.post(f"/api/twin/scenario/{scen_id}/disruptions", json={
        "type": "ROAD_CLOSURE",
        "target_id": "2-11",
        "severity": 1.0,
        "duration_hours": 24.0
    })
    res_rec = client.post(f"/api/twin/scenario/{scen_id}/recover", json={"swarm_size": 15, "iterations": 15})
    plan_id = res_rec.json()["plan_id"]

    res_no_app = client.post(f"/api/twin/scenario/{scen_id}/commit", json={
        "plan_id": plan_id,
        "approval": False
    })
    assert res_no_app.status_code == 422


# ==========================================
# 9. Pre-Commit Snapshot Created
# ==========================================
def test_pre_commit_snapshot_created():
    res_clone = client.post("/api/twin/scenario/clone", json={"scenario_name": "scen_snap_check"})
    scen_id = res_clone.json()["scenario_id"]

    client.post(f"/api/twin/scenario/{scen_id}/disruptions", json={
        "type": "ROAD_CLOSURE",
        "target_id": "2-11",
        "severity": 1.0,
        "duration_hours": 24.0
    })
    res_rec = client.post(f"/api/twin/scenario/{scen_id}/recover", json={"swarm_size": 15, "iterations": 15})
    plan_id = res_rec.json()["plan_id"]

    res_commit = client.post(f"/api/twin/scenario/{scen_id}/commit", json={
        "plan_id": plan_id,
        "approval": True
    })
    snap_id = res_commit.json()["snapshot_id"]
    assert snap_id is not None
    assert state.snapshot_manager.get_snapshot(snap_id) is not None


# ==========================================
# 10. Shipment Rerouting Mutation
# ==========================================
def test_shipment_rerouting_mutation():
    res_clone = client.post("/api/twin/scenario/clone", json={"scenario_name": "scen_reroute_mut"})
    scen_id = res_clone.json()["scenario_id"]
    scenario_twin = state.scenarios[scen_id]

    client.post(f"/api/twin/scenario/{scen_id}/disruptions", json={
        "type": "ROAD_CLOSURE",
        "target_id": "2-11",
        "severity": 1.0,
        "duration_hours": 24.0
    })

    # SHP-001 has route [2, 11, 5] before commit
    assert scenario_twin.get_shipment("SHP-001").route == [2, 11, 5]

    res_rec = client.post(f"/api/twin/scenario/{scen_id}/recover", json={"swarm_size": 15, "iterations": 15})
    plan_id = res_rec.json()["plan_id"]

    client.post(f"/api/twin/scenario/{scen_id}/commit", json={"plan_id": plan_id, "approval": True})

    # After commit, SHP-001 route is mutated to bypass closed corridor
    committed_shp = scenario_twin.get_shipment("SHP-001")
    assert committed_shp.route != [2, 11, 5]
    assert (2, 11) not in list(zip(committed_shp.route, committed_shp.route[1:]))
    assert committed_shp.status == ShipmentStatus.REROUTED


# ==========================================
# 11. Inventory Mutation
# ==========================================
def test_inventory_mutation():
    res_clone = client.post("/api/twin/scenario/clone", json={"scenario_name": "scen_inv_mut"})
    scen_id = res_clone.json()["scenario_id"]
    scenario_twin = state.scenarios[scen_id]

    client.post(f"/api/twin/scenario/{scen_id}/disruptions", json={
        "type": "WAREHOUSE_FAILURE",
        "target_id": "W1",
        "severity": 1.0,
        "duration_hours": 24.0
    })

    avail_before = scenario_twin.get_inventory("W2", "SKU-MED-CHIP").available
    res_alloc = client.post(f"/api/twin/scenario/{scen_id}/reallocate", json={"allow_partial": True})
    plan_id = res_alloc.json()["plan_id"]

    client.post(f"/api/twin/scenario/{scen_id}/commit", json={"plan_id": plan_id, "approval": True})

    avail_after = scenario_twin.get_inventory("W2", "SKU-MED-CHIP").available
    # W2 reserved stock should have increased, decreasing available stock
    assert avail_after < avail_before


# ==========================================
# 12. Order Reassignment
# ==========================================
def test_order_reassignment():
    res_clone = client.post("/api/twin/scenario/clone", json={"scenario_name": "scen_ord_reassign"})
    scen_id = res_clone.json()["scenario_id"]
    scenario_twin = state.scenarios[scen_id]

    client.post(f"/api/twin/scenario/{scen_id}/disruptions", json={
        "type": "WAREHOUSE_FAILURE",
        "target_id": "W1",
        "severity": 1.0,
        "duration_hours": 24.0
    })

    res_alloc = client.post(f"/api/twin/scenario/{scen_id}/reallocate", json={"allow_partial": True})
    plan_id = res_alloc.json()["plan_id"]

    client.post(f"/api/twin/scenario/{scen_id}/commit", json={"plan_id": plan_id, "approval": True})

    order1 = scenario_twin.get_order("ORD-001")
    assert order1.source_warehouse_id == "W2"
    assert order1.status == OrderStatus.ALLOCATED


# ==========================================
# 13. Shipment Creation
# ==========================================
def test_shipment_creation():
    res_clone = client.post("/api/twin/scenario/clone", json={"scenario_name": "scen_shp_create"})
    scen_id = res_clone.json()["scenario_id"]
    scenario_twin = state.scenarios[scen_id]

    client.post(f"/api/twin/scenario/{scen_id}/disruptions", json={
        "type": "WAREHOUSE_FAILURE",
        "target_id": "W1",
        "severity": 1.0,
        "duration_hours": 24.0
    })

    shipments_count_before = len(scenario_twin.shipments)
    res_alloc = client.post(f"/api/twin/scenario/{scen_id}/reallocate", json={"allow_partial": True})
    plan_id = res_alloc.json()["plan_id"]

    res_commit = client.post(f"/api/twin/scenario/{scen_id}/commit", json={"plan_id": plan_id, "approval": True})
    data = res_commit.json()

    assert len(data["created_shipments"]) > 0
    assert len(scenario_twin.shipments) > shipments_count_before


# ==========================================
# 14. Vehicle Assignment Validation
# ==========================================
def test_vehicle_assignment_validation():
    res_clone = client.post("/api/twin/scenario/clone", json={"scenario_name": "scen_veh_check"})
    scen_id = res_clone.json()["scenario_id"]
    scenario_twin = state.scenarios[scen_id]

    client.post(f"/api/twin/scenario/{scen_id}/disruptions", json={
        "type": "WAREHOUSE_FAILURE",
        "target_id": "W1",
        "severity": 1.0,
        "duration_hours": 24.0
    })

    res_alloc = client.post(f"/api/twin/scenario/{scen_id}/reallocate", json={"allow_partial": True})
    plan_id = res_alloc.json()["plan_id"]
    res_commit = client.post(f"/api/twin/scenario/{scen_id}/commit", json={"plan_id": plan_id, "approval": True})

    created_ids = res_commit.json()["created_shipments"]
    for sid in created_ids:
        shp = scenario_twin.get_shipment(sid)
        assert shp is not None
        assert shp.vehicle_id is not None
        veh = scenario_twin.get_vehicle(shp.vehicle_id)
        assert veh is not None
        assert veh.capacity >= shp.quantity


# ==========================================
# 15. Post-Commit Validation
# ==========================================
def test_post_commit_validation():
    res_clone = client.post("/api/twin/scenario/clone", json={"scenario_name": "scen_post_valid"})
    scen_id = res_clone.json()["scenario_id"]
    scenario_twin = state.scenarios[scen_id]

    client.post(f"/api/twin/scenario/{scen_id}/disruptions", json={
        "type": "ROAD_CLOSURE",
        "target_id": "2-11",
        "severity": 1.0,
        "duration_hours": 24.0
    })

    res_rec = client.post(f"/api/twin/scenario/{scen_id}/recover", json={"swarm_size": 15, "iterations": 15})
    plan_id = res_rec.json()["plan_id"]
    client.post(f"/api/twin/scenario/{scen_id}/commit", json={"plan_id": plan_id, "approval": True})

    # Validate inventory invariants
    for inv in scenario_twin.inventory.values():
        assert inv.on_hand >= 0.0
        assert inv.reserved >= 0.0
        assert inv.reserved <= inv.on_hand

    # Validate no committed route uses closed road
    for shp in scenario_twin.shipments.values():
        for u, v in zip(shp.route, shp.route[1:]):
            assert (u, v) != (2, 11)


# ==========================================
# 16. Commit Result Structure
# ==========================================
def test_commit_result_structure():
    res_clone = client.post("/api/twin/scenario/clone", json={"scenario_name": "scen_res_struct"})
    scen_id = res_clone.json()["scenario_id"]

    client.post(f"/api/twin/scenario/{scen_id}/disruptions", json={
        "type": "ROAD_CLOSURE",
        "target_id": "2-11",
        "severity": 1.0,
        "duration_hours": 24.0
    })
    res_rec = client.post(f"/api/twin/scenario/{scen_id}/recover", json={"swarm_size": 15, "iterations": 15})
    plan_id = res_rec.json()["plan_id"]

    res_commit = client.post(f"/api/twin/scenario/{scen_id}/commit", json={"plan_id": plan_id, "approval": True})
    data = res_commit.json()

    assert data["commit_id"].startswith("commit-")
    assert data["plan_id"] == plan_id
    assert data["scenario_id"] == scen_id
    assert data["success"] is True
    assert data["status"] == "COMMITTED"
    assert "shipment_changes" in data
    assert "inventory_changes" in data
    assert "order_changes" in data
    assert "created_shipments" in data
    assert data["rollback_available"] is True
    assert len(data["explanation"]) > 0


# ==========================================
# 17. Double-Commit Protection (Idempotency)
# ==========================================
def test_double_commit_protection():
    res_clone = client.post("/api/twin/scenario/clone", json={"scenario_name": "scen_double_guard"})
    scen_id = res_clone.json()["scenario_id"]

    client.post(f"/api/twin/scenario/{scen_id}/disruptions", json={
        "type": "ROAD_CLOSURE",
        "target_id": "2-11",
        "severity": 1.0,
        "duration_hours": 24.0
    })
    res_rec = client.post(f"/api/twin/scenario/{scen_id}/recover", json={"swarm_size": 15, "iterations": 15})
    plan_id = res_rec.json()["plan_id"]

    # First commit -> 200 OK
    res1 = client.post(f"/api/twin/scenario/{scen_id}/commit", json={"plan_id": plan_id, "approval": True})
    assert res1.status_code == 200

    # Second commit -> 409 Conflict
    res2 = client.post(f"/api/twin/scenario/{scen_id}/commit", json={"plan_id": plan_id, "approval": True})
    assert res2.status_code == 409
    assert "already been committed" in res2.json()["detail"].lower()


# ==========================================
# 18. Stale Plan Rejection
# ==========================================
def test_stale_plan_rejection():
    res_clone = client.post("/api/twin/scenario/clone", json={"scenario_name": "scen_stale_plan"})
    scen_id = res_clone.json()["scenario_id"]
    scenario_twin = state.scenarios[scen_id]

    # Disrupt link 2-11 and generate plan
    client.post(f"/api/twin/scenario/{scen_id}/disruptions", json={
        "type": "ROAD_CLOSURE",
        "target_id": "2-11",
        "severity": 1.0,
        "duration_hours": 24.0
    })
    res_rec = client.post(f"/api/twin/scenario/{scen_id}/recover", json={"swarm_size": 15, "iterations": 15})
    plan_id = res_rec.json()["plan_id"]
    plan = state.recovery_plans[plan_id]
    bypass_route = plan.shipment_results[0].optimized_route

    # Before committing, close a critical edge on the bypass route
    edge_to_close = (bypass_route[0], bypass_route[1])
    scenario_twin.graph.graph.edges[edge_to_close]["road_status"] = "closed"
    scenario_twin.graph.graph.edges[edge_to_close]["current_travel_time"] = 999.0

    # Attempt to commit stale plan
    res_commit = client.post(f"/api/twin/scenario/{scen_id}/commit", json={"plan_id": plan_id, "approval": True})
    assert res_commit.status_code == 409
    assert "stale" in res_commit.json()["detail"].lower() or "closed" in res_commit.json()["detail"].lower()


# ==========================================
# 19. Failed Atomic Commit Restores Snapshot
# ==========================================
def test_failed_atomic_commit(monkeypatch):
    res_clone = client.post("/api/twin/scenario/clone", json={"scenario_name": "scen_fail_atomic"})
    scen_id = res_clone.json()["scenario_id"]
    scenario_twin = state.scenarios[scen_id]

    client.post(f"/api/twin/scenario/{scen_id}/disruptions", json={
        "type": "WAREHOUSE_FAILURE",
        "target_id": "W1",
        "severity": 1.0,
        "duration_hours": 24.0
    })
    res_alloc = client.post(f"/api/twin/scenario/{scen_id}/reallocate", json={"allow_partial": True})
    plan_id = res_alloc.json()["plan_id"]

    orders_before = {k: o.source_warehouse_id for k, o in scenario_twin.orders.items()}
    inv_before = {k: (i.on_hand, i.reserved) for k, i in scenario_twin.inventory.items()}

    # Force error mid-execution during add_shipment to trigger atomic rollback
    def fail_add_shipment(*args, **kwargs):
        raise RuntimeError("Simulated mid-commit failure during shipment registration")

    monkeypatch.setattr(scenario_twin, "add_shipment", fail_add_shipment)

    res_commit = client.post(f"/api/twin/scenario/{scen_id}/commit", json={"plan_id": plan_id, "approval": True})
    assert res_commit.status_code == 409

    # Verify no partial mutation remained - restored to pre-commit snapshot
    assert {k: o.source_warehouse_id for k, o in scenario_twin.orders.items()} == orders_before
    assert {k: (i.on_hand, i.reserved) for k, i in scenario_twin.inventory.items()} == inv_before


# ==========================================
# 20. Rollback Endpoint
# ==========================================
def test_rollback_endpoint():
    res_clone = client.post("/api/twin/scenario/clone", json={"scenario_name": "scen_rollback_api"})
    scen_id = res_clone.json()["scenario_id"]

    client.post(f"/api/twin/scenario/{scen_id}/disruptions", json={
        "type": "ROAD_CLOSURE",
        "target_id": "2-11",
        "severity": 1.0,
        "duration_hours": 24.0
    })
    res_rec = client.post(f"/api/twin/scenario/{scen_id}/recover", json={"swarm_size": 15, "iterations": 15})
    plan_id = res_rec.json()["plan_id"]

    res_commit = client.post(f"/api/twin/scenario/{scen_id}/commit", json={"plan_id": plan_id, "approval": True})
    snap_id = res_commit.json()["snapshot_id"]

    res_rollback = client.post(f"/api/twin/scenario/{scen_id}/rollback/{snap_id}")
    assert res_rollback.status_code == 200
    roll_data = res_rollback.json()
    assert roll_data["success"] is True
    assert roll_data["snapshot_id"] == snap_id


# ==========================================
# 21. Rollback Restores Inventory
# ==========================================
def test_rollback_restores_inventory():
    res_clone = client.post("/api/twin/scenario/clone", json={"scenario_name": "scen_roll_inv"})
    scen_id = res_clone.json()["scenario_id"]
    scenario_twin = state.scenarios[scen_id]

    client.post(f"/api/twin/scenario/{scen_id}/disruptions", json={
        "type": "WAREHOUSE_FAILURE",
        "target_id": "W1",
        "severity": 1.0,
        "duration_hours": 24.0
    })

    w2_inv_before = (scenario_twin.get_inventory("W2", "SKU-MED-CHIP").on_hand, scenario_twin.get_inventory("W2", "SKU-MED-CHIP").reserved)

    res_alloc = client.post(f"/api/twin/scenario/{scen_id}/reallocate", json={"allow_partial": True})
    plan_id = res_alloc.json()["plan_id"]
    res_commit = client.post(f"/api/twin/scenario/{scen_id}/commit", json={"plan_id": plan_id, "approval": True})
    snap_id = res_commit.json()["snapshot_id"]

    # Rollback
    client.post(f"/api/twin/scenario/{scen_id}/rollback/{snap_id}")

    w2_inv_after = (scenario_twin.get_inventory("W2", "SKU-MED-CHIP").on_hand, scenario_twin.get_inventory("W2", "SKU-MED-CHIP").reserved)
    assert w2_inv_before == w2_inv_after


# ==========================================
# 22. Rollback Restores Orders
# ==========================================
def test_rollback_restores_orders():
    res_clone = client.post("/api/twin/scenario/clone", json={"scenario_name": "scen_roll_orders"})
    scen_id = res_clone.json()["scenario_id"]
    scenario_twin = state.scenarios[scen_id]

    client.post(f"/api/twin/scenario/{scen_id}/disruptions", json={
        "type": "WAREHOUSE_FAILURE",
        "target_id": "W1",
        "severity": 1.0,
        "duration_hours": 24.0
    })

    orders_before = {k: o.source_warehouse_id for k, o in scenario_twin.orders.items()}

    res_alloc = client.post(f"/api/twin/scenario/{scen_id}/reallocate", json={"allow_partial": True})
    plan_id = res_alloc.json()["plan_id"]
    res_commit = client.post(f"/api/twin/scenario/{scen_id}/commit", json={"plan_id": plan_id, "approval": True})
    snap_id = res_commit.json()["snapshot_id"]

    # Rollback
    client.post(f"/api/twin/scenario/{scen_id}/rollback/{snap_id}")

    orders_after = {k: o.source_warehouse_id for k, o in scenario_twin.orders.items()}
    assert orders_before == orders_after


# ==========================================
# 23. Rollback Restores Shipments
# ==========================================
def test_rollback_restores_shipments():
    res_clone = client.post("/api/twin/scenario/clone", json={"scenario_name": "scen_roll_shps"})
    scen_id = res_clone.json()["scenario_id"]
    scenario_twin = state.scenarios[scen_id]

    client.post(f"/api/twin/scenario/{scen_id}/disruptions", json={
        "type": "ROAD_CLOSURE",
        "target_id": "2-11",
        "severity": 1.0,
        "duration_hours": 24.0
    })

    orig_route = list(scenario_twin.get_shipment("SHP-001").route)

    res_rec = client.post(f"/api/twin/scenario/{scen_id}/recover", json={"swarm_size": 15, "iterations": 15})
    plan_id = res_rec.json()["plan_id"]
    res_commit = client.post(f"/api/twin/scenario/{scen_id}/commit", json={"plan_id": plan_id, "approval": True})
    snap_id = res_commit.json()["snapshot_id"]

    # Rollback
    client.post(f"/api/twin/scenario/{scen_id}/rollback/{snap_id}")

    assert scenario_twin.get_shipment("SHP-001").route == orig_route


# ==========================================
# 24. Baseline Remains Unchanged
# ==========================================
def test_baseline_remains_unchanged():
    baseline_routes = {k: list(s.route) for k, s in state.active_twin.shipments.items()}
    baseline_inv = {k: (i.on_hand, i.reserved) for k, i in state.active_twin.inventory.items()}

    res_clone = client.post("/api/twin/scenario/clone", json={"scenario_name": "scen_guard_baseline"})
    scen_id = res_clone.json()["scenario_id"]

    client.post(f"/api/twin/scenario/{scen_id}/disruptions", json={
        "type": "ROAD_CLOSURE",
        "target_id": "2-11",
        "severity": 1.0,
        "duration_hours": 24.0
    })
    res_rec = client.post(f"/api/twin/scenario/{scen_id}/recover", json={"swarm_size": 15, "iterations": 15})
    plan_id = res_rec.json()["plan_id"]

    client.post(f"/api/twin/scenario/{scen_id}/commit", json={"plan_id": plan_id, "approval": True})

    # Baseline is strictly unchanged
    assert {k: list(s.route) for k, s in state.active_twin.shipments.items()} == baseline_routes
    assert {k: (i.on_hand, i.reserved) for k, i in state.active_twin.inventory.items()} == baseline_inv


# ==========================================
# 25. Warehouse Failure Commit
# ==========================================
def test_warehouse_failure_commit():
    res_clone = client.post("/api/twin/scenario/clone", json={"scenario_name": "scen_wh_fail_flow"})
    scen_id = res_clone.json()["scenario_id"]
    scenario_twin = state.scenarios[scen_id]

    client.post(f"/api/twin/scenario/{scen_id}/disruptions", json={
        "type": "WAREHOUSE_FAILURE",
        "target_id": "W1",
        "severity": 1.0,
        "duration_hours": 24.0
    })

    res_alloc = client.post(f"/api/twin/scenario/{scen_id}/reallocate", json={"allow_partial": True})
    plan_id = res_alloc.json()["plan_id"]

    res_commit = client.post(f"/api/twin/scenario/{scen_id}/commit", json={"plan_id": plan_id, "approval": True})
    assert res_commit.status_code == 200
    assert len(res_commit.json()["order_changes"]) > 0
    assert scenario_twin.get_order("ORD-001").source_warehouse_id == "W2"


# ==========================================
# 26. Road Closure Commit
# ==========================================
def test_road_closure_commit():
    res_clone = client.post("/api/twin/scenario/clone", json={"scenario_name": "scen_road_close_flow"})
    scen_id = res_clone.json()["scenario_id"]
    scenario_twin = state.scenarios[scen_id]

    client.post(f"/api/twin/scenario/{scen_id}/disruptions", json={
        "type": "ROAD_CLOSURE",
        "target_id": "2-11",
        "severity": 1.0,
        "duration_hours": 24.0
    })

    res_rec = client.post(f"/api/twin/scenario/{scen_id}/recover", json={"swarm_size": 15, "iterations": 15})
    plan_id = res_rec.json()["plan_id"]

    res_commit = client.post(f"/api/twin/scenario/{scen_id}/commit", json={"plan_id": plan_id, "approval": True})
    assert res_commit.status_code == 200
    assert len(res_commit.json()["shipment_changes"]) > 0
    assert scenario_twin.get_shipment("SHP-001").status == ShipmentStatus.REROUTED


# ==========================================
# 27. Combined Recovery Commit
# ==========================================
def test_combined_recovery_commit():
    res_clone = client.post("/api/twin/scenario/clone", json={"scenario_name": "scen_combined_flow"})
    scen_id = res_clone.json()["scenario_id"]
    scenario_twin = state.scenarios[scen_id]

    # Inject road closure AND warehouse disruption
    client.post(f"/api/twin/scenario/{scen_id}/disruptions", json={
        "type": "ROAD_CLOSURE",
        "target_id": "2-11",
        "severity": 1.0,
        "duration_hours": 24.0
    })
    client.post(f"/api/twin/scenario/{scen_id}/disruptions", json={
        "type": "WAREHOUSE_SLOWDOWN",
        "target_id": "W1",
        "severity": 0.8,
        "duration_hours": 24.0
    })

    res_rec = client.post(f"/api/twin/scenario/{scen_id}/recover", json={"swarm_size": 15, "iterations": 15})
    plan_id = res_rec.json()["plan_id"]

    res_commit = client.post(f"/api/twin/scenario/{scen_id}/commit", json={"plan_id": plan_id, "approval": True})
    assert res_commit.status_code == 200
    assert res_commit.json()["success"] is True


# ==========================================
# 28. No Duplicate Shipment Creation
# ==========================================
def test_no_duplicate_shipment_creation():
    res_clone = client.post("/api/twin/scenario/clone", json={"scenario_name": "scen_no_dup_shp"})
    scen_id = res_clone.json()["scenario_id"]
    scenario_twin = state.scenarios[scen_id]

    client.post(f"/api/twin/scenario/{scen_id}/disruptions", json={
        "type": "WAREHOUSE_FAILURE",
        "target_id": "W1",
        "severity": 1.0,
        "duration_hours": 24.0
    })

    res_alloc = client.post(f"/api/twin/scenario/{scen_id}/reallocate", json={"allow_partial": True})
    plan_id = res_alloc.json()["plan_id"]

    client.post(f"/api/twin/scenario/{scen_id}/commit", json={"plan_id": plan_id, "approval": True})
    shps_after_first = len(scenario_twin.shipments)

    # Attempting second commit fails via idempotency
    res_dup = client.post(f"/api/twin/scenario/{scen_id}/commit", json={"plan_id": plan_id, "approval": True})
    assert res_dup.status_code == 409
    assert len(scenario_twin.shipments) == shps_after_first


# ==========================================
# 29. No Double Inventory Deduction
# ==========================================
def test_no_double_inventory_deduction():
    res_clone = client.post("/api/twin/scenario/clone", json={"scenario_name": "scen_no_double_deduct"})
    scen_id = res_clone.json()["scenario_id"]
    scenario_twin = state.scenarios[scen_id]

    client.post(f"/api/twin/scenario/{scen_id}/disruptions", json={
        "type": "WAREHOUSE_FAILURE",
        "target_id": "W1",
        "severity": 1.0,
        "duration_hours": 24.0
    })

    res_alloc = client.post(f"/api/twin/scenario/{scen_id}/reallocate", json={"allow_partial": True})
    plan_id = res_alloc.json()["plan_id"]

    client.post(f"/api/twin/scenario/{scen_id}/commit", json={"plan_id": plan_id, "approval": True})
    res_item_after_first = scenario_twin.get_inventory("W2", "SKU-MED-CHIP").reserved

    # Attempt second commit
    client.post(f"/api/twin/scenario/{scen_id}/commit", json={"plan_id": plan_id, "approval": True})
    # Stock must NOT be deducted again
    assert scenario_twin.get_inventory("W2", "SKU-MED-CHIP").reserved == res_item_after_first


# ==========================================
# 30. Legacy APIs Still Work
# ==========================================
def test_legacy_apis_still_work():
    res_status = client.get("/api/traffic/status")
    assert res_status.status_code == 200

    res_graph = client.get("/api/graph")
    assert res_graph.status_code == 200

    res_sp = client.post("/api/optimize/shortest-path", json={
        "source": 0,
        "target": 8,
        "algorithm": "iqpso",
        "swarm_size": 15,
        "iterations": 15
    })
    assert res_sp.status_code == 200

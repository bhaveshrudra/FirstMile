from fastapi import APIRouter, HTTPException
from typing import Optional, List
from pydantic import BaseModel, Field

from . import state
from ..recovery.models import (
    RecoveryProblem,
    RecoveryPlan,
    RecoveryCommitResult,
    RecoveryRollbackResult,
)
from ..recovery.problem import build_recovery_problem
from ..recovery.planner import RecoveryPlanner
from ..recovery.commit import RecoveryCommitEngine

router = APIRouter(tags=["recovery"])


class RecoveryProblemRequest(BaseModel):
    disruption_ids: Optional[List[str]] = Field(default=None, description="Optional specific disruption IDs to formulate problem for")


class RecoveryExecuteRequest(BaseModel):
    disruption_ids: Optional[List[str]] = Field(default=None, description="Optional specific disruption IDs to optimize recovery for")
    solver: str = Field(default="iqpso", description="Optimization algorithm ('iqpso')")
    swarm_size: int = Field(default=30, ge=5, le=200, description="Swarm size for heuristic solver")
    iterations: int = Field(default=50, ge=5, le=500, description="Max iterations for heuristic solver")
    seed: Optional[int] = Field(default=None, description="Deterministic random seed")


@router.post("/twin/scenario/{scenario_id}/recovery/problem", response_model=RecoveryProblem)
def get_scenario_recovery_problem(
    scenario_id: str,
    payload: Optional[RecoveryProblemRequest] = None
):
    """
    Constructs and returns the formal RecoveryProblem for a scenario twin.
    Identifies affected entities, invalid routes, candidate bypass corridors,
    and baseline metrics without executing optimization or mutating state.
    """
    twin = state.scenarios.get(scenario_id)
    if twin is None:
        raise HTTPException(
            status_code=404,
            detail=f"Scenario '{scenario_id}' not found in registry."
        )

    disruption_ids = payload.disruption_ids if payload else None
    problem = build_recovery_problem(
        twin=twin,
        disruption_ids=disruption_ids,
        scenario_id=scenario_id
    )
    return problem


@router.post("/twin/scenario/{scenario_id}/recover", response_model=RecoveryPlan)
def execute_scenario_recovery(
    scenario_id: str,
    payload: Optional[RecoveryExecuteRequest] = None
):
    """
    Executes Phase 2B multi-objective recovery rerouting optimization on a scenario twin.
    Evaluates candidate routes against disruptions via ImprovedQPSO and Dijkstra bypasses,
    computing metric deltas (travel time, transport cost, risk, delivery delay) without
    mutating scenario or baseline state. Registers formulated plan for approval and commitment.
    """
    twin = state.scenarios.get(scenario_id)
    if twin is None:
        raise HTTPException(
            status_code=404,
            detail=f"Scenario '{scenario_id}' not found in registry."
        )

    disruption_ids = payload.disruption_ids if payload else None
    swarm_size = payload.swarm_size if payload else 30
    iterations = payload.iterations if payload else 50
    seed = payload.seed if payload else None

    planner = RecoveryPlanner(twin)
    plan = planner.optimize_recovery(
        disruption_ids=disruption_ids,
        scenario_id=scenario_id,
        swarm_size=swarm_size,
        iterations=iterations,
        seed=seed
    )
    # Register plan in in-memory plan registry
    state.recovery_plans[plan.plan_id] = plan
    return plan


class InventoryReallocationRequest(BaseModel):
    disruption_ids: Optional[List[str]] = Field(default=None, description="Optional specific disruption IDs to reallocate inventory for")
    allow_partial: bool = Field(default=True, description="Whether partial order fulfillment is permitted if stock is insufficient")


@router.post("/twin/scenario/{scenario_id}/reallocate", response_model=RecoveryPlan)
def execute_scenario_inventory_reallocation(
    scenario_id: str,
    payload: Optional[InventoryReallocationRequest] = None
):
    """
    Executes Phase 2C cross-warehouse inventory and order reallocation analysis on a scenario twin.
    Identifies affected orders, discovers viable candidate alternate warehouses, checks stock
    availability and downstream route feasibility, and recommends optimal fulfillment reallocations
    without mutating the digital twin state. Registers formulated plan for approval and commitment.
    """
    twin = state.scenarios.get(scenario_id)
    if twin is None:
        raise HTTPException(
            status_code=404,
            detail=f"Scenario '{scenario_id}' not found in registry."
        )

    disruption_ids = payload.disruption_ids if payload else None
    allow_partial = payload.allow_partial if payload else True

    planner = RecoveryPlanner(twin)
    plan = planner.reallocate_inventory(
        disruption_ids=disruption_ids,
        scenario_id=scenario_id,
        allow_partial=allow_partial
    )
    # Register plan in in-memory plan registry
    state.recovery_plans[plan.plan_id] = plan
    return plan


class RecoveryCommitRequest(BaseModel):
    plan_id: str = Field(..., description="ID of previously formulated RecoveryPlan to commit")
    approval: bool = Field(default=True, description="Explicit approval confirming commitment")


@router.post("/twin/scenario/{scenario_id}/commit", response_model=RecoveryCommitResult)
def execute_scenario_recovery_commit(
    scenario_id: str,
    payload: RecoveryCommitRequest
):
    """
    Executes Phase 2D atomic commitment of an approved RecoveryPlan into the scenario twin.
    Captures a pre-commit snapshot, validates current scenario state, applies shipment rerouting,
    inventory reservations, order reassignments, and freight shipment creations, and returns
    a comprehensive audit result. Reverts automatically via pre-commit snapshot if any validation fails.
    """
    twin = state.scenarios.get(scenario_id)
    if twin is None:
        raise HTTPException(
            status_code=404,
            detail=f"Scenario '{scenario_id}' not found in registry."
        )

    if twin is state.active_twin or twin.name in {"active_twin", "baseline"}:
        raise HTTPException(
            status_code=400,
            detail="Baseline digital twin cannot be mutated. Commit is permitted only on scenario twins."
        )

    plan = state.recovery_plans.get(payload.plan_id)
    if plan is None:
        raise HTTPException(
            status_code=404,
            detail=f"RecoveryPlan '{payload.plan_id}' not found in registry."
        )

    if plan.scenario_id != scenario_id and getattr(twin, "name", "") != plan.scenario_id:
        raise HTTPException(
            status_code=400,
            detail=f"RecoveryPlan '{payload.plan_id}' belongs to scenario '{plan.scenario_id}', not '{scenario_id}'."
        )

    if plan.is_committed or payload.plan_id in state.recovery_commits:
        raise HTTPException(
            status_code=409,
            detail=f"RecoveryPlan '{payload.plan_id}' has already been committed to scenario '{scenario_id}' (idempotency guard)."
        )

    if not payload.approval:
        raise HTTPException(
            status_code=422,
            detail="Commit rejected: explicit approval flag must be True (approval=true)."
        )

    commit_engine = RecoveryCommitEngine(twin, state.snapshot_manager)
    result = commit_engine.commit_plan(plan, approval=payload.approval)

    if not result.success:
        raise HTTPException(
            status_code=409,
            detail=f"Commit failed validation or execution: {'; '.join(result.validation_errors)}"
        )

    state.recovery_commits[payload.plan_id] = result
    return result


@router.post("/twin/scenario/{scenario_id}/rollback/{snapshot_id}", response_model=RecoveryRollbackResult)
def execute_scenario_rollback(
    scenario_id: str,
    snapshot_id: str
):
    """
    Restores the specified scenario twin to a prior pre-commit snapshot.
    Guarantees that the baseline digital twin is never affected.
    """
    twin = state.scenarios.get(scenario_id)
    if twin is None:
        raise HTTPException(
            status_code=404,
            detail=f"Scenario '{scenario_id}' not found in registry."
        )

    if twin is state.active_twin or twin.name in {"active_twin", "baseline"}:
        raise HTTPException(
            status_code=400,
            detail="Baseline digital twin cannot be rolled back."
        )

    snapshot = state.snapshot_manager.get_snapshot(snapshot_id)
    if snapshot is None:
        raise HTTPException(
            status_code=404,
            detail=f"Snapshot '{snapshot_id}' not found in SnapshotManager."
        )

    commit_engine = RecoveryCommitEngine(twin, state.snapshot_manager)
    result = commit_engine.rollback(snapshot_id)
    return result

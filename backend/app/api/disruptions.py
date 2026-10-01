from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional, Dict, Any

from . import state
from ..disruption.models import Disruption, DisruptionType, DisruptionStatus
from ..disruption.manager import DisruptionManager
from ..disruption.impact import analyze_disruption_impact, analyze_twin_impact
from ..scenarios.simulation import run_scenario_simulation
from ..schemas.disruption import (
    DisruptionCreateRequest,
    DisruptionResponse,
    ImpactResponse,
    SimulationRequest,
    SimulationResultResponse,
)

router = APIRouter(tags=["disruptions"])


def _to_response_dict(d: Disruption) -> Dict[str, Any]:
    return {
        "id": d.id,
        "type": d.type.value if hasattr(d.type, "value") else str(d.type),
        "target_id": d.target_id,
        "severity": d.severity,
        "start_time": d.start_time,
        "duration_hours": d.duration_hours,
        "end_time": d.end_time,
        "description": d.description,
        "status": d.status.value if hasattr(d.status, "value") else str(d.status),
        "parameters": d.parameters,
    }


def _get_scenario_twin(scenario_id: str):
    twin = state.scenarios.get(scenario_id)
    if twin is None:
        raise HTTPException(
            status_code=404,
            detail=f"Scenario '{scenario_id}' not found in registry."
        )
    return twin


# ==========================================
# Active Twin Disruption Endpoints
# ==========================================

@router.post("/disruptions", response_model=DisruptionResponse)
def create_disruption(payload: DisruptionCreateRequest):
    """
    Creates and injects a disruption into the active baseline digital twin.
    """
    try:
        dtype = DisruptionType(payload.type.strip().upper())
    except ValueError:
        valid_types = [t.value for t in DisruptionType]
        raise HTTPException(
            status_code=400,
            detail=f"Invalid disruption type '{payload.type}'. Valid types: {valid_types}"
        )

    disruption = Disruption(
        type=dtype,
        target_id=payload.target_id,
        severity=payload.severity,
        start_time=payload.start_time,
        duration_hours=payload.duration_hours,
        description=payload.description or "",
        parameters=payload.parameters or {},
    )

    dm = DisruptionManager(state.active_twin)
    created = dm.inject_disruption(disruption)
    return _to_response_dict(created)


@router.get("/disruptions", response_model=List[DisruptionResponse])
def list_disruptions(active_only: bool = Query(False, description="Filter for ACTIVE status only")):
    """
    Lists disruptions currently present on the active digital twin.
    """
    dm = DisruptionManager(state.active_twin)
    disruptions = dm.list_disruptions(active_only=active_only)
    return [_to_response_dict(d) for d in disruptions]


@router.get("/disruptions/{disruption_id}", response_model=DisruptionResponse)
def get_disruption(disruption_id: str):
    """
    Retrieves details of a specific disruption on the active digital twin.
    """
    dm = DisruptionManager(state.active_twin)
    d = dm.get_disruption(disruption_id)
    if d is None:
        raise HTTPException(status_code=404, detail=f"Disruption '{disruption_id}' not found.")
    return _to_response_dict(d)


@router.delete("/disruptions/{disruption_id}", response_model=DisruptionResponse)
def resolve_disruption(disruption_id: str):
    """
    Resolves a disruption on the active twin and reverses its physical/logical network impact.
    """
    dm = DisruptionManager(state.active_twin)
    d = dm.resolve_disruption(disruption_id)
    if d is None:
        raise HTTPException(status_code=404, detail=f"Disruption '{disruption_id}' not found.")
    return _to_response_dict(d)


@router.post("/disruptions/clear")
def clear_all_disruptions():
    """
    Clears and reverses all active disruptions on the active twin.
    """
    dm = DisruptionManager(state.active_twin)
    dm.clear_all_disruptions()
    return {"cleared": True, "active_disruptions": 0}


@router.get("/disruptions/{disruption_id}/impact", response_model=ImpactResponse)
def get_disruption_impact(disruption_id: str):
    """
    Returns deterministic causal impact analysis for a specific disruption on the active twin.
    """
    dm = DisruptionManager(state.active_twin)
    d = dm.get_disruption(disruption_id)
    if d is None:
        raise HTTPException(status_code=404, detail=f"Disruption '{disruption_id}' not found.")
    return analyze_disruption_impact(d, state.active_twin)


# ==========================================
# Scenario-Specific Disruption Endpoints
# Mutates only the scenario clone, leaving baseline untouched
# ==========================================

@router.post("/twin/scenario/{scenario_id}/disruptions", response_model=DisruptionResponse)
def create_scenario_disruption(scenario_id: str, payload: DisruptionCreateRequest):
    """
    Injects a disruption into an isolated what-if scenario twin.
    The baseline active_twin is not modified.
    """
    twin = _get_scenario_twin(scenario_id)
    try:
        dtype = DisruptionType(payload.type.strip().upper())
    except ValueError:
        valid_types = [t.value for t in DisruptionType]
        raise HTTPException(
            status_code=400,
            detail=f"Invalid disruption type '{payload.type}'. Valid types: {valid_types}"
        )

    disruption = Disruption(
        type=dtype,
        target_id=payload.target_id,
        severity=payload.severity,
        start_time=payload.start_time,
        duration_hours=payload.duration_hours,
        description=payload.description or "",
        parameters=payload.parameters or {},
    )

    dm = DisruptionManager(twin)
    created = dm.inject_disruption(disruption)
    return _to_response_dict(created)


@router.get("/twin/scenario/{scenario_id}/disruptions", response_model=List[DisruptionResponse])
def list_scenario_disruptions(
    scenario_id: str,
    active_only: bool = Query(False, description="Filter for ACTIVE status only")
):
    """
    Lists disruptions present in an isolated scenario twin.
    """
    twin = _get_scenario_twin(scenario_id)
    dm = DisruptionManager(twin)
    disruptions = dm.list_disruptions(active_only=active_only)
    return [_to_response_dict(d) for d in disruptions]


@router.get("/twin/scenario/{scenario_id}/disruptions/{disruption_id}", response_model=DisruptionResponse)
def get_scenario_disruption(scenario_id: str, disruption_id: str):
    """
    Gets details of a disruption inside an isolated scenario twin.
    """
    twin = _get_scenario_twin(scenario_id)
    dm = DisruptionManager(twin)
    d = dm.get_disruption(disruption_id)
    if d is None:
        raise HTTPException(
            status_code=404,
            detail=f"Disruption '{disruption_id}' not found in scenario '{scenario_id}'."
        )
    return _to_response_dict(d)


@router.delete("/twin/scenario/{scenario_id}/disruptions/{disruption_id}", response_model=DisruptionResponse)
def resolve_scenario_disruption(scenario_id: str, disruption_id: str):
    """
    Resolves and reverses a disruption inside an isolated scenario twin.
    """
    twin = _get_scenario_twin(scenario_id)
    dm = DisruptionManager(twin)
    d = dm.resolve_disruption(disruption_id)
    if d is None:
        raise HTTPException(
            status_code=404,
            detail=f"Disruption '{disruption_id}' not found in scenario '{scenario_id}'."
        )
    return _to_response_dict(d)


@router.get("/twin/scenario/{scenario_id}/impact", response_model=ImpactResponse)
def get_scenario_aggregate_impact(scenario_id: str):
    """
    Returns aggregate causal impact analysis across all active disruptions in the scenario.
    """
    twin = _get_scenario_twin(scenario_id)
    return analyze_twin_impact(twin)


# ==========================================
# What-If Simulation Endpoint
# ==========================================

@router.post("/twin/scenario/{scenario_id}/simulate", response_model=SimulationResultResponse)
def simulate_scenario(scenario_id: str, payload: Optional[SimulationRequest] = None):
    """
    Executes a discrete time-step progression simulation over a what-if scenario twin.
    Advances simulation clock, evaluates disruption expiration, and returns compact state timeseries.
    """
    twin = _get_scenario_twin(scenario_id)
    req = payload or SimulationRequest()

    result = run_scenario_simulation(
        twin=twin,
        duration_hours=req.duration_hours,
        step_hours=req.step_hours,
        scenario_id=scenario_id
    )
    return result

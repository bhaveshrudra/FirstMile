from fastapi import APIRouter, HTTPException
import uuid
from typing import List, Optional
from . import state
from ..schemas.traffic import (
    IncidentCreateSchema, 
    IncidentResponseSchema, 
    TrafficTimeUpdateSchema,
    TrafficEventRequestSchema, 
    TrafficStatusResponse
)
from ..traffic.traffic_model import TrafficIncident

router = APIRouter(prefix="/traffic", tags=["traffic"])

@router.get("/status", response_model=TrafficStatusResponse)
def get_traffic_status():
    """Gets the current simulation hour and a list of active incidents."""
    incidents_list = list(state.active_simulator.incidents.values())
    return {
        "hour": state.active_simulator.current_hour,
        "active_incidents": incidents_list
    }

@router.post("/time", response_model=TrafficStatusResponse)
def update_simulation_time(payload: TrafficTimeUpdateSchema):
    """Updates the virtual simulation hour of the day."""
    state.active_simulator.update_simulation_time(payload.hour)
    incidents_list = list(state.active_simulator.incidents.values())
    return {
        "hour": state.active_simulator.current_hour,
        "active_incidents": incidents_list
    }

@router.post("/incident", response_model=IncidentResponseSchema)
def add_incident(payload: IncidentCreateSchema):
    """Injects a dynamic incident (accident, roadblock, weather) onto an edge."""
    g = state.active_graph.graph
    if not (g.has_node(payload.source) and g.has_node(payload.target)):
        raise HTTPException(status_code=400, detail="Source or target node not found in graph.")
    if not g.has_edge(payload.source, payload.target):
        raise HTTPException(status_code=400, detail="No edge exists between source and target.")
        
    incident_id = str(uuid.uuid4())[:8]
    incident = TrafficIncident(
        id=incident_id,
        source=payload.source,
        target=payload.target,
        incident_type=payload.incident_type,
        severity=payload.severity,
        description=payload.description
    )
    
    state.active_simulator.add_incident(incident)
    return incident

@router.post("/event", response_model=TrafficStatusResponse)
def trigger_traffic_event(payload: TrafficEventRequestSchema):
    """
    Triggers simulated events: normal, congestion, accident, road_closure, peak_hour, random_incident
    """
    edge = None
    if payload.source is not None and payload.target is not None:
        edge = (payload.source, payload.target)
        
    state.active_simulator.trigger_event(
        event_type=payload.event_type,
        edge=edge,
        severity=payload.severity or 0.8,
        description=payload.description or ""
    )
    
    incidents_list = list(state.active_simulator.incidents.values())
    return {
        "hour": state.active_simulator.current_hour,
        "active_incidents": incidents_list
    }

@router.delete("/incident/{incident_id}", response_model=TrafficStatusResponse)
def remove_incident(incident_id: str):
    """Removes an active incident by its ID."""
    if incident_id not in state.active_simulator.incidents:
        raise HTTPException(status_code=404, detail="Incident ID not found.")
        
    state.active_simulator.remove_incident(incident_id)
    incidents_list = list(state.active_simulator.incidents.values())
    return {
        "hour": state.active_simulator.current_hour,
        "active_incidents": incidents_list
    }

@router.post("/incident/clear", response_model=TrafficStatusResponse)
def clear_all_incidents():
    """Clears all traffic incidents in the simulation."""
    state.active_simulator.clear_all_incidents()
    return {
        "hour": state.active_simulator.current_hour,
        "active_incidents": []
    }

from pydantic import BaseModel, Field
from typing import List, Optional

class IncidentCreateSchema(BaseModel):
    source: int = Field(..., description="Source node ID")
    target: int = Field(..., description="Target node ID")
    incident_type: str = Field(..., description="Type of incident: accident, roadwork, weather, breakdown")
    severity: float = Field(..., ge=0.0, le=1.0, description="Severity of the incident between 0.0 and 1.0")
    description: str = Field("Road blockage", description="Human-readable description of the incident")

class IncidentResponseSchema(BaseModel):
    id: str
    source: int
    target: int
    incident_type: str
    severity: float
    description: str

class TrafficTimeUpdateSchema(BaseModel):
    hour: float = Field(..., ge=0.0, le=24.0, description="Hour of the day to set (0.0 to 24.0)")

class TrafficEventRequestSchema(BaseModel):
    event_type: str = Field(..., description="Event: normal, congestion, accident, road_closure, peak_hour, random_incident")
    source: Optional[int] = Field(None, description="Source node ID (for accident/road_closure)")
    target: Optional[int] = Field(None, description="Target node ID (for accident/road_closure)")
    severity: Optional[float] = Field(0.8, ge=0.0, le=1.0, description="Severity of the injected event")
    description: Optional[str] = Field(None, description="Details of the event")

class TrafficStatusResponse(BaseModel):
    hour: float
    active_incidents: List[IncidentResponseSchema]

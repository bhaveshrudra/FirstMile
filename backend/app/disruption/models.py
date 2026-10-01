import uuid
from enum import Enum
from typing import Dict, Any, Optional, Tuple
from pydantic import BaseModel, Field, field_validator


class DisruptionType(str, Enum):
    ROAD_CLOSURE = "ROAD_CLOSURE"
    ROAD_ACCIDENT = "ROAD_ACCIDENT"
    EXTREME_WEATHER = "EXTREME_WEATHER"
    PORT_CLOSURE = "PORT_CLOSURE"
    PORT_SLOWDOWN = "PORT_SLOWDOWN"
    SUPPLIER_FAILURE = "SUPPLIER_FAILURE"
    SUPPLIER_STOCKOUT = "SUPPLIER_STOCKOUT"
    WAREHOUSE_FAILURE = "WAREHOUSE_FAILURE"
    WAREHOUSE_SLOWDOWN = "WAREHOUSE_SLOWDOWN"
    DEMAND_SPIKE = "DEMAND_SPIKE"
    ROUTE_FAILURE = "ROUTE_FAILURE"
    DATA_BLACKOUT = "DATA_BLACKOUT"
    GPS_SPOOF = "GPS_SPOOF"


class DisruptionStatus(str, Enum):
    ACTIVE = "ACTIVE"
    RESOLVED = "RESOLVED"
    EXPIRED = "EXPIRED"


class Disruption(BaseModel):
    """
    Pydantic-compatible disruption model representing an intentional disturbance
    injected into a baseline or what-if scenario Digital Twin.
    """
    id: str = Field(default_factory=lambda: f"disr-{uuid.uuid4().hex[:8]}", description="Unique disruption event ID")
    type: DisruptionType = Field(..., description="Classification category of the disruption")
    target_id: str = Field(..., min_length=1, description="Entity or link identifier targeted (e.g. '2-11', 'P1', 'S1', 'W1', 'V1', 'C1')")
    severity: float = Field(..., ge=0.0, le=1.0, description="Disruption severity index scaled [0.0, 1.0]")
    start_time: float = Field(default=0.0, ge=0.0, description="Virtual hour simulation timestamp when disruption starts")
    duration_hours: float = Field(..., gt=0.0, description="Duration in virtual hours (must be strictly positive)")
    description: str = Field(default="", description="Human-readable context and notes")
    status: DisruptionStatus = Field(default=DisruptionStatus.ACTIVE, description="Current lifecycle state")
    parameters: Dict[str, Any] = Field(default_factory=dict, description="Extensible key-value parameter payloads")
    applied_impact_data: Dict[str, Any] = Field(default_factory=dict, description="Internal rollback snapshot data")

    @field_validator("target_id")
    @classmethod
    def validate_target_id(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("target_id must not be empty or blank")
        return s

    @property
    def end_time(self) -> float:
        """Timestamp when disruption expires."""
        return self.start_time + self.duration_hours

    def is_active_at(self, current_time: float) -> bool:
        """True if the disruption is in active status and falls within the current virtual time."""
        if self.status != DisruptionStatus.ACTIVE:
            return False
        return self.start_time <= current_time < self.end_time

    def is_expired_at(self, current_time: float) -> bool:
        """True if disruption has exceeded its duration."""
        if self.status != DisruptionStatus.ACTIVE:
            return False
        return current_time >= self.end_time

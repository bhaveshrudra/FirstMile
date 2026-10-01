from enum import Enum
from typing import Tuple, Optional
from pydantic import BaseModel, Field, field_validator, model_validator


class WarehouseStatus(str, Enum):
    ACTIVE = "ACTIVE"
    CONGESTED = "CONGESTED"
    DISRUPTED = "DISRUPTED"
    OFFLINE = "OFFLINE"


class Warehouse(BaseModel):
    """
    Represents a regional storage, cross-dock, or distribution center facility.
    """
    id: str = Field(..., description="Unique warehouse identifier")
    name: str = Field(..., description="Warehouse name or facility code")
    location: Tuple[float, float] = Field(..., description="Geographic coordinates (latitude, longitude)")
    node_id: Optional[int] = Field(None, description="Optional associated graph node ID")
    storage_capacity: float = Field(..., ge=0.0, description="Total storage volume / capacity in units")
    current_utilization: float = Field(..., ge=0.0, description="Currently utilized storage in units")
    throughput_capacity: float = Field(..., ge=0.0, description="Max inbound/outbound units processed per hour")
    status: WarehouseStatus = Field(default=WarehouseStatus.ACTIVE, description="Operational status")

    @field_validator("location")
    @classmethod
    def validate_location(cls, v: Tuple[float, float]) -> Tuple[float, float]:
        lat, lon = v
        if not (-90.0 <= lat <= 90.0):
            raise ValueError(f"Latitude must be between -90 and 90, got {lat}")
        if not (-180.0 <= lon <= 180.0):
            raise ValueError(f"Longitude must be between -180 and 180, got {lon}")
        return v

    @model_validator(mode="after")
    def validate_utilization(self) -> "Warehouse":
        if self.current_utilization > self.storage_capacity:
            raise ValueError(
                f"current_utilization ({self.current_utilization}) cannot exceed storage_capacity ({self.storage_capacity})"
            )
        return self

    @property
    def available_storage(self) -> float:
        """Remaining unutilized storage capacity."""
        return max(0.0, self.storage_capacity - self.current_utilization)

    @property
    def utilization_rate(self) -> float:
        """Storage utilization as a ratio [0.0, 1.0]."""
        if self.storage_capacity == 0:
            return 1.0
        return self.current_utilization / self.storage_capacity

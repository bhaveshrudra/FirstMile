from enum import Enum
from typing import Tuple, Optional
from pydantic import BaseModel, Field, field_validator, model_validator


class SupplierStatus(str, Enum):
    ACTIVE = "ACTIVE"
    DISRUPTED = "DISRUPTED"
    OFFLINE = "OFFLINE"


class Supplier(BaseModel):
    """
    Represents a physical supplier or manufacturing facility.
    """
    id: str = Field(..., description="Unique supplier identifier")
    name: str = Field(..., description="Supplier / facility name")
    location: Tuple[float, float] = Field(..., description="Geographic coordinates (latitude, longitude)")
    node_id: Optional[int] = Field(None, description="Optional associated graph node ID")
    production_capacity: float = Field(..., ge=0.0, description="Max production capacity in units")
    available_capacity: float = Field(..., ge=0.0, description="Currently available production capacity in units")
    reliability: float = Field(..., ge=0.0, le=1.0, description="Historical fulfillment reliability ratio [0.0, 1.0]")
    lead_time_hours: float = Field(..., ge=0.0, description="Production/dispatch lead time in hours")
    status: SupplierStatus = Field(default=SupplierStatus.ACTIVE, description="Operational status")

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
    def validate_capacity(self) -> "Supplier":
        if self.available_capacity > self.production_capacity:
            raise ValueError(
                f"available_capacity ({self.available_capacity}) cannot exceed production_capacity ({self.production_capacity})"
            )
        return self

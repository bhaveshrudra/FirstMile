from enum import Enum
from typing import Tuple, Optional
from pydantic import BaseModel, Field, field_validator


class CustomerStatus(str, Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    DISRUPTED = "DISRUPTED"


class Customer(BaseModel):
    """
    Represents a demand destination, client store, or distribution drop point.
    """
    id: str = Field(..., description="Unique customer ID")
    name: str = Field(..., description="Customer or retail store name")
    location: Tuple[float, float] = Field(..., description="Geographic coordinates (latitude, longitude)")
    node_id: Optional[int] = Field(None, description="Optional associated graph node ID")
    priority: int = Field(default=1, ge=1, le=5, description="Customer priority tier (1=standard, 5=critical)")
    service_level: float = Field(default=0.95, ge=0.0, le=1.0, description="Target SLA fulfillment rate [0.0, 1.0]")
    status: CustomerStatus = Field(default=CustomerStatus.ACTIVE, description="Customer operational status")

    @field_validator("location")
    @classmethod
    def validate_location(cls, v: Tuple[float, float]) -> Tuple[float, float]:
        lat, lon = v
        if not (-90.0 <= lat <= 90.0):
            raise ValueError(f"Latitude must be between -90 and 90, got {lat}")
        if not (-180.0 <= lon <= 180.0):
            raise ValueError(f"Longitude must be between -180 and 180, got {lon}")
        return v

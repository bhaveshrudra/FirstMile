from enum import Enum
from typing import Tuple, Optional
from pydantic import BaseModel, Field, field_validator


class VehicleType(str, Enum):
    TRUCK = "TRUCK"
    RAIL = "RAIL"
    SHIP = "SHIP"
    AIR = "AIR"


class VehicleStatus(str, Enum):
    AVAILABLE = "AVAILABLE"
    IN_TRANSIT = "IN_TRANSIT"
    MAINTENANCE = "MAINTENANCE"
    DISRUPTED = "DISRUPTED"
    OFFLINE = "OFFLINE"


class Vehicle(BaseModel):
    """
    Represents a physical transport asset with operational characteristics.
    """
    id: str = Field(..., description="Unique vehicle ID")
    vehicle_type: VehicleType = Field(default=VehicleType.TRUCK, description="Modality of the vehicle")
    capacity: float = Field(..., gt=0.0, description="Payload weight/volume capacity in units/kg")
    current_location: Tuple[float, float] = Field(..., description="Current GPS coordinates (lat, lon)")
    current_node_id: Optional[int] = Field(None, description="Optional current graph node ID")
    status: VehicleStatus = Field(default=VehicleStatus.AVAILABLE, description="Vehicle operational status")
    speed_kph: float = Field(..., gt=0.0, description="Nominal operating speed in km/h")
    fuel_level: float = Field(..., ge=0.0, le=1.0, description="Current fuel / battery level ratio [0.0, 1.0]")
    max_range_km: float = Field(..., gt=0.0, description="Maximum operational range in km on full tank/charge")
    actual_location: Optional[Tuple[float, float]] = Field(None, description="Actual physical GPS coordinates if reported is spoofed")
    reported_location: Optional[Tuple[float, float]] = Field(None, description="Reported GPS coordinates")
    is_suspect: bool = Field(False, description="Flag indicating suspected sensor/telemetry spoofing")
    telemetry_freshness: float = Field(1.0, ge=0.0, le=1.0, description="Freshness ratio [0.0, 1.0] of telemetry data; degraded during blackout")

    @field_validator("current_location")
    @classmethod
    def validate_location(cls, v: Tuple[float, float]) -> Tuple[float, float]:
        lat, lon = v
        if not (-90.0 <= lat <= 90.0):
            raise ValueError(f"Latitude must be between -90 and 90, got {lat}")
        if not (-180.0 <= lon <= 180.0):
            raise ValueError(f"Longitude must be between -180 and 180, got {lon}")
        return v


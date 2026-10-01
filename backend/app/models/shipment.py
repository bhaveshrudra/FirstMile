from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field, model_validator


class ShipmentStatus(str, Enum):
    PLANNED = "PLANNED"
    IN_TRANSIT = "IN_TRANSIT"
    DELAYED = "DELAYED"
    DELIVERED = "DELIVERED"
    REROUTED = "REROUTED"
    CANCELLED = "CANCELLED"


class Shipment(BaseModel):
    """
    Represents physical freight movement of cargo fulfilling an order.
    """
    id: str = Field(..., description="Unique shipment ID")
    order_id: str = Field(..., description="Associated customer order ID")
    vehicle_id: Optional[str] = Field(None, description="Assigned transport vehicle ID")
    origin_id: str = Field(..., description="Origin facility ID (supplier or warehouse)")
    destination_id: str = Field(..., description="Destination facility ID (warehouse or customer)")
    quantity: float = Field(..., gt=0.0, description="Shipment quantity in units/kg (must be strictly positive)")
    route: List[int] = Field(default_factory=list, description="Ordered sequence of graph node IDs")
    status: ShipmentStatus = Field(default=ShipmentStatus.PLANNED, description="Shipment lifecycle status")
    departure_time: Optional[float] = Field(None, ge=0.0, description="Simulation departure time in hours")
    eta: Optional[float] = Field(None, ge=0.0, description="Estimated time of arrival in hours")

    @model_validator(mode="after")
    def validate_timing(self) -> "Shipment":
        if self.departure_time is not None and self.eta is not None:
            if self.eta < self.departure_time:
                raise ValueError(
                    f"eta ({self.eta}) cannot be earlier than departure_time ({self.departure_time})"
                )
        return self

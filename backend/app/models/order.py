from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field, model_validator


class OrderStatus(str, Enum):
    PENDING = "PENDING"
    ALLOCATED = "ALLOCATED"
    IN_TRANSIT = "IN_TRANSIT"
    DELIVERED = "DELIVERED"
    DELAYED = "DELAYED"
    CANCELLED = "CANCELLED"


class Order(BaseModel):
    """
    Represents a customer purchase order or demand fulfillment request.
    """
    id: str = Field(..., description="Unique order ID")
    customer_id: str = Field(..., description="Customer placing the order")
    sku: str = Field(..., description="SKU requested")
    quantity: float = Field(..., gt=0.0, description="Order quantity (must be strictly positive)")
    priority: int = Field(default=1, ge=1, le=5, description="Order priority tier (1=standard, 5=urgent)")
    order_time: float = Field(..., ge=0.0, description="Simulation timestamp when order was placed in hours")
    promised_delivery_time: float = Field(..., ge=0.0, description="Promised delivery timestamp SLA in hours")
    status: OrderStatus = Field(default=OrderStatus.PENDING, description="Order fulfillment lifecycle status")
    source_warehouse_id: Optional[str] = Field(None, description="Fulfilling warehouse ID if allocated")

    @model_validator(mode="after")
    def validate_delivery_time(self) -> "Order":
        if self.promised_delivery_time < self.order_time:
            raise ValueError(
                f"promised_delivery_time ({self.promised_delivery_time}) cannot be earlier than order_time ({self.order_time})"
            )
        return self

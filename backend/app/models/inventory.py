from typing import Optional
from pydantic import BaseModel, Field, model_validator


class InventoryItem(BaseModel):
    """
    Represents stock of a specific SKU held at a warehouse.
    """
    sku: str = Field(..., description="Stock Keeping Unit identifier")
    warehouse_id: str = Field(..., description="Warehouse holding the inventory")
    on_hand: float = Field(..., ge=0.0, description="Total physical inventory in warehouse")
    reserved: float = Field(default=0.0, ge=0.0, description="Inventory allocated to active orders")
    safety_stock: float = Field(default=0.0, ge=0.0, description="Minimum buffer stock threshold")
    reorder_point: float = Field(..., ge=0.0, description="Stock level triggering replenishment")
    unit_cost: float = Field(..., ge=0.0, description="Unit cost value in currency")

    @model_validator(mode="after")
    def validate_reservations(self) -> "InventoryItem":
        if self.reserved > self.on_hand:
            raise ValueError(
                f"reserved inventory ({self.reserved}) cannot exceed on_hand inventory ({self.on_hand})"
            )
        return self

    @property
    def available(self) -> float:
        """Available unreserved physical inventory."""
        return max(0.0, self.on_hand - self.reserved)

    @property
    def is_below_reorder_point(self) -> bool:
        """True if on_hand is at or below the reorder point."""
        return self.on_hand <= self.reorder_point

    @property
    def is_stockout(self) -> bool:
        """True if there is zero available physical inventory."""
        return self.on_hand <= 0.0

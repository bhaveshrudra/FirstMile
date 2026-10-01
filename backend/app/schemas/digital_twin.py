from pydantic import BaseModel, Field
from typing import Dict, Any, List, Optional


class SnapshotCreateRequest(BaseModel):
    tag: Optional[str] = Field("checkpoint", description="Human-readable label for snapshot")


class SnapshotResponse(BaseModel):
    snapshot_id: str
    tag: str
    timestamp: float
    twin_name: str
    twin_version: int
    summary: Dict[str, Any]


class RestoreSnapshotRequest(BaseModel):
    snapshot_id: str = Field(..., description="ID of the snapshot to restore into active twin")


class ScenarioCloneRequest(BaseModel):
    scenario_name: str = Field(..., description="Name for the what-if scenario clone")


class ScenarioSummaryResponse(BaseModel):
    scenario_id: str
    scenario_name: str
    twin_name: str
    source_twin_version: int
    simulation_time: float
    summary: Dict[str, Any]


class TwinSummaryResponse(BaseModel):
    name: str
    version: int
    simulation_time: float
    last_updated: float
    supplier_count: int
    warehouse_count: int
    vehicle_count: int
    customer_count: int
    inventory_item_count: int
    order_count: int
    shipment_count: int
    active_disruptions: int
    graph_node_count: int
    graph_edge_count: int

from typing import List, Optional, Dict, Any, Tuple
from pydantic import BaseModel, Field


# ==========================================
# Health Schemas
# ==========================================

class DashboardHealthResponse(BaseModel):
    service_status: str = Field(default="healthy", description="Overall health of backend service")
    api_status: str = Field(default="online", description="API operational status")
    digital_twin_available: bool = Field(default=True, description="Whether active Digital Twin is loaded and initialized")
    simulation_time: float = Field(..., description="Current virtual hour in the active twin simulation")
    active_twin_name: str = Field(..., description="Name of the active Digital Twin instance")
    timestamp: float = Field(..., description="Unix epoch timestamp of health check")


# ==========================================
# Summary Sub-Schemas
# ==========================================

class TrafficSummarySchema(BaseModel):
    current_hour: float
    active_incidents_count: int
    average_congestion: float
    congested_links_count: int


class InventoryRiskSummarySchema(BaseModel):
    total_items: int
    stockout_risk_count: int
    at_reorder_count: int
    total_available_stock: float
    total_reserved_stock: float


class DashboardSummaryResponse(BaseModel):
    source_twin: str = Field(..., description="'active_twin' or 'scenario'")
    scenario_id: Optional[str] = Field(default=None, description="Scenario ID if evaluating isolated scenario")
    twin_name: str
    version: int
    simulation_time: float
    last_updated: float
    node_count: int
    edge_count: int
    supplier_count: int
    warehouse_count: int
    customer_count: int
    active_vehicle_count: int
    order_count: int
    shipment_count: int
    active_disruption_count: int
    affected_shipment_count: int
    affected_order_count: int
    recovery_plan_count: int
    committed_recovery_count: int
    traffic_summary: TrafficSummarySchema
    inventory_risk: InventoryRiskSummarySchema


# ==========================================
# Map Schemas
# ==========================================

class MapNodeSchema(BaseModel):
    node_id: int
    type: str
    label: str
    lat: float
    lon: float
    status: str
    capacity: Optional[float] = None
    facility_id: Optional[str] = None
    name: Optional[str] = None
    region: Optional[str] = None


class MapEdgeSchema(BaseModel):
    source: int
    target: int
    mode: str = Field(default="road", description="Multimodal transport mode: road, rail, ocean, air")
    distance: float
    speed: float
    capacity: float
    lanes: int
    road_type: str
    road_status: str
    current_travel_time: float
    congestion: float
    risk: float
    reliability: float
    transport_cost: float
    carbon_kg: float


class DashboardMapResponse(BaseModel):
    source_twin: str
    scenario_id: Optional[str] = None
    node_count: int
    edge_count: int
    nodes: List[MapNodeSchema]
    edges: List[MapEdgeSchema]


# ==========================================
# Live Shipment Schemas
# ==========================================

class LiveShipmentSchema(BaseModel):
    shipment_id: str
    order_id: str
    vehicle_id: Optional[str] = None
    origin_id: str
    destination_id: str
    quantity: float
    route: List[int]
    status: str
    is_feasible: bool
    invalidation_reason: Optional[str] = None
    current_travel_time: Optional[float] = None
    departure_time: Optional[float] = None
    eta: Optional[float] = None
    delay: float
    affected_by_disruption: bool
    is_suspect: bool = False


class LiveShipmentsResponse(BaseModel):
    source_twin: str
    scenario_id: Optional[str] = None
    count: int
    shipments: List[LiveShipmentSchema]


# ==========================================
# Live Disruption Schemas
# ==========================================

class LiveDisruptionSchema(BaseModel):
    disruption_id: str
    disruption_type: str
    target_id: str
    status: str
    severity: float
    start_time: float
    duration_hours: float
    end_time: float
    description: str
    affected_nodes: List[int]
    affected_edges: List[Tuple[int, int]]
    affected_shipments: List[str]
    affected_orders: List[str]
    affected_warehouses: List[str]
    affected_customers: List[str]
    affected_suppliers: List[str]
    impact_chain: List[str]


class LiveDisruptionsResponse(BaseModel):
    source_twin: str
    scenario_id: Optional[str] = None
    count: int
    disruptions: List[LiveDisruptionSchema]


# ==========================================
# Recovery Schemas
# ==========================================

class RecoveryPlanSummarySchema(BaseModel):
    plan_id: str
    scenario_id: str
    problem_id: str
    solver: str
    solver_execution_time: float
    affected_shipments: List[str]
    affected_orders: List[str]
    actions_count: int
    feasibility_status: str
    is_committed: bool
    baseline_metrics: Dict[str, Any]
    projected_metrics: Dict[str, Any]
    explanation: str


class RecoveryCommitSummarySchema(BaseModel):
    commit_id: str
    plan_id: str
    scenario_id: str
    snapshot_id: str
    status: str
    committed_at: float
    rollback_available: bool
    shipment_changes_count: int
    inventory_changes_count: int
    order_changes_count: int
    created_shipments_count: int


class RecoveryDashboardResponse(BaseModel):
    plans_count: int
    commits_count: int
    plans: List[RecoveryPlanSummarySchema]
    commits: List[RecoveryCommitSummarySchema]


# ==========================================
# KPI Schemas
# ==========================================

class DashboardKpiResponse(BaseModel):
    source_twin: str
    scenario_id: Optional[str] = None
    simulation_time: float
    total_orders: int
    active_shipments: int
    affected_shipments: int
    delayed_shipments: int
    disrupted_warehouses: int
    disrupted_links: int
    available_inventory: float
    stockout_risk_count: int
    total_travel_time: Optional[float] = None
    total_transport_cost: Optional[float] = None
    total_carbon: Optional[float] = None
    average_route_risk: Optional[float] = None
    fulfillment_rate_pct: Optional[float] = None


# ==========================================
# Scenario Overview Schemas
# ==========================================

class ScenarioDashboardItemSchema(BaseModel):
    scenario_id: str
    scenario_name: str
    twin_name: str
    source_twin_version: int
    simulation_time: float
    last_updated: float
    disruption_count: int
    shipment_impact_count: int
    order_impact_count: int
    recovery_plan_count: int
    commit_status: str
    is_committed: bool


class ScenariosDashboardResponse(BaseModel):
    count: int
    scenarios: List[ScenarioDashboardItemSchema]


# ==========================================
# Simulation Advance Schemas
# ==========================================

class SimulationAdvanceRequest(BaseModel):
    hours: float = Field(..., gt=0.0, le=48.0, description="Hours to advance simulation clock (0.1 to 48.0)")
    scenario_id: Optional[str] = Field(default=None, description="Optional target scenario ID, defaults to active twin")


class SimulationAdvanceResponse(BaseModel):
    success: bool
    source_twin: str
    scenario_id: Optional[str] = None
    previous_time: float
    current_time: float
    advanced_hours: float
    expired_incidents: int
    message: str

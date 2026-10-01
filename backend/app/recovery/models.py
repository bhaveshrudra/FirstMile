import uuid
import time
from enum import Enum
from typing import Dict, Any, List, Optional, Tuple
from pydantic import BaseModel, Field


# ==========================================
# Optimization Objectives & Types
# ==========================================

class RecoveryObjectiveType(str, Enum):
    TRAVEL_TIME = "TRAVEL_TIME"
    TRANSPORT_COST = "TRANSPORT_COST"
    RISK = "RISK"
    FUEL_COST = "FUEL_COST"
    CARBON = "CARBON"
    DELIVERY_DELAY = "DELIVERY_DELAY"
    SLA_BREACH = "SLA_BREACH"
    VEHICLE_COUNT = "VEHICLE_COUNT"
    INVENTORY_IMPACT = "INVENTORY_IMPACT"
    STOCKOUT_RISK = "STOCKOUT_RISK"


class RecoveryObjective(BaseModel):
    name: RecoveryObjectiveType = Field(..., description="Objective metric identifier")
    weight: float = Field(default=1.0, ge=0.0, description="Relative priority weighting")
    enabled: bool = Field(default=True, description="Whether objective is active in evaluation")


# ==========================================
# Constraints
# ==========================================

class RecoveryConstraintType(str, Enum):
    VEHICLE_CAPACITY = "VEHICLE_CAPACITY"
    WAREHOUSE_CAPACITY = "WAREHOUSE_CAPACITY"
    SUPPLIER_CAPACITY = "SUPPLIER_CAPACITY"
    ROUTE_AVAILABILITY = "ROUTE_AVAILABILITY"
    DELIVERY_DEADLINE = "DELIVERY_DEADLINE"
    INVENTORY_AVAILABILITY = "INVENTORY_AVAILABILITY"
    MAXIMUM_VEHICLES = "MAXIMUM_VEHICLES"
    SERVICE_PRIORITY = "SERVICE_PRIORITY"


class RecoveryConstraint(BaseModel):
    name: str = Field(..., description="Human-readable constraint name")
    type: RecoveryConstraintType = Field(..., description="Category of constraint")
    enabled: bool = Field(default=True, description="Whether constraint is enforced")
    parameters: Dict[str, Any] = Field(default_factory=dict, description="Constraint bounds/tolerances")


# ==========================================
# Candidate Actions
# ==========================================

class RecoveryActionType(str, Enum):
    REROUTE_SHIPMENT = "REROUTE_SHIPMENT"
    REALLOCATE_INVENTORY = "REALLOCATE_INVENTORY"
    USE_ALTERNATE_WAREHOUSE = "USE_ALTERNATE_WAREHOUSE"
    USE_ALTERNATE_SUPPLIER = "USE_ALTERNATE_SUPPLIER"
    DEFER_ORDER = "DEFER_ORDER"


class RecoveryAction(BaseModel):
    action_id: str = Field(default_factory=lambda: f"act-{uuid.uuid4().hex[:8]}", description="Unique action ID")
    action_type: RecoveryActionType = Field(..., description="Type of recovery intervention")
    target_id: str = Field(..., min_length=1, description="Entity or shipment ID targeted")
    parameters: Dict[str, Any] = Field(default_factory=dict, description="Action parameters (e.g. alternate route or warehouse)")
    description: str = Field(default="", description="Human-readable explanation of intervention")


# ==========================================
# Candidate Routes & Affected Entities
# ==========================================

class CandidateRoute(BaseModel):
    path: List[int] = Field(default_factory=list, description="Ordered sequence of node IDs")
    distance_km: float = Field(..., ge=0.0)
    travel_time_hours: float = Field(..., ge=0.0)
    risk: float = Field(default=0.0, ge=0.0)
    fuel_cost: float = Field(default=0.0, ge=0.0)
    transport_cost: float = Field(default=0.0, ge=0.0)
    carbon_kg: float = Field(default=0.0, ge=0.0)
    is_feasible: bool = Field(default=True)
    explanation: str = Field(default="Feasible route discovered")


class AffectedShipment(BaseModel):
    shipment_id: str
    order_id: str
    origin_id: str
    destination_id: str
    origin_node: int
    destination_node: int
    current_route: List[int]
    is_route_invalid: bool
    candidate_routes: List[CandidateRoute] = Field(default_factory=list)
    assigned_vehicle_id: Optional[str] = None
    status: str = Field(default="AFFECTED")
    invalidation_reason: Optional[str] = None


class CandidateAlternateWarehouse(BaseModel):
    warehouse_id: str
    sku: str
    available_stock: float
    safety_stock: float
    can_fulfill: bool


class AffectedWarehouseInventory(BaseModel):
    warehouse_id: str
    sku: str
    current_stock: float
    reserved_stock: float
    available_stock: float
    safety_stock: float
    candidate_alternate_warehouses: List[CandidateAlternateWarehouse] = Field(default_factory=list)


# ==========================================
# Baseline Metrics & Recovery Problem
# ==========================================

class BaselineRecoveryMetrics(BaseModel):
    total_travel_time: float
    total_distance: float
    transport_cost: float
    risk: float
    fuel_cost: float
    carbon: float
    affected_shipments_count: int
    affected_orders_count: int
    affected_customers_count: int
    affected_warehouses_count: int
    affected_suppliers_count: int
    disrupted_links_count: int


class RecoveryProblem(BaseModel):
    problem_id: str = Field(default_factory=lambda: f"prob-{uuid.uuid4().hex[:8]}")
    scenario_id: str
    disruption_ids: List[str] = Field(default_factory=list)
    affected_shipments: List[AffectedShipment] = Field(default_factory=list)
    affected_orders: List[str] = Field(default_factory=list)
    affected_warehouses: List[str] = Field(default_factory=list)
    affected_customers: List[str] = Field(default_factory=list)
    affected_suppliers: List[str] = Field(default_factory=list)
    affected_links: List[Tuple[int, int]] = Field(default_factory=list)
    affected_inventory: List[AffectedWarehouseInventory] = Field(default_factory=list)
    candidate_actions: List[RecoveryAction] = Field(default_factory=list)
    objectives: List[RecoveryObjective] = Field(default_factory=list)
    constraints: List[RecoveryConstraint] = Field(default_factory=list)
    baseline_metrics: BaselineRecoveryMetrics
    is_feasible: bool = True
    feasibility_status: str = "FEASIBLE"
    explanation: str = "Recovery problem successfully formulated."


class ShipmentRecoveryResult(BaseModel):
    shipment_id: str
    original_route: List[int]
    optimized_route: List[int]
    route_changed: bool
    solver_used: str = Field(default="IQPSO", description="Solver producing the accepted route")
    fallback_used: bool = Field(default=False, description="Whether deterministic Dijkstra fallback was utilized")
    dijkstra_comparison: Optional[Dict[str, Any]] = Field(default=None, description="Metrics achieved by Dijkstra candidate")
    iqpso_comparison: Optional[Dict[str, Any]] = Field(default=None, description="Metrics achieved by IQPSO swarm search")
    baseline_metrics: Dict[str, Any] = Field(default_factory=dict, description="Metrics of original/disrupted path")
    optimized_metrics: Dict[str, Any] = Field(default_factory=dict, description="Metrics of selected recovery path")
    metric_delta: Dict[str, Any] = Field(default_factory=dict, description="Absolute and percentage changes in metrics")
    feasibility_status: str = Field(default="FEASIBLE", description="Route feasibility indicator")
    explanation: str = Field(default="", description="Human-readable decision explanation")


class InventoryReallocationResult(BaseModel):
    order_id: str
    sku: str
    original_warehouse_id: Optional[str] = None
    proposed_warehouse_id: Optional[str] = None
    requested_quantity: float
    allocated_quantity: float
    remaining_quantity: float
    allocation_changed: bool
    route: List[int] = Field(default_factory=list, description="Route from proposed warehouse node to customer node")
    route_feasible: bool = True
    baseline_metrics: Dict[str, Any] = Field(default_factory=dict)
    optimized_metrics: Dict[str, Any] = Field(default_factory=dict)
    metric_delta: Dict[str, Any] = Field(default_factory=dict)
    stockout_before: float = 0.0
    stockout_after: float = 0.0
    allocation_score: Optional[float] = None
    feasibility_status: str = Field(default="FEASIBLE", description="FEASIBLE, PARTIALLY_FEASIBLE, or INFEASIBLE")
    explanation: str = Field(default="")


class RecoveryPlan(BaseModel):
    plan_id: str = Field(default_factory=lambda: f"plan-{uuid.uuid4().hex[:8]}")
    scenario_id: str
    problem_id: str
    solver: str = Field(default="IQPSO", description="Algorithm used to optimize recovery routes")
    solver_execution_time: float = Field(default=0.0, description="Total optimizer run time in seconds")
    shipment_results: List[ShipmentRecoveryResult] = Field(default_factory=list, description="Per-shipment rerouting decisions and comparisons")
    inventory_reallocation_results: List[InventoryReallocationResult] = Field(default_factory=list, description="Per-order cross-warehouse reallocation decisions")
    actions: List[RecoveryAction] = Field(default_factory=list)
    affected_shipments: List[str] = Field(default_factory=list)
    affected_orders: List[str] = Field(default_factory=list)
    orders_fully_reallocated: int = Field(default=0)
    orders_partially_reallocated: int = Field(default=0)
    orders_infeasible: int = Field(default=0)
    total_requested_quantity: float = Field(default=0.0)
    total_allocated_quantity: float = Field(default=0.0)
    total_remaining_quantity: float = Field(default=0.0)
    baseline_metrics: Dict[str, Any] = Field(default_factory=dict)
    projected_metrics: Dict[str, Any] = Field(default_factory=dict)
    objective_score: Optional[float] = None
    feasibility_status: str = Field(default="FEASIBLE")
    is_committed: bool = Field(default=False, description="Whether this plan has been committed to scenario state")
    explanation: str = Field(default="Recovery plan successfully formulated.")


# ==========================================
# Commit and Rollback Models
# ==========================================

class ShipmentCommitRecord(BaseModel):
    shipment_id: str
    original_route: List[int]
    committed_route: List[int]
    original_status: str
    committed_status: str


class InventoryCommitRecord(BaseModel):
    warehouse_id: str
    sku: str
    quantity_before: float
    quantity_committed: float
    quantity_after: float
    reserved_before: float = 0.0
    reserved_after: float = 0.0
    available_before: float = 0.0
    available_after: float = 0.0


class OrderCommitRecord(BaseModel):
    order_id: str
    original_warehouse_id: Optional[str] = None
    committed_warehouse_id: Optional[str] = None
    original_status: str
    committed_status: str


class RecoveryCommitResult(BaseModel):
    commit_id: str = Field(default_factory=lambda: f"commit-{uuid.uuid4().hex[:8]}")
    plan_id: str
    scenario_id: str
    committed_at: float = Field(default_factory=time.time)
    snapshot_id: str
    success: bool = True
    status: str = Field(default="COMMITTED", description="COMMITTED, REJECTED, or FAILED_ROLLED_BACK")
    shipment_changes: List[ShipmentCommitRecord] = Field(default_factory=list)
    inventory_changes: List[InventoryCommitRecord] = Field(default_factory=list)
    order_changes: List[OrderCommitRecord] = Field(default_factory=list)
    created_shipments: List[str] = Field(default_factory=list)
    validation_errors: List[str] = Field(default_factory=list)
    rollback_available: bool = True
    explanation: str = Field(default="")


class RecoveryRollbackResult(BaseModel):
    rollback_id: str = Field(default_factory=lambda: f"rollback-{uuid.uuid4().hex[:8]}")
    scenario_id: str
    snapshot_id: str
    timestamp: float = Field(default_factory=time.time)
    success: bool = True
    restored_entities: Dict[str, int] = Field(default_factory=dict)
    explanation: str = Field(default="")

from pydantic import BaseModel, Field
from typing import Dict, Any, List, Optional, Tuple


class DisruptionCreateRequest(BaseModel):
    type: str = Field(..., description="Classification category (e.g. ROAD_CLOSURE, PORT_CLOSURE, SUPPLIER_FAILURE)")
    target_id: str = Field(..., min_length=1, description="Entity or link identifier targeted (e.g. '2-11', 'P1', 'S1', 'W1', 'V1')")
    severity: float = Field(default=0.8, ge=0.0, le=1.0, description="Severity ratio [0.0, 1.0]")
    start_time: float = Field(default=0.0, ge=0.0, description="Virtual hour timestamp when disruption begins")
    duration_hours: float = Field(default=24.0, gt=0.0, description="Duration in virtual hours (must be strictly positive)")
    description: Optional[str] = Field(default="", description="Human-readable context narrative")
    parameters: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Custom parameters (e.g. multiplier, spoof coords)")


class DisruptionResponse(BaseModel):
    id: str
    type: str
    target_id: str
    severity: float
    start_time: float
    duration_hours: float
    end_time: float
    description: str
    status: str
    parameters: Dict[str, Any]


class ImpactResponse(BaseModel):
    disruption_id: Optional[str] = None
    disruption_type: Optional[str] = None
    target_id: Optional[str] = None
    severity: Optional[float] = None
    affected_shipments: List[str]
    affected_orders: List[str]
    affected_warehouses: List[str]
    affected_customers: List[str]
    affected_suppliers: List[str]
    affected_links: List[Tuple[int, int]]
    impact_chain: Optional[List[str]] = None
    impact_chains: Optional[List[str]] = None
    active_disruptions_count: Optional[int] = None
    affected_shipments_count: Optional[int] = None
    affected_orders_count: Optional[int] = None
    affected_warehouses_count: Optional[int] = None
    affected_customers_count: Optional[int] = None
    affected_suppliers_count: Optional[int] = None
    affected_links_count: Optional[int] = None


class SimulationRequest(BaseModel):
    duration_hours: float = Field(default=24.0, gt=0.0, description="Total virtual duration to simulate in hours")
    step_hours: float = Field(default=6.0, gt=0.0, description="Interval step between snapshot observations in hours")


class SimulationStepResponse(BaseModel):
    step: int
    time: float
    elapsed_hours: float
    active_disruptions_count: int
    active_disruptions: List[str]
    affected_shipments_count: int
    affected_orders_count: int
    twin_summary: Dict[str, Any]


class SimulationResultResponse(BaseModel):
    scenario_id: str
    duration_hours: float
    step_hours: float
    total_steps: int
    timeline: List[SimulationStepResponse]

from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

class GraphGenerateRequestSchema(BaseModel):
    topology: str = Field("grid", description="Graph topology: 'grid', 'random', or 'scale_free'")
    size: int = Field(25, description="Size parameter (rows*cols for grid, number of nodes for random/scale_free)")
    spacing_km: Optional[float] = Field(0.5, description="Spacing between nodes in grid graph")

class ShortestPathRequestSchema(BaseModel):
    source: int = Field(..., description="Source node ID")
    target: int = Field(..., description="Target node ID")
    algorithm: str = Field("iqpso", description="Algorithm to run: 'pso', 'qpso', or 'iqpso'")
    swarm_size: int = Field(30, ge=5, le=200, description="Number of particles in swarm")
    iterations: int = Field(50, ge=10, le=500, description="Number of optimization iterations")
    weights: Optional[Dict[str, float]] = Field(None, description="Objective weights: travel_time, distance, congestion, risk")

class RouteMetricsSchema(BaseModel):
    travel_time: float
    distance: float
    congestion: float
    fuel_cost: float
    risk: float

class ShortestPathResponseSchema(BaseModel):
    algorithm: str
    path: List[int]
    metrics: RouteMetricsSchema
    fitness: float
    history: List[float]
    diversity: List[float]
    execution_time: float

class VrpRequestSchema(BaseModel):
    depot_id: int = Field(..., description="Depot node ID")
    customer_ids: List[int] = Field(..., description="List of customer node IDs")
    vehicle_capacity: float = Field(100.0, description="Cargo capacity of each vehicle")
    max_vehicles: int = Field(5, description="Maximum number of available fleet vehicles")
    swarm_size: int = Field(30, description="Swarm size")
    iterations: int = Field(50, description="Iterations")
    weights: Optional[Dict[str, float]] = Field(None, description="Objective weights: travel_time, distance, risk, vehicles_used")

class VrpRouteResponseSchema(BaseModel):
    routes: List[List[int]]
    metrics: Dict[str, float]
    fitness: float
    history: List[float]
    diversity: List[float]
    execution_time: float

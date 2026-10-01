from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

class BenchmarkRequestSchema(BaseModel):
    problem_type: str = Field("shortest_path", description="Problem type: 'shortest_path' or 'vrp'")
    
    # Shortest path specific
    source: Optional[int] = Field(None, description="Source node (for shortest path)")
    target: Optional[int] = Field(None, description="Target node (for shortest path)")
    
    # VRP specific
    depot_id: Optional[int] = Field(None, description="Depot node (for VRP)")
    customer_ids: Optional[List[int]] = Field(None, description="Customer node IDs (for VRP)")
    vehicle_capacity: Optional[float] = Field(100.0, description="Vehicle capacity (for VRP)")
    max_vehicles: Optional[int] = Field(5, description="Max vehicles (for VRP)")
    
    # Common tuning
    swarm_size: int = Field(30, description="Swarm size for all solvers")
    iterations: int = Field(50, description="Iterations for all solvers")
    runs: int = Field(5, description="Number of independent runs to gather stats")
    weights: Optional[Dict[str, float]] = Field(None, description="Fitness weights configuration")

class StatTestResultSchema(BaseModel):
    u_statistic: float
    p_value: float
    significant: bool
    message: str

class AlgSummarySchema(BaseModel):
    mean_fitness: float
    best_fitness: float
    worst_fitness: float
    std_fitness: float
    mean_runtime_sec: float
    mean_convergence_iter: float
    optimality_gap: Optional[float] = None

class BenchmarkResponseSchema(BaseModel):
    problem_type: str
    dijkstra: Optional[Dict[str, Any]] = None # Contains Dijkstra path/metrics
    exact_optimum: Optional[Dict[str, Any]] = None # Contains Brute force routes/metrics
    summary: Dict[str, AlgSummarySchema]
    best_routes: Dict[str, Any] # Contains best paths or routes for PSO, QPSO, IQPSO
    histories: Dict[str, List[List[float]]] # Convergence histories
    diversity: Dict[str, List[List[float]]] # Diversity histories
    statistical_tests: Dict[str, StatTestResultSchema]

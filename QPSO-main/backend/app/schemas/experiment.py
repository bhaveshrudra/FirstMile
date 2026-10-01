from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

class ExperimentRequestSchema(BaseModel):
    problem_type: str = Field("vrp", description="Problem: 'shortest_path' or 'vrp'")
    algorithm: str = Field("iqpso", description="Optimizer to benchmark: 'pso', 'qpso', or 'iqpso'")
    swarm_size: int = Field(30, description="Optimizer swarm size")
    iterations: int = Field(50, description="Optimizer iterations")
    runs: int = Field(5, description="Stochastic run count")
    seed: int = Field(42, description="Base seed for reproducibility")
    
    # Optional parameters for custom networks
    node_sizes: List[int] = Field([10, 25, 50, 100], description="Scale of graph nodes to test")

class ScalabilityResultEntry(BaseModel):
    num_customers: int
    mean_fitness: float
    best_fitness: float
    mean_runtime_sec: float
    success_rate: float
    violations: int

class ScalabilityResponseSchema(BaseModel):
    problem_type: str
    results: List[ScalabilityResultEntry]

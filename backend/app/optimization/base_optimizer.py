from abc import ABC, abstractmethod
import numpy as np
import time
from typing import Callable, List, Dict, Any, Tuple, Optional

class BaseOptimizer(ABC):
    """
    Abstract base class for swarm intelligence route optimization solvers.
    Manages common variables (swarm size, search bounds, history logs) and metrics.
    """
    def __init__(self, swarm_size: int, iterations: int, dimensions: int, 
                 lower_bound: float = -10.0, upper_bound: float = 10.0):
        self.swarm_size = swarm_size
        self.iterations = iterations
        self.dimensions = dimensions
        self.lb = lower_bound
        self.ub = upper_bound
        
        # Performance logging
        self.gbest_history: List[float] = []
        self.diversity_history: List[float] = []
        self.execution_time: float = 0.0
        
        # Position states
        self.X: np.ndarray = np.zeros((self.swarm_size, self.dimensions))
        self.pbest: np.ndarray = np.zeros((self.swarm_size, self.dimensions))
        self.pbest_fit: np.ndarray = np.full(self.swarm_size, np.inf)
        
        self.gbest: np.ndarray = np.zeros(self.dimensions)
        self.gbest_fit: float = np.inf

    def initialize_swarm(self, seed: Optional[int] = None):
        """Initializes particle positions uniformly within bounds."""
        if seed is not None:
            np.random.seed(seed)
        self.X = np.random.uniform(self.lb, self.ub, (self.swarm_size, self.dimensions))
        self.pbest = self.X.copy()
        self.pbest_fit = np.full(self.swarm_size, np.inf)
        self.gbest = np.zeros(self.dimensions)
        self.gbest_fit = np.inf
        
        self.gbest_history = []
        self.diversity_history = []
        self.execution_time = 0.0

    def compute_diversity(self) -> float:
        """
        Computes swarm diversity as the average Euclidean distance to the swarm centroid.
        D = 1/(M*L) * sum(||x_i - mean_x||)
        Used for analysis and adaptive parameters.
        """
        centroid = np.mean(self.X, axis=0)
        distances = np.sqrt(np.sum((self.X - centroid) ** 2, axis=1))
        avg_dist = np.mean(distances)
        
        # Normalize by diagonal of search space
        diagonal = np.sqrt(self.dimensions) * (self.ub - self.lb)
        return avg_dist / (diagonal + 1e-6)

    @abstractmethod
    def solve(self, fitness_fn: Callable[[np.ndarray], float], 
              callback: Optional[Callable[[int, np.ndarray, float], None]] = None) -> Tuple[np.ndarray, float]:
        """
        Runs the optimization loop.
        Returns (best_position, best_fitness).
        """
        pass

    def get_history(self) -> Dict[str, Any]:
        """Returns the history of the run for visualization and statistical analysis."""
        return {
            "gbest_history": self.gbest_history,
            "diversity_history": self.diversity_history,
            "execution_time": self.execution_time,
            "iterations": len(self.gbest_history),
            "final_fitness": self.gbest_fit
        }

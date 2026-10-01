import numpy as np
import time
from typing import Callable, Tuple, Optional
from .base_optimizer import BaseOptimizer

class ClassicalPSO(BaseOptimizer):
    """
    Classical Particle Swarm Optimization (PSO) solver.
    Supports fixed or linearly decaying inertia weight schedules.
    """
    def __init__(self, swarm_size: int, iterations: int, dimensions: int,
                 lower_bound: float = -10.0, upper_bound: float = 10.0,
                 c1: float = 2.0, c2: float = 2.0, 
                 inertia_schedule: str = "linear", w_fixed: float = 0.7,
                 w_start: float = 0.9, w_end: float = 0.4):
        super().__init__(swarm_size, iterations, dimensions, lower_bound, upper_bound)
        self.c1 = c1
        self.c2 = c2
        self.inertia_schedule = inertia_schedule
        self.w_fixed = w_fixed
        self.w_start = w_start
        self.w_end = w_end
        
        self.v_max = 0.2 * (self.ub - self.lb)
        self.v_min = -self.v_max
        self.V: np.ndarray = np.zeros((self.swarm_size, self.dimensions))

    def solve(self, fitness_fn: Callable[[np.ndarray], float],
              callback: Optional[Callable[[int, np.ndarray, float], None]] = None) -> Tuple[np.ndarray, float]:
        """Runs the PSO optimization process."""
        start_time = time.time()
        
        self.initialize_swarm()
        self.V = np.random.uniform(self.v_min, self.v_max, (self.swarm_size, self.dimensions))
        
        # Evaluate initial fitness
        for i in range(self.swarm_size):
            fit = fitness_fn(self.X[i])
            self.pbest_fit[i] = fit
            if fit < self.gbest_fit:
                self.gbest_fit = fit
                self.gbest = self.X[i].copy()
                
        self.gbest_history.append(self.gbest_fit)
        self.diversity_history.append(self.compute_diversity())
        
        # Main loop
        for t in range(self.iterations):
            # Compute inertia weight w
            if self.inertia_schedule == "linear":
                w = self.w_start - ((self.w_start - self.w_end) * (t / self.iterations))
            else:
                w = self.w_fixed
            
            for i in range(self.swarm_size):
                r1 = np.random.rand(self.dimensions)
                r2 = np.random.rand(self.dimensions)
                
                # Update velocity
                cognitive = self.c1 * r1 * (self.pbest[i] - self.X[i])
                social = self.c2 * r2 * (self.gbest - self.X[i])
                self.V[i] = w * self.V[i] + cognitive + social
                
                # Clamp velocity
                self.V[i] = np.clip(self.V[i], self.v_min, self.v_max)
                
                # Update position
                self.X[i] = self.X[i] + self.V[i]
                self.X[i] = np.clip(self.X[i], self.lb, self.ub)
                
                # Evaluate fitness
                fit = fitness_fn(self.X[i])
                
                if fit < self.pbest_fit[i]:
                    self.pbest_fit[i] = fit
                    self.pbest[i] = self.X[i].copy()
                    
                    if fit < self.gbest_fit:
                        self.gbest_fit = fit
                        self.gbest = self.X[i].copy()
            
            # Log metrics
            self.gbest_history.append(self.gbest_fit)
            self.diversity_history.append(self.compute_diversity())
            
            if callback is not None:
                callback(t, self.gbest, self.gbest_fit)
                
        self.execution_time = time.time() - start_time
        return self.gbest, self.gbest_fit

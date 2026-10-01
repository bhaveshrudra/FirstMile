import numpy as np
import time
from typing import Callable, Tuple, Optional
from .base_optimizer import BaseOptimizer

class BasicQPSO(BaseOptimizer):
    """
    Standard Quantum-behaved Particle Swarm Optimization (QPSO) solver.
    Operates without velocity, updating positions based on a delta potential well.
    Supports configurable alpha schedules (Fixed, Linear decay).
    """
    def __init__(self, swarm_size: int, iterations: int, dimensions: int,
                 lower_bound: float = -10.0, upper_bound: float = 10.0,
                 alpha_schedule: str = "linear", alpha_init: float = 1.0, 
                 alpha_min: float = 0.5, alpha_max: float = 1.0):
        super().__init__(swarm_size, iterations, dimensions, lower_bound, upper_bound)
        self.alpha_schedule = alpha_schedule
        self.alpha_init = alpha_init
        self.alpha_min = alpha_min
        self.alpha_max = alpha_max
        self.alpha = alpha_init

    def solve(self, fitness_fn: Callable[[np.ndarray], float],
              callback: Optional[Callable[[int, np.ndarray, float], None]] = None) -> Tuple[np.ndarray, float]:
        """Runs the standard QPSO optimization process."""
        start_time = time.time()
        
        self.initialize_swarm()
        
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
            # 1. Update alpha based on configured schedule
            if self.self_decay_needed(t):
                # Linear decay
                self.alpha = self.alpha_max - (t / self.iterations) * (self.alpha_max - self.alpha_min)
            else:
                # Fixed
                self.alpha = self.alpha_init
                
            # 2. Compute Mean Best Position (mbest)
            mbest = np.mean(self.pbest, axis=0)
            
            # Update position
            for i in range(self.swarm_size):
                phi = np.random.rand(self.dimensions)
                p = phi * self.pbest[i] + (1.0 - phi) * self.gbest
                
                u = np.random.rand(self.dimensions)
                sign = np.where(np.random.rand(self.dimensions) < 0.5, 1.0, -1.0)
                
                self.X[i] = p + sign * self.alpha * np.abs(mbest - self.X[i]) * np.log(1.0 / (u + 1e-15))
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

    def self_decay_needed(self, t: int) -> bool:
        return self.alpha_schedule == "linear"

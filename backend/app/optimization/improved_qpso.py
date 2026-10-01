import numpy as np
import time
from typing import Callable, Tuple, Optional, List
from .base_optimizer import BaseOptimizer
from .operators import SearchOperator, AdaptiveAlphaOperator, CauchyMutationOperator

class ImprovedQPSO(BaseOptimizer):
    """
    Proposed/Improved Quantum-behaved Particle Swarm Optimization (IQPSO) solver.
    Driven by a pluggable, modular search operator framework to balance exploration and exploitation.
    """
    def __init__(self, swarm_size: int, iterations: int, dimensions: int,
                 lower_bound: float = -10.0, upper_bound: float = 10.0,
                 alpha_init: float = 1.0, operators: Optional[List[SearchOperator]] = None):
        super().__init__(swarm_size, iterations, dimensions, lower_bound, upper_bound)
        self.alpha = alpha_init
        
        # Load pluggable operators
        if operators is None:
            self.operators = [
                AdaptiveAlphaOperator(alpha_min=0.3, alpha_max=1.3),
                CauchyMutationOperator(stagnation_threshold=5, mutation_scale=0.05)
            ]
        else:
            self.operators = operators
            
        self.stagnant_count = 0
        self.alpha_history = []

    def solve(self, fitness_fn: Callable[[np.ndarray], float],
              callback: Optional[Callable[[int, np.ndarray, float], None]] = None) -> Tuple[np.ndarray, float]:
        """Runs the Improved QPSO process using pluggable search operators."""
        start_time = time.time()
        
        self.initialize_swarm()
        self.stagnant_count = 0
        self.alpha_history = []
        
        # Evaluate initial fitness
        for i in range(self.swarm_size):
            fit = fitness_fn(self.X[i])
            self.pbest_fit[i] = fit
            if fit < self.gbest_fit:
                self.gbest_fit = fit
                self.gbest = self.X[i].copy()
                
        self.gbest_history.append(self.gbest_fit)
        
        current_diversity = self.compute_diversity()
        self.diversity_history.append(current_diversity)
        self.alpha_history.append(self.alpha)
        
        d0 = max(0.01, current_diversity)
        
        # Main loop
        for t in range(self.iterations):
            previous_best = self.gbest_fit
            
            # Compute Mean Best Position (mbest)
            mbest = np.mean(self.pbest, axis=0)
            
            # Update Swarm Diversity
            current_diversity = self.compute_diversity()
            
            # Run pluggable operator pipeline
            meta_params = {
                "alpha": self.alpha,
                "initial_diversity": d0,
                "stagnant_count": self.stagnant_count,
                "lower_bound": self.lb,
                "upper_bound": self.ub,
                "fitness_fn": fitness_fn
            }
            
            for op in self.operators:
                updates = op.apply(
                    X=self.X, pbest=self.pbest, gbest=self.gbest, mbest=mbest,
                    current_iteration=t, max_iterations=self.iterations,
                    diversity=current_diversity, fitness_history=self.gbest_history,
                    meta_params=meta_params
                )
                
                # Apply updates from operator
                if "alpha" in updates:
                    self.alpha = updates["alpha"]
                    meta_params["alpha"] = self.alpha
                if "gbest" in updates:
                    self.gbest = updates["gbest"]
                if "gbest_fit" in updates:
                    self.gbest_fit = updates["gbest_fit"]
                if "stagnant_count" in updates:
                    self.stagnant_count = updates["stagnant_count"]
                    meta_params["stagnant_count"] = self.stagnant_count
            
            self.alpha_history.append(self.alpha)
            
            # Update Particle Positions
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
            
            # Check stagnation count if it wasn't reset by Cauchy mutations
            if self.gbest_fit >= previous_best:
                self.stagnant_count += 1
            else:
                self.stagnant_count = 0
                
            self.gbest_history.append(self.gbest_fit)
            self.diversity_history.append(self.compute_diversity())
            
            if callback is not None:
                callback(t, self.gbest, self.gbest_fit)
                
        self.execution_time = time.time() - start_time
        return self.gbest, self.gbest_fit

    def get_history(self) -> dict:
        hist = super().get_history()
        hist["alpha_history"] = self.alpha_history
        return hist

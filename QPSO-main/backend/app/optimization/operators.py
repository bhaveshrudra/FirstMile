from abc import ABC, abstractmethod
import numpy as np
from typing import Dict, Any, List

class SearchOperator(ABC):
    """
    Abstract base class for plugging mathematical operators into metaheuristics.
    Allows dynamic parameter adjustment, mutational searches, or route repairs.
    """
    @abstractmethod
    def apply(self, X: np.ndarray, pbest: np.ndarray, gbest: np.ndarray, 
              mbest: np.ndarray, current_iteration: int, max_iterations: int, 
              diversity: float, fitness_history: List[float], 
              meta_params: Dict[str, Any]) -> Dict[str, Any]:
        """
        Executes the operator logic. Returns a dictionary of updated state variables.
        """
        pass

class AdaptiveAlphaOperator(SearchOperator):
    """
    Adapts the QPSO contraction-expansion coefficient (alpha) 
    dynamically based on the swarm's spatial diversity.
    """
    def __init__(self, alpha_min: float = 0.3, alpha_max: float = 1.3):
        self.alpha_min = alpha_min
        self.alpha_max = alpha_max

    def apply(self, X: np.ndarray, pbest: np.ndarray, gbest: np.ndarray, 
              mbest: np.ndarray, current_iteration: int, max_iterations: int, 
              diversity: float, fitness_history: List[float], 
              meta_params: Dict[str, Any]) -> Dict[str, Any]:
        
        current_alpha = meta_params.get("alpha", 1.0)
        d0 = meta_params.get("initial_diversity", 0.1)
        decay_rate = 3.5 / max_iterations
        
        # Exponential target decay path
        target_diversity = d0 * np.exp(-decay_rate * current_iteration)
        
        # Feedback adjustment
        if diversity < target_diversity:
            # Swarm is collapsing too fast - increase exploration radius
            new_alpha = min(self.alpha_max, current_alpha * 1.05)
        else:
            # Swarm is highly diverse - decrease alpha to focus exploitation
            new_alpha = max(self.alpha_min, current_alpha * 0.95)
            
        return {"alpha": new_alpha}

class CauchyMutationOperator(SearchOperator):
    """
    Perturbs the global best position using a Cauchy distribution 
    if the swarm experiences stagnation (no fitness improvements).
    """
    def __init__(self, stagnation_threshold: int = 5, mutation_scale: float = 0.05):
        self.stagnation_threshold = stagnation_threshold
        self.mutation_scale = mutation_scale

    def apply(self, X: np.ndarray, pbest: np.ndarray, gbest: np.ndarray, 
              mbest: np.ndarray, current_iteration: int, max_iterations: int, 
              diversity: float, fitness_history: List[float], 
              meta_params: Dict[str, Any]) -> Dict[str, Any]:
        
        stagnant_count = meta_params.get("stagnant_count", 0)
        lb = meta_params.get("lower_bound", -5.0)
        ub = meta_params.get("upper_bound", 5.0)
        fitness_fn = meta_params.get("fitness_fn")
        
        # Check if we should trigger mutation
        if stagnant_count >= self.stagnation_threshold and fitness_fn is not None:
            # Cauchy mutation step size scales down over time
            step_size = self.mutation_scale * (1.0 - (current_iteration / max_iterations)) * (ub - lb)
            cauchy_noise = np.random.standard_cauchy(len(gbest))
            
            mutated_gbest = gbest + step_size * cauchy_noise
            mutated_gbest = np.clip(mutated_gbest, lb, ub)
            
            # Evaluate mutation
            gbest_fit = fitness_fn(gbest)
            mutated_fit = fitness_fn(mutated_gbest)
            
            if mutated_fit < gbest_fit:
                return {
                    "gbest": mutated_gbest, 
                    "gbest_fit": mutated_fit,
                    "stagnant_count": 0  # reset stagnation
                }
                
        return {}

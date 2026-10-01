from typing import List, Dict, Any
import numpy as np

def calculate_vrp_fleet_utilization(routes: List[List[int]], demands: Dict[int, float], 
                                    capacity: float) -> Dict[str, float]:
    """
    Computes capacity utilization statistics for a VRP vehicle fleet.
    """
    if not routes:
        return {"avg_utilization": 0.0, "min_utilization": 0.0, "max_utilization": 0.0}
        
    loads = []
    for r in routes:
        route_load = sum(demands.get(c, 0.0) for c in r)
        loads.append(route_load)
        
    utilizations = [l / capacity for l in loads]
    
    return {
        "avg_utilization": float(np.mean(utilizations)),
        "min_utilization": float(np.min(utilizations)),
        "max_utilization": float(np.max(utilizations)),
        "std_utilization": float(np.std(utilizations))
    }


def calculate_convergence_speed(history: List[float], threshold_pct: float = 0.05) -> int:
    """
    Calculates the iteration number at which the fitness was within 
    threshold_pct of the final fitness (representing the point of convergence).
    """
    if not history:
        return 0
    final_val = history[-1]
    init_val = history[0]
    total_improvement = init_val - final_val
    
    if total_improvement <= 0:
        return 0
        
    threshold = final_val + threshold_pct * total_improvement
    
    for idx, val in enumerate(history):
        if val <= threshold:
            return idx
            
    return len(history) - 1


def summarize_run_history(histories: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Aggregates metrics over multiple independent runs of an algorithm.
    Used to measure robustness and statistical variability.
    """
    final_fitness_vals = [h["final_fitness"] for h in histories]
    runtimes = [h["execution_time"] for h in histories]
    convergence_iters = [calculate_convergence_speed(h["gbest_history"]) for h in histories]
    
    return {
        "mean_fitness": float(np.mean(final_fitness_vals)),
        "best_fitness": float(np.min(final_fitness_vals)),
        "worst_fitness": float(np.max(final_fitness_vals)),
        "std_fitness": float(np.std(final_fitness_vals)),
        "mean_runtime_sec": float(np.mean(runtimes)),
        "mean_convergence_iter": float(np.mean(convergence_iters))
    }

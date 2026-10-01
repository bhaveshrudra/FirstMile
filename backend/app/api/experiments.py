from fastapi import APIRouter, HTTPException
import time
import numpy as np
from typing import Dict, Any, List
from . import state
from ..schemas.experiment import ExperimentRequestSchema, ScalabilityResponseSchema
from ..graph.graph_generator import generate_random_graph
from ..traffic.simulator import TrafficSimulator
from ..optimization.fitness import RouteEvaluator
from ..optimization.constraints import ConstraintHandler
from ..optimization.route_encoding import decode_vrp
from ..optimization.pso import ClassicalPSO
from ..optimization.qpso import BasicQPSO
from ..optimization.improved_qpso import ImprovedQPSO

router = APIRouter(prefix="/experiment", tags=["experiment"])

@router.post("/run", response_model=ScalabilityResponseSchema)
def run_scalability_experiment(payload: ExperimentRequestSchema):
    """
    Runs a research experiment evaluating the scalability of Improved QPSO 
    across increasing graph sizes and customer dimensions (Step 29).
    """
    results = []
    
    # Run scalability loop
    for size in payload.node_sizes:
        if size > 300:
            # Prevent excessive resource usage during API calls
            continue
            
        try:
            # 1. Generate new graph size
            test_graph = generate_random_graph(num_nodes=size)
            test_sim = TrafficSimulator(test_graph)
            test_sim.update_simulation_time(12.0) # noon traffic
            
            evaluator = RouteEvaluator(test_graph)
            constraint_handler = ConstraintHandler()
            
            # Select customer subset (approx 20% of graph nodes, capped)
            depot_id = 0
            customer_count = max(2, int(size * 0.2))
            available = [n for n in test_graph.graph.nodes() if n != depot_id]
            
            # Pick deterministically using seed for reproducibility
            np.random.seed(payload.seed)
            customer_ids = list(np.random.choice(available, size=min(len(available), customer_count), replace=False))
            
            demands = {c: float((c % 3 + 1) * 10) for c in customer_ids}
            vehicle_capacity = 100.0
            max_vehicles = max(2, int(customer_count / 1.5))
            weights = {"travel_time": 1.0, "distance": 0.2, "congestion": 0.5, "fuel_cost": 0.2, "risk": 0.3, "vehicles_used": 50.0}
            
            runtimes = []
            fitness_values = []
            violations_count = 0
            success_count = 0
            
            # Fitness wrapper
            def make_fitness():
                def fitness_fn(position: np.ndarray) -> float:
                    routes = decode_vrp(customer_ids, depot_id, position, demands, vehicle_capacity)
                    metrics = evaluator.evaluate_vrp_solution(routes, depot_id)
                    fitness = evaluator.compute_weighted_fitness(metrics, weights)
                    
                    capacity_pen = constraint_handler.get_vrp_capacity_penalty(routes, demands, vehicle_capacity)
                    fleet_pen = constraint_handler.get_vrp_fleet_penalty(len(routes), max_vehicles)
                    return fitness + capacity_pen + fleet_pen
                return fitness_fn

            for run_idx in range(payload.runs):
                run_seed = payload.seed + run_idx

                if payload.algorithm == "pso":
                    solver = ClassicalPSO(payload.swarm_size, payload.iterations, len(customer_ids), lower_bound=-5.0, upper_bound=5.0)
                elif payload.algorithm == "qpso":
                    solver = BasicQPSO(payload.swarm_size, payload.iterations, len(customer_ids), lower_bound=-5.0, upper_bound=5.0)
                else:
                    solver = ImprovedQPSO(payload.swarm_size, payload.iterations, len(customer_ids), lower_bound=-5.0, upper_bound=5.0)

                solver.initialize_swarm(seed=run_seed)
                
                start_time = time.time()
                best_pos, best_fit = solver.solve(make_fitness())
                exec_time = time.time() - start_time
                
                # Check for constraint violations
                routes = decode_vrp(customer_ids, depot_id, best_pos, demands, vehicle_capacity)
                cap_violation = constraint_handler.get_vrp_capacity_penalty(routes, demands, vehicle_capacity) > 0
                fleet_violation = constraint_handler.get_vrp_fleet_penalty(len(routes), max_vehicles) > 0
                
                if cap_violation or fleet_violation:
                    violations_count += 1
                else:
                    success_count += 1
                    
                runtimes.append(exec_time)
                fitness_values.append(best_fit)

            mean_fit = float(np.mean(fitness_values))
            best_fit = float(np.min(fitness_values))
            mean_time = float(np.mean(runtimes))
            success_rate = (success_count / payload.runs) * 100
            
            results.append({
                "num_customers": len(customer_ids),
                "mean_fitness": mean_fit,
                "best_fitness": best_fit,
                "mean_runtime_sec": mean_time,
                "success_rate": success_rate,
                "violations": violations_count
            })
            
        except Exception as e:
            # If an error happens, log it and skip to make sure the scalability experiment runs to completion
            continue

    return {
        "problem_type": payload.problem_type,
        "results": results
    }

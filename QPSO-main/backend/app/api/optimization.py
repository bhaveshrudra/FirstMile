from fastapi import APIRouter, HTTPException
import numpy as np
import time
from typing import Dict, Any, List
from . import state
from ..schemas.optimization import (
    GraphGenerateRequestSchema,
    ShortestPathRequestSchema,
    ShortestPathResponseSchema,
    VrpRequestSchema,
    VrpRouteResponseSchema
)
from ..graph.graph_generator import generate_grid_graph, generate_random_graph, generate_scale_free_graph
from ..traffic.simulator import TrafficSimulator
from ..optimization.fitness import RouteEvaluator
from ..optimization.constraints import ConstraintHandler
from ..optimization.route_encoding import decode_shortest_path, decode_vrp
from ..optimization.exact_solver import dijkstra_shortest_path
from ..optimization.pso import ClassicalPSO
from ..optimization.qpso import BasicQPSO
from ..optimization.improved_qpso import ImprovedQPSO

router = APIRouter(tags=["optimization"])

@router.get("/graph", response_model=Dict[str, Any])
def get_graph():
    """Gets the active road network graph representation."""
    return state.active_graph.to_dict()

@router.post("/graph/generate", response_model=Dict[str, Any])
def generate_new_graph(payload: GraphGenerateRequestSchema):
    """
    Generates a new active graph topology (grid, random, or scale-free) 
    and resets the simulator.
    """
    if payload.topology == "grid":
        side = int(np.sqrt(payload.size))
        side = max(3, side)
        state.active_graph = generate_grid_graph(
            rows=side, 
            cols=side, 
            spacing_km=payload.spacing_km or 0.5
        )
    elif payload.topology == "random":
        state.active_graph = generate_random_graph(num_nodes=payload.size)
    elif payload.topology == "scale_free":
        state.active_graph = generate_scale_free_graph(num_nodes=payload.size)
    else:
        raise HTTPException(status_code=400, detail="Invalid topology type. Choose 'grid', 'random', or 'scale_free'.")

    # Reset simulator
    state.active_simulator = TrafficSimulator(state.active_graph)
    state.active_simulator.update_simulation_time(12.0)
    
    return state.active_graph.to_dict()


@router.post("/optimize/shortest-path", response_model=ShortestPathResponseSchema)
def run_shortest_path(payload: ShortestPathRequestSchema):
    """
    Calculates the optimal path from source to target using the selected algorithm (Dijkstra, PSO, QPSO, IQPSO).
    """
    g = state.active_graph.graph
    if not (g.has_node(payload.source) and g.has_node(payload.target)):
        raise HTTPException(status_code=400, detail="Source or Target node not found in graph.")

    evaluator = RouteEvaluator(state.active_graph)
    evaluator.clear_cache()
    constraint_handler = ConstraintHandler()
    num_nodes = g.number_of_nodes()
    
    weights = payload.weights or {"travel_time": 1.0, "distance": 0.2, "congestion": 0.5, "fuel_cost": 0.2, "risk": 0.3}

    # If Dijkstra is requested, solve directly
    if payload.algorithm == "dijkstra":
        start_time = time.time()
        path, metrics = dijkstra_shortest_path(state.active_graph, payload.source, payload.target)
        exec_time = time.time() - start_time
        fit_val = evaluator.compute_weighted_fitness(metrics, weights)
        
        return {
            "algorithm": "dijkstra",
            "path": path,
            "metrics": metrics,
            "fitness": fit_val,
            "history": [fit_val],
            "diversity": [0.0],
            "execution_time": exec_time
        }

    # Fitness function wrapper
    def fitness_fn(position: np.ndarray) -> float:
        path = decode_shortest_path(state.active_graph, payload.source, payload.target, position)
        
        is_native = True
        for idx in range(len(path) - 1):
            if not state.active_graph.graph.has_edge(path[idx], path[idx+1]):
                is_native = False
                break
        if path[-1] != payload.target:
            is_native = False
            
        metrics = evaluator.evaluate_path(path)
        fit_val = evaluator.compute_weighted_fitness(metrics, weights)
        penalty = constraint_handler.get_shortest_path_penalty(path, payload.target, is_native)
        return fit_val + penalty

    # Select Solver
    if payload.algorithm == "pso":
        solver = ClassicalPSO(payload.swarm_size, payload.iterations, num_nodes, lower_bound=-5.0, upper_bound=5.0)
    elif payload.algorithm == "qpso":
        solver = BasicQPSO(payload.swarm_size, payload.iterations, num_nodes, lower_bound=-5.0, upper_bound=5.0)
    elif payload.algorithm == "iqpso":
        solver = ImprovedQPSO(payload.swarm_size, payload.iterations, num_nodes, lower_bound=-5.0, upper_bound=5.0)
    else:
        raise HTTPException(status_code=400, detail="Unknown algorithm. Choose 'dijkstra', 'pso', 'qpso', or 'iqpso'.")

    best_pos, best_fit = solver.solve(fitness_fn)
    history = solver.get_history()

    final_path = decode_shortest_path(state.active_graph, payload.source, payload.target, best_pos)
    final_metrics = evaluator.evaluate_path(final_path)

    return {
        "algorithm": payload.algorithm,
        "path": final_path,
        "metrics": final_metrics,
        "fitness": history["final_fitness"],
        "history": history["gbest_history"],
        "diversity": history["diversity_history"],
        "execution_time": history["execution_time"]
    }


@router.post("/optimize/vrp", response_model=VrpRouteResponseSchema)
def run_vrp(payload: VrpRequestSchema):
    """
    Optimizes multi-vehicle routes using Improved QPSO.
    """
    g = state.active_graph.graph
    if not g.has_node(payload.depot_id):
        raise HTTPException(status_code=400, detail="Depot node not found.")
        
    for cust in payload.customer_ids:
        if not g.has_node(cust):
            raise HTTPException(status_code=400, detail=f"Customer node {cust} not found.")

    evaluator = RouteEvaluator(state.active_graph)
    evaluator.clear_cache()
    constraint_handler = ConstraintHandler()
    num_customers = len(payload.customer_ids)
    
    demands = {c: float((c % 3 + 1) * 10) for c in payload.customer_ids}
    weights = payload.weights or {"travel_time": 1.0, "distance": 0.2, "congestion": 0.5, "fuel_cost": 0.2, "risk": 0.3, "vehicles_used": 50.0}

    # Fitness function wrapper
    def fitness_fn(position: np.ndarray) -> float:
        routes = decode_vrp(payload.customer_ids, payload.depot_id, position, demands, payload.vehicle_capacity)
        metrics = evaluator.evaluate_vrp_solution(routes, payload.depot_id)
        fitness = evaluator.compute_weighted_fitness(metrics, weights)
        capacity_pen = constraint_handler.get_vrp_capacity_penalty(routes, demands, payload.vehicle_capacity)
        fleet_pen = constraint_handler.get_vrp_fleet_penalty(len(routes), payload.max_vehicles)
        return fitness + capacity_pen + fleet_pen

    solver = ImprovedQPSO(payload.swarm_size, payload.iterations, num_customers, lower_bound=-5.0, upper_bound=5.0)

    best_pos, best_fit = solver.solve(fitness_fn)
    history = solver.get_history()

    final_routes = decode_vrp(payload.customer_ids, payload.depot_id, best_pos, demands, payload.vehicle_capacity)
    final_metrics = evaluator.evaluate_vrp_solution(final_routes, payload.depot_id)

    return {
        "routes": final_routes,
        "metrics": final_metrics,
        "fitness": history["final_fitness"],
        "history": history["gbest_history"],
        "diversity": history["diversity_history"],
        "execution_time": history["execution_time"]
    }

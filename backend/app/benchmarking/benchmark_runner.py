import numpy as np
import time
from typing import Dict, Any, List, Tuple
from ..graph.graph_model import TrafficGraph
from ..optimization.fitness import RouteEvaluator
from ..optimization.constraints import ConstraintHandler
from ..optimization.route_encoding import decode_shortest_path, decode_vrp
from ..optimization.exact_solver import dijkstra_shortest_path, brute_force_vrp
from ..optimization.pso import ClassicalPSO
from ..optimization.qpso import BasicQPSO
from ..optimization.improved_qpso import ImprovedQPSO
from .metrics import summarize_run_history, calculate_vrp_fleet_utilization
from .statistical_tests import run_mann_whitney_u

class BenchmarkRunner:
    """
    Coordinates comparison benchmarks between Dijkstra, PSO, QPSO, and Improved QPSO.
    Integrates exact VRP baselines to calculate research optimality gaps.
    """
    def __init__(self, graph: TrafficGraph):
        self.graph = graph
        self.evaluator = RouteEvaluator(self.graph)
        self.constraint_handler = ConstraintHandler()

    def run_shortest_path_benchmark(self, source: int, target: int, 
                                    swarm_size: int = 30, iterations: int = 50, 
                                    runs: int = 5, weights: Dict[str, float] = None) -> Dict[str, Any]:
        """
        Runs PSO, QPSO, and IQPSO on a Shortest Path problem, and compares them against Dijkstra.
        """
        if weights is None:
            weights = {"travel_time": 1.0, "distance": 0.2, "congestion": 0.5, "fuel_cost": 0.2, "risk": 0.3}
            
        num_nodes = self.graph.graph.number_of_nodes()
        self.evaluator.clear_cache()
        
        # Calculate exact baseline path using custom Dijkstra
        dijkstra_path, dijkstra_metrics = dijkstra_shortest_path(self.graph, source, target)
        dijkstra_fit = self.evaluator.compute_weighted_fitness(dijkstra_metrics, weights)
        
        results = {
            "pso": [],
            "qpso": [],
            "iqpso": []
        }
        
        def make_sp_fitness():
            def fitness_fn(position: np.ndarray) -> float:
                path = decode_shortest_path(self.graph, source, target, position)
                
                is_native = True
                for idx in range(len(path) - 1):
                    if not self.graph.graph.has_edge(path[idx], path[idx+1]):
                        is_native = False
                        break
                if path[-1] != target:
                    is_native = False
                    
                metrics = self.evaluator.evaluate_path(path)
                fitness = self.evaluator.compute_weighted_fitness(metrics, weights)
                
                penalty = self.constraint_handler.get_shortest_path_penalty(path, target, is_native)
                return fitness + penalty
            return fitness_fn

        for run_idx in range(runs):
            # Seed the solver to support reproducibility
            seed = 42 + run_idx
            
            # PSO
            pso_solver = ClassicalPSO(swarm_size, iterations, num_nodes, lower_bound=-5.0, upper_bound=5.0)
            pso_solver.initialize_swarm(seed=seed)
            best_pos, best_fit = pso_solver.solve(make_sp_fitness())
            pso_hist = pso_solver.get_history()
            pso_path = decode_shortest_path(self.graph, source, target, best_pos)
            pso_metrics = self.evaluator.evaluate_path(pso_path)
            pso_hist["path"] = pso_path
            pso_hist["metrics"] = pso_metrics
            pso_hist["seed"] = seed
            results["pso"].append(pso_hist)

            # QPSO
            qpso_solver = BasicQPSO(swarm_size, iterations, num_nodes, lower_bound=-5.0, upper_bound=5.0)
            qpso_solver.initialize_swarm(seed=seed)
            best_pos, best_fit = qpso_solver.solve(make_sp_fitness())
            qpso_hist = qpso_solver.get_history()
            qpso_path = decode_shortest_path(self.graph, source, target, best_pos)
            qpso_metrics = self.evaluator.evaluate_path(qpso_path)
            qpso_hist["path"] = qpso_path
            qpso_hist["metrics"] = qpso_metrics
            qpso_hist["seed"] = seed
            results["qpso"].append(qpso_hist)

            # Improved QPSO
            iqpso_solver = ImprovedQPSO(swarm_size, iterations, num_nodes, lower_bound=-5.0, upper_bound=5.0)
            iqpso_solver.initialize_swarm(seed=seed)
            best_pos, best_fit = iqpso_solver.solve(make_sp_fitness())
            iqpso_hist = iqpso_solver.get_history()
            iqpso_path = decode_shortest_path(self.graph, source, target, best_pos)
            iqpso_metrics = self.evaluator.evaluate_path(iqpso_path)
            iqpso_hist["path"] = iqpso_path
            iqpso_hist["metrics"] = iqpso_metrics
            iqpso_hist["seed"] = seed
            results["iqpso"].append(iqpso_hist)

        summary_pso = summarize_run_history(results["pso"])
        summary_qpso = summarize_run_history(results["qpso"])
        summary_iqpso = summarize_run_history(results["iqpso"])
        
        best_run_pso = min(results["pso"], key=lambda h: h["final_fitness"])
        best_run_qpso = min(results["qpso"], key=lambda h: h["final_fitness"])
        best_run_iqpso = min(results["iqpso"], key=lambda h: h["final_fitness"])

        pso_fits = [r["final_fitness"] for r in results["pso"]]
        qpso_fits = [r["final_fitness"] for r in results["qpso"]]
        iqpso_fits = [r["final_fitness"] for r in results["iqpso"]]
        
        stat_pso_vs_iqpso = run_mann_whitney_u(pso_fits, iqpso_fits, "PSO", "IQPSO")
        stat_qpso_vs_iqpso = run_mann_whitney_u(qpso_fits, iqpso_fits, "QPSO", "IQPSO")

        # Calculate optimality gap against Dijkstra (which is exact global optimum for static path)
        gap_pso = ((best_run_pso["final_fitness"] - dijkstra_fit) / dijkstra_fit * 100) if dijkstra_fit > 0 else 0.0
        gap_qpso = ((best_run_qpso["final_fitness"] - dijkstra_fit) / dijkstra_fit * 100) if dijkstra_fit > 0 else 0.0
        gap_iqpso = ((best_run_iqpso["final_fitness"] - dijkstra_fit) / dijkstra_fit * 100) if dijkstra_fit > 0 else 0.0

        return {
            "dijkstra": {
                "path": dijkstra_path,
                "metrics": dijkstra_metrics,
                "fitness": dijkstra_fit
            },
            "summary": {
                "pso": {**summary_pso, "optimality_gap": float(gap_pso)},
                "qpso": {**summary_qpso, "optimality_gap": float(gap_qpso)},
                "iqpso": {**summary_iqpso, "optimality_gap": float(gap_iqpso)}
            },
            "best_routes": {
                "pso": {
                    "path": best_run_pso["path"],
                    "metrics": best_run_pso["metrics"],
                    "fitness": best_run_pso["final_fitness"]
                },
                "qpso": {
                    "path": best_run_qpso["path"],
                    "metrics": best_run_qpso["metrics"],
                    "fitness": best_run_qpso["final_fitness"]
                },
                "iqpso": {
                    "path": best_run_iqpso["path"],
                    "metrics": best_run_iqpso["metrics"],
                    "fitness": best_run_iqpso["final_fitness"]
                }
            },
            "histories": {
                "pso": [h["gbest_history"] for h in results["pso"]],
                "qpso": [h["gbest_history"] for h in results["qpso"]],
                "iqpso": [h["gbest_history"] for h in results["iqpso"]]
            },
            "diversity": {
                "pso": [h["diversity_history"] for h in results["pso"]],
                "qpso": [h["diversity_history"] for h in results["qpso"]],
                "iqpso": [h["diversity_history"] for h in results["iqpso"]]
            },
            "statistical_tests": {
                "pso_vs_iqpso": stat_pso_vs_iqpso,
                "qpso_vs_iqpso": stat_qpso_vs_iqpso
            }
        }

    def run_vrp_benchmark(self, customer_ids: List[int], depot_id: int, 
                          demands: Dict[int, float], vehicle_capacity: float, max_vehicles: int,
                          swarm_size: int = 30, iterations: int = 50, 
                          runs: int = 5, weights: Dict[str, float] = None) -> Dict[str, Any]:
        """
        Runs PSO, QPSO, and IQPSO on a Vehicle Routing Problem and compares them against the Brute Force exact solver.
        """
        if weights is None:
            weights = {"travel_time": 1.0, "distance": 0.2, "congestion": 0.5, "fuel_cost": 0.2, "risk": 0.3, "vehicles_used": 50.0}
            
        num_customers = len(customer_ids)
        self.evaluator.clear_cache()
        
        # Calculate exact baseline routes if customer size is small (<= 5)
        exact_opt_routes = []
        exact_opt_fit = 0.0
        exact_opt_metrics = {}
        has_exact = num_customers <= 5
        
        if has_exact:
            exact_opt_routes, exact_opt_fit, exact_opt_metrics = brute_force_vrp(
                graph=self.graph,
                customer_ids=customer_ids,
                depot_id=depot_id,
                demands=demands,
                vehicle_capacity=vehicle_capacity,
                max_vehicles=max_vehicles,
                weights=weights
            )
            
        results = {
            "pso": [],
            "qpso": [],
            "iqpso": []
        }
        
        def make_vrp_fitness():
            def fitness_fn(position: np.ndarray) -> float:
                routes = decode_vrp(customer_ids, depot_id, position, demands, vehicle_capacity)
                metrics = self.evaluator.evaluate_vrp_solution(routes, depot_id)
                fitness = self.evaluator.compute_weighted_fitness(metrics, weights)
                
                # Apply capacity penalties
                capacity_pen = self.constraint_handler.get_vrp_capacity_penalty(routes, demands, vehicle_capacity)
                fleet_pen = self.constraint_handler.get_vrp_fleet_penalty(len(routes), max_vehicles)
                return fitness + capacity_pen + fleet_pen
            return fitness_fn

        for run_idx in range(runs):
            seed = 42 + run_idx
            
            # PSO
            pso_solver = ClassicalPSO(swarm_size, iterations, num_customers, lower_bound=-5.0, upper_bound=5.0)
            pso_solver.initialize_swarm(seed=seed)
            best_pos, best_fit = pso_solver.solve(make_vrp_fitness())
            pso_hist = pso_solver.get_history()
            pso_routes = decode_vrp(customer_ids, depot_id, best_pos, demands, vehicle_capacity)
            pso_metrics = self.evaluator.evaluate_vrp_solution(pso_routes, depot_id)
            pso_util = calculate_vrp_fleet_utilization(pso_routes, demands, vehicle_capacity)
            pso_hist["routes"] = pso_routes
            pso_hist["metrics"] = {**pso_metrics, **pso_util}
            pso_hist["seed"] = seed
            results["pso"].append(pso_hist)

            # QPSO
            qpso_solver = BasicQPSO(swarm_size, iterations, num_customers, lower_bound=-5.0, upper_bound=5.0)
            qpso_solver.initialize_swarm(seed=seed)
            best_pos, best_fit = qpso_solver.solve(make_vrp_fitness())
            qpso_hist = qpso_solver.get_history()
            qpso_routes = decode_vrp(customer_ids, depot_id, best_pos, demands, vehicle_capacity)
            qpso_metrics = self.evaluator.evaluate_vrp_solution(qpso_routes, depot_id)
            qpso_util = calculate_vrp_fleet_utilization(qpso_routes, demands, vehicle_capacity)
            qpso_hist["routes"] = qpso_routes
            qpso_hist["metrics"] = {**qpso_metrics, **qpso_util}
            qpso_hist["seed"] = seed
            results["qpso"].append(qpso_hist)

            # Improved QPSO
            iqpso_solver = ImprovedQPSO(swarm_size, iterations, num_customers, lower_bound=-5.0, upper_bound=5.0)
            iqpso_solver.initialize_swarm(seed=seed)
            best_pos, best_fit = iqpso_solver.solve(make_vrp_fitness())
            iqpso_hist = iqpso_solver.get_history()
            iqpso_routes = decode_vrp(customer_ids, depot_id, best_pos, demands, vehicle_capacity)
            iqpso_metrics = self.evaluator.evaluate_vrp_solution(iqpso_routes, depot_id)
            iqpso_util = calculate_vrp_fleet_utilization(iqpso_routes, demands, vehicle_capacity)
            iqpso_hist["routes"] = iqpso_routes
            iqpso_hist["metrics"] = {**iqpso_metrics, **iqpso_util}
            iqpso_hist["seed"] = seed
            results["iqpso"].append(iqpso_hist)

        summary_pso = summarize_run_history(results["pso"])
        summary_qpso = summarize_run_history(results["qpso"])
        summary_iqpso = summarize_run_history(results["iqpso"])
        
        best_run_pso = min(results["pso"], key=lambda h: h["final_fitness"])
        best_run_qpso = min(results["qpso"], key=lambda h: h["final_fitness"])
        best_run_iqpso = min(results["iqpso"], key=lambda h: h["final_fitness"])

        pso_fits = [r["final_fitness"] for r in results["pso"]]
        qpso_fits = [r["final_fitness"] for r in results["qpso"]]
        iqpso_fits = [r["final_fitness"] for r in results["iqpso"]]
        
        stat_pso_vs_iqpso = run_mann_whitney_u(pso_fits, iqpso_fits, "PSO", "IQPSO")
        stat_qpso_vs_iqpso = run_mann_whitney_u(qpso_fits, iqpso_fits, "QPSO", "IQPSO")

        # Compile optimality gaps against exact brute force solver (if computed)
        gap_pso = 0.0
        gap_qpso = 0.0
        gap_iqpso = 0.0
        if has_exact and exact_opt_fit > 0:
            gap_pso = (best_run_pso["final_fitness"] - exact_opt_fit) / exact_opt_fit * 100
            gap_qpso = (best_run_qpso["final_fitness"] - exact_opt_fit) / exact_opt_fit * 100
            gap_iqpso = (best_run_iqpso["final_fitness"] - exact_opt_fit) / exact_opt_fit * 100

        output = {
            "summary": {
                "pso": {**summary_pso, "optimality_gap": float(gap_pso)},
                "qpso": {**summary_qpso, "optimality_gap": float(gap_qpso)},
                "iqpso": {**summary_iqpso, "optimality_gap": float(gap_iqpso)}
            },
            "best_routes": {
                "pso": {
                    "routes": best_run_pso["routes"],
                    "metrics": best_run_pso["metrics"],
                    "fitness": best_run_pso["final_fitness"]
                },
                "qpso": {
                    "routes": best_run_qpso["routes"],
                    "metrics": best_run_qpso["metrics"],
                    "fitness": best_run_qpso["final_fitness"]
                },
                "iqpso": {
                    "routes": best_run_iqpso["routes"],
                    "metrics": best_run_iqpso["metrics"],
                    "fitness": best_run_iqpso["final_fitness"]
                }
            },
            "histories": {
                "pso": [h["gbest_history"] for h in results["pso"]],
                "qpso": [h["gbest_history"] for h in results["qpso"]],
                "iqpso": [h["gbest_history"] for h in results["iqpso"]]
            },
            "diversity": {
                "pso": [h["diversity_history"] for h in results["pso"]],
                "qpso": [h["diversity_history"] for h in results["qpso"]],
                "iqpso": [h["diversity_history"] for h in results["iqpso"]]
            },
            "statistical_tests": {
                "pso_vs_iqpso": stat_pso_vs_iqpso,
                "qpso_vs_iqpso": stat_qpso_vs_iqpso
            }
        }
        
        if has_exact:
            output["exact_optimum"] = {
                "routes": exact_opt_routes,
                "fitness": exact_opt_fit,
                "metrics": exact_opt_metrics
            }
            
        return output

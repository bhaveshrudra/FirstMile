from typing import List, Dict, Any, Tuple
import numpy as np
from ..graph.graph_model import TrafficGraph
from .exact_solver import dijkstra_shortest_path

class RouteEvaluator:
    """
    Evaluates fitness for Shortest Path and VRP routes based on multiple objectives:
    - T: Travel Time (hours)
    - D: Distance (km)
    - C: Congestion (ratio flow/capacity or average Ce)
    - F: Fuel cost (calculated as function of distance and congestion)
    - R: Route risk (sum of active incidents severity)
    """
    def __init__(self, graph: TrafficGraph):
        self.graph = graph
        self.path_cache: Dict[Tuple[int, int], Tuple[float, float, float, float, float]] = {}

    def get_edge_metrics(self, u: int, v: int) -> Tuple[float, float, float, float, float]:
        """Returns (travel_time_hr, distance_km, congestion, fuel_consumption, risk)."""
        data = self.graph.graph[u][v]
        
        # Check closed roads
        if data.get("road_status", "open") == "closed":
            return 999.0, 999.0, 1.0, 999.0, 10.0
            
        time = data.get("current_travel_time", data["base_travel_time"])
        dist = data["distance"]
        cong = data.get("congestion", 0.0)
        risk = data.get("risk", 0.0)
        
        # Fuel estimate: baseline consumption (e.g. 0.08 L/km) multiplied by congestion factor
        fuel = dist * 0.08 * (1.0 + 0.6 * cong)
        
        return time, dist, cong, fuel, risk

    def evaluate_path(self, path: List[int]) -> Dict[str, float]:
        """Calculates objectives for a single node path."""
        total_time = 0.0
        total_dist = 0.0
        congestion_sum = 0.0
        total_fuel = 0.0
        total_risk = 0.0
        
        if len(path) < 2:
            return {
                "travel_time": 99.0, "distance": 999.0, "congestion": 1.0, 
                "fuel_cost": 99.0, "risk": 10.0
            }
            
        for i in range(len(path) - 1):
            u, v = path[i], path[i+1]
            if self.graph.graph.has_edge(u, v):
                t, d, c, f, r = self.get_edge_metrics(u, v)
                total_time += t
                total_dist += d
                congestion_sum += c
                total_fuel += f
                total_risk += r
            else:
                # Road connection error
                total_time += 10.0
                total_dist += 50.0
                congestion_sum += 1.0
                total_fuel += 5.0
                total_risk += 2.0
                
        avg_congestion = congestion_sum / (len(path) - 1) if len(path) > 1 else 0.0
        
        return {
            "travel_time": total_time,
            "distance": total_dist,
            "congestion": avg_congestion,
            "fuel_cost": total_fuel,
            "risk": total_risk
        }

    def get_od_metrics(self, origin: int, destination: int) -> Tuple[float, float, float, float, float]:
        """
        Uses custom Dijkstra search to get the dynamic metrics between two junctions.
        """
        pair = (origin, destination)
        if pair in self.path_cache:
            return self.path_cache[pair]
            
        path, _ = dijkstra_shortest_path(self.graph, origin, destination)
        if path:
            metrics = self.evaluate_path(path)
            result = (
                metrics["travel_time"],
                metrics["distance"],
                metrics["congestion"],
                metrics["fuel_cost"],
                metrics["risk"]
            )
            self.path_cache[pair] = result
            return result
        else:
            return 9.0, 999.0, 1.0, 99.0, 9.0

    def clear_cache(self):
        self.path_cache.clear()

    def evaluate_vrp_solution(self, routes: List[List[int]], depot_id: int) -> Dict[str, float]:
        """
        Evaluates a VRP solution.
        """
        total_time = 0.0
        total_dist = 0.0
        congestion_sum = 0.0
        total_fuel = 0.0
        total_risk = 0.0
        leg_count = 0
        
        for route in routes:
            if not route:
                continue
            
            # Depot to first customer
            t, d, c, f, r = self.get_od_metrics(depot_id, route[0])
            total_time += t
            total_dist += d
            congestion_sum += c
            total_fuel += f
            total_risk += r
            leg_count += 1
            
            # Customer to customer
            for idx in range(len(route) - 1):
                t, d, c, f, r = self.get_od_metrics(route[idx], route[idx+1])
                total_time += t
                total_dist += d
                congestion_sum += c
                total_fuel += f
                total_risk += r
                leg_count += 1
                
            # Last customer back to depot
            t, d, c, f, r = self.get_od_metrics(route[-1], depot_id)
            total_time += t
            total_dist += d
            congestion_sum += c
            total_fuel += f
            total_risk += r
            leg_count += 1
            
        avg_congestion = congestion_sum / leg_count if leg_count > 0 else 0.0
        
        return {
            "travel_time": total_time,
            "distance": total_dist,
            "congestion": avg_congestion,
            "fuel_cost": total_fuel,
            "risk": total_risk,
            "vehicles_used": float(len(routes))
        }

    def compute_weighted_fitness(self, metrics: Dict[str, float], weights: Dict[str, float]) -> float:
        """
        Calculates a normalized multi-objective fitness:
        F(R) = w_t*T + w_d*D + w_c*C + w_f*F + w_r*R
        """
        # Normalization factors to bring objectives to comparable scales
        # Time scale ~0.1 - 2.0 hours
        # Distance scale ~1.0 - 50.0 km
        # Congestion scale ~0.0 - 1.0
        # Fuel scale ~0.1 - 5.0 L
        # Risk scale ~0.0 - 5.0
        norms = {
            "travel_time": 1.0,
            "distance": 0.1,      # divide distance by 10 to normalize
            "congestion": 5.0,     # multiply congestion to give it weight
            "fuel_cost": 1.0,
            "risk": 2.0,
            "vehicles_used": 1.0
        }
        
        fitness = 0.0
        for key, val in metrics.items():
            weight = weights.get(key, 0.0)
            norm = norms.get(key, 1.0)
            fitness += val * weight * norm
        return fitness

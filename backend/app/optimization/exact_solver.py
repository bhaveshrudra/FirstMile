import networkx as nx
import heapq
import itertools
from typing import List, Dict, Any, Tuple, Optional
from ..graph.graph_model import TrafficGraph

def dijkstra_shortest_path(graph: TrafficGraph, source: int, target: int) -> Tuple[List[int], Dict[str, float]]:
    """
    Custom Dijkstra implementation that calculates the shortest travel-time path.
    Respects closed roads (road_status == 'closed').
    Returns path as node list and dict of metrics (time, distance, congestion, risk).
    """
    g = graph.graph
    if not (g.has_node(source) and g.has_node(target)):
        return [], {"travel_time": 999.0, "distance": 999.0, "congestion": 1.0, "risk": 1.0}

    # dists maps node -> (travel_time, distance_km, congestion_sum, risk_sum, path_predecessor)
    dists = {node: (float('inf'), 0.0, 0.0, 0.0, None) for node in g.nodes()}
    dists[source] = (0.0, 0.0, 0.0, 0.0, None)
    
    # Priority queue contains (travel_time, node_id)
    queue = [(0.0, source)]
    visited = set()
    
    while queue:
        current_time, u = heapq.heappop(queue)
        
        if u in visited:
            continue
        visited.add(u)
        
        if u == target:
            break
            
        for v in g.neighbors(u):
            # Check if road is closed
            edge_data = g[u][v]
            if edge_data.get("road_status", "open") == "closed":
                continue
                
            edge_time = edge_data.get("current_travel_time", edge_data["base_travel_time"])
            edge_dist = edge_data["distance"]
            edge_flow = edge_data.get("flow", 0.0)
            edge_cap = edge_data["capacity"]
            edge_cong = edge_flow / edge_cap if edge_cap > 0 else 0.0
            edge_risk = edge_data.get("risk", 0.0)
            
            new_time = current_time + edge_time
            if new_time < dists[v][0]:
                prev_time, prev_dist, prev_cong, prev_risk, _ = dists[u]
                dists[v] = (
                    new_time,
                    prev_dist + edge_dist,
                    prev_cong + edge_cong,
                    prev_risk + edge_risk,
                    u
                )
                heapq.heappush(queue, (new_time, v))
                
    # Reconstruct path
    path = []
    curr = target
    if dists[target][0] == float('inf'):
        # No path found
        return [], {"travel_time": 999.0, "distance": 999.0, "congestion": 1.0, "risk": 1.0}
        
    while curr is not None:
        path.append(curr)
        curr = dists[curr][4]
    path.reverse()
    
    # Compute metrics
    total_time, total_dist, cong_sum, total_risk, _ = dists[target]
    avg_cong = cong_sum / (len(path) - 1) if len(path) > 1 else 0.0

    total_fuel = 0.0
    for u, v in zip(path, path[1:]):
        edge_data = g[u][v]
        if edge_data.get("road_status", "open") == "closed":
            continue
        edge_dist = edge_data["distance"]
        edge_flow = edge_data.get("flow", 0.0)
        edge_cap = edge_data["capacity"]
        edge_cong = edge_flow / edge_cap if edge_cap > 0 else 0.0
        total_fuel += edge_dist * 0.08 * (1.0 + 0.6 * edge_cong)
    
    return path, {
        "travel_time": total_time,
        "distance": total_dist,
        "congestion": avg_cong,
        "fuel_cost": total_fuel,
        "risk": total_risk
    }


def brute_force_vrp(graph: TrafficGraph, customer_ids: List[int], depot_id: int, 
                    demands: Dict[int, float], vehicle_capacity: float, 
                    max_vehicles: int, weights: Dict[str, float]) -> Tuple[List[List[int]], float, Dict[str, float]]:
    """
    Exhaustively solves VRP for small sizes (typically <= 5 customers).
    Finds the globally optimal set of routes that minimizes the multi-objective fitness.
    Respects capacity constraints and vehicle fleet sizes.
    """
    from .fitness import RouteEvaluator
    evaluator = RouteEvaluator(graph)
    evaluator.clear_cache()
    
    best_routes: List[List[int]] = []
    best_fitness = float('inf')
    best_metrics: Dict[str, float] = {}
    
    # Generate all partitions of customers into up to max_vehicles routes
    # For a set of customers, e.g., [C1, C2, C3], we partition them into lists.
    # To do this, we can generate all permutations of customers + delimiter tokens (representing returning to depot).
    # Since we have max_vehicles, we can have up to max_vehicles - 1 splits.
    num_customers = len(customer_ids)
    
    # Check if brute-force size is computationally safe
    if num_customers > 6:
        # Size too large, fall back to standard heuristic routing
        return [], float('inf'), {}

    # We evaluate all permutations of customers
    for customer_perm in itertools.permutations(customer_ids):
        # We partition this permutation into routes
        # We can split the permutation into up to max_vehicles segments
        # Let's generate all possible ways to divide the customer sequence into segments
        # (e.g. inserting 0 to max_vehicles - 1 divider slots)
        for partitions in itertools.combinations(range(1, num_customers), max_vehicles - 1):
            # Split customer list based on indices in partition
            routes = []
            last_idx = 0
            for p in partitions:
                routes.append(list(customer_perm[last_idx:p]))
                last_idx = p
            routes.append(list(customer_perm[last_idx:]))
            
            # Clean up empty routes
            routes = [r for r in routes if r]
            
            # Validate capacity constraints
            valid = True
            for route in routes:
                load = sum(demands.get(c, 0.0) for c in route)
                if load > vehicle_capacity:
                    valid = False
                    break
            
            if not valid:
                continue
                
            # Evaluate fitness
            metrics = evaluator.evaluate_vrp_solution(routes, depot_id)
            fitness = evaluator.compute_weighted_fitness(metrics, weights)
            
            if fitness < best_fitness:
                best_fitness = fitness
                best_routes = routes
                best_metrics = metrics
                
    return best_routes, best_fitness, best_metrics

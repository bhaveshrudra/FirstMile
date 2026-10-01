import numpy as np
from typing import List, Dict, Any, Tuple
import networkx as nx
from ..graph.graph_model import TrafficGraph

def decode_shortest_path(graph: TrafficGraph, source: int, target: int, 
                         position: np.ndarray, heuristic_weight: float = 0.5) -> List[int]:
    """
    Decodes a continuous particle position vector into a valid path from source to target.
    Actively ignores closed roads (road_status == 'closed').
    """
    g = graph.graph
    num_nodes = g.number_of_nodes()
    
    if len(position) < num_nodes:
        padded_position = np.zeros(num_nodes)
        padded_position[:len(position)] = position
        position = padded_position

    target_lat, target_lon = graph.get_node_coords(target)
    
    # Pre-calculate heuristic
    heuristics = np.zeros(num_nodes)
    for n in g.nodes():
        if n == target:
            heuristics[n] = 1000.0
        else:
            lat, lon = graph.get_node_coords(n)
            dist = np.sqrt((lat - target_lat)**2 + (lon - target_lon)**2)
            heuristics[n] = 1.0 / (dist + 0.001)

    path = [source]
    visited = {source}
    current = source
    history: List[Tuple[int, List[int]]] = []
    
    max_steps = num_nodes * 2
    steps = 0
    
    while current != target and steps < max_steps:
        steps += 1
        
        # Get unvisited neighbors where the edge is NOT closed
        neighbors = []
        for n in g.neighbors(current):
            if n not in visited:
                edge_data = g[current][n]
                if edge_data.get("road_status", "open") != "closed":
                    neighbors.append(n)
        
        if not neighbors:
            # Backtrack
            if not history:
                break
            current, tried = history.pop()
            path.pop()
            visited = set(path)
            current = path[-1]
            continue
            
        priorities = [position[n] + heuristic_weight * heuristics[n] for n in neighbors]
        sorted_neighbors = [n for _, n in sorted(zip(priorities, neighbors), reverse=True)]
        next_node = sorted_neighbors[0]
        
        history.append((current, [next_node]))
        current = next_node
        path.append(current)
        visited.add(current)
        
    # Validation
    if path[-1] == target:
        return path
        
    # If failed, attempt to repair using custom Dijkstra (which ignores closed roads)
    from .exact_solver import dijkstra_shortest_path
    repaired_path, _ = dijkstra_shortest_path(graph, source, target)
    if repaired_path:
        return repaired_path
        
    return [source, target]


def decode_vrp(customer_ids: List[int], depot_id: int, position: np.ndarray, 
               demands: Dict[int, float], vehicle_capacity: float) -> List[List[int]]:
    """
    Decodes continuous keys into VRP routes.
    """
    num_customers = len(customer_ids)
    keys = position[:num_customers]
    
    sorted_indices = np.argsort(keys)
    customer_order = [customer_ids[idx] for idx in sorted_indices]
    
    routes = []
    current_route = []
    current_load = 0.0
    
    for customer in customer_order:
        demand = demands.get(customer, 0.0)
        
        if current_load + demand > vehicle_capacity:
            if current_route:
                routes.append(current_route)
            current_route = [customer]
            current_load = demand
        else:
            current_route.append(customer)
            current_load += demand
            
    if current_route:
        routes.append(current_route)
        
    return routes

from typing import List, Dict, Any

class ConstraintHandler:
    """
    Evaluates vehicle routing and path constraints.
    Applies configurable penalty factors:
    F_total = F_route + lambda_1 * P_capacity + lambda_2 * P_time + lambda_3 * P_invalid
    """
    def __init__(self, capacity_penalty_coeff: float = 500.0, 
                 time_penalty_coeff: float = 100.0, 
                 invalid_path_penalty_coeff: float = 1000.0):
        self.lambda_1 = capacity_penalty_coeff
        self.lambda_2 = time_penalty_coeff
        self.lambda_3 = invalid_path_penalty_coeff

    def get_shortest_path_penalty(self, path: List[int], target: int, decoded_natively: bool) -> float:
        """
        Penalizes if a path construction failed and had to fall back to a Dijkstra repair,
        or if it fails to reach the destination altogether.
        """
        penalty = 0.0
        if not decoded_natively:
            # Repaired path penalty
            penalty += self.lambda_2 * 2.0
        if len(path) < 2 or path[-1] != target:
            # Invalid connection penalty
            penalty += self.lambda_3
        return penalty

    def get_vrp_capacity_penalty(self, routes: List[List[int]], demands: Dict[int, float], 
                                  vehicle_capacity: float) -> float:
        """
        Penalizes exceeding the cargo capacity limit on any vehicle route.
        P_capacity = sum(max(0, route_load - capacity))
        """
        penalty = 0.0
        for route in routes:
            load = sum(demands.get(c, 0.0) for c in route)
            if load > vehicle_capacity:
                penalty += (load - vehicle_capacity) * self.lambda_1
        return penalty

    def get_vrp_fleet_penalty(self, num_vehicles: int, max_vehicles: int) -> float:
        """Penalizes using more vehicles than the fleet permits."""
        if num_vehicles > max_vehicles:
            return (num_vehicles - max_vehicles) * self.lambda_1
        return 0.0

    def get_vrp_duration_penalty(self, route_times: List[float], max_route_time_hr: float) -> float:
        """
        Penalizes exceeding maximum shift hours for drivers.
        P_time = sum(max(0, route_time - max_time))
        """
        penalty = 0.0
        for t in route_times:
            if t > max_route_time_hr:
                penalty += (t - max_route_time_hr) * self.lambda_2
        return penalty

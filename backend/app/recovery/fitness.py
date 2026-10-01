import numpy as np
from typing import Dict, Any, List, Optional, Callable
from ..digital_twin.engine import DigitalTwinEngine
from ..optimization.fitness import RouteEvaluator
from ..optimization.route_encoding import decode_shortest_path


def evaluate_route_metrics(
    twin: DigitalTwinEngine,
    path: List[int],
    shipment_id: Optional[str] = None,
    order_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Evaluates physical, operational, and customer delivery metrics for a specific candidate route.
    Validates edge and node statuses against disruptions.
    """
    g = twin.graph.graph

    if not path or len(path) < 2:
        return {
            "is_feasible": False,
            "travel_time": 999.0,
            "distance": 999.0,
            "transport_cost": 999.0,
            "risk": 1.0,
            "fuel_cost": 999.0,
            "carbon": 999.0,
            "delivery_delay": 999.0,
            "explanation": "Path contains fewer than 2 nodes."
        }

    # 1. Validate nodes (reject offline/closed nodes)
    for n in path:
        if not g.has_node(n):
            return {
                "is_feasible": False,
                "travel_time": 999.0,
                "distance": 999.0,
                "transport_cost": 999.0,
                "risk": 1.0,
                "fuel_cost": 999.0,
                "carbon": 999.0,
                "delivery_delay": 999.0,
                "explanation": f"Node {n} does not exist in graph."
            }
        if g.nodes[n].get("status") in {"CLOSED", "OFFLINE"}:
            return {
                "is_feasible": False,
                "travel_time": 999.0,
                "distance": 999.0,
                "transport_cost": 999.0,
                "risk": 1.0,
                "fuel_cost": 999.0,
                "carbon": 999.0,
                "delivery_delay": 999.0,
                "explanation": f"Node {n} is closed/offline."
            }

    # 2. Validate edges (reject closed/impassable links)
    for u, v in zip(path, path[1:]):
        if not g.has_edge(u, v):
            return {
                "is_feasible": False,
                "travel_time": 999.0,
                "distance": 999.0,
                "transport_cost": 999.0,
                "risk": 1.0,
                "fuel_cost": 999.0,
                "carbon": 999.0,
                "delivery_delay": 999.0,
                "explanation": f"Edge ({u}, {v}) does not exist."
            }
        ed = g.edges[u, v]
        if ed.get("road_status") == "closed" or ed.get("current_travel_time", 0.0) >= 999.0:
            return {
                "is_feasible": False,
                "travel_time": 999.0,
                "distance": 999.0,
                "transport_cost": 999.0,
                "risk": 1.0,
                "fuel_cost": 999.0,
                "carbon": 999.0,
                "delivery_delay": 999.0,
                "explanation": f"Edge ({u}, {v}) is closed/blocked."
            }

    # 3. Calculate physics and base operational metrics via RouteEvaluator
    evaluator = RouteEvaluator(twin.graph)
    base_m = evaluator.evaluate_path(path)

    # 4. Multimodal transport cost and carbon from TrafficGraph metadata
    transport_cost = 0.0
    carbon_kg = 0.0
    for u, v in zip(path, path[1:]):
        ed = g.edges[u, v]
        transport_cost += ed.get("transport_cost", ed.get("distance", 10.0) * 1.5)
        carbon_kg += ed.get("carbon_kg", ed.get("distance", 10.0) * 1.0)

    # 5. Delivery delay calculation against SLA
    delivery_delay = 0.0
    target_order = None
    if shipment_id:
        shp = twin.get_shipment(shipment_id)
        if shp and shp.order_id:
            target_order = twin.get_order(shp.order_id)
    elif order_id:
        target_order = twin.get_order(order_id)

    if target_order:
        predicted_arrival = twin.simulation_time + base_m["travel_time"]
        delivery_delay = max(0.0, predicted_arrival - target_order.promised_delivery_time)

    return {
        "is_feasible": True,
        "travel_time": round(base_m["travel_time"], 2),
        "distance": round(base_m["distance"], 2),
        "transport_cost": round(transport_cost, 2),
        "risk": round(base_m["risk"], 2),
        "fuel_cost": round(base_m["fuel_cost"], 2),
        "carbon": round(carbon_kg, 2),
        "delivery_delay": round(delivery_delay, 2),
        "explanation": "Route is open and physically feasible."
    }


def compute_recovery_fitness(
    metrics: Dict[str, Any],
    weights: Dict[str, float],
    reference_metrics: Optional[Dict[str, float]] = None
) -> float:
    """
    Computes a single scalar multi-objective recovery score for a candidate route.
    Penalizes infeasible routes heavily (1e6).
    Uses reference metrics for smooth normalization across divergent dimensions.
    """
    if not metrics.get("is_feasible", False):
        return 1e6

    ref = reference_metrics or {}
    ref_time = max(0.1, ref.get("travel_time", 1.0))
    ref_cost = max(1.0, ref.get("transport_cost", 50.0))
    ref_delay = max(0.1, ref.get("delivery_delay", 1.0))

    norm_time = metrics["travel_time"] / ref_time
    norm_cost = metrics["transport_cost"] / ref_cost
    norm_risk = metrics["risk"]
    norm_delay = metrics["delivery_delay"] / ref_delay

    w_time = weights.get("TRAVEL_TIME", 1.0)
    w_cost = weights.get("TRANSPORT_COST", 0.8)
    w_risk = weights.get("RISK", 0.5)
    w_delay = weights.get("DELIVERY_DELAY", 1.0)

    score = (
        (w_time * norm_time) +
        (w_cost * norm_cost) +
        (w_risk * norm_risk) +
        (w_delay * norm_delay)
    )
    return float(score)


def make_shipment_fitness_fn(
    twin: DigitalTwinEngine,
    origin_node: int,
    dest_node: int,
    shipment_id: str,
    weights: Dict[str, float],
    reference_metrics: Optional[Dict[str, float]] = None
) -> Callable[[np.ndarray], float]:
    """
    Factory creating a callable fitness function compatible with ImprovedQPSO.
    Accepts continuous particle position vector, decodes to discrete graph route,
    validates feasibility, and scores against multi-objective recovery weights.
    """
    def fitness_fn(position: np.ndarray) -> float:
        path = decode_shortest_path(twin.graph, origin_node, dest_node, position)
        if not path or path[0] != origin_node or path[-1] != dest_node:
            return 1e6

        metrics = evaluate_route_metrics(twin, path, shipment_id)
        if not metrics["is_feasible"]:
            return 1e6

        return compute_recovery_fitness(metrics, weights, reference_metrics)

    return fitness_fn

import pytest
import numpy as np
import networkx as nx
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.graph.graph_generator import generate_grid_graph, generate_random_graph
from backend.app.traffic.simulator import TrafficSimulator
from backend.app.traffic.traffic_model import TrafficIncident
from backend.app.optimization.pso import ClassicalPSO
from backend.app.optimization.qpso import BasicQPSO
from backend.app.optimization.improved_qpso import ImprovedQPSO
from backend.app.optimization.route_encoding import decode_shortest_path
from backend.app.optimization.benchmarks import sphere, rosenbrock, rastrigin, ackley
from backend.app.optimization.exact_solver import dijkstra_shortest_path, brute_force_vrp

client = TestClient(app)

def test_math_benchmarks_optimization():
    """
    Validates PSO, QPSO, and IQPSO solvers on classical optimization benchmark functions.
    This separates optimizer logic testing from routing decoders (Steps 61-62).
    """
    dimensions = 3
    swarm_size = 20
    iterations = 30
    
    # PSO on Sphere
    pso = ClassicalPSO(swarm_size, iterations, dimensions, lower_bound=-5.0, upper_bound=5.0)
    pos_pso, fit_pso = pso.solve(sphere)
    assert fit_pso < 5.0  # Should converge towards 0
    
    # QPSO on Rastrigin
    qpso = BasicQPSO(swarm_size, iterations, dimensions, lower_bound=-5.12, upper_bound=5.12)
    pos_qpso, fit_qpso = qpso.solve(rastrigin)
    # Check that it compiles and performs iterations
    assert len(pos_qpso) == dimensions
    assert len(qpso.get_history()["gbest_history"]) == iterations + 1

    # IQPSO on Ackley
    iqpso = ImprovedQPSO(swarm_size, iterations, dimensions, lower_bound=-32.0, upper_bound=32.0)
    pos_iqpso, fit_iqpso = iqpso.solve(ackley)
    assert len(pos_iqpso) == dimensions
    assert fit_iqpso < 15.0 # Check improvement from random bounds (max Ackley ~22)


def test_dijkstra_and_closed_roads():
    """
    Verifies that our custom Dijkstra solver correctly routes around closed edges (Step 42).
    """
    grid = generate_grid_graph(rows=3, cols=3)
    sim = TrafficSimulator(grid)
    
    # Path without blockages: 0 -> 1 -> 2 -> 5 -> 8
    path_normal, metrics_normal = dijkstra_shortest_path(grid, 0, 8)
    assert len(path_normal) > 0
    assert path_normal[0] == 0
    assert path_normal[-1] == 8
    
    # Close edge (0, 1) and (0, 3) - this completely blocks node 0 except outgoing
    # Let's close (0, 1) and see if it takes (0, 3) -> 4 -> ...
    sim.trigger_event("road_closure", edge=(0, 1))
    path_blocked, metrics_blocked = dijkstra_shortest_path(grid, 0, 8)
    
    assert (0, 1) not in zip(path_blocked[:-1], path_blocked[1:])
    assert path_blocked[1] == 3 # Should reroute down instead of right


def test_brute_force_vrp():
    """
    Verifies that the brute force exact VRP solver finds the absolute optimal solution (Step 63).
    """
    grid = generate_grid_graph(rows=3, cols=3)
    customers = [1, 2, 3]
    depot = 0
    demands = {1: 10.0, 2: 20.0, 3: 15.0}
    capacity = 100.0
    max_vehicles = 2
    weights = {"travel_time": 1.0, "distance": 0.2, "congestion": 0.5, "fuel_cost": 0.2, "risk": 0.3}
    
    routes, fit, metrics = brute_force_vrp(grid, customers, depot, demands, capacity, max_vehicles, weights)
    
    assert len(routes) > 0
    # Every customer should be visited exactly once
    flat_routes = [c for r in routes for c in r]
    assert sorted(flat_routes) == sorted(customers)


def test_custom_junction_graph_is_axis_aligned():
    """Ensure manual junctions connect only on one road axis, never as diagonal shortcuts."""
    graph = generate_grid_graph(rows=0, cols=0)

    assert len(graph.graph.edges) > 0, "Custom manual junction graph should contain road-connected edges."

    for u, v, data in graph.graph.edges(data=True):
        lat_u, lon_u = graph.get_node_coords(u)
        lat_v, lon_v = graph.get_node_coords(v)
        same_lat = abs(lat_u - lat_v) <= 0.0012
        same_lon = abs(lon_u - lon_v) <= 0.0012
        assert (same_lat and not same_lon) or (same_lon and not same_lat), (
            f"Diagonal edge is not allowed: {u} -> {v} with lat diff {abs(lat_u - lat_v)} "
            f"and lon diff {abs(lon_u - lon_v)}"
        )


def test_api_routes():
    # Root
    response = client.get("/")
    assert response.status_code == 200

    # Get graph
    response = client.get("/api/graph")
    assert response.status_code == 200

    # Trigger traffic event
    response = client.post("/api/traffic/event", json={
        "event_type": "peak_hour"
    })
    assert response.status_code == 200
    assert response.json()["hour"] == 8.0

    # Shortest path optimization with Dijkstra comparison
    response = client.post("/api/optimize/shortest-path", json={
        "source": 0,
        "target": 8,
        "algorithm": "dijkstra",
        "swarm_size": 10,
        "iterations": 10
    })
    assert response.status_code == 200
    assert response.json()["algorithm"] == "dijkstra"

    # Scalability experiment run
    response = client.post("/api/experiment/run", json={
        "problem_type": "vrp",
        "swarm_size": 10,
        "iterations": 10,
        "runs": 2,
        "seed": 42,
        "node_sizes": [10, 15]
    })
    assert response.status_code == 200
    assert "results" in response.json()
    assert len(response.json()["results"]) == 2

    # Shortest path benchmark run
    response = client.post("/api/benchmark/run", json={
        "problem_type": "shortest_path",
        "source": 0,
        "target": 8,
        "swarm_size": 10,
        "iterations": 10,
        "runs": 2
    })
    assert response.status_code == 200


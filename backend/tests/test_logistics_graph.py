import pytest
import networkx as nx

from backend.app.graph.graph_model import TrafficGraph
from backend.app.graph.graph_generator import generate_logistics_sample_graph
from backend.app.digital_twin.seed import create_pnt1_seed_twin
from backend.app.optimization.exact_solver import dijkstra_shortest_path
from backend.app.optimization.improved_qpso import ImprovedQPSO
from backend.app.optimization.fitness import RouteEvaluator
from backend.app.optimization.route_encoding import decode_shortest_path


# 1. Logistics graph creates successfully
def test_logistics_graph_creation():
    g = generate_logistics_sample_graph()
    assert g is not None
    assert isinstance(g, TrafficGraph)
    assert g.graph.number_of_nodes() == 16
    assert g.graph.number_of_edges() > 0


# 2. Expected node categories exist
def test_node_categories_exist():
    g = generate_logistics_sample_graph()
    node_types = {data.get("type") for _, data in g.graph.nodes(data=True)}
    expected_types = {"supplier", "warehouse", "port", "customer", "junction"}
    assert expected_types.issubset(node_types)


# 3. Expected supplier nodes exist
def test_supplier_nodes_exist():
    g = generate_logistics_sample_graph()
    assert g.graph.has_node(0)
    assert g.graph.has_node(1)
    assert g.graph.nodes[0]["type"] == "supplier"
    assert g.graph.nodes[0]["facility_id"] == "S1"
    assert g.graph.nodes[1]["type"] == "supplier"
    assert g.graph.nodes[1]["facility_id"] == "S2"


# 4. Expected warehouse nodes exist
def test_warehouse_nodes_exist():
    g = generate_logistics_sample_graph()
    assert g.graph.has_node(2)
    assert g.graph.has_node(3)
    assert g.graph.nodes[2]["type"] == "warehouse"
    assert g.graph.nodes[2]["facility_id"] == "W1"
    assert g.graph.nodes[3]["type"] == "warehouse"
    assert g.graph.nodes[3]["facility_id"] == "W2"


# 5. Expected port node exists
def test_port_node_exists():
    g = generate_logistics_sample_graph()
    assert g.graph.has_node(4)
    assert g.graph.nodes[4]["type"] == "port"
    assert g.graph.nodes[4]["facility_id"] == "P1"


# 6. Expected customer nodes exist
def test_customer_nodes_exist():
    g = generate_logistics_sample_graph()
    customer_ids = [5, 6, 7, 8, 9, 10]
    for cid in customer_ids:
        assert g.graph.has_node(cid)
        assert g.graph.nodes[cid]["type"] == "customer"


# 7. Multimodal edge metadata exists
def test_multimodal_edge_metadata():
    g = generate_logistics_sample_graph()
    modes = {data.get("mode") for _, _, data in g.graph.edges(data=True)}
    assert "road" in modes
    assert "rail" in modes
    assert "ocean" in modes

    # Verify rail link between Port P1 (4) and Warehouse W1 (2)
    assert g.graph.has_edge(4, 2)
    edge_data = g.graph[4][2]
    assert edge_data["mode"] in ("road", "rail")
    assert "transport_cost" in edge_data
    assert "carbon_kg" in edge_data
    assert "reliability" in edge_data
    assert edge_data["reliability"] > 0.9


# 8. Old graph edge attributes still exist
def test_legacy_edge_attributes_exist():
    g = generate_logistics_sample_graph()
    for u, v, data in g.graph.edges(data=True):
        assert "distance" in data
        assert "speed" in data
        assert "capacity" in data
        assert "lanes" in data
        assert "road_type" in data
        assert "base_travel_time" in data
        assert "flow" in data
        assert "congestion" in data
        assert "current_travel_time" in data
        assert "road_status" in data
        assert "risk" in data
        assert "incidents" in data
        break


# 9. Graph remains routable
def test_graph_routable():
    g = generate_logistics_sample_graph()
    # Path from Supplier 1 (0) to Customer 1 (5)
    assert nx.has_path(g.graph, 0, 5)
    # Path from Warehouse 1 (2) to Customer 6 (10)
    assert nx.has_path(g.graph, 2, 10)
    # Path from Port 1 (4) to Customer 5 (9)
    assert nx.has_path(g.graph, 4, 9)


# 10. Alternate path exists for at least one important OD pair
def test_alternate_path_exists_and_rerouting():
    g = generate_logistics_sample_graph()
    origin = 2  # Warehouse W1
    dest = 5    # Customer C1

    # Primary path (Bay Bridge corridor: 2 -> 11 -> 5)
    primary_path, metrics = dijkstra_shortest_path(g, origin, dest)
    assert primary_path == [2, 11, 5]

    # Inject closure on primary link (11, 5)
    g.graph[11][5]["road_status"] = "closed"

    # Solver automatically reroutes via southern bypass (San Mateo Bridge: 2 -> 12 -> 13 -> 14 -> 9 -> 6 -> 5)
    bypass_path, bypass_metrics = dijkstra_shortest_path(g, origin, dest)
    assert len(bypass_path) > 0
    assert bypass_path[0] == origin
    assert bypass_path[-1] == dest
    assert (11, 5) not in zip(bypass_path[:-1], bypass_path[1:])
    assert bypass_metrics["travel_time"] > metrics["travel_time"]


# 11. to_dict() / from_dict() preserves logistics attributes
def test_dict_roundtrip_preserves_logistics_data():
    g = generate_logistics_sample_graph()
    serialized = g.to_dict()

    # Reconstruct from dict
    restored = TrafficGraph.from_dict(serialized)
    assert restored.graph.number_of_nodes() == g.graph.number_of_nodes()
    assert restored.graph.number_of_edges() == g.graph.number_of_edges()

    # Check node metadata restored
    assert restored.graph.nodes[0]["type"] == "supplier"
    assert restored.graph.nodes[0]["facility_id"] == "S1"
    assert restored.graph.nodes[4]["type"] == "port"

    # Check multimodal attributes restored
    modes = {data.get("mode") for _, _, data in restored.graph.edges(data=True)}
    assert "road" in modes
    assert "rail" in modes
    assert "ocean" in modes


# 12. Seed twin initializes successfully
def test_seed_twin_initialization():
    twin = create_pnt1_seed_twin()
    assert twin is not None
    assert twin.name == "PNT1-Seed-Scenario"
    assert twin.simulation_time == 12.0


# 13. Seed twin has expected entity counts
def test_seed_twin_entity_counts():
    twin = create_pnt1_seed_twin()
    summary = twin.get_summary()

    assert summary["supplier_count"] == 2
    assert summary["warehouse_count"] == 2
    assert summary["vehicle_count"] >= 5
    assert summary["customer_count"] == 6
    assert summary["inventory_item_count"] == 6
    assert summary["order_count"] == 10
    assert summary["shipment_count"] == 5


# 14. Seed orders reference real customers and SKUs
def test_seed_orders_reference_valid_entities():
    twin = create_pnt1_seed_twin()
    valid_customer_ids = set(twin.customers.keys())
    valid_skus = {item.sku for item in twin.inventory.values()}
    valid_warehouses = set(twin.warehouses.keys())

    for order in twin.orders.values():
        assert order.customer_id in valid_customer_ids
        assert order.sku in valid_skus
        if order.source_warehouse_id is not None:
            assert order.source_warehouse_id in valid_warehouses
        assert order.quantity > 0


# 15. Seed shipments reference real orders/vehicles
def test_seed_shipments_reference_valid_entities():
    twin = create_pnt1_seed_twin()
    valid_orders = set(twin.orders.keys())
    valid_vehicles = set(twin.vehicles.keys())
    valid_nodes = set(twin.graph.graph.nodes())

    for shipment in twin.shipments.values():
        assert shipment.order_id in valid_orders
        if shipment.vehicle_id is not None:
            assert shipment.vehicle_id in valid_vehicles
        # Check that waypoints in route are real nodes in the transport graph
        for node in shipment.route:
            assert node in valid_nodes


# 16. Scenario remains deterministic
def test_scenario_determinism():
    twin1 = create_pnt1_seed_twin()
    twin2 = create_pnt1_seed_twin()

    dict1 = twin1.to_dict()
    dict2 = twin2.to_dict()

    assert dict1["suppliers"] == dict2["suppliers"]
    assert dict1["warehouses"] == dict2["warehouses"]
    assert dict1["vehicles"] == dict2["vehicles"]
    assert dict1["customers"] == dict2["customers"]
    assert dict1["inventory"] == dict2["inventory"]
    assert dict1["orders"] == dict2["orders"]
    assert dict1["shipments"] == dict2["shipments"]
    assert dict1["graph"]["nodes"] == dict2["graph"]["nodes"]


# 17. Improved QPSO optimizer solves routing on the logistics sample graph
def test_improved_qpso_optimizes_on_logistics_graph():
    g = generate_logistics_sample_graph()
    evaluator = RouteEvaluator(g)
    source, target = 0, 5  # S1 to C1

    def fitness_fn(pos):
        path = decode_shortest_path(g, source, target, pos)
        metrics = evaluator.evaluate_path(path)
        return metrics["travel_time"]

    solver = ImprovedQPSO(swarm_size=15, iterations=10, dimensions=g.graph.number_of_nodes())
    best_pos, best_fit = solver.solve(fitness_fn)
    optimized_path = decode_shortest_path(g, source, target, best_pos)

    assert len(optimized_path) >= 2
    assert optimized_path[0] == source
    assert optimized_path[-1] == target
    assert best_fit < 900.0

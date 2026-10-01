import random
import math
import networkx as nx
from typing import Optional
from .graph_model import TrafficGraph

def generate_grid_graph(rows: int, cols: int, center_lat: float = 37.7749, center_lon: float = -122.4194, 
                        spacing_km: float = 0.5) -> TrafficGraph:
    """Backward-compatible wrapper: keep the road-only junction network instead of a synthetic lattice."""
    return generate_california_sample_graph()


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    cval = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return 6371.0 * cval


def generate_california_sample_graph() -> TrafficGraph:
    """Build the original junction layout as a sparse, road-aligned sample network.

    The coordinates are a fixed manual set of street intersections for a California-style area.
    They are intentionally not laid out as a dense lattice, and edges are added only when two
    junctions lie on the same road axis and are near neighbors. This prevents routes from cutting
    across houses or blocks.
    """
    tg = TrafficGraph()

    junctions = [
        (0, 37.78517640455941, -122.4179333234039, "A"),
        (1, 37.786083693520276, -122.41812548093787, "B"),
        (2, 37.78702991004272, -122.41828807581952, "C"),
        (3, 37.78720869922593, -122.41667192183323, "D"), 
        (4, 37.78632005690208, -122.41651128732414, "E"),
        (5, 37.785431403892495, -122.41634091739029, "F"),
        (6, 37.78653548632549, -122.41484652968472, "G"),
        (7, 37.785585283966476, -122.41465182118888, "H"),
        (8, 37.78464276348447, -122.41441817099386, "I"),
        (9, 37.78333860303346, -122.41760165490305, "J"),
        (10, 37.78423112827584, -122.41780123111127, "K"),
        (11, 37.784438869673856, -122.41612187033465, "L"),
        (12, 37.783738701888765, -122.41427700733655, "M"),
        (13, 37.78283847641853, -122.41410176969029, "N"),
        (14, 37.78148427041939, -122.41719276706309, "O"),
        (15, 37.78162661710079, -122.41553774484842, "P"),
        (16, 37.78191515683015, -122.41392166433297, "Q"),
        (17, 37.783011597537566, -122.41244187971873, "R"),
        (18, 37.78410802197827, -122.4109669628101, "S"),
        (19, 37.7832655078079, -122.41080146058862, "T"),
        (20, 37.78226525020466, -122.41054833954404, "U"),
        (21, 37.78320780100644, -122.40907342268805, "V"),
        (22, 37.78344247505142, -122.40916104151115, "W"),
        (23, 37.78437731671953, -122.40932167602023, "X"),
        (24, 37.78527367644437, -122.40956506163758, "Y"),
    ]

    node_map = {}
    for node_id, lat, lon, label in junctions:
        tg.add_node(node_id, lat, lon, node_type="junction", label=label)
        node_map[node_id] = (lat, lon)

    # Connect the restored custom junctions using a road-only axis rule.
    # Same-street junctions must be linked together even when they are within a short distance,
    # but points that differ in both latitude and longitude are treated as diagonal shortcuts and
    # are rejected. This keeps the network on actual roads instead of cutting across blocks.
    axis_tol = 0.0006
    diagonal_min = 0.00018

    seen_edges = set()
    for current_id, (lat1, lon1) in node_map.items():
        candidates = []
        for target_id, (lat2, lon2) in node_map.items():
            if current_id == target_id:
                continue

            same_lat = abs(lat1 - lat2) <= axis_tol
            same_lon = abs(lon1 - lon2) <= axis_tol
            both_differ = abs(lat1 - lat2) > diagonal_min and abs(lon1 - lon2) > diagonal_min
            if not (same_lat or same_lon):
                continue
            if both_differ and not (same_lat or same_lon):
                continue

            dist = _haversine_km(lat1, lon1, lat2, lon2)
            if dist > 0.25:
                continue
            candidates.append((dist, target_id))

        candidates.sort(key=lambda item: item[0])
        for _, target_id in candidates[:3]:
            pair = tuple(sorted((current_id, target_id)))
            if pair in seen_edges:
                continue
            seen_edges.add(pair)

            lat2, lon2 = node_map[target_id]
            dist = _haversine_km(lat1, lon1, lat2, lon2)
            speed = random.choice([30, 40, 50, 60])
            capacity = random.choice([1000, 1500, 2000])
            lanes = 2 if capacity > 1200 else 1
            tg.add_edge(current_id, target_id, dist, speed, capacity, lanes, "arterial")
            tg.add_edge(target_id, current_id, dist, speed, capacity, lanes, "arterial")

    return tg


def generate_random_graph(num_nodes: int, radius_km: float = 2.0, center_lat: float = 37.7749, 
                          center_lon: float = -122.4194) -> TrafficGraph:
    """
    Generates a Geometric Random Graph where nodes are connected if within a distance threshold.
    Ensures the resulting graph is strongly connected.
    """
    tg = TrafficGraph()
    lat_degree = 1.0 / 111.0
    lon_degree = 1.0 / (111.0 * math.cos(math.radians(center_lat)))

    # Generate nodes randomly distributed in a circle of radius_km
    nodes_coords = []
    for i in range(num_nodes):
        # Uniform sampling in circle
        r_dist = radius_km * math.sqrt(random.random())
        theta = random.random() * 2 * math.pi
        d_lat = r_dist * math.cos(theta) * lat_degree
        d_lon = r_dist * math.sin(theta) * lon_degree
        lat = center_lat + d_lat
        lon = center_lon + d_lon
        nodes_coords.append((i, lat, lon))
        node_type = "depot" if i == 0 else "junction"
        tg.add_node(i, lat, lon, node_type=node_type, label=f"Jct_{i}")

    # Helper function to compute distance in km using Haversine approximation
    def haversine_km(lat1, lon1, lat2, lon2):
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        return 6371.0 * c

    # Determine distance threshold to connect nodes
    # We want to connect nodes that are close to each other.
    threshold = radius_km * 0.6

    # Add edges
    for i, lat1, lon1 in nodes_coords:
        for j, lat2, lon2 in nodes_coords:
            if i != j:
                dist = haversine_km(lat1, lon1, lat2, lon2)
                if dist <= threshold:
                    speed = random.choice([40, 50, 60, 80])
                    capacity = random.choice([1200, 1800, 2400])
                    lanes = 2 if speed >= 60 else 1
                    tg.add_edge(i, j, dist, speed, capacity, lanes, "collector")

    # Verify strong connectivity. If not strongly connected, link disjoint components to depot
    scc = list(nx.strongly_connected_components(tg.graph))
    if len(scc) > 1:
        # Create a giant cycle through all representatives of SCCs to guarantee strong connectivity
        representatives = [random.choice(list(c)) for c in scc]
        for idx in range(len(representatives)):
            u = representatives[idx]
            v = representatives[(idx + 1) % len(representatives)]
            lat1, lon1 = tg.get_node_coords(u)
            lat2, lon2 = tg.get_node_coords(v)
            dist = haversine_km(lat1, lon1, lat2, lon2)
            tg.add_edge(u, v, dist, 50.0, 1500.0, 1, "connector")
            tg.add_edge(v, u, dist, 50.0, 1500.0, 1, "connector")

    return tg


def generate_scale_free_graph(num_nodes: int, center_lat: float = 37.7749, 
                             center_lon: float = -122.4194) -> TrafficGraph:
    """
    Generates a scale-free graph using the Barabási-Albert model and projects to spatial coordinates.
    Ensures connectivity by mapping double edges.
    """
    # Generate BA graph with m=2 (each new node attaches to 2 existing nodes)
    ba_graph = nx.barabasi_albert_graph(num_nodes, m=2)
    
    tg = TrafficGraph()
    lat_degree = 1.0 / 111.0
    lon_degree = 1.0 / (111.0 * math.cos(math.radians(center_lat)))

    # Lay out nodes in a spiral or cluster-based structure to make edges look natural
    # Higher degree nodes get closer to center, lower degree nodes further out
    degrees = dict(ba_graph.degree())
    max_degree = max(degrees.values()) if degrees else 1

    def haversine_km(lat1, lon1, lat2, lon2):
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        return 6371.0 * c

    for node in ba_graph.nodes():
        deg = degrees[node]
        # Distance is inversely proportional to degree
        r_dist = 2.0 * (1.0 - (deg / (max_degree + 1.0))) + random.uniform(0, 0.5)
        theta = node * 0.5 # spiral angle
        
        d_lat = r_dist * math.cos(theta) * lat_degree
        d_lon = r_dist * math.sin(theta) * lon_degree
        lat = center_lat + d_lat
        lon = center_lon + d_lon
        node_type = "depot" if node == 0 else "junction"
        tg.add_node(node, lat, lon, node_type=node_type, label=f"Jct_{node}")

    # Add edges based on scale-free connections
    for u, v in ba_graph.edges():
        lat1, lon1 = tg.get_node_coords(u)
        lat2, lon2 = tg.get_node_coords(v)
        dist = haversine_km(lat1, lon1, lat2, lon2)
        # Scale speed and capacity based on node degree (hubs get highway-like features)
        deg_u, deg_v = degrees[u], degrees[v]
        if deg_u > 0.3 * max_degree or deg_v > 0.3 * max_degree:
            speed = 80.0
            capacity = 3000.0
            lanes = 3
            road_type = "highway"
        else:
            speed = 40.0
            capacity = 1200.0
            lanes = 1
            road_type = "local"
            
        tg.add_edge(u, v, dist, speed, capacity, lanes, road_type)
        tg.add_edge(v, u, dist, speed, capacity, lanes, road_type)

    return tg

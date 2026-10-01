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


def generate_logistics_sample_graph() -> TrafficGraph:
    """
    Generates a deterministic PNT1 regional freight logistics network topology.
    Contains:
      - 2 Suppliers (S1: Node 0, S2: Node 1)
      - 2 Warehouses (W1: Node 2, W2: Node 3)
      - 1 Intermodal Maritime & Rail Port (P1: Node 4)
      - 6 Customer Retail/Commercial Centers (C1: Node 5 .. C6: Node 10)
      - 5 Critical Highway & Transit Junctions (J1: Node 11 .. J5: Node 15)
    Features a multimodal blend of road, freight rail, and coastal ocean corridors,
    with primary and redundant alternate bypass corridors.
    Uses 0-indexed contiguous node IDs (0..15) to maintain full compatibility
    with existing swarm routing decoders, Dijkstra, and VRP solvers.
    """
    tg = TrafficGraph()

    # 1. Define Nodes with Logistics Metadata
    nodes = [
        # Suppliers (0, 1)
        (0, 37.9500, -122.3500, "supplier", "S1", "S1", "Apex Microelectronics (S1)", 1500.0, "ACTIVE", 200.0),
        (1, 37.6000, -122.0500, "supplier", "S2", "S2", "Pacific Precision Parts (S2)", 2000.0, "ACTIVE", 250.0),
        # Warehouses (2, 3)
        (2, 37.8000, -122.2500, "warehouse", "W1", "W1", "Bay Gateway DC (W1)", 10000.0, "ACTIVE", 800.0),
        (3, 37.7000, -122.1500, "warehouse", "W2", "W2", "Silicon Valley Hub (W2)", 12000.0, "ACTIVE", 1000.0),
        # Port / Terminal (4)
        (4, 37.8100, -122.3200, "port", "P1", "P1", "Port of Oakland Terminal (P1)", 50000.0, "ACTIVE", 3500.0),
        # Customers (5 .. 10)
        (5, 37.7800, -122.4200, "customer", "C1", "C1", "Metro Supercenter SF (C1)", 500.0, "ACTIVE", 100.0),
        (6, 37.7500, -122.4000, "customer", "C2", "C2", "Mission Commercial Depot (C2)", 400.0, "ACTIVE", 80.0),
        (7, 37.8700, -122.2700, "customer", "C3", "C3", "Berkeley Tech Outlet (C3)", 350.0, "ACTIVE", 70.0),
        (8, 37.8300, -122.2000, "customer", "C4", "C4", "Piedmont Supply Point (C4)", 300.0, "ACTIVE", 60.0),
        (9, 37.6800, -122.4700, "customer", "C5", "C5", "Peninsula Medical Center (C5)", 600.0, "ACTIVE", 120.0),
        (10, 37.5500, -122.3000, "customer", "C6", "C6", "Silicon Valley Outlet (C6)", 450.0, "ACTIVE", 90.0),
        # Junctions / Highway Waypoints (11 .. 15)
        (11, 37.8200, -122.3800, "junction", "J1", "J1", "Bay Bridge Transit Jct (J1)", 0.0, "ACTIVE", 0.0),
        (12, 37.7500, -122.2200, "junction", "J2", "J2", "East Bay Arterial Jct (J2)", 0.0, "ACTIVE", 0.0),
        (13, 37.6200, -122.2500, "junction", "J3", "J3", "San Mateo Bridge East Jct (J3)", 0.0, "ACTIVE", 0.0),
        (14, 37.6000, -122.3200, "junction", "J4", "J4", "Peninsula Coastal Bypass Jct (J4)", 0.0, "ACTIVE", 0.0),
        (15, 37.8800, -122.3100, "junction", "J5", "J5", "North Bay Shore Corridor Jct (J5)", 0.0, "ACTIVE", 0.0),
    ]

    for nid, lat, lon, ntype, lbl, fid, name, cap, status, hcap in nodes:
        tg.add_node(
            node_id=nid,
            lat=lat,
            lon=lon,
            node_type=ntype,
            label=lbl,
            facility_id=fid,
            name=name,
            capacity=cap,
            status=status,
            handling_capacity=hcap,
            region="SF-Bay-Area",
            country="USA"
        )

    # 2. Helper to add bidirectional links
    def add_bidirectional_link(u: int, v: int, dist: float, speed: float, cap: float,
                               lanes: int, rtype: str, mode: str = "road",
                               cost: float = 0.0, carbon: float = 0.0,
                               reliability: float = 1.0, transit_hr: Optional[float] = None):
        tg.add_edge(u, v, dist, speed, cap, lanes, rtype, mode, cost, carbon, reliability, transit_hr)
        tg.add_edge(v, u, dist, speed, cap, lanes, rtype, mode, cost, carbon, reliability, transit_hr)

    # 3. Upstream & Intermodal Links (Suppliers, Port, Warehouses)
    # S1 (0) -> W1 (2) (I-80 North Corridor Highway)
    add_bidirectional_link(0, 2, dist=22.0, speed=75.0, cap=2400.0, lanes=2,
                           rtype="highway", mode="road", cost=55.0, carbon=36.0, reliability=0.98)

    # S1 (0) -> J5 (15) (North Shore Arterial)
    add_bidirectional_link(0, 15, dist=10.0, speed=65.0, cap=1800.0, lanes=2,
                           rtype="arterial", mode="road", cost=25.0, carbon=16.0, reliability=0.97)

    # J5 (15) -> P1 (4) (Port North Approach Road)
    add_bidirectional_link(15, 4, dist=9.0, speed=60.0, cap=1800.0, lanes=2,
                           rtype="arterial", mode="road", cost=22.0, carbon=14.0, reliability=0.97)

    # S1 (0) <-> P1 (4) (Coastal Ocean Barge Corridor)
    add_bidirectional_link(0, 4, dist=20.0, speed=25.0, cap=5000.0, lanes=1,
                           rtype="waterway", mode="ocean", cost=28.0, carbon=10.0, reliability=0.95, transit_hr=0.80)

    # S2 (1) -> W2 (3) (I-880 East Bay Corridor Highway)
    add_bidirectional_link(1, 3, dist=15.0, speed=75.0, cap=2400.0, lanes=2,
                           rtype="highway", mode="road", cost=38.0, carbon=25.0, reliability=0.98)

    # S2 (1) -> J2 (12) (Industrial Arterial)
    add_bidirectional_link(1, 12, dist=20.0, speed=65.0, cap=1800.0, lanes=2,
                           rtype="arterial", mode="road", cost=45.0, carbon=32.0, reliability=0.96)

    # S2 (1) <-> P1 (4) (East Bay Freight Rail Line via J2)
    add_bidirectional_link(1, 4, dist=30.0, speed=45.0, cap=4000.0, lanes=1,
                           rtype="rail", mode="rail", cost=32.0, carbon=12.0, reliability=0.99, transit_hr=0.67)

    # P1 (4) <-> W1 (2) (Port Access Road)
    add_bidirectional_link(4, 2, dist=6.0, speed=50.0, cap=2000.0, lanes=2,
                           rtype="arterial", mode="road", cost=15.0, carbon=9.0, reliability=0.97)

    # P1 (4) <-> W1 (2) (Dedicated Intermodal Rail Spur)
    add_bidirectional_link(4, 2, dist=7.0, speed=40.0, cap=3500.0, lanes=1,
                           rtype="rail", mode="rail", cost=10.0, carbon=4.0, reliability=0.99, transit_hr=0.25)

    # P1 (4) <-> J2 (12) (Port South Connector)
    add_bidirectional_link(4, 12, dist=12.0, speed=65.0, cap=2000.0, lanes=2,
                           rtype="arterial", mode="road", cost=28.0, carbon=18.0, reliability=0.96)

    # W1 (2) <-> W2 (3) (Inter-Warehouse Distribution Connector)
    add_bidirectional_link(2, 3, dist=14.0, speed=70.0, cap=2200.0, lanes=2,
                           rtype="highway", mode="road", cost=32.0, carbon=22.0, reliability=0.98)

    # W2 (3) <-> J2 (12) (San Leandro Arterial)
    add_bidirectional_link(3, 12, dist=7.0, speed=60.0, cap=1800.0, lanes=2,
                           rtype="arterial", mode="road", cost=16.0, carbon=11.0, reliability=0.97)

    # 4. Warehouse to Customer Delivery Links & Alternate Corridors
    # East Bay Customers: W1 (2) -> C3 (7) (Berkeley) & W1 (2) -> C4 (8) (Piedmont)
    add_bidirectional_link(2, 7, dist=9.0, speed=55.0, cap=1500.0, lanes=2,
                           rtype="arterial", mode="road", cost=20.0, carbon=13.0, reliability=0.97)
    add_bidirectional_link(2, 8, dist=6.0, speed=50.0, cap=1500.0, lanes=2,
                           rtype="arterial", mode="road", cost=14.0, carbon=9.0, reliability=0.97)
    add_bidirectional_link(7, 8, dist=7.0, speed=45.0, cap=1200.0, lanes=1,
                           rtype="local", mode="road", cost=12.0, carbon=8.0, reliability=0.96)

    # Primary Trans-Bay Route (W1 (2) -> J1 (11) -> C1 (5) via Bay Bridge)
    add_bidirectional_link(2, 11, dist=8.0, speed=70.0, cap=2500.0, lanes=3,
                           rtype="highway", mode="road", cost=20.0, carbon=14.0, reliability=0.98)
    add_bidirectional_link(11, 5, dist=6.0, speed=65.0, cap=2500.0, lanes=3,
                           rtype="highway", mode="road", cost=25.0, carbon=12.0, reliability=0.98)

    # SF Urban Distribution (C1 (5) <-> C2 (6))
    add_bidirectional_link(5, 6, dist=4.0, speed=40.0, cap=1400.0, lanes=2,
                           rtype="arterial", mode="road", cost=10.0, carbon=6.0, reliability=0.95)
    # C2 (6) <-> C5 (9) (Peninsula North)
    add_bidirectional_link(6, 9, dist=10.0, speed=65.0, cap=2000.0, lanes=2,
                           rtype="highway", mode="road", cost=22.0, carbon=15.0, reliability=0.97)

    # Alternate Southern Trans-Bay Bypass Corridor (San Mateo Bridge: J2 (12) -> J3 (13) -> J4 (14))
    add_bidirectional_link(12, 13, dist=16.0, speed=75.0, cap=2200.0, lanes=2,
                           rtype="highway", mode="road", cost=35.0, carbon=24.0, reliability=0.98)
    add_bidirectional_link(13, 14, dist=12.0, speed=75.0, cap=2200.0, lanes=2,
                           rtype="highway", mode="road", cost=30.0, carbon=20.0, reliability=0.98)

    # Peninsula West Connections (J4 (14) -> C5 (9) and J4 (14) -> C6 (10))
    add_bidirectional_link(14, 9, dist=11.0, speed=65.0, cap=1800.0, lanes=2,
                           rtype="arterial", mode="road", cost=24.0, carbon=16.0, reliability=0.97)
    add_bidirectional_link(14, 10, dist=7.0, speed=60.0, cap=1600.0, lanes=2,
                           rtype="arterial", mode="road", cost=15.0, carbon=10.0, reliability=0.97)

    # South Bay Customer Links (W2 (3) -> J3 (13) -> J4 (14) -> C6 (10) and C5 (9) <-> C6 (10))
    add_bidirectional_link(3, 13, dist=10.0, speed=70.0, cap=2000.0, lanes=2,
                           rtype="highway", mode="road", cost=22.0, carbon=15.0, reliability=0.98)
    add_bidirectional_link(9, 10, dist=16.0, speed=65.0, cap=1800.0, lanes=2,
                           rtype="arterial", mode="road", cost=32.0, carbon=22.0, reliability=0.96)

    return tg



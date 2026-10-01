import networkx as nx
from typing import Dict, Any, List, Optional, Tuple

class TrafficGraph:
    """
    Represents a transportation network graph G = (V, E) wrapping a NetworkX DiGraph.
    Integrates geographic coordinates, static road characteristics, and dynamic traffic flow.
    """
    def __init__(self):
        self.graph = nx.DiGraph()

    def add_node(self, node_id: int, lat: float, lon: float, node_type: str = "junction", label: Optional[str] = None):
        """Adds a vertex (intersection/junction) to the graph."""
        self.graph.add_node(
            node_id,
            lat=lat,
            lon=lon,
            type=node_type,
            label=label or f"Node {node_id}"
        )

    def add_edge(self, u: int, v: int, distance_km: float, speed_kph: float, 
                 capacity_vph: float, lanes: int = 1, road_type: str = "arterial"):
        """
        Adds a directed road segment (edge) with static attributes.
        Also initializes dynamic state (congestion=0.0, current_travel_time, road_status='open').
        """
        base_time_hr = distance_km / speed_kph
        self.graph.add_edge(
            u, v,
            distance=distance_km,
            speed=speed_kph,
            capacity=capacity_vph,
            lanes=lanes,
            road_type=road_type,
            base_travel_time=base_time_hr,
            # Dynamic state
            flow=0.0,
            congestion=0.0,
            current_travel_time=base_time_hr,
            road_status="open",
            risk=0.0,
            incidents=[]
        )

    def get_node_coords(self, node_id: int) -> Tuple[float, float]:
        """Returns (lat, lon) for a node."""
        node_data = self.graph.nodes[node_id]
        return node_data["lat"], node_data["lon"]

    def to_dict(self) -> Dict[str, Any]:
        """Converts the graph to a serializable dictionary for API exchange."""
        nodes = []
        for n, data in self.graph.nodes(data=True):
            nodes.append({
                "id": n,
                "lat": data["lat"],
                "lon": data["lon"],
                "type": data.get("type", "junction"),
                "label": data.get("label", "")
            })

        edges = []
        for u, v, data in self.graph.edges(data=True):
            edges.append({
                "source": u,
                "target": v,
                "distance": data["distance"],
                "speed": data["speed"],
                "capacity": data["capacity"],
                "lanes": data["lanes"],
                "road_type": data["road_type"],
                "base_travel_time": data["base_travel_time"],
                "flow": data["flow"],
                "congestion": data["congestion"],
                "current_travel_time": data["current_travel_time"],
                "road_status": data["road_status"],
                "risk": data["risk"],
                "incidents": data["incidents"]
            })

        return {"nodes": nodes, "edges": edges}

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "TrafficGraph":
        """Reconstructs a TrafficGraph instance from a dictionary structure."""
        tg = cls()
        for node in data.get("nodes", []):
            tg.add_node(
                node["id"], 
                node["lat"], 
                node["lon"], 
                node.get("type", "junction"), 
                node.get("label")
            )
        for edge in data.get("edges", []):
            tg.add_edge(
                edge["source"],
                edge["target"],
                edge["distance"],
                edge["speed"],
                edge["capacity"],
                edge.get("lanes", 1),
                edge.get("road_type", "arterial")
            )
            u, v = edge["source"], edge["target"]
            if "flow" in edge:
                tg.graph[u][v]["flow"] = edge["flow"]
            if "congestion" in edge:
                tg.graph[u][v]["congestion"] = edge["congestion"]
            if "current_travel_time" in edge:
                tg.graph[u][v]["current_travel_time"] = edge["current_travel_time"]
            if "road_status" in edge:
                tg.graph[u][v]["road_status"] = edge["road_status"]
            if "risk" in edge:
                tg.graph[u][v]["risk"] = edge["risk"]
            if "incidents" in edge:
                tg.graph[u][v]["incidents"] = edge["incidents"]
        return tg

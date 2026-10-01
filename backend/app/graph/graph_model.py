import networkx as nx
from typing import Dict, Any, List, Optional, Tuple


class TrafficGraph:
    """
    Represents a transportation and logistics network graph G = (V, E) wrapping a NetworkX DiGraph.
    Integrates geographic coordinates, multimodal freight infrastructure (road, rail, ocean, air),
    facility metadata, static link characteristics, and dynamic traffic flow.
    """
    def __init__(self):
        self.graph = nx.DiGraph()

    def add_node(
        self,
        node_id: int,
        lat: float,
        lon: float,
        node_type: str = "junction",
        label: Optional[str] = None,
        facility_id: Optional[str] = None,
        name: Optional[str] = None,
        capacity: Optional[float] = None,
        status: Optional[str] = None,
        handling_capacity: Optional[float] = None,
        country: Optional[str] = None,
        region: Optional[str] = None,
        **kwargs: Any,
    ):
        """
        Adds a vertex (intersection, junction, warehouse, supplier, port, customer) to the graph.
        Preserves backward compatibility with legacy positional arguments while supporting
        rich logistics metadata.
        """
        node_attrs: Dict[str, Any] = {
            "lat": lat,
            "lon": lon,
            "type": node_type,
            "label": label or f"Node {node_id}",
        }
        if facility_id is not None:
            node_attrs["facility_id"] = facility_id
        if name is not None:
            node_attrs["name"] = name
        if capacity is not None:
            node_attrs["capacity"] = capacity
        if status is not None:
            node_attrs["status"] = status
        if handling_capacity is not None:
            node_attrs["handling_capacity"] = handling_capacity
        if country is not None:
            node_attrs["country"] = country
        if region is not None:
            node_attrs["region"] = region
        node_attrs.update(kwargs)

        self.graph.add_node(node_id, **node_attrs)

    def add_edge(
        self,
        u: int,
        v: int,
        distance_km: float,
        speed_kph: float,
        capacity_vph: float,
        lanes: int = 1,
        road_type: str = "arterial",
        mode: str = "road",
        transport_cost: float = 0.0,
        carbon_kg: float = 0.0,
        reliability: float = 1.0,
        transit_time_hours: Optional[float] = None,
        **kwargs: Any,
    ):
        """
        Adds a directed transportation link (edge) with static road/multimodal attributes.
        Also initializes dynamic state (congestion=0.0, current_travel_time, road_status='open').
        """
        base_time_hr = distance_km / speed_kph if speed_kph > 0 else 0.1
        effective_transit = transit_time_hours if transit_time_hours is not None else base_time_hr

        edge_attrs: Dict[str, Any] = {
            "distance": distance_km,
            "speed": speed_kph,
            "capacity": capacity_vph,
            "lanes": lanes,
            "road_type": road_type,
            "base_travel_time": base_time_hr,
            # Multimodal logistics attributes
            "mode": mode,
            "transport_cost": transport_cost,
            "carbon_kg": carbon_kg,
            "reliability": reliability,
            "transit_time_hours": effective_transit,
            # Dynamic state
            "flow": 0.0,
            "congestion": 0.0,
            "current_travel_time": effective_transit,
            "road_status": "open",
            "risk": 0.0,
            "incidents": [],
        }
        edge_attrs.update(kwargs)
        self.graph.add_edge(u, v, **edge_attrs)

    def get_node_coords(self, node_id: int) -> Tuple[float, float]:
        """Returns (lat, lon) for a node."""
        node_data = self.graph.nodes[node_id]
        return node_data["lat"], node_data["lon"]

    def to_dict(self) -> Dict[str, Any]:
        """Converts the graph to a serializable dictionary for API exchange and snapshots."""
        nodes = []
        for n, data in self.graph.nodes(data=True):
            node_dict = {
                "id": n,
                "lat": data["lat"],
                "lon": data["lon"],
                "type": data.get("type", "junction"),
                "label": data.get("label", ""),
            }
            # Include optional logistics metadata if present
            for opt_key in ("facility_id", "name", "capacity", "status", "handling_capacity", "country", "region"):
                if opt_key in data:
                    node_dict[opt_key] = data[opt_key]
            nodes.append(node_dict)

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
                "mode": data.get("mode", "road"),
                "transport_cost": data.get("transport_cost", 0.0),
                "carbon_kg": data.get("carbon_kg", 0.0),
                "reliability": data.get("reliability", 1.0),
                "transit_time_hours": data.get("transit_time_hours", data["base_travel_time"]),
                "flow": data["flow"],
                "congestion": data["congestion"],
                "current_travel_time": data["current_travel_time"],
                "road_status": data["road_status"],
                "risk": data["risk"],
                "incidents": data["incidents"],
            })

        return {"nodes": nodes, "edges": edges}

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "TrafficGraph":
        """Reconstructs a TrafficGraph instance from a dictionary structure."""
        tg = cls()
        for node in data.get("nodes", []):
            tg.add_node(
                node_id=node["id"],
                lat=node["lat"],
                lon=node["lon"],
                node_type=node.get("type", "junction"),
                label=node.get("label"),
                facility_id=node.get("facility_id"),
                name=node.get("name"),
                capacity=node.get("capacity"),
                status=node.get("status"),
                handling_capacity=node.get("handling_capacity"),
                country=node.get("country"),
                region=node.get("region"),
            )
        for edge in data.get("edges", []):
            tg.add_edge(
                u=edge["source"],
                v=edge["target"],
                distance_km=edge["distance"],
                speed_kph=edge["speed"],
                capacity_vph=edge["capacity"],
                lanes=edge.get("lanes", 1),
                road_type=edge.get("road_type", "arterial"),
                mode=edge.get("mode", "road"),
                transport_cost=edge.get("transport_cost", 0.0),
                carbon_kg=edge.get("carbon_kg", 0.0),
                reliability=edge.get("reliability", 1.0),
                transit_time_hours=edge.get("transit_time_hours"),
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

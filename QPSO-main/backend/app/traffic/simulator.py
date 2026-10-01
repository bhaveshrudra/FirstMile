import random
from typing import Dict, List, Optional
from ..graph.graph_model import TrafficGraph
from .traffic_model import TrafficIncident, bpr_travel_time, linear_travel_time, get_diurnal_traffic_multiplier

class TrafficSimulator:
    """
    Simulates dynamic, time-varying traffic conditions and manages road incidents.
    Supports configurable models (linear, BPR) and dynamic events.
    """
    def __init__(self, graph: TrafficGraph, congestion_model: str = "linear", 
                 congestion_impact_factor: float = 2.0):
        self.graph = graph
        self.current_hour = 12.0  # Default to noon
        self.incidents: Dict[str, TrafficIncident] = {}
        self.congestion_model = congestion_model
        self.congestion_impact_factor = congestion_impact_factor
        
        # Pre-seed some edge-specific baseline congestion values between 0.0 and 0.4
        random.seed(42)
        self.edge_congestion_factors = {}
        for u, v in self.graph.graph.edges():
            self.edge_congestion_factors[(u, v)] = random.uniform(0.1, 0.4)

    def trigger_event(self, event_type: str, edge: Optional[tuple[int, int]] = None, 
                      severity: float = 0.8, description: str = ""):
        """
        Triggers simulated events:
        - normal: Clear all incidents, open all roads.
        - congestion: Increase congestion across the graph.
        - accident: Inject accident on a specific edge.
        - road_closure: Set status of selected edge to 'closed'.
        - peak_hour: Set hour of day to peak commute hours.
        - random_incident: Randomly choose an edge and inject a disturbance.
        """
        if event_type == "normal":
            self.clear_all_incidents()
            for u, v in self.graph.graph.edges():
                self.graph.graph.edges[u, v]["road_status"] = "open"
                self.graph.graph.edges[u, v]["risk"] = 0.0
            self.recompute_edge_travel_times()
            
        elif event_type == "congestion":
            # Increase base congestion multipliers
            for u, v in self.graph.graph.edges():
                self.edge_congestion_factors[(u, v)] = min(1.0, self.edge_congestion_factors[(u, v)] + 0.3)
            self.recompute_edge_travel_times()
            
        elif event_type == "accident":
            if edge:
                u, v = edge
                incident_id = f"acc-{u}-{v}"
                incident = TrafficIncident(
                    id=incident_id,
                    source=u,
                    target=v,
                    incident_type="accident",
                    severity=severity,
                    description=description or "Accident blocking lanes"
                )
                self.add_incident(incident)
                
        elif event_type == "road_closure":
            if edge:
                u, v = edge
                if self.graph.graph.has_edge(u, v):
                    self.graph.graph.edges[u, v]["road_status"] = "closed"
                    self.graph.graph.edges[u, v]["current_travel_time"] = 999.0  # impassable
                    
        elif event_type == "peak_hour":
            self.update_simulation_time(8.0) # Morning rush hour
            
        elif event_type == "random_incident":
            # Pick a random edge
            edges = list(self.graph.graph.edges())
            if edges:
                u, v = random.choice(edges)
                incident_id = f"rand-{u}-{v}"
                inc_type = random.choice(["accident", "roadwork", "breakdown"])
                incident = TrafficIncident(
                    id=incident_id,
                    source=u,
                    target=v,
                    incident_type=inc_type,
                    severity=random.uniform(0.5, 0.9),
                    description=f"Random dynamic {inc_type}"
                )
                self.add_incident(incident)

    def add_incident(self, incident: TrafficIncident):
        """Adds a traffic incident and updates the graph."""
        self.incidents[incident.id] = incident
        u, v = incident.source, incident.target
        if self.graph.graph.has_edge(u, v):
            self.graph.graph.edges[u, v]["incidents"].append(incident.model_dump())
            self.graph.graph.edges[u, v]["risk"] = max(self.graph.graph.edges[u, v]["risk"], incident.severity)
        self.recompute_edge_travel_times()

    def remove_incident(self, incident_id: str):
        """Removes a traffic incident by ID."""
        if incident_id in self.incidents:
            incident = self.incidents[incident_id]
            u, v = incident.source, incident.target
            if self.graph.graph.has_edge(u, v):
                current_incidents = self.graph.graph.edges[u, v].get("incidents", [])
                self.graph.graph.edges[u, v]["incidents"] = [
                    inc for inc in current_incidents if inc["id"] != incident_id
                ]
                self.graph.graph.edges[u, v]["risk"] = 0.0
            del self.incidents[incident_id]
            self.recompute_edge_travel_times()

    def clear_all_incidents(self):
        """Removes all incidents from the simulation."""
        self.incidents.clear()
        for u, v in self.graph.graph.edges():
            self.graph.graph.edges[u, v]["incidents"] = []
            self.graph.graph.edges[u, v]["risk"] = 0.0
        self.recompute_edge_travel_times()

    def update_simulation_time(self, hour: float):
        """Updates simulation time and recalculates travel times."""
        self.current_hour = hour % 24.0
        self.recompute_edge_travel_times()

    def recompute_edge_travel_times(self):
        """
        Recalculates travel times based on time-of-day, incidents, and configured model.
        """
        diurnal_mult = get_diurnal_traffic_multiplier(self.current_hour)
        
        for u, v, data in self.graph.graph.edges(data=True):
            # If the road is closed, it remains impassable
            if data.get("road_status", "open") == "closed":
                data["current_travel_time"] = 999.0
                data["congestion"] = 1.0
                continue
                
            base_congestion = self.edge_congestion_factors.get((u, v), 0.2)
            
            # Sum up incident severities
            incident_severity_sum = 0.0
            speed_mult = 1.0
            cap_mult = 1.0
            
            for inc in data.get("incidents", []):
                severity = inc["severity"]
                incident_severity_sum += severity
                if inc["incident_type"] == "accident":
                    cap_mult *= (1.0 - severity)
                    speed_mult *= (1.0 - 0.7 * severity)
                elif inc["incident_type"] == "roadwork":
                    cap_mult *= (1.0 - 0.5 * severity)
                    speed_mult *= (1.0 - 0.3 * severity)
                else:
                    speed_mult *= (1.0 - 0.2 * severity)
            
            cap_mult = max(0.01, cap_mult)
            speed_mult = max(0.1, speed_mult)
            
            # Calculate congestion level between 0.0 and 1.0
            data["congestion"] = min(1.0, base_congestion * diurnal_mult + incident_severity_sum)
            
            if self.congestion_model == "linear":
                # Compute base travel time at effective speed
                effective_speed = data["speed"] * speed_mult
                base_time = data["distance"] / effective_speed
                
                data["current_travel_time"] = linear_travel_time(
                    base_time=base_time,
                    congestion=data["congestion"],
                    impact_factor=self.congestion_impact_factor
                )
            else:  # BPR model
                data["flow"] = min(data["capacity"] * 1.5, data["capacity"] * data["congestion"])
                data["current_travel_time"] = bpr_travel_time(
                    length_km=data["distance"],
                    speed_kph=data["speed"],
                    capacity_vph=data["capacity"],
                    current_flow_vph=data["flow"],
                    lanes=data["lanes"],
                    speed_multiplier=speed_mult,
                    capacity_multiplier=cap_mult
                )

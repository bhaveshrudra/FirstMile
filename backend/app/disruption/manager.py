import time
from typing import Dict, Any, List, Optional, Tuple, Union
from .models import Disruption, DisruptionType, DisruptionStatus
from .impact import _parse_edge, analyze_disruption_impact
from ..digital_twin.engine import DigitalTwinEngine
from ..traffic.traffic_model import TrafficIncident
from ..models.supplier import SupplierStatus
from ..models.warehouse import WarehouseStatus


class DisruptionManager:
    """
    Manages the lifecycle, physical application, logical propagation, and clean
    reversion of disruptions on a target DigitalTwinEngine.
    Works identically on baseline (active_twin) and isolated scenario twins.
    """

    def __init__(self, twin: DigitalTwinEngine):
        self.twin = twin
        if not hasattr(self.twin, "disruptions"):
            self.twin.disruptions = {}

    # ==========================================
    # Lifecycle Operations
    # ==========================================

    def inject_disruption(self, disruption: Union[Disruption, Dict[str, Any]]) -> Disruption:
        """
        Validates, registers, and applies a disruption to the twin.
        """
        if isinstance(disruption, dict):
            disruption = Disruption(**disruption)

        # Apply physical effect immediately if start_time is at or before current virtual time
        if disruption.start_time <= self.twin.simulation_time:
            self.apply_physical_impact(disruption)

        self.twin.disruptions[disruption.id] = disruption
        self.twin._mark_updated()
        return disruption

    def list_disruptions(self, active_only: bool = False) -> List[Disruption]:
        """Returns all registered disruptions on this twin."""
        disruptions = list(self.twin.disruptions.values())
        # Ensure they are Disruption instances
        result = []
        for d in disruptions:
            if isinstance(d, dict):
                d = Disruption(**d)
                self.twin.disruptions[d.id] = d
            if active_only and d.status != DisruptionStatus.ACTIVE:
                continue
            result.append(d)
        return result

    def get_disruption(self, disruption_id: str) -> Optional[Disruption]:
        """Retrieves a disruption by ID."""
        d = self.twin.disruptions.get(disruption_id)
        if d is not None and isinstance(d, dict):
            d = Disruption(**d)
            self.twin.disruptions[d.id] = d
        return d

    def resolve_disruption(self, disruption_id: str) -> Optional[Disruption]:
        """
        Resolves a disruption and cleans up all physical/logical impacts.
        """
        d = self.get_disruption(disruption_id)
        if d is None:
            return None

        self.revert_physical_impact(d)
        d.status = DisruptionStatus.RESOLVED
        self.twin._mark_updated()
        return d

    def clear_all_disruptions(self):
        """
        Clears and reverts all disruptions on this twin.
        """
        for d in list(self.list_disruptions()):
            if d.status == DisruptionStatus.ACTIVE:
                self.revert_physical_impact(d)
                d.status = DisruptionStatus.RESOLVED
        self.twin.disruptions.clear()
        self.twin._mark_updated()

    def check_expiry(self, current_time: Optional[float] = None) -> List[str]:
        """
        Evaluates active disruptions against simulation time and marks expired ones.
        """
        if current_time is None:
            current_time = self.twin.simulation_time

        expired_ids = []
        for d in self.list_disruptions():
            if d.status == DisruptionStatus.ACTIVE:
                # If disruption has not yet started, but start time is reached, apply it
                if d.start_time <= current_time and not d.applied_impact_data:
                    self.apply_physical_impact(d)

                # Check if it has expired
                if current_time >= d.end_time:
                    self.revert_physical_impact(d)
                    d.status = DisruptionStatus.EXPIRED
                    expired_ids.append(d.id)

        if expired_ids:
            self.twin._mark_updated()
        return expired_ids

    # ==========================================
    # Physical & Logical Impact Application
    # ==========================================

    def apply_physical_impact(self, disruption: Disruption):
        """
        Applies network and entity modifications based on disruption type and severity.
        Caches previous state in disruption.applied_impact_data for clean rollback.
        """
        backup: Dict[str, Any] = {}
        dtype = disruption.type
        target = disruption.target_id
        g = self.twin.graph.graph

        # 1. Road Closure / Route Failure
        if dtype in {DisruptionType.ROAD_CLOSURE, DisruptionType.ROUTE_FAILURE}:
            edge = _parse_edge(target)
            affected_edges = []
            if edge:
                u, v = edge
                for pair in [(u, v), (v, u)]:
                    if g.has_edge(*pair):
                        affected_edges.append(pair)
            elif target.isdigit():
                node = int(target)
                affected_edges.extend(list(g.in_edges(node)) + list(g.out_edges(node)))

            edge_backups = {}
            for u, v in affected_edges:
                edge_backups[f"{u}_{v}"] = {
                    "road_status": g.edges[u, v].get("road_status", "open"),
                    "travel_time": g.edges[u, v].get("current_travel_time", g.edges[u, v].get("base_travel_time", 1.0)),
                }
                g.edges[u, v]["road_status"] = "closed"
                g.edges[u, v]["current_travel_time"] = 999.0

            backup["edges"] = edge_backups
            self.twin.simulator.recompute_edge_travel_times()

        # 2. Road Accident / Extreme Weather
        elif dtype in {DisruptionType.ROAD_ACCIDENT, DisruptionType.EXTREME_WEATHER}:
            edge = _parse_edge(target)
            incident_ids = []
            if edge:
                u, v = edge
                pairs = [(u, v), (v, u)] if g.has_edge(v, u) else [(u, v)]
                for src, dst in pairs:
                    if g.has_edge(src, dst):
                        inc_id = f"inc-{disruption.id}-{src}-{dst}"
                        inc_type = "accident" if dtype == DisruptionType.ROAD_ACCIDENT else "weather"
                        incident = TrafficIncident(
                            id=inc_id,
                            source=src,
                            target=dst,
                            incident_type=inc_type,
                            severity=disruption.severity,
                            description=disruption.description or f"Dynamic {inc_type}"
                        )
                        self.twin.simulator.add_incident(incident)
                        incident_ids.append(inc_id)
            backup["incident_ids"] = incident_ids
            self.twin.simulator.recompute_edge_travel_times()

        # 3. Port Terminal Closure / Slowdown
        elif dtype in {DisruptionType.PORT_CLOSURE, DisruptionType.PORT_SLOWDOWN}:
            port_node = None
            for n, data in g.nodes(data=True):
                if data.get("facility_id") == target or data.get("type") == "port" or str(n) == target:
                    port_node = n
                    break

            if port_node is not None:
                backup["port_node"] = port_node
                backup["node_status"] = g.nodes[port_node].get("status", "ACTIVE")
                g.nodes[port_node]["status"] = "CLOSED" if dtype == DisruptionType.PORT_CLOSURE else "CONGESTED"

                edge_backups = {}
                connected_edges = list(g.in_edges(port_node)) + list(g.out_edges(port_node))
                for u, v in connected_edges:
                    edge_backups[f"{u}_{v}"] = {
                        "road_status": g.edges[u, v].get("road_status", "open"),
                        "speed": g.edges[u, v].get("speed", 50.0),
                    }
                    if dtype == DisruptionType.PORT_CLOSURE:
                        g.edges[u, v]["road_status"] = "closed"
                        g.edges[u, v]["current_travel_time"] = 999.0
                    else:
                        g.edges[u, v]["speed"] = max(5.0, g.edges[u, v].get("speed", 50.0) * (1.0 - disruption.severity * 0.8))

                backup["edges"] = edge_backups
                self.twin.simulator.recompute_edge_travel_times()

        # 4. Supplier Failure / Stockout
        elif dtype in {DisruptionType.SUPPLIER_FAILURE, DisruptionType.SUPPLIER_STOCKOUT}:
            supplier = self.twin.get_supplier(target)
            if supplier:
                backup["supplier_id"] = target
                backup["status"] = supplier.status
                backup["available_capacity"] = supplier.available_capacity

                if dtype == DisruptionType.SUPPLIER_FAILURE:
                    supplier.status = SupplierStatus.OFFLINE
                    supplier.available_capacity = 0.0
                else:
                    supplier.status = SupplierStatus.DISRUPTED
                    supplier.available_capacity = max(0.0, supplier.available_capacity * (1.0 - disruption.severity))

        # 5. Warehouse Failure / Slowdown
        elif dtype in {DisruptionType.WAREHOUSE_FAILURE, DisruptionType.WAREHOUSE_SLOWDOWN}:
            wh = self.twin.get_warehouse(target)
            if wh:
                backup["warehouse_id"] = target
                backup["status"] = wh.status
                backup["throughput_capacity"] = wh.throughput_capacity

                if dtype == DisruptionType.WAREHOUSE_FAILURE:
                    wh.status = WarehouseStatus.OFFLINE
                    wh.throughput_capacity = 0.0
                else:
                    wh.status = WarehouseStatus.CONGESTED
                    wh.throughput_capacity = max(1.0, wh.throughput_capacity * (1.0 - disruption.severity))

        # 6. Demand Spike
        elif dtype == DisruptionType.DEMAND_SPIKE:
            mult = disruption.parameters.get("multiplier", 1.0 + disruption.severity)
            order_backups = {}
            for oid, order in self.twin.orders.items():
                if order.customer_id == target or order.id == target or order.sku == target or target == "ALL":
                    order_backups[oid] = order.quantity
                    order.quantity = round(order.quantity * mult, 2)
            backup["orders"] = order_backups

        # 7. Data Blackout
        elif dtype == DisruptionType.DATA_BLACKOUT:
            # Degrade telemetry freshness on matching vehicle or facility
            vehicle = self.twin.get_vehicle(target)
            if vehicle:
                backup["vehicle_id"] = target
                backup["telemetry_freshness"] = vehicle.telemetry_freshness
                vehicle.telemetry_freshness = max(0.0, 1.0 - disruption.severity)
            else:
                backup["generic_target"] = target

        # 8. GPS Spoofing
        elif dtype == DisruptionType.GPS_SPOOF:
            vehicle = self.twin.get_vehicle(target)
            if vehicle:
                backup["vehicle_id"] = target
                backup["current_location"] = vehicle.current_location
                backup["is_suspect"] = vehicle.is_suspect
                backup["reported_location"] = vehicle.reported_location
                backup["actual_location"] = vehicle.actual_location

                # Record actual location
                vehicle.actual_location = vehicle.current_location
                # Generate spoofed reported location (+0.05 lat/lon offset or parameter)
                spoofed = disruption.parameters.get("reported_location")
                if not spoofed:
                    spoofed = (
                        round(vehicle.current_location[0] + 0.05, 4),
                        round(vehicle.current_location[1] + 0.05, 4)
                    )
                vehicle.reported_location = spoofed
                vehicle.current_location = spoofed
                vehicle.is_suspect = True

        disruption.applied_impact_data = backup

    def revert_physical_impact(self, disruption: Disruption):
        """
        Reverses all applied network and entity mutations cleanly using cached backup data.
        """
        backup = disruption.applied_impact_data
        if not backup:
            return

        g = self.twin.graph.graph
        dtype = disruption.type

        # 1. Road Closures / Route Failure Reversion
        if "edges" in backup:
            for key, state in backup["edges"].items():
                parts = key.split("_")
                u, v = int(parts[0]), int(parts[1])
                if g.has_edge(u, v):
                    g.edges[u, v]["road_status"] = state.get("road_status", "open")
                    g.edges[u, v]["speed"] = state.get("speed", g.edges[u, v].get("speed", 50.0))
            self.twin.simulator.recompute_edge_travel_times()

        # 2. Road Incident Reversion
        if "incident_ids" in backup:
            for inc_id in backup["incident_ids"]:
                self.twin.simulator.remove_incident(inc_id)

        # 3. Port Node Reversion
        if "port_node" in backup:
            pn = backup["port_node"]
            if g.has_node(pn):
                g.nodes[pn]["status"] = backup.get("node_status", "ACTIVE")

        # 4. Supplier Reversion
        if "supplier_id" in backup:
            s = self.twin.get_supplier(backup["supplier_id"])
            if s:
                s.status = backup.get("status", SupplierStatus.ACTIVE)
                s.available_capacity = backup.get("available_capacity", s.production_capacity)

        # 5. Warehouse Reversion
        if "warehouse_id" in backup:
            w = self.twin.get_warehouse(backup["warehouse_id"])
            if w:
                w.status = backup.get("status", WarehouseStatus.ACTIVE)
                w.throughput_capacity = backup.get("throughput_capacity", 800.0)

        # 6. Demand Spike Reversion
        if "orders" in backup:
            for oid, orig_qty in backup["orders"].items():
                o = self.twin.get_order(oid)
                if o:
                    o.quantity = orig_qty

        # 7. Data Blackout Reversion
        if "vehicle_id" in backup and "telemetry_freshness" in backup:
            v = self.twin.get_vehicle(backup["vehicle_id"])
            if v:
                v.telemetry_freshness = backup["telemetry_freshness"]

        # 8. GPS Spoof Reversion
        if "vehicle_id" in backup and "actual_location" in backup:
            v = self.twin.get_vehicle(backup["vehicle_id"])
            if v:
                v.current_location = backup.get("current_location", v.current_location)
                v.actual_location = backup.get("actual_location")
                v.reported_location = backup.get("reported_location")
                v.is_suspect = backup.get("is_suspect", False)

        disruption.applied_impact_data = {}

    def get_impact_summary(self, disruption_id: str) -> Dict[str, Any]:
        """Returns deterministic impact analysis for a specific disruption."""
        d = self.get_disruption(disruption_id)
        if d is None:
            raise KeyError(f"Disruption '{disruption_id}' not found.")
        return analyze_disruption_impact(d, self.twin)

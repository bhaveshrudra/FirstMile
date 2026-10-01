from typing import Dict, Any, List, Tuple, Set, Optional
from .models import Disruption, DisruptionType, DisruptionStatus
from ..digital_twin.engine import DigitalTwinEngine


def _parse_edge(target_id: str) -> Optional[Tuple[int, int]]:
    """Helper to parse 'u-v', 'u->v', or 'u_v' into an integer tuple (u, v)."""
    for sep in ["->", "-", "_", ","]:
        if sep in target_id:
            parts = [p.strip(" ()") for p in target_id.split(sep)]
            if len(parts) == 2 and parts[0].isdigit() and parts[1].isdigit():
                return int(parts[0]), int(parts[1])
    return None


def analyze_disruption_impact(disruption: Disruption, twin: DigitalTwinEngine) -> Dict[str, Any]:
    """
    Deterministic causal impact analysis for a single disruption against a Digital Twin.
    Evaluates affected transport links, shipments, orders, facilities, and generates
    a human-readable causal propagation chain.
    """
    affected_links: Set[Tuple[int, int]] = set()
    affected_shipments: Set[str] = set()
    affected_orders: Set[str] = set()
    affected_warehouses: Set[str] = set()
    affected_customers: Set[str] = set()
    affected_suppliers: Set[str] = set()
    impact_chain: List[str] = []

    dtype = disruption.type
    target = disruption.target_id

    # 1. Transport Link Disruptions (Road closure, accident, weather, route failure)
    if dtype in {DisruptionType.ROAD_CLOSURE, DisruptionType.ROAD_ACCIDENT,
                 DisruptionType.EXTREME_WEATHER, DisruptionType.ROUTE_FAILURE}:
        edge = _parse_edge(target)
        if edge:
            u, v = edge
            if twin.graph.graph.has_edge(u, v):
                affected_links.add((u, v))
            if twin.graph.graph.has_edge(v, u):
                affected_links.add((v, u))
        elif target.isdigit():
            node = int(target)
            if twin.graph.graph.has_node(node):
                affected_links.update(twin.graph.graph.in_edges(node))
                affected_links.update(twin.graph.graph.out_edges(node))

        # Check which shipments traverse these links
        for sid, shp in twin.shipments.items():
            route = shp.route
            if len(route) >= 2:
                for i in range(len(route) - 1):
                    seg = (route[i], route[i+1])
                    if seg in affected_links or (seg[1], seg[0]) in affected_links:
                        affected_shipments.add(sid)
                        break

        impact_chain.append(
            f"Transportation link {target} disrupted ({dtype.value}, severity {disruption.severity:.2f})"
        )
        if affected_shipments:
            impact_chain.append(
                f"{len(affected_shipments)} freight shipment(s) {sorted(list(affected_shipments))} traverse disrupted corridor"
            )
        else:
            impact_chain.append("No active scheduled shipments currently traverse this corridor")

    # 2. Port Terminal Disruptions
    elif dtype in {DisruptionType.PORT_CLOSURE, DisruptionType.PORT_SLOWDOWN}:
        # Find port node (typically node 4 / facility P1 in PNT1 seed)
        port_node = None
        for n, data in twin.graph.graph.nodes(data=True):
            if data.get("facility_id") == target or data.get("type") == "port" or str(n) == target:
                port_node = n
                break

        if port_node is not None:
            affected_links.update(twin.graph.graph.in_edges(port_node))
            affected_links.update(twin.graph.graph.out_edges(port_node))

        # Find shipments starting, ending, or routing through port
        for sid, shp in twin.shipments.items():
            if shp.origin_id == target or shp.destination_id == target or (port_node and port_node in shp.route):
                affected_shipments.add(sid)

        impact_chain.append(
            f"Intermodal Port Terminal {target} disrupted ({dtype.value}, capacity loss: {disruption.severity * 100:.0f}%)"
        )
        impact_chain.append(
            f"{len(affected_links)} connected multimodal rail/maritime/highway link(s) degraded"
        )
        if affected_shipments:
            impact_chain.append(
                f"Inbound/outbound freight shipments {sorted(list(affected_shipments))} delayed at terminal"
            )

    # 3. Supplier Disruptions
    elif dtype in {DisruptionType.SUPPLIER_FAILURE, DisruptionType.SUPPLIER_STOCKOUT}:
        affected_suppliers.add(target)
        # Find shipments originating from supplier
        for sid, shp in twin.shipments.items():
            if shp.origin_id == target:
                affected_shipments.add(sid)

        impact_chain.append(
            f"Supplier {target} production halted/degraded ({dtype.value}, severity {disruption.severity:.2f})"
        )
        if affected_shipments:
            impact_chain.append(
                f"Outbound dispatch shipments {sorted(list(affected_shipments))} stalled at origin"
            )

    # 4. Warehouse Disruptions
    elif dtype in {DisruptionType.WAREHOUSE_FAILURE, DisruptionType.WAREHOUSE_SLOWDOWN}:
        affected_warehouses.add(target)
        for sid, shp in twin.shipments.items():
            if shp.origin_id == target or shp.destination_id == target:
                affected_shipments.add(sid)

        for oid, order in twin.orders.items():
            if order.source_warehouse_id == target:
                affected_orders.add(oid)

        impact_chain.append(
            f"Distribution Center {target} disrupted ({dtype.value}, handling capacity reduced)"
        )
        impact_chain.append(
            f"Warehouse inventory stock and throughput at {target} unavailable"
        )
        if affected_orders:
            impact_chain.append(
                f"{len(affected_orders)} customer orders sourced from {target} cannot be fulfilled"
            )

    # 5. Demand Spike Disruptions
    elif dtype == DisruptionType.DEMAND_SPIKE:
        multiplier = disruption.parameters.get("multiplier", 1.5)
        for oid, order in twin.orders.items():
            if order.customer_id == target or order.id == target or order.sku == target or target == "ALL":
                affected_orders.add(oid)
                affected_customers.add(order.customer_id)
                if order.source_warehouse_id:
                    affected_warehouses.add(order.source_warehouse_id)

        impact_chain.append(
            f"Demand surge spike ({multiplier:.2f}x) injected for target {target}"
        )
        impact_chain.append(
            f"{len(affected_orders)} customer orders scaled up, straining warehouse safety stock"
        )

    # 6. Data Blackout / Sensor Telemetry Loss
    elif dtype == DisruptionType.DATA_BLACKOUT:
        impact_chain.append(
            f"Telemetry data blackout on target {target} (freshness degraded to {(1.0 - disruption.severity):.2f})"
        )
        for sid, shp in twin.shipments.items():
            if shp.vehicle_id == target or shp.origin_id == target or shp.destination_id == target:
                affected_shipments.add(sid)

        if affected_shipments:
            impact_chain.append(
                f"Real-time location and telemetry lost for active shipments {sorted(list(affected_shipments))}"
            )

    # 7. GPS Spoofing
    elif dtype == DisruptionType.GPS_SPOOF:
        impact_chain.append(
            f"Adversarial GPS coordinates injected into transport vehicle {target}"
        )
        for sid, shp in twin.shipments.items():
            if shp.vehicle_id == target:
                affected_shipments.add(sid)

        impact_chain.append(
            f"Vehicle {target} marked as suspect; reported coordinates deviate from actual physical path"
        )

    # Secondary Cascade: Resolve orders, customers, and warehouses from affected shipments
    for sid in affected_shipments:
        shp = twin.get_shipment(sid)
        if shp:
            if shp.order_id:
                affected_orders.add(shp.order_id)
            if shp.origin_id in twin.warehouses:
                affected_warehouses.add(shp.origin_id)
            elif shp.origin_id in twin.suppliers:
                affected_suppliers.add(shp.origin_id)
            if shp.destination_id in twin.customers:
                affected_customers.add(shp.destination_id)
            elif shp.destination_id in twin.warehouses:
                affected_warehouses.add(shp.destination_id)

    # Tertiary Cascade: Resolve customers from affected orders
    for oid in affected_orders:
        order = twin.get_order(oid)
        if order:
            affected_customers.add(order.customer_id)
            if order.source_warehouse_id in twin.warehouses:
                affected_warehouses.add(order.source_warehouse_id)

    if affected_orders and len(impact_chain) > 1 and "customer orders" not in impact_chain[-1]:
        impact_chain.append(
            f"Cascading SLA risk onto {len(affected_orders)} customer orders {sorted(list(affected_orders))}"
        )
    if affected_customers and len(impact_chain) > 1 and "customer" not in impact_chain[-1]:
        impact_chain.append(
            f"Service level degradation at customer destination(s) {sorted(list(affected_customers))}"
        )

    return {
        "disruption_id": disruption.id,
        "disruption_type": disruption.type.value,
        "target_id": disruption.target_id,
        "severity": disruption.severity,
        "affected_shipments": sorted(list(affected_shipments)),
        "affected_orders": sorted(list(affected_orders)),
        "affected_warehouses": sorted(list(affected_warehouses)),
        "affected_customers": sorted(list(affected_customers)),
        "affected_suppliers": sorted(list(affected_suppliers)),
        "affected_links": sorted(list(affected_links)),
        "impact_chain": impact_chain,
    }


def analyze_twin_impact(twin: DigitalTwinEngine) -> Dict[str, Any]:
    """
    Computes aggregated impact metrics across all currently ACTIVE disruptions in a Digital Twin.
    """
    all_links: Set[Tuple[int, int]] = set()
    all_shipments: Set[str] = set()
    all_orders: Set[str] = set()
    all_warehouses: Set[str] = set()
    all_customers: Set[str] = set()
    all_suppliers: Set[str] = set()
    all_chains: List[str] = []

    active_disruptions = [
        d for d in twin.disruptions.values()
        if (getattr(d, "status", None) == DisruptionStatus.ACTIVE
            or getattr(d, "status", None) == "ACTIVE")
    ]

    for d in active_disruptions:
        res = analyze_disruption_impact(d, twin)
        all_links.update(res["affected_links"])
        all_shipments.update(res["affected_shipments"])
        all_orders.update(res["affected_orders"])
        all_warehouses.update(res["affected_warehouses"])
        all_customers.update(res["affected_customers"])
        all_suppliers.update(res["affected_suppliers"])
        all_chains.extend(res["impact_chain"])

    return {
        "active_disruptions_count": len(active_disruptions),
        "affected_shipments_count": len(all_shipments),
        "affected_orders_count": len(all_orders),
        "affected_warehouses_count": len(all_warehouses),
        "affected_customers_count": len(all_customers),
        "affected_suppliers_count": len(all_suppliers),
        "affected_links_count": len(all_links),
        "affected_shipments": sorted(list(all_shipments)),
        "affected_orders": sorted(list(all_orders)),
        "affected_warehouses": sorted(list(all_warehouses)),
        "affected_customers": sorted(list(all_customers)),
        "affected_suppliers": sorted(list(all_suppliers)),
        "affected_links": sorted(list(all_links)),
        "impact_chains": all_chains,
    }

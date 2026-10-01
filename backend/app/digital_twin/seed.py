"""
PNT1 Logistics Network Digital Twin - Seed Scenario Factory
Provides a deterministic regional supply chain network (SF Bay Area)
connecting Suppliers, Intermodal Port, Warehouses, and Customer Demands.
"""

from ..graph.graph_generator import generate_logistics_sample_graph
from .engine import DigitalTwinEngine
from ..models.supplier import Supplier, SupplierStatus
from ..models.warehouse import Warehouse, WarehouseStatus
from ..models.vehicle import Vehicle, VehicleType, VehicleStatus
from ..models.customer import Customer, CustomerStatus
from ..models.inventory import InventoryItem
from ..models.order import Order, OrderStatus
from ..models.shipment import Shipment, ShipmentStatus


def create_pnt1_seed_twin() -> DigitalTwinEngine:
    """
    Constructs and populates a deterministic PNT1 logistics digital twin:
      - Multimodal regional transport network (Road, Rail, Ocean)
      - 2 Suppliers (Apex Microelectronics, Pacific Precision Parts)
      - 2 Warehouses (Bay Gateway DC, Silicon Valley Hub)
      - 1 Intermodal Maritime & Rail Port (Port of Oakland)
      - 6 Customer Outlets & Medical Centers
      - 6 Transport Fleet Assets (Trucks, Freight Train, Coastal Barge)
      - 6 Active Inventory Stocks across 3 core SKUs
      - 10 Customer Demands/Orders
      - 5 Physical Freight Shipments
    """
    # 1. Create the logistics graph and twin engine
    graph = generate_logistics_sample_graph()
    twin = DigitalTwinEngine(graph=graph, name="PNT1-Seed-Scenario")

    # 2. Add Suppliers (Graph Node 0: S1, Node 1: S2)
    twin.add_supplier(Supplier(
        id="S1",
        name="Apex Microelectronics (S1)",
        location=(37.9500, -122.3500),
        node_id=0,
        production_capacity=1500.0,
        available_capacity=1200.0,
        reliability=0.98,
        lead_time_hours=24.0,
        status=SupplierStatus.ACTIVE
    ))
    twin.add_supplier(Supplier(
        id="S2",
        name="Pacific Precision Parts (S2)",
        location=(37.6000, -122.0500),
        node_id=1,
        production_capacity=2000.0,
        available_capacity=1700.0,
        reliability=0.95,
        lead_time_hours=18.0,
        status=SupplierStatus.ACTIVE
    ))

    # 3. Add Warehouses (Graph Node 2: W1, Node 3: W2)
    twin.add_warehouse(Warehouse(
        id="W1",
        name="Bay Gateway DC (W1)",
        location=(37.8000, -122.2500),
        node_id=2,
        storage_capacity=10000.0,
        current_utilization=6500.0,
        throughput_capacity=800.0,
        status=WarehouseStatus.ACTIVE
    ))
    twin.add_warehouse(Warehouse(
        id="W2",
        name="Silicon Valley Hub (W2)",
        location=(37.7000, -122.1500),
        node_id=3,
        storage_capacity=12000.0,
        current_utilization=7200.0,
        throughput_capacity=1000.0,
        status=WarehouseStatus.ACTIVE
    ))

    # 4. Add Fleet Vehicles
    twin.add_vehicle(Vehicle(
        id="V1",
        vehicle_type=VehicleType.TRUCK,
        capacity=250.0,
        current_location=(37.8000, -122.2500),
        current_node_id=2,
        status=VehicleStatus.IN_TRANSIT,
        speed_kph=65.0,
        fuel_level=0.90,
        max_range_km=800.0
    ))
    twin.add_vehicle(Vehicle(
        id="V2",
        vehicle_type=VehicleType.TRUCK,
        capacity=250.0,
        current_location=(37.8000, -122.2500),
        current_node_id=2,
        status=VehicleStatus.IN_TRANSIT,
        speed_kph=65.0,
        fuel_level=0.85,
        max_range_km=800.0
    ))
    twin.add_vehicle(Vehicle(
        id="V3",
        vehicle_type=VehicleType.TRUCK,
        capacity=300.0,
        current_location=(37.7000, -122.1500),
        current_node_id=3,
        status=VehicleStatus.IN_TRANSIT,
        speed_kph=60.0,
        fuel_level=0.95,
        max_range_km=750.0
    ))
    twin.add_vehicle(Vehicle(
        id="V4",
        vehicle_type=VehicleType.TRUCK,
        capacity=150.0,
        current_location=(37.7000, -122.1500),
        current_node_id=3,
        status=VehicleStatus.AVAILABLE,
        speed_kph=70.0,
        fuel_level=0.80,
        max_range_km=600.0
    ))
    twin.add_vehicle(Vehicle(
        id="V5",
        vehicle_type=VehicleType.RAIL,
        capacity=2000.0,
        current_location=(37.8100, -122.3200),
        current_node_id=4,
        status=VehicleStatus.IN_TRANSIT,
        speed_kph=45.0,
        fuel_level=1.00,
        max_range_km=1500.0
    ))
    twin.add_vehicle(Vehicle(
        id="V6",
        vehicle_type=VehicleType.SHIP,
        capacity=5000.0,
        current_location=(37.8100, -122.3200),
        current_node_id=4,
        status=VehicleStatus.AVAILABLE,
        speed_kph=25.0,
        fuel_level=1.00,
        max_range_km=3000.0
    ))

    # 5. Add Customers (Graph Nodes 5 .. 10)
    twin.add_customer(Customer(
        id="C1",
        name="Metro Supercenter SF (C1)",
        location=(37.7800, -122.4200),
        node_id=5,
        priority=1,
        service_level=0.98,
        status=CustomerStatus.ACTIVE
    ))
    twin.add_customer(Customer(
        id="C2",
        name="Mission Commercial Depot (C2)",
        location=(37.7500, -122.4000),
        node_id=6,
        priority=2,
        service_level=0.95,
        status=CustomerStatus.ACTIVE
    ))
    twin.add_customer(Customer(
        id="C3",
        name="Berkeley Tech Outlet (C3)",
        location=(37.8700, -122.2700),
        node_id=7,
        priority=2,
        service_level=0.95,
        status=CustomerStatus.ACTIVE
    ))
    twin.add_customer(Customer(
        id="C4",
        name="Piedmont Supply Point (C4)",
        location=(37.8300, -122.2000),
        node_id=8,
        priority=3,
        service_level=0.90,
        status=CustomerStatus.ACTIVE
    ))
    twin.add_customer(Customer(
        id="C5",
        name="Peninsula Medical Center (C5)",
        location=(37.6800, -122.4700),
        node_id=9,
        priority=5,
        service_level=0.99,
        status=CustomerStatus.ACTIVE
    ))
    twin.add_customer(Customer(
        id="C6",
        name="Silicon Valley Outlet (C6)",
        location=(37.5500, -122.3000),
        node_id=10,
        priority=1,
        service_level=0.95,
        status=CustomerStatus.ACTIVE
    ))

    # 6. Add Inventory Across Both Warehouses
    inventory_data = [
        # Warehouse W1
        ("SKU-MED-CHIP", "W1", 1200.0, 200.0, 300.0, 500.0, 45.0),
        ("SKU-IND-SENSOR", "W1", 2500.0, 500.0, 400.0, 800.0, 18.5),
        ("SKU-AUTO-MODULE", "W1", 800.0, 150.0, 200.0, 300.0, 120.0),
        # Warehouse W2
        ("SKU-MED-CHIP", "W2", 800.0, 100.0, 250.0, 400.0, 45.0),
        ("SKU-IND-SENSOR", "W2", 3000.0, 400.0, 500.0, 1000.0, 18.5),
        ("SKU-AUTO-MODULE", "W2", 1500.0, 300.0, 300.0, 500.0, 120.0),
    ]
    for sku, wh_id, on_hand, reserved, safety, reorder, cost in inventory_data:
        twin.add_inventory_item(InventoryItem(
            sku=sku,
            warehouse_id=wh_id,
            on_hand=on_hand,
            reserved=reserved,
            safety_stock=safety,
            reorder_point=reorder,
            unit_cost=cost
        ))

    # 7. Add Orders
    orders_data = [
        ("ORD-001", "C1", "SKU-MED-CHIP", 50.0, 2, 10.0, 14.0, OrderStatus.IN_TRANSIT, "W1"),
        ("ORD-002", "C3", "SKU-IND-SENSOR", 120.0, 1, 10.5, 13.5, OrderStatus.IN_TRANSIT, "W1"),
        ("ORD-003", "C4", "SKU-AUTO-MODULE", 30.0, 3, 11.0, 15.0, OrderStatus.ALLOCATED, "W1"),
        ("ORD-004", "C2", "SKU-MED-CHIP", 40.0, 2, 11.2, 16.0, OrderStatus.ALLOCATED, "W1"),
        ("ORD-005", "C5", "SKU-MED-CHIP", 80.0, 5, 11.5, 14.5, OrderStatus.IN_TRANSIT, "W2"),
        ("ORD-006", "C6", "SKU-AUTO-MODULE", 60.0, 1, 9.0, 12.0, OrderStatus.DELIVERED, "W2"),
        ("ORD-007", "C6", "SKU-IND-SENSOR", 150.0, 2, 11.8, 16.0, OrderStatus.ALLOCATED, "W2"),
        ("ORD-008", "C1", "SKU-IND-SENSOR", 200.0, 1, 12.0, 17.0, OrderStatus.PENDING, "W1"),
        ("ORD-009", "C3", "SKU-AUTO-MODULE", 25.0, 2, 12.0, 18.0, OrderStatus.PENDING, "W1"),
        ("ORD-010", "C5", "SKU-IND-SENSOR", 90.0, 4, 12.0, 15.5, OrderStatus.PENDING, "W2"),
    ]
    for oid, cid, sku, qty, prio, ot, pdt, status, wh in orders_data:
        twin.add_order(Order(
            id=oid,
            customer_id=cid,
            sku=sku,
            quantity=qty,
            priority=prio,
            order_time=ot,
            promised_delivery_time=pdt,
            status=status,
            source_warehouse_id=wh
        ))

    # 8. Add Shipments (with realistic node sequences from W1/W2/P1 to destinations)
    shipments_data = [
        ("SHP-001", "ORD-001", "V1", "W1", "C1", 50.0, [2, 11, 5], ShipmentStatus.IN_TRANSIT, 12.0, 13.5),
        ("SHP-002", "ORD-002", "V2", "W1", "C3", 120.0, [2, 7], ShipmentStatus.IN_TRANSIT, 12.2, 13.0),
        ("SHP-003", "ORD-005", "V3", "W2", "C5", 80.0, [3, 13, 14, 9], ShipmentStatus.IN_TRANSIT, 12.0, 14.2),
        ("SHP-004", "ORD-006", "V4", "W2", "C6", 60.0, [3, 13, 14, 10], ShipmentStatus.DELIVERED, 10.0, 11.3),
        ("SHP-005", "ORD-001", "V5", "P1", "W1", 500.0, [4, 2], ShipmentStatus.IN_TRANSIT, 11.5, 12.8),
    ]
    for sid, oid, vid, orig, dest, qty, route, status, dept, eta in shipments_data:
        twin.add_shipment(Shipment(
            id=sid,
            order_id=oid,
            vehicle_id=vid,
            origin_id=orig,
            destination_id=dest,
            quantity=qty,
            route=route,
            status=status,
            departure_time=dept,
            eta=eta
        ))

    # Synchronize simulation clock to noon
    twin.update_simulation_time(12.0)
    return twin

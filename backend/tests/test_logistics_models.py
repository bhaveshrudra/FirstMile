import pytest
from pydantic import ValidationError

from backend.app.models.supplier import Supplier, SupplierStatus
from backend.app.models.warehouse import Warehouse, WarehouseStatus
from backend.app.models.vehicle import Vehicle, VehicleType, VehicleStatus
from backend.app.models.customer import Customer, CustomerStatus
from backend.app.models.inventory import InventoryItem
from backend.app.models.order import Order, OrderStatus
from backend.app.models.shipment import Shipment, ShipmentStatus


def test_supplier_valid_construction():
    supplier = Supplier(
        id="SUP-001",
        name="Apex Manufacturing",
        location=(37.7749, -122.4194),
        node_id=1,
        production_capacity=1000.0,
        available_capacity=800.0,
        reliability=0.98,
        lead_time_hours=24.0,
        status=SupplierStatus.ACTIVE
    )
    assert supplier.id == "SUP-001"
    assert supplier.name == "Apex Manufacturing"
    assert supplier.status == SupplierStatus.ACTIVE
    assert supplier.reliability == 0.98
    assert supplier.available_capacity == 800.0


def test_supplier_validation_rules():
    # Negative capacity
    with pytest.raises(ValidationError):
        Supplier(
            id="SUP-ERR",
            name="Bad Supplier",
            location=(37.77, -122.41),
            production_capacity=-10.0,
            available_capacity=5.0,
            reliability=0.9,
            lead_time_hours=12.0
        )

    # Reliability > 1.0
    with pytest.raises(ValidationError):
        Supplier(
            id="SUP-ERR",
            name="Bad Supplier",
            location=(37.77, -122.41),
            production_capacity=100.0,
            available_capacity=50.0,
            reliability=1.5,
            lead_time_hours=12.0
        )

    # Reliability < 0.0
    with pytest.raises(ValidationError):
        Supplier(
            id="SUP-ERR",
            name="Bad Supplier",
            location=(37.77, -122.41),
            production_capacity=100.0,
            available_capacity=50.0,
            reliability=-0.1,
            lead_time_hours=12.0
        )

    # Available capacity > production capacity
    with pytest.raises(ValidationError):
        Supplier(
            id="SUP-ERR",
            name="Bad Supplier",
            location=(37.77, -122.41),
            production_capacity=100.0,
            available_capacity=150.0,
            reliability=0.9,
            lead_time_hours=12.0
        )

    # Invalid latitude
    with pytest.raises(ValidationError):
        Supplier(
            id="SUP-ERR",
            name="Bad Location",
            location=(95.0, -122.41),
            production_capacity=100.0,
            available_capacity=50.0,
            reliability=0.9,
            lead_time_hours=12.0
        )


def test_warehouse_valid_construction_and_properties():
    wh = Warehouse(
        id="WH-BAY-01",
        name="Bay Area Central DC",
        location=(37.8044, -122.2712),
        node_id=0,
        storage_capacity=5000.0,
        current_utilization=3500.0,
        throughput_capacity=500.0,
        status=WarehouseStatus.ACTIVE
    )
    assert wh.id == "WH-BAY-01"
    assert wh.available_storage == 1500.0
    assert pytest.approx(wh.utilization_rate) == 0.7


def test_warehouse_validation():
    # Utilization > capacity
    with pytest.raises(ValidationError):
        Warehouse(
            id="WH-ERR",
            name="Overfilled DC",
            location=(37.80, -122.27),
            storage_capacity=1000.0,
            current_utilization=1200.0,
            throughput_capacity=200.0
        )

    # Negative storage capacity
    with pytest.raises(ValidationError):
        Warehouse(
            id="WH-ERR",
            name="Negative DC",
            location=(37.80, -122.27),
            storage_capacity=-500.0,
            current_utilization=0.0,
            throughput_capacity=200.0
        )


def test_vehicle_valid_construction():
    truck = Vehicle(
        id="TRK-101",
        vehicle_type=VehicleType.TRUCK,
        capacity=250.0,
        current_location=(37.7749, -122.4194),
        status=VehicleStatus.AVAILABLE,
        speed_kph=65.0,
        fuel_level=0.85,
        max_range_km=800.0
    )
    assert truck.vehicle_type == VehicleType.TRUCK
    assert truck.capacity == 250.0
    assert truck.fuel_level == 0.85


def test_vehicle_validation():
    # Non-positive capacity
    with pytest.raises(ValidationError):
        Vehicle(
            id="TRK-ERR",
            capacity=0.0,
            current_location=(37.77, -122.41),
            speed_kph=60.0,
            fuel_level=0.5,
            max_range_km=500.0
        )

    # Invalid fuel level > 1.0
    with pytest.raises(ValidationError):
        Vehicle(
            id="TRK-ERR",
            capacity=100.0,
            current_location=(37.77, -122.41),
            speed_kph=60.0,
            fuel_level=1.2,
            max_range_km=500.0
        )


def test_customer_valid_and_validation():
    cust = Customer(
        id="CUST-42",
        name="Metro Supermarket",
        location=(37.7833, -122.4167),
        priority=3,
        service_level=0.98,
        status=CustomerStatus.ACTIVE
    )
    assert cust.priority == 3
    assert cust.service_level == 0.98

    # Invalid priority out of bounds (1..5)
    with pytest.raises(ValidationError):
        Customer(
            id="CUST-ERR",
            name="Invalid",
            location=(37.78, -122.41),
            priority=10
        )


def test_inventory_item_valid_and_helpers():
    inv = InventoryItem(
        sku="SKU-MICROCHIP-A1",
        warehouse_id="WH-BAY-01",
        on_hand=100.0,
        reserved=25.0,
        safety_stock=20.0,
        reorder_point=40.0,
        unit_cost=15.50
    )
    assert inv.available == 75.0
    assert not inv.is_below_reorder_point
    assert not inv.is_stockout

    # Test reorder point flag
    low_stock = InventoryItem(
        sku="SKU-LOW",
        warehouse_id="WH-BAY-01",
        on_hand=30.0,
        reserved=10.0,
        safety_stock=20.0,
        reorder_point=40.0,
        unit_cost=5.0
    )
    assert low_stock.is_below_reorder_point
    assert low_stock.available == 20.0


def test_inventory_item_validation():
    # Reserved > on_hand
    with pytest.raises(ValidationError):
        InventoryItem(
            sku="SKU-OVERRESERVED",
            warehouse_id="WH-01",
            on_hand=50.0,
            reserved=60.0,
            safety_stock=10.0,
            reorder_point=20.0,
            unit_cost=10.0
        )

    # Negative on_hand
    with pytest.raises(ValidationError):
        InventoryItem(
            sku="SKU-NEG",
            warehouse_id="WH-01",
            on_hand=-5.0,
            reserved=0.0,
            reorder_point=10.0,
            unit_cost=1.0
        )


def test_order_valid_and_validation():
    order = Order(
        id="ORD-1001",
        customer_id="CUST-42",
        sku="SKU-MICROCHIP-A1",
        quantity=15.0,
        priority=2,
        order_time=12.0,
        promised_delivery_time=16.0,
        status=OrderStatus.PENDING
    )
    assert order.id == "ORD-1001"
    assert order.quantity == 15.0
    assert order.status == OrderStatus.PENDING

    # Non-positive quantity
    with pytest.raises(ValidationError):
        Order(
            id="ORD-ERR",
            customer_id="CUST-42",
            sku="SKU-A",
            quantity=0.0,
            order_time=10.0,
            promised_delivery_time=14.0
        )

    # Promised time before order time
    with pytest.raises(ValidationError):
        Order(
            id="ORD-ERR",
            customer_id="CUST-42",
            sku="SKU-A",
            quantity=10.0,
            order_time=15.0,
            promised_delivery_time=12.0
        )


def test_shipment_valid_and_validation():
    shipment = Shipment(
        id="SHP-5001",
        order_id="ORD-1001",
        vehicle_id="TRK-101",
        origin_id="WH-BAY-01",
        destination_id="CUST-42",
        quantity=15.0,
        route=[0, 1, 4, 8],
        status=ShipmentStatus.PLANNED,
        departure_time=12.5,
        eta=14.0
    )
    assert shipment.id == "SHP-5001"
    assert shipment.route == [0, 1, 4, 8]
    assert shipment.status == ShipmentStatus.PLANNED

    # ETA before departure time
    with pytest.raises(ValidationError):
        Shipment(
            id="SHP-ERR",
            order_id="ORD-1001",
            origin_id="WH-01",
            destination_id="CUST-42",
            quantity=10.0,
            departure_time=14.0,
            eta=12.0
        )

    # Non-positive quantity
    with pytest.raises(ValidationError):
        Shipment(
            id="SHP-ERR",
            order_id="ORD-1001",
            origin_id="WH-01",
            destination_id="CUST-42",
            quantity=-5.0
        )

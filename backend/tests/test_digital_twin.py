import json
import pytest

from backend.app.digital_twin.engine import DigitalTwinEngine
from backend.app.digital_twin.snapshot import SnapshotManager, DigitalTwinSnapshot
from backend.app.models.supplier import Supplier, SupplierStatus
from backend.app.models.warehouse import Warehouse, WarehouseStatus
from backend.app.models.vehicle import Vehicle, VehicleType, VehicleStatus
from backend.app.models.customer import Customer, CustomerStatus
from backend.app.models.inventory import InventoryItem
from backend.app.models.order import Order, OrderStatus
from backend.app.models.shipment import Shipment, ShipmentStatus
from backend.app.api import state


# 1. Empty twin initializes correctly
def test_empty_twin_initializes_correctly():
    twin = DigitalTwinEngine(name="test_twin")
    assert twin.name == "test_twin"
    assert twin.version == 1
    assert len(twin.suppliers) == 0
    assert len(twin.warehouses) == 0
    assert len(twin.vehicles) == 0
    assert len(twin.customers) == 0
    assert len(twin.inventory) == 0
    assert len(twin.orders) == 0
    assert len(twin.shipments) == 0
    assert twin.graph is not None
    assert twin.simulator is not None
    assert twin.simulation_time == 12.0


# 2. Supplier can be added/retrieved
def test_supplier_add_get_remove():
    twin = DigitalTwinEngine()
    supplier = Supplier(
        id="SUP-01",
        name="SF Components",
        location=(37.77, -122.41),
        production_capacity=500.0,
        available_capacity=450.0,
        reliability=0.99,
        lead_time_hours=12.0,
        status=SupplierStatus.ACTIVE
    )
    twin.add_supplier(supplier)
    retrieved = twin.get_supplier("SUP-01")
    assert retrieved is not None
    assert retrieved.name == "SF Components"
    assert len(twin.list_suppliers()) == 1

    assert twin.remove_supplier("SUP-01") is True
    assert twin.get_supplier("SUP-01") is None
    assert len(twin.list_suppliers()) == 0


# 3. Warehouse can be added/retrieved
def test_warehouse_add_get_remove():
    twin = DigitalTwinEngine()
    wh = Warehouse(
        id="WH-01",
        name="Oakland Hub",
        location=(37.80, -122.27),
        storage_capacity=2000.0,
        current_utilization=1000.0,
        throughput_capacity=150.0,
        status=WarehouseStatus.ACTIVE
    )
    twin.add_warehouse(wh)
    retrieved = twin.get_warehouse("WH-01")
    assert retrieved is not None
    assert retrieved.storage_capacity == 2000.0
    assert retrieved.available_storage == 1000.0

    assert twin.remove_warehouse("WH-01") is True
    assert twin.get_warehouse("WH-01") is None


# 4. Vehicle can be added/retrieved
def test_vehicle_add_get_remove():
    twin = DigitalTwinEngine()
    veh = Vehicle(
        id="VEH-TRK-1",
        vehicle_type=VehicleType.TRUCK,
        capacity=150.0,
        current_location=(37.78, -122.42),
        status=VehicleStatus.AVAILABLE,
        speed_kph=55.0,
        fuel_level=0.9,
        max_range_km=600.0
    )
    twin.add_vehicle(veh)
    retrieved = twin.get_vehicle("VEH-TRK-1")
    assert retrieved is not None
    assert retrieved.capacity == 150.0

    assert twin.remove_vehicle("VEH-TRK-1") is True
    assert twin.get_vehicle("VEH-TRK-1") is None


# 5. Customer can be added/retrieved
def test_customer_add_get_remove():
    twin = DigitalTwinEngine()
    cust = Customer(
        id="CUST-01",
        name="Market St Grocery",
        location=(37.78, -122.41),
        priority=2,
        service_level=0.95,
        status=CustomerStatus.ACTIVE
    )
    twin.add_customer(cust)
    retrieved = twin.get_customer("CUST-01")
    assert retrieved is not None
    assert retrieved.priority == 2

    assert twin.remove_customer("CUST-01") is True
    assert twin.get_customer("CUST-01") is None


# 6. Inventory can be added/retrieved
def test_inventory_add_get_remove():
    twin = DigitalTwinEngine()
    item = InventoryItem(
        sku="SKU-CHIP-10",
        warehouse_id="WH-01",
        on_hand=500.0,
        reserved=50.0,
        safety_stock=50.0,
        reorder_point=100.0,
        unit_cost=25.0
    )
    twin.add_inventory_item(item)
    retrieved = twin.get_inventory("WH-01", "SKU-CHIP-10")
    assert retrieved is not None
    assert retrieved.available == 450.0

    # Multi-warehouse listing
    item2 = InventoryItem(
        sku="SKU-CHIP-10",
        warehouse_id="WH-02",
        on_hand=300.0,
        reserved=0.0,
        reorder_point=50.0,
        unit_cost=25.0
    )
    twin.add_inventory_item(item2)
    assert len(twin.list_inventory()) == 2
    assert len(twin.list_inventory(warehouse_id="WH-01")) == 1

    assert twin.remove_inventory_item("WH-01", "SKU-CHIP-10") is True
    assert twin.get_inventory("WH-01", "SKU-CHIP-10") is None
    assert twin.get_inventory("WH-02", "SKU-CHIP-10") is not None


# 7. Order can be added/retrieved
def test_order_add_get_remove():
    twin = DigitalTwinEngine()
    order = Order(
        id="ORD-101",
        customer_id="CUST-01",
        sku="SKU-CHIP-10",
        quantity=20.0,
        priority=1,
        order_time=12.0,
        promised_delivery_time=15.0,
        status=OrderStatus.PENDING
    )
    twin.add_order(order)
    retrieved = twin.get_order("ORD-101")
    assert retrieved is not None
    assert retrieved.quantity == 20.0
    assert len(twin.list_orders(status=OrderStatus.PENDING)) == 1

    assert twin.remove_order("ORD-101") is True
    assert twin.get_order("ORD-101") is None


# 8. Shipment can be added/retrieved
def test_shipment_add_get_remove():
    twin = DigitalTwinEngine()
    shipment = Shipment(
        id="SHP-201",
        order_id="ORD-101",
        vehicle_id="VEH-TRK-1",
        origin_id="WH-01",
        destination_id="CUST-01",
        quantity=20.0,
        route=[0, 1, 3],
        status=ShipmentStatus.PLANNED,
        departure_time=12.5,
        eta=13.5
    )
    twin.add_shipment(shipment)
    retrieved = twin.get_shipment("SHP-201")
    assert retrieved is not None
    assert retrieved.route == [0, 1, 3]

    assert twin.remove_shipment("SHP-201") is True
    assert twin.get_shipment("SHP-201") is None


# 9. Summary returns correct counts
def test_get_summary_counts():
    twin = DigitalTwinEngine()
    twin.add_supplier(Supplier(
        id="S1", name="S1", location=(37.77, -122.41), production_capacity=100.0,
        available_capacity=100.0, reliability=1.0, lead_time_hours=5.0
    ))
    twin.add_warehouse(Warehouse(
        id="W1", name="W1", location=(37.77, -122.41), storage_capacity=100.0,
        current_utilization=50.0, throughput_capacity=10.0
    ))
    twin.add_vehicle(Vehicle(
        id="V1", capacity=50.0, current_location=(37.77, -122.41), speed_kph=50.0,
        fuel_level=1.0, max_range_km=400.0
    ))
    twin.add_customer(Customer(
        id="C1", name="C1", location=(37.77, -122.41)
    ))
    twin.add_inventory_item(InventoryItem(
        sku="SKU1", warehouse_id="W1", on_hand=100.0, reorder_point=20.0, unit_cost=5.0
    ))
    twin.add_order(Order(
        id="O1", customer_id="C1", sku="SKU1", quantity=10.0, order_time=10.0, promised_delivery_time=12.0
    ))
    twin.add_shipment(Shipment(
        id="SH1", order_id="O1", origin_id="W1", destination_id="C1", quantity=10.0
    ))

    summary = twin.get_summary()
    assert summary["supplier_count"] == 1
    assert summary["warehouse_count"] == 1
    assert summary["vehicle_count"] == 1
    assert summary["customer_count"] == 1
    assert summary["inventory_item_count"] == 1
    assert summary["order_count"] == 1
    assert summary["shipment_count"] == 1
    assert summary["active_disruptions"] == 0
    assert summary["graph_node_count"] > 0
    assert summary["graph_edge_count"] > 0


# 10. to_dict() is JSON serializable
def test_to_dict_json_serializable():
    twin = DigitalTwinEngine()
    twin.add_supplier(Supplier(
        id="S1", name="S1", location=(37.77, -122.41), production_capacity=100.0,
        available_capacity=100.0, reliability=1.0, lead_time_hours=5.0
    ))
    twin.add_warehouse(Warehouse(
        id="W1", name="W1", location=(37.77, -122.41), storage_capacity=100.0,
        current_utilization=50.0, throughput_capacity=10.0
    ))

    data = twin.to_dict()
    # Test strict JSON serialization
    json_str = json.dumps(data)
    assert len(json_str) > 0
    loaded = json.loads(json_str)
    assert loaded["name"] == twin.name
    assert len(loaded["suppliers"]) == 1
    assert len(loaded["warehouses"]) == 1


# 11. Snapshot creation works
def test_snapshot_creation():
    mgr = SnapshotManager()
    twin = DigitalTwinEngine(name="prod_twin")
    twin.add_supplier(Supplier(
        id="S1", name="S1", location=(37.77, -122.41), production_capacity=100.0,
        available_capacity=100.0, reliability=1.0, lead_time_hours=5.0
    ))

    snap = mgr.create_snapshot(twin, tag="checkpoint_1")
    assert isinstance(snap, DigitalTwinSnapshot)
    assert snap.tag == "checkpoint_1"
    assert snap.twin_name == "prod_twin"
    assert len(mgr.list_snapshots()) == 1


# 12. Snapshot restore works
def test_snapshot_restore():
    mgr = SnapshotManager()
    twin = DigitalTwinEngine(name="twin_base")
    twin.add_supplier(Supplier(
        id="S1", name="S1", location=(37.77, -122.41), production_capacity=100.0,
        available_capacity=100.0, reliability=1.0, lead_time_hours=5.0
    ))
    snap = mgr.create_snapshot(twin, tag="pre_incident")

    # Mutate live twin
    twin.add_supplier(Supplier(
        id="S2", name="S2", location=(37.78, -122.42), production_capacity=200.0,
        available_capacity=200.0, reliability=0.9, lead_time_hours=8.0
    ))
    assert len(twin.suppliers) == 2

    # Restore in place
    mgr.restore_snapshot(snap.snapshot_id, twin=twin)
    assert len(twin.suppliers) == 1
    assert twin.get_supplier("S1") is not None
    assert twin.get_supplier("S2") is None


# 13. Scenario clone is independent from baseline
def test_scenario_cloning_independence():
    baseline = DigitalTwinEngine(name="baseline_network")
    baseline.add_warehouse(Warehouse(
        id="WH-CENTRAL", name="Central DC", location=(37.77, -122.41), storage_capacity=5000.0,
        current_utilization=2000.0, throughput_capacity=300.0
    ))

    scenario_twin = baseline.clone_for_scenario("disruption_event_A")
    assert scenario_twin.name == "baseline_network_scenario_disruption_event_A"
    assert len(scenario_twin.warehouses) == 1
    assert scenario_twin.get_warehouse("WH-CENTRAL") is not None


# 14. Mutating a scenario does not mutate baseline
def test_mutating_scenario_does_not_mutate_baseline():
    baseline = DigitalTwinEngine(name="baseline")
    baseline.add_warehouse(Warehouse(
        id="WH-CENTRAL", name="Central DC", location=(37.77, -122.41), storage_capacity=5000.0,
        current_utilization=2000.0, throughput_capacity=300.0
    ))
    baseline.update_simulation_time(12.0)

    scenario = baseline.clone_for_scenario("severe_storm")
    # Mutate scenario
    scenario.get_warehouse("WH-CENTRAL").status = WarehouseStatus.DISRUPTED
    scenario.add_warehouse(Warehouse(
        id="WH-BACKUP", name="Backup DC", location=(37.79, -122.40), storage_capacity=1000.0,
        current_utilization=100.0, throughput_capacity=100.0
    ))
    scenario.simulator.trigger_event("congestion")
    scenario.update_simulation_time(18.0)

    # Verify baseline is completely unaffected
    assert baseline.get_warehouse("WH-CENTRAL").status == WarehouseStatus.ACTIVE
    assert baseline.get_warehouse("WH-BACKUP") is None
    assert len(baseline.warehouses) == 1
    assert baseline.simulation_time == 12.0
    assert scenario.simulation_time == 18.0


# 15. Existing graph/simulator remain available through state.py
def test_state_compatibility_with_existing_graph_and_simulator():
    assert state.active_twin is not None
    assert state.active_graph is not None
    assert state.active_simulator is not None
    # Property synchronization check
    assert state.active_graph is state.active_twin.graph
    assert state.active_simulator is state.active_twin.simulator
    assert state.active_twin.graph.graph.number_of_nodes() > 0


# 16. Existing API test flow runs smoothly through state proxy
def test_state_mutation_syncs_with_twin():
    initial_version = state.active_twin.version
    state.active_simulator.update_simulation_time(14.0)
    assert state.active_twin.simulation_time == 14.0
    assert state.active_simulator.current_hour == 14.0
    # Reset back to noon
    state.active_simulator.update_simulation_time(12.0)

import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.api import state

client = TestClient(app)


# 1. API Root & Basic Health
def test_root_endpoint():
    res = client.get("/")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "online"


# 2. Get Twin Summary
def test_get_twin_summary():
    res = client.get("/api/twin/summary")
    assert res.status_code == 200
    data = res.json()
    assert "name" in data
    assert "version" in data
    assert "simulation_time" in data
    assert "graph_node_count" in data


# 3. Get Full Twin State
def test_get_twin_state():
    res = client.get("/api/twin/state")
    assert res.status_code == 200
    data = res.json()
    assert "name" in data
    assert "summary" in data
    assert "graph" in data
    assert "suppliers" in data
    assert "warehouses" in data
    assert "vehicles" in data
    assert "customers" in data
    assert "inventory" in data
    assert "orders" in data
    assert "shipments" in data


# 4. Load PNT1 Seed Scenario
def test_load_seed_scenario():
    res = client.post("/api/twin/load-seed")
    assert res.status_code == 200
    data = res.json()
    assert data["name"] == "PNT1-Seed-Scenario"
    assert data["supplier_count"] == 2
    assert data["warehouse_count"] == 2
    assert data["vehicle_count"] == 6
    assert data["customer_count"] == 6
    assert data["inventory_item_count"] == 6
    assert data["order_count"] == 10
    assert data["shipment_count"] == 5
    assert data["graph_node_count"] == 16


# 5. Snapshot Creation & Listing
def test_snapshot_lifecycle():
    client.post("/api/twin/load-seed")

    # Create snapshot with custom tag
    res_snap = client.post("/api/twin/snapshot", json={"tag": "pre-disruption-baseline"})
    assert res_snap.status_code == 200
    snap_data = res_snap.json()
    assert "snapshot_id" in snap_data
    assert snap_data["tag"] == "pre-disruption-baseline"
    assert snap_data["twin_name"] == "PNT1-Seed-Scenario"
    assert snap_data["summary"]["supplier_count"] == 2

    # List snapshots
    res_list = client.get("/api/twin/snapshots")
    assert res_list.status_code == 200
    snapshots = res_list.json()
    assert len(snapshots) >= 1
    found = any(s["snapshot_id"] == snap_data["snapshot_id"] for s in snapshots)
    assert found is True


# 6. Snapshot Restore & 404
def test_snapshot_restore():
    client.post("/api/twin/load-seed")

    # Create baseline snapshot
    snap_res = client.post("/api/twin/snapshot", json={"tag": "restore-test"})
    snap_id = snap_res.json()["snapshot_id"]

    # Mutate active twin (e.g. update simulation time)
    client.post("/api/traffic/time", json={"hour": 18.5})
    assert state.active_twin.simulation_time == 18.5

    # Restore snapshot
    restore_res = client.post("/api/twin/restore", json={"snapshot_id": snap_id})
    assert restore_res.status_code == 200
    restored_summary = restore_res.json()
    assert restored_summary["simulation_time"] == 12.0  # Seed default time

    # Restore non-existent snapshot
    err_res = client.post("/api/twin/restore", json={"snapshot_id": "invalid-id-xyz"})
    assert err_res.status_code == 404


# 7. Scenario Cloning & Isolation
def test_scenario_clone_and_get():
    client.post("/api/twin/load-seed")

    # Clone scenario
    clone_res = client.post("/api/twin/scenario/clone", json={"scenario_name": "port_strike"})
    assert clone_res.status_code == 200
    clone_data = clone_res.json()
    assert "scenario_id" in clone_data
    assert clone_data["scenario_name"] == "port_strike"
    assert "PNT1-Seed-Scenario_scenario_port_strike" in clone_data["twin_name"]

    scen_id = clone_data["scenario_id"]

    # List scenarios
    list_res = client.get("/api/twin/scenarios")
    assert list_res.status_code == 200
    scenarios = list_res.json()
    assert any(s["scenario_id"] == scen_id for s in scenarios)

    # Get specific scenario detail
    detail_res = client.get(f"/api/twin/scenario/{scen_id}")
    assert detail_res.status_code == 200
    scen_detail = detail_res.json()
    assert scen_detail["name"] == clone_data["twin_name"]
    assert len(scen_detail["suppliers"]) == 2

    # Get invalid scenario
    bad_scen_res = client.get("/api/twin/scenario/nonexistent-scenario")
    assert bad_scen_res.status_code == 404


# 8. Suppliers API
def test_suppliers_endpoints():
    client.post("/api/twin/load-seed")

    # List suppliers (both routes)
    res1 = client.get("/api/suppliers")
    res2 = client.get("/api/twin/suppliers")
    assert res1.status_code == 200
    assert res2.status_code == 200
    suppliers = res1.json()
    assert len(suppliers) == 2
    supplier_ids = {s["id"] for s in suppliers}
    assert "S1" in supplier_ids and "S2" in supplier_ids

    # Get single supplier
    s1_res = client.get("/api/suppliers/S1")
    assert s1_res.status_code == 200
    assert s1_res.json()["name"] == "Apex Microelectronics (S1)"
    assert s1_res.json()["node_id"] == 0

    # Nonexistent supplier
    bad_res = client.get("/api/suppliers/INVALID_SUPPLIER")
    assert bad_res.status_code == 404


# 9. Warehouses API
def test_warehouses_endpoints():
    client.post("/api/twin/load-seed")

    res = client.get("/api/warehouses")
    assert res.status_code == 200
    warehouses = res.json()
    assert len(warehouses) == 2
    wh_ids = {w["id"] for w in warehouses}
    assert "W1" in wh_ids and "W2" in wh_ids

    # Single warehouse
    w1_res = client.get("/api/warehouses/W1")
    assert w1_res.status_code == 200
    assert w1_res.json()["name"] == "Bay Gateway DC (W1)"
    assert w1_res.json()["node_id"] == 2

    # Nonexistent warehouse
    bad_res = client.get("/api/warehouses/INVALID_WH")
    assert bad_res.status_code == 404


# 10. Vehicles API
def test_vehicles_endpoints():
    client.post("/api/twin/load-seed")

    res = client.get("/api/vehicles")
    assert res.status_code == 200
    vehicles = res.json()
    assert len(vehicles) == 6

    # Single vehicle
    v1_res = client.get("/api/vehicles/V1")
    assert v1_res.status_code == 200
    assert v1_res.json()["vehicle_type"] == "TRUCK"

    # Nonexistent vehicle
    bad_res = client.get("/api/vehicles/INVALID_V")
    assert bad_res.status_code == 404


# 11. Customers API
def test_customers_endpoints():
    client.post("/api/twin/load-seed")

    res = client.get("/api/customers")
    assert res.status_code == 200
    customers = res.json()
    assert len(customers) == 6

    # Single customer
    c1_res = client.get("/api/customers/C1")
    assert c1_res.status_code == 200
    assert c1_res.json()["name"] == "Metro Supercenter SF (C1)"

    # Nonexistent customer
    bad_res = client.get("/api/customers/INVALID_C")
    assert bad_res.status_code == 404


# 12. Inventory API & Filtering
def test_inventory_endpoints():
    client.post("/api/twin/load-seed")

    # List all inventory
    res_all = client.get("/api/inventory")
    assert res_all.status_code == 200
    all_items = res_all.json()
    assert len(all_items) == 6

    # Filter by warehouse_id
    res_w1 = client.get("/api/inventory?warehouse_id=W1")
    assert res_w1.status_code == 200
    w1_items = res_w1.json()
    assert len(w1_items) == 3
    assert all(i["warehouse_id"] == "W1" for i in w1_items)

    # Get specific item
    item_res = client.get("/api/inventory/W1/SKU-MED-CHIP")
    assert item_res.status_code == 200
    assert item_res.json()["sku"] == "SKU-MED-CHIP"
    assert item_res.json()["on_hand"] == 1200.0

    # Nonexistent item
    bad_item = client.get("/api/inventory/W1/NON_EXISTENT_SKU")
    assert bad_item.status_code == 404


# 13. Orders API & Filtering
def test_orders_endpoints():
    client.post("/api/twin/load-seed")

    # List all orders
    res_all = client.get("/api/orders")
    assert res_all.status_code == 200
    all_orders = res_all.json()
    assert len(all_orders) == 10

    # Filter by status (case insensitive)
    res_pending = client.get("/api/orders?status=PENDING")
    assert res_pending.status_code == 200
    pending_orders = res_pending.json()
    assert len(pending_orders) == 3
    assert all(o["status"] == "PENDING" for o in pending_orders)

    # Get specific order
    o1_res = client.get("/api/orders/ORD-001")
    assert o1_res.status_code == 200
    assert o1_res.json()["customer_id"] == "C1"

    # Nonexistent order
    bad_o = client.get("/api/orders/NON_EXISTENT_ORD")
    assert bad_o.status_code == 404


# 14. Shipments API & Filtering
def test_shipments_endpoints():
    client.post("/api/twin/load-seed")

    # List all shipments
    res_all = client.get("/api/shipments")
    assert res_all.status_code == 200
    all_shipments = res_all.json()
    assert len(all_shipments) == 5

    # Filter by status
    res_transit = client.get("/api/shipments?status=IN_TRANSIT")
    assert res_transit.status_code == 200
    transit_shipments = res_transit.json()
    assert len(transit_shipments) == 4
    assert all(s["status"] == "IN_TRANSIT" for s in transit_shipments)

    # Get specific shipment
    s1_res = client.get("/api/shipments/SHP-001")
    assert s1_res.status_code == 200
    assert s1_res.json()["vehicle_id"] == "V1"

    # Nonexistent shipment
    bad_s = client.get("/api/shipments/NON_EXISTENT_SHP")
    assert bad_s.status_code == 404


# 15. Cross-Compatibility with Existing Traffic Simulator
def test_cross_compatibility_with_traffic_api():
    client.post("/api/twin/load-seed")

    # Verify that existing traffic endpoint reads the active seed twin's simulator
    traffic_res = client.get("/api/traffic/status")
    assert traffic_res.status_code == 200
    status_data = traffic_res.json()
    assert status_data["hour"] == 12.0
    assert isinstance(status_data["active_incidents"], list)

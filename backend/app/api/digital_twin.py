from fastapi import APIRouter, HTTPException, Query
import uuid
from typing import List, Optional, Dict, Any

from . import state
from ..digital_twin.seed import create_pnt1_seed_twin
from ..schemas.digital_twin import (
    SnapshotCreateRequest,
    SnapshotResponse,
    RestoreSnapshotRequest,
    ScenarioCloneRequest,
    ScenarioSummaryResponse,
    TwinSummaryResponse,
)

router = APIRouter(tags=["digital-twin"])


# ==========================================
# Digital Twin State & Summary Endpoints
# ==========================================

@router.get("/twin/state")
def get_twin_state():
    """Returns the complete, authoritative in-memory Digital Twin state."""
    return state.active_twin.to_dict()


@router.get("/twin/summary", response_model=TwinSummaryResponse)
def get_twin_summary():
    """Returns compact aggregate statistics for the active digital twin."""
    return state.active_twin.get_summary()


@router.post("/twin/load-seed", response_model=TwinSummaryResponse)
def load_seed_scenario():
    """
    Initializes and sets the active Digital Twin to the deterministic
    PNT1 regional multimodal logistics seed scenario.
    """
    state.active_twin = create_pnt1_seed_twin()
    return state.active_twin.get_summary()


# ==========================================
# Snapshot Lifecycle Endpoints
# ==========================================

@router.post("/twin/snapshot", response_model=SnapshotResponse)
def create_snapshot(payload: Optional[SnapshotCreateRequest] = None):
    """
    Captures an immutable deep snapshot of the active Digital Twin state.
    """
    tag = payload.tag if payload and payload.tag else "checkpoint"
    snap = state.snapshot_manager.create_snapshot(state.active_twin, tag=tag)
    return {
        "snapshot_id": snap.snapshot_id,
        "tag": snap.tag,
        "timestamp": snap.timestamp,
        "twin_name": snap.twin_name,
        "twin_version": snap.twin_version,
        "summary": snap.summary,
    }


@router.get("/twin/snapshots", response_model=List[SnapshotResponse])
def list_snapshots():
    """Lists metadata for all stored snapshots in memory."""
    return state.snapshot_manager.list_snapshots()


@router.post("/twin/restore", response_model=TwinSummaryResponse)
def restore_snapshot(payload: RestoreSnapshotRequest):
    """
    Restores the active Digital Twin to a previously captured snapshot state.
    """
    try:
        state.snapshot_manager.restore_snapshot(payload.snapshot_id, twin=state.active_twin)
        return state.active_twin.get_summary()
    except KeyError:
        raise HTTPException(
            status_code=404,
            detail=f"Snapshot with ID '{payload.snapshot_id}' not found."
        )


# ==========================================
# Scenario Registry Endpoints
# ==========================================

@router.post("/twin/scenario/clone", response_model=ScenarioSummaryResponse)
def clone_scenario(payload: ScenarioCloneRequest):
    """
    Clones the active Digital Twin into an isolated what-if scenario branch.
    Subsequent mutations to this scenario do not affect the baseline twin.
    """
    source_version = state.active_twin.version
    cloned_twin = state.active_twin.clone_for_scenario(payload.scenario_name)
    scenario_id = f"scen-{uuid.uuid4().hex[:8]}"

    # Attach scenario tracking attributes
    setattr(cloned_twin, "scenario_id", scenario_id)
    setattr(cloned_twin, "scenario_name", payload.scenario_name)
    setattr(cloned_twin, "source_twin_version", source_version)

    state.scenarios[scenario_id] = cloned_twin

    return {
        "scenario_id": scenario_id,
        "scenario_name": payload.scenario_name,
        "twin_name": cloned_twin.name,
        "source_twin_version": source_version,
        "simulation_time": cloned_twin.simulation_time,
        "summary": cloned_twin.get_summary(),
    }


@router.get("/twin/scenarios", response_model=List[ScenarioSummaryResponse])
def list_scenarios():
    """Lists metadata for all cloned what-if scenarios in the registry."""
    results = []
    for scen_id, twin in state.scenarios.items():
        results.append({
            "scenario_id": getattr(twin, "scenario_id", scen_id),
            "scenario_name": getattr(twin, "scenario_name", twin.name),
            "twin_name": twin.name,
            "source_twin_version": getattr(twin, "source_twin_version", 1),
            "simulation_time": twin.simulation_time,
            "summary": twin.get_summary(),
        })
    return results


@router.get("/twin/scenario/{scenario_id}")
def get_scenario_detail(scenario_id: str):
    """Returns the full state dictionary for an isolated what-if scenario."""
    scen = state.scenarios.get(scenario_id)
    if scen is None:
        raise HTTPException(
            status_code=404,
            detail=f"Scenario with ID '{scenario_id}' not found in registry."
        )
    return scen.to_dict()


# ==========================================
# Logistics Domain Entity Endpoints (Read-Only)
# Supports both /api/<entity> and /api/twin/<entity>
# ==========================================

# 1. Suppliers
@router.get("/suppliers")
@router.get("/twin/suppliers")
def list_suppliers():
    """Lists all registered suppliers in the active twin."""
    return [s.model_dump() for s in state.active_twin.list_suppliers()]


@router.get("/suppliers/{supplier_id}")
@router.get("/twin/suppliers/{supplier_id}")
def get_supplier(supplier_id: str):
    """Retrieves a specific supplier by ID."""
    s = state.active_twin.get_supplier(supplier_id)
    if s is None:
        raise HTTPException(status_code=404, detail=f"Supplier '{supplier_id}' not found.")
    return s.model_dump()


# 2. Warehouses
@router.get("/warehouses")
@router.get("/twin/warehouses")
def list_warehouses():
    """Lists all registered warehouses in the active twin."""
    return [w.model_dump() for w in state.active_twin.list_warehouses()]


@router.get("/warehouses/{warehouse_id}")
@router.get("/twin/warehouses/{warehouse_id}")
def get_warehouse(warehouse_id: str):
    """Retrieves a specific warehouse by ID."""
    w = state.active_twin.get_warehouse(warehouse_id)
    if w is None:
        raise HTTPException(status_code=404, detail=f"Warehouse '{warehouse_id}' not found.")
    return w.model_dump()


# 3. Vehicles
@router.get("/vehicles")
@router.get("/twin/vehicles")
def list_vehicles():
    """Lists all active fleet vehicles in the active twin."""
    return [v.model_dump() for v in state.active_twin.list_vehicles()]


@router.get("/vehicles/{vehicle_id}")
@router.get("/twin/vehicles/{vehicle_id}")
def get_vehicle(vehicle_id: str):
    """Retrieves a specific fleet vehicle by ID."""
    v = state.active_twin.get_vehicle(vehicle_id)
    if v is None:
        raise HTTPException(status_code=404, detail=f"Vehicle '{vehicle_id}' not found.")
    return v.model_dump()


# 4. Customers
@router.get("/customers")
@router.get("/twin/customers")
def list_customers():
    """Lists all customer destinations / demand nodes in the active twin."""
    return [c.model_dump() for c in state.active_twin.list_customers()]


@router.get("/customers/{customer_id}")
@router.get("/twin/customers/{customer_id}")
def get_customer(customer_id: str):
    """Retrieves a specific customer node by ID."""
    c = state.active_twin.get_customer(customer_id)
    if c is None:
        raise HTTPException(status_code=404, detail=f"Customer '{customer_id}' not found.")
    return c.model_dump()


# 5. Inventory
@router.get("/inventory")
@router.get("/twin/inventory")
def list_inventory(warehouse_id: Optional[str] = Query(None, description="Optional warehouse ID to filter by")):
    """Lists inventory stock items, optionally filtered by warehouse ID."""
    items = state.active_twin.list_inventory(warehouse_id=warehouse_id)
    return [item.model_dump() for item in items]


@router.get("/inventory/{warehouse_id}/{sku}")
@router.get("/twin/inventory/{warehouse_id}/{sku}")
def get_inventory_item(warehouse_id: str, sku: str):
    """Retrieves a specific inventory record by warehouse ID and SKU."""
    item = state.active_twin.get_inventory(warehouse_id, sku)
    if item is None:
        raise HTTPException(
            status_code=404,
            detail=f"Inventory item with SKU '{sku}' not found in warehouse '{warehouse_id}'."
        )
    return item.model_dump()


# 6. Orders
@router.get("/orders")
@router.get("/twin/orders")
def list_orders(status: Optional[str] = Query(None, description="Optional order status filter")):
    """Lists orders, optionally filtered by order status."""
    orders = state.active_twin.list_orders()
    if status is not None:
        st_lower = status.strip().lower()
        orders = [
            o for o in orders
            if o.status.value.lower() == st_lower or str(o.status).lower() == st_lower
        ]
    return [o.model_dump() for o in orders]


@router.get("/orders/{order_id}")
@router.get("/twin/orders/{order_id}")
def get_order(order_id: str):
    """Retrieves a specific order by ID."""
    o = state.active_twin.get_order(order_id)
    if o is None:
        raise HTTPException(status_code=404, detail=f"Order '{order_id}' not found.")
    return o.model_dump()


# 7. Shipments
@router.get("/shipments")
@router.get("/twin/shipments")
def list_shipments(status: Optional[str] = Query(None, description="Optional shipment status filter")):
    """Lists freight shipments, optionally filtered by shipment status."""
    shipments = state.active_twin.list_shipments()
    if status is not None:
        st_lower = status.strip().lower()
        shipments = [
            s for s in shipments
            if s.status.value.lower() == st_lower or str(s.status).lower() == st_lower
        ]
    return [s.model_dump() for s in shipments]


@router.get("/shipments/{shipment_id}")
@router.get("/twin/shipments/{shipment_id}")
def get_shipment(shipment_id: str):
    """Retrieves a specific shipment by ID."""
    s = state.active_twin.get_shipment(shipment_id)
    if s is None:
        raise HTTPException(status_code=404, detail=f"Shipment '{shipment_id}' not found.")
    return s.model_dump()

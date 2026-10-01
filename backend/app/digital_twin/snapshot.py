import uuid
import time
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field

from .engine import DigitalTwinEngine


class DigitalTwinSnapshot(BaseModel):
    """
    Immutable representation of a digital twin state snapshot.
    """
    snapshot_id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    tag: str = Field("checkpoint", description="Human-readable label for snapshot")
    timestamp: float = Field(default_factory=time.time)
    twin_name: str
    twin_version: int
    summary: Dict[str, Any]
    state_data: Dict[str, Any]


class SnapshotManager:
    """
    Manages in-memory snapshots of Digital Twin instances.
    Provides snapshot creation, listing, retrieval, and restoration.
    """

    def __init__(self):
        self._snapshots: Dict[str, DigitalTwinSnapshot] = {}

    def create_snapshot(self, twin: DigitalTwinEngine, tag: Optional[str] = None) -> DigitalTwinSnapshot:
        """
        Creates an independent deep snapshot of the current twin state.
        """
        state_data = twin.to_dict()
        snapshot = DigitalTwinSnapshot(
            tag=tag or f"v{twin.version}",
            twin_name=twin.name,
            twin_version=twin.version,
            summary=twin.get_summary(),
            state_data=state_data
        )
        self._snapshots[snapshot.snapshot_id] = snapshot
        return snapshot

    def get_snapshot(self, snapshot_id: str) -> Optional[DigitalTwinSnapshot]:
        """Retrieves snapshot by ID."""
        return self._snapshots.get(snapshot_id)

    def list_snapshots(self) -> List[Dict[str, Any]]:
        """Lists metadata for all stored snapshots."""
        return [
            {
                "snapshot_id": snap.snapshot_id,
                "tag": snap.tag,
                "timestamp": snap.timestamp,
                "twin_name": snap.twin_name,
                "twin_version": snap.twin_version,
                "summary": snap.summary,
            }
            for snap in self._snapshots.values()
        ]

    def delete_snapshot(self, snapshot_id: str) -> bool:
        """Deletes a snapshot by ID."""
        if snapshot_id in self._snapshots:
            del self._snapshots[snapshot_id]
            return True
        return False

    def clear(self):
        """Clears all stored snapshots."""
        self._snapshots.clear()

    def restore_snapshot(
        self, snapshot_id: str, twin: Optional[DigitalTwinEngine] = None
    ) -> DigitalTwinEngine:
        """
        Restores a twin from a snapshot.
        If a target twin is provided, updates it in-place and returns it.
        Otherwise, constructs and returns a new DigitalTwinEngine.
        """
        snapshot = self._snapshots.get(snapshot_id)
        if snapshot is None:
            raise KeyError(f"Snapshot with ID '{snapshot_id}' not found.")

        restored = DigitalTwinEngine.from_dict(snapshot.state_data)

        if twin is not None:
            # In-place restoration into existing twin
            twin.name = restored.name
            twin.version = restored.version + 1
            twin.last_updated = time.time()
            twin.simulation_time = restored.simulation_time
            twin.graph = restored.graph
            twin.simulator = restored.simulator
            twin.suppliers = restored.suppliers
            twin.warehouses = restored.warehouses
            twin.vehicles = restored.vehicles
            twin.customers = restored.customers
            twin.inventory = restored.inventory
            twin.orders = restored.orders
            twin.shipments = restored.shipments
            twin.disruptions = getattr(restored, "disruptions", {})
            return twin

        return restored

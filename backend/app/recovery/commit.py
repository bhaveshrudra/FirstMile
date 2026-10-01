import time
import uuid
from typing import Dict, Any, List, Optional, Tuple, Set

from ..digital_twin.engine import DigitalTwinEngine
from ..digital_twin.snapshot import SnapshotManager
from ..models.order import Order, OrderStatus
from ..models.warehouse import Warehouse, WarehouseStatus
from ..models.shipment import Shipment, ShipmentStatus
from ..models.vehicle import Vehicle, VehicleStatus
from ..models.inventory import InventoryItem

from .models import (
    RecoveryPlan,
    ShipmentRecoveryResult,
    InventoryReallocationResult,
    ShipmentCommitRecord,
    InventoryCommitRecord,
    OrderCommitRecord,
    RecoveryCommitResult,
    RecoveryRollbackResult,
)


class RecoveryCommitEngine:
    """
    Dedicated recovery plan commitment and automated twin application engine for PNT1.
    Converts approved analysis-only RecoveryPlans into controlled, atomic mutations
    on an isolated scenario twin with full rollback support.
    The baseline digital twin is strictly protected from any mutation.
    """

    def __init__(self, twin: DigitalTwinEngine, snapshot_manager: SnapshotManager):
        self.twin = twin
        self.snapshot_manager = snapshot_manager

    def validate_plan(self, plan: RecoveryPlan) -> Tuple[bool, List[str]]:
        """
        Validates every component of the RecoveryPlan against the current scenario state
        prior to executing any mutation:
          - Plan is not already committed
          - Scenario existence and identity match
          - Shipment existence, feasibility, and non-closed edge corridors
          - Inventory availability and proposed warehouse operational status
        Returns (is_valid, validation_errors).
        """
        errors: List[str] = []

        if plan.is_committed:
            errors.append(f"RecoveryPlan '{plan.plan_id}' has already been committed.")
            return False, errors

        # 1. Validate Shipment Rerouting
        g = self.twin.graph.graph
        for sr in plan.shipment_results:
            if sr.route_changed:
                shp = self.twin.get_shipment(sr.shipment_id)
                if shp is None:
                    errors.append(f"Shipment '{sr.shipment_id}' does not exist in scenario twin.")
                    continue

                if not sr.optimized_route or len(sr.optimized_route) < 2:
                    errors.append(f"Proposed route for shipment '{sr.shipment_id}' is empty or invalid.")
                    continue

                # Validate route nodes
                for n in sr.optimized_route:
                    if not g.has_node(n):
                        errors.append(f"Proposed route node {n} does not exist in graph for shipment '{sr.shipment_id}'.")
                        break
                    if g.nodes[n].get("status") in {"CLOSED", "OFFLINE"}:
                        errors.append(f"Node {n} on proposed route for shipment '{sr.shipment_id}' is CLOSED/OFFLINE.")
                        break

                # Validate route edges against current graph state (stale plan check)
                for u, v in zip(sr.optimized_route, sr.optimized_route[1:]):
                    if not g.has_edge(u, v):
                        errors.append(f"Corridor ({u}, {v}) on route does not exist for shipment '{sr.shipment_id}'.")
                        break
                    ed = g.edges[u, v]
                    if ed.get("road_status") == "closed" or ed.get("current_travel_time", 0.0) >= 999.0:
                        errors.append(f"Corridor ({u}, {v}) is closed/blocked in current scenario (stale route for '{sr.shipment_id}').")
                        break

        # 2. Validate Inventory Reallocations
        for ir in plan.inventory_reallocation_results:
            if ir.feasibility_status in {"FEASIBLE", "PARTIALLY_FEASIBLE"} and ir.proposed_warehouse_id:
                order = self.twin.get_order(ir.order_id)
                if order is None:
                    errors.append(f"Order '{ir.order_id}' does not exist in scenario twin.")
                    continue

                wh = self.twin.get_warehouse(ir.proposed_warehouse_id)
                if wh is None:
                    errors.append(f"Proposed warehouse '{ir.proposed_warehouse_id}' does not exist.")
                    continue
                if wh.status == WarehouseStatus.OFFLINE:
                    errors.append(f"Proposed warehouse '{ir.proposed_warehouse_id}' is OFFLINE.")
                    continue

                # Verify current inventory availability (stale stock check)
                inv = self.twin.get_inventory(ir.proposed_warehouse_id, ir.sku)
                if inv is None:
                    errors.append(f"SKU '{ir.sku}' is not stocked at proposed warehouse '{ir.proposed_warehouse_id}'.")
                    continue
                if inv.available < ir.allocated_quantity:
                    errors.append(
                        f"Insufficient available stock at '{ir.proposed_warehouse_id}' for SKU '{ir.sku}': "
                        f"required {ir.allocated_quantity}, available {inv.available} (stale inventory state)."
                    )
                    continue

                # Verify proposed route to customer
                if ir.route and len(ir.route) >= 2:
                    for u, v in zip(ir.route, ir.route[1:]):
                        if not g.has_edge(u, v):
                            errors.append(f"Proposed fulfillment link ({u}, {v}) does not exist for order '{ir.order_id}'.")
                            break
                        if g.edges[u, v].get("road_status") == "closed" or g.edges[u, v].get("current_travel_time", 0.0) >= 999.0:
                            errors.append(f"Proposed fulfillment link ({u}, {v}) is closed for order '{ir.order_id}' (stale route).")
                            break

        return (len(errors) == 0, errors)

    def commit_plan(self, plan: RecoveryPlan, approval: bool = True) -> RecoveryCommitResult:
        """
        Executes atomic commitment of an approved RecoveryPlan into the scenario twin:
          1. Validates that target is NOT the baseline twin
          2. Requires explicit approval confirmation
          3. Captures a complete pre-commit snapshot via SnapshotManager
          4. Validates plan components against live scenario state
          5. Applies shipment rerouting, inventory reservations, order reassignments, and shipment creations
          6. Runs post-commit invariant validations
          7. On any failure, automatically restores pre-commit snapshot (zero partial mutation)
        """
        # Baseline guard
        if self.twin.name in {"active_twin", "baseline"} or not hasattr(self.twin, "scenario_id") and self.twin.name == "PNT1-Seed-Scenario":
            raise ValueError("Baseline digital twin cannot be mutated. Commit is permitted only on isolated scenario twins.")

        if not approval:
            return RecoveryCommitResult(
                plan_id=plan.plan_id,
                scenario_id=plan.scenario_id,
                snapshot_id="",
                success=False,
                status="REJECTED",
                validation_errors=["Explicit user approval required (approval=True)."],
                rollback_available=False,
                explanation="Recovery plan commit rejected: user confirmation approval flag was false."
            )

        if plan.is_committed:
            return RecoveryCommitResult(
                plan_id=plan.plan_id,
                scenario_id=plan.scenario_id,
                snapshot_id="",
                success=False,
                status="REJECTED",
                validation_errors=["Recovery plan has already been committed (idempotency guard)."],
                rollback_available=False,
                explanation="Commit rejected: RecoveryPlan was previously committed to scenario state."
            )

        # 1. Create Pre-Commit Snapshot
        pre_snapshot = self.snapshot_manager.create_snapshot(
            self.twin,
            tag=f"pre-commit-{plan.plan_id}"
        )
        snapshot_id = pre_snapshot.snapshot_id

        # 2. Pre-Commit Validation
        is_valid, validation_errors = self.validate_plan(plan)
        if not is_valid:
            return RecoveryCommitResult(
                plan_id=plan.plan_id,
                scenario_id=plan.scenario_id,
                snapshot_id=snapshot_id,
                success=False,
                status="FAILED_ROLLED_BACK",
                validation_errors=validation_errors,
                rollback_available=True,
                explanation=f"Pre-commit plan validation failed: {'; '.join(validation_errors)}"
            )

        # 3. Apply Mutations Atomically
        shipment_changes: List[ShipmentCommitRecord] = []
        inventory_changes: List[InventoryCommitRecord] = []
        order_changes: List[OrderCommitRecord] = []
        created_shipments: List[str] = []

        try:
            # A. Commit Shipment Rerouting
            for sr in plan.shipment_results:
                if sr.route_changed and sr.optimized_route:
                    shp = self.twin.get_shipment(sr.shipment_id)
                    if shp:
                        orig_route = list(shp.route)
                        orig_status = shp.status.value
                        shp.route = list(sr.optimized_route)
                        shp.status = ShipmentStatus.REROUTED
                        shipment_changes.append(ShipmentCommitRecord(
                            shipment_id=shp.id,
                            original_route=orig_route,
                            committed_route=shp.route,
                            original_status=orig_status,
                            committed_status=shp.status.value
                        ))

            # B. Commit Inventory Reallocations & Order Reassignments
            for ir in plan.inventory_reallocation_results:
                if ir.proposed_warehouse_id and ir.allocated_quantity > 0 and ir.feasibility_status in {"FEASIBLE", "PARTIALLY_FEASIBLE"}:
                    # Inventory stock reservation at proposed warehouse
                    inv = self.twin.get_inventory(ir.proposed_warehouse_id, ir.sku)
                    if inv is None or inv.available < ir.allocated_quantity:
                        raise ValueError(f"Insufficient stock for SKU {ir.sku} at warehouse {ir.proposed_warehouse_id}")

                    avail_before = inv.available
                    res_before = inv.reserved
                    inv.reserved += ir.allocated_quantity
                    avail_after = inv.available

                    inventory_changes.append(InventoryCommitRecord(
                        warehouse_id=ir.proposed_warehouse_id,
                        sku=ir.sku,
                        quantity_before=avail_before,
                        quantity_committed=ir.allocated_quantity,
                        quantity_after=avail_after,
                        reserved_before=res_before,
                        reserved_after=inv.reserved,
                        available_before=avail_before,
                        available_after=avail_after
                    ))

                    # Update Order
                    order = self.twin.get_order(ir.order_id)
                    if order is None:
                        raise ValueError(f"Order {ir.order_id} not found in scenario")

                    orig_wh = order.source_warehouse_id
                    orig_status = order.status.value
                    order.source_warehouse_id = ir.proposed_warehouse_id
                    order.status = OrderStatus.ALLOCATED
                    order_changes.append(OrderCommitRecord(
                        order_id=order.id,
                        original_warehouse_id=orig_wh,
                        committed_warehouse_id=order.source_warehouse_id,
                        original_status=orig_status,
                        committed_status=order.status.value
                    ))

                    # Update or Generate Freight Shipment
                    existing_shp = next((s for s in self.twin.shipments.values() if s.order_id == order.id), None)
                    if existing_shp:
                        existing_shp.origin_id = ir.proposed_warehouse_id
                        if ir.route:
                            existing_shp.route = list(ir.route)
                        existing_shp.quantity = ir.allocated_quantity
                        existing_shp.status = ShipmentStatus.REROUTED
                    else:
                        # Find suitable fleet vehicle stationed at proposed warehouse or available
                        assigned_vid = None
                        target_wh = self.twin.get_warehouse(ir.proposed_warehouse_id)
                        wh_node = target_wh.node_id if target_wh else None

                        # First priority: available vehicle at the warehouse node
                        for v in self.twin.vehicles.values():
                            if v.capacity >= ir.allocated_quantity and v.status == VehicleStatus.AVAILABLE:
                                if wh_node is not None and v.current_node_id == wh_node:
                                    assigned_vid = v.id
                                    break

                        # Second priority: any available vehicle in fleet with sufficient capacity
                        if assigned_vid is None:
                            for v in self.twin.vehicles.values():
                                if v.capacity >= ir.allocated_quantity and v.status in {VehicleStatus.AVAILABLE, VehicleStatus.IN_TRANSIT}:
                                    assigned_vid = v.id
                                    break

                        new_sid = f"SHP-{uuid.uuid4().hex[:6].upper()}"
                        eta_val = self.twin.simulation_time + ir.optimized_metrics.get("travel_time", 1.5)
                        new_shp = Shipment(
                            id=new_sid,
                            order_id=order.id,
                            vehicle_id=assigned_vid,
                            origin_id=ir.proposed_warehouse_id,
                            destination_id=order.customer_id,
                            quantity=ir.allocated_quantity,
                            route=list(ir.route) if ir.route else [],
                            status=ShipmentStatus.PLANNED,
                            departure_time=self.twin.simulation_time,
                            eta=eta_val
                        )
                        self.twin.add_shipment(new_shp)
                        created_shipments.append(new_sid)

            # 4. Post-Commit Invariant Validation
            # A. Inventory consistency
            for inv in self.twin.inventory.values():
                if inv.on_hand < 0.0 or inv.reserved < 0.0 or inv.reserved > inv.on_hand:
                    raise ValueError(f"Inventory invariant violated at {inv.warehouse_id}:{inv.sku} (reserved > on_hand)")

            # B. Shipment route physical validity
            g = self.twin.graph.graph
            for sid, shp in self.twin.shipments.items():
                if len(shp.route) >= 2:
                    for u, v in zip(shp.route, shp.route[1:]):
                        if not g.has_edge(u, v):
                            raise ValueError(f"Shipment {sid} route contains non-existent edge ({u}, {v})")
                        if g.edges[u, v].get("road_status") == "closed":
                            raise ValueError(f"Shipment {sid} route contains closed road ({u}, {v})")

            # Mark plan as committed
            plan.is_committed = True
            self.twin._mark_updated()

            explanation = (
                f"Recovery plan {plan.plan_id} successfully committed to scenario '{self.twin.name}'. "
                f"{len(shipment_changes)} shipment(s) rerouted, {len(inventory_changes)} inventory stock allocation(s) applied, "
                f"{len(order_changes)} customer order(s) reassigned, and {len(created_shipments)} new freight shipment(s) generated. "
                f"Pre-commit checkpoint snapshot '{snapshot_id}' stored for one-click rollback."
            )

            return RecoveryCommitResult(
                plan_id=plan.plan_id,
                scenario_id=plan.scenario_id,
                snapshot_id=snapshot_id,
                success=True,
                status="COMMITTED",
                shipment_changes=shipment_changes,
                inventory_changes=inventory_changes,
                order_changes=order_changes,
                created_shipments=created_shipments,
                validation_errors=[],
                rollback_available=True,
                explanation=explanation
            )

        except Exception as ex:
            # ATOMIC ROLLBACK: Restore pre-commit snapshot immediately
            self.snapshot_manager.restore_snapshot(snapshot_id, twin=self.twin)
            return RecoveryCommitResult(
                plan_id=plan.plan_id,
                scenario_id=plan.scenario_id,
                snapshot_id=snapshot_id,
                success=False,
                status="FAILED_ROLLED_BACK",
                shipment_changes=[],
                inventory_changes=[],
                order_changes=[],
                created_shipments=[],
                validation_errors=[str(ex)],
                rollback_available=True,
                explanation=f"Atomic commit failed during execution and was rolled back automatically: {str(ex)}"
            )

    def rollback(self, snapshot_id: str) -> RecoveryRollbackResult:
        """
        Restores the scenario twin to its pre-commit state using the specified snapshot.
        Guarantees that the baseline twin is never affected.
        """
        if self.twin.name in {"active_twin", "baseline"}:
            raise ValueError("Baseline digital twin cannot be rolled back. Rollback is supported only on scenario twins.")

        snap = self.snapshot_manager.get_snapshot(snapshot_id)
        if snap is None:
            raise KeyError(f"Snapshot with ID '{snapshot_id}' not found.")

        self.snapshot_manager.restore_snapshot(snapshot_id, twin=self.twin)

        restored_counts = {
            "shipments": len(self.twin.shipments),
            "orders": len(self.twin.orders),
            "inventory_items": len(self.twin.inventory),
            "warehouses": len(self.twin.warehouses),
            "vehicles": len(self.twin.vehicles),
        }

        explanation = (
            f"Scenario '{self.twin.name}' successfully rolled back to snapshot '{snapshot_id}' ({snap.tag}). "
            f"All post-commit inventory allocations, order reassignments, and shipment routes reverted."
        )

        return RecoveryRollbackResult(
            scenario_id=getattr(self.twin, "scenario_id", self.twin.name),
            snapshot_id=snapshot_id,
            success=True,
            restored_entities=restored_counts,
            explanation=explanation
        )

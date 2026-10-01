import time
import uuid
from typing import Dict, Any, List, Optional, Tuple, Set

from ..digital_twin.engine import DigitalTwinEngine
from ..models.order import Order, OrderStatus
from ..models.warehouse import Warehouse, WarehouseStatus
from ..models.inventory import InventoryItem
from ..disruption.models import Disruption, DisruptionType, DisruptionStatus
from ..optimization.exact_solver import dijkstra_shortest_path
from .models import (
    RecoveryProblem,
    RecoveryPlan,
    RecoveryAction,
    RecoveryActionType,
    InventoryReallocationResult,
    CandidateAlternateWarehouse,
    AffectedWarehouseInventory,
)
from .problem import _get_node_id, build_recovery_problem
from .fitness import evaluate_route_metrics


class InventoryReallocationEngine:
    """
    Deterministic cross-warehouse inventory and order reallocation engine for PNT1.
    Evaluates affected customer orders, discovers candidate alternate fulfillment warehouses,
    verifies physical inventory availability, validates downstream delivery route feasibility,
    calculates multi-objective allocation scores, and generates analysis-only recommendations
    without mutating the underlying digital twin state.
    """

    def __init__(
        self,
        twin: DigitalTwinEngine,
        allow_partial: bool = True,
        weights: Optional[Dict[str, float]] = None
    ):
        self.twin = twin
        self.allow_partial = allow_partial
        self.weights = weights or {
            "TRAVEL_TIME": 1.0,
            "TRANSPORT_COST": 0.8,
            "RISK": 0.5,
            "DELIVERY_DELAY": 1.2,
            "STOCKOUT_RISK": 2.0,
        }

    def detect_affected_orders(
        self,
        problem: Optional[RecoveryProblem] = None,
        disruption_ids: Optional[List[str]] = None
    ) -> List[Order]:
        """
        Identifies customer orders that require alternative warehouse fulfillment due to:
          - Sourcing from an OFFLINE, DISRUPTED, or CONGESTED warehouse
          - Insufficient available on-hand stock for the requested SKU at source warehouse
          - Source warehouse node being closed or severed in the network graph
          - Explicit mapping within the RecoveryProblem or active disruptions
        Excludes orders already marked DELIVERED or CANCELLED.
        Returns deduplicated orders prioritized by tier and deadline.
        """
        affected_orders_map: Dict[str, Order] = {}

        # 1. Inspect orders already identified in the formal RecoveryProblem
        if problem:
            for oid in problem.affected_orders:
                ord_obj = self.twin.get_order(oid)
                if ord_obj and ord_obj.status not in {OrderStatus.DELIVERED, OrderStatus.CANCELLED}:
                    affected_orders_map[oid] = ord_obj

        # 2. Identify disrupted warehouse IDs
        affected_wh_ids: Set[str] = set()
        if problem:
            affected_wh_ids.update(problem.affected_warehouses)

        for d in self.twin.disruptions.values():
            if isinstance(d, dict):
                d = Disruption(**d)
            if d.status == DisruptionStatus.ACTIVE and d.type in {
                DisruptionType.WAREHOUSE_FAILURE,
                DisruptionType.WAREHOUSE_SLOWDOWN
            }:
                affected_wh_ids.add(d.target_id)

        # Also inspect warehouse operational status directly
        for wh in self.twin.list_warehouses():
            if wh.status in {WarehouseStatus.OFFLINE, WarehouseStatus.DISRUPTED}:
                affected_wh_ids.add(wh.id)
            if wh.node_id is not None and self.twin.graph.graph.has_node(wh.node_id):
                if self.twin.graph.graph.nodes[wh.node_id].get("status") in {"CLOSED", "OFFLINE"}:
                    affected_wh_ids.add(wh.id)

        # 3. Scan all active orders in the twin
        for order in self.twin.list_orders():
            if order.status in {OrderStatus.DELIVERED, OrderStatus.CANCELLED}:
                continue

            orig_wh_id = order.source_warehouse_id
            if orig_wh_id is None:
                affected_orders_map[order.id] = order
                continue

            # Check if source warehouse is disrupted
            if orig_wh_id in affected_wh_ids:
                affected_orders_map[order.id] = order
                continue

            wh = self.twin.get_warehouse(orig_wh_id)
            if wh is None or wh.status != WarehouseStatus.ACTIVE:
                affected_orders_map[order.id] = order
                continue

            # Check if inventory stock at source warehouse is insufficient (stockout risk)
            inv_item = self.twin.get_inventory(orig_wh_id, order.sku)
            if inv_item is None or inv_item.available < order.quantity:
                affected_orders_map[order.id] = order
                continue

            # Check if route from source warehouse to customer is completely blocked
            cust_node = _get_node_id(self.twin, order.customer_id)
            if wh.node_id is not None and cust_node is not None:
                path, m = dijkstra_shortest_path(self.twin.graph, wh.node_id, cust_node)
                if not path or m.get("travel_time", 999.0) >= 999.0:
                    affected_orders_map[order.id] = order
                    continue

        # Sort orders by priority descending (tier 5 before tier 1), then promised delivery time
        sorted_orders = sorted(
            affected_orders_map.values(),
            key=lambda o: (-o.priority, o.promised_delivery_time, o.order_time)
        )
        return sorted_orders

    def compute_allocation_score(
        self,
        metrics: Dict[str, Any],
        allocated_qty: float,
        requested_qty: float,
        ref_metrics: Optional[Dict[str, float]] = None
    ) -> float:
        """
        Computes a multi-objective scalar score for an alternate fulfillment candidate.
        Penalizes infeasible paths, delivery delays past SLA, and unfulfilled stockout quantities.
        Lower score indicates a superior allocation candidate.
        """
        if not metrics.get("is_feasible", False) or allocated_qty <= 0.0:
            return 1e6

        ref = ref_metrics or {}
        ref_time = max(0.1, ref.get("travel_time", 1.5))
        ref_cost = max(1.0, ref.get("transport_cost", 50.0))
        ref_delay = max(0.1, ref.get("delivery_delay", 1.0))
        ref_stock = max(1.0, requested_qty)

        norm_time = metrics.get("travel_time", 1.0) / ref_time
        norm_cost = metrics.get("transport_cost", 50.0) / ref_cost
        norm_risk = metrics.get("risk", 0.1)
        norm_delay = metrics.get("delivery_delay", 0.0) / ref_delay
        stockout_remaining = max(0.0, requested_qty - allocated_qty)
        norm_stockout = stockout_remaining / ref_stock

        w_time = self.weights.get("TRAVEL_TIME", 1.0)
        w_cost = self.weights.get("TRANSPORT_COST", 0.8)
        w_risk = self.weights.get("RISK", 0.5)
        w_delay = self.weights.get("DELIVERY_DELAY", 1.2)
        w_stock = self.weights.get("STOCKOUT_RISK", 2.0)

        score = (
            (w_time * norm_time) +
            (w_cost * norm_cost) +
            (w_risk * norm_risk) +
            (w_delay * norm_delay) +
            (w_stock * norm_stockout)
        )
        return float(round(score, 4))

    def evaluate_order_baseline(self, order: Order) -> Dict[str, Any]:
        """
        Evaluates the baseline fulfillment route and delivery metrics for an order
        from its original source warehouse under the current scenario state.
        """
        orig_wh_id = order.source_warehouse_id
        orig_wh = self.twin.get_warehouse(orig_wh_id) if orig_wh_id else None
        cust_node = _get_node_id(self.twin, order.customer_id)

        if not orig_wh or orig_wh.status in {WarehouseStatus.OFFLINE, WarehouseStatus.DISRUPTED}:
            return {
                "is_feasible": False,
                "travel_time": 999.0,
                "distance": 999.0,
                "transport_cost": 999.0,
                "risk": 1.0,
                "fuel_cost": 999.0,
                "carbon": 999.0,
                "delivery_delay": 999.0,
                "explanation": f"Original source warehouse {orig_wh_id} is offline or unavailable."
            }

        orig_node = orig_wh.node_id
        if orig_node is None or cust_node is None:
            return {
                "is_feasible": False,
                "travel_time": 999.0,
                "distance": 999.0,
                "transport_cost": 999.0,
                "risk": 1.0,
                "fuel_cost": 999.0,
                "carbon": 999.0,
                "delivery_delay": 999.0,
                "explanation": "Origin or customer node cannot be resolved."
            }

        path, _ = dijkstra_shortest_path(self.twin.graph, orig_node, cust_node)
        if not path:
            return {
                "is_feasible": False,
                "travel_time": 999.0,
                "distance": 999.0,
                "transport_cost": 999.0,
                "risk": 1.0,
                "fuel_cost": 999.0,
                "carbon": 999.0,
                "delivery_delay": 999.0,
                "explanation": "No open physical route from original warehouse to customer."
            }

        return evaluate_route_metrics(self.twin, path, order_id=order.id)

    def find_candidate_warehouses(
        self,
        order: Order,
        virtual_stock: Dict[Tuple[str, str], float],
        virtual_capacity: Dict[str, float]
    ) -> List[Dict[str, Any]]:
        """
        Discovers and ranks candidate alternate warehouses capable of fulfilling the order.
        Validates:
          1. Warehouse operational status (must not be OFFLINE)
          2. Physical graph node availability (not CLOSED)
          3. SKU existence and available stock > 0
          4. Downstream delivery route feasibility to the customer
        Returns list of evaluated candidate dictionaries.
        """
        cust_node = _get_node_id(self.twin, order.customer_id)
        if cust_node is None:
            return []

        candidates: List[Dict[str, Any]] = []

        for wh in self.twin.list_warehouses():
            # 1. Operational checks
            if wh.status == WarehouseStatus.OFFLINE:
                continue

            wh_node = wh.node_id
            if wh_node is None or not self.twin.graph.graph.has_node(wh_node):
                continue
            if self.twin.graph.graph.nodes[wh_node].get("status") in {"CLOSED", "OFFLINE"}:
                continue

            # 2. Capacity validation
            rem_capacity = virtual_capacity.get(wh.id, wh.available_storage)
            if rem_capacity <= 0.0 and wh.storage_capacity > 0:
                continue

            # 3. Inventory stock check
            inv_item = self.twin.get_inventory(wh.id, order.sku)
            if inv_item is None:
                continue

            avail = virtual_stock.get((wh.id, order.sku), inv_item.available)
            if avail <= 0.0:
                continue

            # 4. Route feasibility check
            path, d_metrics = dijkstra_shortest_path(self.twin.graph, wh_node, cust_node)
            if not path or d_metrics.get("travel_time", 999.0) >= 999.0:
                continue

            route_metrics = evaluate_route_metrics(self.twin, path, order_id=order.id)
            if not route_metrics.get("is_feasible", False):
                continue

            # 5. Quantity allocation logic (Full vs Partial)
            if avail >= order.quantity:
                allocated = order.quantity
                remaining = 0.0
                cand_status = "FEASIBLE"
            elif self.allow_partial and avail > 0.0:
                allocated = round(avail, 2)
                remaining = round(order.quantity - avail, 2)
                cand_status = "PARTIALLY_FEASIBLE"
            else:
                allocated = 0.0
                remaining = order.quantity
                cand_status = "INFEASIBLE"

            if cand_status == "INFEASIBLE":
                continue

            # 6. Multi-objective scoring
            score = self.compute_allocation_score(
                metrics=route_metrics,
                allocated_qty=allocated,
                requested_qty=order.quantity,
                ref_metrics=route_metrics
            )

            candidates.append({
                "warehouse_id": wh.id,
                "warehouse_name": wh.name,
                "warehouse_node": wh_node,
                "path": path,
                "allocated_quantity": allocated,
                "remaining_quantity": remaining,
                "cand_status": cand_status,
                "route_metrics": route_metrics,
                "score": score,
            })

        # Rank candidates by score ascending (lowest measured score is best)
        candidates.sort(key=lambda c: c["score"])
        return candidates

    def reallocate_all(
        self,
        problem: Optional[RecoveryProblem] = None,
        scenario_id: Optional[str] = None
    ) -> RecoveryPlan:
        """
        Executes cross-warehouse inventory reallocation analysis for all affected orders.
        Does NOT mutate the digital twin state, warehouse stock, or order records.
        Returns a complete, structured RecoveryPlan with per-order reallocation results.
        """
        t_start = time.time()
        scen_id = scenario_id or (problem.scenario_id if problem else getattr(self.twin, "scenario_id", self.twin.name))
        prob_id = problem.problem_id if problem else f"prob-{uuid.uuid4().hex[:8]}"

        # 1. Identify affected orders
        affected_orders = self.detect_affected_orders(problem=problem)

        # 2. Local tracking of remaining stock and storage capacity across the batch
        # Ensures multiple orders cannot claim the exact same inventory without mutating the twin
        virtual_stock: Dict[Tuple[str, str], float] = {
            (item.warehouse_id, item.sku): item.available
            for item in self.twin.list_inventory()
        }
        virtual_capacity: Dict[str, float] = {
            wh.id: wh.available_storage
            for wh in self.twin.list_warehouses()
        }

        reallocation_results: List[InventoryReallocationResult] = []
        recovery_actions: List[RecoveryAction] = []

        orders_fully = 0
        orders_partially = 0
        orders_infeasible = 0
        tot_requested = 0.0
        tot_allocated = 0.0
        tot_remaining = 0.0

        for order in affected_orders:
            tot_requested += order.quantity
            base_metrics = self.evaluate_order_baseline(order)

            # Discover candidate alternate warehouses
            candidates = self.find_candidate_warehouses(
                order=order,
                virtual_stock=virtual_stock,
                virtual_capacity=virtual_capacity
            )

            if candidates:
                best = candidates[0]
                prop_wh = best["warehouse_id"]
                alloc_qty = best["allocated_quantity"]
                rem_qty = best["remaining_quantity"]
                route = best["path"]
                cand_status = best["cand_status"]
                opt_metrics = best["route_metrics"]
                score = best["score"]

                # Deduct allocated quantity from virtual batch pools
                virtual_stock[(prop_wh, order.sku)] = max(0.0, virtual_stock.get((prop_wh, order.sku), 0.0) - alloc_qty)
                virtual_capacity[prop_wh] = max(0.0, virtual_capacity.get(prop_wh, 0.0) - alloc_qty)

                if cand_status == "FEASIBLE":
                    orders_fully += 1
                    explanation = (
                        f"Order {order.id} cannot be fulfilled from warehouse {order.source_warehouse_id} under active disruption. "
                        f"Alternate warehouse {prop_wh} ({best['warehouse_name']}) has sufficient available inventory for SKU {order.sku} "
                        f"and provides a feasible customer delivery route via nodes {route}. "
                        f"Selected recovery allocation assigns {alloc_qty:.1f} units from {prop_wh} without modifying twin state."
                    )
                else:
                    orders_partially += 1
                    explanation = (
                        f"Warehouse {prop_wh} can provide {alloc_qty:.1f} of the requested {order.quantity:.1f} units for SKU {order.sku}. "
                        f"The remaining {rem_qty:.1f} units remain unfulfilled, so the recommendation is PARTIALLY_FEASIBLE."
                    )

                tot_allocated += alloc_qty
                tot_remaining += rem_qty

                # Create recommended recovery action
                recovery_actions.append(RecoveryAction(
                    action_type=RecoveryActionType.REALLOCATE_INVENTORY,
                    target_id=order.id,
                    parameters={
                        "order_id": order.id,
                        "sku": order.sku,
                        "original_warehouse": order.source_warehouse_id,
                        "proposed_warehouse": prop_wh,
                        "allocated_quantity": alloc_qty,
                        "remaining_quantity": rem_qty,
                        "route": route
                    },
                    description=f"Reallocate order {order.id} fulfillment from {order.source_warehouse_id} to {prop_wh} ({alloc_qty:.1f} units)"
                ))

            else:
                # Infeasible allocation
                orders_infeasible += 1
                prop_wh = None
                alloc_qty = 0.0
                rem_qty = order.quantity
                route = []
                cand_status = "INFEASIBLE"
                opt_metrics = {
                    "is_feasible": False,
                    "travel_time": 999.0,
                    "distance": 999.0,
                    "transport_cost": 999.0,
                    "risk": 1.0,
                    "fuel_cost": 999.0,
                    "carbon": 999.0,
                    "delivery_delay": 999.0
                }
                score = 1e6
                tot_remaining += rem_qty
                explanation = (
                    f"Order {order.id} cannot be fulfilled: no operational alternate warehouse has available stock "
                    f"or a feasible open transport route to customer {order.customer_id}."
                )

                recovery_actions.append(RecoveryAction(
                    action_type=RecoveryActionType.DEFER_ORDER,
                    target_id=order.id,
                    parameters={
                        "order_id": order.id,
                        "sku": order.sku,
                        "original_warehouse": order.source_warehouse_id,
                        "remaining_quantity": rem_qty
                    },
                    description=f"Defer order {order.id}: no alternate warehouse can fulfill requested SKU {order.sku}"
                ))

            # Metric deltas
            metric_delta = {}
            for k in ["travel_time", "distance", "transport_cost", "risk", "fuel_cost", "carbon", "delivery_delay"]:
                b_val = base_metrics.get(k, 0.0)
                o_val = opt_metrics.get(k, 0.0)
                delta = round(o_val - b_val, 2)
                pct = round((delta / b_val * 100.0), 2) if 0.0 < b_val < 900.0 else 0.0
                metric_delta[f"{k}_delta"] = delta
                metric_delta[f"{k}_pct_change"] = pct

            reallocation_results.append(InventoryReallocationResult(
                order_id=order.id,
                sku=order.sku,
                original_warehouse_id=order.source_warehouse_id,
                proposed_warehouse_id=prop_wh,
                requested_quantity=order.quantity,
                allocated_quantity=alloc_qty,
                remaining_quantity=rem_qty,
                allocation_changed=(prop_wh != order.source_warehouse_id),
                route=route,
                route_feasible=cand_status in {"FEASIBLE", "PARTIALLY_FEASIBLE"},
                baseline_metrics=base_metrics,
                optimized_metrics=opt_metrics,
                metric_delta=metric_delta,
                stockout_before=order.quantity,
                stockout_after=rem_qty,
                allocation_score=score if score < 1e6 else None,
                feasibility_status=cand_status,
                explanation=explanation
            ))

        exec_time = time.time() - t_start

        # Global Plan Feasibility & Explanation
        if not affected_orders:
            global_status = "FEASIBLE"
            global_explanation = "No affected customer orders requiring inventory reallocation."
        elif orders_fully == len(affected_orders):
            global_status = "FEASIBLE"
            global_explanation = (
                f"Selected recovery allocation successfully reallocated all {len(affected_orders)} affected order(s) "
                f"to operational alternate warehouses with available inventory and feasible customer routes."
            )
        elif orders_infeasible == len(affected_orders):
            global_status = "INFEASIBLE"
            global_explanation = "All affected orders are infeasible: no alternate warehouse has available stock or open routes."
        else:
            global_status = "PARTIALLY_FEASIBLE"
            global_explanation = (
                f"Inventory reallocation completed: {orders_fully} order(s) fully reallocated, "
                f"{orders_partially} partially reallocated, {orders_infeasible} unfulfilled. "
                f"Total fulfillment rate: {(tot_allocated / tot_requested * 100.0):.1f}%."
            )

        return RecoveryPlan(
            scenario_id=scen_id,
            problem_id=prob_id,
            solver="DETERMINISTIC_INVENTORY_ALLOCATOR",
            solver_execution_time=round(exec_time, 4),
            shipment_results=[],
            inventory_reallocation_results=reallocation_results,
            actions=recovery_actions,
            affected_shipments=[],
            affected_orders=[o.id for o in affected_orders],
            orders_fully_reallocated=orders_fully,
            orders_partially_reallocated=orders_partially,
            orders_infeasible=orders_infeasible,
            total_requested_quantity=round(tot_requested, 2),
            total_allocated_quantity=round(tot_allocated, 2),
            total_remaining_quantity=round(tot_remaining, 2),
            baseline_metrics=problem.baseline_metrics.model_dump() if problem else {},
            projected_metrics={
                "orders_fully_reallocated": orders_fully,
                "orders_partially_reallocated": orders_partially,
                "orders_infeasible": orders_infeasible,
                "total_requested_quantity": round(tot_requested, 2),
                "total_allocated_quantity": round(tot_allocated, 2),
                "total_remaining_quantity": round(tot_remaining, 2),
                "fulfillment_rate_pct": round(tot_allocated / tot_requested * 100.0, 2) if tot_requested > 0 else 100.0,
            },
            objective_score=round(sum(r.allocation_score for r in reallocation_results if r.allocation_score is not None), 3) if reallocation_results else 0.0,
            feasibility_status=global_status,
            explanation=global_explanation
        )

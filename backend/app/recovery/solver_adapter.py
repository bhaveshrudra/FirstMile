import time
import numpy as np
from typing import Dict, Any, List, Optional

from ..digital_twin.engine import DigitalTwinEngine
from ..optimization.improved_qpso import ImprovedQPSO
from ..optimization.route_encoding import decode_shortest_path
from .models import (
    RecoveryProblem,
    RecoveryPlan,
    RecoveryAction,
    RecoveryActionType,
    ShipmentRecoveryResult,
)
from .fitness import (
    evaluate_route_metrics,
    compute_recovery_fitness,
    make_shipment_fitness_fn,
)


class RecoverySolverAdapter:
    """
    Adapter bridging RecoveryProblem to the optimization core (ImprovedQPSO).
    Solves recovery rerouting one affected shipment at a time, enforcing graph-compatible
    particle dimensions (nodes 0..15), multi-objective fitness evaluation, and deterministic
    Dijkstra fallback for guaranteed feasibility.
    """

    def __init__(
        self,
        twin: DigitalTwinEngine,
        swarm_size: int = 30,
        iterations: int = 50,
        seed: Optional[int] = None
    ):
        self.twin = twin
        self.swarm_size = swarm_size
        self.iterations = iterations
        self.seed = seed

    def solve_recovery(self, problem: RecoveryProblem) -> RecoveryPlan:
        """
        Executes multi-objective swarm rerouting for all affected shipments in the problem.
        Compares IQPSO candidate routes against deterministic Dijkstra bypass routes.
        Returns a structured RecoveryPlan with metric deltas without mutating twin state.
        """
        start_overall = time.time()
        g = self.twin.graph.graph
        num_nodes = g.number_of_nodes()

        # Extract active objective weights
        weights = {
            obj.name.value: obj.weight
            for obj in problem.objectives
            if obj.enabled
        }

        shipment_results: List[ShipmentRecoveryResult] = []
        updated_actions: List[RecoveryAction] = list(problem.candidate_actions)
        all_feasible = True

        for aff_shp in problem.affected_shipments:
            # 1. Evaluate baseline/disrupted route metrics
            base_metrics = evaluate_route_metrics(self.twin, aff_shp.current_route, aff_shp.shipment_id)

            # 2. Extract Dijkstra candidate route from problem formulation
            dijkstra_candidate_route = []
            for cr in aff_shp.candidate_routes:
                if cr.is_feasible and cr.path:
                    dijkstra_candidate_route = cr.path
                    break

            dijkstra_metrics = (
                evaluate_route_metrics(self.twin, dijkstra_candidate_route, aff_shp.shipment_id)
                if dijkstra_candidate_route
                else {"is_feasible": False, "travel_time": 999.0, "distance": 999.0, "transport_cost": 999.0, "risk": 1.0, "fuel_cost": 999.0, "carbon": 999.0, "delivery_delay": 999.0}
            )
            dijkstra_fitness = compute_recovery_fitness(dijkstra_metrics, weights, reference_metrics=dijkstra_metrics)
            dijkstra_metrics["fitness"] = round(dijkstra_fitness, 4)
            dijkstra_metrics["path"] = dijkstra_candidate_route

            # 3. If topologically disconnected, mark infeasible immediately
            if aff_shp.is_route_invalid and not dijkstra_candidate_route:
                all_feasible = False
                shipment_results.append(ShipmentRecoveryResult(
                    shipment_id=aff_shp.shipment_id,
                    original_route=aff_shp.current_route,
                    optimized_route=[],
                    route_changed=False,
                    solver_used="NONE",
                    fallback_used=False,
                    dijkstra_comparison=dijkstra_metrics,
                    iqpso_comparison=None,
                    baseline_metrics=base_metrics,
                    optimized_metrics=dijkstra_metrics,
                    metric_delta={},
                    feasibility_status="INFEASIBLE",
                    explanation=f"Shipment {aff_shp.shipment_id} cannot be rerouted: destination node {aff_shp.destination_node} is unreachable around active disruptions."
                ))
                continue

            # 4. If current route was valid and open, no rerouting required
            if not aff_shp.is_route_invalid:
                shipment_results.append(ShipmentRecoveryResult(
                    shipment_id=aff_shp.shipment_id,
                    original_route=aff_shp.current_route,
                    optimized_route=aff_shp.current_route,
                    route_changed=False,
                    solver_used="PASSTHROUGH",
                    fallback_used=False,
                    dijkstra_comparison=dijkstra_metrics,
                    iqpso_comparison=None,
                    baseline_metrics=base_metrics,
                    optimized_metrics=base_metrics,
                    metric_delta={},
                    feasibility_status="FEASIBLE",
                    explanation=f"Shipment {aff_shp.shipment_id} route remains open and functional."
                ))
                continue

            # 5. Build Recovery Fitness Function for IQPSO
            fitness_fn = make_shipment_fitness_fn(
                twin=self.twin,
                origin_node=aff_shp.origin_node,
                dest_node=aff_shp.destination_node,
                shipment_id=aff_shp.shipment_id,
                weights=weights,
                reference_metrics=dijkstra_metrics
            )

            # 6. Run ImprovedQPSO with particle dimension = num_nodes
            if self.seed is not None:
                np.random.seed(self.seed)

            solver = ImprovedQPSO(
                swarm_size=self.swarm_size,
                iterations=self.iterations,
                dimensions=num_nodes,
                lower_bound=-5.0,
                upper_bound=5.0
            )

            t0 = time.time()
            best_pos, best_fit = solver.solve(fitness_fn)
            t_solve = time.time() - t0

            # 7. Decode IQPSO position vector into discrete route
            iqpso_path = decode_shortest_path(self.twin.graph, aff_shp.origin_node, aff_shp.destination_node, best_pos)
            iqpso_metrics = evaluate_route_metrics(self.twin, iqpso_path, aff_shp.shipment_id)
            iqpso_metrics["fitness"] = round(float(best_fit), 4)
            iqpso_metrics["execution_time"] = round(t_solve, 4)
            iqpso_metrics["path"] = iqpso_path

            # 8. Compare IQPSO vs Dijkstra and apply Fallback if IQPSO is infeasible or worse
            if iqpso_metrics["is_feasible"] and (best_fit <= dijkstra_fitness + 1e-4 or not dijkstra_candidate_route):
                selected_route = iqpso_path
                selected_metrics = iqpso_metrics
                solver_used = "IQPSO"
                fallback_used = False
                explanation = (
                    f"Shipment {aff_shp.shipment_id} corridor severed. IQPSO explored alternate paths and selected bypass route "
                    f"{selected_route} (fitness: {best_fit:.2f} vs Dijkstra: {dijkstra_fitness:.2f})."
                )
            elif dijkstra_candidate_route:
                selected_route = dijkstra_candidate_route
                selected_metrics = dijkstra_metrics
                solver_used = "DIJKSTRA_FALLBACK"
                fallback_used = True
                explanation = (
                    f"Shipment {aff_shp.shipment_id} utilized deterministic Dijkstra fallback bypass route "
                    f"{selected_route} (fitness: {dijkstra_fitness:.2f} vs IQPSO: {best_fit:.2f})."
                )
            else:
                all_feasible = False
                selected_route = []
                selected_metrics = dijkstra_metrics
                solver_used = "NONE"
                fallback_used = False
                explanation = f"Shipment {aff_shp.shipment_id} has no feasible alternative route."

            # 9. Compute Metric Deltas between Disrupted Baseline and Selected Route
            metric_delta = {}
            for k in ["travel_time", "distance", "transport_cost", "risk", "fuel_cost", "carbon", "delivery_delay"]:
                b_val = base_metrics.get(k, 0.0)
                o_val = selected_metrics.get(k, 0.0)
                delta = round(o_val - b_val, 2)
                pct = round((delta / b_val * 100.0), 2) if b_val > 0.0 and b_val < 900.0 else 0.0
                metric_delta[f"{k}_delta"] = delta
                metric_delta[f"{k}_pct_change"] = pct

            # 10. Update actions list with selected route
            if selected_route:
                # Update candidate action for reroute
                for act in updated_actions:
                    if act.action_type == RecoveryActionType.REROUTE_SHIPMENT and act.target_id == aff_shp.shipment_id:
                        act.parameters["optimized_route"] = selected_route
                        act.parameters["solver_used"] = solver_used

            shipment_results.append(ShipmentRecoveryResult(
                shipment_id=aff_shp.shipment_id,
                original_route=aff_shp.current_route,
                optimized_route=selected_route,
                route_changed=selected_route != aff_shp.current_route,
                solver_used=solver_used,
                fallback_used=fallback_used,
                dijkstra_comparison=dijkstra_metrics,
                iqpso_comparison=iqpso_metrics,
                baseline_metrics=base_metrics,
                optimized_metrics=selected_metrics,
                metric_delta=metric_delta,
                feasibility_status="FEASIBLE" if selected_metrics.get("is_feasible") else "INFEASIBLE",
                explanation=explanation
            ))

        total_exec_time = time.time() - start_overall

        # 11. Aggregate Projected Metrics
        proj_time = sum(sr.optimized_metrics.get("travel_time", 0.0) for sr in shipment_results if sr.optimized_metrics.get("is_feasible"))
        proj_cost = sum(sr.optimized_metrics.get("transport_cost", 0.0) for sr in shipment_results if sr.optimized_metrics.get("is_feasible"))
        proj_risk = sum(sr.optimized_metrics.get("risk", 0.0) for sr in shipment_results if sr.optimized_metrics.get("is_feasible"))
        proj_carbon = sum(sr.optimized_metrics.get("carbon", 0.0) for sr in shipment_results if sr.optimized_metrics.get("is_feasible"))

        projected_metrics = {
            "total_travel_time": round(proj_time, 2),
            "total_transport_cost": round(proj_cost, 2),
            "total_risk": round(proj_risk, 2),
            "total_carbon": round(proj_carbon, 2),
            "rerouted_shipments_count": sum(1 for sr in shipment_results if sr.route_changed),
        }

        # Global feasibility status
        if not all_feasible:
            feasibility_status = "PARTIALLY_INFEASIBLE"
            global_explanation = "One or more shipments cannot be rerouted due to network topology disconnections."
        else:
            feasibility_status = "FEASIBLE"
            global_explanation = (
                f"IQPSO and Dijkstra recovery optimization completed for {len(shipment_results)} shipment(s). "
                f"Feasible alternate bypass routes assigned based on travel time, transport cost, risk, and delivery delay."
            )

        return RecoveryPlan(
            scenario_id=problem.scenario_id,
            problem_id=problem.problem_id,
            solver="IQPSO",
            solver_execution_time=round(total_exec_time, 3),
            shipment_results=shipment_results,
            actions=updated_actions,
            affected_shipments=[s.shipment_id for s in problem.affected_shipments],
            baseline_metrics=problem.baseline_metrics.model_dump(),
            projected_metrics=projected_metrics,
            objective_score=round(sum(sr.optimized_metrics.get("fitness", 0.0) for sr in shipment_results), 3),
            feasibility_status=feasibility_status,
            explanation=global_explanation
        )

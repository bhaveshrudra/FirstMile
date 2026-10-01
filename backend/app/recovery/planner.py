from typing import Dict, Any, List, Optional
from ..digital_twin.engine import DigitalTwinEngine
from .models import RecoveryProblem, RecoveryPlan, RecoveryAction
from .problem import build_recovery_problem


class RecoveryPlanner:
    """
    High-level orchestration service for PNT1 recovery workflows.
    Binds the disrupted Digital Twin state, extracts formal RecoveryProblems,
    prepares inputs for future solver adapters, and generates structured RecoveryPlans.
    In Phase 2B, coordinates the RecoverySolverAdapter to execute ImprovedQPSO rerouting.
    """

    def __init__(self, twin: DigitalTwinEngine):
        self.twin = twin

    def formulate_problem(
        self,
        disruption_ids: Optional[List[str]] = None,
        scenario_id: Optional[str] = None
    ) -> RecoveryProblem:
        """
        Extracts and structures the formal recovery problem from the current twin state.
        """
        return build_recovery_problem(
            twin=self.twin,
            disruption_ids=disruption_ids,
            scenario_id=scenario_id
        )

    def prepare_optimizer_payload(self, problem: RecoveryProblem) -> Dict[str, Any]:
        """
        Constructs the normalized payload contract to be consumed by the Phase 2B
        OptimizationAdapter (ImprovedQPSO solver). Translates candidate routes,
        vehicle constraints, and multi-objective weights into mathematical arrays.
        """
        num_shipments = len(problem.affected_shipments)
        nodes_count = self.twin.graph.graph.number_of_nodes()

        # Build shipment OD pairs
        shipment_od_pairs = [
            (s.origin_node, s.destination_node, s.shipment_id)
            for s in problem.affected_shipments
        ]

        # Extract active objective weights
        objective_weights = {
            obj.name.value: obj.weight
            for obj in problem.objectives
            if obj.enabled
        }

        return {
            "problem_id": problem.problem_id,
            "scenario_id": problem.scenario_id,
            "dimensions": max(1, num_shipments),
            "num_nodes": nodes_count,
            "shipment_od_pairs": shipment_od_pairs,
            "candidate_paths_count": sum(len(s.candidate_routes) for s in problem.affected_shipments),
            "objective_weights": objective_weights,
            "constraints_count": len([c for c in problem.constraints if c.enabled]),
            "is_feasible": problem.is_feasible,
        }

    def generate_plan_placeholder(self, problem: RecoveryProblem) -> RecoveryPlan:
        """
        Creates a structured placeholder RecoveryPlan recording candidate actions,
        baseline metrics, and feasibility status prior to solver execution in Phase 2B.
        """
        return RecoveryPlan(
            scenario_id=problem.scenario_id,
            problem_id=problem.problem_id,
            actions=problem.candidate_actions,
            affected_shipments=[s.shipment_id for s in problem.affected_shipments],
            baseline_metrics=problem.baseline_metrics.model_dump(),
            projected_metrics={
                "projected_travel_time": problem.baseline_metrics.total_travel_time,
                "projected_cost": problem.baseline_metrics.transport_cost,
                "projected_risk": problem.baseline_metrics.risk,
            },
            objective_score=None,
            feasibility_status="FEASIBLE" if problem.is_feasible else "INFEASIBLE",
            explanation="Placeholder recovery plan formulated in Phase 2A; solver execution scheduled for Phase 2B."
        )

    def optimize_recovery(
        self,
        problem: Optional[RecoveryProblem] = None,
        disruption_ids: Optional[List[str]] = None,
        scenario_id: Optional[str] = None,
        swarm_size: int = 30,
        iterations: int = 50,
        seed: Optional[int] = None
    ) -> RecoveryPlan:
        """
        Coordinates execution of ImprovedQPSO rerouting via RecoverySolverAdapter.
        Derives optimal alternative bypass routes without mutating baseline or scenario twin states.
        """
        if problem is None:
            problem = self.formulate_problem(
                disruption_ids=disruption_ids,
                scenario_id=scenario_id
            )

        from .solver_adapter import RecoverySolverAdapter
        adapter = RecoverySolverAdapter(
            twin=self.twin,
            swarm_size=swarm_size,
            iterations=iterations,
            seed=seed
        )
        return adapter.solve_recovery(problem)

    def reallocate_inventory(
        self,
        problem: Optional[RecoveryProblem] = None,
        disruption_ids: Optional[List[str]] = None,
        scenario_id: Optional[str] = None,
        allow_partial: bool = True
    ) -> RecoveryPlan:
        """
        Coordinates execution of deterministic cross-warehouse inventory reallocation.
        Identifies affected orders, evaluates alternate fulfillment warehouses,
        checks inventory availability and route feasibility, and derives optimal
        fulfillment recommendations without mutating baseline or scenario twin states.
        """
        if problem is None:
            problem = self.formulate_problem(
                disruption_ids=disruption_ids,
                scenario_id=scenario_id
            )

        from .inventory_allocator import InventoryReallocationEngine
        engine = InventoryReallocationEngine(
            twin=self.twin,
            allow_partial=allow_partial
        )
        return engine.reallocate_all(
            problem=problem,
            scenario_id=scenario_id or problem.scenario_id
        )

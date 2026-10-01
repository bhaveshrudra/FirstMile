from fastapi import APIRouter, HTTPException
from typing import Dict, Any
from . import state
from ..schemas.benchmark import BenchmarkRequestSchema, BenchmarkResponseSchema
from ..benchmarking.benchmark_runner import BenchmarkRunner

router = APIRouter(prefix="/benchmark", tags=["benchmark"])

@router.post("/run", response_model=BenchmarkResponseSchema)
def run_benchmark(payload: BenchmarkRequestSchema):
    """
    Triggers a comparative research benchmark (PSO vs QPSO vs IQPSO) on the active graph state.
    """
    g = state.active_graph.graph
    runner = BenchmarkRunner(state.active_graph)
    
    if payload.problem_type == "shortest_path":
        if payload.source is None or payload.target is None:
            raise HTTPException(status_code=400, detail="Shortest path benchmark requires source and target node IDs.")
        if not (g.has_node(payload.source) and g.has_node(payload.target)):
            raise HTTPException(status_code=400, detail="Source or target node not found in current graph.")
            
        results = runner.run_shortest_path_benchmark(
            source=payload.source,
            target=payload.target,
            swarm_size=payload.swarm_size,
            iterations=payload.iterations,
            runs=payload.runs,
            weights=payload.weights
        )
        return {
            "problem_type": "shortest_path",
            "dijkstra": results.get("dijkstra"),
            "summary": results["summary"],
            "best_routes": results["best_routes"],
            "histories": results["histories"],
            "diversity": results["diversity"],
            "statistical_tests": results["statistical_tests"]
        }
        
    elif payload.problem_type == "vrp":
        if payload.depot_id is None or not payload.customer_ids:
            raise HTTPException(status_code=400, detail="VRP benchmark requires depot_id and a list of customer_ids.")
        if not g.has_node(payload.depot_id):
            raise HTTPException(status_code=400, detail="Depot node not found in graph.")
        for cust in payload.customer_ids:
            if not g.has_node(cust):
                raise HTTPException(status_code=400, detail=f"Customer node {cust} not found in graph.")
                
        demands = {c: float((c % 3 + 1) * 10) for c in payload.customer_ids}
        
        results = runner.run_vrp_benchmark(
            customer_ids=payload.customer_ids,
            depot_id=payload.depot_id,
            demands=demands,
            vehicle_capacity=payload.vehicle_capacity or 100.0,
            max_vehicles=payload.max_vehicles or 5,
            swarm_size=payload.swarm_size,
            iterations=payload.iterations,
            runs=payload.runs,
            weights=payload.weights
        )
        return {
            "problem_type": "vrp",
            "exact_optimum": results.get("exact_optimum"),
            "summary": results["summary"],
            "best_routes": results["best_routes"],
            "histories": results["histories"],
            "diversity": results["diversity"],
            "statistical_tests": results["statistical_tests"]
        }
        
    else:
        raise HTTPException(status_code=400, detail="Invalid problem_type. Choose 'shortest_path' or 'vrp'.")

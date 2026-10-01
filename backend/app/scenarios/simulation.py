from typing import Dict, Any, List, Optional
from ..digital_twin.engine import DigitalTwinEngine
from ..disruption.manager import DisruptionManager
from ..disruption.impact import analyze_twin_impact
from ..disruption.models import DisruptionStatus


def run_scenario_simulation(
    twin: DigitalTwinEngine,
    duration_hours: float = 24.0,
    step_hours: float = 6.0,
    scenario_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Executes a deterministic what-if time progression simulation over an isolated Digital Twin.
    Advances the virtual clock in discrete time steps, manages disruption lifecycle/expiry,
    recalculates dynamic network congestion and cascades, and collects compact step summaries.
    Operates strictly on the provided twin instance without mutating baseline twins.
    """
    if duration_hours <= 0:
        raise ValueError("duration_hours must be strictly positive.")
    if step_hours <= 0:
        raise ValueError("step_hours must be strictly positive.")

    dm = DisruptionManager(twin)
    start_hour = twin.simulation_time
    total_steps = int(duration_hours // step_hours)

    timeline: List[Dict[str, Any]] = []

    # Step 0: Initial Observation
    dm.check_expiry(start_hour)
    impact_0 = analyze_twin_impact(twin)
    active_disruptions_0 = [d.id for d in dm.list_disruptions(active_only=True)]

    timeline.append({
        "step": 0,
        "time": round(start_hour, 2),
        "elapsed_hours": 0.0,
        "active_disruptions_count": len(active_disruptions_0),
        "active_disruptions": active_disruptions_0,
        "affected_shipments_count": impact_0["affected_shipments_count"],
        "affected_orders_count": impact_0["affected_orders_count"],
        "twin_summary": twin.get_summary(),
    })

    # Time-Stepped Progression
    for step_num in range(1, total_steps + 1):
        elapsed = step_num * step_hours
        current_cumulative_hour = start_hour + elapsed
        current_diurnal_hour = current_cumulative_hour % 24.0

        # 1. Advance simulation clock (synchronizes simulator)
        twin.update_simulation_time(current_diurnal_hour)

        # 2. Check and expire disruptions whose duration has ended
        for d in dm.list_disruptions():
            if d.status == DisruptionStatus.ACTIVE:
                # Disruption is expired if elapsed time exceeds duration, or if cumulative time >= end_time
                if elapsed >= d.duration_hours or current_cumulative_hour >= d.end_time:
                    dm.revert_physical_impact(d)
                    d.status = DisruptionStatus.EXPIRED

        # 3. Recompute transport network conditions
        twin.simulator.recompute_edge_travel_times()

        # 4. Measure affected entities and cascade impact
        current_impact = analyze_twin_impact(twin)
        current_active = [d.id for d in dm.list_disruptions(active_only=True)]

        # 5. Record concise state/impact summary
        timeline.append({
            "step": step_num,
            "time": round(current_diurnal_hour, 2),
            "elapsed_hours": round(elapsed, 2),
            "active_disruptions_count": len(current_active),
            "active_disruptions": current_active,
            "affected_shipments_count": current_impact["affected_shipments_count"],
            "affected_orders_count": current_impact["affected_orders_count"],
            "twin_summary": twin.get_summary(),
        })

    return {
        "scenario_id": scenario_id or getattr(twin, "scenario_id", twin.name),
        "duration_hours": duration_hours,
        "step_hours": step_hours,
        "total_steps": len(timeline),
        "timeline": timeline,
    }

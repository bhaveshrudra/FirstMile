from pydantic import BaseModel, Field
from typing import List, Optional

class TrafficIncident(BaseModel):
    id: str
    source: int
    target: int
    incident_type: str  # "accident", "roadwork", "weather", "breakdown", "closure"
    severity: float     # 0.0 (no impact) to 1.0 (complete blockage)
    description: str

def linear_travel_time(base_time: float, congestion: float, impact_factor: float = 2.0) -> float:
    """
    Computes travel time using the linear model:
    Te = Tbase * (1 + lambda * Ce)
    """
    return base_time * (1.0 + impact_factor * congestion)

def bpr_travel_time(length_km: float, speed_kph: float, capacity_vph: float, 
                    current_flow_vph: float, lanes: int = 1, 
                    speed_multiplier: float = 1.0, capacity_multiplier: float = 1.0) -> float:
    """
    Computes travel time (in hours) on a road segment using the BPR formula.
    """
    effective_speed = speed_kph * speed_multiplier
    if effective_speed <= 0:
        effective_speed = 1.0
        
    free_flow_time = length_km / effective_speed
    effective_capacity = capacity_vph * capacity_multiplier
    if effective_capacity <= 0:
        return 999.0  # impassable
        
    beta = 0.15
    gamma = 4.0
    congestion_ratio = current_flow_vph / effective_capacity
    travel_time = free_flow_time * (1.0 + beta * (congestion_ratio ** gamma))
    return travel_time


def get_diurnal_traffic_multiplier(hour: float) -> float:
    """
    Returns a traffic volume multiplier based on the hour of the day (0 to 23.9).
    Simulates peak morning commute (08:00) and evening commute (17:00).
    """
    import math
    base = 0.2
    morning_peak = 0.8 * math.exp(-0.5 * ((hour - 8.0) / 1.25) ** 2)
    evening_peak = 0.9 * math.exp(-0.5 * ((hour - 17.0) / 1.55) ** 2)
    return min(1.5, base + morning_peak + evening_peak)


# Mapping traffic states to congestion values
CONGESTION_STATES = {
    "FREE": 0.0,
    "LOW": 0.2,
    "MODERATE": 0.5,
    "HIGH": 0.8,
    "SEVERE": 1.0
}

import { 
  TrafficGraphData, 
  TrafficStatus, 
  OptimizationResponse, 
  VrpResponse, 
  BenchmarkResponse 
} from '../types';

const BASE_URL = 'http://localhost:8000/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody?.detail || `HTTP error! Status: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export const api = {
  // Graph endpoints
  getGraph: () => 
    request<TrafficGraphData>('/graph'),
    
  generateGraph: (topology: string, size: number, spacingKm: number = 0.5) => 
    request<TrafficGraphData>('/graph/generate', {
      method: 'POST',
      body: JSON.stringify({ topology, size, spacing_km: spacingKm }),
    }),

  // Traffic & Incident endpoints
  getTrafficStatus: () => 
    request<TrafficStatus>('/traffic/status'),

  updateTrafficTime: (hour: number) => 
    request<TrafficStatus>('/traffic/time', {
      method: 'POST',
      body: JSON.stringify({ hour }),
    }),

  addIncident: (source: number, target: number, incidentType: string, severity: number, description: string) => 
    request<any>('/traffic/incident', {
      method: 'POST',
      body: JSON.stringify({
        source,
        target,
        incident_type: incidentType,
        severity,
        description,
      }),
    }),

  triggerTrafficEvent: (eventType: string, source?: number, target?: number, severity?: number, description?: string) => 
    request<TrafficStatus>('/traffic/event', {
      method: 'POST',
      body: JSON.stringify({
        event_type: eventType,
        source,
        target,
        severity,
        description
      }),
    }),

  removeIncident: (incidentId: string) => 
    request<TrafficStatus>(`/traffic/incident/${incidentId}`, {
      method: 'DELETE',
    }),

  clearAllIncidents: () => 
    request<TrafficStatus>('/traffic/incident/clear', {
      method: 'POST',
    }),

  // Optimization endpoints
  runShortestPath: (
    source: number, 
    target: number, 
    algorithm: string, 
    swarmSize: number, 
    iterations: number,
    weights?: Record<string, number>
  ) => 
    request<OptimizationResponse>('/optimize/shortest-path', {
      method: 'POST',
      body: JSON.stringify({
        source,
        target,
        algorithm,
        swarm_size: swarmSize,
        iterations,
        weights,
      }),
    }),

  runVrp: (
    depotId: number, 
    customerIds: number[], 
    vehicleCapacity: number, 
    maxVehicles: number,
    swarmSize: number, 
    iterations: number,
    weights?: Record<string, number>
  ) => 
    request<VrpResponse>('/optimize/vrp', {
      method: 'POST',
      body: JSON.stringify({
        depot_id: depotId,
        customer_ids: customerIds,
        vehicle_capacity: vehicleCapacity,
        max_vehicles: maxVehicles,
        swarm_size: swarmSize,
        iterations,
        weights,
      }),
    }),

  // Benchmarking endpoint
  runBenchmark: (payload: {
    problem_type: string;
    source?: number;
    target?: number;
    depot_id?: number;
    customer_ids?: number[];
    vehicle_capacity?: number;
    max_vehicles?: number;
    swarm_size: number;
    iterations: number;
    runs: number;
    weights?: Record<string, number>;
  }) => 
    request<BenchmarkResponse>('/benchmark/run', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Scalability / Custom experiment endpoint
  runExperiment: (payload: {
    problem_type: string;
    algorithm?: string;
    swarm_size: number;
    iterations: number;
    runs: number;
    seed: number;
    node_sizes: number[];
  }) => 
    request<any>('/experiment/run', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
export default api;

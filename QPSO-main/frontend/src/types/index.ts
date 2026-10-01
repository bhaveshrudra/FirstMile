export interface MapNode {
  id: number;
  lat: number;
  lon: number;
  type: string;
  label: string;
}

export interface TrafficIncident {
  id: string;
  source: number;
  target: number;
  incident_type: string;
  severity: number;
  description: string;
}

export interface MapEdge {
  source: number;
  target: number;
  distance: number;
  speed: number;
  capacity: number;
  lanes: number;
  road_type: string;
  flow: number;
  current_travel_time: number;
  congestion: number;
  road_status: string;
  risk: number;
  incidents: TrafficIncident[];
}

export interface TrafficGraphData {
  nodes: MapNode[];
  edges: MapEdge[];
}

export interface RouteMetrics {
  travel_time: number;
  distance: number;
  congestion: number;
  fuel_cost?: number;
  risk: number;
  vehicles_used?: number;
  avg_utilization?: number;
  min_utilization?: number;
  max_utilization?: number;
}

export interface OptimizationResponse {
  algorithm: string;
  path: number[];
  metrics: RouteMetrics;
  fitness: number;
  history: number[];
  diversity: number[];
  execution_time: number;
}

export interface VrpResponse {
  routes: number[][];
  metrics: Record<string, number>;
  fitness: number;
  history: number[];
  diversity: number[];
  execution_time: number;
}

export interface AlgSummary {
  mean_fitness: number;
  best_fitness: number;
  worst_fitness: number;
  std_fitness: number;
  mean_runtime_sec: number;
  mean_convergence_iter: number;
  optimality_gap?: number;
}

export interface StatTestResult {
  u_statistic: number;
  p_value: number;
  significant: boolean;
  message: string;
}

export interface BenchmarkResponse {
  problem_type: string;
  dijkstra?: { path: number[]; metrics: RouteMetrics; fitness: number };
  exact_optimum?: { routes: number[][]; metrics: RouteMetrics; fitness: number };
  summary: Record<string, AlgSummary>;
  best_routes: {
    pso: { path?: number[]; routes?: number[][]; metrics: RouteMetrics; fitness: number };
    qpso: { path?: number[]; routes?: number[][]; metrics: RouteMetrics; fitness: number };
    iqpso: { path?: number[]; routes?: number[][]; metrics: RouteMetrics; fitness: number };
  };
  histories: Record<string, number[][]>;
  diversity: Record<string, number[][]>;
  statistical_tests: Record<string, StatTestResult>;
}

export interface TrafficStatus {
  hour: number;
  active_incidents: TrafficIncident[];
}

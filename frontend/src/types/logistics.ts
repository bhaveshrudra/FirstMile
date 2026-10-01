/**
 * Real Logistics Digital Twin Type Definitions
 * Faithfully represents the 5-sheet dataset without fabricated vehicle tables.
 */

export interface Supplier {
  supplier_id: string;
  supplier_name: string;
  country: string;
  city: string;
  latitude: number;
  longitude: number;
  product_category: string;
  daily_capacity_units: number;
  reliability_score: number;
  lead_time_days: number;
  status: 'Active' | 'Inactive' | string;
  data_type: string;
}

export interface WarehouseInventoryRecord {
  warehouse_id: string;
  warehouse_name: string;
  country: string;
  city: string;
  latitude: number;
  longitude: number;
  sku: string;
  product_category: string;
  on_hand_units: number;
  reserved_units: number;
  available_units: number;
  capacity_units: number;
  reorder_point: number;
  data_type: string;
}

export interface PhysicalFacility {
  facility_id: string;
  name: string;
  city: string;
  latitude: number;
  longitude: number;
  svgX: number;
  svgY: number;
  inventory_records: WarehouseInventoryRecord[];
  total_on_hand: number;
  total_reserved: number;
  total_available: number;
  total_capacity: number;
  utilization_pct: number;
  status: 'optimal' | 'warning' | 'critical';
  associated_warehouse_ids: string[];
}

export interface NormalizedWarehouse {
  warehouse_id: string;
  name: string;
  cities: string[];
  records: WarehouseInventoryRecord[];
  total_on_hand: number;
  total_reserved: number;
  total_available: number;
  total_capacity: number;
  utilization_pct: number;
  status: 'optimal' | 'warning' | 'critical';
  stockout_skus: string[];
}

export interface OrderShipment {
  order_id: string;
  shipment_id: string;
  order_date: string;
  order_date_serial: number;
  supplier_id: string;
  origin_node_id: string;
  destination_node_id: string;
  sku: string;
  quantity_units: number;
  route_id: string;
  original_route_id?: string;
  ship_date: string;
  ship_date_serial: number;
  eta_date: string;
  eta_date_serial: number;
  actual_delivery_date: string | null;
  actual_delivery_date_serial: number | null;
  shipment_status: 'Delivered' | 'Delivered Late' | 'In Transit' | 'Delayed' | 'Planned' | 'Rerouted' | 'Recovered / On Schedule';
  priority: 'Normal' | 'High';
  data_type: string;
  sla_delta_hours?: number;
  is_rerouted?: boolean;
  recovery_plan_id?: string;
}

export interface TransportRoute {
  route_id: string;
  origin_node_id: string;
  destination_node_id: string;
  mode: string;
  distance_km: number;
  travel_time_hr: number;
  cost_per_unit: number;
  capacity_units_per_day: number;
  availability: 'Open' | 'Closed' | 'Degraded';
  risk_score: number;
  data_type: string;
}

export interface Disruption {
  disruption_id: string;
  disruption_type: string;
  affected_node_or_route_id: string;
  start_date: string;
  start_date_serial: number;
  duration_hours: number;
  end_date: string;
  severity: number;
  capacity_reduction_pct: number;
  description: string;
  scenario_status: string;
  data_type: string;
}

export type DisruptionState = 'active' | 'upcoming' | 'resolved';

export interface OperationalRecoveryState {
  disruption_id: string;
  status: 'UNRECOVERED' | 'RECOVERED' | 'PARTIAL';
  recovery_note: string;
  plan_id: string;
  commit_id: string;
  snapshot_id: string | null;
  committed_at: number;
  rerouted_shipments: string[];
  reallocated_orders: string[];
}

export interface EvaluatedDisruption extends Disruption {
  state: DisruptionState;
  remaining_hours?: number;
  recovery?: OperationalRecoveryState;
}

export interface NetworkKpis {
  total_warehouses: number;
  healthy_warehouses: number;
  at_risk_warehouses: number;
  critical_warehouses: number;
  total_inventory_units: number;
  available_inventory_units: number;
  reserved_inventory_units: number;
  total_shipments: number;
  in_transit_shipments: number;
  delayed_shipments: number;
  delivered_shipments: number;
  planned_shipments: number;
  rerouted_shipments: number;
  total_orders: number;
  otif_pct: number;
  active_disruptions_count: number;
  unrecovered_disruptions_count: number;
  disrupted_routes_count: number;
  disrupted_nodes_count: number;
}

export type RecoveryProgressStep =
  | 'IDLE'
  | 'IDENTIFYING DISRUPTION'
  | 'ANALYZING IMPACT'
  | 'OPTIMIZING ROUTES'
  | 'EVALUATING INVENTORY'
  | 'COMMITTING RECOVERY'
  | 'REFRESHING TWIN';

export interface RecoveryExecutionResult {
  success: boolean;
  disruption_id: string;
  disruption_type: string;
  target_entity: string;
  plan_id: string;
  commit_id: string;
  snapshot_id: string | null;
  scenario_id: string;
  solver: string;
  affected_shipments: string[];
  affected_orders: string[];
  rerouted_shipments: Array<{
    shipment_id: string;
    previous_route: string;
    new_route: string;
    eta_delta_hours: number;
    mode: string;
  }>;
  reallocated_orders: Array<{
    order_id: string;
    sku: string;
    quantity: number;
    source_warehouse: string;
    destination_warehouse: string;
  }>;
  operational_status: 'OPERATIONAL' | 'PARTIAL' | 'DEGRADED';
  rollback_available: boolean;
  execution_time_ms: number;
  explanation: string;
  message: string;
  error_type?: 'NO_ACTIVE_DISRUPTION' | 'ANALYSIS_FAILED' | 'COMMIT_FAILED' | 'PLAN_STALE';
}

export interface RollbackResult {
  success: boolean;
  rollback_id: string;
  snapshot_id: string;
  scenario_id: string;
  restored_entities: Record<string, number>;
  explanation: string;
  message: string;
}

export type NetworkOperationalStatus = 'NETWORK OPERATIONAL' | 'PARTIAL RECOVERY' | 'NETWORK DEGRADED';

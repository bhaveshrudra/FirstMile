/**
 * PNT1 Logistics Network Digital Twin - Normalized Data Service
 * Provides the SF Bay Area multimodal network (Warehouses ── Junctions ── Customers).
 * Can operate from the embedded deterministic PNT1 twin model or sync with backend APIs.
 */

export type NodeType = 'warehouse' | 'junction' | 'customer' | 'supplier' | 'port';

export interface PNT1Node {
  id: number;
  type: NodeType;
  label: string;
  name: string;
  lat: number;
  lon: number;
  capacity: number;
  status: 'ACTIVE' | 'WARNING' | 'CRITICAL';
  role_description: string;
}

export interface PNT1Edge {
  id: string;
  source: number;
  target: number;
  dist_km: number;
  speed_kph: number;
  mode: 'road' | 'rail' | 'ocean';
  road_type: 'highway' | 'arterial' | 'local' | 'rail' | 'waterway';
  status: 'open' | 'disrupted' | 'recommended';
  cost: number;
  carbon_kg: number;
}

export interface PNT1Shipment {
  id: string;
  order_id: string;
  origin_label: string;
  destination_label: string;
  origin_node: number;
  destination_node: number;
  customer_name: string;
  sku: string;
  quantity: number;
  current_route: number[]; // Sequence of node IDs
  original_route: number[];
  alternate_route?: number[];
  status: 'IN_TRANSIT' | 'DELAYED_AT_RISK' | 'REROUTED' | 'DELIVERED';
  priority: 'High' | 'Normal' | 'Critical';
  carrier_asset: string;
  eta_time: string;
  sla_delta_min: number;
}

export interface PNT1Disruption {
  id: string;
  name: string;
  type: string;
  affected_edge_ids: string[];
  affected_nodes: number[];
  affected_shipment_ids: string[];
  severity: number;
  capacity_reduction_pct: number;
  description: string;
  status: 'ACTIVE' | 'RECOVERED';
  recovery_recommendation: {
    title: string;
    solver: string;
    corridor_nodes: number[];
    corridor_labels: string[];
    eta_delta_min: number;
    distance_delta_km: number;
    explanation: string;
  };
}

export interface PNT1Kpis {
  total_warehouses: number;
  total_shipments: number;
  at_risk_shipments: number;
  active_disruptions: number;
  network_status: 'NETWORK OPERATIONAL' | 'DISRUPTION DETECTED' | 'PARTIAL RECOVERY';
}

// 1. Raw PNT1 Node Set (SF Bay Area Logistics Corridor)
const BASELINE_NODES: PNT1Node[] = [
  // Suppliers
  { id: 0, type: 'supplier', label: 'S1', name: 'Apex Microelectronics', lat: 37.9500, lon: -122.3500, capacity: 1500, status: 'ACTIVE', role_description: 'Semiconductor Component Supplier' },
  { id: 1, type: 'supplier', label: 'S2', name: 'Pacific Precision Parts', lat: 37.6000, lon: -122.0500, capacity: 2000, status: 'ACTIVE', role_description: 'Precision Metal & Enclosure Supplier' },
  // Warehouses
  { id: 2, type: 'warehouse', label: 'W1', name: 'Bay Gateway Distribution Center', lat: 37.8000, lon: -122.2500, capacity: 10000, status: 'ACTIVE', role_description: 'Northern Regional DC & Intermodal Hub' },
  { id: 3, type: 'warehouse', label: 'W2', name: 'Silicon Valley Fulfillment Hub', lat: 37.7000, lon: -122.1500, capacity: 12000, status: 'ACTIVE', role_description: 'Central Commercial Fulfillment DC' },
  // Port
  { id: 4, type: 'port', label: 'P1', name: 'Port of Oakland Intermodal Terminal', lat: 37.8100, lon: -122.3200, capacity: 50000, status: 'ACTIVE', role_description: 'Maritime Deepwater & Rail Port' },
  // Customers
  { id: 5, type: 'customer', label: 'C1', name: 'Metro Supercenter SF', lat: 37.7800, lon: -122.4200, capacity: 500, status: 'ACTIVE', role_description: 'Flagship Urban Retail Supercenter' },
  { id: 6, type: 'customer', label: 'C2', name: 'Mission Commercial Depot', lat: 37.7500, lon: -122.4000, capacity: 400, status: 'ACTIVE', role_description: 'Wholesale & B2B Commercial Outlet' },
  { id: 7, type: 'customer', label: 'C3', name: 'Berkeley Tech Outlet', lat: 37.8700, lon: -122.2700, capacity: 350, status: 'ACTIVE', role_description: 'Electronics Distribution Point' },
  { id: 8, type: 'customer', label: 'C4', name: 'Piedmont Supply Point', lat: 37.8300, lon: -122.2000, capacity: 300, status: 'ACTIVE', role_description: 'East Bay Retail Delivery Point' },
  { id: 9, type: 'customer', label: 'C5', name: 'Peninsula Medical Center', lat: 37.6800, lon: -122.4700, capacity: 600, status: 'ACTIVE', role_description: 'Critical Healthcare Medical Hub' },
  { id: 10, type: 'customer', label: 'C6', name: 'Silicon Valley Retail Outlet', lat: 37.5500, lon: -122.3000, capacity: 450, status: 'ACTIVE', role_description: 'South Bay Consumer Depot' },
  // Junctions
  { id: 11, type: 'junction', label: 'J1', name: 'Bay Bridge Transit Junction', lat: 37.8200, lon: -122.3800, capacity: 0, status: 'ACTIVE', role_description: 'Trans-Bay Highway Waypoint' },
  { id: 12, type: 'junction', label: 'J2', name: 'East Bay Arterial Junction', lat: 37.7500, lon: -122.2200, capacity: 0, status: 'ACTIVE', role_description: 'Industrial Corridor Interchange' },
  { id: 13, type: 'junction', label: 'J3', name: 'San Mateo Bridge East Junction', lat: 37.6200, lon: -122.2500, capacity: 0, status: 'ACTIVE', role_description: 'Southern Highway 92 Access' },
  { id: 14, type: 'junction', label: 'J4', name: 'Peninsula Coastal Bypass Junction', lat: 37.6000, lon: -122.3200, capacity: 0, status: 'ACTIVE', role_description: 'Highway 101 Coastal Interchange' },
  { id: 15, type: 'junction', label: 'J5', name: 'North Bay Shore Junction', lat: 37.8800, lon: -122.3100, capacity: 0, status: 'ACTIVE', role_description: 'Interstate 80 Approach Junction' },
];

// 2. Multimodal Transport Edges (connecting Warehouses, Junctions, Customers)
const BASELINE_EDGES: PNT1Edge[] = [
  // Upstream
  { id: 'E-0-2', source: 0, target: 2, dist_km: 22, speed_kph: 75, mode: 'road', road_type: 'highway', status: 'open', cost: 55, carbon_kg: 36 },
  { id: 'E-0-15', source: 0, target: 15, dist_km: 10, speed_kph: 65, mode: 'road', road_type: 'arterial', status: 'open', cost: 25, carbon_kg: 16 },
  { id: 'E-15-4', source: 15, target: 4, dist_km: 9, speed_kph: 60, mode: 'road', road_type: 'arterial', status: 'open', cost: 22, carbon_kg: 14 },
  { id: 'E-0-4', source: 0, target: 4, dist_km: 20, speed_kph: 25, mode: 'ocean', road_type: 'waterway', status: 'open', cost: 28, carbon_kg: 10 },
  { id: 'E-1-3', source: 1, target: 3, dist_km: 15, speed_kph: 75, mode: 'road', road_type: 'highway', status: 'open', cost: 38, carbon_kg: 25 },
  { id: 'E-1-12', source: 1, target: 12, dist_km: 20, speed_kph: 65, mode: 'road', road_type: 'arterial', status: 'open', cost: 45, carbon_kg: 32 },
  { id: 'E-1-4', source: 1, target: 4, dist_km: 30, speed_kph: 45, mode: 'rail', road_type: 'rail', status: 'open', cost: 32, carbon_kg: 12 },
  { id: 'E-4-2', source: 4, target: 2, dist_km: 6, speed_kph: 50, mode: 'road', road_type: 'arterial', status: 'open', cost: 15, carbon_kg: 9 },
  { id: 'E-4-12', source: 4, target: 12, dist_km: 12, speed_kph: 65, mode: 'road', road_type: 'arterial', status: 'open', cost: 28, carbon_kg: 18 },
  { id: 'E-2-3', source: 2, target: 3, dist_km: 14, speed_kph: 70, mode: 'road', road_type: 'highway', status: 'open', cost: 32, carbon_kg: 22 },
  { id: 'E-3-12', source: 3, target: 12, dist_km: 7, speed_kph: 60, mode: 'road', road_type: 'arterial', status: 'open', cost: 16, carbon_kg: 11 },

  // W1 Customer delivery routes: W1 ── J1 ── C1 (Primary Trans-Bay Corridor)
  { id: 'E-2-11', source: 2, target: 11, dist_km: 8, speed_kph: 70, mode: 'road', road_type: 'highway', status: 'disrupted', cost: 20, carbon_kg: 14 },
  { id: 'E-11-5', source: 11, target: 5, dist_km: 6, speed_kph: 65, mode: 'road', road_type: 'highway', status: 'disrupted', cost: 25, carbon_kg: 12 },

  // W1 direct local delivery: W1 ── C3 & W1 ── C4
  { id: 'E-2-7', source: 2, target: 7, dist_km: 9, speed_kph: 55, mode: 'road', road_type: 'arterial', status: 'open', cost: 20, carbon_kg: 13 },
  { id: 'E-2-8', source: 2, target: 8, dist_km: 6, speed_kph: 50, mode: 'road', road_type: 'arterial', status: 'open', cost: 14, carbon_kg: 9 },
  { id: 'E-7-8', source: 7, target: 8, dist_km: 7, speed_kph: 45, mode: 'road', road_type: 'local', status: 'open', cost: 12, carbon_kg: 8 },

  // SF Urban distribution
  { id: 'E-5-6', source: 5, target: 6, dist_km: 4, speed_kph: 40, mode: 'road', road_type: 'arterial', status: 'open', cost: 10, carbon_kg: 6 },
  { id: 'E-6-9', source: 6, target: 9, dist_km: 10, speed_kph: 65, mode: 'road', road_type: 'highway', status: 'open', cost: 22, carbon_kg: 15 },

  // Southern Trans-Bay Alternate Bypass Corridor: J2 ── J3 ── J4 (San Mateo Bridge)
  { id: 'E-12-13', source: 12, target: 13, dist_km: 16, speed_kph: 75, mode: 'road', road_type: 'highway', status: 'open', cost: 35, carbon_kg: 24 },
  { id: 'E-13-14', source: 13, target: 14, dist_km: 12, speed_kph: 75, mode: 'road', road_type: 'highway', status: 'open', cost: 30, carbon_kg: 20 },
  { id: 'E-14-9', source: 14, target: 9, dist_km: 11, speed_kph: 65, mode: 'road', road_type: 'arterial', status: 'open', cost: 24, carbon_kg: 16 },
  { id: 'E-14-10', source: 14, target: 10, dist_km: 7, speed_kph: 60, mode: 'road', road_type: 'arterial', status: 'open', cost: 15, carbon_kg: 10 },

  // W2 South Bay delivery links: W2 ── J3 ── J4 ── C6 & C5
  { id: 'E-3-13', source: 3, target: 13, dist_km: 10, speed_kph: 70, mode: 'road', road_type: 'highway', status: 'open', cost: 22, carbon_kg: 15 },
  { id: 'E-9-10', source: 9, target: 10, dist_km: 16, speed_kph: 65, mode: 'road', road_type: 'arterial', status: 'open', cost: 32, carbon_kg: 22 },
];

// 3. Baseline Shipments
const BASELINE_SHIPMENTS: PNT1Shipment[] = [
  {
    id: 'SHP-001',
    order_id: 'ORD-001',
    origin_label: 'W1',
    destination_label: 'C1',
    origin_node: 2,
    destination_node: 5,
    customer_name: 'Metro Supercenter SF',
    sku: 'SKU-MED-CHIP',
    quantity: 50,
    current_route: [2, 11, 5], // W1 -> J1 -> C1 (Bay Bridge)
    original_route: [2, 11, 5],
    alternate_route: [2, 3, 13, 14, 9, 6, 5], // W1 -> W2 -> J3 -> J4 -> C5 -> C2 -> C1
    status: 'DELAYED_AT_RISK',
    priority: 'Critical',
    carrier_asset: 'V1 (Truck Heavy)',
    eta_time: '13:30 PDT',
    sla_delta_min: 45,
  },
  {
    id: 'SHP-002',
    order_id: 'ORD-002',
    origin_label: 'W1',
    destination_label: 'C3',
    origin_node: 2,
    destination_node: 7,
    customer_name: 'Berkeley Tech Outlet',
    sku: 'SKU-IND-SENSOR',
    quantity: 120,
    current_route: [2, 7], // W1 -> C3
    original_route: [2, 7],
    status: 'IN_TRANSIT',
    priority: 'Normal',
    carrier_asset: 'V2 (Delivery Van)',
    eta_time: '13:00 PDT',
    sla_delta_min: 0,
  },
  {
    id: 'SHP-003',
    order_id: 'ORD-005',
    origin_label: 'W2',
    destination_label: 'C5',
    origin_node: 3,
    destination_node: 9,
    customer_name: 'Peninsula Medical Center',
    sku: 'SKU-MED-CHIP',
    quantity: 80,
    current_route: [3, 13, 14, 9], // W2 -> J3 -> J4 -> C5
    original_route: [3, 13, 14, 9],
    status: 'IN_TRANSIT',
    priority: 'Critical',
    carrier_asset: 'V3 (Fleet Truck)',
    eta_time: '14:15 PDT',
    sla_delta_min: 0,
  },
  {
    id: 'SHP-004',
    order_id: 'ORD-006',
    origin_label: 'W2',
    destination_label: 'C6',
    origin_node: 3,
    destination_node: 10,
    customer_name: 'Silicon Valley Outlet',
    sku: 'SKU-AUTO-MODULE',
    quantity: 60,
    current_route: [3, 13, 14, 10], // W2 -> J3 -> J4 -> C6
    original_route: [3, 13, 14, 10],
    status: 'DELIVERED',
    priority: 'Normal',
    carrier_asset: 'V4 (Fleet Van)',
    eta_time: '11:15 PDT',
    sla_delta_min: 0,
  },
  {
    id: 'SHP-005',
    order_id: 'ORD-001-STK',
    origin_label: 'P1',
    destination_label: 'W1',
    origin_node: 4,
    destination_node: 2,
    customer_name: 'Bay Gateway Inbound Terminal',
    sku: 'SKU-MED-CHIP',
    quantity: 500,
    current_route: [4, 2], // P1 -> W1 (Freight Rail)
    original_route: [4, 2],
    status: 'IN_TRANSIT',
    priority: 'Normal',
    carrier_asset: 'V5 (Intermodal Rail)',
    eta_time: '12:45 PDT',
    sla_delta_min: 0,
  },
];

// 4. Baseline Active Disruption
const BASELINE_DISRUPTIONS: PNT1Disruption[] = [
  {
    id: 'DIS-001',
    name: 'I-80 Bay Bridge Route Blockage',
    type: 'Highway Trans-Bay Closure',
    affected_edge_ids: ['E-2-11', 'E-11-5'],
    affected_nodes: [2, 11, 5],
    affected_shipment_ids: ['SHP-001'],
    severity: 5,
    capacity_reduction_pct: 100,
    description: 'Emergency structural maintenance on I-80 Bay Bridge westbound lanes. Capacity reduced by 100%.',
    status: 'ACTIVE',
    recovery_recommendation: {
      title: 'South Bay Arterial Bypass via Highway 92 / San Mateo Bridge',
      solver: 'IQPSO (Quantum-Inspired Particle Swarm)',
      corridor_nodes: [2, 3, 13, 14, 9, 6, 5],
      corridor_labels: ['W1', 'W2', 'J3', 'J4', 'C5', 'C2', 'C1'],
      eta_delta_min: 18,
      distance_delta_km: 14.5,
      explanation: 'Quantum swarm route optimizer reallocated consignment SHP-001 via Southern San Mateo Bridge Bypass. Estimated delay reduced from +45m to +18m, preserving customer delivery SLA window.',
    },
  },
];

class PNT1TwinService {
  private nodes: PNT1Node[] = JSON.parse(JSON.stringify(BASELINE_NODES));
  private edges: PNT1Edge[] = JSON.parse(JSON.stringify(BASELINE_EDGES));
  private shipments: PNT1Shipment[] = JSON.parse(JSON.stringify(BASELINE_SHIPMENTS));
  private disruptions: PNT1Disruption[] = JSON.parse(JSON.stringify(BASELINE_DISRUPTIONS));
  private snapshot: any = null;

  resetToBaseline(): void {
    this.nodes = JSON.parse(JSON.stringify(BASELINE_NODES));
    this.edges = JSON.parse(JSON.stringify(BASELINE_EDGES));
    this.shipments = JSON.parse(JSON.stringify(BASELINE_SHIPMENTS));
    this.disruptions = JSON.parse(JSON.stringify(BASELINE_DISRUPTIONS));
    this.snapshot = null;
  }

  getNodes(): PNT1Node[] {
    return this.nodes;
  }

  getEdges(): PNT1Edge[] {
    return this.edges;
  }

  getShipments(): PNT1Shipment[] {
    return this.shipments;
  }

  getDisruptions(): PNT1Disruption[] {
    return this.disruptions;
  }

  getKpis(): PNT1Kpis {
    const activeDisruptions = this.disruptions.filter((d) => d.status === 'ACTIVE').length;
    const atRisk = this.shipments.filter((s) => s.status === 'DELAYED_AT_RISK').length;
    const rerouted = this.shipments.filter((s) => s.status === 'REROUTED').length;

    let network_status: 'NETWORK OPERATIONAL' | 'DISRUPTION DETECTED' | 'PARTIAL RECOVERY' = 'NETWORK OPERATIONAL';
    if (activeDisruptions > 0 && atRisk > 0) {
      network_status = 'DISRUPTION DETECTED';
    } else if (rerouted > 0 && activeDisruptions === 0) {
      network_status = 'NETWORK OPERATIONAL';
    } else if (activeDisruptions > 0 && rerouted > 0) {
      network_status = 'PARTIAL RECOVERY';
    }

    return {
      total_warehouses: this.nodes.filter((n) => n.type === 'warehouse').length,
      total_shipments: this.shipments.length,
      at_risk_shipments: atRisk,
      active_disruptions: activeDisruptions,
      network_status,
    };
  }

  /**
   * Execute FAST RECOVER
   * Visibly demonstrates: disruption -> affected shipment -> alternate route -> rerouted shipment -> recovered status.
   */
  executeFastRecover(): { success: boolean; recovered_shipment: string; new_route: number[]; message: string } {
    // 1. Take snapshot for rollback
    this.snapshot = {
      nodes: JSON.parse(JSON.stringify(this.nodes)),
      edges: JSON.parse(JSON.stringify(this.edges)),
      shipments: JSON.parse(JSON.stringify(this.shipments)),
      disruptions: JSON.parse(JSON.stringify(this.disruptions)),
    };

    // 2. Reroute affected shipment (SHP-001)
    const targetShipment = this.shipments.find((s) => s.id === 'SHP-001');
    if (targetShipment && targetShipment.alternate_route) {
      targetShipment.current_route = [...targetShipment.alternate_route];
      targetShipment.status = 'REROUTED';
      targetShipment.sla_delta_min = 18;
    }

    // 3. Update edge statuses: mark bypass corridor as recommended/active
    for (const edge of this.edges) {
      if (edge.id === 'E-2-11' || edge.id === 'E-11-5') {
        edge.status = 'disrupted';
      }
      if (['E-2-3', 'E-3-13', 'E-13-14', 'E-14-9', 'E-6-9', 'E-5-6'].includes(edge.id)) {
        edge.status = 'recommended';
      }
    }

    // 4. Mark disruption recovered
    for (const dis of this.disruptions) {
      dis.status = 'RECOVERED';
    }

    return {
      success: true,
      recovered_shipment: 'SHP-001',
      new_route: targetShipment?.current_route || [],
      message: 'Quantum swarm rerouting committed. Consignment SHP-001 rerouted via San Mateo Bridge bypass.',
    };
  }

  /**
   * Rollback to pre-commit snapshot
   */
  rollback(): boolean {
    if (!this.snapshot) return false;
    this.nodes = JSON.parse(JSON.stringify(this.snapshot.nodes));
    this.edges = JSON.parse(JSON.stringify(this.snapshot.edges));
    this.shipments = JSON.parse(JSON.stringify(this.snapshot.shipments));
    this.disruptions = JSON.parse(JSON.stringify(this.snapshot.disruptions));
    this.snapshot = null;
    return true;
  }
}

export const pnt1TwinService = new PNT1TwinService();
export default pnt1TwinService;

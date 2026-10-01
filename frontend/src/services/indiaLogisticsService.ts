/**
 * India Logistics Dataset Service
 * Normalized FirstMile Source of Truth:
 * 10 Warehouses | 15 In-Transit Vehicles | 1 Product (Medical Supply Kit) | 6 Businesses (BIZ01-BIZ06)
 */

import {
  WAREHOUSE_RECORDS,
  VEHICLE_TELEMETRY_RECORDS,
  JUNCTION_RECORDS,
  GRAPH_EDGES,
  FIRSTMILE_LIVE_KPIS,
  VehicleType,
  BusinessId,
} from './firstMileData';

export type LogisticsNodeType = 'supplier' | 'warehouse' | 'customer' | 'junction';

export interface LogisticsNode {
  id: string;
  name: string;
  city: string;
  type: LogisticsNodeType;
  lat: number;
  lon: number;
  capacity?: number;
  inventory?: number;
  currentLoad?: number;
  loadCategory?: 'LOW LOAD' | 'NORMAL' | 'HIGH LOAD';
  address?: string;
  product?: string;
  status?: string;
  isJunction?: boolean;
}

export interface LogisticsRoute {
  id: string;
  name: string;
  fromId: string;
  toId: string;
  distanceKm: number;
  estTimeHr: number;
  status: 'active' | 'disrupted' | 'impacted' | 'recommended' | 'candidate';
  isAlternate?: boolean;
  candidateGroup?: 'A' | 'B' | 'C';
  candidateLabel?: string;
  highway?: string;
  vehicleNo?: string;
  flowLabel?: string;
  businessId?: string;
}

export interface MovingShipment {
  id: string; // Vehicle No (e.g., TS09AB1001)
  vehicleNo: string;
  orderId: string;
  sku: string; // Medical Supply Kit
  product: string;
  quantity: number; // Capacity held
  capacityHeld: number;
  totalCapacity: number;
  utilization: number;
  vehicleType: VehicleType;
  businessId: BusinessId;
  fromId: string; // From warehouse ID
  toId: string; // To warehouse ID
  fromAddress: string;
  toAddress: string;
  lastUpdatedLocation: string;
  lastUpdatedTime: string;
  currentRouteId: string;
  routePath: string[];
  alternatePath?: string[];
  status: 'IN_TRANSIT' | 'DELAYED' | 'REROUTED' | 'DELIVERED';
  eta: string;
  progress: number;
  isAffected: boolean;
  bearing: number;
  lat: number;
  lon: number;
}

export interface DisruptionAlert {
  id: string;
  title: string;
  disruptionType: string;
  location: string;
  description: string;
  severity: number;
  capacityImpact: string;
  affectedShipmentsCount: number;
  affectedRoutesCount: number;
  status: 'ACTIVE' | 'RESOLVED';
  blockedRouteId: string;
  blockedRouteName: string;
  fromCity: string;
  toCity: string;
  coordinates: [number, number];
}

export interface RecoveryRecommendation {
  title: string;
  corridor: string;
  travelTimeDelta: string;
  distanceDelta: string;
  costDelta: string;
  originalRouteDesc: string;
  originalDistKm: number;
  originalTimeHr: number;
  recoveryRouteDesc: string;
  recoveryDistKm: number;
  recoveryTimeHr: number;
  explanation: string;
  viaJunctions: string;
  bypassCoords: [number, number];
}

export interface SimulationStep {
  stepNumber: number;
  title: string;
  status: 'pending' | 'running' | 'completed';
}

export interface ControlTowerKpis {
  warehouses: number;
  vehiclesInTransit: number;
  products: number;
  productName: string;
  businesses: number;
  totalInventoryUnits: number;
  totalWarehouseCapacityUnits: number;
  warehouseUtilizationPct: number;
  totalCapacityHeldUnits: number;
  totalFleetCapacityUnits: number;
  fleetUtilizationPct: number;
  activeDisruptions: number;
  networkStatus: 'OPERATIONAL' | 'DEGRADED';
  networkHealthPct: number;
  // Backward compatibility fields
  suppliers: number;
  activeShipments: number;
  onTimeShipments: number;
  delayedShipments: number;
  orders: number;
}

export type ScenarioId =
  | 'NORMAL'
  | 'ROAD_CLOSURE'
  | 'ACCIDENT'
  | 'EXTREME_WEATHER'
  | 'CAPACITY_REDUCTION'
  | 'MULTI_ROUTE';

export interface ScenarioDefinition {
  id: ScenarioId;
  label: string;
  disruptions: DisruptionAlert[];
  recovery: RecoveryRecommendation;
  affectedShipmentIds: string[];
  delayedProgressMap: Record<string, number>;
  routeStatuses: Record<string, LogisticsRoute['status']>;
  primarySelectedShipmentId: string;
}

// 1. Normalized Facilities & Waypoints (10 Real Warehouses + 21 Realistic Highway Junctions)
export const FIRSTMILE_NODES: LogisticsNode[] = [
  ...WAREHOUSE_RECORDS.map((w) => ({
    id: w.id,
    name: w.name,
    city: w.city,
    type: 'warehouse' as LogisticsNodeType,
    lat: w.lat,
    lon: w.lon,
    capacity: w.capacity,
    inventory: w.inventory,
    currentLoad: w.currentLoad,
    loadCategory: w.loadCategory,
    address: w.address,
    product: w.product,
    status: w.status,
    isJunction: false,
  })),
  ...JUNCTION_RECORDS.map((j) => ({
    id: j.id,
    name: j.name,
    city: j.city,
    type: 'junction' as LogisticsNodeType,
    lat: j.lat,
    lon: j.lon,
    address: `${j.highway} Transit Waypoint, ${j.city}`,
    status: 'Operational',
    isJunction: true,
  })),
];

// Alias for backwards compatibility
export const INDIA_NODES = FIRSTMILE_NODES;

// 2. Normalized Logistics Network Flows (True Graph Edges)
export const FIRSTMILE_ROUTES: LogisticsRoute[] = GRAPH_EDGES.map((edge) => ({
  id: edge.id,
  name: edge.name,
  fromId: edge.fromId,
  toId: edge.toId,
  distanceKm: edge.distanceKm,
  estTimeHr: edge.estTimeHr,
  status: edge.status,
  isAlternate: edge.isAlternate,
  candidateGroup: edge.candidateGroup,
  candidateLabel: edge.candidateLabel,
  highway: edge.highway,
}));

// Alias for backwards compatibility
export const INITIAL_ROUTES: LogisticsRoute[] = FIRSTMILE_ROUTES;

// 3. Normalized In-Transit Fleet (15 Vehicles with Multi-Node Telemetry)
export const FIRSTMILE_SHIPMENTS: MovingShipment[] = VEHICLE_TELEMETRY_RECORDS.map((v) => ({
  id: v.vehicleNo,
  vehicleNo: v.vehicleNo,
  orderId: `ORD-${v.businessId}-${v.vehicleNo.slice(-4)}`,
  sku: v.product,
  product: v.product,
  quantity: v.capacityHeld,
  capacityHeld: v.capacityHeld,
  totalCapacity: v.totalCapacity,
  utilization: v.utilization,
  vehicleType: v.vehicleType,
  businessId: v.businessId,
  fromId: v.fromWarehouseId,
  toId: v.toWarehouseId,
  fromAddress: v.fromAddress,
  toAddress: v.toAddress,
  lastUpdatedLocation: v.lastUpdatedLocation,
  lastUpdatedTime: v.lastUpdatedTime,
  currentRouteId: `FLOW-${v.vehicleNo}`,
  routePath: v.routePath || [v.fromWarehouseId, v.toWarehouseId],
  alternatePath: v.alternatePath || [v.fromWarehouseId, 'WH07', v.toWarehouseId],
  status: 'IN_TRANSIT' as const,
  eta: v.lastUpdatedTime.split(' ')[1] + ' IST',
  progress: v.progress,
  isAffected: false,
  bearing: v.bearing,
  lat: v.lat,
  lon: v.lon,
}));

// Alias for backwards compatibility
export const INITIAL_SHIPMENTS: MovingShipment[] = FIRSTMILE_SHIPMENTS;

// 4. Situational Scenario Presets
export const SCENARIO_PRESETS: Record<ScenarioId, ScenarioDefinition> = {
  // Scenario 1: NORMAL (Primary Live Operational Network Mode)
  NORMAL: {
    id: 'NORMAL',
    label: 'NORMAL NETWORK (OPERATIONAL)',
    primarySelectedShipmentId: 'TS09AB1001',
    disruptions: [],
    recovery: {
      title: 'Nominal Fleet & Warehouse Operation',
      corridor: 'All inter-facility flows operating nominally along highway grid',
      travelTimeDelta: '0.0h',
      distanceDelta: '0 km',
      costDelta: '0%',
      originalRouteDesc: 'Inter-facility scheduled flows active',
      originalDistKm: 580,
      originalTimeHr: 10.5,
      recoveryRouteDesc: 'Scheduled standard transit',
      recoveryDistKm: 580,
      recoveryTimeHr: 10.5,
      explanation: 'All 10 warehouses, 21 intermediate junctions, and 15 in-transit vehicles operating within nominal thresholds. 0 disruptions detected across digital twin network.',
      viaJunctions: 'Nominal highway junction vectors',
      bypassCoords: [15.8281, 78.0373],
    },
    affectedShipmentIds: [],
    delayedProgressMap: {},
    routeStatuses: {},
  },

  // Scenario 2: ROAD CLOSURE (Simulated rockfall/landslide on NH-44 south of Jadcherla)
  ROAD_CLOSURE: {
    id: 'ROAD_CLOSURE',
    label: 'ROAD CLOSURE (DIS-002)',
    primarySelectedShipmentId: 'TS09AB1001',
    disruptions: [
      {
        id: 'DIS-002',
        title: 'Route Blockage (NH-44 Sector)',
        disruptionType: 'Route Blockage / Landslide',
        location: 'NH-44: Jadcherla (J-JA) ➔ Kurnool Bypass (J-KURNOOL)',
        description: 'Transit corridor blocked due to sudden rockfall & landslide on NH-44; road segment impassable for vehicle TS09AB1001.',
        severity: 4,
        capacityImpact: '100% segment blockage',
        affectedShipmentsCount: 1,
        affectedRoutesCount: 1,
        status: 'ACTIVE',
        blockedRouteId: 'EDGE-J_JA-J_KURNOOL',
        blockedRouteName: 'EDGE-J_JA-J_KURNOOL (Jadcherla ➔ Kurnool)',
        fromCity: 'Jadcherla',
        toCity: 'Kurnool',
        coordinates: [16.2974, 78.0853], // Exact midpoint of J-JA [16.7667, 78.1333] and J-KURNOOL [15.8281, 78.0373]
      },
    ],
    recovery: {
      title: 'IQPSO Optimal Recovery via Coastal NH-16 (Route A)',
      corridor: 'Hyderabad (WH02) ➔ Jadcherla ➔ Suryapet ➔ Vijayawada (WH07) ➔ Chennai North (WH03)',
      travelTimeDelta: '+2.8h',
      distanceDelta: '+165 km',
      costDelta: '+9.4%',
      originalRouteDesc: 'WH02 ➔ J-JA ➔ J-KURNOOL ➔ J-NANDYAL ➔ J-CUDDAPAH ➔ WH03',
      originalDistKm: 630,
      originalTimeHr: 11.5,
      recoveryRouteDesc: 'WH02 ➔ J-JA ➔ J-SURYAPET ➔ WH07 ➔ J-GUNTUR ➔ J-ONGOLE ➔ J-NELLORE ➔ WH03',
      recoveryDistKm: 795,
      recoveryTimeHr: 14.3,
      explanation: 'IQPSO Swarm optimizer evaluated 3 candidate bypass corridors and selected Route A (via Suryapet & Coastal NH-16). Candidates B (Anantapur) and C (Tirupati Ghats) were rejected due to higher cost & road risk.',
      viaJunctions: 'J-JA (Jadcherla) ➔ J-SURYAPET ➔ WH07 (Vijayawada) ➔ J-GUNTUR ➔ J-ONGOLE ➔ J-NELLORE',
      bypassCoords: [16.5414, 80.7981], // WH07 Vijayawada
    },
    affectedShipmentIds: ['TS09AB1001'],
    delayedProgressMap: { 'TS09AB1001': 0.16 }, // Paused safely at J-JA before blocked sector
    routeStatuses: {
      'EDGE-J_JA-J_KURNOOL': 'disrupted',
      // Candidate A: Recommended (Fastest) via Coastal NH-16
      'EDGE-J_JA-J_SURYAPET': 'candidate',
      'EDGE-J_SURYAPET-WH07': 'candidate',
      'EDGE-WH07-J_GUNTUR': 'candidate',
      'EDGE-J_GUNTUR-J_ONGOLE': 'candidate',
      'EDGE-J_ONGOLE-J_NELLORE': 'candidate',
      'EDGE-J_NELLORE-WH03': 'candidate',
      // Candidate B: Secondary (Higher Cost) via Anantapur
      'EDGE-J_JA-J_ANANTAPUR': 'candidate',
      'EDGE-J_ANANTAPUR-J_CUDDAPAH': 'candidate',
      // Candidate C: High Risk / Congested via Tirupati Ghats
      'EDGE-J_ANANTAPUR-J_TIRUPATI': 'candidate',
      'EDGE-J_TIRUPATI-WH03': 'candidate',
    },
  },

  // Scenario 3: SEVERE ACCIDENT (DIS-006 on Western Corridor NH-160)
  ACCIDENT: {
    id: 'ACCIDENT',
    label: 'SEVERE ACCIDENT (DIS-006)',
    primarySelectedShipmentId: 'MH12VW2234',
    disruptions: [
      {
        id: 'DIS-006',
        title: 'Corridor Collision / Breakdown',
        disruptionType: 'Vehicle Breakdown / Collision',
        location: 'NH-160: Ahmednagar (J-AHMEDNAGAR) ➔ Solapur (J-SOLAPUR)',
        description: 'Major multivehicle collision closed express lane; heavy vehicle MH12VW2234 delayed.',
        severity: 3,
        capacityImpact: '60% capacity restriction',
        affectedShipmentsCount: 1,
        affectedRoutesCount: 1,
        status: 'ACTIVE',
        blockedRouteId: 'EDGE-J_AHMEDNAGAR-J_SOLAPUR',
        blockedRouteName: 'EDGE-J_AHMEDNAGAR-J_SOLAPUR (Ahmednagar ➔ Solapur)',
        fromCity: 'Ahmednagar',
        toCity: 'Solapur',
        coordinates: [18.3775, 75.3272], // Midpoint of Ahmednagar [19.0952, 74.7480] and Solapur [17.6599, 75.9064]
      },
    ],
    recovery: {
      title: 'IQPSO Recovery via Solapur Direct Express Bypass (Route A)',
      corridor: 'Pune (WH10) ➔ Solapur Direct (NH-65) ➔ Hyderabad (WH01)',
      travelTimeDelta: '+1.9h',
      distanceDelta: '+90 km',
      costDelta: '+6.2%',
      originalRouteDesc: 'WH10 ➔ J-AHMEDNAGAR ➔ J-SOLAPUR ➔ WH02 ➔ WH01',
      originalDistKm: 560,
      originalTimeHr: 10.0,
      recoveryRouteDesc: 'WH10 ➔ J-SOLAPUR (Direct NH-65 Bypass) ➔ WH02 ➔ WH01',
      recoveryDistKm: 650,
      recoveryTimeHr: 11.9,
      explanation: 'Swarm intelligence diverted heavy vehicle MH12VW2234 around the NH-160 collision bottleneck via the Southern Solapur bypass corridor.',
      viaJunctions: 'J-SOLAPUR (Solapur Transit Waypoint)',
      bypassCoords: [17.6599, 75.9064],
    },
    affectedShipmentIds: ['MH12VW2234'],
    delayedProgressMap: { 'MH12VW2234': 0.20 },
    routeStatuses: {
      'EDGE-J_AHMEDNAGAR-J_SOLAPUR': 'disrupted',
      'EDGE-WH10-J_SOLAPUR': 'candidate',
      'EDGE-J_AHMEDNAGAR-J_NANDED': 'candidate',
      'EDGE-J_NANDED-WH01': 'candidate',
    },
  },

  // Scenario 4: EXTREME WEATHER (DIS-003 on Coastal Corridor NH-16)
  EXTREME_WEATHER: {
    id: 'EXTREME_WEATHER',
    label: 'EXTREME WEATHER (DIS-003)',
    primarySelectedShipmentId: 'AP16NO7834',
    disruptions: [
      {
        id: 'DIS-003',
        title: 'Cyclonic Coastal Deluge',
        disruptionType: 'Extreme Weather / Flooding',
        location: 'NH-16: Rajahmundry (J-RAJAHMUNDRY) ➔ Tuni (J-TUNI)',
        description: 'Torrential downpour flooded coastal express lanes; segment inundated, halting truck AP16NO7834.',
        severity: 4,
        capacityImpact: '75% velocity reduction',
        affectedShipmentsCount: 1,
        affectedRoutesCount: 1,
        status: 'ACTIVE',
        blockedRouteId: 'EDGE-J_RAJAHMUNDRY-J_TUNI',
        blockedRouteName: 'EDGE-J_RAJAHMUNDRY-J_TUNI (Rajahmundry ➔ Tuni)',
        fromCity: 'Rajahmundry',
        toCity: 'Tuni',
        coordinates: [17.1788, 82.1779], // Midpoint of Rajahmundry [17.0005, 81.8040] and Tuni [17.3571, 82.5518]
      },
    ],
    recovery: {
      title: 'Inland High-Ground Detour via Khammam & Warangal (Route A)',
      corridor: 'Vijayawada (WH07) ➔ Khammam ➔ Warangal (WH09) ➔ Visakhapatnam (WH08)',
      travelTimeDelta: '+3.5h',
      distanceDelta: '+220 km',
      costDelta: '+12.5%',
      originalRouteDesc: 'WH07 ➔ J-RAJAHMUNDRY ➔ J-TUNI ➔ WH08',
      originalDistKm: 350,
      originalTimeHr: 6.5,
      recoveryRouteDesc: 'WH07 ➔ J-KHAMMAM ➔ WH09 ➔ WH08',
      recoveryDistKm: 570,
      recoveryTimeHr: 10.0,
      explanation: 'Severe coastal flooding triggered automated inland reallocation through Warangal Hub (WH09) high ground corridor.',
      viaJunctions: 'J-KHAMMAM, WH09 (Warangal Hub Inland Bypass)',
      bypassCoords: [17.9784, 79.5218], // WH09 Warangal
    },
    affectedShipmentIds: ['AP16NO7834'],
    delayedProgressMap: { 'AP16NO7834': 0.35 },
    routeStatuses: {
      'EDGE-J_RAJAHMUNDRY-J_TUNI': 'disrupted',
      'EDGE-WH07-J_KHAMMAM': 'candidate',
      'EDGE-J_KHAMMAM-WH09': 'candidate',
      'EDGE-WH09-WH08': 'candidate',
    },
  },

  // Scenario 5: CAPACITY REDUCTION (DIS-004 at WH01)
  CAPACITY_REDUCTION: {
    id: 'CAPACITY_REDUCTION',
    label: 'CAPACITY REDUCTION (DIS-004)',
    primarySelectedShipmentId: 'TS10CD2045',
    disruptions: [
      {
        id: 'DIS-004',
        title: 'DC Automated Sorter Failure',
        disruptionType: 'Warehouse Disruption',
        location: 'WH01 (Hyderabad Central DC)',
        description: 'Automated sorting arm maintenance reduces throughput by 40% at Jeedimetla DC.',
        severity: 3,
        capacityImpact: '40% throughput reduction',
        affectedShipmentsCount: 1,
        affectedRoutesCount: 1,
        status: 'ACTIVE',
        blockedRouteId: 'EDGE-WH01-WH02',
        blockedRouteName: 'EDGE-WH01-WH02 (Jeedimetla Feed)',
        fromCity: 'Hyderabad',
        toCity: 'Vijayawada',
        coordinates: [17.5169, 78.4721], // WH01
      },
    ],
    recovery: {
      title: 'Dynamic Cross-Dock Rebalance to WH02 (Hyderabad South)',
      corridor: 'Rebalance to WH02 (Shamshabad Hub) ➔ WH07 (Vijayawada)',
      travelTimeDelta: '+1.2h',
      distanceDelta: '+45 km',
      costDelta: '+4.0%',
      originalRouteDesc: 'WH01 (Jeedimetla) ➔ WH07 (Vijayawada)',
      originalDistKm: 275,
      originalTimeHr: 5.0,
      recoveryRouteDesc: 'WH02 (Shamshabad) ➔ WH07 (Vijayawada)',
      recoveryDistKm: 320,
      recoveryTimeHr: 6.2,
      explanation: 'Consignment shifted to Hyderabad South Hub (WH02) cross-dock bays, relieving overloaded sorters at WH01.',
      viaJunctions: 'WH02 (Shamshabad Logistics Park)',
      bypassCoords: [17.2543, 78.4286],
    },
    affectedShipmentIds: ['TS10CD2045'],
    delayedProgressMap: { 'TS10CD2045': 0.25 },
    routeStatuses: {
      'EDGE-WH01-WH02': 'impacted',
    },
  },

  // Scenario 6: MULTI-ROUTE DISRUPTION (Cascading Failure on South & West Trunks)
  MULTI_ROUTE: {
    id: 'MULTI_ROUTE',
    label: 'MULTI-ROUTE DISRUPTION (DIS-008)',
    primarySelectedShipmentId: 'TS09AB1001',
    disruptions: [
      {
        id: 'DIS-002',
        title: 'Route Blockage (South Trunk)',
        disruptionType: 'Route Blockage',
        location: 'NH-44: Jadcherla (J-JA) ➔ Kurnool Bypass (J-KURNOOL)',
        description: 'Landslide blocks southern artery for vehicle TS09AB1001.',
        severity: 4,
        capacityImpact: '100% blockage',
        affectedShipmentsCount: 1,
        affectedRoutesCount: 1,
        status: 'ACTIVE',
        blockedRouteId: 'EDGE-J_JA-J_KURNOOL',
        blockedRouteName: 'EDGE-J_JA-J_KURNOOL (Jadcherla ➔ Kurnool)',
        fromCity: 'Jadcherla',
        toCity: 'Kurnool',
        coordinates: [16.2974, 78.0853],
      },
      {
        id: 'DIS-006',
        title: 'Vehicle Breakdown (West Trunk)',
        disruptionType: 'Vehicle Breakdown',
        location: 'NH-160: Ahmednagar (J-AHMEDNAGAR) ➔ Solapur (J-SOLAPUR)',
        description: 'Collision stalls heavy vehicle MH12VW2234.',
        severity: 3,
        capacityImpact: '50% reduction',
        affectedShipmentsCount: 1,
        affectedRoutesCount: 1,
        status: 'ACTIVE',
        blockedRouteId: 'EDGE-J_AHMEDNAGAR-J_SOLAPUR',
        blockedRouteName: 'EDGE-J_AHMEDNAGAR-J_SOLAPUR (Ahmednagar ➔ Solapur)',
        fromCity: 'Ahmednagar',
        toCity: 'Solapur',
        coordinates: [18.3775, 75.3272],
      },
    ],
    recovery: {
      title: 'Dual-Corridor AI Swarm Recovery (Eastern Coastal + Solapur Bypass)',
      corridor: 'Parallel Reroute: TS09AB1001 via Vijayawada + MH12VW2234 via Solapur',
      travelTimeDelta: '+2.8h / +1.9h',
      distanceDelta: '+165 km / +90 km',
      costDelta: '+8.5%',
      originalRouteDesc: 'Corridors TS09AB1001 & MH12VW2234',
      originalDistKm: 1190,
      originalTimeHr: 21.5,
      recoveryRouteDesc: 'Coastal Corridor (WH07) & Solapur Bypass',
      recoveryDistKm: 1445,
      recoveryTimeHr: 26.2,
      explanation: 'Simultaneous quantum swarm optimization of two blocked national vectors, rerouting southern flow via WH07 (Vijayawada) and western flow via Solapur.',
      viaJunctions: 'WH07 (Vijayawada Hub), J-SOLAPUR (Solapur Transit)',
      bypassCoords: [16.5414, 80.7981],
    },
    affectedShipmentIds: ['TS09AB1001', 'MH12VW2234'],
    delayedProgressMap: { 'TS09AB1001': 0.16, 'MH12VW2234': 0.20 },
    routeStatuses: {
      'EDGE-J_JA-J_KURNOOL': 'disrupted',
      'EDGE-J_AHMEDNAGAR-J_SOLAPUR': 'disrupted',
      'EDGE-J_JA-J_SURYAPET': 'candidate',
      'EDGE-J_SURYAPET-WH07': 'candidate',
      'EDGE-WH07-J_GUNTUR': 'candidate',
      'EDGE-J_GUNTUR-J_ONGOLE': 'candidate',
      'EDGE-J_ONGOLE-J_NELLORE': 'candidate',
      'EDGE-J_NELLORE-WH03': 'candidate',
      'EDGE-WH10-J_SOLAPUR': 'candidate',
    },
  },
};

export class IndiaLogisticsService {
  private currentScenarioId: ScenarioId = 'NORMAL';
  private nodes: LogisticsNode[] = JSON.parse(JSON.stringify(FIRSTMILE_NODES));
  private routes: LogisticsRoute[] = JSON.parse(JSON.stringify(INITIAL_ROUTES));
  private shipments: MovingShipment[] = JSON.parse(JSON.stringify(FIRSTMILE_SHIPMENTS));
  private disruptions: DisruptionAlert[] = [];
  private recovery: RecoveryRecommendation = SCENARIO_PRESETS.NORMAL.recovery;

  constructor() {
    this.setScenario('NORMAL');
  }

  getCurrentScenarioId(): ScenarioId {
    return this.currentScenarioId;
  }

  getNodes(): LogisticsNode[] {
    return this.nodes;
  }

  getRoutes(): LogisticsRoute[] {
    return this.routes;
  }

  getShipments(): MovingShipment[] {
    return this.shipments;
  }

  getDisruptions(): DisruptionAlert[] {
    return this.disruptions;
  }

  getPrimaryDisruption(): DisruptionAlert {
    return this.disruptions[0] || {
      id: 'DIS-NONE',
      title: 'Nominal Network',
      disruptionType: 'None',
      location: 'Pan-Network FirstMile Grid',
      description: 'All 15 vehicle flows, 10 warehouses, and 21 junctions operational.',
      severity: 0,
      capacityImpact: '0%',
      affectedShipmentsCount: 0,
      affectedRoutesCount: 0,
      status: 'RESOLVED',
      blockedRouteId: '',
      blockedRouteName: '',
      fromCity: '',
      toCity: '',
      coordinates: [17.5169, 78.4721],
    };
  }

  getRecovery(): RecoveryRecommendation {
    return this.recovery;
  }

  getKpis(): ControlTowerKpis {
    const activeCount = this.disruptions.filter((d) => d.status === 'ACTIVE').length;
    const delayedCount = this.shipments.filter((s) => s.status === 'DELAYED').length;
    const isDisrupted = activeCount > 0;

    return {
      warehouses: FIRSTMILE_LIVE_KPIS.warehousesCount, // 10
      vehiclesInTransit: FIRSTMILE_LIVE_KPIS.vehiclesInTransitCount, // 15
      products: FIRSTMILE_LIVE_KPIS.productsCount, // 1
      productName: FIRSTMILE_LIVE_KPIS.productName, // Medical Supply Kit
      businesses: FIRSTMILE_LIVE_KPIS.businessesCount, // 6
      totalInventoryUnits: FIRSTMILE_LIVE_KPIS.totalInventoryUnits, // 2,630
      totalWarehouseCapacityUnits: FIRSTMILE_LIVE_KPIS.totalWarehouseCapacityUnits, // 8,850
      warehouseUtilizationPct: FIRSTMILE_LIVE_KPIS.avgWarehouseUtilizationPct, // 29.7%
      totalCapacityHeldUnits: FIRSTMILE_LIVE_KPIS.totalCapacityHeldUnits, // 1,088
      totalFleetCapacityUnits: FIRSTMILE_LIVE_KPIS.totalFleetCapacityUnits, // 1,490
      fleetUtilizationPct: FIRSTMILE_LIVE_KPIS.fleetUtilizationPct, // 73.0%
      activeDisruptions: activeCount,
      networkStatus: isDisrupted ? 'DEGRADED' : 'OPERATIONAL',
      networkHealthPct: isDisrupted ? Math.max(75, 100 - activeCount * 8 - delayedCount * 5) : 100,
      // Backward compatibility
      suppliers: FIRSTMILE_LIVE_KPIS.businessesCount,
      activeShipments: FIRSTMILE_LIVE_KPIS.vehiclesInTransitCount,
      onTimeShipments: isDisrupted ? 15 - delayedCount : 15,
      delayedShipments: delayedCount,
      orders: 15,
    };
  }

  // Switch situational scenario
  setScenario(scenarioId: ScenarioId): void {
    this.currentScenarioId = scenarioId;
    const preset = SCENARIO_PRESETS[scenarioId];

    // Reset base routes
    this.routes = JSON.parse(JSON.stringify(INITIAL_ROUTES));

    // Reset base shipments
    this.shipments = JSON.parse(JSON.stringify(FIRSTMILE_SHIPMENTS));

    // Clone disruptions and recovery
    this.disruptions = JSON.parse(JSON.stringify(preset.disruptions));
    this.recovery = JSON.parse(JSON.stringify(preset.recovery));

    // Apply route statuses
    for (const route of this.routes) {
      if (preset.routeStatuses[route.id]) {
        route.status = preset.routeStatuses[route.id];
      } else if (scenarioId === 'NORMAL') {
        route.status = route.isAlternate ? 'candidate' : 'active';
      }
    }

    // Apply shipment statuses & paused progress
    for (const shp of this.shipments) {
      if (preset.affectedShipmentIds.includes(shp.id)) {
        shp.status = 'DELAYED';
        shp.isAffected = true;
        shp.eta = 'DELAYED (Corridor Blocked)';
        if (preset.delayedProgressMap[shp.id] !== undefined) {
          shp.progress = preset.delayedProgressMap[shp.id];
        }
      } else {
        shp.status = 'IN_TRANSIT';
        shp.isAffected = false;
      }
    }
  }

  // Commit recovery: KEEP blocked edge RED, highlight winning route GREEN, fade rejected candidates, move vehicle along recovery path
  commitRecovery(): void {
    if (this.currentScenarioId === 'ROAD_CLOSURE' || this.currentScenarioId === 'MULTI_ROUTE') {
      // 1. Keep blocked edge RED
      const blockedEdge = this.routes.find((r) => r.id === 'EDGE-J_JA-J_KURNOOL');
      if (blockedEdge) blockedEdge.status = 'disrupted';

      // 2. Mark winning candidate edges (Route A) as RECOMMENDED (bright green)
      const routeAEdges = [
        'EDGE-J_JA-J_SURYAPET',
        'EDGE-J_SURYAPET-WH07',
        'EDGE-WH07-J_GUNTUR',
        'EDGE-J_GUNTUR-J_ONGOLE',
        'EDGE-J_ONGOLE-J_NELLORE',
        'EDGE-J_NELLORE-WH03',
      ];
      for (const r of this.routes) {
        if (routeAEdges.includes(r.id)) {
          r.status = 'recommended';
        } else if (r.candidateGroup === 'B' || r.candidateGroup === 'C') {
          // Unselected candidates remain faint candidate
          r.status = 'candidate';
        }
      }

      // 3. Update vehicle TS09AB1001 route path and smooth forward progress without jumping
      const shp = this.shipments.find((s) => s.id === 'TS09AB1001');
      if (shp) {
        shp.routePath = ['WH02', 'J-JA', 'J-SURYAPET', 'WH07', 'J-GUNTUR', 'J-ONGOLE', 'J-NELLORE', 'WH03'];
        shp.status = 'REROUTED';
        shp.isAffected = false;
        shp.eta = '14:18 IST (IQPSO Rerouted)';
        // Starts smoothly at J-JA (0.08 progress along the new 8-node path)
        shp.progress = 0.08;
      }
    }

    if (this.currentScenarioId === 'ACCIDENT' || this.currentScenarioId === 'MULTI_ROUTE') {
      const blockedEdge = this.routes.find((r) => r.id === 'EDGE-J_AHMEDNAGAR-J_SOLAPUR');
      if (blockedEdge) blockedEdge.status = 'disrupted';

      const winEdge = this.routes.find((r) => r.id === 'EDGE-WH10-J_SOLAPUR');
      if (winEdge) winEdge.status = 'recommended';

      const shp = this.shipments.find((s) => s.id === 'MH12VW2234');
      if (shp) {
        shp.routePath = ['WH10', 'J-SOLAPUR', 'WH02', 'WH01'];
        shp.status = 'REROUTED';
        shp.isAffected = false;
        shp.eta = '11:55 IST (IQPSO Rerouted)';
        shp.progress = 0.15;
      }
    }

    if (this.currentScenarioId === 'EXTREME_WEATHER') {
      const blockedEdge = this.routes.find((r) => r.id === 'EDGE-J_RAJAHMUNDRY-J_TUNI');
      if (blockedEdge) blockedEdge.status = 'disrupted';

      const winEdges = ['EDGE-WH07-J_KHAMMAM', 'EDGE-J_KHAMMAM-WH09', 'EDGE-WH09-WH08'];
      for (const r of this.routes) {
        if (winEdges.includes(r.id)) r.status = 'recommended';
      }

      const shp = this.shipments.find((s) => s.id === 'AP16NO7834');
      if (shp) {
        shp.routePath = ['WH07', 'J-KHAMMAM', 'WH09', 'WH08'];
        shp.status = 'REROUTED';
        shp.isAffected = false;
        shp.eta = '10:00 IST (IQPSO Rerouted)';
        shp.progress = 0.15;
      }
    }
  }

  // Reset to initial baseline state for evaluation replay
  resetState(): void {
    this.setScenario(this.currentScenarioId);
  }
}

export const indiaLogisticsService = new IndiaLogisticsService();
export default indiaLogisticsService;

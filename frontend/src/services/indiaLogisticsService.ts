/**
 * India Logistics Dataset Service
 * Normalized FirstMile Source of Truth:
 * 10 Warehouses | 15 In-Transit Vehicles | 1 Product (Medical Supply Kit) | 6 Businesses (BIZ01-BIZ06)
 */

import {
  WAREHOUSE_RECORDS,
  VEHICLE_TELEMETRY_RECORDS,
  NETWORK_FLOWS,
  FIRSTMILE_LIVE_KPIS,
  WAREHOUSE_MAP_BY_ID,
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
  candidateGroup?: 'A' | 'B';
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

// 1. Normalized Facilities & Waypoints (10 Real Warehouses + Transit Junctions)
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
  })),
  // Transit Bypass Junctions
  { id: 'J-KURNOOL', name: 'Kurnool Transit Junction (NH-44)', city: 'Kurnool', type: 'junction', lat: 15.8281, lon: 78.0373, isJunction: true },
  { id: 'J-NELLORE', name: 'Nellore Coastal Waypoint (NH-16)', city: 'Nellore', type: 'junction', lat: 14.4426, lon: 79.9865, isJunction: true },
  { id: 'J-SOLAPUR', name: 'Solapur Western Junction (NH-65)', city: 'Solapur', type: 'junction', lat: 17.6599, lon: 75.9064, isJunction: true },
  { id: 'J-NANDED', name: 'Nanded Hub Waypoint (NH-161)', city: 'Nanded', type: 'junction', lat: 19.1383, lon: 77.3210, isJunction: true },
];

// Alias for backwards compatibility
export const INDIA_NODES = FIRSTMILE_NODES;

// 2. Normalized Logistics Network Flows (15 Active Corridors)
export const FIRSTMILE_ROUTES: LogisticsRoute[] = NETWORK_FLOWS.map((f) => {
  const fromWh = WAREHOUSE_MAP_BY_ID.get(f.fromWarehouseId)!;
  const toWh = WAREHOUSE_MAP_BY_ID.get(f.toWarehouseId)!;
  const dist = Math.round(
    Math.hypot((toWh.lat - fromWh.lat) * 111, (toWh.lon - fromWh.lon) * 105)
  );
  return {
    id: f.id,
    name: `${f.flowLabel} (${f.vehicleNo})`,
    fromId: f.fromWarehouseId,
    toId: f.toWarehouseId,
    distanceKm: dist,
    estTimeHr: +(dist / 55).toFixed(1),
    status: 'active' as const,
    vehicleNo: f.vehicleNo,
    flowLabel: f.flowLabel,
    businessId: f.businessId,
  };
});

// Candidate alternate corridors revealed during simulation recovery
export const FIRSTMILE_ALTERNATE_ROUTES: LogisticsRoute[] = [
  {
    id: 'ALT-COASTAL-01',
    name: 'Hyderabad (WH02) ➔ Vijayawada (WH07) Coastal Bypass',
    fromId: 'WH02',
    toId: 'WH07',
    distanceKm: 275,
    estTimeHr: 4.8,
    status: 'candidate',
    isAlternate: true,
    candidateGroup: 'A',
  },
  {
    id: 'ALT-COASTAL-02',
    name: 'Vijayawada (WH07) ➔ Chennai North (WH03) Bypass',
    fromId: 'WH07',
    toId: 'WH03',
    distanceKm: 430,
    estTimeHr: 7.2,
    status: 'candidate',
    isAlternate: true,
    candidateGroup: 'A',
  },
  {
    id: 'ALT-WESTERN-01',
    name: 'Pune (WH10) ➔ Solapur (J-SOLAPUR) ➔ Hyderabad (WH01) Detour',
    fromId: 'WH10',
    toId: 'WH01',
    distanceKm: 560,
    estTimeHr: 9.5,
    status: 'candidate',
    isAlternate: true,
    candidateGroup: 'B',
  },
  {
    id: 'ALT-INLAND-01',
    name: 'Vijayawada (WH07) ➔ Warangal (WH09) ➔ Visakhapatnam Detour',
    fromId: 'WH07',
    toId: 'WH09',
    distanceKm: 210,
    estTimeHr: 3.8,
    status: 'candidate',
    isAlternate: true,
    candidateGroup: 'A',
  },
];

// Alias for backwards compatibility
export const INITIAL_ROUTES: LogisticsRoute[] = [...FIRSTMILE_ROUTES, ...FIRSTMILE_ALTERNATE_ROUTES];

// 3. Normalized In-Transit Fleet (15 Vehicles with Real Telemetry)
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
  routePath: [v.fromWarehouseId, v.toWarehouseId],
  alternatePath: [v.fromWarehouseId, 'WH07', v.toWarehouseId],
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
      corridor: 'All 15 inter-facility flows operating nominally',
      travelTimeDelta: '0.0h',
      distanceDelta: '0 km',
      costDelta: '0%',
      originalRouteDesc: 'Inter-facility scheduled flows active',
      originalDistKm: 580,
      originalTimeHr: 10.5,
      recoveryRouteDesc: 'Scheduled standard transit',
      recoveryDistKm: 580,
      recoveryTimeHr: 10.5,
      explanation: 'All 10 warehouses and 15 in-transit vehicles operating within nominal thresholds. 0 disruptions detected across digital twin network.',
      viaJunctions: 'Nominal logistics flows',
      bypassCoords: [15.8281, 78.0373],
    },
    affectedShipmentIds: [],
    delayedProgressMap: {},
    routeStatuses: {
      'FLOW-TS09AB1001': 'active',
      'FLOW-TS10CD2045': 'active',
      'FLOW-TN09EF3112': 'active',
      'FLOW-TN12GH4488': 'active',
      'FLOW-KA03JK5521': 'active',
      'FLOW-KA05LM6702': 'active',
      'FLOW-AP16NO7834': 'active',
      'FLOW-AP31PQ8456': 'active',
      'FLOW-TS12RS9107': 'active',
      'FLOW-TS08TU1123': 'active',
      'FLOW-MH12VW2234': 'active',
      'FLOW-MH14XY3345': 'active',
      'FLOW-TS07ZA4456': 'active',
      'FLOW-TN11BC5567': 'active',
      'FLOW-KA51DE6678': 'active',
      'ALT-COASTAL-01': 'candidate',
      'ALT-COASTAL-02': 'candidate',
      'ALT-WESTERN-01': 'candidate',
      'ALT-INLAND-01': 'candidate',
    },
  },

  // Scenario 2: ROAD CLOSURE (Simulated event on NH-44 south of Hyderabad)
  ROAD_CLOSURE: {
    id: 'ROAD_CLOSURE',
    label: 'ROAD CLOSURE (DIS-002)',
    primarySelectedShipmentId: 'TS09AB1001',
    disruptions: [
      {
        id: 'DIS-002',
        title: 'Route Blockage (NH-44 Sector)',
        disruptionType: 'Route Blockage',
        location: 'NH-44 / Kurnool Corridor (Shamshabad ➔ Manali Corridor)',
        description: 'Transit corridor blocked due to sudden landslide near Kurnool; vehicle TS09AB1001 stalled.',
        severity: 4,
        capacityImpact: '100% corridor blockage',
        affectedShipmentsCount: 1,
        affectedRoutesCount: 1,
        status: 'ACTIVE',
        blockedRouteId: 'FLOW-TS09AB1001',
        blockedRouteName: 'FLOW-TS09AB1001 (Shamshabad ➔ Manali)',
        fromCity: 'Hyderabad',
        toCity: 'Chennai',
        coordinates: [15.8281, 78.0373], // Kurnool
      },
    ],
    recovery: {
      title: 'Reroute via Vijayawada Hub (WH07) Eastern Bypass',
      corridor: 'Hyderabad (WH02) ➔ Vijayawada (WH07) ➔ Chennai North (WH03)',
      travelTimeDelta: '+2.8h',
      distanceDelta: '+165 km',
      costDelta: '+9.4%',
      originalRouteDesc: 'WH02 (Hyderabad South) ➔ NH-44 Kurnool ➔ WH03 (Chennai)',
      originalDistKm: 630,
      originalTimeHr: 11.5,
      recoveryRouteDesc: 'WH02 ➔ WH07 (Vijayawada Hub) ➔ WH03 (Chennai North)',
      recoveryDistKm: 795,
      recoveryTimeHr: 14.3,
      explanation: 'Quantum Swarm optimizer reallocated vehicle TS09AB1001 via Eastern Corridor (WH07 Vijayawada Hub), completely avoiding the blocked NH-44 landslide sector.',
      viaJunctions: 'WH07 (Vijayawada Hub), J-NELLORE (Nellore Coastal Waypoint)',
      bypassCoords: [16.5414, 80.7981], // WH07 Vijayawada
    },
    affectedShipmentIds: ['TS09AB1001'],
    delayedProgressMap: { 'TS09AB1001': 0.35 },
    routeStatuses: {
      'FLOW-TS09AB1001': 'disrupted',
      'ALT-COASTAL-01': 'recommended',
      'ALT-COASTAL-02': 'recommended',
    },
  },

  // Scenario 3: SEVERE ACCIDENT (DIS-006 on Western Corridor)
  ACCIDENT: {
    id: 'ACCIDENT',
    label: 'SEVERE ACCIDENT (DIS-006)',
    primarySelectedShipmentId: 'MH12VW2234',
    disruptions: [
      {
        id: 'DIS-006',
        title: 'Corridor Collision / Breakdown',
        disruptionType: 'Vehicle Breakdown / Collision',
        location: 'NH-65 (Chakan Pune ➔ Jeedimetla Hyderabad)',
        description: 'Major multivehicle collision closed express lane; heavy vehicle MH12VW2234 delayed.',
        severity: 3,
        capacityImpact: '60% capacity restriction',
        affectedShipmentsCount: 1,
        affectedRoutesCount: 1,
        status: 'ACTIVE',
        blockedRouteId: 'FLOW-MH12VW2234',
        blockedRouteName: 'FLOW-MH12VW2234 (Chakan ➔ Jeedimetla)',
        fromCity: 'Pune',
        toCity: 'Hyderabad',
        coordinates: [17.6599, 75.9064], // Solapur
      },
    ],
    recovery: {
      title: 'Reroute via Solapur Bypass (J-SOLAPUR)',
      corridor: 'Pune (WH10) ➔ Solapur ➔ Hyderabad Central (WH01)',
      travelTimeDelta: '+1.9h',
      distanceDelta: '+90 km',
      costDelta: '+6.2%',
      originalRouteDesc: 'WH10 (Pune West) ➔ NH-65 ➔ WH01 (Hyderabad Central)',
      originalDistKm: 560,
      originalTimeHr: 10.0,
      recoveryRouteDesc: 'WH10 ➔ Solapur Detour ➔ WH01',
      recoveryDistKm: 650,
      recoveryTimeHr: 11.9,
      explanation: 'Swarm intelligence diverted heavy vehicle MH12VW2234 around the NH-65 collision bottleneck via the Southern Solapur bypass corridor.',
      viaJunctions: 'J-SOLAPUR (Solapur Transit Waypoint)',
      bypassCoords: [17.6599, 75.9064],
    },
    affectedShipmentIds: ['MH12VW2234'],
    delayedProgressMap: { 'MH12VW2234': 0.40 },
    routeStatuses: {
      'FLOW-MH12VW2234': 'disrupted',
      'ALT-WESTERN-01': 'recommended',
    },
  },

  // Scenario 4: EXTREME WEATHER (DIS-003 on Coastal Corridor)
  EXTREME_WEATHER: {
    id: 'EXTREME_WEATHER',
    label: 'EXTREME WEATHER (DIS-003)',
    primarySelectedShipmentId: 'AP16NO7834',
    disruptions: [
      {
        id: 'DIS-003',
        title: 'Cyclonic Coastal Deluge',
        disruptionType: 'Extreme Weather',
        location: 'NH-16 Coastal Belt (Gannavaram ➔ Gajuwaka)',
        description: 'Torrential downpour flooded coastal highway; heavy vehicle AP16NO7834 halted.',
        severity: 4,
        capacityImpact: '75% velocity reduction',
        affectedShipmentsCount: 1,
        affectedRoutesCount: 1,
        status: 'ACTIVE',
        blockedRouteId: 'FLOW-AP16NO7834',
        blockedRouteName: 'FLOW-AP16NO7834 (Gannavaram ➔ Gajuwaka)',
        fromCity: 'Vijayawada',
        toCity: 'Visakhapatnam',
        coordinates: [17.15, 82.15],
      },
    ],
    recovery: {
      title: 'Inland Expressway Detour via Warangal Hub (WH09)',
      corridor: 'Vijayawada (WH07) ➔ Warangal (WH09) ➔ Visakhapatnam (WH08)',
      travelTimeDelta: '+3.5h',
      distanceDelta: '+220 km',
      costDelta: '+12.5%',
      originalRouteDesc: 'WH07 (Vijayawada) ➔ Coastal NH-16 ➔ WH08 (Visakhapatnam)',
      originalDistKm: 350,
      originalTimeHr: 6.5,
      recoveryRouteDesc: 'WH07 ➔ WH09 (Warangal Hub) ➔ WH08 (Visakhapatnam)',
      recoveryDistKm: 570,
      recoveryTimeHr: 10.0,
      explanation: 'Severe coastal flooding triggered automated inland reallocation through Warangal Hub (WH09) high ground corridor.',
      viaJunctions: 'WH09 (Warangal Hub Inland Bypass)',
      bypassCoords: [17.9784, 79.5218], // WH09 Warangal
    },
    affectedShipmentIds: ['AP16NO7834'],
    delayedProgressMap: { 'AP16NO7834': 0.45 },
    routeStatuses: {
      'FLOW-AP16NO7834': 'disrupted',
      'ALT-INLAND-01': 'recommended',
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
        blockedRouteId: 'FLOW-TS10CD2045',
        blockedRouteName: 'WH01 Inbound/Outbound Feed',
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
      'FLOW-TS10CD2045': 'impacted',
      'ALT-COASTAL-01': 'recommended',
    },
  },

  // Scenario 6: MULTI-ROUTE DISRUPTION (DIS-008 Cascading Failure)
  MULTI_ROUTE: {
    id: 'MULTI_ROUTE',
    label: 'MULTI-ROUTE DISRUPTION (DIS-008)',
    primarySelectedShipmentId: 'TS09AB1001',
    disruptions: [
      {
        id: 'DIS-002',
        title: 'Route Blockage (South Trunk)',
        disruptionType: 'Route Blockage',
        location: 'NH-44 Kurnool Sector (Shamshabad ➔ Manali)',
        description: 'Landslide blocks southern artery for vehicle TS09AB1001.',
        severity: 4,
        capacityImpact: '100% blockage',
        affectedShipmentsCount: 1,
        affectedRoutesCount: 1,
        status: 'ACTIVE',
        blockedRouteId: 'FLOW-TS09AB1001',
        blockedRouteName: 'FLOW-TS09AB1001 (Shamshabad ➔ Manali)',
        fromCity: 'Hyderabad',
        toCity: 'Chennai',
        coordinates: [15.8281, 78.0373],
      },
      {
        id: 'DIS-006',
        title: 'Vehicle Breakdown (West Trunk)',
        disruptionType: 'Vehicle Breakdown',
        location: 'NH-65 Solapur Sector (Chakan ➔ Jeedimetla)',
        description: 'Collision stalls heavy vehicle MH12VW2234.',
        severity: 3,
        capacityImpact: '50% reduction',
        affectedShipmentsCount: 1,
        affectedRoutesCount: 1,
        status: 'ACTIVE',
        blockedRouteId: 'FLOW-MH12VW2234',
        blockedRouteName: 'FLOW-MH12VW2234 (Chakan ➔ Jeedimetla)',
        fromCity: 'Pune',
        toCity: 'Hyderabad',
        coordinates: [17.6599, 75.9064],
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
    delayedProgressMap: { 'TS09AB1001': 0.35, 'MH12VW2234': 0.40 },
    routeStatuses: {
      'FLOW-TS09AB1001': 'disrupted',
      'FLOW-MH12VW2234': 'disrupted',
      'ALT-COASTAL-01': 'recommended',
      'ALT-COASTAL-02': 'recommended',
      'ALT-WESTERN-01': 'recommended',
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
      description: 'All 15 vehicle flows and 10 warehouse hubs operational.',
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
        if (!route.isAlternate) {
          route.status = 'active';
        }
      }
    }

    // Apply shipment statuses & paused progress
    for (const shp of this.shipments) {
      if (preset.affectedShipmentIds.includes(shp.id)) {
        shp.status = 'DELAYED';
        shp.isAffected = true;
        shp.eta = 'DELAYED (Disruption)';
        if (preset.delayedProgressMap[shp.id] !== undefined) {
          shp.progress = preset.delayedProgressMap[shp.id];
        }
      } else {
        shp.status = 'IN_TRANSIT';
        shp.isAffected = false;
      }
    }
  }

  // Commit recovery: resolve all active disruptions and activate bypass routes
  commitRecovery(): void {
    for (const d of this.disruptions) {
      d.status = 'RESOLVED';
    }

    const preset = SCENARIO_PRESETS[this.currentScenarioId];

    // Reroute each affected shipment
    for (const shpId of preset.affectedShipmentIds) {
      const shp = this.shipments.find((s) => s.id === shpId);
      if (shp && shp.alternatePath) {
        shp.routePath = [...shp.alternatePath];
        shp.status = 'REROUTED';
        shp.isAffected = false;
        shp.eta = `${shp.eta.split(' ')[0] || '10:30'} IST (Recovered)`;

        // Adjust route ID and starting progress on bypass
        if (shp.id === 'TS09AB1001') {
          shp.currentRouteId = 'ALT-COASTAL-01';
          shp.progress = 0.38;
        } else if (shp.id === 'MH12VW2234') {
          shp.currentRouteId = 'ALT-WESTERN-01';
          shp.progress = 0.35;
        } else if (shp.id === 'AP16NO7834') {
          shp.currentRouteId = 'ALT-INLAND-01';
          shp.progress = 0.35;
        }
      }
    }

    // Ensure recommended routes are marked as recommended flow
    for (const r of this.routes) {
      if (preset.routeStatuses[r.id] === 'recommended') {
        r.status = 'recommended';
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

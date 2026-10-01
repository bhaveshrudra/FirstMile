/**
 * India Logistics Dataset Service
 * Multimodal Logistics Network with Multi-Junction Branching Vectors
 * Aligned with logistics_digital_twin_datasets.xlsx and situation digital twin scenarios.
 */

export type LogisticsNodeType = 'supplier' | 'warehouse' | 'customer' | 'junction';

export interface LogisticsNode {
  id: string;
  name: string;
  city: string;
  type: LogisticsNodeType;
  lat: number;
  lon: number;
  capacity?: number;
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
  isAlternate?: boolean; // Hidden during normal state, revealed during recovery
  candidateGroup?: 'A' | 'B';
}

export interface MovingShipment {
  id: string;
  orderId: string;
  sku: string;
  quantity: number;
  fromId: string;
  toId: string;
  currentRouteId: string;
  routePath: string[]; // sequence of node IDs including junctions
  alternatePath?: string[]; // new sequence of node IDs through bypass junctions
  status: 'IN_TRANSIT' | 'DELAYED' | 'REROUTED' | 'DELIVERED';
  eta: string;
  progress: number; // 0.0 to 1.0 along route
  isAffected: boolean;
  bearing?: number; // heading angle in degrees for direction indicator
}

export interface DisruptionAlert {
  id: string;
  title: string;
  disruptionType: string;
  location: string;
  description: string;
  severity: number; // 1-5 from real dataset
  capacityImpact: string; // e.g. "100% reduction", "60% reduction"
  affectedShipmentsCount: number;
  affectedRoutesCount: number;
  status: 'ACTIVE' | 'RESOLVED';
  blockedRouteId: string;
  blockedRouteName: string;
  fromCity: string;
  toCity: string;
  coordinates: [number, number]; // [lat, lon] for Leaflet popup placement
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
  suppliers: number;
  warehouses: number;
  activeShipments: number;
  onTimeShipments: number;
  delayedShipments: number;
  orders: number;
  activeDisruptions: number;
  networkHealthPct: number;
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

// 1. Logistics Network Nodes: Major Hubs + Intermediate Junctions
export const INDIA_NODES: LogisticsNode[] = [
  // Major Warehouses (from dataset: WH-001, WH-002, WH-003, WH-005)
  { id: 'WH-001', name: 'Nagpur Central Hub', city: 'Nagpur', type: 'warehouse', lat: 21.1458, lon: 79.0882, capacity: 10000 },
  { id: 'WH-002', name: 'Hyderabad Central DC', city: 'Hyderabad', type: 'warehouse', lat: 17.3850, lon: 78.4867, capacity: 8500 },
  { id: 'WH-003', name: 'Bengaluru South DC', city: 'Bengaluru', type: 'warehouse', lat: 12.9716, lon: 77.5946, capacity: 9000 },
  { id: 'WH-005', name: 'Delhi North Hub', city: 'Delhi', type: 'warehouse', lat: 28.6139, lon: 77.2090, capacity: 7000 },

  // Suppliers & Customers (from dataset: SUP-001, SUP-002, CUST-001)
  { id: 'SUP-001', name: 'Northstar Components', city: 'Mumbai', type: 'supplier', lat: 19.0760, lon: 72.8777, capacity: 1500 },
  { id: 'SUP-002', name: 'Harborline Gateway', city: 'Chennai', type: 'supplier', lat: 13.0827, lon: 80.2707, capacity: 1800 },
  { id: 'CUST-001', name: 'Metro Retail Depot', city: 'Kolkata', type: 'customer', lat: 22.5726, lon: 88.3639, capacity: 1200 },

  // Intermediate Branching Junctions (Creating realistic multi-vector corridors)
  // Primary Highway Corridor (NH-44 / NH-16)
  { id: 'J1', name: 'J1 (Adilabad Transit)', city: 'Adilabad', type: 'junction', lat: 19.6641, lon: 78.5320, isJunction: true },
  { id: 'J-JA', name: 'J-JA (Jadcherla Transit)', city: 'Jadcherla', type: 'junction', lat: 16.7600, lon: 78.1400, isJunction: true },
  { id: 'J2', name: 'J2 (Kurnool Interchange)', city: 'Kurnool', type: 'junction', lat: 15.8281, lon: 78.0373, isJunction: true },

  // Candidate Alternate A (Eastern Coastal Bypass via Vijayawada & Chennai)
  { id: 'J3', name: 'J3 (Vijayawada Expressway)', city: 'Vijayawada', type: 'junction', lat: 16.5062, lon: 80.6480, isJunction: true },
  { id: 'J4', name: 'J4 (Nellore Coastal Waypoint)', city: 'Nellore', type: 'junction', lat: 14.4426, lon: 79.9865, isJunction: true },
  { id: 'J5', name: 'J5 (Kanchipuram South Interchange)', city: 'Kanchipuram', type: 'junction', lat: 12.8342, lon: 79.7036, isJunction: true },

  // Candidate Alternate B (Western Corridor via Solapur & Kalaburagi)
  { id: 'J6', name: 'J6 (Nanded Interchange)', city: 'Nanded', type: 'junction', lat: 19.1383, lon: 77.3210, isJunction: true },
  { id: 'J7', name: 'J7 (Solapur Western Junction)', city: 'Solapur', type: 'junction', lat: 17.6599, lon: 75.9064, isJunction: true },
  { id: 'J8', name: 'J8 (Kalaburagi Transit)', city: 'Kalaburagi', type: 'junction', lat: 17.3297, lon: 76.8343, isJunction: true },
  { id: 'J9', name: 'J9 (Anantapur Southern Point)', city: 'Anantapur', type: 'junction', lat: 14.6819, lon: 77.6006, isJunction: true },

  // Trunk Highway Waypoints across Central & North India
  { id: 'J10', name: 'J10 (Gwalior Interchange)', city: 'Gwalior', type: 'junction', lat: 26.2183, lon: 78.1828, isJunction: true },
  { id: 'J11', name: 'J11 (Bhopal Transit)', city: 'Bhopal', type: 'junction', lat: 23.2599, lon: 77.4126, isJunction: true },
  { id: 'J12', name: 'J12 (Nashik Waypoint)', city: 'Nashik', type: 'junction', lat: 19.9975, lon: 73.7898, isJunction: true },
  { id: 'J13', name: 'J13 (Raipur Gateway)', city: 'Raipur', type: 'junction', lat: 21.2514, lon: 81.6296, isJunction: true },
];

// 2. Multimodal Transport Corridors (Multiple vectors with intermediate junctions)
export const INITIAL_ROUTES: LogisticsRoute[] = [
  // Primary Trunk Lines (passing through realistic highway junctions)
  { id: 'R-001A', name: 'Mumbai ➔ J12 (Nashik)', fromId: 'SUP-001', toId: 'J12', distanceKm: 165, estTimeHr: 3.5, status: 'active' },
  { id: 'R-001B', name: 'J12 (Nashik) ➔ Nagpur (NH-53)', fromId: 'J12', toId: 'WH-001', distanceKm: 655, estTimeHr: 11.0, status: 'active' },

  { id: 'R-004A', name: 'Delhi ➔ J10 (Gwalior)', fromId: 'WH-005', toId: 'J10', distanceKm: 340, estTimeHr: 5.5, status: 'active' },
  { id: 'R-004B', name: 'J10 (Gwalior) ➔ J11 (Bhopal)', fromId: 'J10', toId: 'J11', distanceKm: 420, estTimeHr: 7.0, status: 'active' },
  { id: 'R-004C', name: 'J11 (Bhopal) ➔ Nagpur (NH-46)', fromId: 'J11', toId: 'WH-001', distanceKm: 350, estTimeHr: 5.5, status: 'active' },

  { id: 'R-003A', name: 'Nagpur ➔ J13 (Raipur)', fromId: 'WH-001', toId: 'J13', distanceKm: 285, estTimeHr: 5.0, status: 'active' },
  { id: 'R-003B', name: 'J13 (Raipur) ➔ Kolkata (NH-53)', fromId: 'J13', toId: 'CUST-001', distanceKm: 815, estTimeHr: 14.5, status: 'active' },

  // Central Corridor (Nagpur ➔ Hyderabad via J1 Adilabad)
  { id: 'R-002A', name: 'Nagpur ➔ J1 (Adilabad)', fromId: 'WH-001', toId: 'J1', distanceKm: 240, estTimeHr: 4.2, status: 'active' },
  { id: 'R-002B', name: 'J1 (Adilabad) ➔ Hyderabad', fromId: 'J1', toId: 'WH-002', distanceKm: 260, estTimeHr: 5.0, status: 'active' },

  // Southern Corridor (Warehouse WH-002 ➔ J-JA Jadcherla ➔ J2 Kurnool ➔ Bengaluru)
  { id: 'R-020', name: 'Hyderabad ➔ J-JA (Jadcherla)', fromId: 'WH-002', toId: 'J-JA', distanceKm: 85, estTimeHr: 1.8, status: 'active' },
  { id: 'R-021A', name: 'RT-007 / R-021A (Jadcherla ➔ Kurnool)', fromId: 'J-JA', toId: 'J2', distanceKm: 135, estTimeHr: 2.7, status: 'active' },
  { id: 'R-021B', name: 'J2 (Kurnool) ➔ Bengaluru (NH-44)', fromId: 'J2', toId: 'WH-003', distanceKm: 350, estTimeHr: 6.0, status: 'active' },

  // Candidate Bypass A (Eastern Coastal via Vijayawada & Chennai)
  { id: 'R-005A', name: 'Hyderabad ➔ J3 (Vijayawada)', fromId: 'WH-002', toId: 'J3', distanceKm: 275, estTimeHr: 4.8, status: 'recommended', isAlternate: true, candidateGroup: 'A' },
  { id: 'R-005B', name: 'J3 (Vijayawada) ➔ J4 (Nellore)', fromId: 'J3', toId: 'J4', distanceKm: 280, estTimeHr: 5.0, status: 'recommended', isAlternate: true, candidateGroup: 'A' },
  { id: 'R-005C', name: 'J4 (Nellore) ➔ Chennai (SUP-002)', fromId: 'J4', toId: 'SUP-002', distanceKm: 175, estTimeHr: 3.2, status: 'recommended', isAlternate: true, candidateGroup: 'A' },
  { id: 'R-005D', name: 'Chennai ➔ J5 (Kanchipuram)', fromId: 'SUP-002', toId: 'J5', distanceKm: 75, estTimeHr: 1.5, status: 'recommended', isAlternate: true, candidateGroup: 'A' },
  { id: 'R-005E', name: 'J5 (Kanchipuram) ➔ Bengaluru', fromId: 'J5', toId: 'WH-003', distanceKm: 275, estTimeHr: 5.0, status: 'recommended', isAlternate: true, candidateGroup: 'A' },

  // Candidate Bypass B (Western Corridor via Solapur & Kalaburagi)
  { id: 'R-007A', name: 'Nagpur ➔ J6 (Nanded)', fromId: 'WH-001', toId: 'J6', distanceKm: 290, estTimeHr: 5.5, status: 'candidate', isAlternate: true, candidateGroup: 'B' },
  { id: 'R-007B', name: 'J6 (Nanded) ➔ J7 (Solapur)', fromId: 'J6', toId: 'J7', distanceKm: 240, estTimeHr: 4.8, status: 'candidate', isAlternate: true, candidateGroup: 'B' },
  { id: 'R-007C', name: 'J7 (Solapur) ➔ J8 (Kalaburagi)', fromId: 'J7', toId: 'J8', distanceKm: 120, estTimeHr: 2.5, status: 'candidate', isAlternate: true, candidateGroup: 'B' },
  { id: 'R-007D', name: 'Hyderabad ➔ J8 (Kalaburagi)', fromId: 'WH-002', toId: 'J8', distanceKm: 225, estTimeHr: 4.5, status: 'candidate', isAlternate: true, candidateGroup: 'B' },
  { id: 'R-007E', name: 'J8 (Kalaburagi) ➔ J9 (Anantapur)', fromId: 'J8', toId: 'J9', distanceKm: 340, estTimeHr: 6.8, status: 'candidate', isAlternate: true, candidateGroup: 'B' },
  { id: 'R-007F', name: 'J9 (Anantapur) ➔ Bengaluru', fromId: 'J9', toId: 'WH-003', distanceKm: 215, estTimeHr: 4.2, status: 'candidate', isAlternate: true, candidateGroup: 'B' },

  // Scenario Detour Connectors
  { id: 'R-008A', name: 'J12 (Nashik) ➔ J6 (Nanded Detour)', fromId: 'J12', toId: 'J6', distanceKm: 280, estTimeHr: 5.0, status: 'candidate', isAlternate: true, candidateGroup: 'A' },
  { id: 'R-009A', name: 'J10 (Gwalior) ➔ J13 (Raipur Detour)', fromId: 'J10', toId: 'J13', distanceKm: 580, estTimeHr: 9.5, status: 'candidate', isAlternate: true, candidateGroup: 'A' },
];

// 3. Moving Shipments with realistic multi-junction paths (From Orders Shipments dataset)
export const INITIAL_SHIPMENTS: MovingShipment[] = [
  {
    id: 'SHP-5002',
    orderId: 'ORD-1002',
    sku: 'SKU-PK-01',
    quantity: 500,
    fromId: 'WH-001',
    toId: 'WH-003',
    currentRouteId: 'R-021A',
    // Original path: Nagpur -> J1 -> Hyderabad -> J-JA (Jadcherla) -> Kurnool (J2) -> Bengaluru
    routePath: ['WH-001', 'J1', 'WH-002', 'J-JA', 'J2', 'WH-003'],
    // Recovery bypass: Hyderabad -> J3 -> J4 -> Chennai -> J5 -> Bengaluru
    alternatePath: ['WH-001', 'J1', 'WH-002', 'J3', 'J4', 'SUP-002', 'J5', 'WH-003'],
    status: 'IN_TRANSIT',
    eta: '19:30 IST',
    progress: 0.46,
    isAffected: false,
  },
  {
    id: 'SHP-5001',
    orderId: 'ORD-1001',
    sku: 'SKU-EL-01',
    quantity: 240,
    fromId: 'SUP-001',
    toId: 'WH-001',
    currentRouteId: 'R-001B',
    routePath: ['SUP-001', 'J12', 'WH-001'],
    alternatePath: ['SUP-001', 'J12', 'J6', 'WH-001'],
    status: 'IN_TRANSIT',
    eta: '16:45 IST',
    progress: 0.65,
    isAffected: false,
  },
  {
    id: 'SHP-5003',
    orderId: 'ORD-1003',
    sku: 'SKU-EL-02',
    quantity: 180,
    fromId: 'WH-005',
    toId: 'WH-001',
    currentRouteId: 'R-004B',
    routePath: ['WH-005', 'J10', 'J11', 'WH-001'],
    alternatePath: ['WH-005', 'J10', 'J13', 'WH-001'],
    status: 'IN_TRANSIT',
    eta: '18:10 IST',
    progress: 0.35,
    isAffected: false,
  },
  {
    id: 'SHP-5004',
    orderId: 'ORD-1004',
    sku: 'SKU-MT-01',
    quantity: 300,
    fromId: 'WH-001',
    toId: 'CUST-001',
    currentRouteId: 'R-003A',
    routePath: ['WH-001', 'J13', 'CUST-001'],
    status: 'IN_TRANSIT',
    eta: '22:30 IST',
    progress: 0.82,
    isAffected: false,
  },
];

// 4. SITUATIONAL SCENARIO DEFINITIONS (Direct from Excel Workbook)
export const SCENARIO_PRESETS: Record<ScenarioId, ScenarioDefinition> = {
  // Scenario 1: NORMAL NETWORK
  NORMAL: {
    id: 'NORMAL',
    label: 'NORMAL NETWORK',
    primarySelectedShipmentId: 'SHP-5002',
    disruptions: [],
    recovery: {
      title: 'Nominal Network Optimization',
      corridor: 'All national transit corridors active',
      travelTimeDelta: '0.0h',
      distanceDelta: '0 km',
      costDelta: '0%',
      originalRouteDesc: 'Trunk corridors operational',
      originalDistKm: 680,
      originalTimeHr: 12.5,
      recoveryRouteDesc: 'Standard scheduled dispatches',
      recoveryDistKm: 680,
      recoveryTimeHr: 12.5,
      explanation: 'All routes and warehouse hubs operating within nominal parameters. No recovery action needed.',
      viaJunctions: 'Nominal routing',
      bypassCoords: [15.8281, 78.0373],
    },
    affectedShipmentIds: [],
    delayedProgressMap: {},
    routeStatuses: {
      'R-001A': 'active',
      'R-001B': 'active',
      'R-004A': 'active',
      'R-004B': 'active',
      'R-004C': 'active',
      'R-003A': 'active',
      'R-003B': 'active',
      'R-002A': 'active',
      'R-002B': 'active',
      'R-020': 'active',
      'R-021A': 'active',
      'R-021B': 'active',
      'R-005A': 'candidate',
      'R-005B': 'candidate',
      'R-005C': 'candidate',
      'R-005D': 'candidate',
      'R-005E': 'candidate',
      'R-007A': 'candidate',
      'R-007B': 'candidate',
      'R-007C': 'candidate',
      'R-007D': 'candidate',
      'R-007E': 'candidate',
      'R-007F': 'candidate',
      'R-008A': 'candidate',
      'R-009A': 'candidate',
    },
  },

  // Scenario 2: ROAD CLOSURE (DIS-002: RT-007 / R-021A)
  ROAD_CLOSURE: {
    id: 'ROAD_CLOSURE',
    label: 'ROAD CLOSURE (DIS-002)',
    primarySelectedShipmentId: 'SHP-5002',
    disruptions: [
      {
        id: 'DIS-002',
        title: 'Route Blockage',
        disruptionType: 'Route Blockage',
        location: 'NH-44 / RT-007 (Jadcherla ➔ Kurnool Sector)',
        description: 'Port access route blocked due to landslide; shipments require an alternate path.',
        severity: 4,
        capacityImpact: '100% reduction',
        affectedShipmentsCount: 1,
        affectedRoutesCount: 1,
        status: 'ACTIVE',
        blockedRouteId: 'R-021A',
        blockedRouteName: 'RT-007 / R-021A',
        fromCity: 'Jadcherla',
        toCity: 'Kurnool',
        coordinates: [16.294, 78.0886], // Midpoint between J-JA Jadcherla and J2 Kurnool
      },
    ],
    recovery: {
      title: 'Reroute via J3 (Vijayawada) ➔ J4 (Nellore) ➔ Chennai ➔ J5',
      corridor: 'Hyderabad ➔ J3 ➔ J4 ➔ Chennai ➔ J5 ➔ Bengaluru',
      travelTimeDelta: '+3.2h',
      distanceDelta: '+210 km',
      costDelta: '+12%',
      originalRouteDesc: 'WH-001 ➔ J1 ➔ WH-002 ➔ J-JA ➔ J2 (Kurnool) ➔ WH-003',
      originalDistKm: 680,
      originalTimeHr: 12.5,
      recoveryRouteDesc: 'WH-002 ➔ J3 ➔ J4 ➔ Chennai ➔ J5 ➔ WH-003',
      recoveryDistKm: 890,
      recoveryTimeHr: 15.7,
      explanation: 'AI quantum swarm route optimizer reallocated consignment SHP-5002 via Eastern Coastal Bypass, completely avoiding landslide sector J2.',
      viaJunctions: 'J3 (Vijayawada), J4 (Nellore), J5 (Kanchipuram)',
      bypassCoords: [14.4426, 80.8], // J4 Nellore Waypoint
    },
    affectedShipmentIds: ['SHP-5002'],
    delayedProgressMap: { 'SHP-5002': 0.46 },
    routeStatuses: {
      'R-020': 'active', // Normal blue (WH-002 ➔ J-JA)
      'R-021A': 'disrupted', // Exact blocked edge (red dashed pulse)
      'R-021B': 'active', // Downstream normal blue (J2 ➔ Bengaluru)
      'R-005A': 'recommended',
      'R-005B': 'recommended',
      'R-005C': 'recommended',
      'R-005D': 'recommended',
      'R-005E': 'recommended',
      'R-007A': 'candidate',
      'R-007B': 'candidate',
    },
  },

  // Scenario 3: SEVERE ACCIDENT (DIS-006: RT-004 / R-001B)
  ACCIDENT: {
    id: 'ACCIDENT',
    label: 'SEVERE ACCIDENT (DIS-006)',
    primarySelectedShipmentId: 'SHP-5001',
    disruptions: [
      {
        id: 'DIS-006',
        title: 'Vehicle Breakdown / Collision',
        disruptionType: 'Vehicle Breakdown',
        location: 'NH-53 / Route R-001B (Nashik ➔ Nagpur)',
        description: 'Half of planned route capacity unavailable during vehicle breakdown / major collision.',
        severity: 3,
        capacityImpact: '50% reduction',
        affectedShipmentsCount: 1,
        affectedRoutesCount: 2,
        status: 'ACTIVE',
        blockedRouteId: 'R-001B',
        blockedRouteName: 'RT-004 / R-001B (Nashik ➔ Nagpur)',
        fromCity: 'Nashik',
        toCity: 'Nagpur',
        coordinates: [19.9975, 73.7898], // J12 Nashik Waypoint
      },
    ],
    recovery: {
      title: 'Reroute via J12 (Nashik) ➔ J6 (Nanded) ➔ Nagpur',
      corridor: 'Mumbai ➔ J12 ➔ J6 (Nanded) ➔ Nagpur',
      travelTimeDelta: '+2.1h',
      distanceDelta: '+125 km',
      costDelta: '+8%',
      originalRouteDesc: 'SUP-001 ➔ J12 (Nashik) ➔ WH-001 (Nagpur)',
      originalDistKm: 820,
      originalTimeHr: 14.5,
      recoveryRouteDesc: 'SUP-001 ➔ J12 ➔ J6 (Nanded) ➔ WH-001 (Nagpur)',
      recoveryDistKm: 945,
      recoveryTimeHr: 16.6,
      explanation: 'Quantum swarm detected NH-53 blockage at Nashik and diverted consignment SHP-5001 south via Nanded transit hub (J6).',
      viaJunctions: 'J12 (Nashik), J6 (Nanded Transit)',
      bypassCoords: [19.1383, 77.3210], // J6 Nanded
    },
    affectedShipmentIds: ['SHP-5001'],
    delayedProgressMap: { 'SHP-5001': 0.28 },
    routeStatuses: {
      'R-001B': 'disrupted',
      'R-001A': 'impacted',
      'R-008A': 'recommended',
      'R-007A': 'recommended',
    },
  },

  // Scenario 4: EXTREME WEATHER (DIS-003: RT-009 / R-004B)
  EXTREME_WEATHER: {
    id: 'EXTREME_WEATHER',
    label: 'EXTREME WEATHER (DIS-003)',
    primarySelectedShipmentId: 'SHP-5003',
    disruptions: [
      {
        id: 'DIS-003',
        title: 'Extreme Weather',
        disruptionType: 'Extreme Weather',
        location: 'NH-44 / Route R-004B (Gwalior ➔ Bhopal)',
        description: 'Severe weather reduces route capacity by 60 percent. Torrential rains in central corridor.',
        severity: 4,
        capacityImpact: '60% reduction',
        affectedShipmentsCount: 1,
        affectedRoutesCount: 2,
        status: 'ACTIVE',
        blockedRouteId: 'R-004B',
        blockedRouteName: 'RT-009 / R-004B (Gwalior ➔ Bhopal)',
        fromCity: 'Gwalior',
        toCity: 'Bhopal',
        coordinates: [26.2183, 78.1828], // J10 Gwalior
      },
    ],
    recovery: {
      title: 'Reroute via J10 (Gwalior) ➔ J13 (Raipur) ➔ Nagpur',
      corridor: 'Delhi ➔ J10 ➔ J13 (Raipur) ➔ Nagpur',
      travelTimeDelta: '+3.8h',
      distanceDelta: '+240 km',
      costDelta: '+14%',
      originalRouteDesc: 'WH-005 ➔ J10 ➔ J11 ➔ WH-001',
      originalDistKm: 1110,
      originalTimeHr: 18.0,
      recoveryRouteDesc: 'WH-005 ➔ J10 ➔ J13 ➔ WH-001',
      recoveryDistKm: 1350,
      recoveryTimeHr: 21.8,
      explanation: 'Severe cyclonic rainfall flooded Gwalior-Bhopal section. Swarm optimizer diverted SHP-5003 east via Raipur Gateway (J13).',
      viaJunctions: 'J10 (Gwalior), J13 (Raipur Gateway)',
      bypassCoords: [21.2514, 81.6296], // J13 Raipur
    },
    affectedShipmentIds: ['SHP-5003'],
    delayedProgressMap: { 'SHP-5003': 0.35 },
    routeStatuses: {
      'R-004B': 'disrupted',
      'R-004C': 'impacted',
      'R-009A': 'recommended',
      'R-003A': 'recommended',
    },
  },

  // Scenario 5: CAPACITY REDUCTION (DIS-004: WH-002)
  CAPACITY_REDUCTION: {
    id: 'CAPACITY_REDUCTION',
    label: 'CAPACITY REDUCTION (DIS-004)',
    primarySelectedShipmentId: 'SHP-5002',
    disruptions: [
      {
        id: 'DIS-004',
        title: 'Warehouse Disruption',
        disruptionType: 'Warehouse Disruption',
        location: 'WH-002 (Hyderabad Central DC)',
        description: 'Temporary warehouse operating capacity reduction of 40% due to automated sorting failure.',
        severity: 3,
        capacityImpact: '40% reduction',
        affectedShipmentsCount: 1,
        affectedRoutesCount: 2,
        status: 'ACTIVE',
        blockedRouteId: 'R-002B',
        blockedRouteName: 'Hub WH-002 / R-002B (Hyderabad Central DC)',
        fromCity: 'Adilabad',
        toCity: 'Hyderabad',
        coordinates: [17.3850, 78.4867], // WH-002 Hyderabad
      },
    ],
    recovery: {
      title: 'Cross-Dock Reallocation via J6 ➔ J7 ➔ J8 ➔ J9 (Bypass Hyderabad)',
      corridor: 'Nagpur ➔ J6 ➔ J7 ➔ J8 ➔ J9 ➔ Bengaluru',
      travelTimeDelta: '+1.8h',
      distanceDelta: '+90 km',
      costDelta: '+6%',
      originalRouteDesc: 'WH-001 ➔ J1 ➔ WH-002 ➔ J2 ➔ WH-003',
      originalDistKm: 1070,
      originalTimeHr: 19.7,
      recoveryRouteDesc: 'WH-001 ➔ J6 ➔ J7 ➔ J8 ➔ J9 ➔ WH-003',
      recoveryDistKm: 1160,
      recoveryTimeHr: 21.5,
      explanation: 'Direct cross-warehouse reallocation bypassing congested Hyderabad DC via western transit corridor (Nanded-Solapur-Kalaburagi-Anantapur).',
      viaJunctions: 'J6 (Nanded), J7 (Solapur), J8 (Kalaburagi), J9 (Anantapur)',
      bypassCoords: [17.6599, 75.9064], // J7 Solapur
    },
    affectedShipmentIds: ['SHP-5002'],
    delayedProgressMap: { 'SHP-5002': 0.25 },
    routeStatuses: {
      'R-002B': 'impacted',
      'R-021A': 'impacted',
      'R-007A': 'recommended',
      'R-007B': 'recommended',
      'R-007C': 'recommended',
      'R-007E': 'recommended',
      'R-007F': 'recommended',
    },
  },

  // Scenario 6: MULTI-ROUTE DISRUPTION (DIS-008: Cascading Failure)
  MULTI_ROUTE: {
    id: 'MULTI_ROUTE',
    label: 'MULTI-ROUTE DISRUPTION (DIS-008)',
    primarySelectedShipmentId: 'SHP-5002',
    disruptions: [
      {
        id: 'DIS-002',
        title: 'Route Blockage (South)',
        disruptionType: 'Route Blockage',
        location: 'NH-44 / RT-007 (Jadcherla ➔ Kurnool Sector)',
        description: 'Port access route blocked due to landslide; shipments require an alternate path.',
        severity: 4,
        capacityImpact: '100% reduction',
        affectedShipmentsCount: 1,
        affectedRoutesCount: 1,
        status: 'ACTIVE',
        blockedRouteId: 'R-021A',
        blockedRouteName: 'RT-007 / R-021A',
        fromCity: 'Jadcherla',
        toCity: 'Kurnool',
        coordinates: [16.294, 78.0886], // Midpoint between J-JA and J2
      },
      {
        id: 'DIS-006',
        title: 'Vehicle Breakdown (West)',
        disruptionType: 'Vehicle Breakdown',
        location: 'NH-53 / Route R-001B (Nashik ➔ Nagpur)',
        description: 'Half of planned route capacity unavailable during vehicle breakdown / major collision.',
        severity: 3,
        capacityImpact: '50% reduction',
        affectedShipmentsCount: 1,
        affectedRoutesCount: 2,
        status: 'ACTIVE',
        blockedRouteId: 'R-001B',
        blockedRouteName: 'RT-004 / R-001B (Nashik ➔ Nagpur)',
        fromCity: 'Nashik',
        toCity: 'Nagpur',
        coordinates: [19.9975, 73.7898], // J12 Nashik
      },
    ],
    recovery: {
      title: 'Dual-Corridor AI Swarm Recovery (Eastern Coastal + Nanded Detours)',
      corridor: 'Parallel Reroute: SHP-5002 via Chennai + SHP-5001 via Nanded',
      travelTimeDelta: '+3.2h / +2.1h',
      distanceDelta: '+210 km / +125 km',
      costDelta: '+11%',
      originalRouteDesc: 'Corridors R-021 (South) & R-001B (West)',
      originalDistKm: 1500,
      originalTimeHr: 27.0,
      recoveryRouteDesc: 'Bypass A (J3-J4-Chennai-J5) & Bypass B (J12-J6-WH-001)',
      recoveryDistKm: 1835,
      recoveryTimeHr: 32.3,
      explanation: 'Simultaneous quantum optimization of 2 blocked national trunks, dispatching SHP-5002 via coastal corridor and SHP-5001 via Nanded transit bypass.',
      viaJunctions: 'J3 (Vijayawada), J4 (Nellore), J6 (Nanded), J12 (Nashik)',
      bypassCoords: [14.4426, 80.8], // J4 Nellore
    },
    affectedShipmentIds: ['SHP-5002', 'SHP-5001'],
    delayedProgressMap: { 'SHP-5002': 0.46, 'SHP-5001': 0.28 },
    routeStatuses: {
      'R-020': 'active',     // 🔵 WH-002 ➔ J-JA Normal
      'R-021A': 'disrupted', // 🔴 Route A DISRUPTED (J-JA ➔ J2)
      'R-021B': 'active',    // 🔵 J2 ➔ WH-003 Normal
      'R-004B': 'impacted',  // 🟠 Route B IMPACTED
      'R-001B': 'disrupted', // 🔴 Route C DISRUPTED
      'R-005A': 'recommended', // 🟢 Route D AVAILABLE / RECOVERY
      'R-005B': 'recommended',
      'R-005C': 'recommended',
      'R-005D': 'recommended',
      'R-005E': 'recommended',
      'R-008A': 'recommended',
      'R-007A': 'candidate',
    },
  },
};

export class IndiaLogisticsService {
  private currentScenarioId: ScenarioId = 'ROAD_CLOSURE';
  private nodes: LogisticsNode[] = JSON.parse(JSON.stringify(INDIA_NODES));
  private routes: LogisticsRoute[] = JSON.parse(JSON.stringify(INITIAL_ROUTES));
  private shipments: MovingShipment[] = JSON.parse(JSON.stringify(INITIAL_SHIPMENTS));
  private disruptions: DisruptionAlert[] = [];
  private recovery: RecoveryRecommendation = SCENARIO_PRESETS.ROAD_CLOSURE.recovery;

  constructor() {
    this.setScenario('ROAD_CLOSURE');
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
      location: 'Pan-India Network',
      description: 'All corridors operational.',
      severity: 0,
      capacityImpact: '0%',
      affectedShipmentsCount: 0,
      affectedRoutesCount: 0,
      status: 'RESOLVED',
      blockedRouteId: '',
      blockedRouteName: '',
      fromCity: '',
      toCity: '',
      coordinates: [18.5, 79.8],
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
      suppliers: 10,
      warehouses: 6,
      activeShipments: 12,
      onTimeShipments: isDisrupted ? 12 - delayedCount : 12,
      delayedShipments: delayedCount,
      orders: 12,
      activeDisruptions: activeCount,
      networkHealthPct: isDisrupted ? Math.max(75, 99 - activeCount * 7 - delayedCount * 5) : 99,
    };
  }

  // Switch situational scenario
  setScenario(scenarioId: ScenarioId): void {
    this.currentScenarioId = scenarioId;
    const preset = SCENARIO_PRESETS[scenarioId];

    // Reset base routes
    this.routes = JSON.parse(JSON.stringify(INITIAL_ROUTES));

    // Reset base shipments
    this.shipments = JSON.parse(JSON.stringify(INITIAL_SHIPMENTS));

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
        shp.eta = `${shp.eta.split(' ')[0] || '20:15'} IST (Recovered)`;

        // Adjust route ID and starting progress on bypass
        if (shp.id === 'SHP-5002') {
          shp.currentRouteId = 'R-005A';
          shp.progress = 0.38;
        } else if (shp.id === 'SHP-5001') {
          shp.currentRouteId = 'R-008A';
          shp.progress = 0.35;
        } else if (shp.id === 'SHP-5003') {
          shp.currentRouteId = 'R-009A';
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

  // Reset to initial baseline disrupted state for evaluation replay
  resetState(): void {
    this.setScenario(this.currentScenarioId);
  }
}

export const indiaLogisticsService = new IndiaLogisticsService();
export default indiaLogisticsService;

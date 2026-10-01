/**
 * FirstMile Normalized Logistics Data Layer
 * Source of Truth: Hackathon Logistics Digital Twin Dataset
 * 10 Warehouses | 15 Vehicles in Transit | 1 Product: Medical Supply Kit | 6 Businesses (BIZ01-BIZ06)
 */

export interface WarehouseRecord {
  id: string; // WH01 - WH10
  name: string;
  city: string;
  address: string;
  product: string; // "Medical Supply Kit"
  inventory: number;
  capacity: number;
  currentLoad: number; // %
  status: 'Operational';
  lat: number;
  lon: number;
  loadCategory: 'LOW LOAD' | 'NORMAL' | 'HIGH LOAD';
}

export type VehicleType = 'Refrigerated Truck' | 'Medium Box Truck' | 'Heavy Truck';
export type BusinessId = 'BIZ01' | 'BIZ02' | 'BIZ03' | 'BIZ04' | 'BIZ05' | 'BIZ06';

export interface VehicleTelemetryRecord {
  vehicleNo: string;
  vehicleType: VehicleType;
  businessId: BusinessId;
  product: string; // "Medical Supply Kit"
  capacityHeld: number;
  totalCapacity: number;
  utilization: number; // %
  status: 'In Transit';
  lastUpdatedLocation: string;
  lastUpdatedTime: string;
  fromAddress: string;
  toAddress: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  lat: number;
  lon: number;
  progress: number; // 0.0 to 1.0 along flow
  bearing: number;
  routePath?: string[];
  alternatePath?: string[];
}

export interface NetworkFlowConnection {
  id: string;
  vehicleNo: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  fromCoords: [number, number];
  currentCoords: [number, number];
  toCoords: [number, number];
  flowLabel: string;
  businessId: BusinessId;
  vehicleType: VehicleType;
}

export interface LivePlatformKpis {
  warehousesCount: number;
  vehiclesInTransitCount: number;
  productsCount: number;
  productName: string;
  businessesCount: number;
  totalInventoryUnits: number;
  totalWarehouseCapacityUnits: number;
  avgWarehouseUtilizationPct: number;
  totalCapacityHeldUnits: number;
  totalFleetCapacityUnits: number;
  fleetUtilizationPct: number;
  activeDisruptionsCount: number;
  networkStatus: 'OPERATIONAL' | 'DEGRADED';
}

// 1. WAREHOUSE INVENTORY MASTER (Exact 10 records)
export const WAREHOUSE_RECORDS: WarehouseRecord[] = [
  {
    id: 'WH01',
    name: 'Hyderabad Central DC',
    city: 'Hyderabad',
    address: 'Jeedimetla Industrial Area, Hyderabad',
    product: 'Medical Supply Kit',
    inventory: 420,
    capacity: 1200,
    currentLoad: 35.0,
    status: 'Operational',
    lat: 17.5169,
    lon: 78.4721,
    loadCategory: 'NORMAL',
  },
  {
    id: 'WH02',
    name: 'Hyderabad South Hub',
    city: 'Hyderabad',
    address: 'Shamshabad Logistics Park, Hyderabad',
    product: 'Medical Supply Kit',
    inventory: 280,
    capacity: 900,
    currentLoad: 31.1,
    status: 'Operational',
    lat: 17.2543,
    lon: 78.4286,
    loadCategory: 'NORMAL',
  },
  {
    id: 'WH03',
    name: 'Chennai North DC',
    city: 'Chennai',
    address: 'Manali Industrial Area, Chennai',
    product: 'Medical Supply Kit',
    inventory: 360,
    capacity: 1100,
    currentLoad: 32.7,
    status: 'Operational',
    lat: 13.1667,
    lon: 80.2667,
    loadCategory: 'NORMAL',
  },
  {
    id: 'WH04',
    name: 'Chennai South Hub',
    city: 'Chennai',
    address: 'Oragadam Industrial Corridor, Chennai',
    product: 'Medical Supply Kit',
    inventory: 190,
    capacity: 800,
    currentLoad: 23.8,
    status: 'Operational',
    lat: 12.8342,
    lon: 79.9483,
    loadCategory: 'LOW LOAD',
  },
  {
    id: 'WH05',
    name: 'Bengaluru East DC',
    city: 'Bengaluru',
    address: 'Whitefield Industrial Area, Bengaluru',
    product: 'Medical Supply Kit',
    inventory: 310,
    capacity: 1000,
    currentLoad: 31.0,
    status: 'Operational',
    lat: 12.9698,
    lon: 77.7500,
    loadCategory: 'NORMAL',
  },
  {
    id: 'WH06',
    name: 'Bengaluru North Hub',
    city: 'Bengaluru',
    address: 'Yelahanka Logistics Zone, Bengaluru',
    product: 'Medical Supply Kit',
    inventory: 160,
    capacity: 700,
    currentLoad: 22.9,
    status: 'Operational',
    lat: 13.1007,
    lon: 77.5963,
    loadCategory: 'LOW LOAD',
  },
  {
    id: 'WH07',
    name: 'Vijayawada Hub',
    city: 'Vijayawada',
    address: 'Gannavaram Logistics Zone, Vijayawada',
    product: 'Medical Supply Kit',
    inventory: 240,
    capacity: 750,
    currentLoad: 32.0,
    status: 'Operational',
    lat: 16.5414,
    lon: 80.7981,
    loadCategory: 'NORMAL',
  },
  {
    id: 'WH08',
    name: 'Visakhapatnam DC',
    city: 'Visakhapatnam',
    address: 'Gajuwaka Industrial Area, Visakhapatnam',
    product: 'Medical Supply Kit',
    inventory: 210,
    capacity: 850,
    currentLoad: 24.7,
    status: 'Operational',
    lat: 17.6905,
    lon: 83.2185,
    loadCategory: 'LOW LOAD',
  },
  {
    id: 'WH09',
    name: 'Warangal Hub',
    city: 'Warangal',
    address: 'Kazipet Industrial Area, Warangal',
    product: 'Medical Supply Kit',
    inventory: 130,
    capacity: 500,
    currentLoad: 26.0,
    status: 'Operational',
    lat: 17.9784,
    lon: 79.5218,
    loadCategory: 'NORMAL',
  },
  {
    id: 'WH10',
    name: 'Pune West DC',
    city: 'Pune',
    address: 'Chakan Industrial Area, Pune',
    product: 'Medical Supply Kit',
    inventory: 330,
    capacity: 1050,
    currentLoad: 31.4,
    status: 'Operational',
    lat: 18.7606,
    lon: 73.8567,
    loadCategory: 'NORMAL',
  },
];

// Helper mapping address to warehouse ID
export const WAREHOUSE_MAP_BY_ID = new Map<string, WarehouseRecord>(
  WAREHOUSE_RECORDS.map((w) => [w.id, w])
);

// ==========================================
// 1.5. LOGISTICS TRANSIT JUNCTIONS (Graph Nodes)
// Realistic Indian Highway Waypoints & Junctions
// ==========================================
export interface JunctionRecord {
  id: string;
  name: string;
  city: string;
  highway: string;
  lat: number;
  lon: number;
  isJunction: true;
}

export const JUNCTION_RECORDS: JunctionRecord[] = [
  { id: 'J-JA', name: 'Jadcherla Junction', city: 'Jadcherla', highway: 'NH-44', lat: 16.7667, lon: 78.1333, isJunction: true },
  { id: 'J-KURNOOL', name: 'Kurnool Bypass', city: 'Kurnool', highway: 'NH-44 / NH-40', lat: 15.8281, lon: 78.0373, isJunction: true },
  { id: 'J-NANDYAL', name: 'Nandyal Junction', city: 'Nandyal', highway: 'NH-40', lat: 15.4855, lon: 78.4836, isJunction: true },
  { id: 'J-CUDDAPAH', name: 'Kadapa Junction', city: 'Kadapa', highway: 'NH-40 / NH-716', lat: 14.4673, lon: 78.8242, isJunction: true },
  { id: 'J-ANANTAPUR', name: 'Anantapur Junction', city: 'Anantapur', highway: 'NH-44', lat: 14.6819, lon: 77.6006, isJunction: true },
  { id: 'J-CHIKKABALLAPUR', name: 'Chikkaballapur Junction', city: 'Chikkaballapur', highway: 'NH-44', lat: 13.4325, lon: 77.7275, isJunction: true },
  { id: 'J-SURYAPET', name: 'Suryapet Junction', city: 'Suryapet', highway: 'NH-65', lat: 17.1439, lon: 79.6239, isJunction: true },
  { id: 'J-GUNTUR', name: 'Guntur Junction', city: 'Guntur', highway: 'NH-16', lat: 16.3067, lon: 80.4365, isJunction: true },
  { id: 'J-ONGOLE', name: 'Ongole Junction', city: 'Ongole', highway: 'NH-16', lat: 15.5057, lon: 80.0499, isJunction: true },
  { id: 'J-NELLORE', name: 'Nellore Junction', city: 'Nellore', highway: 'NH-16', lat: 14.4426, lon: 79.9865, isJunction: true },
  { id: 'J-TIRUPATI', name: 'Tirupati Junction', city: 'Tirupati', highway: 'NH-716', lat: 13.6288, lon: 79.4192, isJunction: true },
  { id: 'J-KANCHIPURAM', name: 'Kanchipuram Junction', city: 'Kanchipuram', highway: 'NH-48', lat: 12.8342, lon: 79.7036, isJunction: true },
  { id: 'J-VELLORE', name: 'Vellore Junction', city: 'Vellore', highway: 'NH-48', lat: 12.9165, lon: 79.1325, isJunction: true },
  { id: 'J-HOSUR', name: 'Hosur Junction', city: 'Hosur', highway: 'NH-44', lat: 12.7409, lon: 77.8253, isJunction: true },
  { id: 'J-SOLAPUR', name: 'Solapur Western Junction', city: 'Solapur', highway: 'NH-65', lat: 17.6599, lon: 75.9064, isJunction: true },
  { id: 'J-AHMEDNAGAR', name: 'Ahmednagar Junction', city: 'Ahmednagar', highway: 'NH-160', lat: 19.0952, lon: 74.7480, isJunction: true },
  { id: 'J-NANDED', name: 'Nanded Hub Waypoint', city: 'Nanded', highway: 'NH-161', lat: 19.1383, lon: 77.3210, isJunction: true },
  { id: 'J-KHAMMAM', name: 'Khammam Junction', city: 'Khammam', highway: 'NH-365A', lat: 17.2473, lon: 80.1514, isJunction: true },
  { id: 'J-RAJAHMUNDRY', name: 'Rajahmundry Junction', city: 'Rajahmundry', highway: 'NH-16', lat: 17.0005, lon: 81.8040, isJunction: true },
  { id: 'J-TUNI', name: 'Tuni Junction', city: 'Tuni', highway: 'NH-16', lat: 17.3571, lon: 82.5518, isJunction: true },
  { id: 'J-SIDDIPET', name: 'Siddipet Junction', city: 'Siddipet', highway: 'SH-1', lat: 18.1018, lon: 78.8521, isJunction: true },
];

export const JUNCTION_MAP_BY_ID = new Map<string, JunctionRecord>(
  JUNCTION_RECORDS.map((j) => [j.id, j])
);

export const ALL_COORDS_MAP = new Map<string, [number, number]>([
  ...WAREHOUSE_RECORDS.map((w): [string, [number, number]] => [w.id, [w.lat, w.lon]]),
  ...JUNCTION_RECORDS.map((j): [string, [number, number]] => [j.id, [j.lat, j.lon]]),
]);

// Helper to look up coordinate tuple
export function getNodeCoords(nodeId: string): [number, number] | undefined {
  return ALL_COORDS_MAP.get(nodeId);
}

// Helper to look up node display name
export function getNodeName(nodeId: string): string {
  const w = WAREHOUSE_MAP_BY_ID.get(nodeId);
  if (w) return `${w.id} (${w.city})`;
  const j = JUNCTION_MAP_BY_ID.get(nodeId);
  if (j) return `${j.name}`;
  return nodeId;
}

// ==========================================
// 1.6. TRUE LOGISTICS GRAPH EDGES
// Warehouse → Junction → Junction → Warehouse
// ==========================================
export interface NetworkGraphEdge {
  id: string;
  name: string;
  fromId: string;
  toId: string;
  highway: string;
  distanceKm: number;
  estTimeHr: number;
  status: 'active' | 'disrupted' | 'impacted' | 'recommended' | 'candidate';
  isAlternate: boolean;
  candidateGroup?: 'A' | 'B' | 'C';
  candidateLabel?: string;
  vehicleNo?: string;
  flowLabel?: string;
  businessId?: string;
}

function createEdge(
  id: string,
  fromId: string,
  toId: string,
  highway: string,
  isAlternate: boolean = false,
  candidateGroup?: 'A' | 'B' | 'C',
  candidateLabel?: string
): NetworkGraphEdge {
  const p1 = ALL_COORDS_MAP.get(fromId)!;
  const p2 = ALL_COORDS_MAP.get(toId)!;
  const dist = Math.round(Math.hypot((p2[0] - p1[0]) * 111, (p2[1] - p1[1]) * 105));
  const estTimeHr = +(dist / 55).toFixed(1);
  return {
    id,
    name: `${getNodeName(fromId)} ➔ ${getNodeName(toId)} (${highway})`,
    fromId,
    toId,
    highway,
    distanceKm: dist,
    estTimeHr,
    status: isAlternate ? 'candidate' : 'active',
    isAlternate,
    candidateGroup,
    candidateLabel,
  };
}

export const GRAPH_EDGES: NetworkGraphEdge[] = [
  // 1. HYDERABAD SOUTH (WH02) ➔ CHENNAI NORTH (WH03) PRIMARY TRUNK
  createEdge('EDGE-WH02-J_JA', 'WH02', 'J-JA', 'NH-44'),
  createEdge('EDGE-J_JA-J_KURNOOL', 'J-JA', 'J-KURNOOL', 'NH-44'), // The EXACT segment blocked on ROAD_CLOSURE!
  createEdge('EDGE-J_KURNOOL-J_NANDYAL', 'J-KURNOOL', 'J-NANDYAL', 'NH-40'),
  createEdge('EDGE-J_NANDYAL-J_CUDDAPAH', 'J-NANDYAL', 'J-CUDDAPAH', 'NH-40'),
  createEdge('EDGE-J_CUDDAPAH-WH03', 'J-CUDDAPAH', 'WH03', 'NH-716'),

  // PREDEFINED ALTERNATE CANDIDATE PATHS FOR HYDERABAD ➔ CHENNAI:
  // Route A: Recommended (Fastest) via Vijayawada Hub (WH07) & NH-16 Coastal Corridor
  createEdge('EDGE-J_JA-J_SURYAPET', 'J-JA', 'J-SURYAPET', 'NH-167', true, 'A', 'Route A: Recommended (Fastest) via Coastal NH-16'),
  createEdge('EDGE-J_SURYAPET-WH07', 'J-SURYAPET', 'WH07', 'NH-65', true, 'A', 'Route A: Recommended (Fastest) via Coastal NH-16'),
  createEdge('EDGE-WH07-J_GUNTUR', 'WH07', 'J-GUNTUR', 'NH-16', true, 'A', 'Route A: Recommended (Fastest) via Coastal NH-16'),
  createEdge('EDGE-J_GUNTUR-J_ONGOLE', 'J-GUNTUR', 'J-ONGOLE', 'NH-16', true, 'A', 'Route A: Recommended (Fastest) via Coastal NH-16'),
  createEdge('EDGE-J_ONGOLE-J_NELLORE', 'J-ONGOLE', 'J-NELLORE', 'NH-16', true, 'A', 'Route A: Recommended (Fastest) via Coastal NH-16'),
  createEdge('EDGE-J_NELLORE-WH03', 'J-NELLORE', 'WH03', 'NH-16', true, 'A', 'Route A: Recommended (Fastest) via Coastal NH-16'),

  // Route B: Secondary (Higher Cost) via Western Anantapur Bypass
  createEdge('EDGE-J_JA-J_ANANTAPUR', 'J-JA', 'J-ANANTAPUR', 'NH-44', true, 'B', 'Route B: Secondary (Higher Cost) via Anantapur'),
  createEdge('EDGE-J_ANANTAPUR-J_CUDDAPAH', 'J-ANANTAPUR', 'J-CUDDAPAH', 'NH-716', true, 'B', 'Route B: Secondary (Higher Cost) via Anantapur'),

  // Route C: High Risk / Congested via Tirupati Ghats Corridor
  createEdge('EDGE-J_ANANTAPUR-J_TIRUPATI', 'J-ANANTAPUR', 'J-TIRUPATI', 'NH-71', true, 'C', 'Route C: High Risk / Congested via Tirupati Ghats'),
  createEdge('EDGE-J_TIRUPATI-WH03', 'J-TIRUPATI', 'WH03', 'NH-716', true, 'C', 'Route C: High Risk / Congested via Tirupati Ghats'),

  // 2. HYDERABAD CENTRAL (WH01) ➔ HYDERABAD SOUTH (WH02)
  createEdge('EDGE-WH01-WH02', 'WH01', 'WH02', 'Hyderabad ORR'),

  // 3. HYDERABAD SOUTH (WH02) ➔ VIJAYAWADA HUB (WH07)
  createEdge('EDGE-WH02-J_SURYAPET', 'WH02', 'J-SURYAPET', 'NH-65'),

  // 4. CHENNAI NORTH (WH03) ➔ CHENNAI SOUTH (WH04)
  createEdge('EDGE-WH03-J_KANCHIPURAM', 'WH03', 'J-KANCHIPURAM', 'NH-48'),
  createEdge('EDGE-J_KANCHIPURAM-WH04', 'J-KANCHIPURAM', 'WH04', 'SH-57'),

  // 5. CHENNAI SOUTH (WH04) ➔ BENGALURU EAST (WH05)
  createEdge('EDGE-WH04-J_KANCHIPURAM', 'WH04', 'J-KANCHIPURAM', 'SH-57'),
  createEdge('EDGE-J_KANCHIPURAM-J_VELLORE', 'J-KANCHIPURAM', 'J-VELLORE', 'NH-48'),
  createEdge('EDGE-J_VELLORE-J_HOSUR', 'J-VELLORE', 'J-HOSUR', 'NH-48'),
  createEdge('EDGE-J_HOSUR-WH05', 'J-HOSUR', 'WH05', 'NH-44'),

  // 6. BENGALURU EAST (WH05) ➔ BENGALURU NORTH (WH06)
  createEdge('EDGE-WH05-J_CHIKKABALLAPUR', 'WH05', 'J-CHIKKABALLAPUR', 'SH-35'),
  createEdge('EDGE-J_CHIKKABALLAPUR-WH06', 'J-CHIKKABALLAPUR', 'WH06', 'NH-44'),

  // 7. BENGALURU NORTH (WH06) ➔ HYDERABAD CENTRAL (WH01)
  createEdge('EDGE-WH06-J_CHIKKABALLAPUR', 'WH06', 'J-CHIKKABALLAPUR', 'NH-44'),
  createEdge('EDGE-J_CHIKKABALLAPUR-J_ANANTAPUR', 'J-CHIKKABALLAPUR', 'J-ANANTAPUR', 'NH-44'),
  createEdge('EDGE-J_ANANTAPUR-J_KURNOOL', 'J-ANANTAPUR', 'J-KURNOOL', 'NH-44'),
  createEdge('EDGE-J_KURNOOL-J_JA', 'J-KURNOOL', 'J-JA', 'NH-44'),
  createEdge('EDGE-J_JA-WH01', 'J-JA', 'WH01', 'NH-44'),

  // 8. VIJAYAWADA HUB (WH07) ➔ VISAKHAPATNAM DC (WH08)
  createEdge('EDGE-WH07-J_RAJAHMUNDRY', 'WH07', 'J-RAJAHMUNDRY', 'NH-16'),
  createEdge('EDGE-J_RAJAHMUNDRY-J_TUNI', 'J-RAJAHMUNDRY', 'J-TUNI', 'NH-16'), // Blocked in EXTREME_WEATHER!
  createEdge('EDGE-J_TUNI-WH08', 'J-TUNI', 'WH08', 'NH-16'),
  // Inland Alternate Bypass for Visakhapatnam:
  createEdge('EDGE-WH07-J_KHAMMAM', 'WH07', 'J-KHAMMAM', 'NH-365A', true, 'A', 'Route A: Recommended Inland Expressway'),
  createEdge('EDGE-J_KHAMMAM-WH09', 'J-KHAMMAM', 'WH09', 'NH-365', true, 'A', 'Route A: Recommended Inland Expressway'),
  createEdge('EDGE-WH09-WH08', 'WH09', 'WH08', 'NH-163', true, 'A', 'Route A: Recommended Inland Expressway'),

  // 9. VISAKHAPATNAM DC (WH08) ➔ CHENNAI SOUTH HUB (WH04)
  createEdge('EDGE-WH08-J_TUNI', 'WH08', 'J-TUNI', 'NH-16'),
  createEdge('EDGE-J_TUNI-J_RAJAHMUNDRY', 'J-TUNI', 'J-RAJAHMUNDRY', 'NH-16'),
  createEdge('EDGE-J_RAJAHMUNDRY-WH07', 'J-RAJAHMUNDRY', 'WH07', 'NH-16'),
  createEdge('EDGE-J_NELLORE-WH04', 'J-NELLORE', 'WH04', 'NH-16'),

  // 10. WARANGAL HUB (WH09) ➔ HYDERABAD (WH01 / WH02)
  createEdge('EDGE-WH09-J_SIDDIPET', 'WH09', 'J-SIDDIPET', 'SH-1'),
  createEdge('EDGE-J_SIDDIPET-WH01', 'J-SIDDIPET', 'WH01', 'SH-1'),
  createEdge('EDGE-WH01-J_SIDDIPET', 'WH01', 'J-SIDDIPET', 'SH-1'),

  // 11. PUNE WEST DC (WH10) ➔ HYDERABAD CENTRAL (WH01)
  createEdge('EDGE-WH10-J_AHMEDNAGAR', 'WH10', 'J-AHMEDNAGAR', 'NH-160'),
  createEdge('EDGE-J_AHMEDNAGAR-J_SOLAPUR', 'J-AHMEDNAGAR', 'J-SOLAPUR', 'NH-160'), // Blocked in ACCIDENT!
  createEdge('EDGE-J_SOLAPUR-WH02', 'J-SOLAPUR', 'WH02', 'NH-65'),
  // Alternate Bypass for Pune:
  createEdge('EDGE-WH10-J_SOLAPUR', 'WH10', 'J-SOLAPUR', 'NH-65', true, 'A', 'Route A: Recommended Solapur Direct Bypass'),
  createEdge('EDGE-J_AHMEDNAGAR-J_NANDED', 'J-AHMEDNAGAR', 'J-NANDED', 'NH-161', true, 'B', 'Route B: Secondary via Nanded'),
  createEdge('EDGE-J_NANDED-WH01', 'J-NANDED', 'WH01', 'NH-161', true, 'B', 'Route B: Secondary via Nanded'),

  // 12. PUNE WEST DC (WH10) ➔ BENGALURU EAST (WH05)
  createEdge('EDGE-J_SOLAPUR-J_ANANTAPUR', 'J-SOLAPUR', 'J-ANANTAPUR', 'NH-50'),

  // 13. CHENNAI NORTH (WH03) ➔ VIJAYAWADA HUB (WH07)
  createEdge('EDGE-WH03-J_NELLORE', 'WH03', 'J-NELLORE', 'NH-16'),
  createEdge('EDGE-J_GUNTUR-WH07', 'J-GUNTUR', 'WH07', 'NH-16'),

  // 14. BENGALURU NORTH (WH06) ➔ CHENNAI SOUTH HUB (WH04)
  createEdge('EDGE-WH06-J_HOSUR', 'WH06', 'J-HOSUR', 'NH-44'),
  createEdge('EDGE-J_VELLORE-J_KANCHIPURAM', 'J-VELLORE', 'J-KANCHIPURAM', 'NH-48'),
];

// Helper to look up polyline coordinates for any sequence of node IDs
export function getRoutePathCoordinates(routePath: string[]): [number, number][] {
  return routePath
    .map((nodeId) => ALL_COORDS_MAP.get(nodeId))
    .filter((coords): coords is [number, number] => coords !== undefined);
}

// Helper to interpolate continuous vehicle position along multi-node polyline
export function interpolatePathPosition(
  coords: [number, number][],
  progress: number
): { lat: number; lon: number; bearing: number } {
  if (!coords || coords.length === 0) return { lat: 17.5, lon: 78.5, bearing: 0 };
  if (coords.length === 1) return { lat: coords[0][0], lon: coords[0][1], bearing: 0 };

  const segmentLengths: number[] = [];
  let totalDist = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const d = Math.hypot(
      (coords[i + 1][0] - coords[i][0]) * 111,
      (coords[i + 1][1] - coords[i][1]) * 105
    );
    segmentLengths.push(d);
    totalDist += d;
  }

  if (totalDist === 0) return { lat: coords[0][0], lon: coords[0][1], bearing: 0 };

  const targetDist = Math.max(0, Math.min(1, progress)) * totalDist;
  let accumulated = 0;

  for (let i = 0; i < segmentLengths.length; i++) {
    const segLen = segmentLengths[i];
    if (accumulated + segLen >= targetDist || i === segmentLengths.length - 1) {
      const localProgress = segLen > 0 ? (targetDist - accumulated) / segLen : 0;
      const lat = coords[i][0] + (coords[i + 1][0] - coords[i][0]) * localProgress;
      const lon = coords[i][1] + (coords[i + 1][1] - coords[i][1]) * localProgress;

      const dy = coords[i + 1][0] - coords[i][0];
      const dx = coords[i + 1][1] - coords[i][1];
      const rad = Math.atan2(dx, dy);
      const bearing = ((rad * 180) / Math.PI + 360) % 360;

      return { lat, lon, bearing };
    }
    accumulated += segLen;
  }

  const last = coords[coords.length - 1];
  return { lat: last[0], lon: last[1], bearing: 0 };
}

// 2. IN-TRANSIT VEHICLE TELEMETRY (Exact 15 records with True Multi-Node Graph Paths)
export const VEHICLE_TELEMETRY_RECORDS: VehicleTelemetryRecord[] = [
  {
    vehicleNo: 'TS09AB1001',
    vehicleType: 'Refrigerated Truck',
    businessId: 'BIZ01',
    product: 'Medical Supply Kit',
    capacityHeld: 72,
    totalCapacity: 100,
    utilization: 72.0,
    status: 'In Transit',
    lastUpdatedLocation: 'Jadcherla Junction (NH-44)',
    lastUpdatedTime: '2026-10-01 07:37:00',
    fromAddress: 'Shamshabad Logistics Park, Hyderabad',
    toAddress: 'Manali Industrial Area, Chennai',
    fromWarehouseId: 'WH02',
    toWarehouseId: 'WH03',
    lat: 16.7667,
    lon: 78.1333,
    progress: 0.20,
    bearing: 185,
    routePath: ['WH02', 'J-JA', 'J-KURNOOL', 'J-NANDYAL', 'J-CUDDAPAH', 'WH03'],
    alternatePath: ['WH02', 'J-JA', 'J-SURYAPET', 'WH07', 'J-GUNTUR', 'J-ONGOLE', 'J-NELLORE', 'WH03'],
  },
  {
    vehicleNo: 'TS10CD2045',
    vehicleType: 'Medium Box Truck',
    businessId: 'BIZ01',
    product: 'Medical Supply Kit',
    capacityHeld: 55,
    totalCapacity: 70,
    utilization: 78.6,
    status: 'In Transit',
    lastUpdatedLocation: 'Suryapet Junction (NH-65)',
    lastUpdatedTime: '2026-10-01 07:43:00',
    fromAddress: 'Shamshabad Logistics Park, Hyderabad',
    toAddress: 'Gannavaram Logistics Zone, Vijayawada',
    fromWarehouseId: 'WH02',
    toWarehouseId: 'WH07',
    lat: 17.1439,
    lon: 79.6239,
    progress: 0.50,
    bearing: 105,
    routePath: ['WH02', 'J-SURYAPET', 'WH07'],
  },
  {
    vehicleNo: 'TN09EF3112',
    vehicleType: 'Refrigerated Truck',
    businessId: 'BIZ02',
    product: 'Medical Supply Kit',
    capacityHeld: 68,
    totalCapacity: 90,
    utilization: 75.6,
    status: 'In Transit',
    lastUpdatedLocation: 'Kanchipuram Corridor (NH-48)',
    lastUpdatedTime: '2026-10-01 07:46:00',
    fromAddress: 'Manali Industrial Area, Chennai',
    toAddress: 'Oragadam Industrial Corridor, Chennai',
    fromWarehouseId: 'WH03',
    toWarehouseId: 'WH04',
    lat: 12.8342,
    lon: 79.7036,
    progress: 0.40,
    bearing: 220,
    routePath: ['WH03', 'J-KANCHIPURAM', 'WH04'],
  },
  {
    vehicleNo: 'TN12GH4488',
    vehicleType: 'Medium Box Truck',
    businessId: 'BIZ02',
    product: 'Medical Supply Kit',
    capacityHeld: 44,
    totalCapacity: 60,
    utilization: 73.3,
    status: 'In Transit',
    lastUpdatedLocation: 'Vellore Waypoint (NH-48)',
    lastUpdatedTime: '2026-10-01 07:50:00',
    fromAddress: 'Oragadam Industrial Corridor, Chennai',
    toAddress: 'Bengaluru East DC, Bengaluru',
    fromWarehouseId: 'WH04',
    toWarehouseId: 'WH05',
    lat: 12.9165,
    lon: 79.1325,
    progress: 0.45,
    bearing: 265,
    routePath: ['WH04', 'J-KANCHIPURAM', 'J-VELLORE', 'J-HOSUR', 'WH05'],
  },
  {
    vehicleNo: 'KA03JK5521',
    vehicleType: 'Refrigerated Truck',
    businessId: 'BIZ03',
    product: 'Medical Supply Kit',
    capacityHeld: 80,
    totalCapacity: 100,
    utilization: 80.0,
    status: 'In Transit',
    lastUpdatedLocation: 'Chikkaballapur (NH-44)',
    lastUpdatedTime: '2026-10-01 07:56:00',
    fromAddress: 'Whitefield Industrial Area, Bengaluru',
    toAddress: 'Yelahanka Logistics Zone, Bengaluru',
    fromWarehouseId: 'WH05',
    toWarehouseId: 'WH06',
    lat: 13.4325,
    lon: 77.7275,
    progress: 0.50,
    bearing: 315,
    routePath: ['WH05', 'J-CHIKKABALLAPUR', 'WH06'],
  },
  {
    vehicleNo: 'KA05LM6702',
    vehicleType: 'Heavy Truck',
    businessId: 'BIZ03',
    product: 'Medical Supply Kit',
    capacityHeld: 110,
    totalCapacity: 160,
    utilization: 68.8,
    status: 'In Transit',
    lastUpdatedLocation: 'Anantapur Transit (NH-44)',
    lastUpdatedTime: '2026-10-01 08:02:00',
    fromAddress: 'Yelahanka Logistics Zone, Bengaluru',
    toAddress: 'Hyderabad Central DC, Hyderabad',
    fromWarehouseId: 'WH06',
    toWarehouseId: 'WH01',
    lat: 14.6819,
    lon: 77.6006,
    progress: 0.40,
    bearing: 10,
    routePath: ['WH06', 'J-CHIKKABALLAPUR', 'J-ANANTAPUR', 'J-KURNOOL', 'J-JA', 'WH01'],
  },
  {
    vehicleNo: 'AP16NO7834',
    vehicleType: 'Medium Box Truck',
    businessId: 'BIZ04',
    product: 'Medical Supply Kit',
    capacityHeld: 52,
    totalCapacity: 70,
    utilization: 74.3,
    status: 'In Transit',
    lastUpdatedLocation: 'Rajahmundry Junction (NH-16)',
    lastUpdatedTime: '2026-10-01 08:09:00',
    fromAddress: 'Gannavaram Logistics Zone, Vijayawada',
    toAddress: 'Gajuwaka Industrial Area, Visakhapatnam',
    fromWarehouseId: 'WH07',
    toWarehouseId: 'WH08',
    lat: 17.0005,
    lon: 81.8040,
    progress: 0.45,
    bearing: 55,
    routePath: ['WH07', 'J-RAJAHMUNDRY', 'J-TUNI', 'WH08'],
    alternatePath: ['WH07', 'J-KHAMMAM', 'WH09', 'WH08'],
  },
  {
    vehicleNo: 'AP31PQ8456',
    vehicleType: 'Refrigerated Truck',
    businessId: 'BIZ04',
    product: 'Medical Supply Kit',
    capacityHeld: 75,
    totalCapacity: 100,
    utilization: 75.0,
    status: 'In Transit',
    lastUpdatedLocation: 'Tuni Express Corridor (NH-16)',
    lastUpdatedTime: '2026-10-01 08:16:00',
    fromAddress: 'Gajuwaka Industrial Area, Visakhapatnam',
    toAddress: 'Oragadam Industrial Corridor, Chennai',
    fromWarehouseId: 'WH08',
    toWarehouseId: 'WH04',
    lat: 17.3571,
    lon: 82.5518,
    progress: 0.20,
    bearing: 215,
    routePath: ['WH08', 'J-TUNI', 'J-RAJAHMUNDRY', 'WH07', 'J-GUNTUR', 'J-ONGOLE', 'J-NELLORE', 'WH04'],
  },
  {
    vehicleNo: 'TS12RS9107',
    vehicleType: 'Medium Box Truck',
    businessId: 'BIZ05',
    product: 'Medical Supply Kit',
    capacityHeld: 38,
    totalCapacity: 60,
    utilization: 63.3,
    status: 'In Transit',
    lastUpdatedLocation: 'Siddipet Junction (SH-1)',
    lastUpdatedTime: '2026-10-01 08:22:00',
    fromAddress: 'Kazipet Industrial Area, Warangal',
    toAddress: 'Shamshabad Logistics Park, Hyderabad',
    fromWarehouseId: 'WH09',
    toWarehouseId: 'WH02',
    lat: 18.1018,
    lon: 78.8521,
    progress: 0.50,
    bearing: 235,
    routePath: ['WH09', 'J-SIDDIPET', 'WH01', 'WH02'],
  },
  {
    vehicleNo: 'TS08TU1123',
    vehicleType: 'Heavy Truck',
    businessId: 'BIZ05',
    product: 'Medical Supply Kit',
    capacityHeld: 125,
    totalCapacity: 180,
    utilization: 69.4,
    status: 'In Transit',
    lastUpdatedLocation: 'Siddipet North Waypoint',
    lastUpdatedTime: '2026-10-01 08:28:00',
    fromAddress: 'Jeedimetla Industrial Area, Hyderabad',
    toAddress: 'Kazipet Industrial Area, Warangal',
    fromWarehouseId: 'WH01',
    toWarehouseId: 'WH09',
    lat: 18.1018,
    lon: 78.8521,
    progress: 0.50,
    bearing: 75,
    routePath: ['WH01', 'J-SIDDIPET', 'WH09'],
  },
  {
    vehicleNo: 'MH12VW2234',
    vehicleType: 'Refrigerated Truck',
    businessId: 'BIZ06',
    product: 'Medical Supply Kit',
    capacityHeld: 70,
    totalCapacity: 90,
    utilization: 77.8,
    status: 'In Transit',
    lastUpdatedLocation: 'Ahmednagar Junction (NH-160)',
    lastUpdatedTime: '2026-10-01 08:35:00',
    fromAddress: 'Chakan Industrial Area, Pune',
    toAddress: 'Jeedimetla Industrial Area, Hyderabad',
    fromWarehouseId: 'WH10',
    toWarehouseId: 'WH01',
    lat: 19.0952,
    lon: 74.7480,
    progress: 0.30,
    bearing: 115,
    routePath: ['WH10', 'J-AHMEDNAGAR', 'J-SOLAPUR', 'WH02', 'WH01'],
    alternatePath: ['WH10', 'J-SOLAPUR', 'WH02', 'WH01'],
  },
  {
    vehicleNo: 'MH14XY3345',
    vehicleType: 'Medium Box Truck',
    businessId: 'BIZ06',
    product: 'Medical Supply Kit',
    capacityHeld: 46,
    totalCapacity: 70,
    utilization: 65.7,
    status: 'In Transit',
    lastUpdatedLocation: 'Solapur Western Junction (NH-65)',
    lastUpdatedTime: '2026-10-01 08:42:00',
    fromAddress: 'Chakan Industrial Area, Pune',
    toAddress: 'Whitefield Industrial Area, Bengaluru',
    fromWarehouseId: 'WH10',
    toWarehouseId: 'WH05',
    lat: 17.6599,
    lon: 75.9064,
    progress: 0.35,
    bearing: 145,
    routePath: ['WH10', 'J-SOLAPUR', 'J-ANANTAPUR', 'J-CHIKKABALLAPUR', 'WH05'],
  },
  {
    vehicleNo: 'TS07ZA4456',
    vehicleType: 'Medium Box Truck',
    businessId: 'BIZ01',
    product: 'Medical Supply Kit',
    capacityHeld: 60,
    totalCapacity: 80,
    utilization: 75.0,
    status: 'In Transit',
    lastUpdatedLocation: 'Jadcherla Corridor (NH-44)',
    lastUpdatedTime: '2026-10-01 08:48:00',
    fromAddress: 'Shamshabad Logistics Park, Hyderabad',
    toAddress: 'Manali Industrial Area, Chennai',
    fromWarehouseId: 'WH02',
    toWarehouseId: 'WH03',
    lat: 16.7667,
    lon: 78.1333,
    progress: 0.18,
    bearing: 140,
    routePath: ['WH02', 'J-JA', 'J-KURNOOL', 'J-NANDYAL', 'J-CUDDAPAH', 'WH03'],
  },
  {
    vehicleNo: 'TN11BC5567',
    vehicleType: 'Heavy Truck',
    businessId: 'BIZ02',
    product: 'Medical Supply Kit',
    capacityHeld: 135,
    totalCapacity: 180,
    utilization: 75.0,
    status: 'In Transit',
    lastUpdatedLocation: 'Ongole Waypoint (NH-16)',
    lastUpdatedTime: '2026-10-01 08:54:00',
    fromAddress: 'Manali Industrial Area, Chennai',
    toAddress: 'Gannavaram Logistics Zone, Vijayawada',
    fromWarehouseId: 'WH03',
    toWarehouseId: 'WH07',
    lat: 15.5057,
    lon: 80.0499,
    progress: 0.45,
    bearing: 25,
    routePath: ['WH03', 'J-NELLORE', 'J-ONGOLE', 'J-GUNTUR', 'WH07'],
  },
  {
    vehicleNo: 'KA51DE6678',
    vehicleType: 'Refrigerated Truck',
    businessId: 'BIZ03',
    product: 'Medical Supply Kit',
    capacityHeld: 58,
    totalCapacity: 80,
    utilization: 72.5,
    status: 'In Transit',
    lastUpdatedLocation: 'Hosur Transit (NH-44)',
    lastUpdatedTime: '2026-10-01 09:00:00',
    fromAddress: 'Yelahanka Logistics Zone, Bengaluru',
    toAddress: 'Oragadam Industrial Corridor, Chennai',
    fromWarehouseId: 'WH06',
    toWarehouseId: 'WH04',
    lat: 12.7409,
    lon: 77.8253,
    progress: 0.35,
    bearing: 100,
    routePath: ['WH06', 'J-HOSUR', 'J-VELLORE', 'J-KANCHIPURAM', 'WH04'],
  },
];

// 3. LOGISTICS NETWORK FLOWS (15 Connected flows between origins and destinations)
export const NETWORK_FLOWS: NetworkFlowConnection[] = VEHICLE_TELEMETRY_RECORDS.map((v) => {
  const fromWh = WAREHOUSE_MAP_BY_ID.get(v.fromWarehouseId)!;
  const toWh = WAREHOUSE_MAP_BY_ID.get(v.toWarehouseId)!;
  return {
    id: `FLOW-${v.vehicleNo}`,
    vehicleNo: v.vehicleNo,
    fromWarehouseId: v.fromWarehouseId,
    toWarehouseId: v.toWarehouseId,
    fromCoords: [fromWh.lat, fromWh.lon],
    currentCoords: [v.lat, v.lon],
    toCoords: [toWh.lat, toWh.lon],
    flowLabel: `${fromWh.city} ➔ ${toWh.city}`,
    businessId: v.businessId,
    vehicleType: v.vehicleType,
  };
});

// 4. CALCULATED AGGREGATE PLATFORM KPIS
const totalInventory = WAREHOUSE_RECORDS.reduce((sum, w) => sum + w.inventory, 0);
const totalWarehouseCap = WAREHOUSE_RECORDS.reduce((sum, w) => sum + w.capacity, 0);
const totalHeld = VEHICLE_TELEMETRY_RECORDS.reduce((sum, v) => sum + v.capacityHeld, 0);
const totalFleetCap = VEHICLE_TELEMETRY_RECORDS.reduce((sum, v) => sum + v.totalCapacity, 0);

export const FIRSTMILE_LIVE_KPIS: LivePlatformKpis = {
  warehousesCount: 10,
  vehiclesInTransitCount: 15,
  productsCount: 1,
  productName: 'Medical Supply Kit',
  businessesCount: 6,
  totalInventoryUnits: totalInventory, // 2,630
  totalWarehouseCapacityUnits: totalWarehouseCap, // 8,850
  avgWarehouseUtilizationPct: +( (totalInventory / totalWarehouseCap) * 100 ).toFixed(1), // 29.7%
  totalCapacityHeldUnits: totalHeld, // 1,088
  totalFleetCapacityUnits: totalFleetCap, // 1,490
  fleetUtilizationPct: +( (totalHeld / totalFleetCap) * 100 ).toFixed(1), // 73.0%
  activeDisruptionsCount: 0,
  networkStatus: 'OPERATIONAL',
};

// 5. ANALYTICAL BREAKDOWNS FOR PERFORMANCE & ANALYTICS
export const VEHICLE_TYPE_BREAKDOWN = [
  { type: 'Refrigerated Truck', count: 6, capacityTotal: 560, heldTotal: 423, utilization: 75.5 },
  { type: 'Medium Box Truck', count: 6, capacityTotal: 410, heldTotal: 295, utilization: 72.0 },
  { type: 'Heavy Truck', count: 3, capacityTotal: 520, heldTotal: 370, utilization: 71.2 },
];

export const BUSINESS_FLEET_BREAKDOWN = [
  { businessId: 'BIZ01', vehiclesCount: 3, heldUnits: 187, totalCap: 250, utilization: 74.8 },
  { businessId: 'BIZ02', vehiclesCount: 3, heldUnits: 247, totalCap: 330, utilization: 74.8 },
  { businessId: 'BIZ03', vehiclesCount: 3, heldUnits: 248, totalCap: 340, utilization: 72.9 },
  { businessId: 'BIZ04', vehiclesCount: 2, heldUnits: 127, totalCap: 170, utilization: 74.7 },
  { businessId: 'BIZ05', vehiclesCount: 2, heldUnits: 163, totalCap: 240, utilization: 67.9 },
  { businessId: 'BIZ06', vehiclesCount: 2, heldUnits: 116, totalCap: 160, utilization: 72.5 },
];

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

// 2. IN-TRANSIT VEHICLE TELEMETRY (Exact 15 records)
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
    lastUpdatedLocation: 'LB Nagar, Hyderabad',
    lastUpdatedTime: '2026-10-01 07:37:00',
    fromAddress: 'Hyderabad Central DC, Hyderabad',
    toAddress: 'Shamshabad Logistics Park, Hyderabad',
    fromWarehouseId: 'WH01',
    toWarehouseId: 'WH02',
    lat: 17.3457,
    lon: 78.5522,
    progress: 0.65,
    bearing: 200,
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
    lastUpdatedLocation: 'Shamshabad, Hyderabad',
    lastUpdatedTime: '2026-10-01 07:43:00',
    fromAddress: 'Shamshabad Logistics Park, Hyderabad',
    toAddress: 'Gannavaram Logistics Zone, Vijayawada',
    fromWarehouseId: 'WH02',
    toWarehouseId: 'WH07',
    lat: 17.2500,
    lon: 78.6800,
    progress: 0.25,
    bearing: 105,
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
    lastUpdatedLocation: 'Tondiarpet, Chennai',
    lastUpdatedTime: '2026-10-01 07:46:00',
    fromAddress: 'Manali Industrial Area, Chennai',
    toAddress: 'Oragadam Industrial Corridor, Chennai',
    fromWarehouseId: 'WH03',
    toWarehouseId: 'WH04',
    lat: 13.1255,
    lon: 80.2925,
    progress: 0.35,
    bearing: 220,
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
    lastUpdatedLocation: 'Sriperumbudur, Chennai',
    lastUpdatedTime: '2026-10-01 07:50:00',
    fromAddress: 'Oragadam Industrial Corridor, Chennai',
    toAddress: 'Bengaluru East DC, Bengaluru',
    fromWarehouseId: 'WH04',
    toWarehouseId: 'WH05',
    lat: 12.9667,
    lon: 79.9500,
    progress: 0.20,
    bearing: 265,
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
    lastUpdatedLocation: 'Whitefield, Bengaluru',
    lastUpdatedTime: '2026-10-01 07:56:00',
    fromAddress: 'Whitefield Industrial Area, Bengaluru',
    toAddress: 'Yelahanka Logistics Zone, Bengaluru',
    fromWarehouseId: 'WH05',
    toWarehouseId: 'WH06',
    lat: 12.9800,
    lon: 77.7200,
    progress: 0.30,
    bearing: 315,
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
    lastUpdatedLocation: 'Nelamangala, Bengaluru',
    lastUpdatedTime: '2026-10-01 08:02:00',
    fromAddress: 'Yelahanka Logistics Zone, Bengaluru',
    toAddress: 'Hyderabad Central DC, Hyderabad',
    fromWarehouseId: 'WH06',
    toWarehouseId: 'WH01',
    lat: 13.0995,
    lon: 77.3926,
    progress: 0.15,
    bearing: 10,
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
    lastUpdatedLocation: 'Gannavaram, Vijayawada',
    lastUpdatedTime: '2026-10-01 08:09:00',
    fromAddress: 'Gannavaram Logistics Zone, Vijayawada',
    toAddress: 'Gajuwaka Industrial Area, Visakhapatnam',
    fromWarehouseId: 'WH07',
    toWarehouseId: 'WH08',
    lat: 16.5414,
    lon: 80.7981,
    progress: 0.10,
    bearing: 55,
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
    lastUpdatedLocation: 'Anakapalle, Visakhapatnam',
    lastUpdatedTime: '2026-10-01 08:16:00',
    fromAddress: 'Gajuwaka Industrial Area, Visakhapatnam',
    toAddress: 'Oragadam Industrial Corridor, Chennai',
    fromWarehouseId: 'WH08',
    toWarehouseId: 'WH04',
    lat: 17.6913,
    lon: 83.0039,
    progress: 0.18,
    bearing: 215,
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
    lastUpdatedLocation: 'Kazipet, Warangal',
    lastUpdatedTime: '2026-10-01 08:22:00',
    fromAddress: 'Kazipet Industrial Area, Warangal',
    toAddress: 'Shamshabad Logistics Park, Hyderabad',
    fromWarehouseId: 'WH09',
    toWarehouseId: 'WH02',
    lat: 17.9784,
    lon: 79.5218,
    progress: 0.15,
    bearing: 235,
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
    lastUpdatedLocation: 'Siddipet Road, Telangana',
    lastUpdatedTime: '2026-10-01 08:28:00',
    fromAddress: 'Jeedimetla Industrial Area, Hyderabad',
    toAddress: 'Kazipet Industrial Area, Warangal',
    fromWarehouseId: 'WH01',
    toWarehouseId: 'WH09',
    lat: 18.1018,
    lon: 78.8521,
    progress: 0.50,
    bearing: 75,
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
    lastUpdatedLocation: 'Chakan, Pune',
    lastUpdatedTime: '2026-10-01 08:35:00',
    fromAddress: 'Chakan Industrial Area, Pune',
    toAddress: 'Jeedimetla Industrial Area, Hyderabad',
    fromWarehouseId: 'WH10',
    toWarehouseId: 'WH01',
    lat: 18.7606,
    lon: 73.8567,
    progress: 0.10,
    bearing: 115,
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
    lastUpdatedLocation: 'Talegaon, Pune',
    lastUpdatedTime: '2026-10-01 08:42:00',
    fromAddress: 'Chakan Industrial Area, Pune',
    toAddress: 'Whitefield Industrial Area, Bengaluru',
    fromWarehouseId: 'WH10',
    toWarehouseId: 'WH05',
    lat: 18.7300,
    lon: 73.6800,
    progress: 0.15,
    bearing: 145,
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
    lastUpdatedLocation: 'Kukatpally, Hyderabad',
    lastUpdatedTime: '2026-10-01 08:48:00',
    fromAddress: 'Shamshabad Logistics Park, Hyderabad',
    toAddress: 'Manali Industrial Area, Chennai',
    fromWarehouseId: 'WH02',
    toWarehouseId: 'WH03',
    lat: 17.4849,
    lon: 78.4138,
    progress: 0.20,
    bearing: 140,
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
    lastUpdatedLocation: 'Chengalpattu, Chennai',
    lastUpdatedTime: '2026-10-01 08:54:00',
    fromAddress: 'Manali Industrial Area, Chennai',
    toAddress: 'Gannavaram Logistics Zone, Vijayawada',
    fromWarehouseId: 'WH03',
    toWarehouseId: 'WH07',
    lat: 12.6819,
    lon: 79.9888,
    progress: 0.25,
    bearing: 25,
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
    lastUpdatedLocation: 'Hosur Road, Bengaluru',
    lastUpdatedTime: '2026-10-01 09:00:00',
    fromAddress: 'Yelahanka Logistics Zone, Bengaluru',
    toAddress: 'Oragadam Industrial Corridor, Chennai',
    fromWarehouseId: 'WH06',
    toWarehouseId: 'WH04',
    lat: 12.8750,
    lon: 77.6500,
    progress: 0.30,
    bearing: 100,
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

import React, { useState, useEffect, useMemo } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Tooltip,
  Popup,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import {
  LogisticsNode,
  LogisticsRoute,
  MovingShipment,
  DisruptionAlert,
  RecoveryRecommendation,
  SimulationStep,
  ScenarioId,
} from '../services/indiaLogisticsService';
import {
  WAREHOUSE_RECORDS,
  VEHICLE_TELEMETRY_RECORDS,
  WarehouseRecord,
  VehicleTelemetryRecord,
} from '../services/firstMileData';
import {
  Maximize2,
  Loader2,
  CheckCircle2,
} from 'lucide-react';

interface IndiaLeafletMapProps {
  nodes: LogisticsNode[];
  routes: LogisticsRoute[];
  shipments: MovingShipment[];
  disruptions: DisruptionAlert[];
  recovery: RecoveryRecommendation;
  activeScenario: ScenarioId;
  selectedWarehouseId: string | null;
  selectedShipmentId: string;
  onSelectWarehouse: (id: string | null) => void;
  onSelectShipment: (id: string) => void;
  isSimulating: boolean;
  simulationProgress: number; // 0 to 100
  simulationSteps: SimulationStep[];
  candidateRoutesVisible: boolean;
}

// Controller to fly or fit camera to all 10 warehouses
const MapCameraController: React.FC<{ resetTrigger: number }> = ({ resetTrigger }) => {
  const map = useMap();
  useEffect(() => {
    // Bounds enclosing Pune [18.76, 73.85] to Visakhapatnam [17.69, 83.22] to Chennai [12.83, 80.26]
    const bounds = L.latLngBounds([
      [12.6, 73.5],
      [19.2, 83.5],
    ]);
    map.fitBounds(bounds, { padding: [30, 30], animate: true });
  }, [resetTrigger, map]);
  return null;
};

// 1. WAREHOUSE FACILITY MARKER ICON (10 Facilities)
function createWarehouseMarkerIcon(
  warehouse: WarehouseRecord,
  isSelected: boolean
) {
  const isLowLoad = warehouse.loadCategory === 'LOW LOAD';
  const isHighLoad = warehouse.loadCategory === 'HIGH LOAD';

  const badgeColor = isLowLoad
    ? 'bg-sky-100 text-sky-800 border-sky-300'
    : isHighLoad
    ? 'bg-amber-100 text-amber-800 border-amber-300'
    : 'bg-emerald-100 text-emerald-800 border-emerald-300';

  const ringStyle = isSelected
    ? 'ring-4 ring-blue-500 shadow-xl scale-110'
    : 'ring-1 ring-slate-900/30 shadow-md hover:scale-105';

  const html = `
    <div class="relative flex flex-col items-center select-none pointer-events-none transition-all duration-200">
      <div class="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center border-2 border-white ${ringStyle} pointer-events-none">
        <svg class="w-4 h-4 text-emerald-400 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M3 21h18M5 21V7l7-4 7 4v14M9 14h6v7H9z"></path>
        </svg>
      </div>
      <div class="mt-1 bg-white/95 backdrop-blur-xs px-2 py-0.5 rounded shadow-md border border-slate-200 text-center whitespace-nowrap pointer-events-none">
        <div class="text-[9.5px] font-black text-slate-900 leading-tight pointer-events-none">${warehouse.id} • ${warehouse.city}</div>
        <div class="text-[8px] font-mono font-bold leading-none mt-0.5 px-1 py-0.2 rounded border ${badgeColor} pointer-events-none">
          ${warehouse.currentLoad.toFixed(1)}% LOAD
        </div>
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'firstmile-warehouse-marker',
    iconSize: [84, 50],
    iconAnchor: [42, 16],
  });
}

// 2. MOVING VEHICLE TRUCK ICON BUILDER (15 In-Transit Vehicles)
function createVehicleTruckIcon(
  vehicle: VehicleTelemetryRecord,
  shipment: MovingShipment,
  isSelected: boolean,
  bearing: number
) {
  const isDelayed = shipment.status === 'DELAYED';
  const isRerouted = shipment.status === 'REROUTED';

  const bg = isDelayed
    ? 'bg-rose-600'
    : isRerouted
    ? 'bg-emerald-600'
    : vehicle.vehicleType === 'Refrigerated Truck'
    ? 'bg-blue-600'
    : vehicle.vehicleType === 'Heavy Truck'
    ? 'bg-purple-600'
    : 'bg-indigo-600';

  const ring = isSelected ? 'ring-4 ring-sky-400 shadow-xl scale-125' : 'ring-1 ring-white/80 shadow-md';

  const html = `
    <div class="relative flex items-center justify-center select-none pointer-events-none group">
      ${isDelayed ? '<div class="absolute -inset-2.5 rounded-full bg-rose-500/60 animate-ping pointer-events-none"></div>' : ''}
      
      <!-- Direction Pointer Arrow -->
      <div 
        style="transform: rotate(${bearing}deg);" 
        class="absolute -inset-1.5 flex items-start justify-center pointer-events-none transition-transform duration-200"
      >
        <div class="w-0 h-0 border-l-[3.5px] border-l-transparent border-r-[3.5px] border-r-transparent border-b-[7px] ${
          isDelayed ? 'border-b-rose-600' : isRerouted ? 'border-b-emerald-600' : 'border-b-blue-600'
        } drop-shadow pointer-events-none"></div>
      </div>

      <!-- Truck Container Badge -->
      <div class="w-7 h-7 rounded-full ${bg} ${ring} text-white flex items-center justify-center border-2 border-white transition-transform group-hover:scale-125 z-10 pointer-events-none">
        <span class="text-[11px] leading-none select-none pointer-events-none">🚚</span>
      </div>

      <!-- Quick Tooltip Pill -->
      <div class="absolute -bottom-5 bg-slate-900 text-white text-[8px] font-mono px-1.5 py-0.5 rounded shadow pointer-events-none whitespace-nowrap opacity-0 group-hover:opacity-100 transition z-20">
        ${vehicle.vehicleNo} (${vehicle.businessId})
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'firstmile-vehicle-marker',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

// 3. Disruption Roadblock Icon
function createRoadblockIcon(id: string) {
  const html = `
    <div class="relative flex items-center justify-center select-none cursor-pointer group">
      <div class="absolute -inset-2 rounded-full bg-rose-500/60 animate-ping"></div>
      <div class="w-8 h-8 rounded-full bg-rose-600 border-2 border-white shadow-2xl flex items-center justify-center text-white font-bold text-xs transition-transform group-hover:scale-110">
        ⛔
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: `roadblock-icon roadblock-${id}`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

// 4. Recovery Bypass Milestone Icon
function createRecoveryBypassIcon() {
  const html = `
    <div class="relative flex items-center justify-center select-none cursor-pointer group">
      <div class="absolute -inset-2 rounded-full bg-emerald-500/50 animate-ping"></div>
      <div class="w-7 h-7 rounded-full bg-emerald-600 border-2 border-white shadow-xl flex items-center justify-center text-white font-bold text-xs">
        ✓
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'recovery-bypass-icon',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

export const IndiaLeafletMap: React.FC<IndiaLeafletMapProps> = ({
  nodes,
  routes,
  shipments,
  disruptions,
  recovery,
  activeScenario,
  selectedWarehouseId,
  selectedShipmentId,
  onSelectWarehouse,
  onSelectShipment,
  isSimulating,
  simulationProgress,
  simulationSteps,
  candidateRoutesVisible,
}) => {
  const [resetCameraTrigger, setResetCameraTrigger] = useState(0);

  // Map of Warehouses by ID
  const warehouseMap = useMemo(() => {
    const map = new Map<string, WarehouseRecord>();
    for (const w of WAREHOUSE_RECORDS) {
      map.set(w.id, w);
    }
    return map;
  }, []);

  // Map of Vehicles by vehicleNo
  const vehicleMap = useMemo(() => {
    const map = new Map<string, VehicleTelemetryRecord>();
    for (const v of VEHICLE_TELEMETRY_RECORDS) {
      map.set(v.vehicleNo, v);
    }
    return map;
  }, []);

  // Active Disruptions
  const activeDisruptions = useMemo(
    () => disruptions.filter((d) => d.status === 'ACTIVE'),
    [disruptions]
  );
  const hasActiveDisruptions = activeDisruptions.length > 0;
  const isRerouted = shipments.some((s) => s.status === 'REROUTED');

  // Smooth Vehicle Animation Progress State
  const [progressState, setProgressState] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const v of VEHICLE_TELEMETRY_RECORDS) {
      init[v.vehicleNo] = v.progress;
    }
    return init;
  });

  // Re-sync on scenario switch
  useEffect(() => {
    const next: Record<string, number> = {};
    for (const v of VEHICLE_TELEMETRY_RECORDS) {
      next[v.vehicleNo] = v.progress;
    }
    setProgressState(next);
  }, [activeScenario]);

  // Smooth slow movement animation
  useEffect(() => {
    const interval = setInterval(() => {
      setProgressState((prev) => {
        const next = { ...prev };
        for (const s of shipments) {
          if (s.status === 'DELAYED') {
            next[s.id] = prev[s.id] || s.progress;
          } else if (s.status === 'REROUTED') {
            const cur = prev[s.id] !== undefined ? prev[s.id] : s.progress;
            next[s.id] = cur < 0.98 ? cur + 0.0006 : 0.98;
          } else {
            const cur = prev[s.id] !== undefined ? prev[s.id] : s.progress;
            next[s.id] = (cur + 0.0003) % 1.0;
          }
        }
        return next;
      });
    }, 60);

    return () => clearInterval(interval);
  }, [shipments]);

  // Calculate live moving position for a vehicle along its origin-to-destination corridor
  const getVehiclePosition = (
    _shipment: MovingShipment,
    vRecord: VehicleTelemetryRecord
  ): { lat: number; lon: number; bearing: number } => {
    const fromWh = warehouseMap.get(vRecord.fromWarehouseId);
    const toWh = warehouseMap.get(vRecord.toWarehouseId);

    if (!fromWh || !toWh) {
      return { lat: vRecord.lat, lon: vRecord.lon, bearing: vRecord.bearing };
    }

    const t = progressState[vRecord.vehicleNo] !== undefined
      ? progressState[vRecord.vehicleNo]
      : vRecord.progress;

    // Linear interpolation between From and To
    const lat = fromWh.lat + (toWh.lat - fromWh.lat) * t;
    const lon = fromWh.lon + (toWh.lon - fromWh.lon) * t;

    // Calculate heading angle
    const dy = toWh.lat - fromWh.lat;
    const dx = toWh.lon - fromWh.lon;
    const rad = Math.atan2(dx, dy);
    const bearing = ((rad * 180) / Math.PI + 360) % 360;

    return { lat, lon, bearing };
  };

  return (
    <div className="relative w-full h-full bg-slate-900 overflow-hidden select-none">
      <MapContainer
        center={[15.8, 79.2]}
        zoom={6}
        className="w-full h-full z-0"
        zoomControl={false}
      >
        <MapCameraController resetTrigger={resetCameraTrigger} />

        {/* Clean, High-Contrast OSM Tile Layer */}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          maxZoom={18}
        />

        {/* 1. LOGISTICS NETWORK FLOWS (15 Inter-Facility Flows) */}
        {routes.map((route) => {
          const fromNode = nodes.find((n) => n.id === route.fromId);
          const toNode = nodes.find((n) => n.id === route.toId);
          if (!fromNode || !toNode) return null;

          const isDisrupted = route.status === 'disrupted';
          const isRecommended = route.status === 'recommended';
          const isAlternate = route.isAlternate;

          if (isAlternate && !candidateRoutesVisible && !isRecommended) {
            return null;
          }

          let polyColor = '#0284c7'; // Active normal flow
          let polyWeight = 2.5;
          let polyOpacity = 0.65;
          let dashArray: string | undefined = undefined;

          if (isDisrupted) {
            polyColor = '#ef4444'; // Red dashed
            polyWeight = 4;
            polyOpacity = 0.95;
            dashArray = '8, 8';
          } else if (isRecommended) {
            polyColor = '#10b981'; // Bright green
            polyWeight = 4;
            polyOpacity = 0.95;
          } else if (isAlternate) {
            polyColor = '#94a3b8';
            polyWeight = 2;
            polyOpacity = 0.45;
            dashArray = '5, 5';
          }

          return (
            <Polyline
              key={route.id}
              positions={[
                [fromNode.lat, fromNode.lon],
                [toNode.lat, toNode.lon],
              ]}
              pathOptions={{
                color: polyColor,
                weight: polyWeight,
                opacity: polyOpacity,
                dashArray,
              }}
            >
              <Tooltip direction="center" opacity={0.9}>
                <div className="text-[11px] font-sans p-1">
                  <div className="font-bold text-slate-900">
                    Network Flow: {route.name}
                  </div>
                  <div className="text-slate-500 text-[10px] font-mono mt-0.5">
                    Distance: {route.distanceKm} km • Est: {route.estTimeHr}h
                  </div>
                  <div className="text-[9.5px] uppercase font-bold text-blue-600 mt-0.5">
                    Status: {route.status.toUpperCase()}
                  </div>
                </div>
              </Tooltip>
            </Polyline>
          );
        })}

        {/* 2. DISRUPTION ROADBLOCK MARKERS (Active only during simulated incidents) */}
        {activeDisruptions.map((disruption) => (
          <Marker
            key={disruption.id}
            position={disruption.coordinates}
            icon={createRoadblockIcon(disruption.id)}
          >
            <Popup autoClose={false} closeOnClick={false} offset={[0, -14]}>
              <div className="bg-slate-900 text-white p-3 rounded-xl border border-rose-500 shadow-2xl min-w-[210px] leading-tight select-none">
                <div className="flex items-center gap-1.5 text-rose-400 font-black text-xs uppercase tracking-wider pb-1.5 border-b border-rose-900/60 mb-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping"></span>
                  ROUTE DISRUPTED
                </div>
                <div className="font-mono font-bold text-white text-xs">
                  {disruption.blockedRouteName}
                </div>
                <div className="text-slate-300 text-[11px] mt-1">
                  {disruption.description}
                </div>
                <div className="mt-2 pt-1.5 border-t border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-400 text-[10px] uppercase font-bold">Severity:</span>
                  <span className="font-mono font-black text-rose-400 tracking-wider">
                    {disruption.severity}/5 ({disruption.capacityImpact})
                  </span>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* 3. RECOVERY BYPASS CONFIRMATION MARKER (Post-Recovery in Simulation) */}
        {isRerouted && (
          <Marker position={recovery.bypassCoords} icon={createRecoveryBypassIcon()}>
            <Popup offset={[0, -14]}>
              <div className="bg-slate-900 text-white p-3 rounded-xl border border-emerald-500 shadow-2xl min-w-[220px] leading-tight select-none">
                <div className="flex items-center gap-1.5 text-emerald-400 font-black text-xs uppercase tracking-wider pb-1.5 border-b border-emerald-900/60 mb-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                  REROUTED VIA AI SWARM
                </div>
                <div className="text-slate-200 text-xs font-sans">
                  Via: {recovery.viaJunctions}
                </div>
                <div className="text-emerald-300 text-[11px] mt-1 font-mono">
                  Delta: {recovery.travelTimeDelta} ({recovery.distanceDelta})
                </div>
              </div>
            </Popup>
          </Marker>
        )}

        {/* 4. EXACT 10 WAREHOUSE FACILITY MARKERS */}
        {WAREHOUSE_RECORDS.map((warehouse) => {
          const isSelected = selectedWarehouseId === warehouse.id;

          return (
            <Marker
              key={warehouse.id}
              position={[warehouse.lat, warehouse.lon]}
              icon={createWarehouseMarkerIcon(warehouse, isSelected)}
              eventHandlers={{
                click: () => onSelectWarehouse(isSelected ? null : warehouse.id),
              }}
            >
              {/* Detailed Real Dataset Warehouse Popup */}
              <Popup offset={[0, -18]}>
                <div className="p-3 bg-white text-slate-900 rounded-xl min-w-[240px] max-w-[270px] leading-tight select-none font-sans">
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-200 mb-2">
                    <span className="font-black text-xs text-slate-900 font-mono">
                      {warehouse.id} • {warehouse.city}
                    </span>
                    <span
                      className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded border ${
                        warehouse.loadCategory === 'LOW LOAD'
                          ? 'bg-sky-50 text-sky-700 border-sky-200'
                          : warehouse.loadCategory === 'HIGH LOAD'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}
                    >
                      {warehouse.loadCategory}
                    </span>
                  </div>

                  <div className="font-bold text-xs text-slate-800 leading-snug">
                    {warehouse.name}
                  </div>
                  <div className="text-[10.5px] text-slate-500 mt-0.5">
                    {warehouse.address}
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-slate-100 space-y-1.5 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 text-[10.5px]">Product SKU:</span>
                      <span className="font-semibold text-slate-800 text-[11px]">
                        {warehouse.product}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 text-[10.5px]">Inventory Units:</span>
                      <span className="font-mono font-bold text-slate-900">
                        {warehouse.inventory.toLocaleString()} / {warehouse.capacity.toLocaleString()}
                      </span>
                    </div>

                    {/* Load Percentage Progress Bar */}
                    <div>
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="text-slate-500 font-semibold uppercase">Current Load</span>
                        <span className="font-mono font-bold text-slate-900">
                          {warehouse.currentLoad.toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${warehouse.currentLoad}%` }}
                          className={`h-full rounded-full ${
                            warehouse.loadCategory === 'LOW LOAD'
                              ? 'bg-sky-500'
                              : warehouse.loadCategory === 'HIGH LOAD'
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                          }`}
                        ></div>
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-1">
                      <span className="text-slate-400 text-[10.5px]">Facility Status:</span>
                      <span className="font-bold text-emerald-600 flex items-center gap-1 text-[11px]">
                        <CheckCircle2 className="w-3 h-3" />
                        {warehouse.status}
                      </span>
                    </div>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* 5. EXACT 15 IN-TRANSIT VEHICLE TRUCK MARKERS */}
        {shipments.map((shp) => {
          const vRecord = vehicleMap.get(shp.id);
          if (!vRecord) return null;

          const pos = getVehiclePosition(shp, vRecord);
          const isSelected = shp.id === selectedShipmentId;

          return (
            <Marker
              key={shp.id}
              position={[pos.lat, pos.lon]}
              icon={createVehicleTruckIcon(vRecord, shp, isSelected, pos.bearing)}
              eventHandlers={{
                click: () => onSelectShipment(shp.id),
              }}
            >
              {/* Detailed Real Dataset Vehicle Popup */}
              <Popup offset={[0, -16]}>
                <div className="p-3 bg-white text-slate-900 rounded-xl min-w-[250px] max-w-[280px] leading-tight select-none font-sans">
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-200 mb-2">
                    <span className="font-mono font-black text-xs text-slate-900">
                      {vRecord.vehicleNo}
                    </span>
                    <span
                      className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded font-mono ${
                        shp.status === 'DELAYED'
                          ? 'bg-rose-100 text-rose-700 animate-pulse'
                          : shp.status === 'REROUTED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {shp.status === 'DELAYED' ? 'DELAYED' : vRecord.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 text-xs mb-2">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Vehicle Type</span>
                      <span className="font-bold text-slate-800 text-[11px] truncate block">
                        {vRecord.vehicleType}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Business ID</span>
                      <span className="font-mono font-bold text-purple-700 text-[11px] block">
                        {vRecord.businessId}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 space-y-1.5 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 text-[10.5px]">Product SKU:</span>
                      <span className="font-semibold text-slate-800 text-[11px]">
                        {vRecord.product}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 text-[10.5px]">Capacity Held:</span>
                      <span className="font-mono font-bold text-slate-900">
                        {vRecord.capacityHeld} / {vRecord.totalCapacity} units ({vRecord.utilization.toFixed(1)}%)
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 text-[10.5px]">Last Telemetry:</span>
                      <span className="font-semibold text-slate-700 text-[10.5px] truncate max-w-[150px]">
                        {vRecord.lastUpdatedLocation}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 text-[10.5px]">Updated At:</span>
                      <span className="font-mono text-slate-500 text-[10px]">
                        {vRecord.lastUpdatedTime.split(' ')[1]} IST
                      </span>
                    </div>

                    {/* Flow Route */}
                    <div className="mt-2 p-1.5 bg-slate-50 rounded-lg border border-slate-200/80 text-[10px] leading-tight">
                      <span className="text-slate-400 uppercase font-bold block mb-0.5">Network Flow</span>
                      <span className="text-slate-700 font-semibold truncate block">
                        {vRecord.fromAddress.split(',')[0]} ➔ {vRecord.toAddress.split(',')[0]}
                      </span>
                    </div>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* REROUTED TOAST BANNER (In Simulation Mode) */}
      {isRerouted && (
        <div className="absolute top-4 right-4 z-20 flex items-center gap-2.5 bg-emerald-950/95 backdrop-blur-md text-white px-3.5 py-2 rounded-2xl shadow-2xl border border-emerald-500 max-w-xs sm:max-w-sm">
          <div className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center font-bold text-xs shrink-0">
            ✓
          </div>
          <div className="text-left">
            <div className="text-xs font-black tracking-wider uppercase text-emerald-300">
              REROUTED SUCCESSFULLY
            </div>
            <div className="text-[10px] text-slate-200 font-mono leading-tight mt-0.5">
              Flow redirected via {recovery.viaJunctions}
            </div>
          </div>
        </div>
      )}

      {/* Map Camera Reset Button (Top-Left) */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-1.5 shadow-md">
        <button
          type="button"
          onClick={() => setResetCameraTrigger((c) => c + 1)}
          title="Fit 10 Facilities"
          className="w-8 h-8 rounded-lg bg-white hover:bg-slate-50 text-slate-700 flex items-center justify-center border border-slate-200 transition shadow-sm hover:shadow"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* In-Map Map Legend (Bottom-Left) */}
      <div className="absolute bottom-4 left-4 z-10 bg-white/95 backdrop-blur-md p-2.5 rounded-xl border border-slate-200 shadow-md text-xs space-y-1.5 max-w-[270px]">
        <div className="flex items-center gap-2 text-[10.5px]">
          <span className="w-5 h-0.5 bg-sky-600 inline-block"></span>
          <span className="text-slate-700 font-medium">Active Network Flow (15 In-Transit)</span>
        </div>
        {hasActiveDisruptions && (
          <div className="flex items-center gap-2 text-[10.5px]">
            <span className="w-5 h-0.5 bg-rose-500 border-b border-dashed inline-block"></span>
            <span className="text-rose-700 font-bold">Disrupted Corridor (Landslide/Collision)</span>
          </div>
        )}
        {isRerouted && (
          <div className="flex items-center gap-2 text-[10.5px]">
            <span className="w-5 h-0.5 bg-emerald-500 inline-block"></span>
            <span className="text-emerald-700 font-bold">Recommended Swarm Bypass</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-[10.5px]">
          <span className="w-3 h-3 rounded bg-slate-900 border border-white inline-block"></span>
          <span className="text-slate-700">10 Warehouse Nodes (WH01–WH10)</span>
        </div>
        <div className="flex items-center gap-2 text-[10.5px]">
          <span className="text-[11px]">🚚</span>
          <span className="text-slate-700">15 Real In-Transit Vehicles</span>
        </div>
      </div>

      {/* 6-Step Simulation Overlay Card */}
      {isSimulating && (
        <div className="absolute bottom-4 right-4 z-20 bg-slate-900/95 backdrop-blur-md p-3.5 rounded-2xl border border-blue-500/80 shadow-2xl text-white w-72 select-none">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
              Simulating Swarm Impact
            </span>
            <span className="text-xs font-mono font-bold text-white">
              {simulationProgress}%
            </span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mb-3">
            <div
              style={{ width: `${simulationProgress}%` }}
              className="bg-gradient-to-r from-blue-500 to-emerald-400 h-full rounded-full transition-all duration-300"
            ></div>
          </div>
          <div className="space-y-1 text-[11px] font-sans">
            {simulationSteps.map((s) => (
              <div key={s.stepNumber} className="flex items-center justify-between">
                <span
                  className={
                    s.status === 'completed'
                      ? 'text-emerald-400 font-medium'
                      : s.status === 'running'
                      ? 'text-white font-bold'
                      : 'text-slate-500'
                  }
                >
                  Step {s.stepNumber}: {s.title}
                </span>
                <span className="font-mono text-[10px]">
                  {s.status === 'completed' && '✓'}
                  {s.status === 'running' && '...'}
                  {s.status === 'pending' && '○'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

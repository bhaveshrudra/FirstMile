import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Maximize2,
  Loader2,
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

// Controller to fly or fit camera
const MapCameraController: React.FC<{ resetTrigger: number }> = ({ resetTrigger }) => {
  const map = useMap();
  useEffect(() => {
    map.setView([19.2, 79.2], 5, { animate: true });
  }, [resetTrigger, map]);
  return null;
};

// Auto-opener for Leaflet popups
const PopupAutoOpener: React.FC<{ markerRef: React.RefObject<L.Marker | null>; trigger: any }> = ({
  markerRef,
  trigger,
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      if (markerRef.current) {
        markerRef.current.openPopup();
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [markerRef, trigger]);
  return null;
};

// 1. NODE MARKER ICON BUILDER (Distinguishes: Warehouse, Junction, Supplier, Customer)
function createNodeMarkerIcon(
  node: LogisticsNode,
  isSelected: boolean,
  hasActiveDisruptions: boolean,
  isRerouted: boolean
) {
  // A. JUNCTION: Small circular node
  if (node.type === 'junction' || node.isJunction) {
    const isJ2 = node.id === 'J2';
    const isJ12 = node.id === 'J12';
    const isJ10 = node.id === 'J10';
    const isRecoveryJunction = ['J3', 'J4', 'J5', 'J6', 'J13'].includes(node.id);

    let circleBg = 'bg-blue-600';
    let ringClass = 'ring-2 ring-white';
    let pulseHtml = '';
    let labelExtra = '';

    if (hasActiveDisruptions && (isJ2 || isJ12 || isJ10)) {
      circleBg = 'bg-rose-600';
      ringClass = 'ring-2 ring-rose-400';
      pulseHtml = '<div class="absolute -inset-1.5 rounded-full bg-rose-500/60 animate-ping"></div>';
    } else if (isRecoveryJunction) {
      if (isRerouted) {
        circleBg = 'bg-emerald-500';
        ringClass = 'ring-2 ring-emerald-300';
        pulseHtml = '<div class="absolute -inset-1 rounded-full bg-emerald-400/40 animate-pulse"></div>';
        labelExtra = '<span class="text-emerald-400 ml-0.5">✓ BYPASS</span>';
      } else {
        circleBg = 'bg-teal-600';
        ringClass = 'ring-2 ring-teal-200';
      }
    }

    const html = `
      <div class="relative flex flex-col items-center select-none cursor-pointer group">
        ${pulseHtml}
        <div class="w-4 h-4 rounded-full ${circleBg} ${ringClass} shadow-md flex items-center justify-center transition-transform group-hover:scale-125">
          <div class="w-1.5 h-1.5 rounded-full bg-white"></div>
        </div>
        <div class="mt-0.5 bg-slate-900/90 text-white px-1.5 py-0.2 rounded shadow text-[9px] font-mono font-bold whitespace-nowrap pointer-events-none transition group-hover:opacity-100">
          ${node.name.split(' ')[0]} ${labelExtra}
        </div>
      </div>
    `;

    return L.divIcon({
      html,
      className: 'india-junction-marker',
      iconSize: [50, 30],
      iconAnchor: [25, 8],
    });
  }

  // B. WAREHOUSE: Large prominent hub icon
  if (node.type === 'warehouse') {
    const borderRing = isSelected
      ? 'ring-4 ring-sky-400 border-white'
      : 'border-2 border-white ring-1 ring-slate-900/20';

    const html = `
      <div class="relative flex flex-col items-center select-none cursor-pointer transition-transform hover:scale-110">
        <div class="w-8 h-8 rounded-xl bg-slate-900 shadow-xl flex items-center justify-center text-white ${borderRing}">
          <svg class="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M3 21h18M5 21V7l7-4 7 4v14M9 14h6v7H9z"></path>
          </svg>
        </div>
        <div class="mt-1 bg-white/95 px-2 py-0.5 rounded shadow border border-slate-200 text-center whitespace-nowrap pointer-events-none">
          <div class="text-[10px] font-black text-slate-900 leading-tight">${node.name}</div>
          <div class="text-[8.5px] font-mono text-emerald-600 font-bold leading-none mt-0.5">${node.city} • HUB</div>
        </div>
      </div>
    `;

    return L.divIcon({
      html,
      className: 'india-warehouse-marker',
      iconSize: [90, 52],
      iconAnchor: [45, 16],
    });
  }

  // C. SUPPLIER: Square icon
  if (node.type === 'supplier') {
    const html = `
      <div class="relative flex flex-col items-center select-none cursor-pointer transition-transform hover:scale-110">
        <div class="w-7 h-7 rounded-lg bg-blue-600 shadow-lg flex items-center justify-center text-white border-2 border-white">
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <rect x="3" y="3" width="18" height="18" rx="2" stroke-width="2.5"></rect>
            <path d="M3 9h18M9 21V9" stroke-width="2"></path>
          </svg>
        </div>
        <div class="mt-1 bg-white/95 px-1.5 py-0.5 rounded shadow border border-slate-200 text-center whitespace-nowrap pointer-events-none">
          <div class="text-[10px] font-bold text-slate-800 leading-tight">${node.name}</div>
          <div class="text-[8.5px] font-mono text-blue-600 font-semibold leading-none mt-0.5">${node.city} • SUPPLIER</div>
        </div>
      </div>
    `;

    return L.divIcon({
      html,
      className: 'india-supplier-marker',
      iconSize: [90, 48],
      iconAnchor: [45, 14],
    });
  }

  // D. CUSTOMER: Destination pin marker
  const html = `
    <div class="relative flex flex-col items-center select-none cursor-pointer transition-transform hover:scale-110">
      <div class="w-7 h-7 rounded-full bg-purple-600 shadow-lg flex items-center justify-center text-white border-2 border-white">
        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"></path>
          <circle cx="12" cy="10" r="3" stroke-width="2"></circle>
        </svg>
      </div>
      <div class="mt-1 bg-white/95 px-1.5 py-0.5 rounded shadow border border-slate-200 text-center whitespace-nowrap pointer-events-none">
        <div class="text-[10px] font-bold text-slate-800 leading-tight">${node.name}</div>
        <div class="text-[8.5px] font-mono text-purple-600 font-semibold leading-none mt-0.5">${node.city} • CUSTOMER</div>
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'india-customer-marker',
    iconSize: [90, 48],
    iconAnchor: [45, 14],
  });
}

// 2. MOVING SHIPMENT TRUCK ICON BUILDER (With Direction/Bearing Arrow)
function createShipmentTruckIcon(
  shipment: MovingShipment,
  isSelected: boolean,
  bearing: number
) {
  const isDelayed = shipment.status === 'DELAYED';
  const isRerouted = shipment.status === 'REROUTED';

  const bg = isDelayed ? 'bg-rose-600' : isRerouted ? 'bg-emerald-600' : 'bg-blue-600';
  const ring = isSelected ? 'ring-4 ring-sky-300' : '';

  const html = `
    <div class="relative flex items-center justify-center select-none cursor-pointer group">
      ${isDelayed ? '<div class="absolute -inset-2 rounded-full bg-rose-500/60 animate-ping"></div>' : ''}
      
      <!-- Direction Pointer Arrow -->
      <div 
        style="transform: rotate(${bearing}deg);" 
        class="absolute -inset-1.5 flex items-start justify-center pointer-events-none transition-transform duration-200"
      >
        <div class="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[8px] ${
          isDelayed ? 'border-b-rose-600' : isRerouted ? 'border-b-emerald-600' : 'border-b-blue-600'
        } drop-shadow"></div>
      </div>

      <!-- Truck Container Icon -->
      <div class="w-7 h-7 rounded-full shadow-lg ${bg} ${ring} text-white flex items-center justify-center border-2 border-white transition-transform group-hover:scale-125 z-10">
        <span class="text-[12px] leading-none select-none">🚚</span>
      </div>

      <!-- Status Pill Tooltip -->
      <div class="absolute -bottom-5 bg-slate-900/90 text-white text-[8.5px] font-mono px-1.5 py-0.5 rounded shadow pointer-events-none whitespace-nowrap opacity-0 group-hover:opacity-100 transition z-20">
        ${shipment.id} • ${shipment.status}
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'shipment-truck-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

// 3. Disruption Blocked Roadblock Anchor Icon
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
    className: `roadblock-anchor-icon roadblock-${id}`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

// 4. Rerouting Complete Check Anchor Icon
function createRerouteCheckIcon() {
  const html = `
    <div class="relative flex items-center justify-center select-none cursor-pointer group">
      <div class="absolute -inset-2 rounded-full bg-emerald-500/60 animate-ping"></div>
      <div class="w-8 h-8 rounded-full bg-emerald-600 border-2 border-white shadow-2xl flex items-center justify-center text-white font-bold text-xs transition-transform group-hover:scale-110">
        ✓
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'reroute-anchor-icon',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
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

  // Auto-opener refs
  const primaryRoadblockRef = useRef<L.Marker | null>(null);
  const reroutePopupMarkerRef = useRef<L.Marker | null>(null);

  // Map of Node ID to Object
  const nodeMap = useMemo(() => {
    const m = new Map<string, LogisticsNode>();
    for (const n of nodes) {
      m.set(n.id, n);
    }
    return m;
  }, [nodes]);

  // Active Disrupted State
  const activeDisruptions = useMemo(
    () => disruptions.filter((d) => d.status === 'ACTIVE'),
    [disruptions]
  );
  const hasActiveDisruptions = activeDisruptions.length > 0;

  const isRerouted = shipments.some((s) => s.status === 'REROUTED');

  // Animated truck positions along routes
  const [progressState, setProgressState] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const s of shipments) {
      init[s.id] = s.progress;
    }
    return init;
  });

  // Re-sync progress state on scenario changes
  useEffect(() => {
    const next: Record<string, number> = {};
    for (const s of shipments) {
      next[s.id] = s.progress;
    }
    setProgressState(next);
  }, [activeScenario, shipments]);

  // Smooth animation loop for shipments
  useEffect(() => {
    const interval = setInterval(() => {
      setProgressState((prev) => {
        const next = { ...prev };
        for (const s of shipments) {
          if (s.status === 'DELAYED') {
            // Paused at the upstream checkpoint before the disruption
            next[s.id] = s.progress;
          } else if (s.status === 'REROUTED') {
            // Smooth movement along bypass route
            const cur = prev[s.id] !== undefined ? prev[s.id] : s.progress;
            if (cur < 0.99) {
              next[s.id] = cur + 0.0008;
            } else {
              next[s.id] = 1.0;
            }
          } else {
            // Active nominal shipments move slowly
            const cur = prev[s.id] !== undefined ? prev[s.id] : s.progress;
            next[s.id] = (cur + 0.0005) % 1.0;
          }
        }
        return next;
      });
    }, 50);

    return () => clearInterval(interval);
  }, [shipments]);

  // Interpolate lat/lon and calculate bearing angle & current corridor
  const getShipmentPosition = (
    shipment: MovingShipment
  ): { lat: number; lon: number; bearing: number; currentCorridor: string } => {
    const pathNodes = shipment.routePath
      .map((id) => nodeMap.get(id))
      .filter((n): n is LogisticsNode => !!n);

    if (pathNodes.length < 2) {
      const single = pathNodes[0] || nodes[0];
      return {
        lat: single.lat,
        lon: single.lon,
        bearing: 0,
        currentCorridor: 'Stationary',
      };
    }

    const t = progressState[shipment.id] !== undefined ? progressState[shipment.id] : shipment.progress;

    // Calculate cumulative segment distances
    const segments: { from: LogisticsNode; to: LogisticsNode; dist: number }[] = [];
    let totalDist = 0;
    for (let i = 0; i < pathNodes.length - 1; i++) {
      const u = pathNodes[i];
      const v = pathNodes[i + 1];
      const d = Math.hypot(v.lat - u.lat, v.lon - u.lon);
      segments.push({ from: u, to: v, dist: d });
      totalDist += d;
    }

    const targetDist = Math.max(0, Math.min(1, t)) * totalDist;
    let accumulated = 0;

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const isLast = i === segments.length - 1;
      if (accumulated + seg.dist >= targetDist || isLast) {
        const segT = seg.dist > 0 ? (targetDist - accumulated) / seg.dist : 0;
        const clampedT = Math.max(0, Math.min(1, segT));
        const lat = seg.from.lat + (seg.to.lat - seg.from.lat) * clampedT;
        const lon = seg.from.lon + (seg.to.lon - seg.from.lon) * clampedT;

        // Bearing calculation in degrees (0° North, 90° East, 180° South, 270° West)
        const dy = seg.to.lat - seg.from.lat;
        const dx = seg.to.lon - seg.from.lon;
        const rad = Math.atan2(dx, dy);
        const bearing = ((rad * 180) / Math.PI + 360) % 360;

        const currentCorridor = `${seg.from.name.split(' ')[0]} ➔ ${seg.to.name.split(' ')[0]}`;
        return { lat, lon, bearing, currentCorridor };
      }
      accumulated += seg.dist;
    }

    return {
      lat: pathNodes[0].lat,
      lon: pathNodes[0].lon,
      bearing: 0,
      currentCorridor: 'In Transit',
    };
  };

  // Route Polyline Style determination: Supports Disrupted (🔴), Impacted (🟠), Recommended (🟢), Candidate (⚪), Active (🔵)
  const getRouteStyle = (route: LogisticsRoute) => {
    // 1. Disrupted Route: Red dashed with pulse effect (🔴 DISRUPTED)
    if (route.status === 'disrupted') {
      return {
        color: '#ef4444',
        weight: 4.5,
        dashArray: '8, 8',
        opacity: 0.95,
        className: 'disrupted-route-pulse',
      };
    }

    // 2. Impacted Route: Amber / Orange dashed with congested pulse (🟠 IMPACTED)
    if (route.status === 'impacted') {
      return {
        color: '#f59e0b',
        weight: 4.0,
        dashArray: '6, 6',
        opacity: 0.9,
        className: 'impacted-route-congested',
      };
    }

    // 3. Recommended / Recovery Route: Bright Green with marching-dash flow (🟢 AVAILABLE / RECOVERY)
    if (route.status === 'recommended') {
      if (isRerouted) {
        return {
          color: '#10b981',
          weight: 5.5,
          opacity: 1.0,
          className: 'recovery-route-flow',
        };
      }
      return {
        color: '#10b981',
        weight: 4.5,
        dashArray: '6, 6',
        opacity: 0.95,
      };
    }

    // 4. Candidate Alternate Route: Gray dashed
    if (route.status === 'candidate' || route.candidateGroup === 'B') {
      return {
        color: '#94a3b8',
        weight: 2.5,
        dashArray: '6, 6',
        opacity: 0.65,
      };
    }

    // 5. Warehouse selection highlight
    if (selectedWarehouseId) {
      if (route.fromId === selectedWarehouseId || route.toId === selectedWarehouseId) {
        return { color: '#0284c7', weight: 4.0, opacity: 0.95 };
      }
      return { color: '#cbd5e1', weight: 1.5, opacity: 0.4 };
    }

    // 6. Active Trunk Route: Solid Blue
    return {
      color: '#2563eb',
      weight: 3.5,
      opacity: 0.85,
    };
  };

  // Filter routes: in NORMAL state, keep alternate recovery corridors hidden
  const visibleRoutes = useMemo(() => {
    return routes.filter((r) => {
      if (r.isAlternate) {
        // In NORMAL state without simulation, alternate candidate corridors stay hidden
        if (activeScenario === 'NORMAL' && !isSimulating && !candidateRoutesVisible) {
          return false;
        }
        return candidateRoutesVisible || isSimulating || isRerouted || hasActiveDisruptions;
      }
      return true;
    });
  }, [routes, activeScenario, candidateRoutesVisible, isSimulating, isRerouted, hasActiveDisruptions]);

  // Filter nodes: in NORMAL state, keep candidate alternate junctions hidden
  const visibleNodes = useMemo(() => {
    return nodes.filter((n) => {
      if (n.isJunction) {
        const isCandidateJunction = ['J3', 'J4', 'J5', 'J6', 'J7', 'J8', 'J9', 'J13'].includes(n.id);
        if (isCandidateJunction && activeScenario === 'NORMAL' && !isSimulating && !candidateRoutesVisible) {
          return false;
        }
      }
      return true;
    });
  }, [nodes, activeScenario, candidateRoutesVisible, isSimulating]);

  return (
    <div className="relative w-full h-full bg-slate-100 overflow-hidden select-none">
      {/* React-Leaflet Map */}
      <MapContainer
        center={[19.2, 79.2]}
        zoom={5}
        scrollWheelZoom={true}
        zoomControl={false}
        className="w-full h-full z-0"
      >
        <MapCameraController resetTrigger={resetCameraTrigger} />

        {/* OpenStreetMap Base Layer */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={18}
        />

        {/* 1. Multimodal Route Corridors (Trunks + Multi-Junction Branching Vectors) */}
        {visibleRoutes.map((route) => {
          const fromNode = nodeMap.get(route.fromId);
          const toNode = nodeMap.get(route.toId);
          if (!fromNode || !toNode) return null;

          const positions: [number, number][] = [
            [fromNode.lat, fromNode.lon],
            [toNode.lat, toNode.lon],
          ];

          const style = getRouteStyle(route);

          return (
            <Polyline
              key={route.id}
              positions={positions}
              pathOptions={{
                color: style.color,
                weight: style.weight,
                dashArray: style.dashArray,
                opacity: style.opacity,
                className: style.className,
              }}
            >
              <Tooltip sticky direction="top" opacity={0.95}>
                <div className="text-xs p-1">
                  <div className="font-bold text-slate-900">{route.name}</div>
                  <div className="text-slate-600 font-mono text-[11px]">
                    {route.distanceKm} km • Est: {route.estTimeHr}h
                  </div>
                  <div className="text-[10px] font-mono mt-0.5">
                    {route.status === 'disrupted' ? (
                      <span className="text-rose-600 font-bold">⛔ BLOCKED (Disrupted)</span>
                    ) : route.status === 'impacted' ? (
                      <span className="text-amber-600 font-bold">⚠️ CONGESTED (Impacted)</span>
                    ) : route.status === 'recommended' ? (
                      <span className="text-emerald-600 font-bold">✓ Selected AI Recovery Corridor</span>
                    ) : route.status === 'candidate' ? (
                      <span className="text-slate-500 font-bold">Candidate Alternate Corridor</span>
                    ) : (
                      <span className="text-blue-600 font-semibold">Active Operational Corridor</span>
                    )}
                  </div>
                </div>
              </Tooltip>
            </Polyline>
          );
        })}

        {/* 2. EXACT LEAFLET POPUP ON DISRUPTED EDGES (Requirement: Kurnool Road Disruption) */}
        {activeDisruptions.map((disruption, idx) => {
          // Compute dynamic midpoint strictly from edge endpoints (fromNode & toNode)
          const blockedRoute = routes.find((r) => r.id === disruption.blockedRouteId);
          const fromNode = blockedRoute ? nodeMap.get(blockedRoute.fromId) : null;
          const toNode = blockedRoute ? nodeMap.get(blockedRoute.toId) : null;
          const markerPos: [number, number] =
            fromNode && toNode
              ? [(fromNode.lat + toNode.lat) / 2, (fromNode.lon + toNode.lon) / 2]
              : disruption.coordinates;

          return (
            <Marker
              key={disruption.id}
              ref={idx === 0 ? primaryRoadblockRef : undefined}
              position={markerPos}
              icon={createRoadblockIcon(disruption.id)}
              eventHandlers={{
                add: (e) => {
                  setTimeout(() => e.target.openPopup(), 100);
                },
              }}
            >
              <Popup
                autoClose={false}
                closeOnClick={false}
                autoPan={false}
                offset={[0, -16]}
                className="leaflet-popup-custom"
              >
                <div className="bg-slate-900 text-white p-3 rounded-xl border border-rose-500 shadow-2xl min-w-[210px] leading-tight">
                  {/* Header: ROUTE DISRUPTED */}
                  <div className="flex items-center gap-1.5 text-rose-400 font-black text-xs uppercase tracking-wider pb-1.5 border-b border-rose-900/60 mb-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping"></span>
                    ROUTE DISRUPTED
                  </div>
                  <div className="font-mono font-bold text-white text-xs">
                    {disruption.blockedRouteName}
                  </div>
                  <div className="text-slate-400 text-xs font-medium mt-0.5">
                    Kurnool corridor
                  </div>
                  <div className="text-rose-300 text-xs mt-1">
                    Cause: {disruption.disruptionType}
                  </div>
                  <div className="mt-2 pt-1.5 border-t border-slate-800 flex items-center justify-between text-xs">
                    <span className="text-slate-400 text-[10px] uppercase font-bold">Status:</span>
                    <span className="font-mono font-black text-rose-400 tracking-wider">BLOCKED</span>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
        <PopupAutoOpener markerRef={primaryRoadblockRef} trigger={`${activeScenario}-${hasActiveDisruptions}`} />

        {/* 3. EXACT LEAFLET POPUP AFTER RECOVERY: REROUTED */}
        {isRerouted && (
          <Marker
            ref={reroutePopupMarkerRef}
            position={recovery.bypassCoords}
            icon={createRerouteCheckIcon()}
            eventHandlers={{
              add: (e) => {
                setTimeout(() => e.target.openPopup(), 100);
              },
            }}
          >
            <Popup
              autoClose={false}
              closeOnClick={false}
              autoPan={false}
              offset={[0, -16]}
              className="leaflet-popup-custom"
            >
              <div className="bg-slate-900 text-white p-3 rounded-xl border border-emerald-500 shadow-2xl min-w-[230px] leading-tight">
                {/* Header: REROUTED */}
                <div className="flex items-center gap-1.5 text-emerald-400 font-black text-xs uppercase tracking-wider pb-1.5 border-b border-emerald-900/60 mb-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                  REROUTED
                </div>
                <div className="text-slate-200 text-xs font-sans mt-1">
                  Via: {recovery.viaJunctions}
                </div>
                <div className="mt-2 pt-1.5 border-t border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-400 text-[10px] uppercase font-bold">Status:</span>
                  <span className="font-mono font-black text-emerald-400 tracking-wider">ACTIVE</span>
                </div>
              </div>
            </Popup>
          </Marker>
        )}
        <PopupAutoOpener markerRef={reroutePopupMarkerRef} trigger={isRerouted} />

        {/* 4. Node Markers (Warehouse, Junction, Supplier, Customer) */}
        {visibleNodes.map((node) => {
          const isSelected = selectedWarehouseId === node.id;
          return (
            <Marker
              key={node.id}
              position={[node.lat, node.lon]}
              icon={createNodeMarkerIcon(node, isSelected, hasActiveDisruptions, isRerouted)}
              eventHandlers={{
                click: () => {
                  if (node.type === 'warehouse') {
                    onSelectWarehouse(isSelected ? null : node.id);
                  }
                },
              }}
            >
              <Tooltip direction="top" offset={[0, -20]}>
                <div className="text-xs p-1">
                  <div className="font-bold">{node.name} • {node.city}</div>
                  <div className="text-slate-500 uppercase text-[10px] font-mono">{node.type}</div>
                  {node.capacity && (
                    <div className="text-slate-600 text-[11px] font-mono">
                      Capacity: {node.capacity.toLocaleString()} units
                    </div>
                  )}
                </div>
              </Tooltip>
            </Marker>
          );
        })}

        {/* 5. Animated Moving Shipments (Trucks with direction/bearing indicators) */}
        {shipments.map((shp) => {
          const pos = getShipmentPosition(shp);
          const isSelected = shp.id === selectedShipmentId;

          return (
            <Marker
              key={shp.id}
              position={[pos.lat, pos.lon]}
              icon={createShipmentTruckIcon(shp, isSelected, pos.bearing)}
              eventHandlers={{
                click: () => onSelectShipment(shp.id),
              }}
            >
              <Tooltip direction="top" offset={[0, -18]} opacity={0.95}>
                <div className="text-xs p-1.5 font-mono min-w-[190px]">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-1 mb-1">
                    <span className="font-black text-slate-900">{shp.id}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                      shp.status === 'DELAYED'
                        ? 'bg-rose-100 text-rose-700'
                        : shp.status === 'REROUTED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {shp.status}
                    </span>
                  </div>
                  <div className="text-slate-600 text-[11px]">{shp.orderId} • {shp.sku} ({shp.quantity} units)</div>
                  <div className="text-slate-500 text-[10px] mt-1 pt-1 border-t border-slate-100">
                    <span className="font-semibold text-slate-700">Corridor:</span> {pos.currentCorridor}
                  </div>
                  <div className="text-slate-500 text-[10px]">
                    <span className="font-semibold text-slate-700">ETA:</span> {shp.eta}
                  </div>
                </div>
              </Tooltip>
            </Marker>
          );
        })}
      </MapContainer>

      {/* REROUTED SUCCESSFULLY Toast Banner */}
      {isRerouted && (
        <div className="absolute top-4 right-4 z-20 flex items-center gap-2.5 bg-emerald-950/95 backdrop-blur-md text-white px-3.5 py-2 rounded-2xl shadow-2xl border border-emerald-500 animate-in fade-in slide-in-from-top-2 max-w-xs sm:max-w-sm">
          <div className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center font-bold text-xs shrink-0">
            ✓
          </div>
          <div className="text-left">
            <div className="text-xs font-black tracking-wider uppercase text-emerald-300">
              REROUTED SUCCESSFULLY
            </div>
            <div className="text-[10px] text-slate-200 font-mono leading-tight mt-0.5">
              Consignment redirected via {recovery.viaJunctions}
            </div>
          </div>
        </div>
      )}

      {/* Map Control Buttons (Top-Left) */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-1.5 shadow-md">
        <button
          type="button"
          onClick={() => setResetCameraTrigger((c) => c + 1)}
          title="Fit Network"
          className="w-8 h-8 rounded-lg bg-white hover:bg-slate-50 text-slate-700 flex items-center justify-center border border-slate-200 transition shadow-sm hover:shadow"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* In-Map Legend Overlay (Bottom-Left) */}
      <div className="absolute bottom-4 left-4 z-10 bg-white/95 backdrop-blur-md p-3 rounded-xl border border-slate-200 shadow-md text-xs space-y-1.5 max-w-[280px]">
        <div className="flex items-center gap-2">
          <span className="w-6 h-0.5 bg-blue-600 inline-block"></span>
          <span className="text-slate-700 font-medium">Route D 🟢 AVAILABLE / Active Trunk</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-6 h-0.5 border-b-2 border-dashed border-emerald-500 inline-block"></span>
          <span className="text-slate-700 font-medium flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
            Recommended Recovery Flow
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-6 h-0.5 border-b-2 border-dashed border-amber-500 inline-block"></span>
          <span className="text-amber-700 font-medium flex items-center gap-1">
            <span>⚠️</span> Route B 🟠 IMPACTED (Congested)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-6 h-0.5 border-b-2 border-dashed border-rose-500 inline-block"></span>
          <span className="text-rose-600 font-bold flex items-center gap-1">
            <span>⛔</span> Route A/C 🔴 DISRUPTED (Blocked)
          </span>
        </div>
        <div className="pt-1.5 border-t border-slate-200 grid grid-cols-2 gap-x-2 gap-y-1 text-[10px]">
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-blue-600 inline-block"></span>
            <span className="text-slate-600">Supplier</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-slate-900 inline-block"></span>
            <span className="text-slate-600">Warehouse Hub</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-600 inline-block"></span>
            <span className="text-slate-600">Junction Node</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-600 inline-block"></span>
            <span className="text-slate-600">Customer</span>
          </div>
        </div>
      </div>

      {/* FLOATING "SIMULATION RUNNING" OVERLAY (Requirement 5: 6-Step Visual Simulation) */}
      {isSimulating && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 w-[420px] max-w-[90vw] bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-sky-200 p-4 transition-all animate-in fade-in">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-sky-600 animate-spin" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Quantum Swarm Simulation Running
              </span>
            </div>
            <span className="text-xs font-mono font-bold text-sky-700">
              {Math.round(simulationProgress)}%
            </span>
          </div>

          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden mb-3">
            <div
              className="bg-gradient-to-r from-sky-600 to-blue-600 h-full transition-all duration-300"
              style={{ width: `${simulationProgress}%` }}
            ></div>
          </div>

          <div className="space-y-1.5 text-xs">
            {simulationSteps.map((st) => (
              <div
                key={st.stepNumber}
                className="flex items-center justify-between py-0.5 text-slate-700"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-slate-400 font-bold text-[10px]">
                    STEP {st.stepNumber}
                  </span>
                  <span
                    className={`font-semibold text-[11px] ${
                      st.status === 'completed'
                        ? 'text-emerald-700'
                        : st.status === 'running'
                        ? 'text-sky-700 font-bold'
                        : 'text-slate-400'
                    }`}
                  >
                    {st.title}
                  </span>
                </div>

                <div>
                  {st.status === 'completed' && (
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                      ✓ Done
                    </span>
                  )}
                  {st.status === 'running' && (
                    <span className="text-[10px] font-bold text-sky-600 bg-sky-50 px-1.5 py-0.2 rounded border border-sky-200 flex items-center gap-1">
                      <Loader2 className="w-2.5 h-2.5 animate-spin" /> In progress
                    </span>
                  )}
                  {st.status === 'pending' && (
                    <span className="text-[10px] font-mono text-slate-400">Waiting</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};

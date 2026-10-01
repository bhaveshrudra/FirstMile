import React, { useState, useMemo, useEffect } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Tooltip,
  Polyline,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import { PNT1Node, PNT1Edge, PNT1Shipment, PNT1Disruption } from '../services/pnt1TwinService';
import { Layers } from 'lucide-react';

interface Pnt1LeafletMapProps {
  nodes: PNT1Node[];
  edges: PNT1Edge[];
  shipments: PNT1Shipment[];
  disruptions: PNT1Disruption[];
  selectedWarehouseId: number | null;
  selectedShipmentId: string | null;
  onSelectWarehouse: (warehouseId: number | null) => void;
  onSelectShipment: (shipmentId: string) => void;
  onSelectNode: (nodeId: number) => void;
}

// Map Controller for programmatically flying or resetting camera
const MapController: React.FC<{ nodes: PNT1Node[] }> = () => {
  const map = useMap();
  useEffect(() => {
    // Focus camera directly on SF Bay Area Multimodal Logistics Corridor
    map.setView([37.74, -122.31], 11, { animate: true });
  }, [map]);
  return null;
};

// Create SVG Icon for each node type
function createNodeDivIcon(
  node: PNT1Node,
  isSelected: boolean,
  isDisrupted: boolean,
  isRecommended: boolean
) {
  let bgGradient = 'bg-slate-700';
  let borderColor = 'border-white';
  let badgeColor = 'bg-slate-800 text-slate-100';
  let iconHtml = '';
  let pulseHtml = '';

  if (isDisrupted) {
    pulseHtml = `
      <div class="absolute -inset-2 rounded-full bg-rose-500/40 animate-ping pointer-events-none"></div>
      <div class="absolute -inset-1 rounded-full border-2 border-rose-500 animate-pulse pointer-events-none"></div>
    `;
  } else if (isRecommended) {
    pulseHtml = `
      <div class="absolute -inset-1 rounded-full border-2 border-emerald-500/80 animate-pulse pointer-events-none"></div>
    `;
  }

  if (node.type === 'warehouse') {
    bgGradient = isSelected ? 'bg-sky-600' : 'bg-slate-900';
    borderColor = isSelected ? 'border-sky-400 ring-4 ring-sky-200' : 'border-sky-500';
    badgeColor = 'bg-sky-700 text-white';
    iconHtml = `
      <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
      </svg>
    `;
  } else if (node.type === 'junction') {
    bgGradient = isDisrupted ? 'bg-rose-600' : isRecommended ? 'bg-emerald-600' : 'bg-amber-600';
    borderColor = isDisrupted ? 'border-rose-300' : 'border-amber-200';
    badgeColor = 'bg-amber-800 text-amber-100';
    iconHtml = `
      <svg class="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="3" stroke-width="2.5"></circle>
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 2v4m0 12v4M2 12h4m12 0h4"></path>
      </svg>
    `;
  } else if (node.type === 'customer') {
    bgGradient = 'bg-indigo-600';
    borderColor = 'border-indigo-200';
    badgeColor = 'bg-indigo-800 text-indigo-100';
    iconHtml = `
      <svg class="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path>
      </svg>
    `;
  } else if (node.type === 'port') {
    bgGradient = 'bg-cyan-700';
    borderColor = 'border-cyan-300';
    badgeColor = 'bg-cyan-900 text-cyan-100';
    iconHtml = `
      <svg class="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m-7-5a7 7 0 0014 0M12 4a3 3 0 100 6 3 3 0 000-6z"></path>
      </svg>
    `;
  } else {
    // Supplier
    bgGradient = 'bg-teal-700';
    borderColor = 'border-teal-200';
    badgeColor = 'bg-teal-900 text-teal-100';
    iconHtml = `
      <svg class="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5"></path>
      </svg>
    `;
  }

  const html = `
    <div class="relative flex flex-col items-center group cursor-pointer">
      ${pulseHtml}
      <div class="w-8 h-8 rounded-lg shadow-md border-2 ${borderColor} ${bgGradient} flex items-center justify-center transition-transform hover:scale-110">
        ${iconHtml}
      </div>
      <div class="absolute -bottom-4 px-1.5 py-0.5 rounded text-[10px] font-bold font-mono shadow-sm border border-black/10 ${badgeColor} whitespace-nowrap">
        ${node.label}
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'pnt1-marker-wrapper',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18],
  });
}

export const Pnt1LeafletMap: React.FC<Pnt1LeafletMapProps> = ({
  nodes,
  edges,
  shipments,
  disruptions,
  selectedWarehouseId,
  selectedShipmentId,
  onSelectWarehouse,
  onSelectShipment,
  onSelectNode,
}) => {
  const defaultCenter: [number, number] = [37.765, -122.31];
  const defaultZoom = 11;
  const [legendOpen, setLegendOpen] = useState(false);

  // Active disruption lookup
  const activeDisruptions = useMemo(
    () => disruptions.filter((d) => d.status === 'ACTIVE'),
    [disruptions]
  );

  const disruptedEdgeIds = useMemo(() => {
    const ids = new Set<string>();
    for (const d of activeDisruptions) {
      for (const e of d.affected_edge_ids) {
        ids.add(e);
      }
    }
    return ids;
  }, [activeDisruptions]);

  const disruptedNodeIds = useMemo(() => {
    const ids = new Set<number>();
    for (const d of activeDisruptions) {
      for (const n of d.affected_nodes) {
        ids.add(n);
      }
    }
    return ids;
  }, [activeDisruptions]);

  // Recommended alternate bypass route corridors
  const recommendedRouteNodes = useMemo(() => {
    // If disruption is active, get recommended corridor
    if (activeDisruptions.length > 0) {
      return activeDisruptions[0].recovery_recommendation.corridor_nodes;
    }
    return [];
  }, [activeDisruptions]);

  // Currently selected shipment
  const selectedShipment = useMemo(
    () => shipments.find((s) => s.id === selectedShipmentId) || null,
    [shipments, selectedShipmentId]
  );

  // Map of Node ID to PNT1Node
  const nodeMap = useMemo(() => {
    const m = new Map<number, PNT1Node>();
    for (const n of nodes) {
      m.set(n.id, n);
    }
    return m;
  }, [nodes]);

  // Helper to determine edge rendering style
  const getEdgeStyle = (edge: PNT1Edge) => {
    const isDisrupted = disruptedEdgeIds.has(edge.id);
    const isEdgeRecommended = edge.status === 'recommended';

    // 1. Disrupted route: RED
    if (isDisrupted) {
      return {
        color: '#ef4444', // Red-500
        weight: 6,
        dashArray: '8, 8',
        opacity: 0.95,
        className: 'disrupted-edge-pulse',
      };
    }

    // 2. Recommended alternate bypass route: GREEN
    if (isEdgeRecommended || (activeDisruptions.length > 0 && isEdgeInNodeSequence(edge, recommendedRouteNodes))) {
      return {
        color: '#10b981', // Emerald-500
        weight: 5.5,
        dashArray: '6, 6',
        opacity: 0.95,
        className: 'recommended-edge-pulse',
      };
    }

    // 3. Highlighted by selected shipment's route
    if (selectedShipment) {
      const isInShipmentRoute = isEdgeInNodeSequence(edge, selectedShipment.current_route);
      if (isInShipmentRoute) {
        if (selectedShipment.status === 'REROUTED') {
          return {
            color: '#10b981', // Emerald
            weight: 5,
            opacity: 0.95,
          };
        }
        return {
          color: '#0284c7', // Sky-600
          weight: 4.5,
          opacity: 0.95,
        };
      }
    }

    // 4. Highlighted by selected warehouse
    if (selectedWarehouseId !== null) {
      const isConnected = edge.source === selectedWarehouseId || edge.target === selectedWarehouseId;
      if (isConnected) {
        return {
          color: '#0284c7', // Sky-600
          weight: 4,
          opacity: 0.9,
        };
      }
      return {
        color: '#cbd5e1', // Slate-300
        weight: 2,
        opacity: 0.35,
      };
    }

    // 5. Default available route: Normal neutral slate
    return {
      color: '#94a3b8', // Slate-400
      weight: 2.5,
      opacity: 0.65,
    };
  };

  // Check if edge connects consecutive nodes in sequence
  function isEdgeInNodeSequence(edge: PNT1Edge, sequence: number[]): boolean {
    if (!sequence || sequence.length < 2) return false;
    for (let i = 0; i < sequence.length - 1; i++) {
      const u = sequence[i];
      const v = sequence[i + 1];
      if ((edge.source === u && edge.target === v) || (edge.source === v && edge.target === u)) {
        return true;
      }
    }
    return false;
  }

  return (
    <div className="relative w-full h-full bg-slate-100 overflow-hidden">
      {/* Leaflet Map Container */}
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        scrollWheelZoom={true}
        zoomControl={true}
        className="w-full h-full z-0"
      >
        <MapController nodes={nodes} />

        {/* Free, Crisp OpenStreetMap Tiles (Shows Bay Area bridges & geography with no watermark) */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />

        {/* 1. Multimodal Logistics Network Edges */}
        {edges.map((edge) => {
          const u = nodeMap.get(edge.source);
          const v = nodeMap.get(edge.target);
          if (!u || !v) return null;

          const positions: [number, number][] = [
            [u.lat, u.lon],
            [v.lat, v.lon],
          ];

          const style = getEdgeStyle(edge);
          const isDisrupted = disruptedEdgeIds.has(edge.id);
          const isBypass = edge.status === 'recommended' || isEdgeInNodeSequence(edge, recommendedRouteNodes);

          return (
            <Polyline
              key={edge.id}
              positions={positions}
              pathOptions={{
                color: style.color,
                weight: style.weight,
                dashArray: style.dashArray,
                opacity: style.opacity,
              }}
              eventHandlers={{
                click: () => {
                  const matchingShipment = shipments.find((s) => isEdgeInNodeSequence(edge, s.current_route));
                  if (matchingShipment) {
                    onSelectShipment(matchingShipment.id);
                  }
                },
              }}
            >
              <Tooltip sticky direction="top" opacity={0.95}>
                <div className="text-xs p-1">
                  <div className="font-bold flex items-center gap-1">
                    {isDisrupted && <span className="text-rose-600 font-extrabold">[BLOCKED]</span>}
                    {isBypass && <span className="text-emerald-600 font-extrabold">[RECOMMENDED BYPASS]</span>}
                    <span>{u.label} ➔ {v.label}</span>
                  </div>
                  <div className="text-slate-600 font-mono text-[11px]">
                    Corridor: {edge.road_type.toUpperCase()} • {edge.dist_km} km • {edge.speed_kph} km/h
                  </div>
                </div>
              </Tooltip>
            </Polyline>
          );
        })}

        {/* 2. Network Nodes (Warehouses, Junctions, Customers, Ports, Suppliers) */}
        {nodes.map((node) => {
          const isSelected = selectedWarehouseId === node.id;
          const isDisrupted = disruptedNodeIds.has(node.id);
          const isRecommended = recommendedRouteNodes.includes(node.id);

          const icon = createNodeDivIcon(node, isSelected, isDisrupted, isRecommended);

          return (
            <Marker
              key={node.id}
              position={[node.lat, node.lon]}
              icon={icon}
              eventHandlers={{
                click: () => {
                  if (node.type === 'warehouse') {
                    onSelectWarehouse(isSelected ? null : node.id);
                  }
                  onSelectNode(node.id);
                },
              }}
            >
              <Popup className="pnt1-node-popup">
                <div className="p-1 min-w-[200px]">
                  <div className="flex items-center justify-between border-b pb-1 mb-1.5">
                    <span className="font-bold text-sm text-slate-900">{node.label} • {node.name}</span>
                    <span className="text-[10px] uppercase font-mono px-1 py-0.5 rounded bg-slate-100 text-slate-700">
                      {node.type}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mb-2">{node.role_description}</p>
                  <div className="text-[11px] grid grid-cols-2 gap-1 text-slate-700 bg-slate-50 p-1.5 rounded">
                    <div>Capacity: <span className="font-mono font-bold">{node.capacity > 0 ? node.capacity.toLocaleString() : 'N/A'}</span></div>
                    <div>Status: <span className={`font-mono font-bold ${node.status === 'ACTIVE' ? 'text-emerald-600' : 'text-rose-600'}`}>{node.status}</span></div>
                  </div>
                  {node.type === 'warehouse' && (
                    <button
                      type="button"
                      onClick={() => onSelectWarehouse(isSelected ? null : node.id)}
                      className={`mt-2 w-full text-xs font-semibold py-1 px-2 rounded transition shadow-sm ${
                        isSelected
                          ? 'bg-slate-200 hover:bg-slate-300 text-slate-800'
                          : 'bg-sky-600 hover:bg-sky-700 text-white'
                      }`}
                    >
                      {isSelected ? 'Clear Warehouse Filter' : 'Filter Connected Routes'}
                    </button>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Map Header Overlay with Mode Indicators */}
      <div className="absolute top-3 left-14 z-10 bg-white/95 backdrop-blur-md px-3 py-2 rounded-lg border border-slate-200/90 shadow-sm flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
          <span className="text-xs font-bold text-slate-800 tracking-wide">SF BAY AREA LOGISTICS CORRIDOR</span>
        </div>
        <span className="text-slate-300">|</span>
        <div className="text-[11px] text-slate-600 font-mono">
          16 Nodes • 48 Multimodal Links
        </div>
      </div>

      {/* Interactive Legend Box (Bottom Left) */}
      <div className="absolute bottom-4 left-4 z-10 bg-white/95 backdrop-blur-md p-2.5 rounded-lg border border-slate-200 shadow-md max-w-xs text-xs space-y-2">
        <button
          type="button"
          onClick={() => setLegendOpen(!legendOpen)}
          className="w-full font-bold text-slate-900 flex items-center justify-between hover:text-sky-700 transition"
        >
          <span className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-sky-600" />
            Network Topology Legend
          </span>
          <span className="text-[10px] text-slate-500 font-mono bg-slate-100 px-1.5 py-0.5 rounded">
            {legendOpen ? 'Hide' : 'Show'}
          </span>
        </button>

        {legendOpen && (
          <>
            {/* Route status lines */}
            <div className="space-y-1.5 pt-1 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <span className="w-6 h-1 rounded bg-rose-500 border-b border-rose-600"></span>
                <span className="text-slate-700 font-medium">Disrupted Route (I-80 Bay Bridge)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-6 h-1 rounded bg-emerald-500 border-b border-emerald-600"></span>
                <span className="text-slate-700 font-medium">Recommended Bypass (Hwy 92 San Mateo)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-6 h-1 rounded bg-sky-600"></span>
                <span className="text-slate-700 font-medium">Selected Warehouse / Transit Route</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-6 h-1 rounded bg-slate-300"></span>
                <span className="text-slate-600">Normal Operational Route</span>
              </div>
            </div>

            {/* Node types */}
            <div className="pt-1.5 border-t border-slate-100 grid grid-cols-2 gap-1.5 text-[11px]">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-slate-900 border border-sky-400 inline-block"></span>
                <span className="text-slate-600">Warehouse (W)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-amber-600 inline-block"></span>
                <span className="text-slate-600">Junction (J)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-indigo-600 inline-block"></span>
                <span className="text-slate-600">Customer (C)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-cyan-700 inline-block"></span>
                <span className="text-slate-600">Port / Supplier</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Selected Warehouse Clear Filter Chip (Top Right of Map) */}
      {selectedWarehouseId !== null && (
        <div className="absolute top-3 right-4 z-10 bg-sky-900 text-white px-3 py-1.5 rounded-lg shadow-md flex items-center gap-2 text-xs">
          <span>Filtering routes for Warehouse <b>{nodeMap.get(selectedWarehouseId)?.label}</b></span>
          <button
            type="button"
            onClick={() => onSelectWarehouse(null)}
            className="ml-2 hover:bg-sky-800 p-0.5 rounded text-sky-200 hover:text-white"
            title="Clear filter"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import {
  PhysicalFacility,
  Supplier,
  TransportRoute,
  OrderShipment,
  EvaluatedDisruption,
} from '../types/logistics';
import { SUPPLIER_SVG_COORDS, WAREHOUSE_LOGICAL_SVG_COORDS } from '../services/logisticsRepository';

interface NetworkMapProps {
  facilities: PhysicalFacility[];
  suppliers: Supplier[];
  routes: TransportRoute[];
  shipments: OrderShipment[];
  disruptions: EvaluatedDisruption[];
  selectedFacilityId: string | null;
  onSelectFacility: (facility: PhysicalFacility) => void;
  onSelectWarehouseId: (warehouseId: string) => void;
}

export const NetworkMap: React.FC<NetworkMapProps> = ({
  facilities,
  suppliers,
  routes,
  shipments,
  disruptions,
  selectedFacilityId,
  onSelectFacility,
  onSelectWarehouseId,
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [is3dMode, setIs3dMode] = useState<boolean>(false);
  const [showRoutes, setShowRoutes] = useState<boolean>(true);
  const [showNodes, setShowNodes] = useState<boolean>(true);
  const [showIncidents, setShowIncidents] = useState<boolean>(true);
  const [hoveredNode, setHoveredNode] = useState<{ name: string; lat: number; lng: number } | null>(null);

  // Active disruptions map
  const activeDisruptions = disruptions.filter((d) => d.state === 'active');
  const activeDisruptionMap = new Map<string, EvaluatedDisruption>();
  for (const d of activeDisruptions) {
    activeDisruptionMap.set(d.affected_node_or_route_id, d);
  }

  const activeRouteDisruptionIds = new Set(
    activeDisruptions.filter((d) => d.affected_node_or_route_id.startsWith('RT-')).map((d) => d.affected_node_or_route_id)
  );
  const activeSupplierDisruptionIds = new Set(
    activeDisruptions.filter((d) => d.affected_node_or_route_id.startsWith('SUP-')).map((d) => d.affected_node_or_route_id)
  );
  const activeWarehouseDisruptionIds = new Set(
    activeDisruptions.filter((d) => d.affected_node_or_route_id.startsWith('WH-')).map((d) => d.affected_node_or_route_id)
  );

  // Helper to get coordinates for route origin and destination
  const getNodeCoord = (nodeId: string): { x: number; y: number } => {
    if (SUPPLIER_SVG_COORDS[nodeId]) {
      return SUPPLIER_SVG_COORDS[nodeId];
    }
    if (WAREHOUSE_LOGICAL_SVG_COORDS[nodeId]) {
      return { x: WAREHOUSE_LOGICAL_SVG_COORDS[nodeId].x, y: WAREHOUSE_LOGICAL_SVG_COORDS[nodeId].y };
    }
    // Fallback search in facilities
    const fac = facilities.find((f) => f.associated_warehouse_ids.includes(nodeId));
    if (fac) {
      return { x: fac.svgX, y: fac.svgY };
    }
    return { x: 500, y: 350 };
  };

  return (
    <div className="flex-1 relative bg-slate-100 overflow-hidden flex flex-col h-full select-none">
      {/* Coordinate Telemetry HUD Top-Left */}
      <div className="absolute top-space-md left-space-md z-20 flex flex-col gap-space-xs pointer-events-none">
        <div className="flex items-center gap-space-sm px-space-sm py-space-xs rounded bg-white/95 backdrop-blur-md shadow-sm border border-slate-200">
          <div className="w-2 h-2 rounded-full bg-sky-600 animate-ping"></div>
          <span className="font-label-caps text-label-caps text-sky-700 font-bold">
            GEOSPATIAL DIGITAL TWIN HUD
          </span>
          <span className="text-slate-300 font-data-mono-sm">/</span>
          <span className="font-data-mono-sm text-data-mono-sm text-slate-800 font-semibold">
            {hoveredNode
              ? `${hoveredNode.lat.toFixed(4)}° N, ${hoveredNode.lng.toFixed(4)}° E [${hoveredNode.name}]`
              : '17.3850° N, 78.4867° E [SECTOR 04-IN]'}
          </span>
          <span className="text-slate-300 font-data-mono-sm">|</span>
          <span className="font-data-mono-sm text-data-mono-sm text-emerald-700 font-bold">
            6 HUBS • 10 SUP
          </span>
          <span className="text-slate-300 font-data-mono-sm">|</span>
          <span className="font-data-mono-sm text-data-mono-sm text-slate-500">LATENCY 1.2s</span>
        </div>
      </div>

      {/* Map Overlay Controls Top-Right */}
      <div className="absolute top-space-md right-space-md z-20 flex items-center gap-space-xs">
        <div className="flex items-center p-space-2xs rounded bg-white/95 backdrop-blur-md shadow-sm border border-slate-200 gap-space-2xs">
          <button
            type="button"
            onClick={() => setZoomLevel((z) => Math.min(z + 0.15, 1.6))}
            className="w-7 h-7 flex items-center justify-center rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[14px] transition-colors"
            title="Zoom In"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
          </button>
          <button
            type="button"
            onClick={() => setZoomLevel((z) => Math.max(z - 0.15, 0.7))}
            className="w-7 h-7 flex items-center justify-center rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[14px] transition-colors"
            title="Zoom Out"
          >
            <span className="material-symbols-outlined text-[16px]">remove</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setZoomLevel(1);
              setIs3dMode(false);
            }}
            className="w-7 h-7 flex items-center justify-center rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[12px] font-bold"
            title="Reset View"
          >
            1:1
          </button>
          <div className="w-px h-5 bg-slate-200 mx-space-2xs"></div>
          <button
            type="button"
            onClick={() => setIs3dMode((prev) => !prev)}
            className={`px-space-xs h-7 flex items-center gap-space-2xs rounded border font-label-caps text-label-caps font-bold transition-colors ${
              is3dMode ? 'bg-sky-600 border-sky-700 text-white' : 'bg-sky-50 border-sky-200 text-sky-700 hover:bg-sky-100'
            }`}
            title="Toggle 3D Isometric View"
          >
            <span className="material-symbols-outlined text-[14px]">view_in_ar</span>
            <span>3D TILT</span>
          </button>
        </div>

        {/* Layer Toggles */}
        <div className="flex items-center gap-space-xs px-space-sm py-space-2xs rounded bg-white/95 backdrop-blur-md shadow-sm border border-slate-200">
          <label className="flex items-center gap-space-2xs cursor-pointer text-slate-700 font-label-caps text-label-caps font-semibold">
            <input
              type="checkbox"
              checked={showRoutes}
              onChange={(e) => setShowRoutes(e.target.checked)}
              className="accent-sky-600 rounded"
            />
            <span>ROUTES</span>
          </label>
          <label className="flex items-center gap-space-2xs cursor-pointer text-slate-700 font-label-caps text-label-caps font-semibold">
            <input
              type="checkbox"
              checked={showNodes}
              onChange={(e) => setShowNodes(e.target.checked)}
              className="accent-sky-600 rounded"
            />
            <span>NODES</span>
          </label>
          <label className="flex items-center gap-space-2xs cursor-pointer text-rose-700 font-label-caps text-label-caps font-bold">
            <input
              type="checkbox"
              checked={showIncidents}
              onChange={(e) => setShowIncidents(e.target.checked)}
              className="accent-rose-600 rounded"
            />
            <span>INCIDENTS</span>
          </label>
        </div>
      </div>

      {/* Vector Map Canvas */}
      <div className="relative w-full h-full flex items-center justify-center bg-slate-100 overflow-hidden">
        {/* Subtle Light Grid Background */}
        <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1.2px,transparent_1.2px)] [background-size:24px_24px] opacity-70 pointer-events-none"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-slate-200/50 via-transparent to-transparent opacity-80 pointer-events-none"></div>

        {/* Interactive SVG Topography & Network Graph */}
        <svg
          className="w-full h-full object-contain transition-transform duration-300"
          style={{
            transform: `${is3dMode ? 'perspective(900px) rotateX(25deg) scale(0.95)' : ''} scale(${zoomLevel})`,
            transformOrigin: '50% 50%',
          }}
          viewBox="0 0 1100 680"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="blueLine" x1="0%" x2="100%" y1="0%" y2="100%">
              <stop offset="0%" stopColor="#0284c7" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#0369a1" stopOpacity="0.75" />
            </linearGradient>
            <linearGradient id="disruptLine" x1="0%" x2="100%" y1="0%" y2="0%">
              <stop offset="0%" stopColor="#dc2626" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#b91c1c" stopOpacity="0.8" />
            </linearGradient>
            <filter id="bloomBlueLight" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id="bloomRedLight" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Geographic Landmass Outline representing Indian Logistics Corridor */}
          <path
            d="M 280 80 Q 480 60 670 90 L 860 220 L 870 380 L 760 560 L 610 650 L 460 640 L 320 480 L 260 280 Z"
            fill="#e2e8f0"
            fillOpacity="0.55"
            stroke="#cbd5e1"
            strokeWidth="2"
            strokeDasharray="6 6"
          />
          <path
            d="M 380 110 L 720 120 L 780 320 L 670 540 L 510 590 L 370 420 Z"
            fill="none"
            opacity="0.5"
            stroke="#94a3b8"
            strokeWidth="1.5"
            strokeDasharray="4 8"
          />

          {/* Regional Sector Labels */}
          <text x="320" y="100" fill="#94a3b8" fontFamily="JetBrains Mono" fontSize="11" fontWeight="700">
            NORTH CORRIDOR (DELHI NCR)
          </text>
          <text x="730" y="230" fill="#94a3b8" fontFamily="JetBrains Mono" fontSize="11" fontWeight="700">
            CENTRAL CORRIDOR (NAGPUR)
          </text>
          <text x="290" y="440" fill="#94a3b8" fontFamily="JetBrains Mono" fontSize="11" fontWeight="700">
            SOUTH-CENTRAL (HYDERABAD)
          </text>
          <text x="310" y="650" fill="#94a3b8" fontFamily="JetBrains Mono" fontSize="11" fontWeight="700">
            SOUTH CORRIDOR (BENGALURU)
          </text>

          {/* 1. Transport Network Routes */}
          {showRoutes &&
            routes.map((rt) => {
              const start = getNodeCoord(rt.origin_node_id);
              const end = getNodeCoord(rt.destination_node_id);
              const isDisrupted = activeRouteDisruptionIds.has(rt.route_id);
              const disruption = activeDisruptionMap.get(rt.route_id);
              const isRecovered = disruption?.recovery?.status === 'RECOVERED';
              const isRail = rt.mode.includes('Rail');

              // Draw subtle curve for visual aesthetics
              const midX = (start.x + end.x) / 2 + (start.y > end.y ? 25 : -25);
              const midY = (start.y + end.y) / 2;
              const pathD = `M ${start.x} ${start.y} Q ${midX} ${midY} ${end.x} ${end.y}`;

              if (isDisrupted && showIncidents) {
                if (isRecovered) {
                  return (
                    <g key={rt.route_id} className="cursor-pointer">
                      <path
                        d={pathD}
                        stroke="#059669"
                        strokeWidth="3"
                        strokeDasharray="6 4"
                        fill="none"
                      />
                      {/* Recovered Corridor Badge in middle */}
                      <g transform={`translate(${midX}, ${midY})`}>
                        <circle cx="0" cy="0" r="11" fill="#ecfdf5" stroke="#059669" strokeWidth="1.5" />
                        <text x="-4" y="3.5" fill="#059669" fontFamily="JetBrains Mono" fontSize="10" fontWeight="700">✓</text>
                        <rect x="16" y="-11" width="86" height="20" rx="3" fill="#ffffff" stroke="#a7f3d0" strokeWidth="1" />
                        <text x="20" y="3" fill="#065f46" fontFamily="JetBrains Mono" fontSize="9" fontWeight="700">
                          {rt.route_id} REROUTED
                        </text>
                      </g>
                    </g>
                  );
                }

                return (
                  <g key={rt.route_id} className="cursor-pointer">
                    <path
                      d={pathD}
                      stroke="#dc2626"
                      strokeWidth="3.5"
                      strokeDasharray="8 6"
                      filter="url(#bloomRedLight)"
                      fill="none"
                    />
                    {/* Disruption Crossmark in middle */}
                    <g transform={`translate(${midX}, ${midY})`}>
                      <circle cx="0" cy="0" r="13" fill="#fee2e2" stroke="#dc2626" strokeWidth="1.5" />
                      <line x1="-5" y1="-5" x2="5" y2="5" stroke="#dc2626" strokeWidth="2.5" />
                      <line x1="5" y1="-5" x2="-5" y2="5" stroke="#dc2626" strokeWidth="2.5" />
                      <rect x="18" y="-12" width="76" height="20" rx="3" fill="#ffffff" stroke="#fca5a5" strokeWidth="1" />
                      <text x="24" y="2" fill="#b91c1c" fontFamily="JetBrains Mono" fontSize="9" fontWeight="700">
                        {rt.route_id} BLOCKED
                      </text>
                    </g>
                  </g>
                );
              }

              return (
                <g key={rt.route_id} className="cursor-pointer group">
                  <path
                    d={pathD}
                    stroke={isRail ? '#059669' : '#0284c7'}
                    strokeWidth={isRail ? 2.5 : 2.2}
                    strokeDasharray={isRail ? '4 4' : 'none'}
                    opacity="0.75"
                    fill="none"
                    className="hover:opacity-100 hover:stroke-width-3 transition-all"
                  />
                  <title>
                    {`${rt.route_id}: ${rt.origin_node_id} ➔ ${rt.destination_node_id} (${rt.distance_km}km, ${rt.travel_time_hr}h, ${rt.mode})`}
                  </title>
                </g>
              );
            })}

          {/* 2. Active In-Transit Shipment Indicators (Real Shipments) */}
          {showRoutes &&
            shipments
              .filter(
                (s) =>
                  s.shipment_status === 'In Transit' ||
                  s.shipment_status === 'Delayed' ||
                  s.shipment_status === 'Rerouted' ||
                  s.is_rerouted
              )
              .map((shp) => {
                const start = getNodeCoord(shp.origin_node_id);
                const end = getNodeCoord(shp.destination_node_id);
                const isRerouted = shp.shipment_status === 'Rerouted' || Boolean(shp.is_rerouted);
                const isDelayed = shp.shipment_status === 'Delayed';
                // Position shipment along progress
                const t = isDelayed ? 0.45 : isRerouted ? 0.55 : 0.65;
                const sx = start.x + (end.x - start.x) * t;
                const sy = start.y + (end.y - start.y) * t;

                return (
                  <g key={shp.shipment_id} transform={`translate(${sx}, ${sy})`} className="cursor-pointer">
                    <circle
                      cx="0"
                      cy="0"
                      r="12"
                      fill={isDelayed ? '#fef3c7' : isRerouted ? '#ecfdf5' : '#e0f2fe'}
                      stroke={isDelayed ? '#d97706' : isRerouted ? '#059669' : '#0284c7'}
                      strokeWidth="1.5"
                    />
                    <path
                      d="M 0 -6 L 5 4 L 0 2 L -5 4 Z"
                      fill={isDelayed ? '#d97706' : isRerouted ? '#059669' : '#0284c7'}
                      transform="rotate(35)"
                    />
                    <rect
                      x="14"
                      y="-10"
                      width={isRerouted ? 124 : 92}
                      height="20"
                      rx="3"
                      fill="#ffffff"
                      stroke={isDelayed ? '#fcd34d' : isRerouted ? '#a7f3d0' : '#cbd5e1'}
                      strokeWidth="1"
                    />
                    <text
                      x="18"
                      y="4"
                      fill={isDelayed ? '#b45309' : isRerouted ? '#065f46' : '#0369a1'}
                      fontFamily="JetBrains Mono"
                      fontSize="9"
                      fontWeight="700"
                    >
                      {shp.shipment_id} • {isRerouted ? 'REROUTED' : `${shp.quantity_units}u`}
                    </text>
                  </g>
                );
              })}

          {/* 3. Supplier Nodes (10 Suppliers) */}
          {showNodes &&
            suppliers.map((sup) => {
              const pos = SUPPLIER_SVG_COORDS[sup.supplier_id] || { x: 300, y: 300 };
              const isDisrupted = activeSupplierDisruptionIds.has(sup.supplier_id);
              const disruption = activeDisruptionMap.get(sup.supplier_id);
              const isRecovered = disruption?.recovery?.status === 'RECOVERED';

              return (
                <g
                  key={sup.supplier_id}
                  transform={`translate(${pos.x}, ${pos.y})`}
                  className="cursor-pointer group"
                  onMouseEnter={() =>
                    setHoveredNode({
                      name: sup.supplier_name,
                      lat: sup.latitude,
                      lng: sup.longitude,
                    })
                  }
                  onMouseLeave={() => setHoveredNode(null)}
                >
                  {isDisrupted && showIncidents && !isRecovered && (
                    <circle
                      cx="0"
                      cy="0"
                      r="22"
                      fill="#fee2e2"
                      fillOpacity="0.5"
                      stroke="#dc2626"
                      strokeWidth="1.5"
                      className="animate-ping"
                      style={{ animationDuration: '2.5s' }}
                    />
                  )}
                  {isDisrupted && showIncidents && isRecovered && (
                    <circle
                      cx="0"
                      cy="0"
                      r="16"
                      fill="#ecfdf5"
                      fillOpacity="0.8"
                      stroke="#059669"
                      strokeWidth="1.5"
                    />
                  )}
                  {/* Square icon representing supplier */}
                  <rect
                    x="-8"
                    y="-8"
                    width="16"
                    height="16"
                    fill="#ffffff"
                    stroke={isDisrupted && !isRecovered ? '#dc2626' : isRecovered ? '#059669' : '#0284c7'}
                    strokeWidth="2"
                    rx="2"
                  />
                  <rect
                    x="-4"
                    y="-4"
                    width="8"
                    height="8"
                    fill={isDisrupted && !isRecovered ? '#dc2626' : isRecovered ? '#059669' : '#0284c7'}
                  />
                  {/* Supplier Label */}
                  <rect
                    x="12"
                    y="-10"
                    width={isRecovered ? 104 : 84}
                    height="20"
                    rx="3"
                    fill="#ffffff"
                    stroke={isDisrupted && !isRecovered ? '#fca5a5' : isRecovered ? '#a7f3d0' : '#cbd5e1'}
                    strokeWidth="1"
                    filter="drop-shadow(0 1px 2px rgba(0,0,0,0.05))"
                  />
                  <text
                    x="16"
                    y="4"
                    fill={isDisrupted && !isRecovered ? '#b91c1c' : isRecovered ? '#065f46' : '#0369a1'}
                    fontFamily="JetBrains Mono"
                    fontSize="9"
                    fontWeight="600"
                  >
                    {sup.supplier_id}
                    {isDisrupted && !isRecovered ? ' [OFFLINE]' : isRecovered ? ' [RECOVERED]' : ''}
                  </text>
                </g>
              );
            })}

          {/* 4. Physical Warehouse Facilities (6 facilities) */}
          {showNodes &&
            facilities.map((fac) => {
              const isSelected = selectedFacilityId === fac.facility_id;
              const isDisrupted =
                activeWarehouseDisruptionIds.has(fac.associated_warehouse_ids[0]) ||
                activeWarehouseDisruptionIds.has(fac.associated_warehouse_ids[1]);

              const isWarning = fac.status === 'warning' || isDisrupted;

              return (
                <g
                  key={fac.facility_id}
                  transform={`translate(${fac.svgX}, ${fac.svgY})`}
                  className="cursor-pointer group"
                  onClick={() => {
                    onSelectFacility(fac);
                    onSelectWarehouseId(fac.associated_warehouse_ids[0]);
                  }}
                  onMouseEnter={() =>
                    setHoveredNode({
                      name: `${fac.name} (${fac.city})`,
                      lat: fac.latitude,
                      lng: fac.longitude,
                    })
                  }
                  onMouseLeave={() => setHoveredNode(null)}
                >
                  {/* Outer pulse if disrupted or warning */}
                  {isWarning && showIncidents && (
                    <circle
                      cx="0"
                      cy="0"
                      r={isSelected ? 32 : 24}
                      fill={isDisrupted ? '#fca5a5' : '#fde68a'}
                      fillOpacity="0.4"
                      className="animate-ping"
                      style={{ animationDuration: '2s' }}
                    />
                  )}

                  {/* Main Warehouse Node */}
                  <circle
                    cx="0"
                    cy="0"
                    r={isSelected ? 16 : 13}
                    fill="#ffffff"
                    stroke={isDisrupted ? '#dc2626' : isWarning ? '#d97706' : '#059669'}
                    strokeWidth={isSelected ? 3 : 2.5}
                    filter="drop-shadow(0 2px 5px rgba(0,0,0,0.15))"
                  />
                  <circle
                    cx="0"
                    cy="0"
                    r={isSelected ? 7 : 5}
                    fill={isDisrupted ? '#dc2626' : isWarning ? '#d97706' : '#059669'}
                  />

                  {/* Warehouse Callout Label */}
                  <rect
                    x="18"
                    y="-14"
                    width="128"
                    height="26"
                    rx="4"
                    fill="#ffffff"
                    stroke={
                      isSelected
                        ? '#0284c7'
                        : isDisrupted
                        ? '#fca5a5'
                        : isWarning
                        ? '#fde68a'
                        : '#cbd5e1'
                    }
                    strokeWidth={isSelected ? 1.5 : 1}
                    filter="drop-shadow(0 2px 4px rgba(0,0,0,0.06))"
                  />
                  <text
                    x="24"
                    y="-1"
                    fill={isDisrupted ? '#b91c1c' : '#0f172a'}
                    fontFamily="JetBrains Mono"
                    fontSize="10"
                    fontWeight="700"
                  >
                    {fac.name}
                  </text>
                  <text
                    x="24"
                    y="9"
                    fill={isDisrupted ? '#dc2626' : isWarning ? '#b45309' : '#059669'}
                    fontFamily="JetBrains Mono"
                    fontSize="8.5"
                    fontWeight="600"
                  >
                    {fac.associated_warehouse_ids.join('+')} • UTIL {fac.utilization_pct}%
                  </text>
                </g>
              );
            })}
        </svg>

        {/* Bottom Left Mini Map Legend */}
        <div className="absolute bottom-space-md left-space-md bg-white/95 backdrop-blur-md p-space-sm rounded shadow-sm border border-slate-200 flex flex-col gap-space-2xs text-slate-800 z-20">
          <span className="font-label-caps text-label-caps text-slate-500 font-bold uppercase">
            NETWORK LEGEND
          </span>
          <div className="flex items-center gap-space-sm font-data-mono-sm text-data-mono-sm">
            <div className="flex items-center gap-space-2xs">
              <span className="w-3 h-1 bg-sky-600 rounded"></span>
              <span className="font-medium text-slate-700">Road</span>
            </div>
            <div className="flex items-center gap-space-2xs">
              <span className="w-3 h-1 bg-emerald-600 rounded"></span>
              <span className="font-medium text-slate-700">Rail+Road</span>
            </div>
            <div className="flex items-center gap-space-2xs">
              <span className="w-3 h-1 bg-amber-500 rounded"></span>
              <span className="font-medium text-slate-700">Delayed</span>
            </div>
            <div className="flex items-center gap-space-2xs">
              <span className="w-3 h-1 bg-rose-600 rounded"></span>
              <span className="text-rose-700 font-bold">Disrupted</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

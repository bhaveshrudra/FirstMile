import React, { useState } from 'react';
import {
  MovingShipment,
  RecoveryRecommendation,
  LogisticsNode,
} from '../services/indiaLogisticsService';
import {
  Truck,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface IndiaBottomPanelProps {
  selectedShipment?: MovingShipment;
  recovery: RecoveryRecommendation;
  nodes: LogisticsNode[];
  isDisrupted: boolean;
}

export const IndiaBottomPanel: React.FC<IndiaBottomPanelProps> = ({
  selectedShipment,
  recovery,
  nodes,
  isDisrupted,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const nodeMap = new Map<string, LogisticsNode>();
  for (const n of nodes) {
    nodeMap.set(n.id, n);
  }

  const fromCity = selectedShipment ? nodeMap.get(selectedShipment.fromId)?.city || selectedShipment.fromId : 'Nagpur';
  const toCity = selectedShipment ? nodeMap.get(selectedShipment.toId)?.city || selectedShipment.toId : 'Bengaluru';

  if (isCollapsed) {
    return (
      <div className="bg-white border-t border-slate-200 px-4 py-1.5 shrink-0 z-20 shadow-md flex items-center justify-between text-xs select-none">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Truck className="w-3.5 h-3.5 text-sky-600" />
            <span className="font-bold text-slate-900">
              {selectedShipment ? `${selectedShipment.id} (${selectedShipment.status})` : 'No shipment selected'}
            </span>
          </div>
          <span className="text-slate-300">|</span>
          <div className="text-slate-600 text-[11px]">
            <span className="font-semibold text-slate-800">Corridor:</span> {recovery.corridor}
          </div>
          <span className="text-slate-300">|</span>
          <div className="text-[11px] font-mono">
            <span className="text-emerald-700 font-bold">Delta: {recovery.travelTimeDelta} ({recovery.distanceDelta})</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsCollapsed(false)}
          className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700 px-2 py-0.5 rounded hover:bg-slate-100 transition"
        >
          <span>Expand Panel</span>
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white border-t border-slate-200 px-3 py-2 shrink-0 z-20 shadow-md select-none relative">
      <button
        type="button"
        onClick={() => setIsCollapsed(true)}
        title="Minimize Panel to maximize map view"
        className="absolute top-2 right-3 flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-700 px-1.5 py-0.5 rounded hover:bg-slate-100 transition z-30"
      >
        <span>Minimize</span>
        <ChevronDown className="w-3 h-3" />
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
        {/* 1. SELECTED SHIPMENT CARD (4 cols) */}
        <div className="lg:col-span-4 bg-slate-50/80 p-2.5 rounded-xl border border-slate-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <Truck className="w-3.5 h-3.5 text-sky-600" />
                <span className="text-[11px] font-black tracking-wider uppercase text-slate-900">
                  Selected Shipment
                </span>
              </div>
              {selectedShipment && (
                <div className="flex items-center gap-1.5 mr-16">
                  <span className="font-mono font-bold text-xs text-slate-800">
                    {selectedShipment.id}
                  </span>
                  <span
                    className={`text-[9px] font-bold font-mono px-1.5 py-0.2 rounded-full ${
                      selectedShipment.status === 'DELAYED'
                        ? 'bg-amber-100 text-amber-800 border border-amber-200 animate-pulse'
                        : selectedShipment.status === 'REROUTED'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {selectedShipment.status.replace('_', ' ')}
                  </span>
                </div>
              )}
            </div>

            {selectedShipment ? (
              <div className="grid grid-cols-4 gap-x-2 gap-y-2 text-[11px] mt-2 pt-2 border-t border-slate-200">
                <div>
                  <span className="text-slate-400 block text-[10px]">Order ID</span>
                  <span className="font-mono font-semibold text-slate-800">{selectedShipment.orderId}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Quantity</span>
                  <span className="font-semibold text-slate-800">{selectedShipment.quantity} units</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">SKU</span>
                  <span className="font-semibold text-slate-800">{selectedShipment.sku}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Current Route</span>
                  <span className="font-semibold text-rose-600 truncate block">
                    {selectedShipment.currentRouteId} ({selectedShipment.status === 'DELAYED' ? 'Disrupted' : 'Bypass'})
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block text-[10px]">From</span>
                  <span className="font-semibold text-slate-800">{fromCity}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">ETA</span>
                  <span className="font-semibold text-slate-800">{selectedShipment.eta}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">To</span>
                  <span className="font-semibold text-slate-800">{toCity}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Status</span>
                  <span
                    className={`font-bold ${
                      selectedShipment.status === 'DELAYED'
                        ? 'text-rose-600'
                        : selectedShipment.status === 'REROUTED'
                        ? 'text-emerald-600'
                        : 'text-slate-700'
                    }`}
                  >
                    {selectedShipment.status === 'DELAYED' ? 'Delayed' : 'On-Schedule'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-400 py-4 text-center">
                Select a shipment from the network to view payload details.
              </div>
            )}
          </div>
        </div>

        {/* 2. ROUTE COMPARISON (5 cols) */}
        <div className="lg:col-span-5 bg-white p-3.5 rounded-2xl border border-slate-200 flex flex-col justify-between">
          <div className="text-xs font-black tracking-wider uppercase text-slate-900 mb-2">
            Route Comparison
          </div>

          <div className="grid grid-cols-2 gap-3 flex-1 items-stretch">
            {/* Original Disrupted Route */}
            <div
              className={`p-2.5 rounded-xl border flex flex-col justify-between ${
                isDisrupted
                  ? 'bg-rose-50/60 border-rose-200'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div>
                <div className="flex items-center gap-1.5 text-rose-600 font-bold text-[11px] mb-1">
                  <span className="w-3.5 h-3.5 rounded-full bg-rose-500 text-white flex items-center justify-center text-[10px]">✕</span>
                  <span>Original Route (Disrupted)</span>
                </div>
                <div className="text-xs font-mono font-bold text-slate-800 mb-2">
                  {recovery.originalRouteDesc}
                </div>
              </div>

              <div className="pt-2 border-t border-rose-200/60 grid grid-cols-3 gap-1 text-[11px]">
                <div>
                  <span className="text-slate-400 block text-[10px]">Distance</span>
                  <span className="font-bold text-slate-800 font-mono">{recovery.originalDistKm} km</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Est. Time</span>
                  <span className="font-bold text-slate-800 font-mono">{recovery.originalTimeHr} h</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Risk</span>
                  <span className="font-bold text-rose-600 font-mono">High</span>
                </div>
              </div>
            </div>

            {/* Recovery Route (Recommended) */}
            <div className="p-2.5 rounded-xl border border-emerald-300 bg-emerald-50/70 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-1.5 text-emerald-700 font-bold text-[11px] mb-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Recovery Route (Recommended)</span>
                </div>
                <div className="text-xs font-mono font-bold text-slate-900 mb-2">
                  {recovery.recoveryRouteDesc}
                </div>
              </div>

              <div className="pt-2 border-t border-emerald-200 grid grid-cols-3 gap-1 text-[11px]">
                <div>
                  <span className="text-slate-400 block text-[10px]">Distance</span>
                  <span className="font-bold text-emerald-800 font-mono">
                    {recovery.recoveryDistKm} km <span className="text-[10px] text-emerald-600">(+210)</span>
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Est. Time</span>
                  <span className="font-bold text-emerald-800 font-mono">
                    {recovery.recoveryTimeHr} h <span className="text-[10px] text-emerald-600">(+3.2h)</span>
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Risk</span>
                  <span className="font-bold text-emerald-700 font-mono">Low</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3. TIMELINE (3 cols) */}
        <div className="lg:col-span-3 bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200 flex flex-col justify-between">
          <div className="text-xs font-black tracking-wider uppercase text-slate-900 mb-2">
            Timeline
          </div>

          <div className="relative pl-3.5 space-y-2 border-l border-slate-200 my-auto text-[11px]">
            {/* Step 1 */}
            <div className="relative">
              <span className="absolute -left-[19px] top-1 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white"></span>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-rose-600 text-[10px]">10:15</span>
                <span className="font-bold text-slate-800">Disruption detected</span>
              </div>
              <p className="text-[10px] text-slate-500">NH-16 road closure</p>
            </div>

            {/* Step 2 */}
            <div className="relative">
              <span className="absolute -left-[19px] top-1 w-2 h-2 rounded-full bg-slate-400 ring-2 ring-white"></span>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-slate-500 text-[10px]">10:18</span>
                <span className="font-semibold text-slate-700">Impact analysis completed</span>
              </div>
              <p className="text-[10px] text-slate-500">3 shipments affected</p>
            </div>

            {/* Step 3 */}
            <div className="relative">
              <span className="absolute -left-[19px] top-1 w-2 h-2 rounded-full bg-sky-500 ring-2 ring-white"></span>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-sky-600 text-[10px]">10:20</span>
                <span className="font-semibold text-slate-700">Alternative route found</span>
              </div>
              <p className="text-[10px] text-slate-500">via Chennai (+210 km)</p>
            </div>

            {/* Step 4 */}
            <div className="relative">
              <span className="absolute -left-[19px] top-1 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white"></span>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-emerald-600 text-[10px]">10:22</span>
                <span className="font-bold text-emerald-700">
                  {isDisrupted ? 'Ready for recovery' : 'Recovery committed'}
                </span>
              </div>
              <p className="text-[10px] text-slate-500">
                {isDisrupted ? 'Click "Fast Recover" to apply' : 'All shipments routed'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

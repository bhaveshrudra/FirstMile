import React from 'react';
import { PNT1Shipment, PNT1Node } from '../services/pnt1TwinService';
import {
  Truck,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Zap,
} from 'lucide-react';

interface Pnt1BottomPanelProps {
  shipments: PNT1Shipment[];
  selectedShipmentId: string;
  onSelectShipment: (id: string) => void;
  nodes: PNT1Node[];
}

export const Pnt1BottomPanel: React.FC<Pnt1BottomPanelProps> = ({
  shipments,
  selectedShipmentId,
  onSelectShipment,
  nodes,
}) => {
  const currentShipment =
    shipments.find((s) => s.id === selectedShipmentId) || shipments[0];

  const nodeMap = new Map<number, PNT1Node>();
  for (const n of nodes) {
    nodeMap.set(n.id, n);
  }

  const getNodeLabel = (id: number) => {
    const n = nodeMap.get(id);
    return n ? `${n.label} (${n.name.split(' ')[0]})` : `Node ${id}`;
  };

  return (
    <div className="bg-white border-t border-slate-200 flex flex-col shrink-0 z-20 shadow-md">
      {/* Top Bar of Bottom Panel: Shipment Selector Pills */}
      <div className="px-4 py-2 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between overflow-x-auto">
        <div className="flex items-center gap-2">
          <Truck className="w-4 h-4 text-sky-600 shrink-0" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 shrink-0">
            Active Consignments:
          </span>
          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
            {shipments.map((s) => {
              const isSelected = s.id === currentShipment?.id;
              const isAtRisk = s.status === 'DELAYED_AT_RISK';
              const isRerouted = s.status === 'REROUTED';

              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onSelectShipment(s.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all shrink-0 ${
                    isSelected
                      ? 'bg-sky-600 text-white shadow-sm ring-2 ring-sky-300'
                      : isAtRisk
                      ? 'bg-rose-100 text-rose-800 hover:bg-rose-200 border border-rose-300'
                      : isRerouted
                      ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-300'
                      : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  <span>{s.id}</span>
                  {isAtRisk && (
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                  )}
                  {isRerouted && (
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  )}
                  <span className="text-[10px] opacity-80">
                    {s.origin_label}➔{s.destination_label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="text-[11px] text-slate-500 hidden md:block">
          Select shipment to trace route corridor
        </div>
      </div>

      {/* Main Details Body: Metadata + Route Comparison */}
      {currentShipment && (
        <div className="p-3.5 px-4 grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
          {/* 1. Shipment Metadata Card (4 cols) */}
          <div className="lg:col-span-4 bg-slate-50 p-3 rounded-xl border border-slate-200/80">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-sm font-mono">
                  {currentShipment.id}
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  {currentShipment.order_id}
                </span>
              </div>
              <span
                className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-full ${
                  currentShipment.status === 'DELAYED_AT_RISK'
                    ? 'bg-rose-100 text-rose-700 border border-rose-200 animate-pulse'
                    : currentShipment.status === 'REROUTED'
                    ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                    : 'bg-sky-100 text-sky-700'
                }`}
              >
                {currentShipment.status.replace('_', ' ')}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-[11px] mt-2 pt-2 border-t border-slate-200">
              <div>
                <span className="text-slate-400 block text-[10px]">PAYLOAD</span>
                <span className="font-semibold text-slate-800">{currentShipment.sku}</span>
                <span className="text-slate-500 block text-[10px]">({currentShipment.quantity} units)</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">CARRIER ASSET</span>
                <span className="font-semibold text-slate-800">{currentShipment.carrier_asset}</span>
                <span className="text-slate-500 block text-[10px]">ETA: {currentShipment.eta_time}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">CUSTOMER DEST</span>
                <span className="font-semibold text-slate-800 truncate block">
                  {currentShipment.customer_name}
                </span>
                <span className="text-slate-500 block text-[10px]">({currentShipment.destination_label})</span>
              </div>
            </div>
          </div>

          {/* 2. Route Comparison: Baseline Blocked vs Optimized Bypass (8 cols) */}
          <div className="lg:col-span-8 flex flex-col md:flex-row items-center gap-3">
            {/* Route A: Baseline / Original Route */}
            <div
              className={`flex-1 w-full p-2.5 rounded-xl border transition ${
                currentShipment.status === 'DELAYED_AT_RISK'
                  ? 'bg-rose-50/70 border-rose-200'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between text-[10px] font-bold mb-1.5">
                <span className="text-slate-500 uppercase tracking-wider">
                  Baseline Route (Direct Trans-Bay)
                </span>
                {currentShipment.status === 'DELAYED_AT_RISK' ? (
                  <span className="text-rose-600 font-mono flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    BLOCKED (+45m Delay)
                  </span>
                ) : (
                  <span className="text-slate-400 font-mono">Original Baseline</span>
                )}
              </div>

              <div className="flex items-center gap-1.5 flex-wrap text-xs font-mono font-bold text-slate-700">
                {currentShipment.original_route.map((nodeId, idx, arr) => (
                  <React.Fragment key={nodeId}>
                    <span
                      className={`px-1.5 py-0.5 rounded ${
                        currentShipment.status === 'DELAYED_AT_RISK' && (nodeId === 11 || nodeId === 2 || nodeId === 5)
                          ? 'bg-rose-200 text-rose-900 border border-rose-300'
                          : 'bg-white border border-slate-200 text-slate-800'
                      }`}
                    >
                      {getNodeLabel(nodeId)}
                    </span>
                    {idx < arr.length - 1 && (
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* Middle Arrow / Versus indicator */}
            <div className="shrink-0 flex items-center justify-center">
              <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 shadow-sm">
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>

            {/* Route B: Optimized Alternate Bypass Route */}
            <div
              className={`flex-1 w-full p-2.5 rounded-xl border transition ${
                currentShipment.status === 'REROUTED'
                  ? 'bg-emerald-50/80 border-emerald-300 shadow-sm'
                  : 'bg-sky-50/60 border-sky-200'
              }`}
            >
              <div className="flex items-center justify-between text-[10px] font-bold mb-1.5">
                <span className="text-slate-600 uppercase tracking-wider flex items-center gap-1">
                  <Zap className="w-3 h-3 text-sky-600" />
                  {currentShipment.status === 'REROUTED'
                    ? 'Active Committed Route (IQPSO)'
                    : 'Recommended Alternate Bypass'}
                </span>
                <span className="text-emerald-700 font-mono font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  +18m (SLA OK)
                </span>
              </div>

              {currentShipment.alternate_route ? (
                <div className="flex items-center gap-1.5 flex-wrap text-xs font-mono font-bold text-slate-800">
                  {currentShipment.alternate_route.map((nodeId, idx, arr) => (
                    <React.Fragment key={nodeId}>
                      <span
                        className={`px-1.5 py-0.5 rounded ${
                          currentShipment.status === 'REROUTED'
                            ? 'bg-emerald-200 text-emerald-900 border border-emerald-300'
                            : 'bg-white border border-sky-200 text-sky-900'
                        }`}
                      >
                        {getNodeLabel(nodeId)}
                      </span>
                      {idx < arr.length - 1 && (
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-slate-500 italic">
                  Standard route maintained (No alternate needed)
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

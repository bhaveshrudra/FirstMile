import React from 'react';
import { ControlTowerKpis } from '../services/indiaLogisticsService';
import {
  Users,
  Box,
  Truck,
  FileText,
  AlertTriangle,
} from 'lucide-react';

interface IndiaKpiStripProps {
  kpis: ControlTowerKpis;
}

export const IndiaKpiStrip: React.FC<IndiaKpiStripProps> = ({ kpis }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2 px-3 py-1.5 bg-slate-50 border-b border-slate-200 shrink-0 select-none">
      {/* 1. Suppliers */}
      <div className="bg-white p-2 rounded-xl border border-slate-200/90 shadow-2xs flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
          <Users className="w-3.5 h-3.5" />
        </div>
        <div className="min-w-0">
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">
            Suppliers
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-sm font-black text-slate-900 font-mono">
              {kpis.suppliers}
            </span>
            <span className="text-[9px] text-emerald-600 font-medium">↑ 0%</span>
          </div>
        </div>
      </div>

      {/* 2. Warehouses */}
      <div className="bg-white p-2 rounded-xl border border-slate-200/90 shadow-2xs flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
          <Box className="w-3.5 h-3.5" />
        </div>
        <div className="min-w-0">
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">
            Warehouses
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-sm font-black text-slate-900 font-mono">
              {kpis.warehouses}
            </span>
            <span className="text-[9px] text-emerald-600 font-medium">↑ 0%</span>
          </div>
        </div>
      </div>

      {/* 3. Active Shipments */}
      {/* 3. Active Shipments */}
      <div className="bg-white p-2 rounded-xl border border-slate-200/90 shadow-2xs flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
          <Truck className="w-3.5 h-3.5" />
        </div>
        <div className="min-w-0">
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">
            Active Shipments
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-black text-slate-900 font-mono">
              {kpis.activeShipments}
            </span>
            <span className="text-[9px] text-slate-500 font-mono flex items-center gap-1">
              <span className="text-emerald-600 font-bold">● {kpis.onTimeShipments}</span>
              {kpis.delayedShipments > 0 && (
                <span className="text-amber-600 font-bold">● {kpis.delayedShipments} Del</span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* 4. Orders */}
      <div className="bg-white p-2 rounded-xl border border-slate-200/90 shadow-2xs flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
          <FileText className="w-3.5 h-3.5" />
        </div>
        <div className="min-w-0">
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">
            Orders
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-sm font-black text-slate-900 font-mono">
              {kpis.orders}
            </span>
            <span className="text-[9px] text-emerald-600 font-medium">↑ 0%</span>
          </div>
        </div>
      </div>

      {/* 5. Active Disruptions */}
      <div
        className={`p-2 rounded-xl border shadow-2xs flex items-center gap-2.5 transition ${
          kpis.activeDisruptions > 0
            ? 'bg-rose-50/70 border-rose-200'
            : 'bg-white border-slate-200/90'
        }`}
      >
        <div
          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
            kpis.activeDisruptions > 0
              ? 'bg-rose-500 text-white animate-pulse'
              : 'bg-slate-100 text-slate-500'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
        </div>
        <div className="min-w-0">
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">
            Active Disruptions
          </span>
          <div className="flex items-baseline gap-1">
            <span
              className={`text-sm font-black font-mono ${
                kpis.activeDisruptions > 0 ? 'text-rose-700' : 'text-slate-800'
              }`}
            >
              {kpis.activeDisruptions}
            </span>
            {kpis.activeDisruptions > 0 && (
              <span className="text-[9px] text-rose-600 font-bold">● High</span>
            )}
          </div>
        </div>
      </div>

      {/* 6. Network Health */}
      <div className="bg-white p-2 rounded-xl border border-slate-200/90 shadow-2xs flex items-center gap-2.5">
        <div className="relative w-7 h-7 rounded-full border-2 border-emerald-500 flex items-center justify-center font-bold font-mono text-[9px] text-emerald-700 shrink-0">
          {kpis.networkHealthPct}%
        </div>
        <div className="min-w-0">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
            Network Health
          </span>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span className="text-xs font-bold text-slate-800">
              {kpis.networkHealthPct >= 90 ? 'Optimal' : 'Healthy'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

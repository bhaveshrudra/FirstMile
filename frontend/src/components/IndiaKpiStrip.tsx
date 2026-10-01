import React from 'react';
import { ControlTowerKpis } from '../services/indiaLogisticsService';
import {
  Building2,
  Box,
  Truck,
  PackageCheck,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';

interface IndiaKpiStripProps {
  kpis: ControlTowerKpis;
}

export const IndiaKpiStrip: React.FC<IndiaKpiStripProps> = ({ kpis }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2 px-3 py-1.5 bg-slate-50 border-b border-slate-200 shrink-0 select-none">
      {/* 1. Warehouses: 10 (Total Cap: 8,850 | Load: 29.7%) */}
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
            <span className="text-[9px] text-slate-500 font-medium font-mono">
              Cap: {kpis.totalWarehouseCapacityUnits?.toLocaleString() || '8,850'}
            </span>
          </div>
          <span className="text-[8.5px] text-emerald-600 font-semibold block leading-tight">
            Avg Load: {kpis.warehouseUtilizationPct}% (2,630 U)
          </span>
        </div>
      </div>

      {/* 2. Live Fleet: 15 In Transit (Cap: 1,490) */}
      <div className="bg-white p-2 rounded-xl border border-slate-200/90 shadow-2xs flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
          <Truck className="w-3.5 h-3.5" />
        </div>
        <div className="min-w-0">
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">
            Live Fleet
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-sm font-black text-slate-900 font-mono">
              {kpis.vehiclesInTransit}
            </span>
            <span className="text-[9px] text-emerald-600 font-semibold">
              ● In Transit
            </span>
          </div>
          <span className="text-[8.5px] text-slate-500 font-mono block leading-tight">
            Cap: {kpis.totalFleetCapacityUnits?.toLocaleString() || '1,490'} Units
          </span>
        </div>
      </div>

      {/* 3. Fleet Utilization: 73.0% (1,088 Units Held) */}
      <div className="bg-white p-2 rounded-xl border border-slate-200/90 shadow-2xs flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
          <TrendingUp className="w-3.5 h-3.5" />
        </div>
        <div className="min-w-0">
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">
            Fleet Utilization
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-sm font-black text-slate-900 font-mono">
              {kpis.fleetUtilizationPct}%
            </span>
            <span className="text-[9px] text-emerald-600 font-bold">Optimal</span>
          </div>
          <span className="text-[8.5px] text-slate-500 font-mono block leading-tight">
            {kpis.totalCapacityHeldUnits?.toLocaleString() || '1,088'} Held
          </span>
        </div>
      </div>

      {/* 4. Product: 1 (Medical Supply Kit) */}
      <div className="bg-white p-2 rounded-xl border border-slate-200/90 shadow-2xs flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
          <PackageCheck className="w-3.5 h-3.5" />
        </div>
        <div className="min-w-0">
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">
            Product SKU
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-xs font-black text-slate-900 truncate max-w-[90px]">
              {kpis.productName || 'Medical Supply Kit'}
            </span>
          </div>
          <span className="text-[8.5px] text-slate-500 font-mono block leading-tight">
            1 Standard SKU
          </span>
        </div>
      </div>

      {/* 5. Businesses: 6 (BIZ01–BIZ06) */}
      <div className="bg-white p-2 rounded-xl border border-slate-200/90 shadow-2xs flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
          <Building2 className="w-3.5 h-3.5" />
        </div>
        <div className="min-w-0">
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">
            Businesses
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-sm font-black text-slate-900 font-mono">
              {kpis.businesses}
            </span>
            <span className="text-[9px] text-slate-500 font-mono">Clients</span>
          </div>
          <span className="text-[8.5px] text-slate-500 font-mono block leading-tight">
            BIZ01 – BIZ06
          </span>
        </div>
      </div>

      {/* 6. Active Disruptions: 0 in Live Mode */}
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
              : 'bg-emerald-50 text-emerald-600'
          }`}
        >
          {kpis.activeDisruptions > 0 ? (
            <AlertTriangle className="w-3.5 h-3.5" />
          ) : (
            <CheckCircle2 className="w-3.5 h-3.5" />
          )}
        </div>
        <div className="min-w-0">
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">
            Active Disruptions
          </span>
          <div className="flex items-baseline gap-1">
            <span
              className={`text-sm font-black font-mono ${
                kpis.activeDisruptions > 0 ? 'text-rose-700' : 'text-slate-900'
              }`}
            >
              {kpis.activeDisruptions}
            </span>
            <span
              className={`text-[9px] font-bold ${
                kpis.activeDisruptions > 0 ? 'text-rose-600' : 'text-emerald-600'
              }`}
            >
              ● {kpis.activeDisruptions > 0 ? 'Action Req' : 'Operational'}
            </span>
          </div>
          <span className="text-[8.5px] text-slate-500 font-mono block leading-tight">
            {kpis.networkHealthPct}% Health
          </span>
        </div>
      </div>
    </div>
  );
};

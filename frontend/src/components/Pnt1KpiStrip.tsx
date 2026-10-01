import React from 'react';
import { PNT1Kpis } from '../services/pnt1TwinService';
import { Warehouse, Truck, AlertTriangle, ShieldCheck, Activity } from 'lucide-react';

interface Pnt1KpiStripProps {
  kpis: PNT1Kpis;
}

export const Pnt1KpiStrip: React.FC<Pnt1KpiStripProps> = ({ kpis }) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-4 py-2 bg-white border-b border-slate-200 shrink-0">
      {/* 1. Warehouses */}
      <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-50 border border-slate-200/80">
        <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
          <Warehouse className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">
            Warehouses
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-base font-bold text-slate-900 font-mono">
              {kpis.total_warehouses}
            </span>
            <span className="text-[11px] text-slate-500 truncate">Regional Hubs</span>
          </div>
        </div>
      </div>

      {/* 2. Shipments */}
      <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-50 border border-slate-200/80">
        <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
          <Truck className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">
            Shipments
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-base font-bold text-slate-900 font-mono">
              {kpis.total_shipments}
            </span>
            <span className="text-[11px] text-slate-500 truncate">Consignments</span>
          </div>
        </div>
      </div>

      {/* 3. At Risk */}
      <div
        className={`flex items-center gap-3 p-2 rounded-lg border transition-all ${
          kpis.at_risk_shipments > 0
            ? 'bg-rose-50/80 border-rose-200'
            : 'bg-emerald-50/50 border-emerald-200'
        }`}
      >
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
            kpis.at_risk_shipments > 0
              ? 'bg-rose-500 text-white animate-pulse'
              : 'bg-emerald-100 text-emerald-700'
          }`}
        >
          {kpis.at_risk_shipments > 0 ? (
            <AlertTriangle className="w-4 h-4" />
          ) : (
            <ShieldCheck className="w-4 h-4" />
          )}
        </div>
        <div className="min-w-0">
          <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">
            At Risk
          </span>
          <div className="flex items-baseline gap-1.5">
            <span
              className={`text-base font-bold font-mono ${
                kpis.at_risk_shipments > 0 ? 'text-rose-700' : 'text-emerald-700'
              }`}
            >
              {kpis.at_risk_shipments}
            </span>
            <span
              className={`text-[11px] font-medium ${
                kpis.at_risk_shipments > 0 ? 'text-rose-600' : 'text-emerald-600'
              }`}
            >
              {kpis.at_risk_shipments > 0 ? 'SLA Impacted' : 'All On-Schedule'}
            </span>
          </div>
        </div>
      </div>

      {/* 4. Disruptions */}
      <div
        className={`flex items-center gap-3 p-2 rounded-lg border transition-all ${
          kpis.active_disruptions > 0
            ? 'bg-rose-50/80 border-rose-200'
            : 'bg-slate-50 border-slate-200'
        }`}
      >
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
            kpis.active_disruptions > 0
              ? 'bg-rose-600 text-white'
              : 'bg-slate-200 text-slate-600'
          }`}
        >
          <Activity className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">
            Disruptions
          </span>
          <div className="flex items-baseline gap-1.5">
            <span
              className={`text-base font-bold font-mono ${
                kpis.active_disruptions > 0 ? 'text-rose-700' : 'text-slate-800'
              }`}
            >
              {kpis.active_disruptions}
            </span>
            <span
              className={`text-[11px] font-medium ${
                kpis.active_disruptions > 0 ? 'text-rose-600' : 'text-slate-500'
              }`}
            >
              {kpis.active_disruptions > 0 ? 'Active Route Cut' : 'Normal Transit'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { NetworkKpis } from '../types/logistics';

interface KpiStripProps {
  kpis: NetworkKpis;
}

export const KpiStrip: React.FC<KpiStripProps> = ({ kpis }) => {
  return (
    <section className="w-full bg-white border-b border-slate-200 px-space-md py-space-xs flex items-center justify-between shadow-sm z-30 shrink-0 select-none">
      <div className="flex items-center gap-space-md overflow-x-auto min-w-0 py-space-2xs">
        {/* KPI: Warehouses */}
        <div className="flex items-center gap-space-sm px-space-sm py-space-2xs rounded bg-slate-50 border border-slate-200 shrink-0">
          <span className="material-symbols-outlined text-sky-600 text-[18px]">warehouse</span>
          <div className="flex flex-col">
            <div className="flex items-baseline gap-space-xs">
              <span className="font-label-caps text-label-caps text-slate-500 font-semibold">WH NODES</span>
              <span className="font-data-mono-md text-data-mono-md text-slate-900 font-bold">
                {kpis.total_warehouses}
              </span>
            </div>
            <div className="flex items-center gap-space-xs font-data-mono-sm text-data-mono-sm font-semibold">
              <span className="text-emerald-700">H:{kpis.healthy_warehouses}</span>
              <span className="text-slate-300">/</span>
              <span className="text-amber-700">R:{kpis.at_risk_warehouses}</span>
              <span className="text-slate-300">/</span>
              <span className="text-rose-700 font-bold">C:{kpis.critical_warehouses}</span>
            </div>
          </div>
        </div>

        {/* KPI: Inventory Real Units */}
        <div className="flex items-center gap-space-sm px-space-sm py-space-2xs rounded bg-slate-50 border border-slate-200 shrink-0">
          <span className="material-symbols-outlined text-sky-600 text-[18px]">inventory_2</span>
          <div className="flex flex-col">
            <div className="flex items-baseline gap-space-xs">
              <span className="font-label-caps text-label-caps text-slate-500 font-semibold">INVENTORY</span>
              <span className="font-data-mono-md text-data-mono-md text-slate-900 font-bold">
                {kpis.total_inventory_units.toLocaleString()}
                <span className="text-slate-400 text-[11px] font-normal"> units</span>
              </span>
            </div>
            <div className="flex items-center gap-space-xs font-data-mono-sm text-data-mono-sm font-semibold">
              <span className="text-emerald-700">AVAIL: {kpis.available_inventory_units.toLocaleString()}</span>
              <span className="text-slate-300">|</span>
              <span className="text-sky-700">RES: {kpis.reserved_inventory_units.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* KPI: Active Shipments */}
        <div className="flex items-center gap-space-sm px-space-sm py-space-2xs rounded bg-slate-50 border border-slate-200 shrink-0">
          <span className="material-symbols-outlined text-sky-600 text-[18px]">alt_route</span>
          <div className="flex flex-col">
            <div className="flex items-baseline gap-space-xs">
              <span className="font-label-caps text-label-caps text-slate-500 font-semibold">SHIPMENTS</span>
              <span className="font-data-mono-md text-data-mono-md text-slate-900 font-bold">
                {kpis.total_shipments}
              </span>
            </div>
            <div className="flex items-center gap-space-xs font-data-mono-sm text-data-mono-sm font-medium">
              <span className="text-emerald-700">TRANSIT: {kpis.in_transit_shipments}</span>
              <span className="text-slate-300">|</span>
              <span className="text-amber-700">DELAYED: {kpis.delayed_shipments}</span>
              <span className="text-slate-300">|</span>
              <span className="text-sky-700">PLAN: {kpis.planned_shipments}</span>
            </div>
          </div>
        </div>

        {/* KPI: Orders & OTIF */}
        <div className="flex items-center gap-space-sm px-space-sm py-space-2xs rounded bg-slate-50 border border-slate-200 shrink-0">
          <span className="material-symbols-outlined text-emerald-600 text-[18px]">shopping_cart_checkout</span>
          <div className="flex flex-col">
            <div className="flex items-baseline gap-space-xs">
              <span className="font-label-caps text-label-caps text-slate-500 font-semibold">ORDERS</span>
              <span className="font-data-mono-md text-data-mono-md text-slate-900 font-bold">
                {kpis.total_orders}
              </span>
            </div>
            <div className="flex items-center gap-space-2xs font-data-mono-sm text-data-mono-sm text-emerald-700 font-semibold">
              <span>OTIF: {kpis.otif_pct}%</span>
              <span className="text-slate-300">|</span>
              <span className="text-slate-600">DELIV: {kpis.delivered_shipments}</span>
            </div>
          </div>
        </div>

        {/* KPI: Value / Nodes At Risk */}
        <div
          className={`flex items-center gap-space-sm px-space-sm py-space-2xs rounded border shrink-0 ${
            kpis.active_disruptions_count > 0 ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <span
            className={`material-symbols-outlined text-[18px] ${
              kpis.active_disruptions_count > 0 ? 'text-rose-600 animate-pulse' : 'text-slate-400'
            }`}
          >
            emergency
          </span>
          <div className="flex flex-col">
            <div className="flex items-baseline gap-space-xs">
              <span
                className={`font-label-caps text-label-caps font-bold ${
                  kpis.active_disruptions_count > 0 ? 'text-rose-700' : 'text-slate-600'
                }`}
              >
                AT RISK
              </span>
              <span
                className={`font-data-mono-md text-data-mono-md font-bold ${
                  kpis.active_disruptions_count > 0 ? 'text-rose-700' : 'text-slate-800'
                }`}
              >
                {kpis.active_disruptions_count > 0 ? `${kpis.active_disruptions_count} INCIDENTS` : '0 DISRUPTIONS'}
              </span>
            </div>
            <div
              className={`flex items-center gap-space-2xs font-data-mono-sm text-data-mono-sm font-semibold ${
                kpis.active_disruptions_count > 0 ? 'text-rose-600' : 'text-slate-500'
              }`}
            >
              <span>ROUTES: {kpis.disrupted_routes_count}</span>
              <span className="text-slate-300">|</span>
              <span>NODES: {kpis.disrupted_nodes_count}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Global Telemetry Status */}
      <div className="hidden xl:flex items-center gap-space-md shrink-0 pl-space-md">
        {kpis.active_disruptions_count > 0 ? (
          <div className="flex items-center gap-space-xs px-space-sm py-space-2xs rounded bg-rose-50 border border-rose-200">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
            <span className="font-label-caps text-label-caps text-rose-700 font-bold tracking-wide uppercase">
              ACTIVE DISRUPTIONS
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-space-xs px-space-sm py-space-2xs rounded bg-emerald-50 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="font-label-caps text-label-caps text-emerald-700 font-bold tracking-wide uppercase">
              NETWORK OPERATIONAL
            </span>
          </div>
        )}
        <div className="flex items-center gap-space-2xs font-data-mono-sm text-data-mono-sm text-slate-600">
          <span className="material-symbols-outlined text-sky-600 text-[15px]">sync</span>
          <span className="font-semibold text-slate-700">60 FPS TWIN SYNC</span>
        </div>
      </div>
    </section>
  );
};

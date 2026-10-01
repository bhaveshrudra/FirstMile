import React from 'react';
import { EvaluatedDisruption, NetworkKpis } from '../types/logistics';

interface IntelligencePanelProps {
  kpis: NetworkKpis;
  disruptions: EvaluatedDisruption[];
  simDate: string;
  onSimDateChange: (date: string) => void;
  onSelectWarehouseId: (id: string) => void;
  selectedDisruptionId?: string | null;
  onSelectDisruptionId?: (id: string) => void;
}

export const IntelligencePanel: React.FC<IntelligencePanelProps> = ({
  kpis,
  disruptions,
  simDate,
  onSimDateChange,
  onSelectWarehouseId,
  selectedDisruptionId = null,
  onSelectDisruptionId,
}) => {
  const activeDisruptions = disruptions.filter((d) => d.state === 'active');
  const upcomingDisruptions = disruptions.filter((d) => d.state === 'upcoming');

  // Compute operational percentage based on healthy vs total nodes
  const operationalPct = Math.round(
    ((kpis.healthy_warehouses + (kpis.total_shipments - kpis.delayed_shipments)) /
      (kpis.total_warehouses + kpis.total_shipments)) *
      100
  );

  return (
    <div className="p-space-md bg-white border-b border-slate-200 flex flex-col gap-space-sm shadow-sm select-none">
      {/* Title Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-space-xs">
          <span className="material-symbols-outlined text-sky-600 text-[18px]">psychology</span>
          <span className="font-label-caps text-label-caps text-slate-900 uppercase font-bold tracking-wider">
            NETWORK INTELLIGENCE
          </span>
        </div>
        <span className="font-label-caps text-label-caps px-space-xs py-space-2xs rounded bg-emerald-100 text-emerald-800 font-bold border border-emerald-200">
          LIVE THREAT MAP
        </span>
      </div>

      {/* Radial Gauge & Distribution Summary */}
      <div className="flex items-center gap-space-md bg-slate-50 border border-slate-200 p-space-sm rounded">
        <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
          {/* Mini Radial SVG */}
          <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 36 36">
            <path
              className="text-slate-200"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              stroke="currentColor"
              strokeWidth="3.5"
            />
            {/* Green Arc */}
            <path
              className="text-emerald-600"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              stroke="currentColor"
              strokeDasharray={`${operationalPct}, 100`}
              strokeWidth="3.5"
            />
          </svg>
          <div className="absolute flex flex-col items-center justify-center">
            <span className="font-data-mono-md text-data-mono-md font-bold text-slate-900">
              {operationalPct}%
            </span>
          </div>
        </div>

        <div className="flex flex-col flex-1 gap-space-2xs">
          <span className="font-label-caps text-label-caps text-slate-500 font-semibold">
            NETWORK HEALTH PROFILE
          </span>
          <div className="grid grid-cols-3 gap-space-2xs text-center font-data-mono-sm text-data-mono-sm">
            <div className="p-space-2xs rounded bg-emerald-50 border border-emerald-200 text-emerald-800">
              <div className="font-bold">{kpis.healthy_warehouses}</div>
              <div className="text-[9px] text-emerald-700 font-semibold">HEALTHY</div>
            </div>
            <div className="p-space-2xs rounded bg-amber-50 border border-amber-200 text-amber-800">
              <div className="font-bold">{kpis.at_risk_warehouses}</div>
              <div className="text-[9px] text-amber-700 font-semibold">AT RISK</div>
            </div>
            <div className="p-space-2xs rounded bg-rose-50 border border-rose-200 text-rose-700">
              <div className="font-bold">{kpis.critical_warehouses}</div>
              <div className="text-[9px] text-rose-700 font-bold">CRITICAL</div>
            </div>
          </div>
        </div>
      </div>

      {/* Simulation Date Scrubber & Timeline */}
      <div className="p-space-xs rounded bg-slate-50 border border-slate-200 flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="font-label-caps text-label-caps text-slate-600 font-bold">
            SIMULATION DATE: {simDate}
          </span>
          <span className="font-data-mono-sm text-[10px] text-slate-500">
            {activeDisruptions.length} ACTIVE | {upcomingDisruptions.length} UPCOMING
          </span>
        </div>
        <div className="flex items-center gap-1">
          {['2026-10-02', '2026-10-05', '2026-10-08', '2026-10-16'].map((dt) => (
            <button
              key={dt}
              type="button"
              onClick={() => onSimDateChange(dt)}
              className={`flex-1 py-0.5 rounded text-[10px] font-data-mono-sm font-semibold transition-colors border ${
                simDate === dt
                  ? 'bg-sky-600 border-sky-700 text-white'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              {dt.replace('2026-', '')}
            </button>
          ))}
        </div>
      </div>

      {/* Active Alerts Dense List (Section 11, 13, 24) */}
      <div className="flex flex-col gap-space-xs mt-space-2xs max-h-56 overflow-y-auto pr-1">
        {activeDisruptions.length === 0 ? (
          <div className="p-space-sm rounded bg-slate-50 border border-slate-200 text-center text-slate-500 font-data-mono-sm text-xs">
            No active disruptions for {simDate}. Network running nominally.
          </div>
        ) : (
          activeDisruptions.map((alert) => {
            const isWarehouse = alert.affected_node_or_route_id.startsWith('WH-');
            const isRecovered = alert.recovery && alert.recovery.status === 'RECOVERED';
            const isSelected = selectedDisruptionId === alert.disruption_id;

            return (
              <div
                key={alert.disruption_id}
                onClick={() => onSelectDisruptionId && onSelectDisruptionId(alert.disruption_id)}
                className={`p-space-sm rounded border flex flex-col gap-space-2xs transition-all cursor-pointer ${
                  isSelected
                    ? 'ring-2 ring-sky-500 bg-sky-50/50 border-sky-300'
                    : isRecovered
                    ? 'bg-emerald-50/60 border-emerald-300'
                    : 'bg-rose-50 border-rose-200 hover:border-rose-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-space-xs">
                    <span
                      className={`material-symbols-outlined text-[16px] ${
                        isRecovered ? 'text-emerald-700' : 'text-rose-600'
                      }`}
                    >
                      {isRecovered ? 'verified' : 'warning'}
                    </span>
                    <span
                      className={`font-label-caps text-label-caps font-bold ${
                        isRecovered ? 'text-emerald-800' : 'text-rose-700'
                      }`}
                    >
                      {alert.disruption_id} • {alert.affected_node_or_route_id}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`font-data-mono-sm text-[10px] px-1 py-0.2 rounded font-bold ${
                        isRecovered
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-rose-100 text-rose-700'
                      }`}
                    >
                      SEV {alert.severity} ({alert.duration_hours}h)
                    </span>
                    {isSelected && (
                      <span className="font-label-caps text-[9px] px-1 bg-sky-600 text-white rounded font-bold">
                        SELECTED
                      </span>
                    )}
                  </div>
                </div>

                <p className="font-body-sm text-body-sm text-slate-700">{alert.description}</p>

                {/* Real Recovery Distinction (Section 11 & 13) */}
                {isRecovered ? (
                  <div className="p-1.5 rounded bg-emerald-100/70 border border-emerald-300 text-emerald-900 font-data-mono-sm text-[10.5px] flex flex-col gap-0.5">
                    <div className="font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                      <span>RECOVERY: Alternate fulfillment / rerouted</span>
                    </div>
                    <span className="text-emerald-800 text-[10px] leading-tight">
                      {alert.recovery?.recovery_note || 'Operations protected via alternate corridor.'}
                    </span>
                  </div>
                ) : (
                  <div className="flex justify-between items-center pt-space-2xs">
                    <span className="font-data-mono-sm text-[10px] text-rose-800 font-medium">
                      Physical reduction: {alert.capacity_reduction_pct}%
                    </span>
                    {isWarehouse && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectWarehouseId(alert.affected_node_or_route_id);
                        }}
                        className="px-space-sm py-space-2xs rounded bg-rose-600 hover:bg-rose-700 text-white font-label-caps text-label-caps font-bold transition-colors shadow-sm"
                      >
                        OPEN DRAWER
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

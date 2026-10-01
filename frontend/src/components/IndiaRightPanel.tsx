import React, { useState } from 'react';
import {
  DisruptionAlert,
  RecoveryRecommendation,
} from '../services/indiaLogisticsService';
import {
  AlertTriangle,
  CheckCircle2,
  Zap,
  Play,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface IndiaRightPanelProps {
  disruptions: DisruptionAlert[];
  recovery: RecoveryRecommendation;
  isSimulating: boolean;
  onSimulateImpact: () => void;
  onApplyFastRecover: () => void;
}

export const IndiaRightPanel: React.FC<IndiaRightPanelProps> = ({
  disruptions,
  recovery,
  isSimulating,
  onSimulateImpact,
  onApplyFastRecover,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const activeDisruptions = disruptions.filter((d) => d.status === 'ACTIVE');
  const isDisrupted = activeDisruptions.length > 0;

  if (isCollapsed) {
    return (
      <div className="w-10 bg-white border-l border-slate-200 flex flex-col items-center py-4 shrink-0 h-full select-none justify-between transition-all">
        <button
          type="button"
          onClick={() => setIsCollapsed(false)}
          title="Open Recovery & Disruption Panel"
          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition shadow-2xs"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="rotate-90 whitespace-nowrap text-[11px] font-bold tracking-wider text-slate-600 uppercase my-auto">
          Disruptions & Recovery
        </div>
        {isDisrupted && (
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping mb-2"></span>
        )}
      </div>
    );
  }

  return (
    <div className="w-72 xl:w-80 bg-white border-l border-slate-200 flex flex-col shrink-0 h-full overflow-y-auto select-none transition-all">
      <div className="p-3.5 space-y-4 flex-1">
        {/* Header with collapse button */}
        <div className="flex items-center justify-between pb-1 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-slate-900">
              Situational Digital Twin
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsCollapsed(true)}
            title="Collapse panel to maximize map"
            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 1. ACTIVE DISRUPTIONS LIST */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Active Disruptions ({activeDisruptions.length})
            </h2>
            <div className="flex items-center gap-1.5">
              <span
                className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded ${
                  isDisrupted
                    ? 'bg-rose-100 text-rose-700'
                    : 'bg-emerald-100 text-emerald-700'
                }`}
              >
                {isDisrupted ? `${activeDisruptions.length} ACTIVE` : 'NOMINAL'}
              </span>
            </div>
          </div>

          {activeDisruptions.length === 0 ? (
            <div className="rounded-2xl p-4 border border-emerald-200 bg-emerald-50/50 shadow-2xs space-y-2">
              <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>All National Corridors Operational</span>
              </div>
              <p className="text-[11px] text-slate-600 leading-snug">
                Normal network state loaded. Zero route blockages or delayed consignments detected across Indian transit corridors.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeDisruptions.map((d) => (
                <div
                  key={d.id}
                  className="rounded-2xl p-3.5 border bg-rose-50/50 border-rose-200 shadow-sm"
                >
                  <div className="flex items-start gap-2.5">
                    <div className="p-2 rounded-xl shrink-0 mt-0.5 bg-rose-500 text-white">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-rose-700 leading-tight">
                          {d.id} • {d.title}
                        </span>
                        <span className="text-[9px] font-mono font-bold bg-rose-200 text-rose-800 px-1.5 py-0.2 rounded">
                          SEV {d.severity}/5
                        </span>
                      </div>
                      <div className="text-[11px] font-bold text-slate-800 mt-0.5">
                        {d.location}
                      </div>
                      <p className="text-[10.5px] text-slate-600 mt-1 leading-snug">
                        {d.description}
                      </p>

                      {/* Severity Meter */}
                      <div className="mt-2.5">
                        <div className="flex items-center justify-between text-[9.5px] mb-1">
                          <span className="text-slate-400 font-semibold uppercase">Severity</span>
                          <span className="font-mono font-bold text-rose-600">
                            {d.severity} / 5
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((level) => (
                            <span
                              key={level}
                              className={`h-1.5 flex-1 rounded-full ${
                                level <= d.severity ? 'bg-rose-500' : 'bg-slate-200'
                              }`}
                            ></span>
                          ))}
                        </div>
                      </div>

                      {/* Metrics */}
                      <div className="mt-2.5 pt-2 border-t border-rose-200/60 grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-slate-400 text-[9.5px] block font-semibold uppercase">Capacity Impact</span>
                          <span className="font-bold font-mono text-rose-700 text-[11px]">
                            {d.capacityImpact}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[9.5px] block font-semibold uppercase">Affected Shipments</span>
                          <span className="font-bold font-mono text-slate-900 text-[11px]">
                            {d.affectedShipmentsCount} consignment
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Action Buttons: View Details + Simulate Impact */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={onSimulateImpact}
                  disabled={isSimulating}
                  className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center justify-center gap-1.5 active:scale-98"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{isSimulating ? 'Simulating 6 Steps...' : 'Simulate Impact'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 2. RECOVERY SUGGESTION CARD */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Recovery Suggestion
            </h2>
            <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
              AI QUANTUM SWARM
            </span>
          </div>

          <div className="rounded-2xl p-4 border border-emerald-200/80 bg-emerald-50/40 shadow-sm space-y-3">
            <div className="text-xs font-bold text-slate-900 leading-snug">
              {recovery.title}
            </div>

            <div className="text-[10.5px] text-slate-600 font-mono leading-tight bg-white p-2 rounded-lg border border-slate-200/80">
              <span className="text-slate-400 font-bold block text-[9.5px] uppercase font-sans">Corridor Flow</span>
              {recovery.corridor}
            </div>

            {/* 3 Metric Pills */}
            <div className="grid grid-cols-3 gap-1.5">
              <div className="bg-white p-1.5 rounded-xl border border-slate-200/80 shadow-2xs text-center">
                <span className="text-[9.5px] text-slate-400 block font-medium">Time</span>
                <span className="text-xs font-bold font-mono text-emerald-600">
                  {recovery.travelTimeDelta}
                </span>
              </div>
              <div className="bg-white p-1.5 rounded-xl border border-slate-200/80 shadow-2xs text-center">
                <span className="text-[9.5px] text-slate-400 block font-medium">Distance</span>
                <span className="text-xs font-bold font-mono text-slate-800">
                  {recovery.distanceDelta}
                </span>
              </div>
              <div className="bg-white p-1.5 rounded-xl border border-slate-200/80 shadow-2xs text-center">
                <span className="text-[9.5px] text-slate-400 block font-medium">Est. Cost</span>
                <span className="text-xs font-bold font-mono text-amber-600">
                  {recovery.costDelta}
                </span>
              </div>
            </div>

            {/* Apply Fast Recover CTA Button */}
            {isDisrupted ? (
              <button
                type="button"
                onClick={onApplyFastRecover}
                disabled={isSimulating}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-xl text-xs font-bold tracking-wider uppercase transition shadow-md hover:shadow-lg active:scale-98 flex items-center justify-center gap-1.5"
              >
                <Zap className="w-4 h-4" />
                <span>Apply Fast Recover</span>
              </button>
            ) : (
              <div className="bg-emerald-100/70 border border-emerald-300 p-2.5 rounded-xl text-xs text-emerald-900 font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>Corridors operational. All shipments nominal.</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

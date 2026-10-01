import React from 'react';
import { PNT1Disruption } from '../services/pnt1TwinService';
import {
  AlertTriangle,
  Zap,
  CheckCircle2,
  ShieldCheck,
  ChevronRight,
  Activity,
} from 'lucide-react';

interface Pnt1RightPanelProps {
  disruptions: PNT1Disruption[];
  isRecovering: boolean;
  recoveryStep: string;
  onFastRecover: () => void;
  onReset: () => void;
}

export const Pnt1RightPanel: React.FC<Pnt1RightPanelProps> = ({
  disruptions,
  isRecovering,
  recoveryStep,
  onFastRecover,
  onReset,
}) => {
  const activeDisruption = disruptions.find((d) => d.status === 'ACTIVE');
  const isRecovered = disruptions.length > 0 && !activeDisruption;
  const primaryDisruption = disruptions[0];

  return (
    <div className="w-80 xl:w-96 bg-white border-l border-slate-200 flex flex-col shrink-0 h-full overflow-y-auto">
      {/* Panel Header */}
      <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-sky-600" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
            Disruption & Recovery
          </h2>
        </div>
        <span
          className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-full ${
            activeDisruption
              ? 'bg-rose-100 text-rose-700 border border-rose-200'
              : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
          }`}
        >
          {activeDisruption ? '1 ACTIVE INCIDENT' : 'ALL CLEAR'}
        </span>
      </div>

      <div className="p-4 space-y-4 flex-1">
        {/* SECTION 1: Active Disruption Card */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              1. Incident Alert
            </span>
            {activeDisruption ? (
              <span className="flex items-center gap-1 text-[11px] font-semibold text-rose-600">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
                CRITICAL (Severity 5)
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Recovered
              </span>
            )}
          </div>

          <div
            className={`rounded-xl p-3.5 border transition-all ${
              activeDisruption
                ? 'bg-rose-50/60 border-rose-200 shadow-sm'
                : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className="flex items-start gap-2.5">
              <div
                className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                  activeDisruption
                    ? 'bg-rose-500 text-white shadow-sm'
                    : 'bg-emerald-500 text-white'
                }`}
              >
                {activeDisruption ? (
                  <AlertTriangle className="w-4 h-4" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 truncate">
                    {primaryDisruption?.id} • {primaryDisruption?.name}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 mt-1 leading-snug">
                  {primaryDisruption?.description}
                </p>

                <div className="mt-3 pt-2 border-t border-rose-200/60 grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-500 block text-[10px]">AFFECTED ROUTE</span>
                    <span className="font-mono font-bold text-rose-700">W1 ➔ J1 ➔ C1</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">CAPACITY IMPACT</span>
                    <span className="font-mono font-bold text-rose-700">
                      -{primaryDisruption?.capacity_reduction_pct}% (Total Block)
                    </span>
                  </div>
                </div>

                <div className="mt-2 bg-white/80 p-2 rounded border border-rose-200/80 text-[11px] flex items-center justify-between">
                  <span className="text-slate-600">Impacting Shipment:</span>
                  <span className="font-mono font-bold text-slate-900 bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded">
                    SHP-001 (Priority Med)
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2: Recovery Recommendation (IQPSO Solver) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              2. Recovery Recommendation
            </span>
            <span className="text-[10px] font-mono bg-sky-100 text-sky-800 px-1.5 py-0.5 rounded font-bold">
              IQPSO ALGORITHM
            </span>
          </div>

          <div
            className={`rounded-xl p-3.5 border transition-all ${
              isRecovered
                ? 'bg-emerald-50/70 border-emerald-200 shadow-sm'
                : 'bg-sky-50/50 border-sky-200'
            }`}
          >
            <div className="flex items-start gap-2.5">
              <div
                className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                  isRecovered ? 'bg-emerald-600 text-white' : 'bg-sky-600 text-white'
                }`}
              >
                {isRecovered ? (
                  <ShieldCheck className="w-4 h-4" />
                ) : (
                  <Zap className="w-4 h-4" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-slate-900">
                  {primaryDisruption?.recovery_recommendation.title}
                </div>
                <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                  Solver: {primaryDisruption?.recovery_recommendation.solver}
                </div>

                {/* Route sequence display */}
                <div className="mt-2.5 bg-white p-2 rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-bold block mb-1">
                    RECOMMENDED BYPASS CORRIDOR
                  </span>
                  <div className="flex flex-wrap items-center gap-1 text-[11px] font-mono font-bold text-slate-800">
                    {primaryDisruption?.recovery_recommendation.corridor_labels.map((lbl, idx, arr) => (
                      <React.Fragment key={lbl}>
                        <span
                          className={`px-1.5 py-0.5 rounded ${
                            lbl.startsWith('W')
                              ? 'bg-sky-100 text-sky-800'
                              : lbl.startsWith('J')
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-indigo-100 text-indigo-800'
                          }`}
                        >
                          {lbl}
                        </span>
                        {idx < arr.length - 1 && (
                          <ChevronRight className="w-3 h-3 text-slate-400" />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>

                {/* Outcome comparison */}
                <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-white p-2 rounded border border-slate-200">
                    <span className="text-slate-500 text-[10px] block">ETA DELTA</span>
                    <span className="font-bold text-emerald-600 font-mono">
                      +{primaryDisruption?.recovery_recommendation.eta_delta_min}m (SLA OK)
                    </span>
                  </div>
                  <div className="bg-white p-2 rounded border border-slate-200">
                    <span className="text-slate-500 text-[10px] block">DISTANCE DELTA</span>
                    <span className="font-bold text-slate-700 font-mono">
                      +{primaryDisruption?.recovery_recommendation.distance_delta_km} km
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-600 mt-2.5 leading-relaxed bg-white/60 p-2 rounded border border-slate-200/60">
                  {primaryDisruption?.recovery_recommendation.explanation}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 3: Action Execution */}
        <div className="pt-2">
          {activeDisruption ? (
            <button
              type="button"
              onClick={onFastRecover}
              disabled={isRecovering}
              className="w-full py-3 px-4 rounded-xl font-bold text-xs tracking-wider uppercase bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-700 hover:to-blue-800 active:scale-[0.99] text-white shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-75"
            >
              <Zap className={`w-4 h-4 ${isRecovering ? 'animate-spin' : ''}`} />
              {isRecovering ? recoveryStep : 'APPLY FAST RECOVER'}
            </button>
          ) : (
            <div className="space-y-2">
              <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl flex items-center gap-2.5 text-xs text-emerald-800 font-semibold">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>Alternate bypass committed. All shipments operational.</span>
              </div>
              <button
                type="button"
                onClick={onReset}
                className="w-full py-2 px-3 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition flex items-center justify-center gap-1.5"
              >
                <span>Reset Simulation to Baseline</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

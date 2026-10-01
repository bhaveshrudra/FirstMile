import React, { useState, useEffect } from 'react';
import { Zap, Bell, RotateCcw, ArrowLeft } from 'lucide-react';
import { ControlTowerKpis, ScenarioId, SCENARIO_PRESETS } from '../services/indiaLogisticsService';

interface IndiaTopHeaderProps {
  kpis: ControlTowerKpis;
  isDisrupted: boolean;
  isSimulating: boolean;
  selectedScenario: ScenarioId;
  onSelectScenario: (scenario: ScenarioId) => void;
  onFastRecover: () => void;
  onReset: () => void;
}

export const IndiaTopHeader: React.FC<IndiaTopHeaderProps> = ({
  kpis,
  isDisrupted,
  isSimulating,
  selectedScenario,
  onSelectScenario,
  onFastRecover,
  onReset,
}) => {
  const [timeStr, setTimeStr] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const timePart = now.toTimeString().split(' ')[0];
      setTimeStr(`${timePart} IST, Tue, 02 Oct 2026`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const isSimulationMode = selectedScenario !== 'NORMAL';

  return (
    <header className="h-14 bg-white border-b border-slate-200 px-4 flex items-center justify-between z-30 shrink-0 select-none shadow-xs gap-3">
      {/* Brand & Clean Status Indicator */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold shadow-sm">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <circle cx="12" cy="12" r="3" strokeWidth="2"></circle>
              <circle cx="19" cy="5" r="2" strokeWidth="2"></circle>
              <circle cx="5" cy="19" r="2" strokeWidth="2"></circle>
              <path d="M12 9V5m0 10v4M14 13l4-2M6 13l4-2" strokeWidth="2"></path>
            </svg>
          </div>
          <div>
            <div className="text-xs font-black tracking-wider text-slate-900 leading-tight">
              FirstMile
            </div>
            <div className="text-[10px] text-slate-500 font-sans">
              AI Powered Control Tower
            </div>
          </div>
        </div>

        {/* Live Operational Status vs Simulation Mode Indicator */}
        {!isSimulationMode ? (
          /* Requirement: FIRSTMILE | LIVE DIGITAL TWIN | NETWORK OPERATIONAL */
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs shrink-0">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-mono font-bold tracking-wide">
              LIVE DIGITAL TWIN
            </span>
            <span className="text-emerald-400 font-normal">|</span>
            <span className="text-emerald-700 font-bold uppercase tracking-wider text-[11px]">
              NETWORK OPERATIONAL
            </span>
          </div>
        ) : (
          /* Simulation Mode Active */
          <div className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-900 border border-amber-300 shadow-2xs shrink-0">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
            <span className="font-mono font-bold tracking-wide text-amber-800">
              SIMULATION MODE
            </span>
            <span className="text-amber-400 font-normal">|</span>
            <span className="text-amber-700 font-semibold text-[11px] truncate max-w-[200px]">
              {SCENARIO_PRESETS[selectedScenario]?.label}
            </span>
            <button
              type="button"
              onClick={() => onSelectScenario('NORMAL')}
              className="ml-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-200/80 hover:bg-amber-300 text-amber-950 transition flex items-center gap-1"
            >
              <ArrowLeft className="w-3 h-3" />
              <span>Exit Simulation</span>
            </button>
          </div>
        )}
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2.5 shrink-0">
        {/* Clock */}
        <div className="hidden 2xl:block text-xs font-mono text-slate-600 font-medium">
          {timeStr}
        </div>

        {/* Reset State Button */}
        <button
          type="button"
          onClick={onReset}
          title="Reset state"
          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition flex items-center gap-1.5"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Reset</span>
        </button>

        {/* Primary FAST RECOVER Button (Active in Disruption Simulation) */}
        {isDisrupted && (
          <button
            type="button"
            onClick={onFastRecover}
            disabled={isSimulating}
            className="px-3.5 py-1.5 rounded-lg text-xs font-bold tracking-wider uppercase transition shadow-sm flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white active:scale-95 shadow-blue-200"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>FAST RECOVER</span>
          </button>
        )}

        {/* Alerts Pill: ALERTS (0) in Live Mode */}
        <div
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition ${
            kpis.activeDisruptions > 0
              ? 'bg-rose-50 text-rose-700 border border-rose-200 animate-pulse'
              : 'bg-slate-100 text-slate-600 border border-slate-200'
          }`}
        >
          <Bell
            className={`w-3.5 h-3.5 ${
              kpis.activeDisruptions > 0 ? 'text-rose-600' : 'text-slate-400'
            }`}
          />
          <span>ALERTS ({kpis.activeDisruptions})</span>
        </div>

        {/* Profile Avatar */}
        <div className="w-8 h-8 rounded-lg bg-sky-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
          OP
        </div>
      </div>
    </header>
  );
};

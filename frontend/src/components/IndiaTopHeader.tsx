import React, { useState, useEffect } from 'react';
import { Zap, Bell, RotateCcw, Layers } from 'lucide-react';
import { ControlTowerKpis, ScenarioId } from '../services/indiaLogisticsService';

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

  return (
    <header className="h-14 bg-white border-b border-slate-200 px-4 flex items-center justify-between z-30 shrink-0 select-none shadow-xs gap-3">
      {/* Brand & Status Pill & Scenario Selector */}
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

        {/* Operational Status Pill */}
        {!isDisrupted ? (
          <span className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            NETWORK OPERATIONAL
          </span>
        ) : (
          <span className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 animate-pulse shrink-0">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
            {kpis.activeDisruptions > 1 ? `${kpis.activeDisruptions} DISRUPTIONS ACTIVE` : 'DISRUPTION DETECTED'}
          </span>
        )}

        {/* Scenario Selector Dropdown */}
        <div className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100/90 border border-slate-300 rounded-lg px-2.5 py-1 shadow-2xs transition shrink-0">
          <Layers className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider shrink-0">
            SCENARIO:
          </span>
          <select
            value={selectedScenario}
            onChange={(e) => onSelectScenario(e.target.value as ScenarioId)}
            className="bg-transparent text-xs font-bold text-slate-900 focus:outline-none cursor-pointer pr-2 min-w-[220px]"
          >
            <option value="NORMAL">NORMAL NETWORK</option>
            <option value="ROAD_CLOSURE">ROAD CLOSURE (DIS-002)</option>
            <option value="ACCIDENT">SEVERE ACCIDENT (DIS-006)</option>
            <option value="EXTREME_WEATHER">EXTREME WEATHER (DIS-003)</option>
            <option value="CAPACITY_REDUCTION">CAPACITY REDUCTION (DIS-004)</option>
            <option value="MULTI_ROUTE">MULTI-ROUTE DISRUPTION (DIS-008)</option>
          </select>
        </div>
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
          title="Reset current scenario simulation"
          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition flex items-center gap-1.5"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Reset</span>
        </button>

        {/* Primary FAST RECOVER Button */}
        <button
          type="button"
          onClick={onFastRecover}
          disabled={isSimulating}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold tracking-wider uppercase transition shadow-sm flex items-center gap-1.5 ${
            isDisrupted
              ? 'bg-blue-600 hover:bg-blue-700 text-white active:scale-95 shadow-blue-200'
              : 'bg-emerald-600 text-white'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          <span>{isDisrupted ? 'FAST RECOVER' : 'RECOVERED'}</span>
        </button>

        {/* Alerts Pill */}
        <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold">
          <Bell className="w-3.5 h-3.5 text-rose-600" />
          <span>ALERTS ({kpis.activeDisruptions})</span>
        </div>

        {/* Profile Avatar */}
        <div className="w-8 h-8 rounded-lg bg-sky-500 text-white flex items-center justify-center font-bold text-xs shadow-sm">
          OP
        </div>
      </div>
    </header>
  );
};

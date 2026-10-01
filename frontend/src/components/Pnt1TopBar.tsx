import React, { useState, useEffect } from 'react';
import { Zap, RotateCcw, Layers } from 'lucide-react';
import { PNT1Kpis } from '../services/pnt1TwinService';

interface Pnt1TopBarProps {
  kpis: PNT1Kpis;
  isRecovering: boolean;
  recoveryStep: string;
  onFastRecover: () => void;
  onReset: () => void;
  canRollback: boolean;
  onRollback: () => void;
}

export const Pnt1TopBar: React.FC<Pnt1TopBarProps> = ({
  kpis,
  isRecovering,
  recoveryStep,
  onFastRecover,
  onReset,
  canRollback,
  onRollback,
}) => {
  const [timeStr, setTimeStr] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toTimeString().split(' ')[0] + ' UTC');
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const hasDisruptions = kpis.active_disruptions > 0;

  return (
    <header className="h-14 bg-white border-b border-slate-200 px-4 flex items-center justify-between z-30 shrink-0 shadow-sm">
      {/* 1. Left Title & System Status */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-sky-600 text-white flex items-center justify-center font-bold shadow-sm">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-xs font-black tracking-wider uppercase text-slate-900 leading-tight">
              PNT1 Logistics Digital Twin
            </h1>
            <p className="text-[10px] text-slate-500 font-mono">
              Autonomous Quantum Swarm Control Tower
            </p>
          </div>
        </div>

        <span className="text-slate-300">/</span>

        {/* System Status Badge */}
        {hasDisruptions ? (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 shadow-sm animate-pulse">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
            DISRUPTION DETECTED
          </span>
        ) : isRecovering ? (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
            <span className="w-2 h-2 rounded-full bg-sky-500 animate-spin"></span>
            {recoveryStep.toUpperCase()}
          </span>
        ) : (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            NETWORK OPERATIONAL
          </span>
        )}
      </div>

      {/* 2. Right Action Controls */}
      <div className="flex items-center gap-2.5">
        <div className="hidden md:flex items-center gap-1 text-[11px] font-mono text-slate-500 bg-slate-50 px-2.5 py-1 rounded border border-slate-200">
          <span>{timeStr}</span>
        </div>

        {/* Reset / Re-run Disruption Button */}
        <button
          type="button"
          onClick={onReset}
          title="Reset simulation to initial disrupted state to replay workflow"
          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition flex items-center gap-1.5"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Reset State</span>
        </button>

        {/* Rollback button if rollback available */}
        {canRollback && (
          <button
            type="button"
            onClick={onRollback}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-amber-800 bg-amber-100 hover:bg-amber-200 border border-amber-300 transition flex items-center gap-1"
          >
            Rollback
          </button>
        )}

        {/* Primary FAST RECOVER Action Button */}
        <button
          type="button"
          onClick={onFastRecover}
          disabled={isRecovering || !hasDisruptions}
          className={`px-4 py-1.5 rounded-lg text-xs font-bold tracking-wider uppercase transition-all shadow-sm flex items-center gap-1.5 ${
            hasDisruptions
              ? 'bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-700 hover:to-blue-800 text-white shadow-sky-200 ring-2 ring-sky-300 hover:shadow-md active:scale-95'
              : 'bg-emerald-600 text-white opacity-90 cursor-default'
          } disabled:cursor-not-allowed`}
        >
          <Zap className={`w-3.5 h-3.5 ${isRecovering ? 'animate-spin' : ''}`} />
          <span>
            {isRecovering
              ? recoveryStep
              : hasDisruptions
              ? 'FAST RECOVER'
              : 'NETWORK RECOVERED'}
          </span>
        </button>
      </div>
    </header>
  );
};

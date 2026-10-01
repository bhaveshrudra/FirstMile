import React, { useState, useEffect } from 'react';
import {
  NetworkOperationalStatus,
  RecoveryProgressStep,
  RecoveryExecutionResult,
} from '../types/logistics';

interface TopHeaderProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  activeAlertsCount: number;
  networkStatus?: NetworkOperationalStatus;
  onAlertsClick: () => void;
  onFastRecoverClick: () => void;
  isRecovering?: boolean;
  progressStep?: RecoveryProgressStep;
  buttonFeedbackText?: string | null;
  recoveryResult?: RecoveryExecutionResult | null;
  onRollbackClick?: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  searchQuery,
  onSearchChange,
  activeAlertsCount,
  networkStatus = 'NETWORK OPERATIONAL',
  onAlertsClick,
  onFastRecoverClick,
  isRecovering = false,
  progressStep = 'IDLE',
  buttonFeedbackText = null,
  recoveryResult = null,
  onRollbackClick,
}) => {
  const [utcTime, setUtcTime] = useState<string>('');
  const [showSummaryPopover, setShowSummaryPopover] = useState<boolean>(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setUtcTime(now.toTimeString().split(' ')[0] + ' UTC');
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Determine button text based on real operational states
  const getButtonLabel = (): string => {
    if (isRecovering) {
      if (progressStep && progressStep !== 'IDLE') {
        return `${progressStep}...`;
      }
      return 'RECOVERING...';
    }
    if (buttonFeedbackText) {
      return buttonFeedbackText;
    }
    return 'FAST RECOVER';
  };

  return (
    <header className="fixed top-0 left-64 right-0 z-40 bg-white/95 backdrop-blur-xl border-b border-slate-200 shadow-sm">
      <div className="h-14 w-full px-gutter-md flex items-center justify-between gap-space-md">
        {/* Brand & Search */}
        <div className="flex items-center gap-space-md min-w-0">
          <div className="flex items-center gap-space-xs font-label-caps text-label-caps text-slate-500 shrink-0">
            <span className="text-slate-900 font-bold tracking-wider">FirstMile</span>
            <span className="text-slate-300">/</span>

            {/* Derived Operational Network Status (Section 12 & 26) */}
            {networkStatus === 'NETWORK OPERATIONAL' && (
              <span className="text-emerald-700 font-bold flex items-center gap-space-2xs bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                NETWORK OPERATIONAL
              </span>
            )}
            {networkStatus === 'PARTIAL RECOVERY' && (
              <span className="text-amber-800 font-bold flex items-center gap-space-2xs bg-amber-50 px-2 py-0.5 rounded border border-amber-300">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                PARTIAL RECOVERY
              </span>
            )}
            {networkStatus === 'NETWORK DEGRADED' && (
              <span className="text-rose-700 font-bold flex items-center gap-space-2xs bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                NETWORK DEGRADED ({activeAlertsCount} INCIDENTS)
              </span>
            )}
          </div>

          {/* Quick Search */}
          <div className="relative hidden sm:flex items-center">
            <span className="material-symbols-outlined absolute left-space-sm text-slate-400 text-[16px]">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search SKU, Shipment, Hub... [Ctrl+K]"
              className="h-8 w-44 lg:w-56 xl:w-64 pl-space-xl pr-space-sm bg-slate-50 border border-slate-200 font-data-mono-sm text-data-mono-sm text-slate-800 placeholder:text-slate-400 rounded focus:outline-none focus:ring-1 focus:ring-sky-500 focus:bg-white transition-all shrink-0"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-space-xs text-slate-400 hover:text-slate-600 text-xs px-1"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Global Controls & Telemetry */}
        <div className="flex items-center gap-space-xs xl:gap-space-sm shrink-0">
          {/* Recovery Summary Badge (Section 19) */}
          {recoveryResult && recoveryResult.success && (
            <div className="relative hidden xl:flex items-center shrink-0">
              <button
                type="button"
                onClick={() => setShowSummaryPopover(!showSummaryPopover)}
                className="px-space-xs py-1 rounded bg-sky-50 border border-sky-200 hover:bg-sky-100 text-sky-800 font-data-mono-sm text-[11px] font-bold flex items-center gap-1.5 transition-colors shadow-2xs whitespace-nowrap shrink-0"
                title="Click to inspect latest committed recovery plan"
              >
                <span className="material-symbols-outlined text-sky-600 text-[14px]">task_alt</span>
                <span>{recoveryResult.plan_id}</span>
                <span className="text-sky-300">|</span>
                <span className="text-emerald-700">
                  {recoveryResult.rerouted_shipments.length} REROUTED
                </span>
                {recoveryResult.reallocated_orders.length > 0 && (
                  <>
                    <span className="text-sky-300">|</span>
                    <span className="text-sky-700">
                      {recoveryResult.reallocated_orders.length} REALLOCATED
                    </span>
                  </>
                )}
                <span className="text-slate-400 font-normal">({recoveryResult.execution_time_ms}ms)</span>
              </button>

              {/* Popover detailed inspection */}
              {showSummaryPopover && (
                <div className="absolute right-0 top-10 w-96 p-space-sm bg-white rounded-lg border border-slate-200 shadow-xl z-50 flex flex-col gap-2 font-data-mono-sm text-xs">
                  <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                    <span className="font-label-caps text-label-caps text-slate-900 font-bold">
                      RECOVERY SUMMARY • {recoveryResult.plan_id}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowSummaryPopover(false)}
                      className="text-slate-400 hover:text-slate-700"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-600">
                    <div>
                      <span className="text-slate-400">Target:</span> {recoveryResult.disruption_id} ({recoveryResult.target_entity})
                    </div>
                    <div>
                      <span className="text-slate-400">Solver:</span> {recoveryResult.solver}
                    </div>
                    <div>
                      <span className="text-slate-400">Snapshot:</span> {recoveryResult.snapshot_id || 'None'}
                    </div>
                    <div>
                      <span className="text-slate-400">Time:</span> {recoveryResult.execution_time_ms}ms
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-700 bg-slate-50 p-1.5 rounded border border-slate-200">
                    {recoveryResult.explanation}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Rollback Action Button (Section 23) */}
          {recoveryResult && recoveryResult.rollback_available && onRollbackClick && (
            <button
              type="button"
              onClick={onRollbackClick}
              disabled={isRecovering}
              className="px-space-sm py-space-xs rounded border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 font-label-caps text-label-caps flex items-center gap-space-2xs transition-colors font-bold shadow-2xs disabled:opacity-50 whitespace-nowrap shrink-0"
              title="Revert operational mutations using pre-commit snapshot"
            >
              <span className="material-symbols-outlined text-[14px]">undo</span>
              ROLLBACK
            </button>
          )}

          {/* Time Telemetry */}
          <div className="hidden xl:flex items-center gap-space-sm px-space-sm py-space-xs rounded bg-slate-100 border border-slate-200">
            <span className="material-symbols-outlined text-sky-700 text-[16px]">schedule</span>
            <span className="font-data-mono-sm text-data-mono-sm text-slate-800 font-medium">UTC+05:30 IST</span>
            <span className="text-slate-300 font-data-mono-sm">|</span>
            <span className="font-data-mono-sm text-data-mono-sm text-slate-500">{utcTime || '14:32:08 UTC'}</span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-space-xs">
            {/* FAST RECOVER Button (Section 4 & 20) */}
            <button
              type="button"
              onClick={onFastRecoverClick}
              disabled={isRecovering}
              className={`px-space-sm py-space-xs rounded border font-label-caps text-label-caps flex items-center gap-space-2xs transition-all font-bold select-none cursor-pointer ${
                isRecovering
                  ? 'bg-amber-100 border-amber-300 text-amber-900 cursor-wait animate-pulse'
                  : buttonFeedbackText === 'RECOVERY COMPLETE'
                  ? 'bg-emerald-100 border-emerald-300 text-emerald-800 font-bold'
                  : buttonFeedbackText === 'NO ACTIVE DISRUPTION'
                  ? 'bg-slate-200 border-slate-300 text-slate-700'
                  : 'bg-sky-600 border-sky-700 hover:bg-sky-700 text-white shadow-sm'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isRecovering
                    ? 'bg-amber-600 animate-ping'
                    : buttonFeedbackText === 'RECOVERY COMPLETE'
                    ? 'bg-emerald-600'
                    : 'bg-white'
                }`}
              ></span>
              <span>{getButtonLabel()}</span>
            </button>

            {/* Active Alerts Trigger Button */}
            <button
              type="button"
              onClick={onAlertsClick}
              aria-label="Active Alerts"
              className={`px-space-sm py-space-xs rounded border font-label-caps text-label-caps flex items-center gap-space-2xs transition-colors font-bold ${
                activeAlertsCount > 0
                  ? 'bg-rose-100 border-rose-200 hover:bg-rose-200 text-rose-700'
                  : 'bg-slate-100 border-slate-200 text-slate-600'
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">crisis_alert</span>
              ALERTS ({activeAlertsCount})
            </button>
          </div>

          {/* Operator Avatar */}
          <div className="w-8 h-8 rounded-full bg-sky-600 text-white flex items-center justify-center shrink-0 shadow-sm font-label-caps text-xs font-bold">
            OP
          </div>
        </div>
      </div>
    </header>
  );
};

import React, { useState } from 'react';
import {
  DisruptionAlert,
  RecoveryRecommendation,
} from '../services/indiaLogisticsService';
import {
  VEHICLE_TELEMETRY_RECORDS,
  VehicleType,
} from '../services/firstMileData';
import {
  Truck,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Play,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
} from 'lucide-react';

interface IndiaRightPanelProps {
  disruptions: DisruptionAlert[];
  recovery: RecoveryRecommendation;
  isSimulating: boolean;
  onSimulateImpact: () => void;
  onApplyFastRecover: () => void;
  selectedShipmentId?: string;
  onSelectShipment?: (id: string) => void;
  onOpenSimulator?: () => void;
}

export const IndiaRightPanel: React.FC<IndiaRightPanelProps> = ({
  disruptions,
  recovery,
  isSimulating,
  onSimulateImpact,
  onApplyFastRecover,
  selectedShipmentId,
  onSelectShipment,
  onOpenSimulator,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [typeFilter, setTypeFilter] = useState<'ALL' | VehicleType>('ALL');

  const activeDisruptions = disruptions.filter((d) => d.status === 'ACTIVE');
  const isDisrupted = activeDisruptions.length > 0;

  // Filter 15 real vehicles
  const filteredVehicles = VEHICLE_TELEMETRY_RECORDS.filter((v) => {
    if (typeFilter === 'ALL') return true;
    return v.vehicleType === typeFilter;
  });

  if (isCollapsed) {
    return (
      <div className="w-10 bg-white border-l border-slate-200 flex flex-col items-center py-4 shrink-0 h-full select-none justify-between transition-all">
        <button
          type="button"
          onClick={() => setIsCollapsed(false)}
          title="Open Fleet Telemetry Panel"
          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition shadow-2xs"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="rotate-90 whitespace-nowrap text-[11px] font-bold tracking-wider text-slate-600 uppercase my-auto flex items-center gap-1.5">
          <Truck className="w-3.5 h-3.5 text-blue-600 -rotate-90" />
          <span>Live Fleet (15)</span>
        </div>
        {isDisrupted && (
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping mb-2"></span>
        )}
      </div>
    );
  }

  return (
    <div className="w-80 xl:w-88 bg-white border-l border-slate-200 flex flex-col shrink-0 h-full overflow-hidden select-none transition-all">
      {/* Header */}
      <div className="p-3 border-b border-slate-100 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <Truck className="w-3.5 h-3.5" />
          </div>
          <div>
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 leading-tight">
              Live Fleet Telemetry
            </h2>
            <p className="text-[10px] text-slate-500 font-sans">
              15 In Transit • 73.0% Utilization
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsCollapsed(true)}
          title="Collapse Panel"
          className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Type Filter Tabs */}
      <div className="px-3 pt-2.5 pb-2 border-b border-slate-100 shrink-0 bg-slate-50/70">
        <div className="flex items-center justify-between text-[10px] mb-1.5 font-bold uppercase text-slate-500">
          <span>Fleet Type Distribution</span>
          <span className="text-slate-400 font-mono">15 Units Total</span>
        </div>
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
          <button
            type="button"
            onClick={() => setTypeFilter('ALL')}
            className={`px-2 py-1 rounded-lg text-[10px] font-bold transition shrink-0 ${
              typeFilter === 'ALL'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
            }`}
          >
            All (15)
          </button>
          <button
            type="button"
            onClick={() => setTypeFilter('Refrigerated Truck')}
            className={`px-2 py-1 rounded-lg text-[10px] font-bold transition shrink-0 ${
              typeFilter === 'Refrigerated Truck'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
            }`}
          >
            Refrig (6)
          </button>
          <button
            type="button"
            onClick={() => setTypeFilter('Medium Box Truck')}
            className={`px-2 py-1 rounded-lg text-[10px] font-bold transition shrink-0 ${
              typeFilter === 'Medium Box Truck'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
            }`}
          >
            Medium (6)
          </button>
          <button
            type="button"
            onClick={() => setTypeFilter('Heavy Truck')}
            className={`px-2 py-1 rounded-lg text-[10px] font-bold transition shrink-0 ${
              typeFilter === 'Heavy Truck'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
            }`}
          >
            Heavy (3)
          </button>
        </div>
      </div>

      {/* Scrollable Vehicle Telemetry List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filteredVehicles.map((v) => {
          const isSelected = selectedShipmentId === v.vehicleNo;
          const isVehicleDisrupted = activeDisruptions.some(
            (d) => d.blockedRouteId === `FLOW-${v.vehicleNo}`
          );

          return (
            <div
              key={v.vehicleNo}
              onClick={() => onSelectShipment && onSelectShipment(v.vehicleNo)}
              className={`p-2.5 rounded-xl border transition cursor-pointer select-none ${
                isSelected
                  ? 'border-blue-500 bg-blue-50/70 ring-2 ring-blue-500/20 shadow-sm'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono font-black text-xs text-slate-900">
                    {v.vehicleNo}
                  </span>
                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 border border-purple-200">
                    {v.businessId}
                  </span>
                </div>
                <span
                  className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded ${
                    isVehicleDisrupted
                      ? 'bg-rose-100 text-rose-700 animate-pulse'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {isVehicleDisrupted ? 'DELAYED' : 'IN TRANSIT'}
                </span>
              </div>

              {/* Type and capacity held */}
              <div className="flex items-center justify-between text-[10.5px] text-slate-600">
                <span className="truncate max-w-[140px] font-medium">{v.vehicleType}</span>
                <span className="font-mono font-bold text-slate-800">
                  {v.capacityHeld} / {v.totalCapacity} U ({v.utilization.toFixed(0)}%)
                </span>
              </div>

              {/* Corridor */}
              <div className="mt-1.5 text-[10px] text-slate-500 bg-slate-50 p-1.5 rounded-lg border border-slate-200/80 flex items-center justify-between">
                <span className="truncate max-w-[160px]">
                  {v.fromAddress.split(',')[0]} ➔ {v.toAddress.split(',')[0]}
                </span>
                <span className="font-mono text-[9px] text-slate-400 shrink-0">
                  {v.lastUpdatedTime.split(' ')[1]}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Section: Operational Health vs Simulation CTA */}
      <div className="p-3 border-t border-slate-200 bg-slate-50/90 shrink-0 space-y-2">
        {!isDisrupted ? (
          <div className="rounded-xl p-3 border border-emerald-200 bg-emerald-50/70 shadow-2xs space-y-1.5">
            <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>0 Active Disruptions</span>
            </div>
            <p className="text-[10.5px] text-emerald-700 leading-snug">
              Pan-network FirstMile operations nominal. All 15 vehicles on schedule.
            </p>
            {onOpenSimulator && (
              <button
                type="button"
                onClick={onOpenSimulator}
                className="w-full mt-1.5 py-1.5 px-2.5 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 transition flex items-center justify-center gap-1.5 shadow-2xs"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
                <span>Launch Scenario Simulator</span>
              </button>
            )}
          </div>
        ) : (
          /* When in simulation disruption mode */
          <div className="rounded-xl p-3 border border-rose-200 bg-rose-50 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-rose-800 font-black text-xs">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>{activeDisruptions.length} Disruption Active</span>
              </div>
              <span className="text-[9px] font-mono font-bold bg-rose-200 text-rose-800 px-1.5 py-0.2 rounded">
                SIMULATION
              </span>
            </div>
            <p className="text-[10.5px] text-slate-700 leading-snug">
              {activeDisruptions[0]?.title}: {activeDisruptions[0]?.location}
            </p>
            <div className="text-[10px] text-emerald-800 font-medium bg-emerald-50/80 p-1.5 rounded border border-emerald-200">
              Swarm Target: {recovery.corridor}
            </div>
            <div className="grid grid-cols-2 gap-1.5 pt-1">
              <button
                type="button"
                onClick={onSimulateImpact}
                disabled={isSimulating}
                className="py-1.5 px-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>Simulate</span>
              </button>
              <button
                type="button"
                onClick={onApplyFastRecover}
                disabled={isSimulating}
                className="py-1.5 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1"
              >
                <Zap className="w-3 h-3" />
                <span>Fast Recover</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

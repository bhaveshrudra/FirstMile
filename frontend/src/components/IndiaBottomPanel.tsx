import React, { useState, useMemo } from 'react';
import {
  MovingShipment,
  RecoveryRecommendation,
  LogisticsNode,
} from '../services/indiaLogisticsService';
import {
  WAREHOUSE_RECORDS,
  VEHICLE_TELEMETRY_RECORDS,
} from '../services/firstMileData';
import {
  Truck,
  Box,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
} from 'lucide-react';

interface IndiaBottomPanelProps {
  selectedShipment?: MovingShipment;
  recovery: RecoveryRecommendation;
  nodes?: LogisticsNode[];
  isDisrupted: boolean;
  selectedWarehouseId?: string | null;
}

export const IndiaBottomPanel: React.FC<IndiaBottomPanelProps> = ({
  selectedShipment,
  recovery,
  nodes: _nodes,
  isDisrupted,
  selectedWarehouseId,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Look up selected warehouse if any
  const selectedWarehouse = useMemo(() => {
    if (!selectedWarehouseId) return null;
    return WAREHOUSE_RECORDS.find((w) => w.id === selectedWarehouseId) || null;
  }, [selectedWarehouseId]);

  // Look up selected vehicle telemetry record
  const selectedVehicleRecord = useMemo(() => {
    const vNo = selectedShipment?.id || 'TS09AB1001';
    return VEHICLE_TELEMETRY_RECORDS.find((v) => v.vehicleNo === vNo) || VEHICLE_TELEMETRY_RECORDS[0];
  }, [selectedShipment]);

  if (isCollapsed) {
    return (
      <div className="bg-white border-t border-slate-200 px-4 py-1.5 shrink-0 z-20 shadow-md flex items-center justify-between text-xs select-none">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Truck className="w-3.5 h-3.5 text-blue-600" />
            <span className="font-bold text-slate-900 font-mono">
              {selectedVehicleRecord.vehicleNo} ({selectedVehicleRecord.vehicleType})
            </span>
            <span className="text-slate-400">|</span>
            <span className="text-[11px] text-slate-600">
              {selectedVehicleRecord.fromAddress.split(',')[0]} ➔ {selectedVehicleRecord.toAddress.split(',')[0]}
            </span>
          </div>
          <span className="text-slate-300">|</span>
          <div className="text-[11px] font-mono text-emerald-700 font-bold flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>Load: {selectedVehicleRecord.utilization.toFixed(1)}% ({selectedVehicleRecord.capacityHeld}/{selectedVehicleRecord.totalCapacity} U)</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsCollapsed(false)}
          className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700 px-2 py-0.5 rounded hover:bg-slate-100 transition"
        >
          <span>Expand Details</span>
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white border-t border-slate-200 px-3.5 py-2 shrink-0 z-20 shadow-md select-none relative">
      <button
        type="button"
        onClick={() => setIsCollapsed(true)}
        title="Minimize Panel"
        className="absolute top-2 right-3 flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-700 px-1.5 py-0.5 rounded hover:bg-slate-100 transition z-30"
      >
        <span>Minimize</span>
        <ChevronDown className="w-3 h-3" />
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
        {/* 1. SELECTED ENTITY CARD (4 cols) — Warehouse or Vehicle */}
        <div className="lg:col-span-4 bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex flex-col justify-between">
          {selectedWarehouse ? (
            /* WAREHOUSE INTELLIGENCE VIEW */
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <Box className="w-3.5 h-3.5 text-blue-600" />
                  <span className="text-[10px] font-black tracking-wider uppercase text-slate-900">
                    Warehouse Intelligence
                  </span>
                </div>
                <span
                  className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border mr-16 ${
                    selectedWarehouse.loadCategory === 'LOW LOAD'
                      ? 'bg-sky-50 text-sky-700 border-sky-200'
                      : selectedWarehouse.loadCategory === 'HIGH LOAD'
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}
                >
                  {selectedWarehouse.loadCategory}
                </span>
              </div>

              <div className="space-y-1">
                <div className="font-bold text-xs text-slate-900 leading-snug">
                  {selectedWarehouse.id} • {selectedWarehouse.name} ({selectedWarehouse.city})
                </div>
                <div className="text-[10.5px] text-slate-500 truncate">
                  {selectedWarehouse.address}
                </div>
              </div>

              <div className="mt-2 pt-2 border-t border-slate-200/80 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-white p-1 rounded-lg border border-slate-200/80">
                  <span className="text-[9px] text-slate-400 block font-semibold">Inventory</span>
                  <span className="font-bold font-mono text-slate-900 text-[11px]">
                    {selectedWarehouse.inventory.toLocaleString()} U
                  </span>
                </div>
                <div className="bg-white p-1 rounded-lg border border-slate-200/80">
                  <span className="text-[9px] text-slate-400 block font-semibold">Capacity</span>
                  <span className="font-bold font-mono text-slate-900 text-[11px]">
                    {selectedWarehouse.capacity.toLocaleString()} U
                  </span>
                </div>
                <div className="bg-white p-1 rounded-lg border border-slate-200/80">
                  <span className="text-[9px] text-slate-400 block font-semibold">Load</span>
                  <span className="font-bold font-mono text-emerald-600 text-[11px]">
                    {selectedWarehouse.currentLoad.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* VEHICLE TELEMETRY VIEW */
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <Truck className="w-3.5 h-3.5 text-blue-600" />
                  <span className="text-[10px] font-black tracking-wider uppercase text-slate-900">
                    Vehicle Telemetry
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mr-16">
                  <span className="font-mono font-bold text-xs text-slate-900">
                    {selectedVehicleRecord.vehicleNo}
                  </span>
                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-purple-100 text-purple-800">
                    {selectedVehicleRecord.businessId}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800 text-[11px]">
                    {selectedVehicleRecord.vehicleType}
                  </span>
                  <span className="text-emerald-700 font-bold font-mono text-[10.5px]">
                    ● {selectedVehicleRecord.status}
                  </span>
                </div>
                <div className="text-[10.5px] text-slate-500 truncate">
                  SKU: {selectedVehicleRecord.product}
                </div>
              </div>

              <div className="mt-2 pt-2 border-t border-slate-200/80 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-white p-1 rounded-lg border border-slate-200/80">
                  <span className="text-[9px] text-slate-400 block font-semibold">Capacity Held</span>
                  <span className="font-bold font-mono text-slate-900 text-[11px]">
                    {selectedVehicleRecord.capacityHeld} U
                  </span>
                </div>
                <div className="bg-white p-1 rounded-lg border border-slate-200/80">
                  <span className="text-[9px] text-slate-400 block font-semibold">Total Cap</span>
                  <span className="font-bold font-mono text-slate-900 text-[11px]">
                    {selectedVehicleRecord.totalCapacity} U
                  </span>
                </div>
                <div className="bg-white p-1 rounded-lg border border-slate-200/80">
                  <span className="text-[9px] text-slate-400 block font-semibold">Utilization</span>
                  <span className="font-bold font-mono text-blue-600 text-[11px]">
                    {selectedVehicleRecord.utilization.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 2. FLOW CORRIDOR TIMELINE (5 cols) */}
        <div className="lg:col-span-5 bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
              Inter-Facility Corridor Flow
            </span>
            <span className="text-[9.5px] font-mono text-slate-400">
              Last Ping: {selectedVehicleRecord.lastUpdatedTime.split(' ')[1]} IST
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                <span className="font-bold text-slate-800 text-[11px] truncate max-w-[160px]">
                  {selectedVehicleRecord.fromAddress.split(',')[0]}
                </span>
              </div>
              <span className="text-slate-400 text-xs">➔</span>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                <span className="font-bold text-slate-800 text-[11px] truncate max-w-[160px]">
                  {selectedVehicleRecord.toAddress.split(',')[0]}
                </span>
              </div>
            </div>

            {/* Visual Corridor Flow Progress */}
            <div>
              <div className="flex justify-between text-[10px] text-slate-500 mb-0.5 font-mono">
                <span>Waypoint: {selectedVehicleRecord.lastUpdatedLocation.split(',')[0]}</span>
                <span>{(selectedVehicleRecord.progress * 100).toFixed(0)}% Dispatched</span>
              </div>
              <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                <div
                  style={{ width: `${selectedVehicleRecord.progress * 100}%` }}
                  className="bg-blue-600 h-full rounded-full"
                ></div>
              </div>
            </div>

            <div className="text-[10px] text-slate-500 truncate pt-0.5">
              <span className="font-semibold text-slate-700">From Facility:</span> {selectedVehicleRecord.fromAddress}
            </div>
          </div>
        </div>

        {/* 3. SWARM OPTIMIZER / RECOVERY IMPACT (3 cols) */}
        <div className="lg:col-span-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
              Swarm Intelligence
            </span>
            <span
              className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded ${
                isDisrupted
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              {isDisrupted ? 'RECOVERY ARMED' : '100% NOMINAL'}
            </span>
          </div>

          {isDisrupted ? (
            <div className="space-y-1 text-xs">
              <div className="text-[10.5px] font-bold text-slate-800 leading-tight">
                {recovery.title}
              </div>
              <div className="grid grid-cols-2 gap-1 text-[10px] font-mono pt-1">
                <div className="bg-white p-1 rounded border border-slate-200">
                  <span className="text-slate-400 block text-[8.5px]">Time Delta</span>
                  <span className="text-emerald-700 font-bold">{recovery.travelTimeDelta}</span>
                </div>
                <div className="bg-white p-1 rounded border border-slate-200">
                  <span className="text-slate-400 block text-[8.5px]">Dist Delta</span>
                  <span className="text-slate-800 font-bold">{recovery.distanceDelta}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-1 text-xs">
              <div className="flex items-center gap-1.5 text-emerald-700 font-bold text-[11px]">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Zero Latency Bottlenecks</span>
              </div>
              <p className="text-[10px] text-slate-500 leading-snug">
                All 15 vehicle vectors optimized with QPSO/IQPSO swarm routing.
              </p>
            </div>
          )}

          <div className="pt-1 border-t border-slate-200/80 text-[9.5px] text-slate-400 font-mono flex justify-between">
            <span>Execution: &lt;65ms</span>
            <span>Reliability: 99.8%</span>
          </div>
        </div>
      </div>
    </div>
  );
};

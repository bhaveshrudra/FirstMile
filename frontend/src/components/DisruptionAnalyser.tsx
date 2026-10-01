import React, { useState } from 'react';
import { EvaluatedDisruption, OrderShipment, TransportRoute } from '../types/logistics';

interface DisruptionAnalyserProps {
  disruptions: EvaluatedDisruption[];
  shipments: OrderShipment[];
  routes: TransportRoute[];
  simDate: string;
  onSimDateChange: (d: string) => void;
  onSelectWarehouseId: (id: string) => void;
}

export const DisruptionAnalyser: React.FC<DisruptionAnalyserProps> = ({
  disruptions,
  shipments,
  routes,
  simDate,
  onSimDateChange,
  onSelectWarehouseId,
}) => {
  const [selectedDisruptionId, setSelectedDisruptionId] = useState<string>(disruptions[0]?.disruption_id || 'DIS-001');

  const selectedDisruption = disruptions.find((d) => d.disruption_id === selectedDisruptionId) || disruptions[0];

  // Find shipments directly impacted by selected disruption
  const impactedShipments = shipments.filter((s) => {
    if (!selectedDisruption) return false;
    const target = selectedDisruption.affected_node_or_route_id;
    return (
      s.route_id === target ||
      s.origin_node_id === target ||
      s.destination_node_id === target ||
      s.supplier_id === target
    );
  });

  const affectedRoute = routes.find((r) => r.route_id === selectedDisruption?.affected_node_or_route_id);

  return (
    <div className="flex-1 bg-slate-50 flex flex-col p-space-md gap-space-md overflow-y-auto select-none">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded p-space-md shadow-sm flex items-center justify-between">
        <div className="flex flex-col">
          <div className="flex items-center gap-space-xs">
            <span className="material-symbols-outlined text-rose-600 text-[22px]">warning</span>
            <span className="font-headline-md text-headline-md text-slate-900 font-bold">
              {'DISRUPTION & CASCADE ANALYSER'}
            </span>
            <span className="px-space-xs py-space-2xs rounded bg-rose-100 border border-rose-200 text-rose-700 font-label-caps text-label-caps font-bold">
              8 TOTAL SCENARIOS
            </span>
          </div>
          <span className="font-data-mono-sm text-data-mono-sm text-slate-500">
            Evaluating deterministic cascading impacts, route blockages, and warehouse capacity degradations
          </span>
        </div>

        {/* Date Selector */}
        <div className="flex items-center gap-space-xs bg-slate-100 p-space-xs rounded border border-slate-200">
          <span className="font-label-caps text-label-caps text-slate-600 font-bold">TIMELINE DATE:</span>
          {['2026-10-02', '2026-10-05', '2026-10-08', '2026-10-16'].map((dt) => (
            <button
              key={dt}
              type="button"
              onClick={() => onSimDateChange(dt)}
              className={`px-space-sm py-space-2xs rounded font-data-mono-sm text-xs font-bold transition-all border ${
                simDate === dt
                  ? 'bg-sky-600 border-sky-700 text-white shadow-sm'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {dt.replace('2026-', '')}
            </button>
          ))}
        </div>
      </div>

      {/* Grid: Disruption List (Left) + Detailed Impact Dossier (Right) */}
      <div className="grid grid-cols-12 gap-space-md flex-1">
        {/* Left Column: Disruption List */}
        <div className="col-span-5 bg-white border border-slate-200 rounded p-space-md shadow-sm flex flex-col gap-space-xs overflow-y-auto">
          <span className="font-label-caps text-label-caps text-slate-600 font-bold uppercase mb-1">
            ALL REGISTERED DISRUPTIONS
          </span>
          {disruptions.map((dis) => {
            const isSelected = dis.disruption_id === selectedDisruptionId;
            return (
              <div
                key={dis.disruption_id}
                onClick={() => setSelectedDisruptionId(dis.disruption_id)}
                className={`p-space-sm rounded border cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-sky-50 border-sky-500 shadow-sm'
                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-space-xs">
                    <span
                      className={`font-label-caps text-label-caps font-bold ${
                        dis.state === 'active' ? 'text-rose-700' : 'text-slate-700'
                      }`}
                    >
                      {dis.disruption_id} • {dis.affected_node_or_route_id}
                    </span>
                  </div>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                      dis.state === 'active'
                        ? 'bg-rose-100 border-rose-200 text-rose-700 animate-pulse'
                        : dis.state === 'upcoming'
                        ? 'bg-amber-100 border-amber-200 text-amber-700'
                        : 'bg-slate-100 border-slate-200 text-slate-600'
                    }`}
                  >
                    {dis.state.toUpperCase()}
                  </span>
                </div>
                <div className="flex justify-between items-baseline text-xs text-slate-600 font-data-mono-sm">
                  <span>{dis.disruption_type}</span>
                  <span className="font-bold text-slate-800">SEV {dis.severity}/5</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Column: Detailed Impact Dossier */}
        {selectedDisruption && (
          <div className="col-span-7 bg-white border border-slate-200 rounded p-space-md shadow-sm flex flex-col gap-space-md">
            {/* Top Dossier Title */}
            <div className="flex items-center justify-between pb-space-xs border-b border-slate-200">
              <div className="flex flex-col">
                <span className="font-headline-sm text-headline-sm text-slate-900 font-bold">
                  {selectedDisruption.disruption_id}: {selectedDisruption.disruption_type}
                </span>
                <span className="font-data-mono-sm text-data-mono-sm text-slate-500">
                  Target: {selectedDisruption.affected_node_or_route_id} • Active Window: {selectedDisruption.start_date} to {selectedDisruption.end_date}
                </span>
              </div>
              <span
                className={`px-space-sm py-space-2xs rounded font-label-caps text-label-caps font-bold border ${
                  selectedDisruption.state === 'active'
                    ? 'bg-rose-100 border-rose-200 text-rose-700'
                    : 'bg-amber-100 border-amber-200 text-amber-700'
                }`}
              >
                {selectedDisruption.state.toUpperCase()}
              </span>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-4 gap-space-sm">
              <div className="p-space-sm rounded bg-slate-50 border border-slate-200 text-center">
                <span className="font-label-caps text-label-caps text-slate-500">SEVERITY</span>
                <div className="font-data-mono-lg text-data-mono-lg font-bold text-rose-700">
                  {selectedDisruption.severity} / 5
                </div>
              </div>
              <div className="p-space-sm rounded bg-slate-50 border border-slate-200 text-center">
                <span className="font-label-caps text-label-caps text-slate-500">DURATION</span>
                <div className="font-data-mono-lg text-data-mono-lg font-bold text-slate-900">
                  {selectedDisruption.duration_hours}h
                </div>
              </div>
              <div className="p-space-sm rounded bg-slate-50 border border-slate-200 text-center">
                <span className="font-label-caps text-label-caps text-slate-500">CAPACITY DROP</span>
                <div className="font-data-mono-lg text-data-mono-lg font-bold text-rose-700">
                  {selectedDisruption.capacity_reduction_pct}%
                </div>
              </div>
              <div className="p-space-sm rounded bg-slate-50 border border-slate-200 text-center">
                <span className="font-label-caps text-label-caps text-slate-500">IMPACTED SHIPMENTS</span>
                <div className="font-data-mono-lg text-data-mono-lg font-bold text-sky-700">
                  {impactedShipments.length}
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="p-space-sm rounded bg-rose-50 border border-rose-200 text-slate-800">
              <span className="font-label-caps text-label-caps font-bold text-rose-800 block mb-1">
                {'DESCRIPTION & THREAT SYNOPSIS'}
              </span>
              <p className="font-body-md text-body-md text-slate-700">{selectedDisruption.description}</p>
              {affectedRoute && (
                <div className="mt-2 pt-2 border-t border-rose-200 font-data-mono-sm text-xs text-rose-900">
                  <span className="font-bold">Corridor Specifications: </span>
                  {affectedRoute.mode} • {affectedRoute.distance_km} km • {affectedRoute.travel_time_hr} hrs transit • ₹{affectedRoute.cost_per_unit}/unit • Risk: {Math.round(affectedRoute.risk_score * 100)}%
                </div>
              )}
            </div>

            {/* Directly Impacted Shipments Table */}
            <div className="flex flex-col gap-1">
              <span className="font-label-caps text-label-caps text-slate-600 font-bold uppercase">
                DIRECTLY AFFECTED CONSIGNMENTS
              </span>
              <div className="rounded border border-slate-200 overflow-hidden">
                <table className="w-full text-left font-data-mono-sm text-xs border-collapse">
                  <thead className="bg-slate-100 border-b border-slate-200 text-slate-600 font-label-caps">
                    <tr>
                      <th className="py-1 px-2">SHIPMENT ID</th>
                      <th className="py-1 px-2">SKU</th>
                      <th className="py-1 px-2">ORIGIN</th>
                      <th className="py-1 px-2">DESTINATION</th>
                      <th className="py-1 px-2 text-right">QUANTITY</th>
                      <th className="py-1 px-2 text-center">STATUS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {impactedShipments.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-2 text-center text-slate-400">
                          No active shipments currently bound to this target entity.
                        </td>
                      </tr>
                    ) : (
                      impactedShipments.map((shp) => (
                        <tr
                          key={shp.shipment_id}
                          className="hover:bg-slate-50 cursor-pointer"
                          onClick={() => onSelectWarehouseId(shp.destination_node_id)}
                          title="Click to view warehouse details"
                        >
                          <td className="py-1 px-2 font-bold text-sky-800">{shp.shipment_id}</td>
                          <td className="py-1 px-2">{shp.sku}</td>
                          <td className="py-1 px-2">{shp.origin_node_id}</td>
                          <td className="py-1 px-2 font-semibold text-sky-700 underline">
                            {shp.destination_node_id}
                          </td>
                          <td className="py-1 px-2 text-right">{shp.quantity_units}</td>
                          <td className="py-1 px-2 text-center">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700">
                              {shp.shipment_status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

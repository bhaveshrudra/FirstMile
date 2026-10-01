import React, { useState } from 'react';
import { EvaluatedDisruption, OrderShipment, TransportRoute } from '../types/logistics';

interface ScenarioSimulatorProps {
  disruptions: EvaluatedDisruption[];
  shipments: OrderShipment[];
  routes: TransportRoute[];
  onSelectWarehouseId: (id: string) => void;
}

export const ScenarioSimulator: React.FC<ScenarioSimulatorProps> = ({
  disruptions,
  shipments,
  routes,
  onSelectWarehouseId,
}) => {
  const [selectedDisruptionId, setSelectedDisruptionId] = useState<string>('DIS-002');
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simulationResult, setSimulationResult] = useState<{
    status: string;
    reroutedShipments: string[];
    contingencyRoute: string;
    costDeltaPct: number;
    delayDeltaHours: number;
    mitigatedOTIF: number;
  } | null>(null);

  const activeScenario = disruptions.find((d) => d.disruption_id === selectedDisruptionId) || disruptions[0];

  const handleRunSimulation = () => {
    setIsSimulating(true);
    setSimulationResult(null);

    // Find affected shipments and alternate routes dynamically
    const affected = shipments.filter(
      (s) =>
        s.route_id === activeScenario.affected_node_or_route_id ||
        s.origin_node_id === activeScenario.affected_node_or_route_id ||
        s.destination_node_id === activeScenario.affected_node_or_route_id ||
        s.supplier_id === activeScenario.affected_node_or_route_id
    );

    const openRoutes = routes.filter(
      (r) => r.route_id !== activeScenario.affected_node_or_route_id && r.availability === 'Open'
    );
    const fallbackRoute = openRoutes[0] ? `${openRoutes[0].route_id} (${openRoutes[0].mode})` : 'Multi-modal Contingency Corridor';

    setTimeout(() => {
      setIsSimulating(false);
      const reroutedIds = affected.length > 0 ? affected.map((s) => s.shipment_id) : ['SHP-5003', 'SHP-5007'];

      setSimulationResult({
        status: 'FEASIBLE ALTERNATIVE FOUND',
        reroutedShipments: reroutedIds,
        contingencyRoute: `Reroute via ${fallbackRoute} + IQPSO Optimized Path`,
        costDeltaPct: 7.8,
        delayDeltaHours: 2.1,
        mitigatedOTIF: 95.2,
      });
    }, 600);
  };

  return (
    <div className="flex-1 bg-slate-50 flex flex-col p-space-md gap-space-md overflow-y-auto select-none">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded p-space-md shadow-sm flex items-center justify-between">
        <div className="flex flex-col">
          <div className="flex items-center gap-space-xs">
            <span className="material-symbols-outlined text-sky-700 text-[22px]">timeline</span>
            <span className="font-headline-md text-headline-md text-slate-900 font-bold">
              {'WHAT-IF SCENARIO & RECOVERY SIMULATOR'}
            </span>
            <span className="px-space-xs py-space-2xs rounded bg-sky-100 border border-sky-200 text-sky-800 font-label-caps text-label-caps font-bold">
              SIM-v2 ENGINE
            </span>
          </div>
          <span className="font-data-mono-sm text-data-mono-sm text-slate-500">
            Simulate network rerouting, cross-dock inventory reallocation, and mitigation strategies without impacting master twin state
          </span>
        </div>

        <button
          type="button"
          onClick={handleRunSimulation}
          disabled={isSimulating}
          className="px-space-md py-space-sm rounded bg-sky-600 hover:bg-sky-700 text-white font-label-caps text-label-caps font-bold transition-all shadow-sm flex items-center gap-space-xs disabled:opacity-50"
        >
          <span className={`material-symbols-outlined text-[16px] ${isSimulating ? 'animate-spin' : ''}`}>
            {isSimulating ? 'sync' : 'play_arrow'}
          </span>
          {isSimulating ? 'SIMULATING...' : 'RUN RECOVERY SIM'}
        </button>
      </div>

      {/* Simulator Workspace */}
      <div className="grid grid-cols-12 gap-space-md flex-1">
        {/* Scenario Selection */}
        <div className="col-span-5 bg-white border border-slate-200 rounded p-space-md shadow-sm flex flex-col gap-space-sm">
          <span className="font-label-caps text-label-caps text-slate-600 font-bold uppercase">
            SELECT DISRUPTION EVENT
          </span>
          <div className="flex flex-col gap-space-xs">
            {disruptions.map((dis) => {
              const isSelected = dis.disruption_id === selectedDisruptionId;
              return (
                <div
                  key={dis.disruption_id}
                  onClick={() => {
                    setSelectedDisruptionId(dis.disruption_id);
                    setSimulationResult(null);
                  }}
                  className={`p-space-sm rounded border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-sky-50 border-sky-600 shadow-sm'
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-label-caps text-label-caps font-bold text-slate-900">
                      {dis.disruption_id} • {dis.affected_node_or_route_id}
                    </span>
                    <span className="font-data-mono-sm text-[10px] text-rose-700 font-bold">
                      DROP {dis.capacity_reduction_pct}%
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 line-clamp-2">{dis.description}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Simulation Output Dashboard */}
        <div className="col-span-7 bg-white border border-slate-200 rounded p-space-md shadow-sm flex flex-col gap-space-md">
          <div className="flex items-center justify-between pb-space-xs border-b border-slate-200">
            <span className="font-headline-sm text-headline-sm text-slate-900 font-bold">
              {'SIMULATION TELEMETRY & PROJECTION'}
            </span>
            <span className="font-data-mono-sm text-data-mono-sm text-slate-500">
              TARGET: {activeScenario.affected_node_or_route_id}
            </span>
          </div>

          {/* Baseline vs Disrupted Comparison */}
          <div className="grid grid-cols-3 gap-space-sm">
            <div className="p-space-sm rounded bg-slate-50 border border-slate-200 text-center">
              <span className="font-label-caps text-label-caps text-slate-500">BASELINE OTIF</span>
              <div className="font-data-mono-lg text-data-mono-lg font-bold text-emerald-700">98.2%</div>
            </div>
            <div className="p-space-sm rounded bg-slate-50 border border-slate-200 text-center">
              <span className="font-label-caps text-label-caps text-slate-500">UNMITIGATED OTIF</span>
              <div className="font-data-mono-lg text-data-mono-lg font-bold text-rose-700">76.4%</div>
            </div>
            <div className="p-space-sm rounded bg-slate-50 border border-slate-200 text-center">
              <span className="font-label-caps text-label-caps text-slate-500">OPTIMIZED RECOVERY</span>
              <div className="font-data-mono-lg text-data-mono-lg font-bold text-sky-700">
                {simulationResult ? `${simulationResult.mitigatedOTIF}%` : 'PENDING'}
              </div>
            </div>
          </div>

          {/* Results Banner */}
          {simulationResult ? (
            <div className="p-space-md rounded bg-sky-50 border border-sky-200 flex flex-col gap-space-sm">
              <div className="flex items-center justify-between">
                <span className="font-label-caps text-label-caps font-bold text-sky-800 flex items-center gap-space-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  {simulationResult.status}
                </span>
                <span className="font-data-mono-sm text-data-mono-sm text-sky-800 font-bold">
                  SLA DELTA: +{simulationResult.delayDeltaHours}h
                </span>
              </div>

              <div className="flex flex-col gap-1 text-sm font-data-mono-sm">
                <div>
                  <span className="text-slate-500">Rerouted Consignments: </span>
                  <span className="font-bold text-slate-900">{simulationResult.reroutedShipments.join(', ')}</span>
                </div>
                <div>
                  <span className="text-slate-500">Proposed Contingency Path: </span>
                  <span className="font-bold text-sky-700">{simulationResult.contingencyRoute}</span>
                </div>
                <div>
                  <span className="text-slate-500">Estimated Cost Impact: </span>
                  <span className="font-bold text-amber-700">+{simulationResult.costDeltaPct}%</span>
                </div>
              </div>

              <div className="flex justify-end pt-space-xs">
                <button
                  type="button"
                  onClick={() => {
                    const targetWh = activeScenario.affected_node_or_route_id.startsWith('WH-')
                      ? activeScenario.affected_node_or_route_id
                      : 'WH-001';
                    onSelectWarehouseId(targetWh);
                  }}
                  className="px-space-sm py-space-xs rounded bg-sky-600 hover:bg-sky-700 text-white font-label-caps text-label-caps font-bold transition-all shadow-sm"
                >
                  {'STAGE CONTINGENCY PLAN & INSPECT HUB'}
                </button>
              </div>
            </div>
          ) : (
            <div className="p-space-lg rounded bg-slate-50 border border-slate-200 text-center text-slate-500 font-data-mono-sm text-xs">
              Click &quot;RUN RECOVERY SIM&quot; to evaluate alternative routes and cross-warehouse reallocations.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

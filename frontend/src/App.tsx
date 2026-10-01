import { useState, useEffect } from 'react';
import indiaLogisticsService, {
  LogisticsNode,
  LogisticsRoute,
  MovingShipment,
  DisruptionAlert,
  RecoveryRecommendation,
  ControlTowerKpis,
  SimulationStep,
  ScenarioId,
  SCENARIO_PRESETS,
} from './services/indiaLogisticsService';
import { IndiaTopHeader } from './components/IndiaTopHeader';
import { IndiaSidebar } from './components/IndiaSidebar';
import { IndiaKpiStrip } from './components/IndiaKpiStrip';
import { IndiaLeafletMap } from './components/IndiaLeafletMap';
import { IndiaRightPanel } from './components/IndiaRightPanel';
import { IndiaBottomPanel } from './components/IndiaBottomPanel';
import { PerformanceView } from './components/PerformanceView';
import { CascadingDisruptionCenter } from './components/CascadingDisruptionCenter';

export default function App() {
  // Navigation View State
  const [activeTab, setActiveTab] = useState<string>('live-network');

  // Scenario Selector State (Default: ROAD_CLOSURE)
  const [selectedScenario, setSelectedScenario] = useState<ScenarioId>('ROAD_CLOSURE');

  // Core Logistics Dataset States
  const [nodes, setNodes] = useState<LogisticsNode[]>(() => indiaLogisticsService.getNodes());
  const [routes, setRoutes] = useState<LogisticsRoute[]>(() => indiaLogisticsService.getRoutes());
  const [shipments, setShipments] = useState<MovingShipment[]>(() => indiaLogisticsService.getShipments());
  const [disruptions, setDisruptions] = useState<DisruptionAlert[]>(() => indiaLogisticsService.getDisruptions());
  const [recovery, setRecovery] = useState<RecoveryRecommendation>(() => indiaLogisticsService.getRecovery());
  const [kpis, setKpis] = useState<ControlTowerKpis>(() => indiaLogisticsService.getKpis());

  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | null>(null);
  const [selectedShipmentId, setSelectedShipmentId] = useState<string>('SHP-5002');

  // 6-Step Visual Simulation States (Requirement 5)
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simulationProgress, setSimulationProgress] = useState<number>(0);
  const [candidateRoutesVisible, setCandidateRoutesVisible] = useState<boolean>(true);
  const [simulationSteps, setSimulationSteps] = useState<SimulationStep[]>([
    { stepNumber: 1, title: 'Inject disruption', status: 'pending' },
    { stepNumber: 2, title: 'Detect affected routes', status: 'pending' },
    { stepNumber: 3, title: 'Detect affected shipments', status: 'pending' },
    { stepNumber: 4, title: 'Reveal alternative corridors', status: 'pending' },
    { stepNumber: 5, title: 'Run recovery analysis', status: 'pending' },
    { stepNumber: 6, title: 'Display recommended route', status: 'pending' },
  ]);

  // Synchronize state from service
  const syncState = () => {
    setNodes([...indiaLogisticsService.getNodes()]);
    setRoutes([...indiaLogisticsService.getRoutes()]);
    setShipments([...indiaLogisticsService.getShipments()]);
    setDisruptions([...indiaLogisticsService.getDisruptions()]);
    setRecovery({ ...indiaLogisticsService.getRecovery() });
    setKpis({ ...indiaLogisticsService.getKpis() });
  };

  // Keyboard shortcut Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const input = document.querySelector('input[type="text"]') as HTMLInputElement;
        if (input) input.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 1. SCENARIO SELECTOR HANDLER (Requirement 1 & 3)
  const handleSelectScenario = (scenarioId: ScenarioId) => {
    setSelectedScenario(scenarioId);
    indiaLogisticsService.setScenario(scenarioId);

    const preset = SCENARIO_PRESETS[scenarioId];
    setSelectedShipmentId(preset.primarySelectedShipmentId);
    setSelectedWarehouseId(null);
    setCandidateRoutesVisible(scenarioId !== 'NORMAL');
    setIsSimulating(false);
    setSimulationProgress(0);
    setSimulationSteps([
      { stepNumber: 1, title: 'Inject disruption', status: 'pending' },
      { stepNumber: 2, title: 'Detect affected routes', status: 'pending' },
      { stepNumber: 3, title: 'Detect affected shipments', status: 'pending' },
      { stepNumber: 4, title: 'Reveal alternative corridors', status: 'pending' },
      { stepNumber: 5, title: 'Run recovery analysis', status: 'pending' },
      { stepNumber: 6, title: 'Display recommended route', status: 'pending' },
    ]);
    syncState();
  };

  // 2. 6-STEP VISUAL SIMULATION RUNNER (Requirement 5)
  const handleSimulateImpact = async () => {
    if (isSimulating) return;
    setIsSimulating(true);
    setCandidateRoutesVisible(false);
    setSimulationProgress(10);

    // STEP 1: Inject disruption
    setSimulationSteps([
      { stepNumber: 1, title: 'Inject disruption', status: 'running' },
      { stepNumber: 2, title: 'Detect affected routes', status: 'pending' },
      { stepNumber: 3, title: 'Detect affected shipments', status: 'pending' },
      { stepNumber: 4, title: 'Reveal alternative corridors', status: 'pending' },
      { stepNumber: 5, title: 'Run recovery analysis', status: 'pending' },
      { stepNumber: 6, title: 'Display recommended route', status: 'pending' },
    ]);
    await new Promise((r) => setTimeout(r, 400));
    setSimulationProgress(25);

    // STEP 2: Detect affected routes
    setSimulationSteps([
      { stepNumber: 1, title: 'Inject disruption', status: 'completed' },
      { stepNumber: 2, title: 'Detect affected routes', status: 'running' },
      { stepNumber: 3, title: 'Detect affected shipments', status: 'pending' },
      { stepNumber: 4, title: 'Reveal alternative corridors', status: 'pending' },
      { stepNumber: 5, title: 'Run recovery analysis', status: 'pending' },
      { stepNumber: 6, title: 'Display recommended route', status: 'pending' },
    ]);
    await new Promise((r) => setTimeout(r, 450));
    setSimulationProgress(45);

    // STEP 3: Detect affected shipments
    setSimulationSteps([
      { stepNumber: 1, title: 'Inject disruption', status: 'completed' },
      { stepNumber: 2, title: 'Detect affected routes', status: 'completed' },
      { stepNumber: 3, title: 'Detect affected shipments', status: 'running' },
      { stepNumber: 4, title: 'Reveal alternative corridors', status: 'pending' },
      { stepNumber: 5, title: 'Run recovery analysis', status: 'pending' },
      { stepNumber: 6, title: 'Display recommended route', status: 'pending' },
    ]);
    const preset = SCENARIO_PRESETS[selectedScenario];
    setSelectedShipmentId(preset.primarySelectedShipmentId);
    await new Promise((r) => setTimeout(r, 450));
    setSimulationProgress(65);

    // STEP 4: Reveal alternative corridors
    setSimulationSteps([
      { stepNumber: 1, title: 'Inject disruption', status: 'completed' },
      { stepNumber: 2, title: 'Detect affected routes', status: 'completed' },
      { stepNumber: 3, title: 'Detect affected shipments', status: 'completed' },
      { stepNumber: 4, title: 'Reveal alternative corridors', status: 'running' },
      { stepNumber: 5, title: 'Run recovery analysis', status: 'pending' },
      { stepNumber: 6, title: 'Display recommended route', status: 'pending' },
    ]);
    setCandidateRoutesVisible(true);
    await new Promise((r) => setTimeout(r, 550));
    setSimulationProgress(85);

    // STEP 5: Run recovery analysis
    setSimulationSteps([
      { stepNumber: 1, title: 'Inject disruption', status: 'completed' },
      { stepNumber: 2, title: 'Detect affected routes', status: 'completed' },
      { stepNumber: 3, title: 'Detect affected shipments', status: 'completed' },
      { stepNumber: 4, title: 'Reveal alternative corridors', status: 'completed' },
      { stepNumber: 5, title: 'Run recovery analysis', status: 'running' },
      { stepNumber: 6, title: 'Display recommended route', status: 'pending' },
    ]);
    await new Promise((r) => setTimeout(r, 500));
    setSimulationProgress(98);

    // STEP 6: Display recommended route
    setSimulationSteps([
      { stepNumber: 1, title: 'Inject disruption', status: 'completed' },
      { stepNumber: 2, title: 'Detect affected routes', status: 'completed' },
      { stepNumber: 3, title: 'Detect affected shipments', status: 'completed' },
      { stepNumber: 4, title: 'Reveal alternative corridors', status: 'completed' },
      { stepNumber: 5, title: 'Run recovery analysis', status: 'completed' },
      { stepNumber: 6, title: 'Display recommended route', status: 'completed' },
    ]);
    setSimulationProgress(100);
    await new Promise((r) => setTimeout(r, 300));

    setIsSimulating(false);
  };

  // 3. FAST RECOVER EXECUTION
  const handleFastRecover = async () => {
    // If candidate corridors aren't visible yet, run visual steps first
    if (!candidateRoutesVisible) {
      await handleSimulateImpact();
    }

    // Brief commit delay for high visual impact
    await new Promise((r) => setTimeout(r, 300));

    // Commit to data layer
    indiaLogisticsService.commitRecovery();
    syncState();

    const preset = SCENARIO_PRESETS[selectedScenario];
    setSelectedShipmentId(preset.primarySelectedShipmentId);
    setCandidateRoutesVisible(true);
  };

  // 4. Reset Current Scenario Simulation
  const handleReset = () => {
    handleSelectScenario(selectedScenario);
  };

  const isDisrupted = disruptions.some((d) => d.status === 'ACTIVE');
  const selectedShipment = shipments.find((s) => s.id === selectedShipmentId);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100 font-sans antialiased text-slate-900 select-none">
      {/* 1. Left Sidebar — Minimal Navigation */}
      <IndiaSidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        disruptionsCount={kpis.activeDisruptions}
      />

      {/* Main Control Tower Viewport */}
      <div className="flex flex-col flex-1 h-screen min-w-0 overflow-hidden">
        {/* 2. Top Bar — Title, System Status, Scenario Selector, Search, Clock, FAST RECOVER */}
        <IndiaTopHeader
          kpis={kpis}
          isDisrupted={isDisrupted}
          isSimulating={isSimulating}
          selectedScenario={selectedScenario}
          onSelectScenario={handleSelectScenario}
          onFastRecover={handleFastRecover}
          onReset={handleReset}
        />

        {/* 3. Small KPI Cards Strip */}
        <IndiaKpiStrip kpis={kpis} />

        {/* Dynamic Main Workspace: Map-First Control Tower */}
        {activeTab === 'live-network' && (
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            {/* Center Area: Large Leaflet Map (65-75%) + Small Right Panel */}
            <div className="flex flex-1 min-h-0 relative w-full overflow-hidden">
              {/* 4. Large Central Leaflet Map (Main Focus) */}
              <div className="flex-1 h-full min-w-0 relative">
                <IndiaLeafletMap
                  nodes={nodes}
                  routes={routes}
                  shipments={shipments}
                  disruptions={disruptions}
                  recovery={recovery}
                  activeScenario={selectedScenario}
                  selectedWarehouseId={selectedWarehouseId}
                  selectedShipmentId={selectedShipmentId}
                  onSelectWarehouse={setSelectedWarehouseId}
                  onSelectShipment={setSelectedShipmentId}
                  isSimulating={isSimulating}
                  simulationProgress={simulationProgress}
                  simulationSteps={simulationSteps}
                  candidateRoutesVisible={candidateRoutesVisible}
                />
              </div>

              {/* 5. Small Right Panel — Active Disruption + AI Recommendation */}
              <IndiaRightPanel
                disruptions={disruptions}
                recovery={recovery}
                isSimulating={isSimulating}
                onSimulateImpact={handleSimulateImpact}
                onApplyFastRecover={handleFastRecover}
              />
            </div>

            {/* 6. Bottom Panel — Selected Shipment, Route Comparison, Timeline */}
            <IndiaBottomPanel
              selectedShipment={selectedShipment}
              recovery={recovery}
              nodes={nodes}
              isDisrupted={isDisrupted}
            />
          </div>
        )}

        {/* Secondary View: Cascading Disruption + Response Center */}
        {activeTab === 'disruptions' && (
          <CascadingDisruptionCenter
            onReturnToMap={() => setActiveTab('live-network')}
            onApplyFastRecoverGlobal={handleFastRecover}
          />
        )}

        {/* Secondary View: Scenario Simulator */}
        {activeTab === 'simulator' && (
          <div className="flex-1 p-6 overflow-y-auto bg-slate-50">
            <div className="max-w-4xl mx-auto space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Quantum Logistics Scenario Simulator</h2>
                  <p className="text-xs text-slate-500">Test real situations: Road Closures, Accidents, Extreme Weather, Capacity Drops.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('live-network')}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700"
                >
                  Return to Live Map
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(Object.keys(SCENARIO_PRESETS) as ScenarioId[]).map((sid) => {
                  const p = SCENARIO_PRESETS[sid];
                  const isCur = selectedScenario === sid;
                  return (
                    <div
                      key={sid}
                      onClick={() => {
                        handleSelectScenario(sid);
                        setActiveTab('live-network');
                      }}
                      className={`p-4 rounded-2xl border cursor-pointer transition shadow-2xs hover:shadow-md ${
                        isCur
                          ? 'border-blue-500 bg-blue-50/50 ring-2 ring-blue-500/20'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-bold text-xs text-slate-900">{p.label}</span>
                        {isCur && (
                          <span className="text-[10px] font-mono font-bold text-blue-600 bg-blue-100 px-1.5 py-0.2 rounded">
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 leading-snug">
                        {p.recovery.explanation}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Secondary View: Performance & Swarm Intelligence Analytics */}
        {activeTab === 'performance' && (
          <PerformanceView onReturnToMap={() => setActiveTab('live-network')} />
        )}
      </div>
    </div>
  );
}

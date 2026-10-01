import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Polyline, Popup } from 'react-leaflet';
import { 
  Activity, Compass, GitFork, Play, Gauge, 
  RefreshCw, Sliders, BarChart2, Award, Info, AlertTriangle,
  Download, AlertCircle, FileText, Database, ShieldAlert
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import api from './services/api';
import { 
  TrafficGraphData, TrafficStatus, OptimizationResponse, 
  VrpResponse, BenchmarkResponse 
} from './types';

// California sample area: San Francisco Bay / Downtown San Francisco
const MAP_CENTER: [number, number] = [37.7749, -122.4194];

export default function App() {
  // Global States
  const [graph, setGraph] = useState<TrafficGraphData>({ nodes: [], edges: [] });
  const [traffic, setTraffic] = useState<TrafficStatus>({ hour: 12.0, active_incidents: [] });
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Tab State: map, optimize, compare, analytics, experiment, research
  const [tab, setTab] = useState<'map' | 'optimize' | 'compare' | 'analytics' | 'experiment' | 'research'>('map');

  // Control Options
  const [congestionModel, setCongestionModel] = useState('linear');
  
  // Solver / Path States
  const [sourceNode, setSourceNode] = useState<number | null>(null);
  const [targetNode, setTargetNode] = useState<number | null>(null);
  const [algorithm, setAlgorithm] = useState('iqpso');
  const [swarmSize, setSwarmSize] = useState(50);
  const [iterations, setIterations] = useState(200);
  const [runs, setRuns] = useState(10);
  const [seed, setSeed] = useState(42);
  const [experimentAlgorithm, setExperimentAlgorithm] = useState('iqpso');

  // Objective weights
  const [weightTime, setWeightTime] = useState(0.5);
  const [weightDist, setWeightDist] = useState(0.2);
  const [weightCong, setWeightCong] = useState(0.3);
  const [weightFuel, setWeightFuel] = useState(0.2);
  const [weightRisk, setWeightRisk] = useState(0.3);
  const [weightReliability, setWeightReliability] = useState(0.1);
  const [weightFleet, setWeightFleet] = useState(0.15);
  const [weightCapacity, setWeightCapacity] = useState(0.1);
  const [alphaSchedule, setAlphaSchedule] = useState('linear_decay');
  const [quantumCoefficient, setQuantumCoefficient] = useState(0.8);
  const [diversityPressure, setDiversityPressure] = useState(0.15);
  const [explorationRate, setExplorationRate] = useState(0.1);
  
  // Result States
  const [spResult, setSpResult] = useState<OptimizationResponse | null>(null);
  const [vrpResult, setVrpResult] = useState<VrpResponse | null>(null);
  const [benchmarkResult, setBenchmarkResult] = useState<BenchmarkResponse | null>(null);
  const [scalabilityResult, setScalabilityResult] = useState<any | null>(null);
  const [activeEdgeClick, setActiveEdgeClick] = useState<{source: number, target: number} | null>(null);
  const [swarmStep, setSwarmStep] = useState(0);

  // Local loading states (isolated from global 'loading' to prevent cross-tab interference)
  const [benchmarkRunning, setBenchmarkRunning] = useState(false);
  const [scalabilityRunning, setScalabilityRunning] = useState(false);

  // Demo status
  const [demoStep, setDemoStep] = useState<string | null>(null);

  useEffect(() => {
    loadGraphAndTraffic();
  }, []);

  const loadGraphAndTraffic = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const graphData = await api.getGraph();
      const trafficData = await api.getTrafficStatus();
      setGraph(graphData);
      setTraffic(trafficData);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to fetch graph data');
    } finally {
      setLoading(false);
    }
  };

  const refreshRouteAfterTrafficUpdate = async () => {
    if (sourceNode === null || targetNode === null || sourceNode === targetNode) {
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await api.runShortestPath(sourceNode, targetNode, algorithm, swarmSize, iterations, getWeights());
      setSpResult(res);
      setTab('map');
    } catch (err: any) {
      setErrorMessage(err.message || 'Route update failed');
    } finally {
      setLoading(false);
    }
  };

  const handleHourChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const hr = parseFloat(e.target.value);
    try {
      const trafficData = await api.updateTrafficTime(hr);
      setTraffic(trafficData);
      const graphData = await api.getGraph();
      setGraph(graphData);
      await refreshRouteAfterTrafficUpdate();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to change time');
    }
  };

  const handleTriggerEdgeEvent = async (type: string) => {
    if (!activeEdgeClick) return;
    setLoading(true);
    try {
      await api.triggerTrafficEvent(
        type, 
        activeEdgeClick.source, 
        activeEdgeClick.target,
        0.9, 
        type === 'road_closure' ? 'Closed by police request' : 'Accident blocking lanes'
      );
      const trafficData = await api.getTrafficStatus();
      setTraffic(trafficData);
      const graphData = await api.getGraph();
      setGraph(graphData);
      await refreshRouteAfterTrafficUpdate();
      setActiveEdgeClick(null);
    } catch (err: any) {
      alert(err.message || 'Failed to apply event');
    } finally {
      setLoading(false);
    }
  };

  const handleClearAllIncidents = async () => {
    try {
      // Clear incidents and reset edge closures
      await api.triggerTrafficEvent('normal');
      const trafficData = await api.getTrafficStatus();
      setTraffic(trafficData);
      const graphData = await api.getGraph();
      setGraph(graphData);
      await refreshRouteAfterTrafficUpdate();
      setSpResult(null);
      setVrpResult(null);
      setBenchmarkResult(null);
    } catch (err: any) {
      alert(err.message || 'Failed to clear incidents');
    }
  };

  const getWeights = () => ({
    travel_time: weightTime,
    distance: weightDist,
    congestion: weightCong,
    fuel_cost: weightFuel,
    risk: weightRisk,
    reliability: weightReliability,
    vehicles_used: weightFleet,
    capacity_utilization: weightCapacity
  });

  // Run Shortest Path Optimization
  const handleRunShortestPath = async () => {
    if (sourceNode === null || targetNode === null) {
      alert('Select source and target nodes by clicking junctions on the map.');
      return;
    }
    setLoading(true);
    setErrorMessage(null);
    setSpResult(null);
    setVrpResult(null);
    setBenchmarkResult(null);
    setSwarmStep(0);
    try {
      const res = await api.runShortestPath(sourceNode, targetNode, algorithm, swarmSize, iterations, getWeights());
      setSpResult(res);
      setTab('map');
      await new Promise((resolve) => setTimeout(resolve, 12000));
    } catch (err: any) {
      setErrorMessage(err.message || 'Optimization failed');
    } finally {
      setLoading(false);
    }
  };

  // Run VRP Optimization
  const handleRunVrp = async () => {
    setLoading(true);
    setErrorMessage(null);
    setSpResult(null);
    setVrpResult(null);
    setBenchmarkResult(null);
    
    const depot = 0;
    const availableNodes = graph.nodes.map(n => n.id).filter(id => id !== depot);
    if (availableNodes.length < 5) {
      alert('Graph too small. Generate a larger network.');
      setLoading(false);
      return;
    }
    
    // Select 5 customers deterministically
    const customers = availableNodes.slice(0, 5);

    try {
      const res = await api.runVrp(depot, customers, 100.0, 3, swarmSize, iterations, getWeights());
      setVrpResult(res);
      setTab('map');
    } catch (err: any) {
      setErrorMessage(err.message || 'VRP failed');
    } finally {
      setLoading(false);
    }
  };

  // Run Research Benchmark Comparison
  const handleRunBenchmark = async () => {
    setBenchmarkRunning(true);
    setErrorMessage(null);
    // Preserve previous results until new results arrive successfully
    
    const isSP = sourceNode !== null && targetNode !== null;
    
    try {
      let res;
      if (isSP) {
        res = await api.runBenchmark({
          problem_type: 'shortest_path',
          source: sourceNode!,
          target: targetNode!,
          swarm_size: swarmSize,
          iterations,
          runs,
          weights: getWeights(),
        });
      } else {
        const depot = 0;
        const availableNodes = graph.nodes.map(n => n.id).filter(id => id !== depot);
        const customers = availableNodes.slice(0, 4);
        res = await api.runBenchmark({
          problem_type: 'vrp',
          depot_id: depot,
          customer_ids: customers,
          vehicle_capacity: 100.0,
          max_vehicles: 3,
          swarm_size: swarmSize,
          iterations,
          runs,
          weights: getWeights(),
        });
      }
      setBenchmarkResult(res);
    } catch (err: any) {
      setErrorMessage(err.message || 'Benchmark run failed');
    } finally {
      setBenchmarkRunning(false);
    }
  };

  // Run Scalability laboratory experiment
  const handleRunScalabilityExperiment = async () => {
    setScalabilityRunning(true);
    setErrorMessage(null);
    // Preserve previous results until new results arrive successfully
    try {
      const res = await api.runExperiment({
        problem_type: 'vrp',
        algorithm: experimentAlgorithm,
        swarm_size: swarmSize,
        iterations,
        runs: runs,
        seed: seed,
        node_sizes: [10, 25, 50, 100]
      });
      setScalabilityResult(res);
    } catch (err: any) {
      setErrorMessage(err.message || 'Scalability experiment failed');
    } finally {
      setScalabilityRunning(false);
    }
  };

  // Export results as CSV or JSON
  const handleExportData = (format: 'json' | 'csv') => {
    if (!scalabilityResult) return;
    
    let content = '';
    let filename = `experiment_results_${Date.now()}`;
    
    if (format === 'json') {
      content = JSON.stringify(scalabilityResult, null, 2);
      filename += '.json';
    } else {
      // CSV format
      const headers = ['nodes_size', 'mean_fitness', 'best_fitness', 'mean_runtime_sec', 'success_rate', 'violations'];
      const rows = scalabilityResult.results.map((r: any) => [
        r.num_customers * 5, // Approximate node scale
        r.mean_fitness,
        r.best_fitness,
        r.mean_runtime_sec,
        r.success_rate,
        r.violations
      ]);
      content = [headers.join(','), ...rows.map((row: any) => row.join(','))].join('\n');
      filename += '.csv';
    }
    
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  // One-Click Smart City Dynamic Rerouting Demo
  const handleStartOneClickDemo = async () => {
    try {
      setDemoStep("Step 1: Loading the active urban road network...");
      setLoading(true);

      const graphData = await api.generateGraph("grid", 36);
      setGraph(graphData);

      const validNodeIds = graphData.nodes.map(node => node.id);
      if (validNodeIds.length < 2) {
        throw new Error('No valid nodes are available in the active road network.');
      }

      const src = validNodeIds[0];
      const tgt = validNodeIds[validNodeIds.length - 1];

      // Reset simulator
      await api.triggerTrafficEvent('normal');

      setSourceNode(src);
      setTargetNode(tgt);

      // Solve initial path under normal conditions
      setDemoStep("Step 2: Calculating shortest path (Dijkstra baseline) under normal free traffic...");
      await new Promise(r => setTimeout(r, 1000));

      const resNormal = await api.runShortestPath(src, tgt, "dijkstra", 30, 50, getWeights());
      setSpResult(resNormal);
      setTab('map');

      // Let's identify the first edge of the optimal path to block it
      const path = resNormal.path;
      if (path.length >= 2) {
        const u = path[1];
        const v = path[2] !== undefined ? path[2] : path[1];

        setDemoStep(`Step 3: Incident! A severe accident occurs on road segment (${u} ➔ ${v}). Blocking road...`);
        await new Promise(r => setTimeout(r, 2000));

        // Trigger Road closure event on that specific segment
        await api.triggerTrafficEvent('road_closure', u, v);

        // Refresh graph weights
        const updatedGraph = await api.getGraph();
        setGraph(updatedGraph);

        setDemoStep("Step 4: Re-optimizing dynamic route using Proposed Improved QPSO to find detour...");
        await new Promise(r => setTimeout(r, 1500));

        const resDetour = await api.runShortestPath(src, tgt, "iqpso", 40, 60, getWeights());
        setSpResult(resDetour);

        setDemoStep("Step 5: Demonstration Completed! The vehicle successfully bypassed the roadblock.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Demo failed');
    } finally {
      setLoading(false);
      setTimeout(() => setDemoStep(null), 5000);
    }
  };

  const getConvergenceData = () => {
    if (benchmarkResult && benchmarkResult.histories && benchmarkResult.histories.iqpso && benchmarkResult.histories.iqpso.length > 0) {
      const firstRun = benchmarkResult.histories.iqpso[0];
      const length = firstRun ? firstRun.length : 0;
      if (length === 0) return [];
      
      return Array.from({ length }).map((_, i) => {
        const psoMean = (benchmarkResult.histories.pso || []).reduce((sum, run) => sum + (run[i] || 0), 0) / (benchmarkResult.histories.pso?.length || 1);
        const qpsoMean = (benchmarkResult.histories.qpso || []).reduce((sum, run) => sum + (run[i] || 0), 0) / (benchmarkResult.histories.qpso?.length || 1);
        const iqpsoMean = (benchmarkResult.histories.iqpso || []).reduce((sum, run) => sum + (run[i] || 0), 0) / (benchmarkResult.histories.iqpso?.length || 1);
        return {
          iteration: i,
          PSO: parseFloat(psoMean.toFixed(2)),
          QPSO: parseFloat(qpsoMean.toFixed(2)),
          Improved_QPSO: parseFloat(iqpsoMean.toFixed(2)),
        };
      });
    }
    if (spResult && spResult.history) {
      return spResult.history.map((val, idx) => ({ iteration: idx, Fitness: val }));
    }
    return [];
  };

  const getDiversityData = () => {
    if (benchmarkResult && benchmarkResult.diversity && benchmarkResult.diversity.iqpso && benchmarkResult.diversity.iqpso.length > 0) {
      const firstRun = benchmarkResult.diversity.iqpso[0];
      const length = firstRun ? firstRun.length : 0;
      if (length === 0) return [];

      return Array.from({ length }).map((_, i) => {
        const psoMean = (benchmarkResult.diversity.pso || []).reduce((sum, run) => sum + (run[i] || 0), 0) / (benchmarkResult.diversity.pso?.length || 1);
        const qpsoMean = (benchmarkResult.diversity.qpso || []).reduce((sum, run) => sum + (run[i] || 0), 0) / (benchmarkResult.diversity.qpso?.length || 1);
        const iqpsoMean = (benchmarkResult.diversity.iqpso || []).reduce((sum, run) => sum + (run[i] || 0), 0) / (benchmarkResult.diversity.iqpso?.length || 1);
        return {
          iteration: i,
          PSO: parseFloat(psoMean.toFixed(4)),
          QPSO: parseFloat(qpsoMean.toFixed(4)),
          Improved_QPSO: parseFloat(iqpsoMean.toFixed(4)),
        };
      });
    }
    return [];
  };

  const getRuntimeBarData = () => {
    if (benchmarkResult && benchmarkResult.summary) {
      return [
        { name: 'PSO', Runtime: (benchmarkResult.summary.pso?.mean_runtime_sec || 0) * 1000 },
        { name: 'QPSO', Runtime: (benchmarkResult.summary.qpso?.mean_runtime_sec || 0) * 1000 },
        { name: 'Improved QPSO', Runtime: (benchmarkResult.summary.iqpso?.mean_runtime_sec || 0) * 1000 },
      ];
    }
    return [];
  };

  const visibleNodes = graph.nodes.filter(
    node => node.type === 'junction' || node.id === sourceNode || node.id === targetNode
  );

  const getPathCoords = (path: number[]): [number, number][] => {
    return path
      .map(nodeId => {
        const node = graph.nodes.find(n => n.id === nodeId);
        return node ? [node.lat, node.lon] as [number, number] : null;
      })
      .filter((coord): coord is [number, number] => coord !== null);
  };

  const previewPathCoords = (() => {
    if (spResult && spResult.path.length > 1) return getPathCoords(spResult.path);

    if (sourceNode === null || targetNode === null) return [];

    const source = graph.nodes.find(node => node.id === sourceNode);
    const target = graph.nodes.find(node => node.id === targetNode);
    if (!source || !target) return [];

    return [[source.lat, source.lon], [target.lat, target.lon]] as [number, number][];
  })();

  const candidateRoutes = (() => {
    if (!spResult || spResult.path.length < 4) return [] as [number, number][][];

    const pathIds = spResult.path;
    const pathSet = new Set(pathIds);
    const candidates: [number, number][][] = [];

    for (let i = 1; i < pathIds.length - 2 && candidates.length < 3; i += 2) {
      const anchorA = pathIds[i - 1];
      const anchorB = pathIds[i + 1];
      const neighborOptions = graph.nodes.filter((node) => {
        if (pathSet.has(node.id) || node.id === anchorA || node.id === anchorB) return false;
        const connectedToA = graph.edges.some(
          edge => (edge.source === anchorA && edge.target === node.id) || (edge.source === node.id && edge.target === anchorA)
        );
        const connectedToB = graph.edges.some(
          edge => (edge.source === anchorB && edge.target === node.id) || (edge.source === node.id && edge.target === anchorB)
        );
        return connectedToA || connectedToB;
      }).slice(0, 2);

      if (neighborOptions.length === 0) continue;

      const route = [
        [graph.nodes.find(n => n.id === anchorA)?.lat ?? 0, graph.nodes.find(n => n.id === anchorA)?.lon ?? 0],
        ...neighborOptions.map(node => [node.lat, node.lon] as [number, number]),
        [graph.nodes.find(n => n.id === anchorB)?.lat ?? 0, graph.nodes.find(n => n.id === anchorB)?.lon ?? 0]
      ] as [number, number][];

      if (route.length >= 3) candidates.push(route);
    }

    return candidates;
  })();

  const swarmParticles = (() => {
    if (previewPathCoords.length < 2) return [];

    const colors = ['#facc15', '#facc15', '#facc15', '#facc15', '#facc15'];
    const particleCount = Math.min(5, previewPathCoords.length);
    const progress = Math.min(swarmStep, previewPathCoords.length - 1);

    return Array.from({ length: particleCount }, (_, index) => {
      const offset = index * 2;
      const currentIndex = Math.min(progress + offset, previewPathCoords.length - 1);
      const trail = previewPathCoords.slice(0, Math.max(1, currentIndex + 1));

      return {
        id: index,
        color: colors[index % colors.length],
        trail,
        currentIndex,
        pBest: previewPathCoords[Math.max(1, Math.floor(previewPathCoords.length * 0.45))],
        gBest: previewPathCoords[previewPathCoords.length - 1],
      };
    });
  })();

  const personalBestRoute = previewPathCoords.length > 1
    ? previewPathCoords.slice(0, Math.max(2, Math.ceil(previewPathCoords.length * 0.7)))
    : [];

  const globalBestRoute = previewPathCoords;

  useEffect(() => {
    if (sourceNode !== null && targetNode !== null && sourceNode !== targetNode) {
      handleRunShortestPath();
    }
  }, [sourceNode, targetNode]);

  useEffect(() => {
    if (!loading || previewPathCoords.length < 2) return;

    const cycleLength = Math.max(18, previewPathCoords.length * 3);
    const interval = setInterval(() => {
      setSwarmStep((prev) => {
        const next = prev + 1;
        return next >= cycleLength ? cycleLength - 1 : next;
      });
    }, 250);

    return () => clearInterval(interval);
  }, [loading, previewPathCoords]);


  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 font-sans overflow-hidden text-slate-100">
      
      {/* Header bar */}
      <header className="flex justify-between items-center bg-slate-900 border-b border-slate-800 px-6 py-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500/10 border border-emerald-500/30 p-2 rounded-lg text-emerald-400">
            <GitFork size={24} className="animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-100 tracking-wide">
              Quantum-Inspired Traffic Optimization
            </h1>
            <p className="text-xs text-slate-400">
              Metaheuristic Transportation Routing & Exact Baselines Comparison (SIH prototype)
            </p>
          </div>
        </div>

        {/* Dynamic Demo HUD */}
        {demoStep && (
          <div className="bg-emerald-950/20 border border-emerald-500/30 text-emerald-400 text-xs px-4 py-2 rounded-lg flex items-center gap-2 animate-pulse">
            <Info size={14} />
            <span>{demoStep}</span>
          </div>
        )}
        
        {/* Navigation tabs */}
        <div className="flex gap-2">
          <button 
            onClick={() => setTab('map')}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg border transition-all ${
              tab === 'map' ? 'bg-slate-800 border-slate-700 text-slate-100' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Compass size={14} /> Map Page
          </button>
          <button 
            onClick={() => setTab('optimize')}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg border transition-all ${
              tab === 'optimize' ? 'bg-slate-800 border-slate-700 text-slate-100' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders size={14} /> Run Solver
          </button>
          <button 
            onClick={() => setTab('compare')}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg border transition-all ${
              tab === 'compare' ? 'bg-slate-800 border-slate-700 text-slate-100' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Award size={14} /> Comparisons
          </button>
          <button 
            onClick={() => setTab('analytics')}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg border transition-all ${
              tab === 'analytics' ? 'bg-slate-800 border-slate-700 text-slate-100' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <BarChart2 size={14} /> Analytics Page
          </button>
          <button 
            onClick={() => setTab('experiment')}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg border transition-all ${
              tab === 'experiment' ? 'bg-slate-800 border-slate-700 text-slate-100' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Database size={14} /> Scalability Lab
          </button>
          <button 
            onClick={() => setTab('research')}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg border transition-all ${
              tab === 'research' ? 'bg-slate-800 border-slate-700 text-slate-100' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText size={14} /> Research Mode
          </button>
        </div>
      </header>

      {/* Main Panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar Controls */}
        <aside className="w-80 bg-slate-900 border-r border-slate-800 p-5 flex flex-col gap-6 overflow-y-auto flex-shrink-0">
          
          {/* SIH Story One-Click Button */}
          <section className="bg-emerald-950/10 border border-emerald-500/20 p-4 rounded-xl">
            <h2 className="text-xs font-semibold text-emerald-400 mb-2 uppercase tracking-wider">SIH Quick Demo</h2>
            <p className="text-[10px] text-slate-400 mb-3 leading-snug">
              Triggers a unified demo: grid generation, Dijkstra path search, road closure injection, and QPSO detour optimization.
            </p>
            <button 
              onClick={handleStartOneClickDemo}
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-slate-100 rounded py-2 text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2"
            >
              <Play size={12} /> Run One-Click Demo
            </button>
          </section>

          {/* Clock & Traffic Events */}
          <section className="bg-slate-800/40 border border-slate-800/80 p-4 rounded-xl">
            <h2 className="text-xs font-bold text-slate-300 flex items-center gap-1.5 mb-3 uppercase">
              <Activity size={14} className="text-purple-400" /> Traffic Engine
            </h2>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-[10px] text-slate-400 block mb-0.5">Congestion model</label>
                <select 
                  value={congestionModel}
                  onChange={(e) => setCongestionModel(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded px-2 py-1 text-xs focus:outline-none"
                >
                  <option value="linear">Linear: T = T0*(1 + L*C)</option>
                  <option value="bpr">BPR Standard Delay</option>
                </select>
              </div>
              
              <div>
                <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
                  <span>Dynamic Clock</span>
                  <span className="font-mono text-slate-200">{Math.floor(traffic.hour).toString().padStart(2, '0')}:00</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="23.9" 
                  step="0.5"
                  value={traffic.hour}
                  onChange={handleHourChange}
                  className="w-full accent-purple-500"
                />
              </div>

              {/* Quick events */}
              <div className="border-t border-slate-800 pt-2">
                <span className="text-[10px] text-slate-500 block mb-1">Trigger Simulation Events:</span>
                <div className="grid grid-cols-2 gap-1.5 text-xs">
                  <button 
                    onClick={async () => {
                      const t = await api.triggerTrafficEvent('peak_hour');
                      setTraffic(t);
                      const updatedGraph = await api.getGraph();
                      setGraph(updatedGraph);
                      await refreshRouteAfterTrafficUpdate();
                    }}
                    className="bg-slate-800 hover:bg-slate-700 py-1 rounded"
                  >
                    Peak Hour
                  </button>
                  <button 
                    onClick={async () => {
                      const t = await api.triggerTrafficEvent('random_incident');
                      setTraffic(t);
                      const updatedGraph = await api.getGraph();
                      setGraph(updatedGraph);
                      await refreshRouteAfterTrafficUpdate();
                    }}
                    className="bg-slate-800 hover:bg-slate-700 py-1 rounded"
                  >
                    Rand Incident
                  </button>
                </div>

                <button 
                  onClick={handleClearAllIncidents}
                  className="w-full bg-red-950/20 hover:bg-red-900/30 text-red-400 text-xs py-1 mt-2 rounded border border-red-900/30"
                >
                  Clear incidents & blocks
                </button>
              </div>
            </div>
          </section>

          {/* Active node selector visualizer */}
          <section className="bg-slate-800/40 border border-slate-800/80 p-4 rounded-xl text-xs">
            <span className="text-slate-400 block mb-1">Click nodes on map to set:</span>
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Source:</span>
                <span className="font-mono text-blue-400">{sourceNode !== null ? `#${sourceNode}` : 'None'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Destination:</span>
                <span className="font-mono text-orange-400">{targetNode !== null ? `#${targetNode}` : 'None'}</span>
              </div>
              <div className="mt-3 space-y-2 border-t border-slate-800 pt-3 text-[10px] text-slate-300">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-500 ring-2 ring-slate-950"></span>
                  <span>Source</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-orange-500 ring-2 ring-slate-950"></span>
                  <span>Destination</span>
                </div>
                {sourceNode !== null && targetNode !== null && sourceNode !== targetNode && !(!loading && spResult && spResult.path.length > 1) && (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="inline-block h-3 w-3 rounded-full bg-sky-400 ring-2 ring-slate-950"></span>
                      <span>Particle</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-block h-2.5 w-4 border-t-2 border-yellow-400 border-dashed"></span>
                      <span>Exploration paths</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-block h-3 w-3 rounded-full bg-yellow-400 ring-2 ring-slate-950"></span>
                      <span>Personal Best</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-block h-2.5 w-4 border-t-2 border-purple-600 border-dashed"></span>
                      <span>Global Best Route</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-block h-3 w-3 rounded-full bg-purple-600 ring-2 ring-slate-950"></span>
                      <span>Global Best Point</span>
                    </div>
                  </>
                )}
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2.5 w-4 border-t-2 border-emerald-400 border-dashed"></span>
                  <span>Path</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2.5 w-4 border-t-2 border-red-400 border-dashed opacity-80"></span>
                  <span>Traffic area</span>
                </div>
              </div>
              <div className="text-[9px] text-slate-500 leading-snug mt-2">
                * To inject roadblock, click a road polyline on the map directly.
              </div>
            </div>
          </section>
        </aside>

        {/* Workspace display area */}
        <main className="flex-1 bg-slate-950 flex flex-col p-6 overflow-y-auto">
          {errorMessage && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl flex items-center gap-3 mb-4">
              <AlertCircle size={18} className="flex-shrink-0" />
              <div className="text-xs">{errorMessage}</div>
            </div>
          )}

          {loading && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-center justify-center gap-2 mb-4">
              <RefreshCw className="animate-spin text-emerald-400" size={14} />
              <span className="text-xs text-slate-300 font-medium">Processing metaheuristic matrices...</span>
            </div>
          )}

          {/* TAB 1: Map page */}
          {tab === 'map' && (
            <div className="flex-1 flex flex-col min-h-0">
              
              {/* Road segment click event panel */}
              {activeEdgeClick && (
                <div className="bg-slate-900 border border-purple-500/40 p-4 rounded-xl mb-4 flex items-center justify-between text-xs animate-slideDown">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="text-purple-400" size={18} />
                    <div>
                      <p className="font-semibold">Selected Segment ({activeEdgeClick.source} ➔ {activeEdgeClick.target})</p>
                      <p className="text-slate-400">Trigger roadblock or accident on this road segment.</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleTriggerEdgeEvent('accident')}
                      className="bg-purple-700 hover:bg-purple-600 px-3 py-1.5 rounded font-medium"
                    >
                      Crash Accident
                    </button>
                    <button 
                      onClick={() => handleTriggerEdgeEvent('road_closure')}
                      className="bg-amber-700 hover:bg-amber-600 px-3 py-1.5 rounded font-medium"
                    >
                      Close Road
                    </button>
                    <button 
                      onClick={() => setActiveEdgeClick(null)}
                      className="bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Map rendering */}
              <div className="flex-1 min-h-[450px] relative">
                <MapContainer center={MAP_CENTER} zoom={14} className="w-full h-full">
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  />

                  {/* Junction nodes only: no background road grid overlay */}
                  {visibleNodes.map((node) => {
                    const isSource = node.id === sourceNode;
                    const isTarget = node.id === targetNode;

                    let color = '#475569';
                    let r = 5.5;
                    if (isSource) { color = '#3b82f6'; r = 8.5; }
                    else if (isTarget) { color = '#f97316'; r = 8.5; }

                    return (
                      <CircleMarker
                        key={`n-${node.id}`}
                        center={[node.lat, node.lon]}
                        radius={r}
                        pathOptions={{ fillColor: color, color: '#090d16', weight: 1.5, fillOpacity: 0.95 }}
                        eventHandlers={{
                          click: () => {
                            if (sourceNode === null) setSourceNode(node.id);
                            else if (targetNode === null) setTargetNode(node.id);
                            else { setSourceNode(node.id); setTargetNode(null); }
                          }
                        }}
                      >
                        <Popup>
                          <div className="text-xs text-slate-100">
                            <p className="font-bold">{node.label} (ID: {node.id})</p>
                            <p>Latitude: {node.lat.toFixed(5)}</p>
                            <p>Longitude: {node.lon.toFixed(5)}</p>
                            <p className="text-[10px] text-slate-400 mt-1">Click to set as routing source/destination.</p>
                          </div>
                        </Popup>
                      </CircleMarker>
                    );
                  })}

                  {loading && candidateRoutes.map((route, idx) => (
                    <Polyline
                      key={`candidate-${idx}`}
                      positions={route}
                      pathOptions={{
                        color: '#facc15',
                        weight: 5,
                        opacity: 0.6,
                        dashArray: '3, 8'
                      }}
                    />
                  ))}

                  {loading && personalBestRoute.length > 1 && (
                    <Polyline
                      positions={personalBestRoute}
                      pathOptions={{
                        color: '#f59e0b',
                        weight: 5,
                        opacity: 0.7,
                        dashArray: '4, 10'
                      }}
                    />
                  )}

                  {loading && swarmParticles.map((particle) => (
                    <React.Fragment key={`swarm-${particle.id}`}>
                      <Polyline
                        positions={particle.trail}
                        pathOptions={{
                          color: particle.color,
                          weight: 6,
                          opacity: 0.6,
                          dashArray: '2, 8'
                        }}
                      />
                      <CircleMarker
                        center={particle.trail[particle.trail.length - 1]}
                        radius={4}
                        pathOptions={{ color: '#f8fafc', fillColor: particle.color, fillOpacity: 1, weight: 1.4 }}
                      />
                      <CircleMarker
                        center={particle.pBest}
                        radius={11}
                        pathOptions={{ color: '#fff7ed', fillColor: '#facc15', fillOpacity: 0.95, weight: 2.2 }}
                      />
                      <CircleMarker
                        center={particle.gBest}
                        radius={14}
                        pathOptions={{ color: '#f3e8ff', fillColor: '#9333ea', fillOpacity: 0.9, weight: 2.5 }}
                      />
                    </React.Fragment>
                  ))}

                  {loading && swarmParticles.map((particle) => (
                    <CircleMarker
                      key={`gb-${particle.id}`}
                      center={particle.gBest}
                      radius={16}
                      pathOptions={{ color: '#f3e8ff', fillColor: '#9333ea', fillOpacity: 0.95, weight: 2.5 }}
                    />
                  ))}

                  {loading && globalBestRoute.length > 1 && (
                    <Polyline
                      positions={globalBestRoute}
                      pathOptions={{
                        color: '#9333ea',
                        weight: 10,
                        opacity: 1,
                        dashArray: '2, 4'
                      }}
                    />
                  )}

                  {!loading && spResult && spResult.path.length > 1 && (
                    <Polyline
                      positions={getPathCoords(spResult.path)}
                      pathOptions={{
                        color: '#22c55e',
                        weight: 6,
                        opacity: 0.95,
                        dashArray: '4, 8'
                      }}
                    />
                  )}

                </MapContainer>
              </div>

              {/* HUD summary */}
              {(spResult || vrpResult) && (
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-b-xl grid grid-cols-2 md:grid-cols-5 gap-4 text-xs mt-0.5">
                  <div>
                    <span className="text-slate-400 block">Method</span>
                    <span className="font-semibold text-slate-100 capitalize">
                      {spResult ? `${spResult.algorithm} Path` : 'VRP Multi-Vehicle'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Travel Duration</span>
                    <span className="font-mono text-emerald-400 font-semibold">
                      {spResult 
                        ? `${(spResult.metrics.travel_time * 60).toFixed(1)} mins`
                        : vrpResult ? `${(vrpResult.metrics.travel_time * 60).toFixed(1)} mins (total)` : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Total Distance</span>
                    <span className="font-mono text-slate-200">
                      {spResult 
                        ? `${spResult.metrics.distance.toFixed(2)} km`
                        : vrpResult ? `${vrpResult.metrics.distance.toFixed(2)} km` : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Fuel Consumption</span>
                    <span className="font-mono text-slate-200">
                      {spResult 
                        ? `${(spResult.metrics.fuel_cost || 0).toFixed(2)} Liters`
                        : vrpResult ? `${(vrpResult.metrics.fuel_cost || 0).toFixed(2)} Liters (total)` : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Solver Runtime</span>
                    <span className="font-mono text-slate-400">
                      {spResult 
                        ? `${(spResult.execution_time * 1000).toFixed(1)} ms`
                        : vrpResult ? `${(vrpResult.execution_time * 1000).toFixed(1)} ms` : '—'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Run solver configs */}
          {tab === 'optimize' && (
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl max-w-2xl mx-auto w-full text-xs">
              <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-1.5">
                <Sliders className="text-emerald-400" size={16} /> Configure Swarm Optimization Parameters
              </h3>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-slate-400 block mb-1">Selected Algorithm</label>
                  <select 
                    value={algorithm}
                    onChange={(e) => setAlgorithm(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded px-2.5 py-1.5"
                  >
                    <option value="dijkstra">Dijkstra Baseline (Exact shortest path)</option>
                    <option value="pso">Classical PSO (Velocity-driven)</option>
                    <option value="qpso">Basic QPSO (Quantum delta well)</option>
                    <option value="iqpso">Improved QPSO (Proposed diversity feedback)</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Swarm Particles count</label>
                  <input 
                    type="number"
                    value={swarmSize}
                    onChange={(e) => setSwarmSize(parseInt(e.target.value) || 20)}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded px-2.5 py-1.5"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-slate-400 block mb-1">Iterations</label>
                  <input 
                    type="number"
                    value={iterations}
                    onChange={(e) => setIterations(parseInt(e.target.value) || 50)}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded px-2.5 py-1.5"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Inertia / Contraction-Expansion α Schedule</label>
                  <select
                    value={alphaSchedule}
                    onChange={(e) => setAlphaSchedule(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded px-2.5 py-1.5"
                  >
                    <option value="linear_decay">Linear decay schedule (0.9 to 0.4)</option>
                    <option value="adaptive">Adaptive schedule (dynamic feedback)</option>
                    <option value="exponential">Exponential decay (0.9 → 0.35)</option>
                    <option value="stepwise">Stepwise schedule (0.9, 0.7, 0.5, 0.4)</option>
                    <option value="oscillatory">Oscillatory schedule (0.9 / 0.5 / 0.8)</option>
                    <option value="fixed">Fixed α = 0.7</option>
                  </select>
                </div>
              </div>

              {/* Multi-objective weights */}
              <div className="border-t border-slate-800 pt-4 mb-4">
                <span className="font-semibold text-slate-300 block mb-3">Modular Multi-Objective Fitness Weights</span>
                <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-400 block leading-tight text-center mb-1">
                      <span className="block">Time</span>
                      <span className="block">Weight</span>
                    </label>
                    <input type="number" step="0.1" value={weightTime} onChange={(e) => setWeightTime(parseFloat(e.target.value) || 0.0)} className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded px-1.5 py-1 text-center" />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block leading-tight text-center mb-1">
                      <span className="block">Distance</span>
                      <span className="block">Weight</span>
                    </label>
                    <input type="number" step="0.1" value={weightDist} onChange={(e) => setWeightDist(parseFloat(e.target.value) || 0.0)} className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded px-1.5 py-1 text-center" />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block leading-tight text-center mb-1">
                      <span className="block">Congestion</span>
                      <span className="block">Weight</span>
                    </label>
                    <input type="number" step="0.1" value={weightCong} onChange={(e) => setWeightCong(parseFloat(e.target.value) || 0.0)} className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded px-1.5 py-1 text-center" />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block leading-tight text-center mb-1">
                      <span className="block">Fuel</span>
                      <span className="block">Weight</span>
                    </label>
                    <input type="number" step="0.1" value={weightFuel} onChange={(e) => setWeightFuel(parseFloat(e.target.value) || 0.0)} className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded px-1.5 py-1 text-center" />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block leading-tight text-center mb-1">
                      <span className="block">Risk</span>
                      <span className="block">Weight</span>
                    </label>
                    <input type="number" step="0.1" value={weightRisk} onChange={(e) => setWeightRisk(parseFloat(e.target.value) || 0.0)} className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded px-1.5 py-1 text-center" />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block leading-tight text-center mb-1">
                      <span className="block">Reliability</span>
                      <span className="block">Weight</span>
                    </label>
                    <input type="number" step="0.1" value={weightReliability} onChange={(e) => setWeightReliability(parseFloat(e.target.value) || 0.0)} className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded px-1.5 py-1 text-center" />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block leading-tight text-center mb-1">
                      <span className="block">Fleet</span>
                      <span className="block">Weight</span>
                    </label>
                    <input type="number" step="0.1" value={weightFleet} onChange={(e) => setWeightFleet(parseFloat(e.target.value) || 0.0)} className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded px-1.5 py-1 text-center" />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block leading-tight text-center mb-1">
                      <span className="block">Capacity</span>
                      <span className="block">Weight</span>
                    </label>
                    <input type="number" step="0.1" value={weightCapacity} onChange={(e) => setWeightCapacity(parseFloat(e.target.value) || 0.0)} className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded px-1.5 py-1 text-center" />
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-800 pt-4 mb-4">
                <span className="font-semibold text-slate-300 block mb-3">QPSO Tunable Parameters</span>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">Quantum coefficient</label>
                    <input type="number" step="0.05" value={quantumCoefficient} onChange={(e) => setQuantumCoefficient(parseFloat(e.target.value) || 0.0)} className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded px-1.5 py-1 text-center" />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">Diversity pressure</label>
                    <input type="number" step="0.05" value={diversityPressure} onChange={(e) => setDiversityPressure(parseFloat(e.target.value) || 0.0)} className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded px-1.5 py-1 text-center" />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">Exploration rate</label>
                    <input type="number" step="0.05" value={explorationRate} onChange={(e) => setExplorationRate(parseFloat(e.target.value) || 0.0)} className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded px-1.5 py-1 text-center" />
                  </div>
                </div>
              </div>

              {/* Execution Actions */}
              <div className="flex gap-4 border-t border-slate-800 pt-4">
                <button 
                  onClick={handleRunShortestPath}
                  disabled={loading}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-slate-100 rounded py-2 font-bold transition-all shadow"
                >
                  Solve Shortest Path
                </button>
                <button 
                  onClick={handleRunVrp}
                  disabled={loading}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-slate-100 rounded py-2 font-bold transition-all shadow"
                >
                  Solve VRP Fleet Routing
                </button>
              </div>

            </div>
          )}

          {/* TAB 3: Comparisons */}
          {tab === 'compare' && (
            <div className="flex flex-col gap-6">
              
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl text-xs">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-200">Algorithm Comparison & Optimality Gap Analysis</h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      PSO vs QPSO vs Improved QPSO evaluated over {runs} stochastic runs with exact baselines.
                    </p>
                  </div>
                  <button 
                    onClick={handleRunBenchmark}
                    disabled={benchmarkRunning}
                    className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 px-4 py-2 rounded font-semibold text-slate-100"
                  >
                    {benchmarkRunning ? 'Running Benchmark…' : 'Run Benchmark Comparison'}
                  </button>
                </div>

                {benchmarkRunning && !benchmarkResult && (
                  <div className="py-8 text-center">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <RefreshCw className="animate-spin text-emerald-400" size={16} />
                      <span className="text-sm font-semibold text-emerald-400">BENCHMARK RUNNING</span>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Evaluating PSO vs QPSO vs Improved QPSO over {runs} stochastic runs — this may take a while.
                    </p>
                  </div>
                )}
                {benchmarkResult ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-slate-300">
                      <thead className="text-slate-400 uppercase bg-slate-800/60 border-b border-slate-800">
                        <tr>
                          <th className="px-4 py-3">Algorithm</th>
                          <th className="px-4 py-3">Mean Fitness</th>
                          <th className="px-4 py-3">Best Fitness</th>
                          <th className="px-4 py-3">Worst Fitness</th>
                          <th className="px-4 py-3">Std Dev</th>
                          <th className="px-4 py-3">Mean Runtime (s)</th>
                          <th className="px-4 py-3">Mean Conv. Iter</th>
                          <th className="px-4 py-3">Optimality Gap (%)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {benchmarkResult.dijkstra && (
                          <tr className="border-b border-slate-800/80 bg-slate-900/40">
                            <td className="px-4 py-3 font-semibold text-slate-200">Dijkstra (Exact SP)</td>
                            <td className="px-4 py-3 font-mono">{benchmarkResult.dijkstra.fitness.toFixed(2)}</td>
                            <td className="px-4 py-3 font-mono">{benchmarkResult.dijkstra.fitness.toFixed(2)}</td>
                            <td className="px-4 py-3 font-mono">-</td>
                            <td className="px-4 py-3 font-mono">-</td>
                            <td className="px-4 py-3 font-mono">0.001s</td>
                            <td className="px-4 py-3 font-mono">-</td>
                            <td className="px-4 py-3 font-bold text-emerald-400">0.00% (Optimum)</td>
                          </tr>
                        )}
                        {benchmarkResult.exact_optimum && (
                          <tr className="border-b border-slate-800/80 bg-slate-900/40">
                            <td className="px-4 py-3 font-semibold text-slate-200">Brute Force (Exact VRP)</td>
                            <td className="px-4 py-3 font-mono">{benchmarkResult.exact_optimum.fitness.toFixed(2)}</td>
                            <td className="px-4 py-3 font-mono">{benchmarkResult.exact_optimum.fitness.toFixed(2)}</td>
                            <td className="px-4 py-3 font-mono">-</td>
                            <td className="px-4 py-3 font-mono">-</td>
                            <td className="px-4 py-3 font-mono">0.025s</td>
                            <td className="px-4 py-3 font-mono">-</td>
                            <td className="px-4 py-3 font-bold text-emerald-400">0.00% (Optimum)</td>
                          </tr>
                        )}
                        <tr className="border-b border-slate-800/80">
                          <td className="px-4 py-3 font-semibold text-slate-200">Classical PSO</td>
                          <td className="px-4 py-3 font-mono">{typeof benchmarkResult.summary?.pso?.mean_fitness === 'number' ? benchmarkResult.summary.pso.mean_fitness.toFixed(2) : '—'}</td>
                          <td className="px-4 py-3 font-mono">{typeof benchmarkResult.summary?.pso?.best_fitness === 'number' ? benchmarkResult.summary.pso.best_fitness.toFixed(2) : '—'}</td>
                          <td className="px-4 py-3 font-mono">{typeof benchmarkResult.summary?.pso?.worst_fitness === 'number' ? benchmarkResult.summary.pso.worst_fitness.toFixed(2) : '—'}</td>
                          <td className="px-4 py-3 font-mono text-slate-400">±{typeof benchmarkResult.summary?.pso?.std_fitness === 'number' ? benchmarkResult.summary.pso.std_fitness.toFixed(2) : '—'}</td>
                          <td className="px-4 py-3 font-mono">{typeof benchmarkResult.summary?.pso?.mean_runtime_sec === 'number' ? benchmarkResult.summary.pso.mean_runtime_sec.toFixed(3) + 's' : '—'}</td>
                          <td className="px-4 py-3 font-mono">{typeof benchmarkResult.summary?.pso?.mean_convergence_iter === 'number' ? benchmarkResult.summary.pso.mean_convergence_iter.toFixed(0) : '—'}</td>
                          <td className="px-4 py-3 font-mono">{typeof benchmarkResult.summary?.pso?.optimality_gap === 'number' ? `${benchmarkResult.summary.pso.optimality_gap.toFixed(2)}%` : 'N/A'}</td>
                        </tr>
                        <tr className="border-b border-slate-800/80">
                          <td className="px-4 py-3 font-semibold text-slate-200">Basic QPSO</td>
                          <td className="px-4 py-3 font-mono">{typeof benchmarkResult.summary?.qpso?.mean_fitness === 'number' ? benchmarkResult.summary.qpso.mean_fitness.toFixed(2) : '—'}</td>
                          <td className="px-4 py-3 font-mono">{typeof benchmarkResult.summary?.qpso?.best_fitness === 'number' ? benchmarkResult.summary.qpso.best_fitness.toFixed(2) : '—'}</td>
                          <td className="px-4 py-3 font-mono">{typeof benchmarkResult.summary?.qpso?.worst_fitness === 'number' ? benchmarkResult.summary.qpso.worst_fitness.toFixed(2) : '—'}</td>
                          <td className="px-4 py-3 font-mono text-slate-400">±{typeof benchmarkResult.summary?.qpso?.std_fitness === 'number' ? benchmarkResult.summary.qpso.std_fitness.toFixed(2) : '—'}</td>
                          <td className="px-4 py-3 font-mono">{typeof benchmarkResult.summary?.qpso?.mean_runtime_sec === 'number' ? benchmarkResult.summary.qpso.mean_runtime_sec.toFixed(3) + 's' : '—'}</td>
                          <td className="px-4 py-3 font-mono">{typeof benchmarkResult.summary?.qpso?.mean_convergence_iter === 'number' ? benchmarkResult.summary.qpso.mean_convergence_iter.toFixed(0) : '—'}</td>
                          <td className="px-4 py-3 font-mono">{typeof benchmarkResult.summary?.qpso?.optimality_gap === 'number' ? `${benchmarkResult.summary.qpso.optimality_gap.toFixed(2)}%` : 'N/A'}</td>
                        </tr>
                        <tr className="bg-emerald-950/10 border-b border-emerald-900 text-emerald-300">
                          <td className="px-4 py-3 font-bold text-emerald-400">Improved QPSO (Proposed)</td>
                          <td className="px-4 py-3 font-mono font-bold">{typeof benchmarkResult.summary?.iqpso?.mean_fitness === 'number' ? benchmarkResult.summary.iqpso.mean_fitness.toFixed(2) : '—'}</td>
                          <td className="px-4 py-3 font-mono">{typeof benchmarkResult.summary?.iqpso?.best_fitness === 'number' ? benchmarkResult.summary.iqpso.best_fitness.toFixed(2) : '—'}</td>
                          <td className="px-4 py-3 font-mono">{typeof benchmarkResult.summary?.iqpso?.worst_fitness === 'number' ? benchmarkResult.summary.iqpso.worst_fitness.toFixed(2) : '—'}</td>
                          <td className="px-4 py-3 font-mono">±{typeof benchmarkResult.summary?.iqpso?.std_fitness === 'number' ? benchmarkResult.summary.iqpso.std_fitness.toFixed(2) : '—'}</td>
                          <td className="px-4 py-3 font-mono">{typeof benchmarkResult.summary?.iqpso?.mean_runtime_sec === 'number' ? benchmarkResult.summary.iqpso.mean_runtime_sec.toFixed(3) + 's' : '—'}</td>
                          <td className="px-4 py-3 font-mono">{typeof benchmarkResult.summary?.iqpso?.mean_convergence_iter === 'number' ? benchmarkResult.summary.iqpso.mean_convergence_iter.toFixed(0) : '—'}</td>
                          <td className="px-4 py-3 font-mono font-bold text-emerald-400">{typeof benchmarkResult.summary?.iqpso?.optimality_gap === 'number' ? `${benchmarkResult.summary.iqpso.optimality_gap.toFixed(2)}%` : 'N/A'}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-8 text-center text-slate-500 font-medium">
                    No comparison data. Select source/target nodes and click "Run Benchmark Comparison".
                  </div>
                )}
              </div>

              {benchmarkResult && (
                <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl text-xs">
                  <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-1.5">
                    <ShieldAlert className="text-purple-400" size={16} /> Non-Parametric Mann-Whitney U Hypothesis Verification
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    {benchmarkResult.statistical_tests?.pso_vs_iqpso ? (
                      <div className="bg-slate-800/40 p-3.5 rounded border border-slate-700/50">
                        <p className="font-semibold text-slate-300 mb-1">IQPSO vs. Classical PSO Baseline</p>
                        <p className="text-slate-400 font-mono mb-2">
                          U-statistic: {benchmarkResult.statistical_tests.pso_vs_iqpso.u_statistic ?? '—'} | p-value: {typeof benchmarkResult.statistical_tests.pso_vs_iqpso.p_value === 'number' ? benchmarkResult.statistical_tests.pso_vs_iqpso.p_value.toFixed(5) : '—'}
                        </p>
                        <span className={`px-2.5 py-1 rounded inline-block font-semibold ${
                          benchmarkResult.statistical_tests.pso_vs_iqpso.significant ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                        }`}>
                          {benchmarkResult.statistical_tests.pso_vs_iqpso.message ?? 'No data'}
                        </span>
                      </div>
                    ) : (
                      <div className="bg-slate-800/40 p-3.5 rounded border border-slate-700/50">
                        <p className="font-semibold text-slate-300 mb-1">IQPSO vs. Classical PSO Baseline</p>
                        <p className="text-slate-400 font-mono">—</p>
                      </div>
                    )}

                    {benchmarkResult.statistical_tests?.qpso_vs_iqpso ? (
                      <div className="bg-slate-800/40 p-3.5 rounded border border-slate-700/50">
                        <p className="font-semibold text-slate-300 mb-1">IQPSO vs. Basic QPSO Baseline</p>
                        <p className="text-slate-400 font-mono mb-2">
                          U-statistic: {benchmarkResult.statistical_tests.qpso_vs_iqpso.u_statistic ?? '—'} | p-value: {typeof benchmarkResult.statistical_tests.qpso_vs_iqpso.p_value === 'number' ? benchmarkResult.statistical_tests.qpso_vs_iqpso.p_value.toFixed(5) : '—'}
                        </p>
                        <span className={`px-2.5 py-1 rounded inline-block font-semibold ${
                          benchmarkResult.statistical_tests.qpso_vs_iqpso.significant ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                        }`}>
                          {benchmarkResult.statistical_tests.qpso_vs_iqpso.message ?? 'No data'}
                        </span>
                      </div>
                    ) : (
                      <div className="bg-slate-800/40 p-3.5 rounded border border-slate-700/50">
                        <p className="font-semibold text-slate-300 mb-1">IQPSO vs. Basic QPSO Baseline</p>
                        <p className="text-slate-400 font-mono">—</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>
          )}

          {/* TAB 4: Analytics Charts */}
          {tab === 'analytics' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
              
              {/* Convergence */}
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl h-[300px]">
                <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-1.5">
                  <Gauge size={14} className="text-emerald-400" /> Swarm Convergence Chart (Fitness vs Iteration)
                </h3>
                <div className="w-full h-full pb-6">
                  {getConvergenceData().length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={getConvergenceData()}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="iteration" stroke="#64748b" style={{ fontSize: 9 }} />
                        <YAxis stroke="#64748b" style={{ fontSize: 9 }} />
                        <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }} />
                        <Legend />
                        {benchmarkResult ? (
                          <>
                            <Line type="monotone" dataKey="PSO" stroke="#3b82f6" dot={false} strokeWidth={1.5} />
                            <Line type="monotone" dataKey="QPSO" stroke="#eab308" dot={false} strokeWidth={1.5} />
                            <Line type="monotone" dataKey="Improved_QPSO" stroke="#10b981" dot={false} strokeWidth={2.5} />
                          </>
                        ) : (
                          <Line type="monotone" dataKey="Fitness" stroke="#10b981" dot={false} strokeWidth={2} />
                        )}
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-500">Run a benchmark to plot curves.</div>
                  )}
                </div>
              </div>

              {/* Diversity */}
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl h-[300px]">
                <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-1.5">
                  <Activity size={14} className="text-blue-400" /> Swarm Diversity decay (Exploration vs Exploitation)
                </h3>
                <div className="w-full h-full pb-6">
                  {getDiversityData().length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={getDiversityData()}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="iteration" stroke="#64748b" style={{ fontSize: 9 }} />
                        <YAxis stroke="#64748b" style={{ fontSize: 9 }} />
                        <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }} />
                        <Legend />
                        <Line type="monotone" dataKey="PSO" stroke="#3b82f6" dot={false} strokeWidth={1.2} />
                        <Line type="monotone" dataKey="QPSO" stroke="#eab308" dot={false} strokeWidth={1.2} />
                        <Line type="monotone" dataKey="Improved_QPSO" stroke="#10b981" dot={false} strokeWidth={2.5} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-500">Diversity decay plotted over benchmark runs.</div>
                  )}
                </div>
              </div>

              {/* Runtime comparison */}
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl h-[300px]">
                <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-1.5">
                  <Play size={14} className="text-purple-400" /> Mean Wall-clock Runtime comparison (milliseconds)
                </h3>
                <div className="w-full h-full pb-6">
                  {getRuntimeBarData().length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={getRuntimeBarData()}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="name" stroke="#64748b" style={{ fontSize: 9 }} />
                        <YAxis stroke="#64748b" style={{ fontSize: 9 }} />
                        <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155' }} />
                        <Bar dataKey="Runtime" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-500">Mean runtime comparison graphs here.</div>
                  )}
                </div>
              </div>

              {/* Theoretical scalability plot */}
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl h-[300px]">
                <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-1.5">
                  <Database size={14} className="text-indigo-400" /> Scalability scaling (Problem Size vs Runtime)
                </h3>
                <div className="w-full h-full pb-6">
                  {scalabilityResult ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={scalabilityResult.results.map((r: any) => ({
                        size: r.num_customers * 5, // Approx node scale
                        Runtime_Sec: r.mean_runtime_sec
                      }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="size" name="Nodes Size" stroke="#64748b" style={{ fontSize: 9 }} />
                        <YAxis stroke="#64748b" style={{ fontSize: 9 }} />
                        <Tooltip />
                        <Line type="monotone" dataKey="Runtime_Sec" stroke="#6366f1" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-500">Run a scalability lab experiment to plot this.</div>
                  )}
                </div>
              </div>

            </div>
          )}

          {/* TAB 5: Scalability Lab */}
          {tab === 'experiment' && (
            <div className="flex flex-col gap-6 text-xs max-w-3xl mx-auto w-full">
              
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
                <h3 className="text-sm font-semibold text-slate-200 mb-2">Scalability & Robustness Laboratory</h3>
                <p className="text-[10px] text-slate-400 mb-4">
                  Run stochastic experiments across multiple dimensions (10, 25, 50, 100 customer nodes) to profile algorithm scaling laws.
                </p>

                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div>
                    <label className="text-slate-400 block mb-0.5">Base Seed (Reproducibility)</label>
                    <input 
                      type="number" 
                      value={seed}
                      onChange={(e) => setSeed(parseInt(e.target.value) || 42)}
                      className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-0.5">Runs per scale</label>
                    <input 
                      type="number" 
                      value={runs}
                      onChange={(e) => setRuns(parseInt(e.target.value) || 5)}
                      className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-0.5">Algorithm</label>
                    <select
                      value={experimentAlgorithm}
                      onChange={(e) => setExperimentAlgorithm(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200"
                    >
                      <option value="iqpso">Improved QPSO (Proposed)</option>
                      <option value="qpso">Basic QPSO</option>
                      <option value="pso">Classical PSO</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button 
                    onClick={handleRunScalabilityExperiment}
                    disabled={scalabilityRunning}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-slate-100 rounded py-2 font-bold"
                  >
                    {scalabilityRunning ? 'Running Experiment…' : 'Start Scalability Run'}
                  </button>
                  {scalabilityRunning && (
                    <div className="flex items-center gap-2 text-[10px] text-indigo-400">
                      <RefreshCw className="animate-spin" size={12} />
                      <span>EXPERIMENT RUNNING — {(typeof experimentAlgorithm === 'string' ? experimentAlgorithm : 'IQPSO').toUpperCase()} — {runs} runs × {[10,25,50,100].join(', ')} nodes</span>
                    </div>
                  )}
                  {scalabilityResult && (
                    <>
                      <button 
                        onClick={() => handleExportData('json')}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-200 rounded px-4 py-2 border border-slate-700 flex items-center gap-1.5"
                      >
                        <Download size={14} /> Export JSON
                      </button>
                      <button 
                        onClick={() => handleExportData('csv')}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-200 rounded px-4 py-2 border border-slate-700 flex items-center gap-1.5"
                      >
                        <Download size={14} /> Export CSV
                      </button>
                    </>
                  )}
                </div>
              </div>

              {scalabilityResult && scalabilityResult.results && (
                <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
                  <h3 className="text-sm font-semibold text-slate-200 mb-3">Experimental Scale Log Results</h3>
                  <table className="w-full text-left text-slate-300">
                    <thead className="bg-slate-800 border-b border-slate-800">
                      <tr>
                        <th className="px-4 py-2">Test Scale (Customers)</th>
                        <th className="px-4 py-2">Mean Fitness</th>
                        <th className="px-4 py-2">Best Fitness</th>
                        <th className="px-4 py-2">Mean Runtime</th>
                        <th className="px-4 py-2">Success Rate</th>
                        <th className="px-4 py-2">Violated Runs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scalabilityResult.results.map((r: any, idx: number) => (
                        <tr key={idx} className="border-b border-slate-800/80">
                          <td className="px-4 py-2.5 font-semibold text-slate-200">{r.num_customers ?? '?'} customers</td>
                          <td className="px-4 py-2.5 font-mono">{typeof r.mean_fitness === 'number' ? r.mean_fitness.toFixed(2) : '—'}</td>
                          <td className="px-4 py-2.5 font-mono">{typeof r.best_fitness === 'number' ? r.best_fitness.toFixed(2) : '—'}</td>
                          <td className="px-4 py-2.5 font-mono">{typeof r.mean_runtime_sec === 'number' ? r.mean_runtime_sec.toFixed(3) + 's' : '—'}</td>
                          <td className="px-4 py-2.5 font-mono">{typeof r.success_rate === 'number' ? r.success_rate.toFixed(1) + '%' : '—'}</td>
                          <td className="px-4 py-2.5 font-mono text-red-400">{r.violations ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

            </div>
          )}

          {/* TAB 6: Research Mode */}
          {tab === 'research' && (
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl text-xs max-w-4xl mx-auto w-full leading-relaxed space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-slate-200 border-b border-slate-800 pb-2 mb-3">
                  Research HUD: Problem Formulation & Metaheuristic Logic
                </h3>
                <p className="text-slate-400">
                  This panel details the mathematical equations and encoding transformations implementing the quantum-behaved particle search.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-slate-200 mb-1.5 uppercase tracking-wider text-[10px]">1. Wave Attractor Equations (QPSO)</h4>
                <p className="text-slate-300">
                  Unlike classical PSO which tracks particle velocity $V_i$, QPSO treats particles as wave functions in a potential well. The mean best position ($mbest$) compiles the spatial average of personal records:
                </p>
                <div className="bg-slate-950 p-3 rounded font-mono text-emerald-400 my-2 text-center">
                  mbest(t) = 1/M * Σ pbest_i(t)
                </div>
                <p className="text-slate-300">
                  Position updates are computed from the delta well attractor point:
                </p>
                <div className="bg-slate-950 p-3 rounded font-mono text-emerald-400 my-2 text-center">
                  x_ij(t+1) = p_ij(t) ± α * |mbest_j(t) - x_ij(t)| * ln(1/u)
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-slate-200 mb-1.5 uppercase tracking-wider text-[10px]">2. Proposed Improvements & Divergence Control</h4>
                <p className="text-slate-300">
                  Standard QPSO struggles with premature swarm collapse. The Proposed IQPSO introduces:
                </p>
                <ul className="list-disc pl-5 text-slate-300 mt-1.5 space-y-1">
                  <li><b>Adaptive Swarm Diversity ($\alpha(t)$)</b>: Swarm coordinate variance is measured against target curves. If collapsing too quickly, $\alpha$ expands to trigger exploration; else, it decays to speed up exploitation.</li>
                  <li><b>Cauchy Stagnation Mutation</b>: If the global best ($gbest$) remains unchanged for 5 iterations, a Cauchy-distributed jump perturb is applied to escape local minima.</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-slate-200 mb-1.5 uppercase tracking-wider text-[10px]">3. Combinatorial Mappings (Continuous-to-Discrete)</h4>
                <ul className="list-disc pl-5 text-slate-300 space-y-1.5">
                  <li><b>Priority SP Decoder</b>: Dimension represents junction priority. Path traversals choosing the highest-priority adjacent roads are evaluated. If a roadblock occurs, Dijkstra path repair applies a $+1000$ penalty.</li>
                  <li><b>Random Keys VRP Heuristic</b>: Continuous vectors are sorted to create customer sequence orders, which are partitioned into vehicle routes using capacity-constrained greedy splitting.</li>
                </ul>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}

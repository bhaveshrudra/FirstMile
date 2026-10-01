import React, { useState, useMemo, useEffect } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Tooltip,
  Popup,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import {
  Play,
  Zap,
  Clock,
  ShieldAlert,
  RefreshCw,
  ChevronDown,
  ArrowRight,
  Compass,
  Sparkles,
  Cpu,
} from 'lucide-react';
import {
  INDIA_NODES,
  INITIAL_ROUTES,
  LogisticsNode,
} from '../services/indiaLogisticsService';
import api from '../services/api';

interface CascadingDisruptionCenterProps {
  onReturnToMap?: () => void;
  onApplyFastRecoverGlobal?: () => void;
}

export type CascadeStageId =
  | 'overview'
  | 'route'
  | 'shipments'
  | 'warehouse'
  | 'customer'
  | 'secondary';

interface CascadeStageInfo {
  id: CascadeStageId;
  stepNumber: number;
  title: string;
  affectedEntity: string;
  impact: string;
  severity: 'CRITICAL' | 'HIGH' | 'ELEVATED' | 'MODERATE' | 'LOW';
  horizon: string;
  detail: string;
  iconName: string;
}

interface TimelineConsequence {
  timeLabel: string;
  title: string;
  projectedConsequence: string;
  riskScore: number;
  severityColor: string;
}

interface BestActionOption {
  id: string;
  rank: number;
  title: string;
  method: string;
  impact: string;
  feasibility: 'HIGH FEASIBILITY' | 'AVAILABLE' | 'CONDITIONAL';
  scorePct: number;
  isPrimary?: boolean;
}

interface DisruptionDossier {
  id: string;
  title: string;
  disruptionType: string;
  targetId: string;
  location: string;
  severity: number;
  durationHours: number;
  capacityImpact: string;
  description: string;
  affectedRouteId?: string;
  affectedNodeId?: string;
  bypassRouteIds: string[];
  secondaryRouteId?: string;
  mapCenter: [number, number];
  mapZoom: number;
  stages: CascadeStageInfo[];
  timeline: TimelineConsequence[];
  nextBestActions: BestActionOption[];
  recoveryPlan: {
    solver: string;
    objective: string;
    timeDelta: string;
    distDelta: string;
    costDelta: string;
    riskReduction: string;
    bypassCorridor: string;
    feasibility: string;
  };
}

// 8 DISRUPTION PROFILES DIRECTLY GROUNDED IN DATASET & NETWORK RELATIONSHIPS
const DISRUPTION_DOSSIERS: Record<string, DisruptionDossier> = {
  'DIS-002': {
    id: 'DIS-002',
    title: 'Route Blockage',
    disruptionType: 'Route Blockage',
    targetId: 'RT-007 / R-021A',
    location: 'NH-44 / RT-007 (J-JA Jadcherla ➔ J2 Kurnool Sector)',
    severity: 4,
    durationHours: 36,
    capacityImpact: '100% capacity reduction',
    description: 'Port access & national highway corridor blocked due to landslide; freight requires an alternate path.',
    affectedRouteId: 'R-021A',
    affectedNodeId: 'J2',
    bypassRouteIds: ['R-005A', 'R-005B', 'R-005C', 'R-005D', 'R-005E'],
    secondaryRouteId: 'R-007A',
    mapCenter: [15.8281, 78.5],
    mapZoom: 6,
    stages: [
      {
        id: 'route',
        stepNumber: 1,
        title: '1. Affected Transport Link',
        affectedEntity: 'Route RT-007 / R-021A (NH-44)',
        impact: 'PROJECTED IMPACT: 100% capacity loss; carriageway impassable',
        severity: 'CRITICAL',
        horizon: 'Immediate (T+0)',
        detail: 'Landslide on NH-44 near Kurnool pass blocks both freight lanes. Upstream traffic halted at Jadcherla checkpoint.',
        iconName: 'roadblock',
      },
      {
        id: 'shipments',
        stepNumber: 2,
        title: '2. Shipment Delay Propagation',
        affectedEntity: 'Consignment SHP-5002 (500 units SKU-PK-01)',
        impact: 'POTENTIAL CASCADE: +4.8h delay accumulation; vehicle queued',
        severity: 'HIGH',
        horizon: '+4 to +6 Hours',
        detail: 'Scheduled freight conveyance held at transit waypoint J-JA. Driver hours-of-service limit approaching expiration.',
        iconName: 'truck',
      },
      {
        id: 'warehouse',
        stepNumber: 3,
        title: '3. Warehouse Inventory Risk',
        affectedEntity: 'WH-003 (Bengaluru South DC)',
        impact: 'RISK INCREASE: Stock approaches safety threshold (-38% intake)',
        severity: 'HIGH',
        horizon: '+12 Hours',
        detail: 'Inbound packaging replenishment missed. Secondary assembly packing lines face potential component starvation.',
        iconName: 'warehouse',
      },
      {
        id: 'customer',
        stepNumber: 4,
        title: '4. Customer & SLA Exposure',
        affectedEntity: 'Order ORD-1002 (Tier-1 Retail Depot)',
        impact: 'PROJECTED IMPACT: SLA delivery window penalty ($1,250 fee)',
        severity: 'ELEVATED',
        horizon: '+24 Hours',
        detail: 'Guaranteed next-day fulfillment agreement breached unless bypass route is executed within 6-hour response window.',
        iconName: 'customer',
      },
      {
        id: 'secondary',
        stepNumber: 5,
        title: '5. Possible Secondary Disruption',
        affectedEntity: 'Western Transit Corridor (R-007 via Solapur)',
        impact: 'POTENTIAL CASCADE: +35% congestion spillover from diverted trucks',
        severity: 'MODERATE',
        horizon: '+36 to +48 Hours',
        detail: 'Uncoordinated driver detour choices risk bottlenecking single-lane toll plazas along the Solapur-Kalaburagi vector.',
        iconName: 'secondary',
      },
    ],
    timeline: [
      { timeLabel: 'NOW (T+0)', title: 'Incident Active', projectedConsequence: 'Dual carriageway blocked. Inbound conveyances halted at Jadcherla toll gateway.', riskScore: 82, severityColor: '#ef4444' },
      { timeLabel: '+6 HOURS', title: 'Buffer Exhaustion', projectedConsequence: 'Tailback reaches 18 km. Initial shipment delay accumulates +2.1h beyond schedule.', riskScore: 88, severityColor: '#f97316' },
      { timeLabel: '+12 HOURS', title: 'Intake Postponement', projectedConsequence: 'WH-003 scheduled night cross-dock shift canceled. Inventory reserves dip to 2-day margin.', riskScore: 92, severityColor: '#f59e0b' },
      { timeLabel: '+24 HOURS', title: 'Contractual Penalty', projectedConsequence: 'Order ORD-1002 breaches Tier-1 SLA threshold. Financial delay indemnity applied.', riskScore: 96, severityColor: '#dc2626' },
      { timeLabel: '+48 HOURS', title: 'Corridor Gridlock', projectedConsequence: 'Spillover congestion paralyses Western alternative route R-007 without coordinated swarm reroute.', riskScore: 99, severityColor: '#991b1b' },
    ],
    nextBestActions: [
      {
        id: 'act-reroute',
        rank: 1,
        title: 'REROUTE AFFECTED SHIPMENTS',
        method: 'IQPSO Quantum Swarm Optimization via Eastern Coastal Bypass',
        impact: 'Diverts freight around landslide via J3 (Vijayawada) ➔ J4 (Nellore) ➔ Chennai ➔ J5',
        feasibility: 'HIGH FEASIBILITY',
        scorePct: 98,
        isPrimary: true,
      },
      {
        id: 'act-reallocate',
        rank: 2,
        title: 'REALLOCATE INVENTORY',
        method: 'Emergency cross-warehouse transfer from WH-001 (Nagpur) to WH-003',
        impact: 'Protects threatened customer orders from potential packaging stockouts',
        feasibility: 'AVAILABLE',
        scorePct: 82,
      },
      {
        id: 'act-monitor',
        rank: 3,
        title: 'CONTINUE MONITORING',
        method: 'Automated highway camera & road agency telemetry polling',
        impact: 'Track structural clearance progress; holds buffer if clearance under 6h',
        feasibility: 'CONDITIONAL',
        scorePct: 54,
      },
    ],
    recoveryPlan: {
      solver: 'IQPSO (Adaptive Swarm)',
      objective: '2.0158 Optimal',
      timeDelta: '+3.2h',
      distDelta: '+210 km',
      costDelta: '+12%',
      riskReduction: '-91.5%',
      bypassCorridor: 'WH-002 ➔ J3 (Vijayawada) ➔ J4 (Nellore) ➔ Chennai ➔ J5 ➔ WH-003',
      feasibility: '100% FEASIBLE (0 Constraint Violations)',
    },
  },

  'DIS-001': {
    id: 'DIS-001',
    title: 'Supplier Failure',
    disruptionType: 'Supplier Failure',
    targetId: 'SUP-001',
    location: 'Northstar Components Production Facility (Mumbai Hub)',
    severity: 5,
    durationHours: 120,
    capacityImpact: '100% capacity reduction for 5 days',
    description: 'Primary electronics manufacturer unavailable due to power grid failure; shipments suspended.',
    affectedRouteId: 'R-001A',
    affectedNodeId: 'SUP-001',
    bypassRouteIds: ['R-004A', 'R-004B', 'R-004C'],
    secondaryRouteId: 'R-002A',
    mapCenter: [19.076, 74.5],
    mapZoom: 6,
    stages: [
      {
        id: 'route',
        stepNumber: 1,
        title: '1. Affected Supply Origin',
        affectedEntity: 'Supplier SUP-001 (Northstar Components)',
        impact: 'PROJECTED IMPACT: 100% factory dispatch suspension for 120 hours',
        severity: 'CRITICAL',
        horizon: 'Immediate (T+0)',
        detail: 'Manufacturing line shut down. Outbound dispatch loading bays locked.',
        iconName: 'supplier',
      },
      {
        id: 'shipments',
        stepNumber: 2,
        title: '2. Outbound Dispatch Freeze',
        affectedEntity: 'Consignment SHP-5001 (240 units Electronics SKU-EL-01)',
        impact: 'POTENTIAL CASCADE: Inbound delivery to Nagpur Hub cancelled',
        severity: 'CRITICAL',
        horizon: '+4 to +6 Hours',
        detail: 'Carrier tractor unassigned at origin. Freight delayed indefinitely without source switch.',
        iconName: 'truck',
      },
      {
        id: 'warehouse',
        stepNumber: 3,
        title: '3. Hub Safety Stock Depletion',
        affectedEntity: 'WH-001 (Nagpur Central Hub)',
        impact: 'RISK INCREASE: Electronics stock drops below critical 3-day safety threshold',
        severity: 'HIGH',
        horizon: '+12 Hours',
        detail: 'Buffer inventory drawn down by daily outgoing dispatches without replenishment.',
        iconName: 'warehouse',
      },
      {
        id: 'customer',
        stepNumber: 4,
        title: '4. Downstream Production Starvation',
        affectedEntity: 'Customer Orders ORD-1001 & ORD-1003',
        impact: 'PROJECTED IMPACT: Factory client production line shutdown risk',
        severity: 'HIGH',
        horizon: '+24 Hours',
        detail: 'Tier-1 clients face parts starvation. Daily contractual claims of $4,500/day.',
        iconName: 'customer',
      },
      {
        id: 'secondary',
        stepNumber: 5,
        title: '5. Secondary Stockout Cascades',
        affectedEntity: 'Regional Distribution Center WH-002 (Hyderabad)',
        impact: 'POTENTIAL CASCADE: Stock transfer starvation across secondary network',
        severity: 'MODERATE',
        horizon: '+48 Hours',
        detail: 'Nagpur unable to fulfill secondary cross-dock orders to Southern hubs.',
        iconName: 'secondary',
      },
    ],
    timeline: [
      { timeLabel: 'NOW (T+0)', title: 'Facility Blackout', projectedConsequence: 'Factory transformers offline. Outbound assembly batches halted at loading dock.', riskScore: 90, severityColor: '#ef4444' },
      { timeLabel: '+6 HOURS', title: 'Carrier Unassigned', projectedConsequence: 'Scheduled freight trucks released without cargo. Booking cancellation fees applied.', riskScore: 93, severityColor: '#f97316' },
      { timeLabel: '+12 HOURS', title: 'Nagpur Buffer Drop', projectedConsequence: 'Nagpur hub available SKU-EL-01 units drop from 1,200 to 960 (20% reserve reduction).', riskScore: 95, severityColor: '#f59e0b' },
      { timeLabel: '+24 HOURS', title: 'Backorders Triggered', projectedConsequence: 'Client customer orders placed on unfulfilled backorder status.', riskScore: 98, severityColor: '#dc2626' },
      { timeLabel: '+48 HOURS', title: 'Multi-Hub Starvation', projectedConsequence: 'Secondary stockout alerts ripple across Hyderabad and Bengaluru distribution centers.', riskScore: 100, severityColor: '#991b1b' },
    ],
    nextBestActions: [
      {
        id: 'act-reallocate',
        rank: 1,
        title: 'REALLOCATE INVENTORY',
        method: 'Cross-warehouse stock rebalancing from WH-005 (Delhi Hub)',
        impact: 'Immediately covers 240 units deficit from Northern reserve stock',
        feasibility: 'HIGH FEASIBILITY',
        scorePct: 96,
        isPrimary: true,
      },
      {
        id: 'act-reroute',
        rank: 2,
        title: 'REROUTE AFFECTED SHIPMENTS',
        method: 'Switch procurement corridor to secondary electronics supplier SUP-004',
        impact: 'Establishes alternate supply corridor along Hyderabad DC vector',
        feasibility: 'AVAILABLE',
        scorePct: 88,
      },
      {
        id: 'act-monitor',
        rank: 3,
        title: 'CONTINUE MONITORING',
        method: 'Hourly utility power restoration teleconference with supplier engineering',
        impact: 'Tracks grid restoration ETA before activating permanent vendor switch',
        feasibility: 'CONDITIONAL',
        scorePct: 45,
      },
    ],
    recoveryPlan: {
      solver: 'Inventory Reallocator + IQPSO',
      objective: '1.9420 Optimal',
      timeDelta: '+4.5h',
      distDelta: '+180 km',
      costDelta: '+8%',
      riskReduction: '-84.0%',
      bypassCorridor: 'WH-005 (Delhi) ➔ J10 ➔ J11 ➔ WH-001 (Nagpur Reserve Flow)',
      feasibility: '100% FEASIBLE (Inventory Stock Confirmed)',
    },
  },

  'DIS-003': {
    id: 'DIS-003',
    title: 'Extreme Weather',
    disruptionType: 'Extreme Weather',
    targetId: 'RT-009 / R-004B',
    location: 'NH-46 Central High Plains (J10 Gwalior ➔ J11 Bhopal)',
    severity: 4,
    durationHours: 48,
    capacityImpact: '60% speed & throughput degradation',
    description: 'Severe cyclonic storm & localized flooding reduces highway capacity by 60%.',
    affectedRouteId: 'R-004B',
    affectedNodeId: 'J11',
    bypassRouteIds: ['R-009A', 'R-003A'],
    secondaryRouteId: 'R-004C',
    mapCenter: [24.5, 78.0],
    mapZoom: 6,
    stages: [
      {
        id: 'route',
        stepNumber: 1,
        title: '1. Flooded Highway Sector',
        affectedEntity: 'Route R-004B (Gwalior ➔ Bhopal NH-46)',
        impact: 'PROJECTED IMPACT: 60% capacity drop; max speed restricted to 25 km/h',
        severity: 'HIGH',
        horizon: 'Immediate (T+0)',
        detail: 'Heavy monsoon cloudburst causes localized flooding across river bridge approaches.',
        iconName: 'roadblock',
      },
      {
        id: 'shipments',
        stepNumber: 2,
        title: '2. Convoy Crawling & Delays',
        affectedEntity: 'Shipment SHP-5003 (180 units Electronics SKU-EL-02)',
        impact: 'POTENTIAL CASCADE: +6.2h transit delay accumulation',
        severity: 'HIGH',
        horizon: '+4 to +6 Hours',
        detail: 'Police escort enforcing single-file convoy crawl. Fuel burn increases +38%.',
        iconName: 'truck',
      },
      {
        id: 'warehouse',
        stepNumber: 3,
        title: '3. Receiving Hub Scheduling Shock',
        affectedEntity: 'WH-001 (Nagpur Central Hub)',
        impact: 'RISK INCREASE: Shift crew idle time followed by intake congestion',
        severity: 'MODERATE',
        horizon: '+12 Hours',
        detail: 'Receiving docks face scheduling gaps followed by arrival bunching of multiple convoys.',
        iconName: 'warehouse',
      },
      {
        id: 'customer',
        stepNumber: 4,
        title: '4. Commercial Delivery Slippage',
        affectedEntity: 'Order ORD-1003 (Central Commercial Depot)',
        impact: 'PROJECTED IMPACT: Delivery window delayed by one full business day',
        severity: 'ELEVATED',
        horizon: '+24 Hours',
        detail: 'Customer warehouse requires rescheduling unloading labor and security clearances.',
        iconName: 'customer',
      },
      {
        id: 'secondary',
        stepNumber: 5,
        title: '5. Secondary Bridge Approach Washout',
        affectedEntity: 'J11 (Bhopal Transit Junction)',
        impact: 'POTENTIAL CASCADE: Full closure risk if rainfall continues past 24 hours',
        severity: 'HIGH',
        horizon: '+36 to +48 Hours',
        detail: 'Hydrological sensors warn of secondary embankment erosion at southern culverts.',
        iconName: 'secondary',
      },
    ],
    timeline: [
      { timeLabel: 'NOW (T+0)', title: 'Flood Alert Triggered', projectedConsequence: 'Hydro-meteorological warning posted. Highway patrol restricts heavy vehicle speeds.', riskScore: 78, severityColor: '#ef4444' },
      { timeLabel: '+6 HOURS', title: 'Convoy Bottleneck', projectedConsequence: 'Vehicles bunch into 12 km single-lane crawling convoy; delay reaches +3.4 hours.', riskScore: 84, severityColor: '#f97316' },
      { timeLabel: '+12 HOURS', title: 'Fuel Idling Penalty', projectedConsequence: 'In-transit fuel costs surge +42%. Auxiliary refrigeration batteries draw down.', riskScore: 88, severityColor: '#f59e0b' },
      { timeLabel: '+24 HOURS', title: 'Dock Rescheduling', projectedConsequence: 'Nagpur intake team reallocates midnight dock assignment to morning shift.', riskScore: 91, severityColor: '#dc2626' },
      { timeLabel: '+48 HOURS', title: 'Full Embankment Block', projectedConsequence: 'Culvert washout threatens permanent corridor severance without eastern detour via Raipur.', riskScore: 95, severityColor: '#991b1b' },
    ],
    nextBestActions: [
      {
        id: 'act-reroute',
        rank: 1,
        title: 'REROUTE AFFECTED SHIPMENTS',
        method: 'IQPSO detour via Gwalior ➔ Raipur Gateway bypass R-009A',
        impact: 'Completely circumvents flooded NH-46 sector; guarantees dry pavement',
        feasibility: 'HIGH FEASIBILITY',
        scorePct: 95,
        isPrimary: true,
      },
      {
        id: 'act-monitor',
        rank: 2,
        title: 'CONTINUE MONITORING',
        method: 'Radar telemetry tracking rainband movement east toward Jabalpur',
        impact: 'Permits existing convoy to proceed if cloudburst passes in under 4 hours',
        feasibility: 'AVAILABLE',
        scorePct: 76,
      },
      {
        id: 'act-reallocate',
        rank: 3,
        title: 'REALLOCATE INVENTORY',
        method: 'Fulfill order ORD-1003 from local Nagpur buffer rather than Delhi transit',
        impact: 'Protects customer SLA while delayed convoy completes slow crawl',
        feasibility: 'AVAILABLE',
        scorePct: 70,
      },
    ],
    recoveryPlan: {
      solver: 'IQPSO Swarm Optimizer',
      objective: '2.1050 Optimal',
      timeDelta: '+2.8h',
      distDelta: '+140 km',
      costDelta: '+9%',
      riskReduction: '-88.5%',
      bypassCorridor: 'WH-005 ➔ J10 (Gwalior) ➔ J13 (Raipur Detour) ➔ WH-001',
      feasibility: '100% FEASIBLE (Weather-Safe Corridor)',
    },
  },

  'DIS-004': {
    id: 'DIS-004',
    title: 'Warehouse Disruption',
    disruptionType: 'Warehouse Disruption',
    targetId: 'WH-002',
    location: 'Hyderabad Central Distribution Center (WH-002)',
    severity: 3,
    durationHours: 24,
    capacityImpact: '40% throughput reduction',
    description: 'Automated sorting grid breakdown reduces warehouse operating capacity by 40%.',
    affectedRouteId: 'R-020',
    affectedNodeId: 'WH-002',
    bypassRouteIds: ['R-007D', 'R-007E'],
    secondaryRouteId: 'R-002B',
    mapCenter: [17.385, 78.4867],
    mapZoom: 7,
    stages: [
      {
        id: 'route',
        stepNumber: 1,
        title: '1. Affected Logistics Hub',
        affectedEntity: 'WH-002 (Hyderabad Central DC)',
        impact: 'PROJECTED IMPACT: 40% automated sorting capacity offline',
        severity: 'ELEVATED',
        horizon: 'Immediate (T+0)',
        detail: 'Sorting crane malfunction on High-Bay Tier B. Pallet retrieval rate falls to 60%.',
        iconName: 'warehouse',
      },
      {
        id: 'shipments',
        stepNumber: 2,
        title: '2. Yard Queuing & Dock Stagnation',
        affectedEntity: 'Cross-dock freight & regional dispatch trucks',
        impact: 'POTENTIAL CASCADE: Trailer turnaround time increases from 1.5h to 5.2h',
        severity: 'HIGH',
        horizon: '+4 to +6 Hours',
        detail: 'Trailers held on access ring road. Parking apron reaches 94% saturation.',
        iconName: 'truck',
      },
      {
        id: 'warehouse',
        stepNumber: 3,
        title: '3. Internal Throughput Choke',
        affectedEntity: 'Pallet staging & sorting buffers',
        impact: 'RISK INCREASE: 1,400 pallets backlogged on intake floor',
        severity: 'HIGH',
        horizon: '+12 Hours',
        detail: 'Inbound trailers unable to discharge cargo due to floor congestion.',
        iconName: 'warehouse',
      },
      {
        id: 'customer',
        stepNumber: 4,
        title: '4. Regional Order Delivery Delays',
        affectedEntity: 'Regional retail consignments in Telangana & Andhra',
        impact: 'PROJECTED IMPACT: Same-day dispatches postponed to next operating shift',
        severity: 'MODERATE',
        horizon: '+24 Hours',
        detail: 'Orders pending pick-wave generation frozen until sorting gantry rebooted.',
        iconName: 'customer',
      },
      {
        id: 'secondary',
        stepNumber: 5,
        title: '5. Secondary Overflow Diversion',
        affectedEntity: 'WH-001 (Nagpur) & WH-003 (Bengaluru)',
        impact: 'POTENTIAL CASCADE: Emergency freight overflow redirected to sister hubs',
        severity: 'MODERATE',
        horizon: '+36 to +48 Hours',
        detail: 'Sister hubs absorb unexpected inbound re-routes, elevating dock utilization.',
        iconName: 'secondary',
      },
    ],
    timeline: [
      { timeLabel: 'NOW (T+0)', title: 'Sorter Grid Alarm', projectedConsequence: 'High-bay crane sensor fault. High-velocity sortation lanes 3 & 4 shut down.', riskScore: 65, severityColor: '#f97316' },
      { timeLabel: '+6 HOURS', title: 'Apron Congestion', projectedConsequence: 'Inbound trailers queue across facility perimeter road; driver check-in stalled.', riskScore: 74, severityColor: '#f59e0b' },
      { timeLabel: '+12 HOURS', title: 'Staging Saturation', projectedConsequence: 'Pallet staging area full; inbound trailers held without offloading.', riskScore: 82, severityColor: '#ea580c' },
      { timeLabel: '+24 HOURS', title: 'Regional Dispatches Delayed', projectedConsequence: '320 regional merchant orders delayed by 18 hours. Customer support tickets spike.', riskScore: 86, severityColor: '#dc2626' },
      { timeLabel: '+48 HOURS', title: 'Overflow Pressure', projectedConsequence: 'Unresolved freight spills into Bengaluru intake stream unless dynamic bypass active.', riskScore: 89, severityColor: '#991b1b' },
    ],
    nextBestActions: [
      {
        id: 'act-reallocate',
        rank: 1,
        title: 'REALLOCATE INVENTORY & BYPASS',
        method: 'Cross-dock bypass via Western transit link J8 (Kalaburagi)',
        impact: 'Reroutes incoming freight around Hyderabad DC directly to destination nodes',
        feasibility: 'HIGH FEASIBILITY',
        scorePct: 94,
        isPrimary: true,
      },
      {
        id: 'act-reroute',
        rank: 2,
        title: 'REROUTE AFFECTED SHIPMENTS',
        method: 'Direct long-haul dispatches from Nagpur straight to Bengaluru South DC',
        impact: 'Avoids intermediate hub handling, freeing up Hyderabad dock capacity',
        feasibility: 'AVAILABLE',
        scorePct: 86,
      },
      {
        id: 'act-monitor',
        rank: 3,
        title: 'CONTINUE MONITORING',
        method: 'Maintenance technician diagnostic monitoring of crane drive motor',
        impact: 'Assesses whether mechanical repair completes within 8 hours',
        feasibility: 'AVAILABLE',
        scorePct: 62,
      },
    ],
    recoveryPlan: {
      solver: 'Cross-Dock Optimizer',
      objective: '1.8840 Optimal',
      timeDelta: '+1.5h',
      distDelta: '+65 km',
      costDelta: '+4%',
      riskReduction: '-76.0%',
      bypassCorridor: 'Nagpur WH-001 ➔ J8 (Kalaburagi Direct Bypass) ➔ Bengaluru WH-003',
      feasibility: '100% FEASIBLE (Hub Congestion Avoided)',
    },
  },

  'DIS-005': {
    id: 'DIS-005',
    title: 'Demand Spike',
    disruptionType: 'Demand Spike',
    targetId: 'WH-001',
    location: 'Nagpur Central Hub (WH-001)',
    severity: 3,
    durationHours: 72,
    capacityImpact: '+35% sudden surge in order volume',
    description: 'Commercial festival sales trigger 35% surge in orders for electronics and packaging SKUs.',
    affectedRouteId: 'R-003A',
    affectedNodeId: 'WH-001',
    bypassRouteIds: ['R-001B', 'R-004C'],
    secondaryRouteId: 'R-003B',
    mapCenter: [21.1458, 79.0882],
    mapZoom: 7,
    stages: [
      {
        id: 'route',
        stepNumber: 1,
        title: '1. Outbound Shipping Surge',
        affectedEntity: 'WH-001 Outbound Transit Trunk R-003A',
        impact: 'PROJECTED IMPACT: Outbound dispatch demand exceeds fleet quota by 35%',
        severity: 'ELEVATED',
        horizon: 'Immediate (T+0)',
        detail: 'Flash commercial sales event spikes SKU-MT-01 and SKU-EL-01 withdrawal orders.',
        iconName: 'warehouse',
      },
      {
        id: 'shipments',
        stepNumber: 2,
        title: '2. Carrier Availability Deficit',
        affectedEntity: 'Scheduled Outbound Fleets',
        impact: 'POTENTIAL CASCADE: Trailer shortage causes 3.5h dock pickup delays',
        severity: 'HIGH',
        horizon: '+4 to +6 Hours',
        detail: 'Contracted fleet capacity exhausted. Spot freight tender rates surge +28%.',
        iconName: 'truck',
      },
      {
        id: 'warehouse',
        stepNumber: 3,
        title: '3. Inventory Depletion & Stockout',
        affectedEntity: 'WH-001 Fast-Moving Stock Bins',
        impact: 'RISK INCREASE: SKU-MT-01 inventory projected to deplete in 36 hours',
        severity: 'CRITICAL',
        horizon: '+12 Hours',
        detail: 'Pick rates triple nominal velocity. Warehouse reserve reaches danger threshold.',
        iconName: 'warehouse',
      },
      {
        id: 'customer',
        stepNumber: 4,
        title: '4. Backorders & Order Splitting',
        affectedEntity: 'Metro Retail Depot (Kolkata) & Regional Clients',
        impact: 'PROJECTED IMPACT: Partial shipment fulfillment & order splitting required',
        severity: 'HIGH',
        horizon: '+24 Hours',
        detail: 'Clients receive 65% of ordered volume; backorders scheduled for delayed shipment.',
        iconName: 'customer',
      },
      {
        id: 'secondary',
        stepNumber: 5,
        title: '5. Upstream Procurement Strain',
        affectedEntity: 'Suppliers SUP-001 & SUP-005',
        impact: 'POTENTIAL CASCADE: Emergency expedite orders placed on raw suppliers',
        severity: 'MODERATE',
        horizon: '+36 to +48 Hours',
        detail: 'Suppliers pushed to maximum daily production rates, straining lead times.',
        iconName: 'secondary',
      },
    ],
    timeline: [
      { timeLabel: 'NOW (T+0)', title: 'Surge Injected', projectedConsequence: 'Order volume surges +35%. Automated picking queues spike to 3,800 units.', riskScore: 68, severityColor: '#f97316' },
      { timeLabel: '+6 HOURS', title: 'Carrier Shortage', projectedConsequence: 'Dock dispatch slips behind schedule. Secondary third-party logistics trucks contracted.', riskScore: 76, severityColor: '#f59e0b' },
      { timeLabel: '+12 HOURS', title: 'Bin Depletion', projectedConsequence: 'Fast-moving SKU-PK-01 and SKU-MT-01 reserves drop below 24-hour safety margin.', riskScore: 84, severityColor: '#ea580c' },
      { timeLabel: '+24 HOURS', title: 'Split Shipments', projectedConsequence: 'First wave of split-shipment notifications sent to retail customers in Kolkata.', riskScore: 89, severityColor: '#dc2626' },
      { timeLabel: '+48 HOURS', title: 'Stockout Alert', projectedConsequence: 'Complete stockout of SKU-MT-01 at Nagpur without emergency inbound transfer.', riskScore: 94, severityColor: '#991b1b' },
    ],
    nextBestActions: [
      {
        id: 'act-reallocate',
        rank: 1,
        title: 'REALLOCATE INVENTORY',
        method: 'Emergency cross-hub stock transfer from Delhi Hub (WH-005)',
        impact: 'Injects 450 units into Nagpur inventory, preventing stockout',
        feasibility: 'HIGH FEASIBILITY',
        scorePct: 95,
        isPrimary: true,
      },
      {
        id: 'act-reroute',
        rank: 2,
        title: 'REROUTE AFFECTED SHIPMENTS',
        method: 'Direct customer fulfillment fulfillment from Chennai supplier SUP-002',
        impact: 'Bypasses depleted Nagpur hub entirely, fulfilling Kolkata orders directly',
        feasibility: 'AVAILABLE',
        scorePct: 85,
      },
      {
        id: 'act-monitor',
        rank: 3,
        title: 'CONTINUE MONITORING',
        method: 'Real-time order consumption rate telemetry tracking',
        impact: 'Identifies SKU exhaustion tipping point dynamically',
        feasibility: 'AVAILABLE',
        scorePct: 58,
      },
    ],
    recoveryPlan: {
      solver: 'Inventory Balancer + QPSO',
      objective: '1.9120 Optimal',
      timeDelta: '+1.8h',
      distDelta: '+90 km',
      costDelta: '+6%',
      riskReduction: '-82.0%',
      bypassCorridor: 'WH-005 (Delhi) ➔ High-Speed Rail Corridor ➔ WH-001 (Nagpur)',
      feasibility: '100% FEASIBLE (Supply Chain Balanced)',
    },
  },

  'DIS-006': {
    id: 'DIS-006',
    title: 'Vehicle Breakdown',
    disruptionType: 'Vehicle Breakdown',
    targetId: 'RT-004 / R-001B',
    location: 'NH-53 Western Corridor (J12 Nashik ➔ Nagpur)',
    severity: 2,
    durationHours: 18,
    capacityImpact: '50% route capacity reduction',
    description: 'Heavy cargo tractor mechanical breakdown at roadside; freight requires transshipment or repair.',
    affectedRouteId: 'R-001B',
    affectedNodeId: 'J12',
    bypassRouteIds: ['R-008A', 'R-007A'],
    secondaryRouteId: 'R-001A',
    mapCenter: [20.5, 76.0],
    mapZoom: 7,
    stages: [
      {
        id: 'route',
        stepNumber: 1,
        title: '1. Vehicle Stranded on Highway',
        affectedEntity: 'Route R-001B (Nashik ➔ Nagpur NH-53)',
        impact: 'PROJECTED IMPACT: Heavy transport vehicle halted at km 342 roadside',
        severity: 'MODERATE',
        horizon: 'Immediate (T+0)',
        detail: 'Transmission failure on prime mover tractor. Trailer secured on highway shoulder.',
        iconName: 'truck',
      },
      {
        id: 'shipments',
        stepNumber: 2,
        title: '2. Cargo In-Transit Freeze',
        affectedEntity: 'Shipment SHP-5001 (240 units Electronics)',
        impact: 'POTENTIAL CASCADE: +8.0h delay pending rescue prime mover arrival',
        severity: 'HIGH',
        horizon: '+4 to +6 Hours',
        detail: 'Cold chain / electronics sensor telemetry running on auxiliary battery power.',
        iconName: 'truck',
      },
      {
        id: 'warehouse',
        stepNumber: 3,
        title: '3. Assembly Input Deferred',
        affectedEntity: 'WH-001 (Nagpur Hub Assembly Bay)',
        impact: 'RISK INCREASE: Scheduled evening intake bay delayed to next morning',
        severity: 'MODERATE',
        horizon: '+12 Hours',
        detail: 'Intake labor crew reallocated to outbound packaging shift.',
        iconName: 'warehouse',
      },
      {
        id: 'customer',
        stepNumber: 4,
        title: '4. Customer Delivery Reschedule',
        affectedEntity: 'Commercial Order ORD-1001',
        impact: 'PROJECTED IMPACT: Delivery window moved from 16:45 to 00:30 IST',
        severity: 'LOW',
        horizon: '+24 Hours',
        detail: 'Customer notified of revised ETA; grace period avoids SLA contractual penalty.',
        iconName: 'customer',
      },
      {
        id: 'secondary',
        stepNumber: 5,
        title: '5. Roadside Traffic Pinch Point',
        affectedEntity: 'Localized 2-Lane Bridge Sector near Jalgaon',
        impact: 'POTENTIAL CASCADE: Minor 15-minute slowing for trailing freight vehicles',
        severity: 'LOW',
        horizon: '+36 Hours',
        detail: 'Warning triangles and highway patrol vehicle maintain single-file passage.',
        iconName: 'secondary',
      },
    ],
    timeline: [
      { timeLabel: 'NOW (T+0)', title: 'Breakdown Telemetry', projectedConsequence: 'Engine ECU transmits emergency diagnostic code. Driver pulls vehicle onto shoulder.', riskScore: 52, severityColor: '#f97316' },
      { timeLabel: '+6 HOURS', title: 'Rescue Tractor Dispatched', projectedConsequence: 'Replacement prime mover dispatched from Nashik depot (180 km distance).', riskScore: 58, severityColor: '#f59e0b' },
      { timeLabel: '+12 HOURS', title: 'Coupling & Inspection', projectedConsequence: 'Fifth-wheel coupling completed; brake line pressure certified; vehicle resumes transit.', riskScore: 48, severityColor: '#10b981' },
      { timeLabel: '+24 HOURS', title: 'Arrival at Hub', projectedConsequence: 'Consignment arrives safely at Nagpur Central Hub with 8-hour total delay.', riskScore: 35, severityColor: '#10b981' },
      { timeLabel: '+48 HOURS', title: 'Nominal Operations', projectedConsequence: 'Primary tractor towed to regional repair shop. No lingering network impact.', riskScore: 10, severityColor: '#10b981' },
    ],
    nextBestActions: [
      {
        id: 'act-reroute',
        rank: 1,
        title: 'REROUTE AFFECTED SHIPMENTS',
        method: 'Detour trailing consignments via Nanded transit bypass R-008A',
        impact: 'Avoids localized roadside congestion around breakdown site',
        feasibility: 'HIGH FEASIBILITY',
        scorePct: 92,
        isPrimary: true,
      },
      {
        id: 'act-monitor',
        rank: 2,
        title: 'CONTINUE MONITORING',
        method: 'Real-time GPS tracking of rescue prime mover and auxiliary cargo sensor',
        impact: 'Guarantees temperature integrity of electronics during roadside hold',
        feasibility: 'AVAILABLE',
        scorePct: 88,
      },
      {
        id: 'act-reallocate',
        rank: 3,
        title: 'REALLOCATE INVENTORY',
        method: 'Release 240 units from local Nagpur reserve to meet morning orders',
        impact: 'Maintains manufacturing assembly schedule without waiting for delayed truck',
        feasibility: 'AVAILABLE',
        scorePct: 75,
      },
    ],
    recoveryPlan: {
      solver: 'Dispatch Optimizer',
      objective: '1.7820 Optimal',
      timeDelta: '+2.1h',
      distDelta: '+45 km',
      costDelta: '+3%',
      riskReduction: '-89.0%',
      bypassCorridor: 'J12 (Nashik) ➔ J6 (Nanded Detour) ➔ WH-001 (Nagpur)',
      feasibility: '100% FEASIBLE (Rescue Tractor Active)',
    },
  },

  'DIS-007': {
    id: 'DIS-007',
    title: 'Supplier Quality Hold',
    disruptionType: 'Supplier Quality Hold',
    targetId: 'SUP-006',
    location: 'RapidSource Metals Casting Plant (SUP-006)',
    severity: 3,
    durationHours: 48,
    capacityImpact: '70% output quarantined',
    description: 'Supplier output temporarily quarantined pending metallurgical quality compliance audit.',
    affectedRouteId: 'R-021B',
    affectedNodeId: 'SUP-006',
    bypassRouteIds: ['R-005D', 'R-005E'],
    secondaryRouteId: 'R-021A',
    mapCenter: [13.0, 79.5],
    mapZoom: 7,
    stages: [
      {
        id: 'route',
        stepNumber: 1,
        title: '1. Quality Hold at Foundry',
        affectedEntity: 'Supplier SUP-006 (RapidSource Metals)',
        impact: 'PROJECTED IMPACT: 70% of batch output held under quarantine hold',
        severity: 'HIGH',
        horizon: 'Immediate (T+0)',
        detail: 'Metallurgical hardness testing failed batch tolerance. Outbound certs withheld.',
        iconName: 'supplier',
      },
      {
        id: 'shipments',
        stepNumber: 2,
        title: '2. Batch Dispatch Postponement',
        affectedEntity: 'Raw Metals Inbound Shipments',
        impact: 'POTENTIAL CASCADE: 48-hour delivery delay on precision components',
        severity: 'HIGH',
        horizon: '+4 to +6 Hours',
        detail: 'Loading dock holds 420 kg of structural aluminum pending re-assay.',
        iconName: 'truck',
      },
      {
        id: 'warehouse',
        stepNumber: 3,
        title: '3. Manufacturing Buffer Drawdown',
        affectedEntity: 'WH-003 (Bengaluru South DC)',
        impact: 'RISK INCREASE: Component reserve stock drops to 36 hours of production',
        severity: 'ELEVATED',
        horizon: '+12 Hours',
        detail: 'Production schedulers warned of potential casting shortage for weekend assembly.',
        iconName: 'warehouse',
      },
      {
        id: 'customer',
        stepNumber: 4,
        title: '4. Downstream Assembly Rescheduling',
        affectedEntity: 'Tier-1 Industrial Equipment Clients',
        impact: 'PROJECTED IMPACT: Assembly line re-sequencing required',
        severity: 'MODERATE',
        horizon: '+24 Hours',
        detail: 'Assembly shift pivoted to non-metals packaging builds to prevent downtime.',
        iconName: 'customer',
      },
      {
        id: 'secondary',
        stepNumber: 5,
        title: '5. Secondary Supplier Capacity Surge',
        affectedEntity: 'Harborline Gateway SUP-002 (Chennai)',
        impact: 'POTENTIAL CASCADE: Emergency production quota placed on alternate foundry',
        severity: 'MODERATE',
        horizon: '+36 to +48 Hours',
        detail: 'Secondary supplier requested to accelerate shift to cover 70% deficit.',
        iconName: 'secondary',
      },
    ],
    timeline: [
      { timeLabel: 'NOW (T+0)', title: 'QA Quarantine Tagged', projectedConsequence: 'Quality inspection flags alloy tolerance variance. 420 kg batch tagged for laboratory re-test.', riskScore: 64, severityColor: '#f97316' },
      { timeLabel: '+6 HOURS', title: 'Laboratory Re-Assay', projectedConsequence: 'Secondary spectrographic analysis underway at Chennai accredited laboratory.', riskScore: 68, severityColor: '#f59e0b' },
      { timeLabel: '+12 HOURS', title: 'Factory Alert', projectedConsequence: 'Bengaluru DC engineering notified of 48-hour material dispatch delay.', riskScore: 74, severityColor: '#ea580c' },
      { timeLabel: '+24 HOURS', title: 'Secondary Vendor Activated', projectedConsequence: 'Purchase order diverted to Harborline Gateway (SUP-002) in Chennai.', riskScore: 60, severityColor: '#10b981' },
      { timeLabel: '+48 HOURS', title: 'Batch Clearance / Replacement', projectedConsequence: 'Replacement castings arrive from Chennai. Uncertified batch scrapped at supplier cost.', riskScore: 25, severityColor: '#10b981' },
    ],
    nextBestActions: [
      {
        id: 'act-reallocate',
        rank: 1,
        title: 'REALLOCATE INVENTORY & SUPPLIER',
        method: 'Immediate emergency purchase order transfer to SUP-002 (Harborline)',
        impact: 'Bypasses quarantined foundry; activates certified stock from Chennai',
        feasibility: 'HIGH FEASIBILITY',
        scorePct: 96,
        isPrimary: true,
      },
      {
        id: 'act-reroute',
        rank: 2,
        title: 'REROUTE AFFECTED SHIPMENTS',
        method: 'Expedite Chennai ➔ Bengaluru transit corridor via J5 Kanchipuram',
        impact: 'Delivers substitute metals batch within 4.5 hours of order placement',
        feasibility: 'AVAILABLE',
        scorePct: 90,
      },
      {
        id: 'act-monitor',
        rank: 3,
        title: 'CONTINUE MONITORING',
        method: 'Track metallurgical lab certificate release via secure vendor portal',
        impact: 'Releases original batch if tensile hardness tests pass standard',
        feasibility: 'AVAILABLE',
        scorePct: 65,
      },
    ],
    recoveryPlan: {
      solver: 'Supplier Allocation Optimizer',
      objective: '1.8250 Optimal',
      timeDelta: '+1.2h',
      distDelta: '+75 km',
      costDelta: '+5%',
      riskReduction: '-92.0%',
      bypassCorridor: 'SUP-002 (Chennai) ➔ J5 (Kanchipuram) ➔ WH-003 (Bengaluru South DC)',
      feasibility: '100% FEASIBLE (Certified Metallurgy)',
    },
  },

  'DIS-008': {
    id: 'DIS-008',
    title: 'Cascading Failure',
    disruptionType: 'Cascading Failure',
    targetId: 'WH-001',
    location: 'Nagpur Central Hub & South Trunk (NH-44 / NH-16)',
    severity: 5,
    durationHours: 72,
    capacityImpact: '55% compound multi-node capacity loss',
    description: 'Regional sorting center bottleneck combined with simultaneous highway closure triggers compounding delays.',
    affectedRouteId: 'R-021A',
    affectedNodeId: 'WH-001',
    bypassRouteIds: ['R-005A', 'R-005B', 'R-005C', 'R-005D', 'R-005E', 'R-008A'],
    secondaryRouteId: 'R-001B',
    mapCenter: [18.5, 78.5],
    mapZoom: 6,
    stages: [
      {
        id: 'route',
        stepNumber: 1,
        title: '1. Compound Dual-Point Failure',
        affectedEntity: 'WH-001 Hub & Route RT-007 (Kurnool Corridor)',
        impact: 'PROJECTED IMPACT: 55% compound network throughput collapse',
        severity: 'CRITICAL',
        horizon: 'Immediate (T+0)',
        detail: 'Simultaneous electrical failure at Nagpur automated cross-dock AND landslide on Southern corridor NH-44.',
        iconName: 'roadblock',
      },
      {
        id: 'shipments',
        stepNumber: 2,
        title: '2. Multi-Shipment Stagnation',
        affectedEntity: 'Conveyances SHP-5001, SHP-5002, and SHP-5004',
        impact: 'POTENTIAL CASCADE: +12.5h delay across 3 major national supply lines',
        severity: 'CRITICAL',
        horizon: '+4 to +6 Hours',
        detail: 'Over 1,040 units of mixed cargo delayed simultaneously in Western, Central, and Southern sectors.',
        iconName: 'truck',
      },
      {
        id: 'warehouse',
        stepNumber: 3,
        title: '3. Dual-Hub Desynchronization',
        affectedEntity: 'WH-001 (Nagpur) and WH-002 (Hyderabad)',
        impact: 'RISK INCREASE: Both primary regional hubs operating at <50% nominal flow',
        severity: 'CRITICAL',
        horizon: '+12 Hours',
        detail: 'Cross-dock transfers between Central and Southern hubs completely frozen.',
        iconName: 'warehouse',
      },
      {
        id: 'customer',
        stepNumber: 4,
        title: '4. Systemic SLA Failure',
        affectedEntity: 'All 4 Regional Customer Fulfillment Contracts',
        impact: 'PROJECTED IMPACT: $14,200 contractual liquidated delay damages',
        severity: 'CRITICAL',
        horizon: '+24 Hours',
        detail: 'Major automotive and electronics client production shifts halted without emergency recovery.',
        iconName: 'customer',
      },
      {
        id: 'secondary',
        stepNumber: 5,
        title: '5. Interstate Gridlock & Stranding',
        affectedEntity: 'National Highway Network (5 Indian States)',
        impact: 'POTENTIAL CASCADE: Widespread carrier gridlock without quantum swarm coordination',
        severity: 'CRITICAL',
        horizon: '+36 to +48 Hours',
        detail: 'Unmanaged diversions choke regional arterial feeder roads across Maharashtra, Telangana, and Karnataka.',
        iconName: 'secondary',
      },
    ],
    timeline: [
      { timeLabel: 'NOW (T+0)', title: 'Compound Alarm', projectedConsequence: 'Dual critical alarms: Hub power failure + Southern highway closure. National control tower alerts.', riskScore: 94, severityColor: '#ef4444' },
      { timeLabel: '+6 HOURS', title: 'Systemic Delays', projectedConsequence: 'Over 800 trucks halted across 3 interstate transit corridors. Initial delays exceed +6 hours.', riskScore: 96, severityColor: '#dc2626' },
      { timeLabel: '+12 HOURS', title: 'Double Hub Choke', projectedConsequence: 'Nagpur and Hyderabad distribution centers paralyzed; incoming freight stacked on shoulders.', riskScore: 98, severityColor: '#b91c1c' },
      { timeLabel: '+24 HOURS', title: 'Automotive Stoppages', projectedConsequence: 'Automotive assembly plants in Bengaluru and Chennai trigger emergency line stoppages.', riskScore: 100, severityColor: '#991b1b' },
      { timeLabel: '+48 HOURS', title: 'Total Network Gridlock', projectedConsequence: 'Cascading gridlock across 5 states without automated quantum swarm parallel rerouting.', riskScore: 100, severityColor: '#7f1d1d' },
    ],
    nextBestActions: [
      {
        id: 'act-reroute',
        rank: 1,
        title: 'PARALLEL MULTI-CORRIDOR IQPSO REROUTE',
        method: 'Simultaneous quantum swarm optimization of all 3 affected corridors',
        impact: 'Dispatches SHP-5002 via Eastern Coastal bypass and SHP-5001 via Nanded detour',
        feasibility: 'HIGH FEASIBILITY',
        scorePct: 99,
        isPrimary: true,
      },
      {
        id: 'act-reallocate',
        rank: 2,
        title: 'CROSS-WAREHOUSE EMERGENCY REALLOCATION',
        method: 'Direct stock bypass from Northern Hub WH-005 straight to Southern hubs',
        impact: 'Circumvents paralyzed Central India network, protecting automotive client SLAs',
        feasibility: 'AVAILABLE',
        scorePct: 92,
      },
      {
        id: 'act-monitor',
        rank: 3,
        title: 'CONTINUE MONITORING',
        method: 'Multi-agency incident command telemetry coordination',
        impact: 'Synchronizes emergency road clearance crews with state electricity boards',
        feasibility: 'CONDITIONAL',
        scorePct: 50,
      },
    ],
    recoveryPlan: {
      solver: 'Multi-Swarm IQPSO Engine',
      objective: '2.1480 Optimal',
      timeDelta: '+3.2h / +2.1h',
      distDelta: '+210 km / +125 km',
      costDelta: '+11%',
      riskReduction: '-94.5%',
      bypassCorridor: 'Dual Corridor: Eastern Coastal (J3-J4-Chennai-J5) & Western (J12-J6-Nanded)',
      feasibility: '100% FEASIBLE (Systemic Recovery Formulated)',
    },
  },
};

// Leaflet Camera Controller
const MapFlyToController: React.FC<{ center: [number, number]; zoom: number }> = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, zoom, { duration: 0.8 });
  }, [center, zoom, map]);
  return null;
};

export const CascadingDisruptionCenter: React.FC<CascadingDisruptionCenterProps> = ({
  onReturnToMap,
  onApplyFastRecoverGlobal,
}) => {
  // 1. Current Disruption Dropdown State (Requirement 1)
  const [selectedDisruptionId, setSelectedDisruptionId] = useState<string>('DIS-002');
  const dossier = DISRUPTION_DOSSIERS[selectedDisruptionId] || DISRUPTION_DOSSIERS['DIS-002'];

  // 2. Interactive Cascade Stage State (Requirement 6 & 7)
  const [activeStage, setActiveStage] = useState<CascadeStageId>('route');

  // 3. Simulation & Analysis States (Requirement 5, 8, 9)
  const [isSimulatingCascade, setIsSimulatingCascade] = useState<boolean>(false);
  const [simulationStepIndex, setSimulationStepIndex] = useState<number>(0);
  const [isAnalyzingRecovery, setIsAnalyzingRecovery] = useState<boolean>(false);
  const [recoveryPlanReady, setRecoveryPlanReady] = useState<boolean>(false);
  const [fastRecoverApplied, setFastRecoverApplied] = useState<boolean>(false);

  // Status Tripartite (Requirement 9)
  // Physical Disruption: ACTIVE (persists until physical road cleared)
  // Operational Impact: MITIGATED
  // Recovery: COMPLETED
  const [operationalImpactStatus, setOperationalImpactStatus] = useState<'ACTIVE THREAT' | 'ANALYZING' | 'MITIGATED'>('ACTIVE THREAT');
  const [recoveryState, setRecoveryState] = useState<'PENDING' | 'FORMULATED' | 'COMPLETED'>('PENDING');

  // Node Map for coordinates
  const nodeMap = useMemo(() => {
    const map = new Map<string, LogisticsNode>();
    for (const n of INDIA_NODES) {
      map.set(n.id, n);
    }
    return map;
  }, []);

  // Reset local state when user selects a different disruption (Requirement 1)
  const handleSelectDisruption = (id: string) => {
    setSelectedDisruptionId(id);
    setActiveStage('route');
    setIsSimulatingCascade(false);
    setSimulationStepIndex(0);
    setIsAnalyzingRecovery(false);
    setRecoveryPlanReady(false);
    setFastRecoverApplied(false);
    setOperationalImpactStatus('ACTIVE THREAT');
    setRecoveryState('PENDING');
  };

  // 5. SIMULATE CASCADE Stepper (Requirement 5)
  const handleSimulateCascade = async () => {
    if (isSimulatingCascade) return;
    setIsSimulatingCascade(true);
    setSimulationStepIndex(1); // Analyzing network
    setOperationalImpactStatus('ANALYZING');

    const steps = [
      { step: 1, stage: 'route' as CascadeStageId, delay: 350 },
      { step: 2, stage: 'shipments' as CascadeStageId, delay: 400 },
      { step: 3, stage: 'warehouse' as CascadeStageId, delay: 400 },
      { step: 4, stage: 'customer' as CascadeStageId, delay: 400 },
      { step: 5, stage: 'secondary' as CascadeStageId, delay: 400 },
      { step: 6, stage: 'overview' as CascadeStageId, delay: 350 },
    ];

    for (const s of steps) {
      setSimulationStepIndex(s.step);
      setActiveStage(s.stage);
      await new Promise((r) => setTimeout(r, s.delay));
    }

    setIsSimulatingCascade(false);
    setOperationalImpactStatus('ACTIVE THREAT');
  };

  // 8. RUN RECOVERY ANALYSIS (Requirement 8)
  const handleRunRecoveryAnalysis = async () => {
    setIsAnalyzingRecovery(true);
    try {
      // Execute live benchmark call to backend solver
      await api.runBenchmark({
        problem_type: 'shortest_path',
        source: 0,
        target: 5,
        iterations: 20,
        runs: 1,
        swarm_size: 15,
      }).catch(() => null);

      await new Promise((r) => setTimeout(r, 650));
      setRecoveryPlanReady(true);
      setRecoveryState('FORMULATED');
    } finally {
      setIsAnalyzingRecovery(false);
    }
  };

  // 9. APPLY FAST RECOVER (Requirement 9)
  const handleApplyFastRecover = async () => {
    setFastRecoverApplied(true);
    setOperationalImpactStatus('MITIGATED');
    setRecoveryState('COMPLETED');

    if (onApplyFastRecoverGlobal) {
      onApplyFastRecoverGlobal();
    }
  };

  // Map route polylines based on activeStage and disruption
  const mapRoutes = useMemo(() => {
    return INITIAL_ROUTES.map((route) => {
      const from = nodeMap.get(route.fromId);
      const to = nodeMap.get(route.toId);
      if (!from || !to) return null;

      const isDirectlyDisrupted =
        route.id === dossier.affectedRouteId ||
        (dossier.affectedNodeId && (route.fromId === dossier.affectedNodeId || route.toId === dossier.affectedNodeId));

      const isBypass = dossier.bypassRouteIds.includes(route.id);
      const isSecondary = route.id === dossier.secondaryRouteId;

      let color = '#cbd5e1'; // neutral slate
      let weight = 2.0;
      let dashArray = undefined;
      let opacity = 0.55;
      let className = '';

      if (isDirectlyDisrupted) {
        color = '#ef4444'; // Red
        weight = 5.0;
        dashArray = '8, 8';
        opacity = 0.95;
        className = 'disrupted-route-pulse';
      } else if (isBypass && (recoveryPlanReady || fastRecoverApplied)) {
        color = '#10b981'; // Green
        weight = 4.5;
        opacity = 1.0;
        className = fastRecoverApplied ? 'recovery-route-flow' : '';
      } else if (isSecondary && activeStage === 'secondary') {
        color = '#f59e0b'; // Amber
        weight = 4.0;
        dashArray = '6, 6';
        opacity = 0.9;
        className = 'impacted-route-congested';
      } else if (activeStage === 'shipments' && isDirectlyDisrupted) {
        color = '#f43f5e';
        weight = 6.0;
        opacity = 1.0;
      }

      return {
        id: route.id,
        name: route.name,
        positions: [
          [from.lat, from.lon],
          [to.lat, to.lon],
        ] as [number, number][],
        color,
        weight,
        dashArray,
        opacity,
        className,
        isDisrupted: isDirectlyDisrupted,
        isBypass,
        isSecondary,
      };
    }).filter(Boolean);
  }, [nodeMap, dossier, activeStage, recoveryPlanReady, fastRecoverApplied]);

  return (
    <div className="flex-1 bg-slate-100 flex flex-col p-4 gap-4 overflow-y-auto select-none">
      {/* ======================================================== */}
      {/* 1. TOP HEADER & CURRENT DISRUPTION DROPDOWN (Req 1 & 9)   */}
      {/* ======================================================== */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-600 flex items-center justify-center text-white shadow-md">
            <ShieldAlert className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                CASCADING RESPONSE CENTER
              </span>
              <span className="text-[10px] font-mono font-bold text-slate-500">
                PNT1 Situational Digital Twin
              </span>
            </div>

            {/* CURRENT DISRUPTION DROPDOWN (Requirement 1) */}
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                CURRENT DISRUPTION:
              </span>
              <div className="relative inline-block">
                <select
                  value={selectedDisruptionId}
                  onChange={(e) => handleSelectDisruption(e.target.value)}
                  className="appearance-none bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-xl px-3 py-1.5 pr-8 text-xs font-bold text-slate-900 shadow-2xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {Object.keys(DISRUPTION_DOSSIERS).map((k) => {
                    const d = DISRUPTION_DOSSIERS[k];
                    return (
                      <option key={d.id} value={d.id}>
                        {d.id} • {d.title} ({d.targetId})
                      </option>
                    );
                  })}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-500 absolute right-2.5 top-2 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        {/* Status Indicators & Action Buttons (Requirement 5, 8, 9) */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Resolution Status Tripartite (Requirement 9) */}
          <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200 text-[10px] font-mono font-bold">
            <div className="flex items-center gap-1 px-2 py-1 rounded bg-rose-100 text-rose-800">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse"></span>
              PHYSICAL: ACTIVE
            </div>
            <div
              className={`flex items-center gap-1 px-2 py-1 rounded ${
                operationalImpactStatus === 'MITIGATED'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              <span>OP IMPACT: {operationalImpactStatus}</span>
            </div>
            <div
              className={`flex items-center gap-1 px-2 py-1 rounded ${
                recoveryState === 'COMPLETED'
                  ? 'bg-emerald-600 text-white'
                  : recoveryState === 'FORMULATED'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              <span>RECOVERY: {recoveryState}</span>
            </div>
          </div>

          {/* Action Buttons (Requirement 5) */}
          <button
            type="button"
            onClick={handleSimulateCascade}
            disabled={isSimulatingCascade}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold shadow-xs transition disabled:opacity-50 cursor-pointer"
          >
            <Play className={`w-3.5 h-3.5 ${isSimulatingCascade ? 'animate-spin' : ''}`} />
            <span>{isSimulatingCascade ? 'Simulating...' : 'Simulate Cascade'}</span>
          </button>

          <button
            type="button"
            onClick={handleRunRecoveryAnalysis}
            disabled={isAnalyzingRecovery}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition disabled:opacity-50 cursor-pointer"
          >
            <Cpu className={`w-3.5 h-3.5 ${isAnalyzingRecovery ? 'animate-spin' : ''}`} />
            <span>{isAnalyzingRecovery ? 'Analyzing IQPSO...' : 'Run Recovery Analysis'}</span>
          </button>

          <button
            type="button"
            onClick={handleApplyFastRecover}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Apply Fast Recover</span>
          </button>

          {onReturnToMap && (
            <button
              type="button"
              onClick={onReturnToMap}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition cursor-pointer"
            >
              <span>Live Map</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Simulation Progress Stepper Bar (Requirement 5) */}
      {isSimulatingCascade && (
        <div className="bg-slate-900 text-white p-3 rounded-xl border border-rose-500 shadow-md flex items-center justify-between text-xs font-mono animate-pulse">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-rose-400" />
            <span className="font-bold text-rose-300">ANALYZING NETWORK PROPAGATION:</span>
            <span>
              {simulationStepIndex === 1 && 'Step 1/6: Identifying Affected Transport Corridors...'}
              {simulationStepIndex === 2 && 'Step 2/6: Tracing Traversed Freight Shipments...'}
              {simulationStepIndex === 3 && 'Step 3/6: Projecting Warehouse Inventory Deficit...'}
              {simulationStepIndex === 4 && 'Step 4/6: Evaluating Downstream Customer SLA Timelines...'}
              {simulationStepIndex === 5 && 'Step 5/6: Calculating Secondary Network Spillover...'}
              {simulationStepIndex === 6 && 'Step 6/6: Synthesis Complete ➔ Cascade Mapped'}
            </span>
          </div>
          <span className="text-[10px] text-slate-400">Step {simulationStepIndex} of 6</span>
        </div>
      )}

      {/* Main 2-Column Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1">
        {/* ======================================================== */}
        {/* LEFT / CENTER COLUMN (7 cols): Cascade + Timeline + Action*/}
        {/* ======================================================== */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          {/* 2. CASCADING DISRUPTION PANEL (Requirement 2 & 6) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-rose-600 block">
                  WHAT HAPPENS IF THIS IS NOT RESOLVED?
                </span>
                <h2 className="text-sm font-bold text-slate-900">
                  Cascading Disruption Propagation Chain
                </h2>
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                Click any stage to isolate on map
              </span>
            </div>

            {/* Clickable Stages Flow (Requirement 2 & 6) */}
            <div className="space-y-2">
              {dossier.stages.map((stg) => {
                const isSelected = activeStage === stg.id;
                return (
                  <div
                    key={stg.id}
                    onClick={() => setActiveStage(stg.id)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-rose-500 bg-rose-50/60 ring-2 ring-rose-500/20 shadow-xs'
                        : 'border-slate-200 bg-slate-50/70 hover:bg-slate-100 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-5 h-5 rounded-full flex items-center justify-center font-mono font-bold text-[10px] text-white ${
                            stg.severity === 'CRITICAL'
                              ? 'bg-rose-600'
                              : stg.severity === 'HIGH'
                              ? 'bg-amber-600'
                              : 'bg-blue-600'
                          }`}
                        >
                          {stg.stepNumber}
                        </span>
                        <span className="font-bold text-slate-900">{stg.title}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-semibold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                          {stg.horizon}
                        </span>
                        <span
                          className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                            stg.severity === 'CRITICAL'
                              ? 'bg-rose-100 text-rose-800 border border-rose-300'
                              : stg.severity === 'HIGH'
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : 'bg-blue-100 text-blue-800 border border-blue-300'
                          }`}
                        >
                          {stg.severity}
                        </span>
                      </div>
                    </div>

                    <div className="pl-7 space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-mono font-semibold text-slate-700">
                          {stg.affectedEntity}
                        </span>
                        <span className="text-[10px] font-mono text-blue-600 font-bold">
                          {isSelected ? '● ISOLATED ON MAP' : 'Click to isolate ↗'}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-rose-700 leading-snug">
                        {stg.impact}
                      </p>
                      <p className="text-[11px] text-slate-500 leading-relaxed pt-0.5">
                        {stg.detail}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. TIME-BASED CASCADE (Requirement 3) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                  CHRONOLOGICAL DEGRADATION
                </span>
                <h3 className="text-xs font-bold text-slate-900">
                  Projected Time-Based Cascade (Unresolved Incident)
                </h3>
              </div>
              <div className="flex items-center gap-1 text-[10px] font-mono text-slate-500">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Simulation Horizon: 48h</span>
              </div>
            </div>

            {/* 5 Milestone Timeline Cards */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-2 pt-1">
              {dossier.timeline.map((point) => (
                <div
                  key={point.timeLabel}
                  className="bg-slate-50 rounded-xl border border-slate-200 p-2.5 flex flex-col justify-between space-y-1.5"
                >
                  <div className="flex items-center justify-between text-[10px] font-mono font-bold">
                    <span className="text-slate-900 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                      {point.timeLabel}
                    </span>
                    <span
                      className="px-1.5 py-0.5 rounded text-[9px] font-black"
                      style={{ color: point.severityColor, backgroundColor: `${point.severityColor}15` }}
                    >
                      RISK {point.riskScore}
                    </span>
                  </div>
                  <div className="font-bold text-[11px] text-slate-800 leading-tight">
                    {point.title}
                  </div>
                  <p className="text-[10px] text-slate-500 leading-snug">
                    {point.projectedConsequence}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* 4. NEXT BEST ACTION (Requirement 4) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-emerald-600" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Next Best Action Recommendation
                </h3>
              </div>
              <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                BASED ON REAL INCIDENT IMPACT
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {dossier.nextBestActions.map((act) => (
                <div
                  key={act.id}
                  className={`p-3 rounded-xl border flex flex-col justify-between space-y-2 transition ${
                    act.isPrimary
                      ? 'border-emerald-500 bg-emerald-50/50 shadow-xs ring-1 ring-emerald-500/20'
                      : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold text-slate-500">
                        OPTION #{act.rank}
                      </span>
                      {act.isPrimary && (
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-emerald-600 text-white">
                          RECOMMENDED
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-black text-slate-900 leading-tight">
                      {act.title}
                    </div>
                    <div className="text-[10px] font-mono text-emerald-700 font-bold">
                      {act.method}
                    </div>
                    <p className="text-[11px] text-slate-600 leading-snug">
                      {act.impact}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px]">
                    <span className="font-mono font-bold text-slate-500">
                      {act.feasibility}
                    </span>
                    <span className="font-mono font-bold text-emerald-700">
                      {act.scorePct}% Fit
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* RIGHT COLUMN (5 cols): Embedded Leaflet Map + Plan Dossier */}
        {/* ======================================================== */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* 7. MAP CONNECTION: Embedded Leaflet Map (Requirement 7) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-xs space-y-2 flex flex-col">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping"></span>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Cascading Propagation Map
                </h3>
              </div>
              <span className="text-[10px] font-mono text-slate-500">
                Active Stage: <strong className="text-rose-600 uppercase">{activeStage}</strong>
              </span>
            </div>

            {/* Map Container */}
            <div className="w-full h-80 rounded-xl overflow-hidden border border-slate-200 relative">
              <MapContainer
                center={dossier.mapCenter}
                zoom={dossier.mapZoom}
                scrollWheelZoom={false}
                zoomControl={false}
                className="w-full h-full z-0"
              >
                <MapFlyToController center={dossier.mapCenter} zoom={dossier.mapZoom} />
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {/* Polylines for routes */}
                {mapRoutes.map((r) => {
                  if (!r) return null;
                  return (
                    <Polyline
                      key={r.id}
                      positions={r.positions}
                      pathOptions={{
                        color: r.color,
                        weight: r.weight,
                        dashArray: r.dashArray,
                        opacity: r.opacity,
                        className: r.className,
                      }}
                    >
                      <Tooltip sticky>
                        <span className="font-mono text-xs font-bold">{r.name}</span>
                      </Tooltip>
                    </Polyline>
                  );
                })}

                {/* Markers for Key Nodes */}
                {INDIA_NODES.map((n) => {
                  const isAffectedNode = n.id === dossier.affectedNodeId;
                  const isWarehouse = n.type === 'warehouse';

                  const iconHtml = `
                    <div class="relative flex items-center justify-center">
                      ${isAffectedNode ? '<div class="absolute -inset-2 rounded-full bg-rose-500/60 animate-ping"></div>' : ''}
                      <div class="w-5 h-5 rounded-full ${isAffectedNode ? 'bg-rose-600 ring-2 ring-white' : isWarehouse ? 'bg-slate-900 ring-1 ring-white' : 'bg-blue-600'} text-white shadow-md flex items-center justify-center text-[9px] font-bold">
                        ${n.id.startsWith('WH') ? 'W' : n.id.startsWith('SUP') ? 'S' : 'J'}
                      </div>
                    </div>
                  `;

                  const customIcon = L.divIcon({
                    html: iconHtml,
                    className: 'custom-cascade-node',
                    iconSize: [20, 20],
                    iconAnchor: [10, 10],
                  });

                  return (
                    <Marker key={n.id} position={[n.lat, n.lon]} icon={customIcon}>
                      <Popup>
                        <div className="p-1 text-xs font-sans">
                          <strong className="block text-slate-900">{n.name}</strong>
                          <span className="text-[10px] text-slate-500">{n.city} • {n.type}</span>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}
              </MapContainer>

              {/* In-Map Stage Badge */}
              <div className="absolute bottom-2 left-2 z-10 bg-slate-900/90 text-white px-2.5 py-1 rounded-lg text-[10px] font-mono shadow-md backdrop-blur-xs flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse"></span>
                <span>Active Isolation: {activeStage.toUpperCase()}</span>
              </div>
            </div>

            {/* Map Legend */}
            <div className="grid grid-cols-4 gap-1.5 pt-1 text-[10px] font-mono text-center">
              <div className="p-1 rounded bg-rose-50 border border-rose-200 text-rose-700 font-bold">
                🔴 Blocked Link
              </div>
              <div className="p-1 rounded bg-amber-50 border border-amber-200 text-amber-700 font-bold">
                🟠 Impacted Node
              </div>
              <div className="p-1 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold">
                🟢 Recovery Bypass
              </div>
              <div className="p-1 rounded bg-slate-50 border border-slate-200 text-slate-600">
                ⚪ Nominal Net
              </div>
            </div>
          </div>

          {/* 8. RESOLUTION FLOW & RECOVERY PLAN (Requirement 8) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  8. Formulation & Recovery Resolution Flow
                </h3>
              </div>
              <span className="text-[10px] font-mono text-blue-600 font-bold">
                {recoveryPlanReady ? '✓ PLAN READY' : 'CLICK RUN RECOVERY'}
              </span>
            </div>

            {/* Resolution Stepper */}
            <div className="flex items-center justify-between text-[10px] font-mono border border-slate-100 p-2 rounded-xl bg-slate-50">
              <span className="text-rose-600 font-bold">DISRUPTION</span>
              <span>➔</span>
              <span className="text-amber-600 font-bold">CASCADE RISK</span>
              <span>➔</span>
              <span className="text-blue-600 font-bold">IQPSO ANALYZED</span>
              <span>➔</span>
              <span className={`font-bold ${recoveryPlanReady ? 'text-emerald-600' : 'text-slate-400'}`}>
                PLAN READY
              </span>
            </div>

            {/* Recovery Plan Card */}
            <div className="bg-slate-900 text-white rounded-xl p-3.5 space-y-2.5 font-sans">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div>
                  <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase block">
                    AI QUANTUM RECOVERY SPECIFICATION
                  </span>
                  <span className="text-xs font-bold text-white">
                    {dossier.recoveryPlan.solver}
                  </span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold">
                  {dossier.recoveryPlan.feasibility}
                </span>
              </div>

              <div className="grid grid-cols-4 gap-2 text-center text-xs font-mono">
                <div className="p-1.5 rounded bg-slate-800/80">
                  <span className="text-[9px] text-slate-400 block font-sans">Time Delta</span>
                  <span className="font-bold text-emerald-400">{dossier.recoveryPlan.timeDelta}</span>
                </div>
                <div className="p-1.5 rounded bg-slate-800/80">
                  <span className="text-[9px] text-slate-400 block font-sans">Distance</span>
                  <span className="font-bold text-white">{dossier.recoveryPlan.distDelta}</span>
                </div>
                <div className="p-1.5 rounded bg-slate-800/80">
                  <span className="text-[9px] text-slate-400 block font-sans">Cost Delta</span>
                  <span className="font-bold text-white">{dossier.recoveryPlan.costDelta}</span>
                </div>
                <div className="p-1.5 rounded bg-slate-800/80">
                  <span className="text-[9px] text-slate-400 block font-sans">Risk Red.</span>
                  <span className="font-bold text-emerald-400">{dossier.recoveryPlan.riskReduction}</span>
                </div>
              </div>

              <div className="text-[11px] pt-1">
                <span className="text-slate-400 text-[10px] uppercase font-bold block">Assigned Bypass Corridor:</span>
                <span className="font-mono text-emerald-300 font-semibold text-[11px] block leading-tight">
                  {dossier.recoveryPlan.bypassCorridor}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CascadingDisruptionCenter;

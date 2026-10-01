import type {
  Supplier,
  WarehouseInventoryRecord,
  PhysicalFacility,
  NormalizedWarehouse,
  OrderShipment,
  TransportRoute,
  Disruption,
  EvaluatedDisruption,
  NetworkKpis,
  OperationalRecoveryState,
  RecoveryExecutionResult,
  RollbackResult,
  NetworkOperationalStatus,
} from '../types/logistics.ts';
import {
  rawSuppliers,
  rawWarehouseInventory,
  rawOrdersShipments,
  rawTransportRoutes,
  rawDisruptions,
} from '../data/logisticsData.ts';

// Physical facility configuration linking physical names and cities to SVG coordinates
const FACILITY_CONFIGS = [
  {
    facility_id: 'FAC-HYD-01',
    name: 'Hyd Central DC',
    city: 'Hyderabad',
    latitude: 17.3850,
    longitude: 78.4867,
    svgX: 500,
    svgY: 420,
    associated_warehouse_ids: ['WH-001', 'WH-004'],
  },
  {
    facility_id: 'FAC-HYD-02',
    name: 'Hyd East Hub',
    city: 'Hyderabad',
    latitude: 17.3850,
    longitude: 78.4867,
    svgX: 570,
    svgY: 440,
    associated_warehouse_ids: ['WH-003', 'WH-006'],
  },
  {
    facility_id: 'FAC-BLR-01',
    name: 'Bengaluru Hub',
    city: 'Bengaluru',
    latitude: 12.9716,
    longitude: 77.5946,
    svgX: 490,
    svgY: 550,
    associated_warehouse_ids: ['WH-001', 'WH-004'],
  },
  {
    facility_id: 'FAC-BLR-02',
    name: 'Bengaluru South DC',
    city: 'Bengaluru',
    latitude: 12.9716,
    longitude: 77.5946,
    svgX: 550,
    svgY: 580,
    associated_warehouse_ids: ['WH-003', 'WH-006'],
  },
  {
    facility_id: 'FAC-DEL-01',
    name: 'Delhi North Hub',
    city: 'Delhi',
    latitude: 28.6139,
    longitude: 77.2090,
    svgX: 480,
    svgY: 140,
    associated_warehouse_ids: ['WH-002', 'WH-005'],
  },
  {
    facility_id: 'FAC-NAG-01',
    name: 'Nagpur Central Hub',
    city: 'Nagpur',
    latitude: 21.1458,
    longitude: 79.0882,
    svgX: 680,
    svgY: 310,
    associated_warehouse_ids: ['WH-002', 'WH-005'],
  },
];

// SVG positions for Suppliers
export const SUPPLIER_SVG_COORDS: Record<string, { x: number; y: number }> = {
  'SUP-001': { x: 420, y: 410 }, // Hyderabad
  'SUP-002': { x: 410, y: 560 }, // Bengaluru
  'SUP-003': { x: 410, y: 110 }, // Delhi
  'SUP-004': { x: 450, y: 470 }, // Hyderabad
  'SUP-005': { x: 740, y: 270 }, // Nagpur
  'SUP-006': { x: 440, y: 620 }, // Bengaluru
  'SUP-007': { x: 550, y: 100 }, // Delhi
  'SUP-008': { x: 770, y: 330 }, // Nagpur
  'SUP-009': { x: 610, y: 590 }, // Bengaluru
  'SUP-010': { x: 620, y: 270 }, // Nagpur
};

// Logical warehouse anchor positions (for route rendering)
export const WAREHOUSE_LOGICAL_SVG_COORDS: Record<string, { x: number; y: number; facility_name: string }> = {
  'WH-001': { x: 500, y: 420, facility_name: 'Hyd Central DC' },
  'WH-002': { x: 480, y: 140, facility_name: 'Delhi North Hub' },
  'WH-003': { x: 550, y: 580, facility_name: 'Bengaluru South DC' },
  'WH-004': { x: 490, y: 550, facility_name: 'Bengaluru Hub' },
  'WH-005': { x: 680, y: 310, facility_name: 'Nagpur Central Hub' },
  'WH-006': { x: 570, y: 440, facility_name: 'Hyd East Hub' },
};

interface PreCommitSnapshot {
  snapshot_id: string;
  timestamp: number;
  shipments: OrderShipment[];
  inventory: WarehouseInventoryRecord[];
  recoveries: Record<string, OperationalRecoveryState>;
}

class LogisticsRepository {
  private operationalShipments: OrderShipment[];
  private operationalInventory: WarehouseInventoryRecord[];
  private operationalRecoveries: Map<string, OperationalRecoveryState>;
  private snapshots: Map<string, PreCommitSnapshot>;

  constructor() {
    this.operationalShipments = JSON.parse(JSON.stringify(rawOrdersShipments));
    this.operationalInventory = JSON.parse(JSON.stringify(rawWarehouseInventory));
    this.operationalRecoveries = new Map();
    this.snapshots = new Map();
  }

  /**
   * Reset state back to initial baseline dataset
   */
  resetAllToBaseline(): void {
    this.operationalShipments = JSON.parse(JSON.stringify(rawOrdersShipments));
    this.operationalInventory = JSON.parse(JSON.stringify(rawWarehouseInventory));
    this.operationalRecoveries.clear();
    this.snapshots.clear();
  }

  /**
   * Return all 10 suppliers
   */
  getSuppliers(): Supplier[] {
    return rawSuppliers;
  }

  /**
   * Return mutable operational warehouse inventory rows
   */
  getRawInventoryRecords(): WarehouseInventoryRecord[] {
    return this.operationalInventory;
  }

  /**
   * Return normalized logical warehouses (WH-001 to WH-006)
   */
  getNormalizedWarehouses(simDate: string = '2026-10-05'): NormalizedWarehouse[] {
    const records = this.getRawInventoryRecords();
    const evaluatedDisruptions = this.getEvaluatedDisruptions(simDate);
    const unrecoveredActiveDisruptions = evaluatedDisruptions.filter(
      (d) => d.state === 'active' && (!d.recovery || d.recovery.status !== 'RECOVERED')
    );

    const grouped: Record<string, WarehouseInventoryRecord[]> = {};
    for (const rec of records) {
      if (!grouped[rec.warehouse_id]) {
        grouped[rec.warehouse_id] = [];
      }
      grouped[rec.warehouse_id].push(rec);
    }

    return Object.entries(grouped).map(([warehouseId, recs]) => {
      const cities = Array.from(new Set(recs.map((r) => r.city)));
      const total_on_hand = recs.reduce((sum, r) => sum + r.on_hand_units, 0);
      const total_reserved = recs.reduce((sum, r) => sum + r.reserved_units, 0);
      const total_available = recs.reduce((sum, r) => sum + r.available_units, 0);
      const total_capacity = recs.reduce((sum, r) => sum + r.capacity_units, 0);
      const utilization_pct = total_capacity > 0 ? Math.round((total_on_hand / total_capacity) * 100) : 0;

      // Identify stockout SKUs (available <= reorder point)
      const stockout_skus = recs.filter((r) => r.available_units <= r.reorder_point).map((r) => r.sku);

      // Check if affected by active UNRECOVERED disruption
      const isDisrupted = unrecoveredActiveDisruptions.some((d) => d.affected_node_or_route_id === warehouseId);

      let status: 'optimal' | 'warning' | 'critical' = 'optimal';
      if (isDisrupted) {
        status = 'critical';
      } else if (stockout_skus.length > 0 || utilization_pct > 80 || utilization_pct < 20) {
        status = 'warning';
      }

      return {
        warehouse_id: warehouseId,
        name: recs[0].warehouse_name,
        cities,
        records: recs,
        total_on_hand,
        total_reserved,
        total_available,
        total_capacity,
        utilization_pct,
        status,
        stockout_skus,
      };
    });
  }

  /**
   * Return 6 physical facilities with accurate geospatial SVG coordinates
   */
  getPhysicalFacilities(simDate: string = '2026-10-05'): PhysicalFacility[] {
    const rawRecords = this.getRawInventoryRecords();
    const evaluatedDisruptions = this.getEvaluatedDisruptions(simDate);
    const unrecoveredActiveDisruptions = evaluatedDisruptions.filter(
      (d) => d.state === 'active' && (!d.recovery || d.recovery.status !== 'RECOVERED')
    );

    return FACILITY_CONFIGS.map((config) => {
      const matchingRecords = rawRecords.filter(
        (r) => r.warehouse_name === config.name && r.city === config.city
      );

      const total_on_hand = matchingRecords.reduce((sum, r) => sum + r.on_hand_units, 0);
      const total_reserved = matchingRecords.reduce((sum, r) => sum + r.reserved_units, 0);
      const total_available = matchingRecords.reduce((sum, r) => sum + r.available_units, 0);
      const total_capacity = matchingRecords.reduce((sum, r) => sum + r.capacity_units, 0);
      const utilization_pct = total_capacity > 0 ? Math.round((total_on_hand / total_capacity) * 100) : 0;

      // Check unrecovered disruptions affecting associated warehouses
      const isDisrupted = unrecoveredActiveDisruptions.some((d) =>
        config.associated_warehouse_ids.includes(d.affected_node_or_route_id)
      );

      const hasStockout = matchingRecords.some((r) => r.available_units <= r.reorder_point);

      let status: 'optimal' | 'warning' | 'critical' = 'optimal';
      if (isDisrupted) {
        status = 'critical';
      } else if (hasStockout || utilization_pct > 80) {
        status = 'warning';
      }

      return {
        ...config,
        inventory_records: matchingRecords,
        total_on_hand,
        total_reserved,
        total_available,
        total_capacity,
        utilization_pct,
        status,
      };
    });
  }

  /**
   * Return live operational shipments
   */
  getOrderShipments(): OrderShipment[] {
    return this.operationalShipments;
  }

  /**
   * Return all 14 transport network corridors
   */
  getTransportRoutes(): TransportRoute[] {
    return rawTransportRoutes;
  }

  /**
   * Return all 8 disruptions
   */
  getDisruptions(): Disruption[] {
    return rawDisruptions;
  }

  /**
   * Evaluate disruptions dynamically for a given simulation date (YYYY-MM-DD),
   * attaching any operational recovery state.
   */
  getEvaluatedDisruptions(simDate: string = '2026-10-05'): EvaluatedDisruption[] {
    return rawDisruptions.map((disruption) => {
      let state: 'active' | 'upcoming' | 'resolved' = 'upcoming';

      if (simDate >= disruption.start_date && simDate <= disruption.end_date) {
        state = 'active';
      } else if (simDate > disruption.end_date) {
        state = 'resolved';
      } else {
        state = 'upcoming';
      }

      const recovery = this.operationalRecoveries.get(disruption.disruption_id);

      return {
        ...disruption,
        state,
        recovery,
      };
    });
  }

  /**
   * Get operational recovery state for a disruption
   */
  getOperationalRecovery(disruptionId: string): OperationalRecoveryState | undefined {
    return this.operationalRecoveries.get(disruptionId);
  }

  /**
   * Commit a recovery execution result, taking a pre-commit snapshot first
   */
  commitRecoveryPlan(result: RecoveryExecutionResult): { snapshot_id: string; commit_id: string } {
    // 1. Take pre-commit snapshot
    const snapshot_id = `SNP-${Date.now()}`;
    const preSnapshot: PreCommitSnapshot = {
      snapshot_id,
      timestamp: Date.now(),
      shipments: JSON.parse(JSON.stringify(this.operationalShipments)),
      inventory: JSON.parse(JSON.stringify(this.operationalInventory)),
      recoveries: Object.fromEntries(this.operationalRecoveries.entries()),
    };
    this.snapshots.set(snapshot_id, preSnapshot);

    // 2. Apply rerouted shipments
    for (const reroute of result.rerouted_shipments) {
      const idx = this.operationalShipments.findIndex((s) => s.shipment_id === reroute.shipment_id);
      if (idx !== -1) {
        const shp = this.operationalShipments[idx];
        if (!shp.original_route_id) {
          shp.original_route_id = shp.route_id;
        }
        shp.route_id = reroute.new_route;
        shp.shipment_status = 'Rerouted';
        shp.is_rerouted = true;
        shp.sla_delta_hours = reroute.eta_delta_hours;
        shp.recovery_plan_id = result.plan_id;
      }
    }

    // 3. Apply reallocated orders / inventory
    for (const realloc of result.reallocated_orders) {
      // Find matching inventory record at source warehouse to deduct available units
      const srcRecord = this.operationalInventory.find(
        (r) => r.warehouse_id === realloc.source_warehouse && r.sku === realloc.sku
      );
      if (srcRecord && srcRecord.available_units >= realloc.quantity) {
        srcRecord.available_units -= realloc.quantity;
        srcRecord.reserved_units += realloc.quantity;
      }

      // Update shipment destination / origin if associated
      const shp = this.operationalShipments.find((s) => s.order_id === realloc.order_id);
      if (shp) {
        shp.origin_node_id = realloc.source_warehouse;
        shp.shipment_status = 'Recovered / On Schedule';
        shp.recovery_plan_id = result.plan_id;
      }
    }

    // 4. Record operational recovery state
    const recoveryState: OperationalRecoveryState = {
      disruption_id: result.disruption_id,
      status: 'RECOVERED',
      recovery_note: result.explanation,
      plan_id: result.plan_id,
      commit_id: result.commit_id,
      snapshot_id,
      committed_at: Date.now(),
      rerouted_shipments: result.rerouted_shipments.map((s) => s.shipment_id),
      reallocated_orders: result.reallocated_orders.map((o) => o.order_id),
    };
    this.operationalRecoveries.set(result.disruption_id, recoveryState);

    return { snapshot_id, commit_id: result.commit_id };
  }

  /**
   * Rollback twin state using a pre-commit snapshot ID
   */
  rollbackSnapshot(snapshotId: string): RollbackResult {
    const snapshot = this.snapshots.get(snapshotId);
    if (!snapshot) {
      return {
        success: false,
        rollback_id: `RBK-ERR-${Date.now()}`,
        snapshot_id: snapshotId,
        scenario_id: 'active_twin',
        restored_entities: {},
        explanation: `Snapshot ${snapshotId} not found in rollback registry.`,
        message: 'Rollback failed: Snapshot not found',
      };
    }

    // Restore state from snapshot
    this.operationalShipments = JSON.parse(JSON.stringify(snapshot.shipments));
    this.operationalInventory = JSON.parse(JSON.stringify(snapshot.inventory));
    this.operationalRecoveries.clear();
    for (const [k, v] of Object.entries(snapshot.recoveries)) {
      this.operationalRecoveries.set(k, v);
    }

    this.snapshots.delete(snapshotId);

    return {
      success: true,
      rollback_id: `RBK-${Date.now()}`,
      snapshot_id: snapshotId,
      scenario_id: 'active_twin',
      restored_entities: {
        shipments: this.operationalShipments.length,
        inventory_records: this.operationalInventory.length,
        recoveries_reverted: 1,
      },
      explanation: `Successfully rolled back to snapshot ${snapshotId}. Operational mutations reverted.`,
      message: 'Rollback complete. Twin restored.',
    };
  }

  /**
   * Derive network operational status truthfully from refreshed operational state
   */
  deriveNetworkStatus(simDate: string = '2026-10-05'): NetworkOperationalStatus {
    const evaluated = this.getEvaluatedDisruptions(simDate);
    const activeDisruptions = evaluated.filter((d) => d.state === 'active');

    if (activeDisruptions.length === 0) {
      return 'NETWORK OPERATIONAL';
    }

    const recoveredCount = activeDisruptions.filter((d) => d.recovery && d.recovery.status === 'RECOVERED').length;

    if (recoveredCount === activeDisruptions.length) {
      return 'NETWORK OPERATIONAL';
    }

    if (recoveredCount > 0) {
      return 'PARTIAL RECOVERY';
    }

    return 'NETWORK DEGRADED';
  }

  /**
   * Dynamic Network KPIs based on dataset, simulation date, and operational recoveries
   */
  getNetworkKpis(simDate: string = '2026-10-05'): NetworkKpis {
    const warehouses = this.getNormalizedWarehouses(simDate);
    const shipments = this.getOrderShipments();
    const evaluatedDisruptions = this.getEvaluatedDisruptions(simDate);
    const activeDisruptions = evaluatedDisruptions.filter((d) => d.state === 'active');
    const unrecoveredActive = activeDisruptions.filter((d) => !d.recovery || d.recovery.status !== 'RECOVERED');

    const healthy_warehouses = warehouses.filter((w) => w.status === 'optimal').length;
    const at_risk_warehouses = warehouses.filter((w) => w.status === 'warning').length;
    const critical_warehouses = warehouses.filter((w) => w.status === 'critical').length;

    const total_inventory_units = warehouses.reduce((sum, w) => sum + w.total_on_hand, 0);
    const available_inventory_units = warehouses.reduce((sum, w) => sum + w.total_available, 0);
    const reserved_inventory_units = warehouses.reduce((sum, w) => sum + w.total_reserved, 0);

    const total_shipments = shipments.length;
    const in_transit_shipments = shipments.filter((s) => s.shipment_status === 'In Transit').length;
    const delayed_shipments = shipments.filter(
      (s) => s.shipment_status === 'Delayed' || s.shipment_status === 'Delivered Late'
    ).length;
    const delivered_shipments = shipments.filter((s) => s.shipment_status === 'Delivered').length;
    const planned_shipments = shipments.filter((s) => s.shipment_status === 'Planned').length;
    const rerouted_shipments = shipments.filter((s) => s.shipment_status === 'Rerouted' || s.is_rerouted).length;

    const deliveredTotal = delivered_shipments + shipments.filter((s) => s.shipment_status === 'Delivered Late').length;
    const otif_pct = deliveredTotal > 0 ? Math.round((delivered_shipments / deliveredTotal) * 1000) / 10 : 83.3;

    // Disrupted routes and nodes (only unrecovered count as actively disrupted in operational telemetry)
    const disrupted_routes_count = unrecoveredActive.filter((d) => d.affected_node_or_route_id.startsWith('RT-')).length;
    const disrupted_nodes_count = unrecoveredActive.filter(
      (d) => d.affected_node_or_route_id.startsWith('WH-') || d.affected_node_or_route_id.startsWith('SUP-')
    ).length;

    return {
      total_warehouses: warehouses.length,
      healthy_warehouses,
      at_risk_warehouses,
      critical_warehouses,
      total_inventory_units,
      available_inventory_units,
      reserved_inventory_units,
      total_shipments,
      in_transit_shipments,
      delayed_shipments,
      delivered_shipments,
      planned_shipments,
      rerouted_shipments,
      total_orders: shipments.length,
      otif_pct,
      active_disruptions_count: activeDisruptions.length,
      unrecovered_disruptions_count: unrecoveredActive.length,
      disrupted_routes_count,
      disrupted_nodes_count,
    };
  }

  /**
   * Helper to retrieve SVG coordinate for any node ID (Supplier or Warehouse)
   */
  getNodeCoordinates(nodeId: string): { x: number; y: number; name: string } | null {
    if (SUPPLIER_SVG_COORDS[nodeId]) {
      const sup = rawSuppliers.find((s) => s.supplier_id === nodeId);
      return {
        ...SUPPLIER_SVG_COORDS[nodeId],
        name: sup ? sup.supplier_name : nodeId,
      };
    }
    if (WAREHOUSE_LOGICAL_SVG_COORDS[nodeId]) {
      const wh = WAREHOUSE_LOGICAL_SVG_COORDS[nodeId];
      return {
        x: wh.x,
        y: wh.y,
        name: wh.facility_name,
      };
    }
    return null;
  }
}

export const logisticsRepository = new LogisticsRepository();
export default logisticsRepository;

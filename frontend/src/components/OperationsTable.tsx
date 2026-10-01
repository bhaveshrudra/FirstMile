import React, { useState, useMemo } from 'react';
import {
  OrderShipment,
  WarehouseInventoryRecord,
  TransportRoute,
  EvaluatedDisruption,
} from '../types/logistics';

export type TableTab = 'shipments' | 'orders' | 'inventory' | 'routes' | 'alerts';

interface OperationsTableProps {
  shipments: OrderShipment[];
  inventory: WarehouseInventoryRecord[];
  routes: TransportRoute[];
  disruptions: EvaluatedDisruption[];
  onSelectWarehouseId: (id: string) => void;
  externalSearchQuery: string;
}

export const OperationsTable: React.FC<OperationsTableProps> = ({
  shipments,
  inventory,
  routes,
  disruptions,
  onSelectWarehouseId,
  externalSearchQuery,
}) => {
  const [activeTab, setActiveTab] = useState<TableTab>('shipments');
  const [localSearch, setLocalSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [sortField, setSortField] = useState<string>('');
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  // Combined search term from top search bar or local table filter
  const query = (localSearch || externalSearchQuery).trim().toLowerCase();

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  // 1. Filtered Shipments
  const filteredShipments = useMemo(() => {
    let result = [...shipments];
    if (statusFilter !== 'ALL') {
      result = result.filter((s) => s.shipment_status === statusFilter);
    }
    if (priorityFilter !== 'ALL') {
      result = result.filter((s) => s.priority === priorityFilter);
    }
    if (query) {
      result = result.filter(
        (s) =>
          s.shipment_id.toLowerCase().includes(query) ||
          s.sku.toLowerCase().includes(query) ||
          s.origin_node_id.toLowerCase().includes(query) ||
          s.destination_node_id.toLowerCase().includes(query) ||
          s.route_id.toLowerCase().includes(query)
      );
    }
    if (sortField) {
      result.sort((a: any, b: any) => {
        const valA = a[sortField] ?? '';
        const valB = b[sortField] ?? '';
        if (valA < valB) return sortAsc ? -1 : 1;
        if (valA > valB) return sortAsc ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [shipments, statusFilter, priorityFilter, query, sortField, sortAsc]);

  // 2. Filtered Orders
  const filteredOrders = useMemo(() => {
    let result = [...shipments];
    if (priorityFilter !== 'ALL') {
      result = result.filter((s) => s.priority === priorityFilter);
    }
    if (query) {
      result = result.filter(
        (s) =>
          s.order_id.toLowerCase().includes(query) ||
          s.supplier_id.toLowerCase().includes(query) ||
          s.sku.toLowerCase().includes(query)
      );
    }
    return result;
  }, [shipments, priorityFilter, query]);

  // 3. Filtered Inventory
  const filteredInventory = useMemo(() => {
    let result = [...inventory];
    if (query) {
      result = result.filter(
        (i) =>
          i.warehouse_id.toLowerCase().includes(query) ||
          i.warehouse_name.toLowerCase().includes(query) ||
          i.city.toLowerCase().includes(query) ||
          i.sku.toLowerCase().includes(query) ||
          i.product_category.toLowerCase().includes(query)
      );
    }
    return result;
  }, [inventory, query]);

  // 4. Filtered Routes
  const filteredRoutes = useMemo(() => {
    let result = [...routes];
    if (query) {
      result = result.filter(
        (r) =>
          r.route_id.toLowerCase().includes(query) ||
          r.origin_node_id.toLowerCase().includes(query) ||
          r.destination_node_id.toLowerCase().includes(query) ||
          r.mode.toLowerCase().includes(query)
      );
    }
    return result;
  }, [routes, query]);

  // 5. Filtered Disruptions / Alerts
  const filteredAlerts = useMemo(() => {
    let result = [...disruptions];
    if (query) {
      result = result.filter(
        (d) =>
          d.disruption_id.toLowerCase().includes(query) ||
          d.affected_node_or_route_id.toLowerCase().includes(query) ||
          d.disruption_type.toLowerCase().includes(query) ||
          d.description.toLowerCase().includes(query)
      );
    }
    return result;
  }, [disruptions, query]);

  const activeAlertsCount = disruptions.filter((d) => d.state === 'active').length;

  return (
    <div
      className={`bg-white border-t border-slate-200 flex flex-col shrink-0 shadow-lg z-30 transition-all select-none ${
        isCollapsed ? 'h-10' : 'h-64'
      }`}
    >
      {/* Top Action / Tab Bar */}
      <div className="h-10 px-space-md bg-slate-100 border-b border-slate-200 flex items-center justify-between shrink-0">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-space-xs h-full">
          {/* Shipments Tab */}
          <button
            type="button"
            onClick={() => setActiveTab('shipments')}
            className={`h-full px-space-md font-label-caps text-label-caps flex items-center gap-space-2xs transition-colors border-x ${
              activeTab === 'shipments'
                ? 'text-sky-700 bg-white border-t-2 border-t-sky-600 border-slate-200 font-bold'
                : 'text-slate-600 hover:text-slate-900 border-transparent font-semibold'
            }`}
          >
            {activeTab === 'shipments' && <span className="w-1.5 h-1.5 rounded-full bg-sky-600 animate-pulse"></span>}
            <span>SHIPMENTS (ACTIVE)</span>
            <span
              className={`px-space-2xs py-0 rounded text-[10px] ${
                activeTab === 'shipments' ? 'bg-sky-100 text-sky-700' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {shipments.length}
            </span>
          </button>

          {/* Orders Tab */}
          <button
            type="button"
            onClick={() => setActiveTab('orders')}
            className={`h-full px-space-md font-label-caps text-label-caps flex items-center gap-space-2xs transition-colors border-x ${
              activeTab === 'orders'
                ? 'text-sky-700 bg-white border-t-2 border-t-sky-600 border-slate-200 font-bold'
                : 'text-slate-600 hover:text-slate-900 border-transparent font-semibold'
            }`}
          >
            <span>ORDERS</span>
            <span className="px-space-2xs py-0 rounded bg-slate-200 text-slate-700 text-[10px]">
              {shipments.length}
            </span>
          </button>

          {/* Inventory Tab */}
          <button
            type="button"
            onClick={() => setActiveTab('inventory')}
            className={`h-full px-space-md font-label-caps text-label-caps flex items-center gap-space-2xs transition-colors border-x ${
              activeTab === 'inventory'
                ? 'text-sky-700 bg-white border-t-2 border-t-sky-600 border-slate-200 font-bold'
                : 'text-slate-600 hover:text-slate-900 border-transparent font-semibold'
            }`}
          >
            <span>INVENTORY</span>
            <span className="px-space-2xs py-0 rounded bg-slate-200 text-slate-700 text-[10px]">
              {inventory.length}
            </span>
          </button>

          {/* Routes Tab */}
          <button
            type="button"
            onClick={() => setActiveTab('routes')}
            className={`h-full px-space-md font-label-caps text-label-caps flex items-center gap-space-2xs transition-colors border-x ${
              activeTab === 'routes'
                ? 'text-sky-700 bg-white border-t-2 border-t-sky-600 border-slate-200 font-bold'
                : 'text-slate-600 hover:text-slate-900 border-transparent font-semibold'
            }`}
          >
            <span>ROUTES</span>
            <span className="px-space-2xs py-0 rounded bg-slate-200 text-slate-700 text-[10px]">
              {routes.length}
            </span>
          </button>

          {/* Alerts Tab */}
          <button
            type="button"
            onClick={() => setActiveTab('alerts')}
            className={`h-full px-space-md font-label-caps text-label-caps flex items-center gap-space-2xs transition-colors border-x ${
              activeTab === 'alerts'
                ? 'text-rose-700 bg-white border-t-2 border-t-rose-600 border-slate-200 font-bold'
                : 'text-rose-700 hover:text-rose-900 border-transparent font-semibold'
            }`}
          >
            <span>ALERTS</span>
            <span className="px-space-2xs py-0 rounded bg-rose-100 border border-rose-200 text-rose-700 text-[10px] font-bold">
              {activeAlertsCount} CRIT
            </span>
          </button>
        </div>

        {/* Quick Search & Filters */}
        <div className="flex items-center gap-space-sm">
          <div className="relative flex items-center">
            <span className="material-symbols-outlined absolute left-space-xs text-slate-400 text-[14px]">
              search
            </span>
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Filter tab items..."
              className="h-7 w-40 pl-space-lg pr-space-xs bg-white border border-slate-200 text-slate-800 placeholder:text-slate-400 font-data-mono-sm text-data-mono-sm rounded focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>

          {activeTab === 'shipments' && (
            <>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-7 px-space-xs bg-white border border-slate-200 text-slate-700 font-label-caps text-label-caps rounded focus:outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer"
              >
                <option value="ALL">STATUS: ALL</option>
                <option value="In Transit">IN TRANSIT</option>
                <option value="Delayed">DELAYED</option>
                <option value="Rerouted">REROUTED</option>
                <option value="Recovered / On Schedule">RECOVERED</option>
                <option value="Planned">PLANNED</option>
                <option value="Delivered">DELIVERED</option>
                <option value="Delivered Late">DELIVERED LATE</option>
              </select>

              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="h-7 px-space-xs bg-white border border-slate-200 text-slate-700 font-label-caps text-label-caps rounded focus:outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer"
              >
                <option value="ALL">PRIORITY: ALL</option>
                <option value="High">HIGH</option>
                <option value="Normal">NORMAL</option>
              </select>
            </>
          )}

          {/* Collapse/Expand Toggle */}
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="w-7 h-7 flex items-center justify-center rounded bg-white border border-slate-200 hover:bg-slate-200 text-slate-600 transition-colors"
            title={isCollapsed ? 'Expand Table' : 'Collapse Table'}
          >
            <span className="material-symbols-outlined text-[16px]">
              {isCollapsed ? 'expand_less' : 'expand_more'}
            </span>
          </button>
        </div>
      </div>

      {/* Dense Operational Table Body */}
      {!isCollapsed && (
        <div className="flex-1 overflow-auto bg-white">
          {/* TAB 1: SHIPMENTS */}
          {activeTab === 'shipments' && (
            <table className="w-full text-left font-data-mono-sm text-data-mono-sm border-collapse">
              <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 text-slate-600 font-label-caps text-label-caps z-10">
                <tr>
                  <th
                    className="py-space-xs px-space-md cursor-pointer hover:text-slate-900"
                    onClick={() => handleSort('shipment_id')}
                  >
                    SHIPMENT ID
                  </th>
                  <th
                    className="py-space-xs px-space-sm cursor-pointer hover:text-slate-900"
                    onClick={() => handleSort('sku')}
                  >
                    CONSIGNMENT SKU
                  </th>
                  <th className="py-space-xs px-space-sm">FLEET / ASSET</th>
                  <th className="py-space-xs px-space-sm">ORIGIN NODE</th>
                  <th className="py-space-xs px-space-sm">DESTINATION HUB</th>
                  <th className="py-space-xs px-space-sm">ROUTE</th>
                  <th
                    className="py-space-xs px-space-sm text-right cursor-pointer hover:text-slate-900"
                    onClick={() => handleSort('quantity_units')}
                  >
                    QUANTITY
                  </th>
                  <th
                    className="py-space-xs px-space-sm text-right cursor-pointer hover:text-slate-900"
                    onClick={() => handleSort('eta_date')}
                  >
                    EST. ETA
                  </th>
                  <th className="py-space-xs px-space-sm text-right">SLA DELTA</th>
                  <th className="py-space-xs px-space-md text-center">DISPATCH STATUS</th>
                </tr>
              </thead>
              <tbody className="text-slate-800 divide-y divide-slate-100">
                {filteredShipments.map((shp) => {
                  const isDelayed = shp.shipment_status === 'Delayed';
                  const isDelivered = shp.shipment_status === 'Delivered';
                  const isTransit = shp.shipment_status === 'In Transit';
                  const isRerouted = shp.shipment_status === 'Rerouted' || Boolean(shp.is_rerouted);
                  const isRecovered = shp.shipment_status === 'Recovered / On Schedule';

                  return (
                    <tr
                      key={shp.shipment_id}
                      className="hover:bg-sky-50/50 transition-colors cursor-pointer"
                      onClick={() => onSelectWarehouseId(shp.destination_node_id)}
                    >
                      <td className="py-space-xs px-space-md font-bold text-sky-800 flex items-center gap-space-2xs">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isDelayed
                              ? 'bg-rose-600'
                              : isRerouted
                              ? 'bg-sky-500'
                              : isRecovered
                              ? 'bg-emerald-600'
                              : isTransit
                              ? 'bg-sky-600'
                              : 'bg-emerald-500'
                          }`}
                        ></span>
                        {shp.shipment_id}
                      </td>
                      <td className="py-space-xs px-space-sm text-slate-900 font-medium">
                        {shp.sku}
                      </td>
                      <td className="py-space-xs px-space-sm text-slate-500 italic text-[11px]">
                        Unassigned (Dataset v1.0)
                      </td>
                      <td className="py-space-xs px-space-sm text-slate-700">{shp.origin_node_id}</td>
                      <td className="py-space-xs px-space-sm font-semibold text-slate-900">
                        {shp.destination_node_id}
                      </td>
                      <td className="py-space-xs px-space-sm text-slate-600 font-semibold">
                        <span>{shp.route_id}</span>
                        {shp.original_route_id && (
                          <span className="text-[10px] text-sky-600 block font-normal">
                            (prev: {shp.original_route_id})
                          </span>
                        )}
                      </td>
                      <td className="py-space-xs px-space-sm text-right font-medium text-slate-800">
                        {shp.quantity_units}
                      </td>
                      <td className="py-space-xs px-space-sm text-right font-medium text-slate-800">
                        {shp.eta_date}
                      </td>
                      <td
                        className={`py-space-xs px-space-sm text-right font-bold ${
                          isDelayed
                            ? 'text-rose-700'
                            : shp.shipment_status === 'Delivered Late'
                            ? 'text-amber-700'
                            : isRerouted
                            ? 'text-sky-700'
                            : 'text-emerald-700'
                        }`}
                      >
                        {isDelayed
                          ? '+24.0h LATE'
                          : shp.shipment_status === 'Delivered Late'
                          ? '+24.0h DELAY'
                          : isRerouted
                          ? `+${(shp.sla_delta_hours || 4.5).toFixed(1)}h REROUTE`
                          : '+0.0h ON TIME'}
                      </td>
                      <td className="py-space-xs px-space-md text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-space-xs py-0.5 rounded text-[10px] font-bold border ${
                            isDelayed
                              ? 'bg-rose-100 border-rose-200 text-rose-700'
                              : isRerouted
                              ? 'bg-sky-100 border-sky-300 text-sky-800'
                              : isRecovered
                              ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
                              : isTransit
                              ? 'bg-sky-100 border-sky-200 text-sky-800'
                              : isDelivered
                              ? 'bg-emerald-100 border-emerald-200 text-emerald-800'
                              : 'bg-slate-100 border-slate-200 text-slate-700'
                          }`}
                        >
                          {shp.shipment_status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* TAB 2: ORDERS */}
          {activeTab === 'orders' && (
            <table className="w-full text-left font-data-mono-sm text-data-mono-sm border-collapse">
              <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 text-slate-600 font-label-caps text-label-caps z-10">
                <tr>
                  <th className="py-space-xs px-space-md">ORDER ID</th>
                  <th className="py-space-xs px-space-sm">SHIPMENT ID</th>
                  <th className="py-space-xs px-space-sm">ORDER DATE</th>
                  <th className="py-space-xs px-space-sm">SUPPLIER</th>
                  <th className="py-space-xs px-space-sm">DESTINATION</th>
                  <th className="py-space-xs px-space-sm">SKU</th>
                  <th className="py-space-xs px-space-sm text-right">QUANTITY</th>
                  <th className="py-space-xs px-space-sm text-center">PRIORITY</th>
                  <th className="py-space-xs px-space-md text-center">STATUS</th>
                </tr>
              </thead>
              <tbody className="text-slate-800 divide-y divide-slate-100">
                {filteredOrders.map((ord) => (
                  <tr key={ord.order_id} className="hover:bg-sky-50/50">
                    <td className="py-space-xs px-space-md font-bold text-sky-800">{ord.order_id}</td>
                    <td className="py-space-xs px-space-sm font-semibold">{ord.shipment_id}</td>
                    <td className="py-space-xs px-space-sm text-slate-600">{ord.order_date}</td>
                    <td className="py-space-xs px-space-sm text-slate-700">{ord.supplier_id}</td>
                    <td className="py-space-xs px-space-sm font-semibold text-slate-900">
                      {ord.destination_node_id}
                    </td>
                    <td className="py-space-xs px-space-sm font-medium">{ord.sku}</td>
                    <td className="py-space-xs px-space-sm text-right font-medium">{ord.quantity_units}</td>
                    <td className="py-space-xs px-space-sm text-center">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          ord.priority === 'High' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {ord.priority}
                      </span>
                    </td>
                    <td className="py-space-xs px-space-md text-center">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-800">
                        {ord.shipment_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* TAB 3: INVENTORY */}
          {activeTab === 'inventory' && (
            <table className="w-full text-left font-data-mono-sm text-data-mono-sm border-collapse">
              <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 text-slate-600 font-label-caps text-label-caps z-10">
                <tr>
                  <th className="py-space-xs px-space-md">WAREHOUSE ID</th>
                  <th className="py-space-xs px-space-sm">FACILITY NAME</th>
                  <th className="py-space-xs px-space-sm">CITY</th>
                  <th className="py-space-xs px-space-sm">SKU</th>
                  <th className="py-space-xs px-space-sm">CATEGORY</th>
                  <th className="py-space-xs px-space-sm text-right">ON HAND</th>
                  <th className="py-space-xs px-space-sm text-right">RESERVED</th>
                  <th className="py-space-xs px-space-sm text-right">AVAILABLE</th>
                  <th className="py-space-xs px-space-sm text-right">CAPACITY</th>
                  <th className="py-space-xs px-space-md text-center">REORDER POINT</th>
                </tr>
              </thead>
              <tbody className="text-slate-800 divide-y divide-slate-100">
                {filteredInventory.map((item, idx) => (
                  <tr
                    key={`${item.warehouse_id}-${item.sku}-${idx}`}
                    className="hover:bg-sky-50/50 cursor-pointer"
                    onClick={() => onSelectWarehouseId(item.warehouse_id)}
                  >
                    <td className="py-space-xs px-space-md font-bold text-sky-800">{item.warehouse_id}</td>
                    <td className="py-space-xs px-space-sm font-semibold">{item.warehouse_name}</td>
                    <td className="py-space-xs px-space-sm text-slate-600">{item.city}</td>
                    <td className="py-space-xs px-space-sm text-indigo-700 font-bold">{item.sku}</td>
                    <td className="py-space-xs px-space-sm text-slate-600">{item.product_category}</td>
                    <td className="py-space-xs px-space-sm text-right font-medium">{item.on_hand_units}</td>
                    <td className="py-space-xs px-space-sm text-right text-slate-500">{item.reserved_units}</td>
                    <td className="py-space-xs px-space-sm text-right text-emerald-700 font-bold">
                      {item.available_units}
                    </td>
                    <td className="py-space-xs px-space-sm text-right text-slate-500">{item.capacity_units}</td>
                    <td className="py-space-xs px-space-md text-center font-bold text-amber-700">
                      {item.reorder_point}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* TAB 4: ROUTES */}
          {activeTab === 'routes' && (
            <table className="w-full text-left font-data-mono-sm text-data-mono-sm border-collapse">
              <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 text-slate-600 font-label-caps text-label-caps z-10">
                <tr>
                  <th className="py-space-xs px-space-md">ROUTE ID</th>
                  <th className="py-space-xs px-space-sm">ORIGIN</th>
                  <th className="py-space-xs px-space-sm">DESTINATION</th>
                  <th className="py-space-xs px-space-sm">MODE</th>
                  <th className="py-space-xs px-space-sm text-right">DISTANCE (KM)</th>
                  <th className="py-space-xs px-space-sm text-right">TRAVEL TIME (H)</th>
                  <th className="py-space-xs px-space-sm text-right">COST / UNIT</th>
                  <th className="py-space-xs px-space-sm text-right">DAILY CAPACITY</th>
                  <th className="py-space-xs px-space-md text-center">AVAILABILITY</th>
                </tr>
              </thead>
              <tbody className="text-slate-800 divide-y divide-slate-100">
                {filteredRoutes.map((rt) => (
                  <tr key={rt.route_id} className="hover:bg-sky-50/50">
                    <td className="py-space-xs px-space-md font-bold text-sky-800">{rt.route_id}</td>
                    <td className="py-space-xs px-space-sm">{rt.origin_node_id}</td>
                    <td className="py-space-xs px-space-sm font-semibold">{rt.destination_node_id}</td>
                    <td className="py-space-xs px-space-sm text-slate-600 font-medium">{rt.mode}</td>
                    <td className="py-space-xs px-space-sm text-right font-medium">{rt.distance_km}</td>
                    <td className="py-space-xs px-space-sm text-right font-medium">{rt.travel_time_hr}</td>
                    <td className="py-space-xs px-space-sm text-right">₹{rt.cost_per_unit}</td>
                    <td className="py-space-xs px-space-sm text-right font-medium">{rt.capacity_units_per_day}</td>
                    <td className="py-space-xs px-space-md text-center">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 border border-emerald-200 text-emerald-800">
                        {rt.availability.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* TAB 5: ALERTS / DISRUPTIONS */}
          {activeTab === 'alerts' && (
            <table className="w-full text-left font-data-mono-sm text-data-mono-sm border-collapse">
              <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 text-slate-600 font-label-caps text-label-caps z-10">
                <tr>
                  <th className="py-space-xs px-space-md">DISRUPTION ID</th>
                  <th className="py-space-xs px-space-sm">TYPE</th>
                  <th className="py-space-xs px-space-sm">TARGET ENTITY</th>
                  <th className="py-space-xs px-space-sm">START DATE</th>
                  <th className="py-space-xs px-space-sm text-right">DURATION</th>
                  <th className="py-space-xs px-space-sm text-center">SEVERITY</th>
                  <th className="py-space-xs px-space-sm text-right">CAP REDUCTION</th>
                  <th className="py-space-xs px-space-sm">DESCRIPTION</th>
                  <th className="py-space-xs px-space-md text-center">STATE</th>
                </tr>
              </thead>
              <tbody className="text-slate-800 divide-y divide-slate-100">
                {filteredAlerts.map((alt) => (
                  <tr key={alt.disruption_id} className="hover:bg-rose-50/50">
                    <td className="py-space-xs px-space-md font-bold text-rose-700">{alt.disruption_id}</td>
                    <td className="py-space-xs px-space-sm font-semibold">{alt.disruption_type}</td>
                    <td className="py-space-xs px-space-sm text-slate-900 font-bold">
                      {alt.affected_node_or_route_id}
                    </td>
                    <td className="py-space-xs px-space-sm text-slate-600">{alt.start_date}</td>
                    <td className="py-space-xs px-space-sm text-right font-medium">{alt.duration_hours}h</td>
                    <td className="py-space-xs px-space-sm text-center">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700">
                        {alt.severity} / 5
                      </span>
                    </td>
                    <td className="py-space-xs px-space-sm text-right font-bold text-rose-700">
                      {alt.capacity_reduction_pct}%
                    </td>
                    <td className="py-space-xs px-space-sm text-slate-600 max-w-xs truncate">
                      {alt.description}
                    </td>
                    <td className="py-space-xs px-space-md text-center">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                          alt.state === 'active'
                            ? 'bg-rose-100 border-rose-200 text-rose-700 animate-pulse'
                            : alt.state === 'upcoming'
                            ? 'bg-amber-100 border-amber-200 text-amber-700'
                            : 'bg-slate-100 border-slate-200 text-slate-600'
                        }`}
                      >
                        {alt.state.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};

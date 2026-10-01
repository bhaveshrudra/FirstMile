import React from 'react';
import { NormalizedWarehouse, OrderShipment } from '../types/logistics';

interface WarehouseDrawerProps {
  warehouse: NormalizedWarehouse | null;
  associatedOrders: OrderShipment[];
  onClose: () => void;
}

export const WarehouseDrawer: React.FC<WarehouseDrawerProps> = ({
  warehouse,
  associatedOrders,
  onClose,
}) => {
  if (!warehouse) {
    return (
      <div className="flex-1 p-space-md flex flex-col items-center justify-center text-slate-400 font-data-mono-sm text-xs bg-slate-50">
        <span className="material-symbols-outlined text-[32px] mb-2 text-slate-300">warehouse</span>
        <span>Select a warehouse node on the map to inspect telemetry</span>
      </div>
    );
  }

  const pendingOrders = associatedOrders.filter((o) => o.shipment_status === 'Planned').length;
  const transitOrders = associatedOrders.filter((o) => o.shipment_status === 'In Transit').length;
  const delayedOrders = associatedOrders.filter((o) => o.shipment_status === 'Delayed').length;
  const deliveredOrders = associatedOrders.filter(
    (o) => o.shipment_status === 'Delivered' || o.shipment_status === 'Delivered Late'
  ).length;

  return (
    <div className="flex-1 p-space-md flex flex-col gap-space-md bg-slate-50 overflow-y-auto select-none">
      {/* Drawer Header */}
      <div className="flex items-center justify-between pb-space-xs border-b border-slate-200">
        <div className="flex flex-col">
          <div className="flex items-center gap-space-xs">
            <span className="font-headline-sm text-headline-sm text-slate-900 font-bold">
              WAREHOUSE {warehouse.warehouse_id}
            </span>
            <span
              className={`px-space-xs py-space-2xs rounded font-label-caps text-label-caps font-bold border ${
                warehouse.status === 'critical'
                  ? 'bg-rose-100 border-rose-200 text-rose-700 animate-pulse'
                  : warehouse.status === 'warning'
                  ? 'bg-amber-100 border-amber-200 text-amber-700'
                  : 'bg-emerald-100 border-emerald-200 text-emerald-800'
              }`}
            >
              {warehouse.status.toUpperCase()}
            </span>
          </div>
          <span className="font-data-mono-sm text-data-mono-sm text-slate-500">
            {warehouse.name} • {warehouse.cities.join(' / ')}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-7 h-7 rounded bg-white border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">close</span>
        </button>
      </div>

      {/* Metric Row */}
      <div className="grid grid-cols-5 gap-space-2xs p-space-xs rounded bg-white border border-slate-200 shadow-sm text-center">
        <div className="flex flex-col">
          <span className="font-label-caps text-label-caps text-slate-500 font-semibold">CAPACITY</span>
          <span className="font-data-mono-sm text-data-mono-sm text-slate-900 font-bold">
            {warehouse.total_capacity.toLocaleString()}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="font-label-caps text-label-caps text-slate-500 font-semibold">STOCK</span>
          <span className="font-data-mono-sm text-data-mono-sm text-slate-900 font-bold">
            {warehouse.total_on_hand.toLocaleString()}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="font-label-caps text-label-caps text-slate-500 font-semibold">UTIL</span>
          <span
            className={`font-data-mono-sm text-data-mono-sm font-bold ${
              warehouse.utilization_pct > 80 ? 'text-amber-700' : 'text-sky-700'
            }`}
          >
            {warehouse.utilization_pct}%
          </span>
        </div>
        <div className="flex flex-col">
          <span className="font-label-caps text-label-caps text-slate-500 font-semibold">AVAIL</span>
          <span className="font-data-mono-sm text-data-mono-sm text-emerald-700 font-bold">
            {warehouse.total_available.toLocaleString()}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="font-label-caps text-label-caps text-slate-500 font-semibold">RESERVED</span>
          <span className="font-data-mono-sm text-data-mono-sm text-indigo-700 font-bold">
            {warehouse.total_reserved.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Mini Inventory SKU Breakdown Table */}
      <div className="flex flex-col gap-1">
        <span className="font-label-caps text-label-caps text-slate-600 font-bold uppercase">
          SKU INVENTORY ALLOCATION
        </span>
        <div className="rounded bg-white border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-left font-data-mono-sm text-[11px] border-collapse">
            <thead className="bg-slate-100 border-b border-slate-200 text-slate-600 font-label-caps text-[10px]">
              <tr>
                <th className="py-1 px-2">SKU ID</th>
                <th className="py-1 px-2">FACILITY / CITY</th>
                <th className="py-1 px-2 text-right">ON HAND</th>
                <th className="py-1 px-2 text-right">AVAIL</th>
                <th className="py-1 px-2 text-right">REORDER</th>
                <th className="py-1 px-2 text-center">STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {warehouse.records.map((rec, idx) => {
                const isStockout = rec.available_units <= rec.reorder_point;
                return (
                  <tr key={`${rec.sku}-${idx}`} className="hover:bg-sky-50/50">
                    <td className="py-1 px-2 font-bold text-sky-800">{rec.sku}</td>
                    <td className="py-1 px-2 text-slate-600">{rec.city}</td>
                    <td className="py-1 px-2 text-right font-medium">{rec.on_hand_units}</td>
                    <td className="py-1 px-2 text-right text-emerald-700 font-semibold">
                      {rec.available_units}
                    </td>
                    <td className="py-1 px-2 text-right text-slate-500">{rec.reorder_point}</td>
                    <td className="py-1 px-2 text-center">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                          isStockout
                            ? 'bg-rose-100 border-rose-200 text-rose-700'
                            : 'bg-emerald-100 border-emerald-200 text-emerald-800'
                        }`}
                      >
                        {isStockout ? 'LOW STOCK' : 'OPTIMAL'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Orders Auxiliary Summary */}
      <div className="grid grid-cols-2 gap-space-sm pt-space-xs">
        {/* Orders Breakdown */}
        <div className="p-space-sm rounded bg-white border border-slate-200 shadow-sm flex flex-col gap-space-2xs">
          <span className="font-label-caps text-label-caps text-slate-600 font-bold uppercase">
            ORDERS FLOW ({associatedOrders.length})
          </span>
          <div className="flex flex-col gap-1 text-[11px] font-data-mono-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Planned / Pending</span>
              <span className="text-slate-900 font-bold">{pendingOrders}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">In Transit</span>
              <span className="text-sky-700 font-bold">{transitOrders}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-rose-700 font-medium">Delayed</span>
              <span className="text-rose-700 font-bold">{delayedOrders}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-emerald-700">Delivered</span>
              <span className="text-emerald-700 font-bold">{deliveredOrders}</span>
            </div>
          </div>
        </div>

        {/* Associated Shipments List */}
        <div className="p-space-sm rounded bg-white border border-slate-200 shadow-sm flex flex-col gap-space-2xs">
          <span className="font-label-caps text-label-caps text-slate-600 font-bold uppercase">
            CONSIGNED SHIPMENTS
          </span>
          <div className="flex flex-col gap-1 text-[11px] font-data-mono-sm max-h-24 overflow-y-auto">
            {associatedOrders.length === 0 ? (
              <span className="text-slate-400">No active shipments</span>
            ) : (
              associatedOrders.map((ord) => (
                <div key={ord.shipment_id} className="flex justify-between items-center py-0.5 border-b border-slate-100 last:border-none">
                  <span className="font-bold text-sky-800">{ord.shipment_id}</span>
                  <span className="text-slate-500">{ord.quantity_units}u</span>
                  <span
                    className={`text-[9px] px-1 rounded ${
                      ord.shipment_status === 'Delayed'
                        ? 'bg-rose-100 text-rose-700'
                        : ord.shipment_status === 'In Transit'
                        ? 'bg-sky-100 text-sky-800'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {ord.shipment_status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

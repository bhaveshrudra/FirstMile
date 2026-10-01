import React from 'react';

export interface DataTableColumn<T> {
  /** Column header text */
  header: string;
  /** Accessor function to get cell value */
  accessor: (row: T, index: number) => React.ReactNode;
  /** Column alignment */
  align?: 'left' | 'center' | 'right';
  /** Optional width class */
  width?: string;
}

interface DataTableProps<T> {
  /** Column definitions */
  columns: DataTableColumn<T>[];
  /** Row data */
  data: T[];
  /** Optional highlight predicate — rows matching get accent styling */
  highlightRow?: (row: T, index: number) => boolean;
  /** Optional empty state message */
  emptyMessage?: string;
  /** Additional CSS classes */
  className?: string;
}

export function DataTable<T>({
  columns,
  data,
  highlightRow,
  emptyMessage = 'No data available.',
  className = '',
}: DataTableProps<T>) {
  const alignClass = (align?: string) => {
    if (align === 'center') return 'text-center';
    if (align === 'right') return 'text-right';
    return 'text-left';
  };

  if (data.length === 0) {
    return (
      <div className={`bg-slate-950/50 border border-slate-800/50 rounded-lg p-6 text-center text-slate-500 text-xs ${className}`}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={`overflow-x-auto rounded-lg border border-slate-800/50 ${className}`}>
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-slate-950/80 border-b border-slate-800">
            {columns.map((col, i) => (
              <th
                key={i}
                scope="col"
                className={`px-3 py-2.5 font-semibold text-[10px] uppercase tracking-wider text-slate-400 ${alignClass(col.align)} ${col.width || ''}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIdx) => {
            const isHighlighted = highlightRow?.(row, rowIdx);
            return (
              <tr
                key={rowIdx}
                className={`border-b border-slate-800/40 transition-colors ${
                  isHighlighted
                    ? 'bg-emerald-950/20 border-l-2 border-l-emerald-500'
                    : rowIdx % 2 === 0
                    ? 'bg-slate-900/50'
                    : 'bg-slate-950/30'
                } hover:bg-slate-800/30`}
              >
                {columns.map((col, colIdx) => (
                  <td
                    key={colIdx}
                    className={`px-3 py-2 font-mono text-slate-300 ${alignClass(col.align)}`}
                  >
                    {col.accessor(row, rowIdx)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default DataTable;

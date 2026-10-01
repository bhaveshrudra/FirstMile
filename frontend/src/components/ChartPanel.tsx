import React from 'react';
import { ResponsiveContainer } from 'recharts';

interface ChartPanelProps {
  /** Chart title */
  title: string;
  /** Lucide icon element */
  icon?: React.ReactNode;
  /** Optional info badge or annotation */
  badge?: React.ReactNode;
  /** Chart height (CSS value or Tailwind class) */
  height?: string;
  /** Whether data exists — shows empty state if false */
  hasData?: boolean;
  /** Loading skeleton state */
  loading?: boolean;
  /** Loading state message */
  loadingMessage?: string;
  /** Empty state message */
  emptyMessage?: string;
  /** Additional CSS classes for outer container */
  className?: string;
  /** Recharts chart element(s) to render inside ResponsiveContainer */
  children: React.ReactNode;
}

export const ChartPanel: React.FC<ChartPanelProps> = ({
  title,
  icon,
  badge,
  height = 'h-[300px]',
  hasData = true,
  loading = false,
  loadingMessage = 'Processing metaheuristic matrices...',
  emptyMessage = 'No data available yet.',
  className = '',
  children,
}) => {
  return (
    <div className={`bg-slate-900/95 border border-slate-800 p-5 rounded-xl ${height} ${className}`}>
      <div className="flex items-center justify-between gap-2 mb-4">
        <h3 className="text-sm font-bold text-slate-200 flex items-center gap-1.5 tracking-wide uppercase">
          {icon} {title}
        </h3>
        {badge}
      </div>
      <div className="w-full h-full pb-8">
        {loading ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-400 text-xs">
            <div className="w-8 h-8 rounded-full border-2 border-emerald-500/20 border-t-emerald-400 animate-spin" />
            <span className="font-mono text-[11px] text-slate-400 animate-pulse">{loadingMessage}</span>
          </div>
        ) : hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            {children as React.ReactElement}
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-slate-500 text-xs">
            {emptyMessage}
          </div>
        )}
      </div>
    </div>
  );
};

/** Standard Recharts dark theme tooltip style */
export const darkTooltipStyle = {
  backgroundColor: '#0f172a',
  borderColor: '#334155',
  color: '#f8fafc',
};

/** Standard Recharts dark theme axis style */
export const darkAxisStyle = { fontSize: 9 };

/** Standard Recharts dark theme grid stroke */
export const darkGridStroke = '#1e293b';

export default ChartPanel;

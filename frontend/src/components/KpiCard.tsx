import React from 'react';

export type KpiVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple';

const variantColors: Record<KpiVariant, { value: string; accent: string }> = {
  default: { value: 'text-slate-100', accent: 'text-slate-400' },
  success: { value: 'text-emerald-400', accent: 'text-emerald-400' },
  warning: { value: 'text-amber-400', accent: 'text-amber-400' },
  danger: { value: 'text-rose-400', accent: 'text-rose-400' },
  info: { value: 'text-cyan-400', accent: 'text-cyan-400' },
  purple: { value: 'text-purple-300', accent: 'text-purple-400' },
};

interface KpiCardProps {
  /** Metric label (e.g. "Travel Duration") */
  label: string;
  /** Numeric or string value */
  value: string | number;
  /** Unit label (e.g. "mins", "km", "%") */
  unit?: string;
  /** Lucide icon element */
  icon?: React.ReactNode;
  /** Color variant */
  variant?: KpiVariant;
  /** Optional status pill (e.g. "Low", "Moderate", "Optimal") */
  statusPill?: {
    text: string;
    variant?: 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'neutral';
  };
  /** Optional sparkline / mini chart */
  sparkline?: React.ReactNode;
  /** Optional loading skeleton state */
  loading?: boolean;
  /** Additional CSS classes */
  className?: string;
}

const pillColors: Record<string, string> = {
  success: 'bg-emerald-950/60 text-emerald-300 border-emerald-800/40',
  warning: 'bg-amber-950/60 text-amber-300 border-amber-800/40',
  danger: 'bg-rose-950/60 text-rose-300 border-rose-800/40',
  info: 'bg-cyan-950/60 text-cyan-300 border-cyan-800/40',
  purple: 'bg-purple-950/60 text-purple-300 border-purple-800/40',
  neutral: 'bg-slate-800 text-slate-400 border-slate-700',
};

export const KpiCard: React.FC<KpiCardProps> = ({
  label,
  value,
  unit,
  icon,
  variant = 'default',
  statusPill,
  sparkline,
  loading = false,
  className = '',
}) => {
  const colors = variantColors[variant];

  return (
    <div className={`bg-slate-950/70 border border-slate-800/70 hover:border-slate-700/80 transition-colors duration-150 p-3 rounded-lg flex flex-col justify-between ${className}`}>
      <span className="text-[10px] text-slate-400 flex items-center gap-1">
        {icon} {label}
      </span>
      <div className="mt-1 flex items-baseline justify-between">
        {loading ? (
          <div className="h-5 w-16 bg-slate-800/80 rounded animate-pulse my-0.5" />
        ) : (
          <div>
            <span className={`text-base font-bold font-mono ${colors.value}`}>
              {value}
            </span>
            {unit && (
              <span className="text-[10px] text-slate-400 ml-1">{unit}</span>
            )}
          </div>
        )}
        {!loading && statusPill && (
          <span className={`text-[9px] px-1.5 py-0.5 rounded border ${pillColors[statusPill.variant || 'neutral']}`}>
            {statusPill.text}
          </span>
        )}
      </div>
      {sparkline && (
        <div className="mt-2 h-8 w-full">
          {sparkline}
        </div>
      )}
    </div>
  );
};

export default KpiCard;

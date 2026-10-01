import React from 'react';

export type StatusVariant = 'operational' | 'warning' | 'danger' | 'optimizing' | 'neutral';

const statusConfig: Record<StatusVariant, { bg: string; text: string; dot: string; ping: string }> = {
  operational: {
    bg: 'bg-emerald-950/60 border-emerald-800/60',
    text: 'text-emerald-300',
    dot: 'bg-emerald-500',
    ping: 'bg-emerald-400',
  },
  warning: {
    bg: 'bg-amber-950/60 border-amber-800/60',
    text: 'text-amber-300',
    dot: 'bg-amber-500',
    ping: 'bg-amber-400',
  },
  danger: {
    bg: 'bg-rose-950/60 border-rose-800/60',
    text: 'text-rose-300',
    dot: 'bg-rose-500',
    ping: 'bg-rose-400',
  },
  optimizing: {
    bg: 'bg-purple-950/60 border-purple-800/60',
    text: 'text-purple-300',
    dot: 'bg-purple-500',
    ping: 'bg-purple-400',
  },
  neutral: {
    bg: 'bg-slate-800 border-slate-700',
    text: 'text-slate-400',
    dot: 'bg-slate-500',
    ping: 'bg-slate-400',
  },
};

interface StatusBadgeProps {
  /** Display text (e.g. "Operational", "Optimizing", "3 Incidents") */
  text: string;
  /** Visual variant */
  variant?: StatusVariant;
  /** Whether to show pulsing LED indicator */
  showPulse?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  text,
  variant = 'operational',
  showPulse = true,
  className = '',
}) => {
  const config = statusConfig[variant];

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${config.bg} ${config.text} ${className}`}>
      {showPulse && (
        <span className="relative flex h-2 w-2">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${config.ping} opacity-75`} />
          <span className={`relative inline-flex rounded-full h-2 w-2 ${config.dot}`} />
        </span>
      )}
      {text}
    </span>
  );
};

export default StatusBadge;

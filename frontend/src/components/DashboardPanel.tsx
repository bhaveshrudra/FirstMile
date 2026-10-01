import React from 'react';

interface DashboardPanelProps {
  /** Panel title text */
  title: string;
  /** Lucide icon component to render in the header */
  icon?: React.ReactNode;
  /** Optional badge element (e.g., algorithm name, status pill) */
  badge?: React.ReactNode;
  /** Optional subtitle / description text */
  subtitle?: string;
  /** Optional header-right action area */
  actions?: React.ReactNode;
  /** Additional CSS classes for the outer wrapper */
  className?: string;
  /** Whether to use compact padding */
  compact?: boolean;
  /** Whether to use transparent/floating style (for map overlays) */
  floating?: boolean;
  /** Panel content */
  children: React.ReactNode;
}

export const DashboardPanel: React.FC<DashboardPanelProps> = ({
  title,
  icon,
  badge,
  subtitle,
  actions,
  className = '',
  compact = false,
  floating = false,
  children,
}) => {
  const baseClasses = floating
    ? 'bg-slate-900/90 backdrop-blur-md border border-slate-800/90 shadow-2xl'
    : 'bg-slate-900/95 border border-slate-800 shadow-xl';

  const paddingClasses = compact ? 'p-3' : 'p-4';

  return (
    <div className={`${baseClasses} rounded-xl ${paddingClasses} transition-all duration-300 ${className}`}>
      {/* Panel Header */}
      <div className={`flex flex-wrap items-center justify-between gap-3 ${children ? 'border-b border-slate-800/80 pb-3 mb-3' : ''}`}>
        <div className="flex items-center gap-2.5">
          {icon && (
            <div className="p-1.5 bg-slate-800/80 border border-slate-700/50 rounded-lg">
              {icon}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-slate-100 tracking-wide uppercase">
                {title}
              </h3>
              {badge}
            </div>
            {subtitle && (
              <p className="text-[10px] text-slate-400 mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex items-center gap-2">
            {actions}
          </div>
        )}
      </div>

      {/* Panel Content */}
      {children}
    </div>
  );
};

export default DashboardPanel;

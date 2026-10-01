import React from 'react';

interface SectionHeaderProps {
  /** Section title text */
  title: string;
  /** Lucide icon element */
  icon?: React.ReactNode;
  /** Optional action buttons / controls on the right */
  actions?: React.ReactNode;
  /** Optional subtitle text */
  subtitle?: string;
  /** Additional CSS classes */
  className?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  icon,
  actions,
  subtitle,
  className = '',
}) => {
  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 mb-4 ${className}`}>
      <div className="flex items-center gap-2">
        {icon && (
          <span className="text-slate-400">{icon}</span>
        )}
        <div>
          <h3 className="text-sm font-bold text-slate-200 tracking-wide uppercase">
            {title}
          </h3>
          {subtitle && (
            <p className="text-[10px] text-slate-400 mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  );
};

export default SectionHeader;

import React from 'react';
import { 
  GitFork, Compass, Sliders, Award, BarChart2, 
  Database, FileText, Info, Clock, AlertTriangle
} from 'lucide-react';
import { StatusBadge, StatusVariant } from './StatusBadge';

export type NavigationTab = 'map' | 'optimize' | 'compare' | 'analytics' | 'experiment' | 'research';

interface HeaderProps {
  /** Active navigation tab */
  activeTab: NavigationTab;
  /** Tab change callback */
  onTabChange: (tab: NavigationTab) => void;
  /** Global loading state */
  loading?: boolean;
  /** Global error state */
  errorMessage?: string | null;
  /** Active traffic incidents count */
  activeIncidentsCount?: number;
  /** Current simulation hour (0-23.9) */
  hour?: number;
  /** Whether the current hour is peak traffic */
  isPeakHour?: boolean;
  /** Active demo scenario status text */
  demoStep?: string | null;
}

interface NavItem {
  id: NavigationTab;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { id: 'map', label: 'Map Page', icon: <Compass size={13} /> },
  { id: 'optimize', label: 'Run Solver', icon: <Sliders size={13} /> },
  { id: 'compare', label: 'Comparisons', icon: <Award size={13} /> },
  { id: 'analytics', label: 'Analytics', icon: <BarChart2 size={13} /> },
  { id: 'experiment', label: 'Scalability Lab', icon: <Database size={13} /> },
  { id: 'research', label: 'Research Mode', icon: <FileText size={13} /> },
];

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  loading = false,
  errorMessage = null,
  activeIncidentsCount = 0,
  hour = 12,
  isPeakHour = false,
  demoStep = null,
}) => {
  // Determine real system status
  let statusText = 'Operational';
  let statusVariant: StatusVariant = 'operational';

  if (loading) {
    statusText = 'Optimizing';
    statusVariant = 'optimizing';
  } else if (errorMessage) {
    statusText = 'Degraded';
    statusVariant = 'danger';
  } else if (activeIncidentsCount > 0) {
    statusText = `${activeIncidentsCount} Incident${activeIncidentsCount > 1 ? 's' : ''}`;
    statusVariant = 'warning';
  }

  const formattedHour = Math.floor(hour).toString().padStart(2, '0');

  return (
    <header className="bg-slate-900/95 border-b border-slate-800 px-3 sm:px-5 lg:px-6 py-2 sm:py-2.5 flex-shrink-0 z-30 transition-colors">
      <div className="flex items-center justify-between gap-2 sm:gap-3 max-w-[1920px] mx-auto flex-wrap lg:flex-nowrap">
        
        {/* Left: Product Identity & Branding */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 shadow-inner flex items-center justify-center">
            <GitFork size={20} className={loading ? 'animate-spin text-amber-400' : 'animate-pulse text-emerald-400'} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 font-mono text-[10px] font-bold tracking-wider">
                QPSO
              </span>
              <h1 className="text-sm sm:text-base font-bold text-slate-100 tracking-wide">
                Quantum-Inspired Traffic Optimization
              </h1>
            </div>
            <p className="text-[10px] text-slate-400 tracking-normal hidden md:block">
              Metaheuristic Transportation Routing & Exact Baselines Comparison (SIH Prototype)
            </p>
          </div>
        </div>

        {/* Dynamic Demo Scenario HUD (visible when demo is executing) */}
        {demoStep && (
          <div className="hidden lg:flex bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 text-xs px-3 py-1.5 rounded-lg items-center gap-2 animate-pulse shadow-sm font-mono">
            <Info size={13} className="text-emerald-400" />
            <span>{demoStep}</span>
          </div>
        )}

        {/* Center: Navigation Pill Tabs */}
        <nav 
          className="flex items-center gap-1 bg-slate-950/80 border border-slate-800/80 p-1 rounded-xl shadow-inner overflow-x-auto"
          aria-label="Application Navigation"
        >
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                type="button"
                title={item.label}
                aria-label={`Navigate to ${item.label}`}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-all duration-150 whitespace-nowrap active:scale-[0.97] cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/40 ${
                  isActive
                    ? 'bg-slate-800 border-slate-700 text-slate-100 shadow-sm font-semibold'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 font-normal'
                }`}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className={isActive ? 'text-emerald-400' : 'text-slate-500'}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right: Live System Status & Telemetry Indicators */}
        <div className="flex items-center gap-2.5">
          {/* Dynamic Clock Simulation Time Indicator */}
          <div className="hidden sm:flex items-center gap-1.5 bg-slate-950/70 border border-slate-800 px-2.5 py-1 rounded-lg text-slate-300 text-[11px] font-mono">
            <Clock size={12} className="text-purple-400" />
            <span>{formattedHour}:00</span>
            <span className={`text-[9px] px-1 py-0.2 rounded font-sans font-medium ${
              isPeakHour 
                ? 'bg-rose-950/80 text-rose-300 border border-rose-800/50' 
                : 'bg-slate-800 text-slate-400'
            }`}>
              {isPeakHour ? 'Peak' : 'Off-Pk'}
            </span>
          </div>

          {/* Active Incident Counter Pill (if any active) */}
          {activeIncidentsCount > 0 && (
            <div className="hidden md:flex items-center gap-1 bg-amber-950/40 border border-amber-800/60 px-2 py-1 rounded-lg text-[10px] text-amber-300 font-mono">
              <AlertTriangle size={11} className="text-amber-400" />
              <span>{activeIncidentsCount} active</span>
            </div>
          )}

          {/* Real System Status LED Badge */}
          <StatusBadge
            text={statusText}
            variant={statusVariant}
            showPulse={true}
          />
        </div>

      </div>
    </header>
  );
};

export default Header;

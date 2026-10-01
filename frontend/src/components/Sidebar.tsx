import React from 'react';

export type NavigationPath =
  | 'live-supply-chain'
  | 'disruption-analyser'
  | 'scenario-simulator'
  | 'performance-intelligence';

interface SidebarProps {
  currentPath: NavigationPath;
  onNavigate: (path: NavigationPath) => void;
  activeDisruptionsCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPath,
  onNavigate,
  activeDisruptionsCount,
}) => {
  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-white border-r border-slate-200 z-50 flex flex-col justify-between shadow-sm">
      <div className="flex flex-col flex-1 min-h-0">
        {/* Brand header */}
        <div className="h-14 px-gutter-md flex items-center gap-space-sm bg-slate-50 border-b border-slate-200">
          <div className="w-8 h-8 rounded bg-gradient-to-tr from-sky-700 to-sky-500 flex items-center justify-center text-white shadow-sm shrink-0">
            <span className="material-symbols-outlined text-[20px]">hub</span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-label-caps text-label-caps text-sky-700 font-bold tracking-wider truncate">
              FirstMile
            </span>
            <span className="font-data-mono-sm text-data-mono-sm text-slate-500 tracking-tight truncate">
              AetherTwin OS v4.2
            </span>
          </div>
        </div>

        {/* Control Tower Status Pill */}
        <div className="px-gutter-md py-space-sm">
          <div className="p-space-xs rounded bg-slate-100 border border-slate-200/80 flex items-center justify-between">
            <span className="font-label-caps text-label-caps text-slate-600 uppercase font-semibold">
              CONTROL TOWER
            </span>
            <span className="flex items-center gap-space-2xs font-data-mono-sm text-data-mono-sm text-emerald-700 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              ONLINE
            </span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-space-sm space-y-space-xs overflow-y-auto">
          {/* Live Supply Chain */}
          <button
            type="button"
            onClick={() => onNavigate('live-supply-chain')}
            className={`w-full group flex items-center justify-between px-space-md py-space-sm rounded transition-colors text-left ${
              currentPath === 'live-supply-chain'
                ? 'bg-sky-600 text-white font-headline-sm shadow-sm'
                : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <div className="flex items-center gap-space-sm min-w-0">
              <span
                className={`material-symbols-outlined text-[18px] ${
                  currentPath === 'live-supply-chain' ? 'text-white' : 'text-sky-600'
                }`}
              >
                hub
              </span>
              <span className="font-body-md text-body-md font-medium truncate">Live Supply Chain</span>
            </div>
            <span
              className={`font-label-caps text-label-caps px-space-xs py-space-2xs rounded font-semibold ${
                currentPath === 'live-supply-chain'
                  ? 'bg-sky-700/60 text-sky-100'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              GEO-3D
            </span>
          </button>

          {/* Disruption Analyser */}
          <button
            type="button"
            onClick={() => onNavigate('disruption-analyser')}
            className={`w-full group flex items-center justify-between px-space-md py-space-sm rounded transition-colors text-left ${
              currentPath === 'disruption-analyser'
                ? 'bg-sky-600 text-white font-headline-sm shadow-sm'
                : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <div className="flex items-center gap-space-sm min-w-0">
              <span
                className={`material-symbols-outlined text-[18px] ${
                  currentPath === 'disruption-analyser' ? 'text-white' : 'text-rose-600'
                }`}
              >
                warning
              </span>
              <span className="font-body-md text-body-md font-medium truncate">Disruption Analyser</span>
            </div>
            <span
              className={`font-label-caps text-label-caps px-space-xs py-space-2xs rounded font-bold border ${
                activeDisruptionsCount > 0
                  ? currentPath === 'disruption-analyser'
                    ? 'bg-rose-700 text-white border-rose-600'
                    : 'bg-rose-100 text-rose-700 border-rose-200'
                  : 'bg-slate-200 text-slate-700 border-slate-300'
              }`}
            >
              {activeDisruptionsCount} CRIT
            </span>
          </button>

          {/* Scenario Simulator */}
          <button
            type="button"
            onClick={() => onNavigate('scenario-simulator')}
            className={`w-full group flex items-center justify-between px-space-md py-space-sm rounded transition-colors text-left ${
              currentPath === 'scenario-simulator'
                ? 'bg-sky-600 text-white font-headline-sm shadow-sm'
                : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <div className="flex items-center gap-space-sm min-w-0">
              <span
                className={`material-symbols-outlined text-[18px] ${
                  currentPath === 'scenario-simulator' ? 'text-white' : 'text-sky-700'
                }`}
              >
                timeline
              </span>
              <span className="font-body-md text-body-md font-medium truncate">Scenario Simulator</span>
            </div>
            <span
              className={`font-label-caps text-label-caps px-space-xs py-space-2xs rounded ${
                currentPath === 'scenario-simulator'
                  ? 'bg-sky-700/60 text-sky-100'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              SIM-v2
            </span>
          </button>

          {/* Performance & Intelligence */}
          <button
            type="button"
            onClick={() => onNavigate('performance-intelligence')}
            className={`w-full group flex items-center justify-between px-space-md py-space-sm rounded transition-colors text-left ${
              currentPath === 'performance-intelligence'
                ? 'bg-sky-600 text-white font-headline-sm shadow-sm'
                : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <div className="flex items-center gap-space-sm min-w-0">
              <span
                className={`material-symbols-outlined text-[18px] ${
                  currentPath === 'performance-intelligence' ? 'text-white' : 'text-indigo-600'
                }`}
              >
                insights
              </span>
              <span className="font-body-md text-body-md font-medium truncate">{'Performance & Intelligence'}</span>
            </div>
            <span
              className={`font-label-caps text-label-caps px-space-xs py-space-2xs rounded ${
                currentPath === 'performance-intelligence'
                  ? 'bg-sky-700/60 text-sky-100'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              META
            </span>
          </button>
        </nav>
      </div>

      {/* Footer telemetry and profile */}
      <div className="p-space-md bg-slate-50 border-t border-slate-200 space-y-space-md">
        <div className="flex items-center justify-between p-space-xs rounded bg-white border border-slate-200 shadow-sm">
          <span className="font-label-caps text-label-caps text-emerald-700 font-bold flex items-center gap-space-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            99.4% TWIN SYNC
          </span>
          <span className="font-data-mono-sm text-data-mono-sm text-slate-500 font-medium">1.2s LAT</span>
        </div>

        <div className="flex items-center justify-between pt-space-xs">
          <div className="flex items-center gap-space-sm min-w-0">
            <div className="w-8 h-8 rounded-full bg-sky-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <span className="material-symbols-outlined text-[18px]">person</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-label-caps text-label-caps text-slate-900 font-bold truncate">OP-7740</span>
              <span className="font-data-mono-sm text-data-mono-sm text-slate-500 truncate">NATIONAL TOWER</span>
            </div>
          </div>

          <div className="relative flex items-center">
            <button
              type="button"
              aria-label="Notifications"
              className="p-space-xs rounded hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">notifications</span>
            </button>
            {activeDisruptionsCount > 0 && (
              <span className="absolute -top-1 -right-1 font-label-caps text-[9px] px-1 py-0 rounded-full bg-rose-600 text-white font-bold">
                {activeDisruptionsCount}
              </span>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
};

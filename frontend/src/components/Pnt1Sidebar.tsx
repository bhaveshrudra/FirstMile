import React from 'react';
import {
  Compass,
  Truck,
  GitBranch,
  Cpu,
  Layers,
} from 'lucide-react';

interface Pnt1SidebarProps {
  activeView: string;
  onSelectView: (view: string) => void;
  activeDisruptionsCount: number;
}

export const Pnt1Sidebar: React.FC<Pnt1SidebarProps> = ({
  activeView,
  onSelectView,
  activeDisruptionsCount,
}) => {
  const navItems = [
    {
      id: 'control-tower',
      label: 'Control Tower',
      icon: Compass,
      badge: activeDisruptionsCount > 0 ? `${activeDisruptionsCount} ALERT` : 'LIVE MAP',
    },
    {
      id: 'shipments',
      label: 'Consignments',
      icon: Truck,
      badge: '5 ACTIVE',
    },
    {
      id: 'network',
      label: 'Topology Graph',
      icon: GitBranch,
      badge: '16 NODES',
    },
    {
      id: 'solver',
      label: 'IQPSO Engine',
      icon: Cpu,
      badge: 'READY',
    },
  ];

  return (
    <aside className="w-56 bg-slate-900 text-white flex flex-col justify-between shrink-0 z-30 select-none border-r border-slate-800">
      <div className="flex flex-col">
        {/* Brand Bar */}
        <div className="h-14 px-4 flex items-center gap-2.5 border-b border-slate-800 bg-slate-950/40">
          <div className="w-7 h-7 rounded-lg bg-sky-500 text-white flex items-center justify-center font-bold shadow-sm">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-black tracking-wider uppercase text-white">
              PNT1 TWIN
            </div>
            <div className="text-[10px] text-slate-400 font-mono">v2.4 Autonomous</div>
          </div>
        </div>

        {/* Section title */}
        <div className="px-4 pt-4 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Operations
        </div>

        {/* Navigation Items */}
        <nav className="p-2 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectView(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-sky-600 text-white font-semibold shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span className="truncate">{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold ${
                      isActive
                        ? 'bg-sky-700 text-sky-100'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer System Status Card */}
      <div className="p-3 m-3 rounded-xl bg-slate-800/80 border border-slate-700/80 text-[11px] space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Twin Engine
          </span>
          <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-400 font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            CONNECTED
          </span>
        </div>
        <div className="text-[10px] text-slate-300 leading-tight">
          Multimodal Graph synced with SF Bay Area corridor.
        </div>
      </div>
    </aside>
  );
};

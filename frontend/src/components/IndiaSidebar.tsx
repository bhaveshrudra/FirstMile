import React from 'react';
import { Globe2, AlertTriangle, GitFork, BarChart3 } from 'lucide-react';

interface IndiaSidebarProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  disruptionsCount: number;
}

export const IndiaSidebar: React.FC<IndiaSidebarProps> = ({
  activeTab,
  onSelectTab,
  disruptionsCount,
}) => {
  const tabs = [
    { id: 'live-network', label: 'Live Network', icon: Globe2 },
    { id: 'disruptions', label: 'Disruptions', icon: AlertTriangle, badge: disruptionsCount },
    { id: 'simulator', label: 'Scenario Simulator', icon: GitFork },
    { id: 'performance', label: 'Performance', icon: BarChart3 },
  ];

  return (
    <aside className="w-52 bg-white border-r border-slate-200 flex flex-col shrink-0 select-none">
      <nav className="p-3 space-y-1.5 flex-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectTab(tab.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-sky-50 text-sky-700 font-bold shadow-2xs border border-sky-100'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2.5 truncate">
                <Icon
                  className={`w-4 h-4 ${
                    isActive ? 'text-sky-600' : 'text-slate-400'
                  }`}
                />
                <span className="truncate">{tab.label}</span>
              </div>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-rose-100 text-rose-700">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Engine Status at bottom */}
      <div className="p-3 border-t border-slate-100 m-2 rounded-xl bg-slate-50 text-[11px] space-y-1">
        <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase">
          <span>QML Optimizer</span>
          <span className="text-emerald-600 flex items-center gap-1 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            ACTIVE
          </span>
        </div>
        <div className="text-[10px] text-slate-500">
          Model synced with India National Highway dataset.
        </div>
      </div>
    </aside>
  );
};

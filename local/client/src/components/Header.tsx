import React, { useState, useEffect } from 'react';
import { RouteData } from '../types';
import { listRoutes, createRoute } from '../services/api';
import { Compass, Share2, Download, Plus, ChevronDown, CheckCircle2, ShieldCheck } from 'lucide-react';

interface HeaderProps {
  currentRoute: RouteData | null;
  syncStatus: 'connected' | 'syncing' | 'offline';
  onSwitchRoute: (routeId: string) => void;
  onExport: (format: 'csv' | 'json') => void;
  onShare: () => void;
  onNewRoute: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentRoute,
  syncStatus,
  onSwitchRoute,
  onExport,
  onShare,
  onNewRoute,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [routes, setRoutes] = useState<RouteData[]>([]);

  useEffect(() => {
    if (isMenuOpen) {
      listRoutes().then(setRoutes);
    }
  }, [isMenuOpen]);

  return (
    <header className="h-16 px-6 bg-aerospace-900/90 backdrop-blur-xl border-b border-cyan-500/15 flex items-center justify-between z-50 flex-shrink-0">
      {/* Brand & Mission Glyph */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-glow-cyan">
          <Compass className="w-5 h-5 text-aerospace-950 stroke-[2.5]" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-sans font-extrabold text-base tracking-tight text-white">RouteForge</span>
            <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-400/25">
              Aerospace
            </span>
          </div>
          <p className="text-[11px] text-slate-400 hidden sm:block">Multi-Stop Geospatial Optimizer</p>
        </div>
      </div>

      {/* Center Route Switcher Pill */}
      <div className="relative">
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-aerospace-850/80 hover:bg-aerospace-800 border border-cyan-500/25 hover:border-cyan-400/40 text-slate-200 transition-all shadow-aerospace"
        >
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
          <span className="text-xs font-semibold max-w-[180px] sm:max-w-[260px] truncate text-slate-100">
            {currentRoute?.title || 'Loading Route...'}
          </span>
          <ChevronDown className={`w-3.5 h-3.5 text-cyan-400/70 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Dropdown Menu */}
        {isMenuOpen && (
          <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 w-80 bg-aerospace-900 border border-cyan-500/30 rounded-2xl p-2 shadow-2xl backdrop-blur-2xl z-50">
            <div className="flex items-center justify-between px-3 py-2 border-b border-cyan-500/15">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">Mission Runs</span>
              <button
                onClick={() => { setIsMenuOpen(false); onNewRoute(); }}
                className="flex items-center gap-1 text-[11px] font-semibold text-cyan-400 hover:text-cyan-300"
              >
                <Plus className="w-3.5 h-3.5" /> New Route
              </button>
            </div>
            <div className="max-h-60 overflow-y-auto py-1 space-y-1">
              {routes.map(r => (
                <button
                  key={r.routeId}
                  onClick={() => { onSwitchRoute(r.routeId); setIsMenuOpen(false); }}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-colors ${
                    r.routeId === currentRoute?.routeId
                      ? 'bg-cyan-500/20 text-cyan-200 font-semibold border border-cyan-400/30'
                      : 'text-slate-300 hover:bg-aerospace-800/80'
                  }`}
                >
                  <span className="truncate">{r.title}</span>
                  {r.routeId === currentRoute?.routeId && <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Sync Status Badge */}
        <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full bg-aerospace-850 border border-slate-700/60 text-xs text-slate-300">
          <span
            className={`w-2 h-2 rounded-full ${
              syncStatus === 'connected' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]' :
              syncStatus === 'syncing' ? 'bg-amber-400 animate-ping' : 'bg-rose-500'
            }`}
          />
          <span className="capitalize text-[11px] font-medium">{syncStatus}</span>
        </div>

        <button
          onClick={onShare}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-aerospace-850 hover:bg-aerospace-800 border border-slate-700/60 text-xs text-slate-300 hover:text-white transition-all"
          title="Share Route Link"
        >
          <Share2 className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden sm:inline">Share</span>
        </button>

        <button
          onClick={() => onExport('csv')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-aerospace-850 hover:bg-aerospace-800 border border-slate-700/60 text-xs text-slate-300 hover:text-white transition-all"
          title="Export CSV"
        >
          <Download className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden sm:inline">Export</span>
        </button>

        <button
          onClick={onNewRoute}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-aerospace-950 font-bold text-xs shadow-glow-cyan transition-all"
        >
          <Plus className="w-3.5 h-3.5 stroke-[3]" />
          <span className="hidden sm:inline">New Run</span>
        </button>
      </div>
    </header>
  );
};


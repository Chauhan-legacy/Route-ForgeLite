import React, { useState, useEffect } from 'react';
import { RouteData } from '../types';
import { listRoutes } from '../services/api';
import { MapPin, Share2, Download, Plus, ChevronDown, Check, Globe } from 'lucide-react';

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
    <header className="h-16 px-6 sm:px-8 bg-editorial-surface border-b border-editorial-border flex items-center justify-between z-50 flex-shrink-0">
      {/* Brand & Editorial Title */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-editorial-ink text-editorial-bg flex items-center justify-center shadow-subtle">
          <MapPin className="w-4 h-4" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-serif text-xl font-medium tracking-tight text-editorial-ink">
            RouteForge
          </span>
          <span className="text-[10px] font-mono tracking-widest uppercase text-editorial-subtle px-1.5 py-0.5 rounded bg-editorial-muted border border-editorial-border">
            Optimizer
          </span>
        </div>
      </div>

      {/* Center Route Switcher */}
      <div className="relative">
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-editorial-subsurface hover:bg-editorial-muted border border-editorial-border text-editorial-ink text-xs font-medium transition-colors shadow-subtle"
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              syncStatus === 'connected' ? 'bg-emerald-600' :
              syncStatus === 'syncing' ? 'bg-amber-600 animate-pulse' : 'bg-rose-500'
            }`}
          />
          <span className="max-w-[180px] sm:max-w-[260px] truncate">
            {currentRoute?.title || 'Route'}
          </span>
          <ChevronDown className={`w-3.5 h-3.5 text-editorial-subtle transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Dropdown Menu */}
        {isMenuOpen && (
          <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 w-80 bg-editorial-surface border border-editorial-border rounded-2xl p-2 shadow-float z-50 animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between px-3 py-2 border-b border-editorial-border/60">
              <span className="text-[11px] font-mono uppercase tracking-wider text-editorial-subtle">Saved Routes</span>
              <button
                onClick={() => { setIsMenuOpen(false); onNewRoute(); }}
                className="flex items-center gap-1 text-[11px] font-semibold text-editorial-ink hover:text-black"
              >
                <Plus className="w-3.5 h-3.5" /> New
              </button>
            </div>
            <div className="max-h-60 overflow-y-auto py-1 space-y-0.5">
              {routes.map(r => (
                <button
                  key={r.routeId}
                  onClick={() => { onSwitchRoute(r.routeId); setIsMenuOpen(false); }}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-colors ${
                    r.routeId === currentRoute?.routeId
                      ? 'bg-editorial-subsurface text-editorial-ink font-semibold border border-editorial-border'
                      : 'text-editorial-body hover:bg-editorial-subsurface'
                  }`}
                >
                  <span className="truncate">{r.title}</span>
                  {r.routeId === currentRoute?.routeId && <Check className="w-3.5 h-3.5 text-editorial-ink flex-shrink-0" />}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Action Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={onShare}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-editorial-surface hover:bg-editorial-subsurface border border-editorial-border text-xs text-editorial-body hover:text-editorial-ink transition-colors shadow-subtle"
          title="Copy Route URL"
        >
          <Share2 className="w-3.5 h-3.5 text-editorial-subtle" />
          <span>Share</span>
        </button>

        <button
          onClick={() => onExport('csv')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-editorial-surface hover:bg-editorial-subsurface border border-editorial-border text-xs text-editorial-body hover:text-editorial-ink transition-colors shadow-subtle"
          title="Export CSV"
        >
          <Download className="w-3.5 h-3.5 text-editorial-subtle" />
          <span className="hidden sm:inline">Export</span>
        </button>

        <button
          onClick={onNewRoute}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-editorial-ink hover:bg-editorial-accent-hover text-editorial-bg text-xs font-medium transition-colors shadow-subtle"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Route</span>
        </button>
      </div>
    </header>
  );
};

export default Header;

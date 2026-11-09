import React, { useState, useEffect } from 'react';
import { RouteData } from '../types';
import { listRoutes } from '../services/api';
import { MapPin, Share2, Download, Plus, ChevronDown, Check, Compass, Trash2 } from 'lucide-react';

interface HeaderProps {
  currentRoute: RouteData | null;
  syncStatus: 'connected' | 'syncing' | 'offline';
  onSwitchRoute: (routeId: string) => void;
  onExport: (format: 'csv' | 'json') => void;
  onShare: () => void;
  onNewRoute: () => void;
  onDeleteRoute?: (routeId: string) => Promise<void>;
  onBackToLanding?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentRoute,
  syncStatus,
  onSwitchRoute,
  onExport,
  onShare,
  onNewRoute,
  onDeleteRoute,
  onBackToLanding,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [routes, setRoutes] = useState<RouteData[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (isMenuOpen) {
      listRoutes().then(setRoutes);
    }
  }, [isMenuOpen]);

  const handleDelete = async (e: React.MouseEvent, routeId: string) => {
    e.stopPropagation();
    if (deletingId) return;
    setDeletingId(routeId);
    try {
      if (onDeleteRoute) {
        await onDeleteRoute(routeId);
      }
      setRoutes(prev => prev.filter(r => r.routeId !== routeId));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <header className="h-16 px-6 sm:px-8 bg-editorial-surface border-b border-editorial-border flex items-center justify-between z-50 flex-shrink-0">
      {/* Brand & Editorial Title */}
      <div
        className="flex items-center gap-3 cursor-pointer group"
        onClick={onBackToLanding}
        title="Return to Overview / Landing Page"
      >
        <div className="w-8 h-8 rounded-full bg-editorial-ink text-editorial-bg flex items-center justify-center shadow-subtle group-hover:scale-105 transition-transform">
          <MapPin className="w-4 h-4" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-serif text-xl font-medium tracking-tight text-editorial-ink group-hover:text-black transition-colors">
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
            <div className="max-h-64 overflow-y-auto py-1 space-y-1">
              {routes.length === 0 ? (
                <div className="p-3 text-center text-xs text-editorial-subtle">No saved routes</div>
              ) : (
                routes.map(r => {
                  const isActive = r.routeId === currentRoute?.routeId;
                  const isDeleting = deletingId === r.routeId;
                  return (
                    <div
                      key={r.routeId}
                      onClick={() => { onSwitchRoute(r.routeId); setIsMenuOpen(false); }}
                      className={`group w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-editorial-subsurface text-editorial-ink font-semibold border border-editorial-border'
                          : 'text-editorial-body hover:bg-editorial-subsurface'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                        {isActive && <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />}
                        <span className="truncate">{r.title || 'Untitled Route'}</span>
                      </div>
                      
                      <button
                        type="button"
                        onClick={(e) => handleDelete(e, r.routeId)}
                        disabled={isDeleting}
                        className="opacity-40 group-hover:opacity-100 p-1 rounded-lg text-editorial-subtle hover:text-rose-600 hover:bg-rose-50 transition-all flex-shrink-0"
                        title="Delete saved route"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Action Controls */}
      <div className="flex items-center gap-2">
        {onBackToLanding && (
          <button
            onClick={onBackToLanding}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-editorial-surface hover:bg-editorial-subsurface border border-editorial-border text-xs text-editorial-body hover:text-editorial-ink transition-colors shadow-subtle"
            title="Overview & Benchmarks"
          >
            <Compass className="w-3.5 h-3.5 text-editorial-subtle" />
            <span className="hidden sm:inline">Overview</span>
          </button>
        )}

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

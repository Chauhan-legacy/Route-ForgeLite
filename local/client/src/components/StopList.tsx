import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Stop, OptimizationResult, Maneuver } from '../types';
import { Lock, Unlock, ArrowUp, ArrowDown, Trash2, Edit3, RotateCcw, UploadCloud, Zap, MapPin, Search, Navigation, Building2, Map as MapIcon, Compass, X, ChevronDown, ChevronRight, Activity, SlidersHorizontal, Target } from 'lucide-react';
import { searchLocations } from '../services/api';
import { GeocodeSuggestion, parseDirectCoordinates } from '../services/geocodingService';

interface StopListProps {
  stops: Stop[];
  onAddStop: (address: string, name?: string, lat?: number | null, lng?: number | null, metadata?: any) => Promise<void>;
  onToggleLock: (stopId: string) => void;
  onMoveStop: (index: number, direction: number) => void;
  onDeleteStop: (stopId: string) => void;
  onEditStop: (stopId: string) => void;
  onOptimize: () => void;
  onQuickOptimize?: () => void;
  onReverse: () => void;
  onOpenImport: () => void;
  isSaving: boolean;
  mapCenter?: { lat: number; lng: number };
  optimizationResult?: OptimizationResult | null;
  canRevert?: boolean;
  onRevertOptimization?: () => void;
  onDismissOptimization?: () => void;
  onOpenAnalytics?: () => void;
  maneuvers?: Maneuver[];
  onClearAll?: () => void;
  isPinpointMode?: boolean;
  onTogglePinpointMode?: () => void;
}

export const StopList: React.FC<StopListProps> = ({
  stops,
  onAddStop,
  onToggleLock,
  onMoveStop,
  onDeleteStop,
  onEditStop,
  onOptimize,
  onQuickOptimize,
  onReverse,
  onOpenImport,
  isSaving,
  mapCenter,
  optimizationResult,
  canRevert,
  onRevertOptimization,
  onDismissOptimization,
  onOpenAnalytics,
  maneuvers = [],
  onClearAll,
  isPinpointMode,
  onTogglePinpointMode,
}) => {
  const [inputVal, setInputVal] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [showManeuvers, setShowManeuvers] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<any>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search query
  useEffect(() => {
    const trimmed = inputVal.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      setIsLoadingSuggestions(true);
      try {
        const results = await searchLocations(trimmed, mapCenter);
        setSuggestions(results);
        setIsOpen(results.length > 0);
        setSelectedIndex(-1);
      } catch (err) {
        console.warn('Autocomplete fetch error:', err);
      } finally {
        setIsLoadingSuggestions(false);
      }
    }, 220);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [inputVal, mapCenter]);

  // Handle selecting a suggestion
  const handleSelectSuggestion = useCallback(async (s: GeocodeSuggestion) => {
    setIsOpen(false);
    setInputVal('');
    setIsAdding(true);
    try {
      await onAddStop(
        s.subtitle ? `${s.title}, ${s.subtitle}` : s.title,
        s.title,
        s.lat,
        s.lng,
        {
          precision: s.precision,
          category: s.category,
          provider: s.provider,
          displayName: s.subtitle ? `${s.title}, ${s.subtitle}` : s.title,
        }
      );
    } finally {
      setIsAdding(false);
    }
  }, [onAddStop]);

  // Form submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim() || isAdding) return;

    // If an item in the dropdown is highlighted, pick it
    if (isOpen && selectedIndex >= 0 && selectedIndex < suggestions.length) {
      await handleSelectSuggestion(suggestions[selectedIndex]);
      return;
    }

    // Check direct coordinate / URL parser first
    const directCoord = parseDirectCoordinates(inputVal.trim());
    if (directCoord) {
      await handleSelectSuggestion(directCoord);
      return;
    }

    // If suggestions are available, pick top one
    if (suggestions.length > 0) {
      await handleSelectSuggestion(suggestions[0]);
      return;
    }

    // Regular fallback add
    const addr = inputVal.trim();
    setInputVal('');
    setIsOpen(false);
    setIsAdding(true);
    try {
      await onAddStop(addr);
    } finally {
      setIsAdding(false);
    }
  };

  // Keyboard navigation for dropdown
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div className="w-full lg:w-[420px] flex flex-col bg-editorial-surface border-r border-editorial-border h-full overflow-hidden flex-shrink-0">
      {/* Search & Add Input Box */}
      <div className="p-4 border-b border-editorial-border bg-editorial-surface flex flex-col gap-3 relative" ref={containerRef}>
        <form onSubmit={handleSubmit} className="relative flex items-center">
          <Search className="absolute left-3.5 w-4 h-4 text-editorial-subtle pointer-events-none" />
          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (suggestions.length > 0) setIsOpen(true);
            }}
            placeholder="Search address, landmark, or paste lat,lng..."
            className="w-full h-10 pl-10 pr-20 rounded-xl bg-editorial-subsurface border border-editorial-border focus:border-editorial-ink text-xs text-editorial-ink placeholder-editorial-subtle outline-none transition-colors shadow-subtle"
            disabled={isSaving || isAdding}
          />
          <button
            type="submit"
            disabled={!inputVal.trim() || isSaving || isAdding}
            className="absolute right-1.5 h-7 px-3 rounded-lg bg-editorial-ink hover:bg-editorial-accent-hover text-editorial-bg text-xs font-medium flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isAdding ? 'Adding...' : 'Add'}
          </button>
        </form>

        {/* Real-time Photon Autocomplete Dropdown */}
        {isOpen && suggestions.length > 0 && (
          <div className="absolute top-[56px] left-4 right-4 bg-white border border-editorial-border rounded-xl shadow-card z-50 overflow-hidden flex flex-col animate-in fade-in duration-100 max-h-[310px] overflow-y-auto">
            <div className="px-3 py-1.5 bg-editorial-subsurface border-b border-editorial-border flex items-center justify-between text-[10px] text-editorial-subtle uppercase tracking-wider font-semibold">
              <span>High Precision Suggestions</span>
              <span className="text-emerald-700 font-normal lowercase">Photon OSM</span>
            </div>

            {suggestions.map((s, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={s.id}
                  onClick={() => handleSelectSuggestion(s)}
                  className={`p-2.5 cursor-pointer border-b border-editorial-border/60 flex items-start gap-2.5 transition-colors ${
                    isSelected ? 'bg-editorial-subsurface' : 'hover:bg-editorial-subsurface/70 bg-white'
                  }`}
                >
                  <div className="w-6 h-6 rounded-md bg-editorial-subsurface border border-editorial-border text-editorial-ink flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                    {s.category === 'coordinate' ? (
                      <Compass className="w-3.5 h-3.5 text-purple-700" />
                    ) : s.category === 'building' ? (
                      <Building2 className="w-3.5 h-3.5 text-blue-700" />
                    ) : (
                      <MapPin className="w-3.5 h-3.5 text-emerald-700" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-semibold text-editorial-ink truncate">{s.title}</span>
                      <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono uppercase font-semibold ${
                        s.category === 'coordinate' ? 'bg-purple-100 text-purple-800' :
                        s.category === 'building' ? 'bg-blue-100 text-blue-800' :
                        'bg-emerald-100 text-emerald-800'
                      }`}>
                        {s.category}
                      </span>
                    </div>
                    <p className="text-[11px] text-editorial-subtle truncate mt-0.5">{s.subtitle}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-editorial-subtle font-mono">
                      <span>{s.lat.toFixed(4)}°, {s.lng.toFixed(4)}°</span>
                      {s.distanceMeters != null && (
                        <span>&bull; {s.distanceMeters > 1000 ? `${(s.distanceMeters / 1000).toFixed(1)} km` : `${s.distanceMeters} m`}</span>
                      )}
                      {s.precision === 'sub-meter' && (
                        <span className="text-emerald-700 font-sans font-medium">&bull; Sub-meter</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Action Toolbar */}
        <div className="flex flex-col gap-2">
          {/* Primary Row: Optimize Tour & Constraints */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (onQuickOptimize) {
                  onQuickOptimize();
                } else {
                  onOptimize();
                }
              }}
              disabled={isSaving}
              className={`flex-1 flex items-center justify-center gap-2 h-9 px-4 rounded-xl font-medium text-xs transition-all shadow-subtle whitespace-nowrap ${
                stops.length < 3
                  ? 'bg-editorial-subsurface hover:bg-editorial-muted text-editorial-body border border-editorial-border cursor-pointer'
                  : 'bg-editorial-ink hover:bg-black text-editorial-bg cursor-pointer shadow-md'
              }`}
              title={stops.length < 3 ? `Add ${3 - stops.length} more waypoint(s) to optimize tour` : 'Optimize tour sequence now (1-click OR-Tools)'}
            >
              <Zap className={`w-3.5 h-3.5 flex-shrink-0 ${stops.length < 3 ? 'text-amber-600' : 'text-amber-400'}`} />
              <span className="font-semibold truncate">
                {stops.length < 3 ? `Optimize (${stops.length}/3)` : 'Optimize Tour'}
              </span>
              {stops.length >= 3 && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/20 text-white font-bold ml-1">
                  1-Click
                </span>
              )}
            </button>

            <button
              onClick={onOptimize}
              disabled={isSaving}
              className="w-9 h-9 rounded-xl bg-editorial-surface hover:bg-editorial-subsurface border border-editorial-border text-editorial-body flex items-center justify-center transition-colors shadow-subtle flex-shrink-0"
              title="Optimization Constraints & Settings"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-editorial-subtle" />
            </button>
          </div>

          {/* Secondary Row: Pinpoint, Import, Reverse, Clear */}
          <div className="flex items-center gap-1.5">
            {onTogglePinpointMode && (
              <button
                type="button"
                onClick={onTogglePinpointMode}
                className={`flex-1 flex items-center justify-center gap-1.5 h-8 px-2.5 rounded-xl border text-xs font-medium transition-all shadow-subtle ${
                  isPinpointMode
                    ? 'bg-rose-600 text-white border-rose-700 shadow-sm font-semibold'
                    : 'bg-editorial-surface hover:bg-editorial-subsurface border-editorial-border text-editorial-body'
                }`}
                title={isPinpointMode ? 'Crosshair active: Click anywhere on map to drop pin' : 'Click to drop pin on map'}
              >
                <Target className={`w-3.5 h-3.5 flex-shrink-0 ${isPinpointMode ? 'text-white animate-spin' : 'text-rose-600'}`} />
                <span>{isPinpointMode ? 'Click Map...' : 'Drop Pin'}</span>
              </button>
            )}

            <button
              onClick={onOpenImport}
              className="flex-1 flex items-center justify-center gap-1.5 h-8 px-2.5 rounded-xl bg-editorial-surface hover:bg-editorial-subsurface border border-editorial-border text-xs font-medium text-editorial-body transition-colors shadow-subtle"
              title="Import addresses or CSV"
            >
              <UploadCloud className="w-3.5 h-3.5 text-editorial-subtle flex-shrink-0" />
              <span>Import</span>
            </button>

            <button
              onClick={onReverse}
              disabled={stops.length < 2 || isSaving}
              className="w-8 h-8 rounded-xl bg-editorial-surface hover:bg-editorial-subsurface border border-editorial-border text-editorial-body flex items-center justify-center transition-colors disabled:opacity-40 shadow-subtle flex-shrink-0"
              title="Reverse Route Sequence"
            >
              <RotateCcw className="w-3.5 h-3.5 text-editorial-subtle" />
            </button>

            {onClearAll && stops.length > 0 && (
              <button
                onClick={onClearAll}
                disabled={isSaving}
                className="w-8 h-8 rounded-xl bg-editorial-surface hover:bg-rose-50 border border-editorial-border hover:border-rose-200 text-editorial-body hover:text-rose-600 flex items-center justify-center transition-colors shadow-subtle flex-shrink-0"
                title="Clear all waypoints (Start fresh with a clean map)"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Native Optimization Before/After Comparison Card */}
        {optimizationResult && (
          <div className="p-3 rounded-xl bg-editorial-subsurface border border-editorial-border flex flex-col gap-2 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${optimizationResult.isAlreadyOptimal ? 'bg-amber-500' : 'bg-emerald-600'}`} />
                <span className="text-xs font-semibold text-editorial-ink">
                  {optimizationResult.isAlreadyOptimal ? 'Route Already Optimal' : 'Tour Optimized'}
                </span>
              </div>
              {onDismissOptimization && (
                <button
                  onClick={onDismissOptimization}
                  className="text-editorial-subtle hover:text-editorial-ink text-xs p-0.5 rounded"
                  title="Dismiss comparison"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {optimizationResult.isAlreadyOptimal ? (
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-editorial-subtle">
                  The current stop sequence is already at minimum distance.
                </p>
                {onOpenAnalytics && (
                  <button
                    onClick={onOpenAnalytics}
                    className="px-2 py-0.5 rounded-lg bg-editorial-surface hover:bg-editorial-subsurface border border-editorial-border text-[10px] font-medium text-emerald-800 flex items-center gap-1 transition-colors ml-2 flex-shrink-0"
                    title="View computational diagnostics"
                  >
                    <Activity className="w-3 h-3 text-emerald-600" />
                    <span>Audit</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-editorial-subtle">
                    {(optimizationResult.originalDistanceMeters / 1000).toFixed(1)} km &rarr;{' '}
                    <strong className="text-emerald-700">{(optimizationResult.optimizedDistanceMeters / 1000).toFixed(1)} km</strong>
                  </span>
                  <span className="font-mono font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200 text-[10px]">
                    -{optimizationResult.savingsPercent}% (-{(optimizationResult.savingsMeters / 1000).toFixed(1)} km)
                  </span>
                </div>
                <div className="flex items-center justify-end gap-2 pt-1 border-t border-editorial-border/60">
                  {onOpenAnalytics && (
                    <button
                      onClick={onOpenAnalytics}
                      className="px-2.5 py-1 rounded-lg bg-editorial-surface hover:bg-editorial-subsurface border border-editorial-border text-[11px] font-medium text-emerald-800 flex items-center gap-1 transition-colors shadow-subtle"
                      title="Inspect computational audit and savings analytics"
                    >
                      <Activity className="w-3 h-3 text-emerald-600" />
                      <span>Analytics</span>
                    </button>
                  )}
                  {canRevert && onRevertOptimization && (
                    <button
                      onClick={onRevertOptimization}
                      className="px-2.5 py-1 rounded-lg bg-editorial-surface hover:bg-editorial-subsurface border border-editorial-border text-[11px] font-medium text-editorial-body flex items-center gap-1 transition-colors shadow-subtle"
                      title="Undo optimization and restore original waypoint order"
                    >
                      <RotateCcw className="w-3 h-3 text-editorial-subtle" />
                      <span>Revert Order</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Stops Sequence Deck */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {stops.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-editorial-subtle">
            <div className="w-12 h-12 rounded-full bg-editorial-surface border border-editorial-border shadow-subtle flex items-center justify-center mb-3 text-editorial-ink">
              <MapPin className="w-5 h-5 text-editorial-subtle" />
            </div>
            <h4 className="font-serif text-base font-medium text-editorial-ink">Clean Map Ready</h4>
            <p className="text-xs text-editorial-subtle mt-1.5 max-w-[240px] leading-relaxed">
              No waypoints plotted. Search an address or coordinate above to place your first stop.
            </p>
          </div>
        ) : (
          stops.map((stop, idx) => {
            const isFirst = idx === 0;
            const isLast = idx === stops.length - 1 && stops.length > 1;
            const isLocked = !!stop.metadata?.locked;
            const precision = stop.metadata?.precision || (stop.latitude != null ? 'verified' : 'approximate');
            const lat = stop.lat ?? stop.latitude;
            const lng = stop.lng ?? stop.longitude;

            return (
              <div
                key={stop.stopId}
                className={`p-3 rounded-xl border transition-colors flex items-center gap-3 ${
                  isLocked
                    ? 'bg-amber-50/60 border-amber-300'
                    : isFirst
                    ? 'bg-emerald-50/30 border-emerald-200'
                    : isLast
                    ? 'bg-blue-50/30 border-blue-200'
                    : 'bg-editorial-surface hover:bg-editorial-subsurface border-editorial-border shadow-subtle'
                }`}
              >
                {/* Sequence Badge */}
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-mono font-medium flex-shrink-0 ${
                    isFirst
                      ? 'bg-emerald-700 text-white'
                      : isLast
                      ? 'bg-blue-700 text-white'
                      : isLocked
                      ? 'bg-amber-200 text-amber-900 border border-amber-300'
                      : 'bg-editorial-subsurface text-editorial-ink border border-editorial-border'
                  }`}
                >
                  {String(idx + 1).padStart(2, '0')}
                </div>

                {/* Stop Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-xs text-editorial-ink truncate">{stop.name}</span>
                    {isFirst && (
                      <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-bold">
                        Origin
                      </span>
                    )}
                    {isLast && (
                      <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 font-bold">
                        Destination
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-editorial-subtle truncate mt-0.5">{stop.address}</p>

                  {/* Geolocation telemetry & precision badge */}
                  <div className="flex items-center gap-1.5 mt-1 text-[10px]">
                    {lat != null && lng != null ? (
                      <span className="font-mono text-editorial-subtle">
                        {lat.toFixed(4)}°, {lng.toFixed(4)}°
                      </span>
                    ) : (
                      <span className="text-rose-700 font-medium">Unresolved</span>
                    )}

                    <span className="text-editorial-border">&bull;</span>

                    {precision === 'sub-meter' ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                        Sub-meter Pin
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-blue-700 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                        Verified
                      </span>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => onToggleLock(stop.stopId)}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                      isLocked ? 'text-amber-800 bg-amber-200/80' : 'text-editorial-subtle hover:text-editorial-ink hover:bg-editorial-muted'
                    }`}
                    title={isLocked ? 'Unlock waypoint' : 'Lock waypoint sequence'}
                  >
                    {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                  </button>

                  <button
                    onClick={() => onEditStop(stop.stopId)}
                    className="w-7 h-7 rounded-lg text-editorial-subtle hover:text-editorial-ink hover:bg-editorial-muted flex items-center justify-center"
                    title="Edit address"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => onMoveStop(idx, -1)}
                    disabled={idx === 0}
                    className="w-7 h-7 rounded-lg text-editorial-subtle hover:text-editorial-ink hover:bg-editorial-muted disabled:opacity-20 flex items-center justify-center"
                    title="Move up"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => onMoveStop(idx, 1)}
                    disabled={idx === stops.length - 1}
                    className="w-7 h-7 rounded-lg text-editorial-subtle hover:text-editorial-ink hover:bg-editorial-muted disabled:opacity-20 flex items-center justify-center"
                    title="Move down"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => onDeleteStop(stop.stopId)}
                    className="w-7 h-7 rounded-lg text-editorial-subtle hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center"
                    title="Remove waypoint"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Collapsible Turn-by-Turn Guidance Drawer */}
      {maneuvers && maneuvers.length > 0 && (
        <div className="border-t border-editorial-border bg-editorial-surface flex flex-col flex-shrink-0">
          <button
            onClick={() => setShowManeuvers(prev => !prev)}
            className="p-3 flex items-center justify-between text-xs font-semibold text-editorial-ink hover:bg-editorial-subsurface transition-colors"
          >
            <div className="flex items-center gap-1.5">
              <Navigation className="w-3.5 h-3.5 text-editorial-subtle" />
              <span>Turn-by-Turn Guidance ({maneuvers.length} steps)</span>
            </div>
            {showManeuvers ? (
              <ChevronDown className="w-3.5 h-3.5 text-editorial-subtle" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-editorial-subtle" />
            )}
          </button>
          {showManeuvers && (
            <div className="max-h-[170px] overflow-y-auto px-3 pb-3 space-y-1 text-[11px]">
              {maneuvers.map((m, mIdx) => (
                <div key={mIdx} className="p-2 rounded-lg bg-editorial-subsurface border border-editorial-border flex items-start gap-2">
                  <span className="mono text-[10px] text-editorial-subtle font-semibold mt-0.5">{mIdx + 1}.</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-editorial-ink font-medium leading-tight">{m.instruction}</p>
                    <p className="text-[10px] text-editorial-subtle font-mono mt-0.5">
                      {m.distanceMeters > 1000 ? `${(m.distanceMeters / 1000).toFixed(1)} km` : `${m.distanceMeters} m`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StopList;

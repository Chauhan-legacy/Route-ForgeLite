import React from 'react';
import { RouteSummary, TransportMode, OptimizationResult } from '../types';
import { Car, Bike, Footprints, Info } from 'lucide-react';

interface MetricsBarProps {
  summary: RouteSummary;
  optimizationResult: OptimizationResult | null;
  stopCount: number;
  lockedCount: number;
  onModeChange: (mode: TransportMode) => void;
}

export const MetricsBar: React.FC<MetricsBarProps> = ({
  summary,
  optimizationResult,
  stopCount,
  lockedCount,
  onModeChange,
}) => {
  const formatDistance = (meters: number) => {
    if (!meters || meters <= 0) return '0.0 km';
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(1)} km`;
  };

  const formatDuration = (seconds: number) => {
    if (!seconds || seconds <= 0) return '0 min';
    const mins = Math.round(seconds / 60);
    if (mins < 60) return `${mins} min`;
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hrs}h ${remMins}m`;
  };

  return (
    <div className="px-6 sm:px-8 py-3.5 bg-editorial-bg border-b border-editorial-border flex flex-col gap-3 flex-shrink-0">
      {/* 4 Clean Editorial Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Metric 1: Distance */}
        <div className="p-3.5 rounded-2xl bg-editorial-surface border border-editorial-border shadow-card flex flex-col gap-0.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-editorial-subtle">Distance</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-editorial-subsurface border border-editorial-border text-editorial-subtle">
              {summary.provider === 'osrm' ? 'Road Network' : 'Direct Line'}
            </span>
          </div>
          <div className="text-xl font-semibold font-serif text-editorial-ink tracking-tight mt-0.5">
            {formatDistance(summary.totalDistanceMeters)}
          </div>
          <span className="text-[10px] text-editorial-subtle">
            {summary.isFallback ? 'Straight-line estimation' : 'Calculated vector geometry'}
          </span>
        </div>

        {/* Metric 2: Estimated Duration */}
        <div className="p-3.5 rounded-2xl bg-editorial-surface border border-editorial-border shadow-card flex flex-col gap-0.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-editorial-subtle">Estimated Time</span>
            <span className="text-[10px] font-mono capitalize px-1.5 py-0.5 rounded bg-editorial-subsurface border border-editorial-border text-editorial-subtle">
              {summary.mode}
            </span>
          </div>
          <div className="text-xl font-semibold font-serif text-editorial-ink tracking-tight mt-0.5">
            {formatDuration(summary.totalDurationSeconds)}
          </div>
          <span className="text-[10px] text-editorial-subtle">Based on transit profile</span>
        </div>

        {/* Metric 3: Optimization Efficiency */}
        <div className="p-3.5 rounded-2xl bg-editorial-surface border border-editorial-border shadow-card flex flex-col gap-0.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-editorial-subtle">Efficiency Gain</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800">
              {optimizationResult && optimizationResult.savingsPercent > 0 ? `${optimizationResult.savingsPercent}% Saved` : 'Original'}
            </span>
          </div>
          <div className="text-xl font-semibold font-serif text-editorial-ink tracking-tight mt-0.5">
            {optimizationResult && optimizationResult.savingsPercent > 0
              ? `+${optimizationResult.savingsPercent}%`
              : '0.0%'}
          </div>
          <span className="text-[10px] text-editorial-subtle truncate">
            {optimizationResult?.method || 'Standard sequence'}
          </span>
        </div>

        {/* Metric 4: Waypoints Count */}
        <div className="p-3.5 rounded-2xl bg-editorial-surface border border-editorial-border shadow-card flex flex-col gap-0.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-editorial-subtle">Waypoints</span>
            {lockedCount > 0 && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800">
                {lockedCount} Fixed
              </span>
            )}
          </div>
          <div className="text-xl font-semibold font-serif text-editorial-ink tracking-tight mt-0.5">
            {stopCount} {stopCount === 1 ? 'Stop' : 'Stops'}
          </div>
          <span className="text-[10px] text-editorial-subtle">Sequence capacity 500+</span>
        </div>
      </div>

      {/* Mode Selector & Disclaimer Ribbon */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-0.5">
        {/* Mode Switcher */}
        <div className="flex items-center p-0.5 rounded-full bg-editorial-surface border border-editorial-border shadow-subtle">
          <button
            onClick={() => onModeChange('driving')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${summary.mode === 'driving'
                ? 'bg-editorial-ink text-editorial-bg shadow-sm'
                : 'text-editorial-body hover:text-editorial-ink'
              }`}
          >
            <Car className="w-3.5 h-3.5" />
            <span>Driving</span>
          </button>

          <button
            onClick={() => onModeChange('cycling')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${summary.mode === 'cycling'
                ? 'bg-editorial-ink text-editorial-bg shadow-sm'
                : 'text-editorial-body hover:text-editorial-ink'
              }`}
          >
            <Bike className="w-3.5 h-3.5" />
            <span>Cycling</span>
          </button>

          <button
            onClick={() => onModeChange('walking')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${summary.mode === 'walking'
                ? 'bg-editorial-ink text-editorial-bg shadow-sm'
                : 'text-editorial-body hover:text-editorial-ink'
              }`}
          >
            <Footprints className="w-3.5 h-3.5" />
            <span>Walking</span>
          </button>
        </div>

        {/* Live Traffic Disclaimer */}
        <div className="flex items-center gap-1.5 text-[11px] text-editorial-subtle px-3 py-1 rounded-full bg-editorial-subsurface border border-editorial-border">
          <Info className="w-3 h-3 text-editorial-subtle flex-shrink-0" />
          <span>Live traffic is unavailable. Route duration is based on estimated travel time.</span>
        </div>
      </div>
    </div>
  );
};

export default MetricsBar;

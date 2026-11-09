import React from 'react';
import { RouteSummary, TransportMode, OptimizationResult } from '../types';
import { Info, Activity } from 'lucide-react';

// Google Maps Authentic Mode Icons
export const GoogleCarIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.85 7h10.29l1.04 3H5.81l1.04-3zM19 17H5v-4.66l.12-.34h13.77l.11.34V17z" />
    <circle cx="7.5" cy="14.5" r="1.5" />
    <circle cx="16.5" cy="14.5" r="1.5" />
  </svg>
);

export const GoogleBikeIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M15.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM5 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5zm5.8-10l2.4-2.4.8.8c1.3 1.3 3 2.1 5 2.1V9c-1.5 0-2.9-.6-3.9-1.6l-1.4-1.4c-.4-.4-.9-.6-1.5-.6s-1.1.2-1.5.6L7.1 9.6c-.4.4-.6.9-.6 1.4 0 .6.2 1.1.6 1.5L10 15.4V20h2v-5.6l-2.2-2.2 1-3.7zM19 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5z" />
  </svg>
);

export const GoogleWalkIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3c1.3 1.5 3.3 2.5 5.5 2.5v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7z" />
  </svg>
);

interface MetricsBarProps {
  summary: RouteSummary;
  optimizationResult: OptimizationResult | null;
  stopCount: number;
  lockedCount: number;
  onModeChange: (mode: TransportMode) => void;
  onOpenAnalytics?: () => void;
}

export const MetricsBar: React.FC<MetricsBarProps> = ({
  summary,
  optimizationResult,
  stopCount,
  lockedCount,
  onModeChange,
  onOpenAnalytics,
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

  const getModeDuration = (mode: TransportMode) => {
    const distM = summary.totalDistanceMeters || 0;
    if (distM <= 0) return null;
    if (summary.mode === mode && summary.totalDurationSeconds > 0) {
      return formatDuration(summary.totalDurationSeconds);
    }
    const speeds = { driving: 11.1, cycling: 4.16, walking: 1.33 };
    const estSec = Math.round(distM / speeds[mode]);
    return formatDuration(estSec);
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
        <div
          onClick={onOpenAnalytics}
          className={`p-3.5 rounded-2xl bg-editorial-surface border border-editorial-border shadow-card flex flex-col gap-0.5 transition-all ${
            onOpenAnalytics ? 'cursor-pointer hover:border-emerald-300 hover:shadow-subtle' : ''
          }`}
          title="Click to view deep algorithmic analytics & fuel savings"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-editorial-subtle flex items-center gap-1">
              <span>Efficiency Gain</span>
              <Activity className="w-3 h-3 text-emerald-600" />
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800">
              {optimizationResult && optimizationResult.savingsPercent > 0 ? `${optimizationResult.savingsPercent}% Saved` : 'Original'}
            </span>
          </div>
          <div className="text-xl font-semibold font-serif text-editorial-ink tracking-tight mt-0.5">
            {optimizationResult && optimizationResult.savingsPercent > 0
              ? `+${optimizationResult.savingsPercent}%`
              : '0.0%'}
          </div>
          <div className="flex items-center justify-between text-[10px] text-editorial-subtle">
            <span className="truncate">{optimizationResult?.method || 'Standard sequence'}</span>
            <span className="text-emerald-700 font-medium ml-1 flex-shrink-0">Audit &rarr;</span>
          </div>
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
        {/* Google Maps Style Mode Switcher with Real Icons & Time Estimates */}
        <div className="flex items-center p-1 rounded-2xl bg-editorial-surface border border-editorial-border shadow-subtle gap-1">
          <button
            onClick={() => onModeChange('driving')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
              summary.mode === 'driving'
                ? 'bg-[#18181B] text-[#FAF8F5] shadow-sm font-semibold'
                : 'text-editorial-body hover:bg-editorial-subsurface hover:text-editorial-ink'
            }`}
            title="Drive by Car"
          >
            <GoogleCarIcon className="w-4 h-4 flex-shrink-0" />
            <span>Driving</span>
            {getModeDuration('driving') && (
              <span className={`text-[10px] font-mono ml-0.5 px-1.5 py-0.5 rounded ${summary.mode === 'driving' ? 'bg-white/20 text-white' : 'bg-editorial-subsurface text-editorial-subtle'}`}>
                {getModeDuration('driving')}
              </span>
            )}
          </button>

          <button
            onClick={() => onModeChange('cycling')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
              summary.mode === 'cycling'
                ? 'bg-[#18181B] text-[#FAF8F5] shadow-sm font-semibold'
                : 'text-editorial-body hover:bg-editorial-subsurface hover:text-editorial-ink'
            }`}
            title="Ride Bicycle"
          >
            <GoogleBikeIcon className="w-4 h-4 flex-shrink-0" />
            <span>Cycling</span>
            {getModeDuration('cycling') && (
              <span className={`text-[10px] font-mono ml-0.5 px-1.5 py-0.5 rounded ${summary.mode === 'cycling' ? 'bg-white/20 text-white' : 'bg-editorial-subsurface text-editorial-subtle'}`}>
                {getModeDuration('cycling')}
              </span>
            )}
          </button>

          <button
            onClick={() => onModeChange('walking')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
              summary.mode === 'walking'
                ? 'bg-[#18181B] text-[#FAF8F5] shadow-sm font-semibold'
                : 'text-editorial-body hover:bg-editorial-subsurface hover:text-editorial-ink'
            }`}
            title="Walk on Foot"
          >
            <GoogleWalkIcon className="w-4 h-4 flex-shrink-0" />
            <span>Walking</span>
            {getModeDuration('walking') && (
              <span className={`text-[10px] font-mono ml-0.5 px-1.5 py-0.5 rounded ${summary.mode === 'walking' ? 'bg-white/20 text-white' : 'bg-editorial-subsurface text-editorial-subtle'}`}>
                {getModeDuration('walking')}
              </span>
            )}
          </button>
        </div>

        {/* Live Traffic Disclaimer */}
        <div className="flex items-center gap-1.5 text-[11px] text-editorial-subtle px-3 py-1.5 rounded-full bg-editorial-subsurface border border-editorial-border">
          <Info className="w-3 h-3 text-editorial-subtle flex-shrink-0" />
          <span>Duration based on real OSRM road graph topology &bull; Zero API Keys</span>
        </div>
      </div>
    </div>
  );
};

export default MetricsBar;

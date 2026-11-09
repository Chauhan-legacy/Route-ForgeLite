import React from 'react';
import { RouteSummary, TransportMode, OptimizationResult } from '../types';
import { Car, Bike, Footprints, Gauge, Zap, Clock, Navigation, AlertCircle } from 'lucide-react';

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
    <div className="px-6 py-3 bg-aerospace-950/70 border-b border-cyan-500/15 flex flex-col gap-3 flex-shrink-0">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Metric 1: Distance */}
        <div className="p-3 rounded-2xl bg-aerospace-900/80 border border-cyan-500/15 flex flex-col gap-1 shadow-aerospace">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">Total Distance</span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
              {summary.provider === 'osrm' ? 'OSRM Road' : 'Straight-Line'}
            </span>
          </div>
          <div className="text-xl font-extrabold font-sans text-white tracking-tight">
            {formatDistance(summary.totalDistanceMeters)}
          </div>
          <span className="text-[10px] text-slate-500">
            {summary.isFallback ? 'Straight-line fallback estimation' : 'Calculated vector road network'}
          </span>
        </div>

        {/* Metric 2: Estimated Time */}
        <div className="p-3 rounded-2xl bg-aerospace-900/80 border border-cyan-500/15 flex flex-col gap-1 shadow-aerospace">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">Duration</span>
            <div className="flex items-center gap-1 text-[10px] text-cyan-400">
              <Clock className="w-3 h-3" />
              <span>{summary.mode}</span>
            </div>
          </div>
          <div className="text-xl font-extrabold font-sans text-white tracking-tight">
            {formatDuration(summary.totalDurationSeconds)}
          </div>
          <span className="text-[10px] text-slate-500">Based on standard transit speed</span>
        </div>

        {/* Metric 3: Optimization Savings */}
        <div className="p-3 rounded-2xl bg-gradient-to-br from-aerospace-900/90 to-cyan-950/30 border border-cyan-500/30 flex flex-col gap-1 shadow-glow-cyan/10">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-cyan-300">Tour Savings</span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              {optimizationResult ? `${optimizationResult.savingsPercent}% Saved` : 'Optimal'}
            </span>
          </div>
          <div className="text-xl font-extrabold font-sans text-cyan-200 tracking-tight">
            {optimizationResult && optimizationResult.savingsPercent > 0
              ? `+${optimizationResult.savingsPercent}%`
              : '0.0%'}
          </div>
          <span className="text-[10px] text-cyan-400/70 truncate">
            {optimizationResult?.method || 'Google OR-Tools / 2-Opt'}
          </span>
        </div>

        {/* Metric 4: Stops & Waypoints */}
        <div className="p-3 rounded-2xl bg-aerospace-900/80 border border-cyan-500/15 flex flex-col gap-1 shadow-aerospace">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">Waypoints</span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/25">
              {lockedCount} Locked 🔒
            </span>
          </div>
          <div className="text-xl font-extrabold font-sans text-white tracking-tight">
            {stopCount} Stop{stopCount === 1 ? '' : 's'}
          </div>
          <span className="text-[10px] text-slate-500">Sequence capacity 500+</span>
        </div>
      </div>

      {/* Mode Selector & Traffic Status Ribbon */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        {/* Mode Switcher */}
        <div className="flex items-center p-1 rounded-full bg-aerospace-900 border border-cyan-500/20">
          <button
            onClick={() => onModeChange('driving')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
              summary.mode === 'driving'
                ? 'bg-cyan-500 text-aerospace-950 shadow-glow-cyan'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Car className="w-3.5 h-3.5" />
            <span>Driving</span>
          </button>

          <button
            onClick={() => onModeChange('cycling')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
              summary.mode === 'cycling'
                ? 'bg-cyan-500 text-aerospace-950 shadow-glow-cyan'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Bike className="w-3.5 h-3.5" />
            <span>Cycling</span>
          </button>

          <button
            onClick={() => onModeChange('walking')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
              summary.mode === 'walking'
                ? 'bg-cyan-500 text-aerospace-950 shadow-glow-cyan'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Footprints className="w-3.5 h-3.5" />
            <span>Walking</span>
          </button>
        </div>

        {/* Live Traffic Disclaimer (Mandatory Section 6) */}
        <div className="flex items-center gap-2 text-[11px] text-slate-400 px-3 py-1 rounded-full bg-aerospace-900/60 border border-slate-800">
          <AlertCircle className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
          <span>Live traffic is unavailable. Route duration is based on estimated travel time.</span>
        </div>
      </div>
    </div>
  );
};


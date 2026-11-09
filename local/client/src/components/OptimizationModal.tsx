import React, { useState } from 'react';
import { X, Zap, RefreshCw, Compass, ArrowRight, ShieldCheck, Check } from 'lucide-react';
import { OptimizationOptions } from '../types';

interface OptimizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  stopCount: number;
  lockedCount: number;
  onRunOptimization: (options: OptimizationOptions) => Promise<void>;
}

export const OptimizationModal: React.FC<OptimizationModalProps> = ({
  isOpen,
  onClose,
  stopCount,
  lockedCount,
  onRunOptimization
}) => {
  const [objective, setObjective] = useState<'distance' | 'duration'>('distance');
  const [returnToStart, setReturnToStart] = useState<boolean>(false);
  const [fixStart, setFixStart] = useState<boolean>(true);
  const [fixEnd, setFixEnd] = useState<boolean>(false);
  const [isOptimizing, setIsOptimizing] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleRun = async () => {
    setIsOptimizing(true);
    try {
      await onRunOptimization({
        objective,
        returnToStart,
        fixStart,
        fixEnd
      });
      onClose();
    } finally {
      setIsOptimizing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-aerospace-950/80 backdrop-blur-md">
      <div className="w-full max-w-lg bg-aerospace-900 border border-cyan-500/25 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-cyan-500/15 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Zap className="w-4 h-4 fill-current" />
            </div>
            <div>
              <h3 className="font-sans font-bold text-sm text-white">TSP Route Optimization</h3>
              <p className="text-[11px] text-slate-400">Google OR-Tools GLS & 2-Opt Spatial Partitioning</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-aerospace-850 hover:bg-aerospace-800 text-slate-400 hover:text-white flex items-center justify-center transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Objective Selection */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-2">
              Optimization Objective
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setObjective('distance')}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  objective === 'distance'
                    ? 'bg-cyan-500/15 border-cyan-400 text-white shadow-glow-cyan/20'
                    : 'bg-aerospace-850/60 border-cyan-500/15 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs text-white">Shortest Distance</span>
                  {objective === 'distance' && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                </div>
                <p className="text-[11px] text-slate-400">Minimizes total road kilometers across stops</p>
              </button>

              <button
                type="button"
                onClick={() => setObjective('duration')}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  objective === 'duration'
                    ? 'bg-cyan-500/15 border-cyan-400 text-white shadow-glow-cyan/20'
                    : 'bg-aerospace-850/60 border-cyan-500/15 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs text-white">Fastest Time</span>
                  {objective === 'duration' && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                </div>
                <p className="text-[11px] text-slate-400">Optimizes for highest speed corridor segments</p>
              </button>
            </div>
          </div>

          {/* Sequence Invariants & Circuit Constraints */}
          <div className="space-y-3">
            <label className="text-xs font-semibold text-slate-300 block">
              Tour Structure & Constraints
            </label>

            {/* Fix Start */}
            <label className="flex items-center justify-between p-3 rounded-2xl bg-aerospace-850/60 border border-cyan-500/15 cursor-pointer hover:bg-aerospace-850 transition-colors">
              <div>
                <span className="text-xs font-medium text-slate-200 block">Lock First Waypoint</span>
                <span className="text-[11px] text-slate-400">Departure origin remains fixed at Stop #1</span>
              </div>
              <input
                type="checkbox"
                checked={fixStart}
                onChange={(e) => setFixStart(e.target.checked)}
                className="w-4 h-4 rounded text-cyan-500 accent-cyan-400"
              />
            </label>

            {/* Return to Start (Roundtrip) */}
            <label className="flex items-center justify-between p-3 rounded-2xl bg-aerospace-850/60 border border-cyan-500/15 cursor-pointer hover:bg-aerospace-850 transition-colors">
              <div>
                <span className="text-xs font-medium text-slate-200 block">Roundtrip (Return to Start)</span>
                <span className="text-[11px] text-slate-400">Creates a closed circuit ending where you started</span>
              </div>
              <input
                type="checkbox"
                checked={returnToStart}
                onChange={(e) => {
                  setReturnToStart(e.target.checked);
                  if (e.target.checked) setFixEnd(false);
                }}
                className="w-4 h-4 rounded text-cyan-500 accent-cyan-400"
              />
            </label>

            {/* Fix End */}
            {!returnToStart && (
              <label className="flex items-center justify-between p-3 rounded-2xl bg-aerospace-850/60 border border-cyan-500/15 cursor-pointer hover:bg-aerospace-850 transition-colors">
                <div>
                  <span className="text-xs font-medium text-slate-200 block">Lock Final Waypoint</span>
                  <span className="text-[11px] text-slate-400">Keep current last stop as fixed destination</span>
                </div>
                <input
                  type="checkbox"
                  checked={fixEnd}
                  onChange={(e) => setFixEnd(e.target.checked)}
                  className="w-4 h-4 rounded text-cyan-500 accent-cyan-400"
                />
              </label>
            )}
          </div>

          {/* Locked Invariant Notice */}
          <div className="p-3 rounded-xl bg-aerospace-950 border border-cyan-500/20 text-[11px] text-slate-400 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="text-slate-200 font-semibold">Invariant Protection:</span> {lockedCount} locked stops (🔒) will strictly retain their fixed sequence. The Traveling Salesperson Problem (TSP) is NP-hard; solutions are optimal heuristic approximations.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-cyan-500/15 flex items-center justify-end gap-3 bg-aerospace-950/40">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleRun}
            disabled={isOptimizing || stopCount < 3}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-aerospace-950 font-bold text-xs shadow-glow-cyan transition-all disabled:opacity-40"
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span>{isOptimizing ? 'Calculating Heuristics...' : `Optimize ${stopCount} Waypoints`}</span>
          </button>
        </div>
      </div>
    </div>
  );
};


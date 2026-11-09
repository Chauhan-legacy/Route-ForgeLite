import React, { useState } from 'react';
import { X, Zap, Check, ShieldCheck } from 'lucide-react';
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
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-editorial-surface border border-editorial-border rounded-2xl shadow-float flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-editorial-border flex items-center justify-between">
          <div>
            <h3 className="font-serif text-lg font-medium text-editorial-ink">Tour Optimization</h3>
            <p className="text-[11px] text-editorial-subtle">Google OR-Tools Guided Local Search and 2-opt spatial heuristics</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-editorial-subtle hover:text-editorial-ink hover:bg-editorial-subsurface flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Objective Selection */}
          <div>
            <label className="text-xs font-medium text-editorial-body block mb-2">
              Optimization Objective
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setObjective('distance')}
                className={`p-3 rounded-xl border text-left transition-colors ${
                  objective === 'distance'
                    ? 'bg-editorial-subsurface border-editorial-ink text-editorial-ink'
                    : 'bg-editorial-surface border-editorial-border text-editorial-body hover:bg-editorial-subsurface'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-xs text-editorial-ink">Shortest Distance</span>
                  {objective === 'distance' && <Check className="w-3.5 h-3.5 text-editorial-ink" />}
                </div>
                <p className="text-[11px] text-editorial-subtle">Minimizes total road kilometers across stops</p>
              </button>

              <button
                type="button"
                onClick={() => setObjective('duration')}
                className={`p-3 rounded-xl border text-left transition-colors ${
                  objective === 'duration'
                    ? 'bg-editorial-subsurface border-editorial-ink text-editorial-ink'
                    : 'bg-editorial-surface border-editorial-border text-editorial-body hover:bg-editorial-subsurface'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-xs text-editorial-ink">Fastest Time</span>
                  {objective === 'duration' && <Check className="w-3.5 h-3.5 text-editorial-ink" />}
                </div>
                <p className="text-[11px] text-editorial-subtle">Prioritizes faster road segments and corridors</p>
              </button>
            </div>
          </div>

          {/* Sequence Invariants & Circuit Constraints */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-editorial-body block">
              Tour Structure
            </label>

            {/* Fix Start */}
            <label className="flex items-center justify-between p-3 rounded-xl bg-editorial-subsurface border border-editorial-border cursor-pointer hover:bg-editorial-muted transition-colors">
              <div>
                <span className="text-xs font-medium text-editorial-ink block">Lock Starting Waypoint</span>
                <span className="text-[11px] text-editorial-subtle">Origin remains fixed at Stop #1</span>
              </div>
              <input
                type="checkbox"
                checked={fixStart}
                onChange={(e) => setFixStart(e.target.checked)}
                className="w-4 h-4 rounded text-editorial-ink accent-editorial-ink"
              />
            </label>

            {/* Return to Start (Roundtrip) */}
            <label className="flex items-center justify-between p-3 rounded-xl bg-editorial-subsurface border border-editorial-border cursor-pointer hover:bg-editorial-muted transition-colors">
              <div>
                <span className="text-xs font-medium text-editorial-ink block">Roundtrip (Closed Circuit)</span>
                <span className="text-[11px] text-editorial-subtle">Returns to the starting point after final stop</span>
              </div>
              <input
                type="checkbox"
                checked={returnToStart}
                onChange={(e) => {
                  setReturnToStart(e.target.checked);
                  if (e.target.checked) setFixEnd(false);
                }}
                className="w-4 h-4 rounded text-editorial-ink accent-editorial-ink"
              />
            </label>

            {/* Fix End */}
            {!returnToStart && (
              <label className="flex items-center justify-between p-3 rounded-xl bg-editorial-subsurface border border-editorial-border cursor-pointer hover:bg-editorial-muted transition-colors">
                <div>
                  <span className="text-xs font-medium text-editorial-ink block">Lock Destination Waypoint</span>
                  <span className="text-[11px] text-editorial-subtle">Final stop remains fixed as end destination</span>
                </div>
                <input
                  type="checkbox"
                  checked={fixEnd}
                  onChange={(e) => setFixEnd(e.target.checked)}
                  className="w-4 h-4 rounded text-editorial-ink accent-editorial-ink"
                />
              </label>
            )}
          </div>

          {/* Invariant & Heuristic Notice */}
          <div className="p-3 rounded-xl bg-editorial-subsurface border border-editorial-border text-[11px] text-editorial-subtle flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-editorial-body flex-shrink-0 mt-0.5" />
            <div>
              <span className="text-editorial-ink font-medium">Invariant Guarantee:</span> {lockedCount > 0 ? `${lockedCount} locked stops will strictly retain their positions.` : 'Locked stops maintain strict sequence order.'} The Traveling Salesperson Problem (TSP) is NP-hard; solutions are optimal heuristic approximations.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-editorial-border flex items-center justify-end gap-2 bg-editorial-subsurface">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-editorial-subtle hover:text-editorial-ink"
          >
            Cancel
          </button>
          <button
            onClick={handleRun}
            disabled={isOptimizing || stopCount < 3}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-editorial-ink hover:bg-editorial-accent-hover text-editorial-bg text-xs font-medium transition-colors disabled:opacity-40"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>{isOptimizing ? 'Optimizing...' : `Optimize ${stopCount} Waypoints`}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default OptimizationModal;

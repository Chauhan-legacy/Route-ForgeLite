import React, { useState } from 'react';
import { Stop } from '../types';
import { Lock, Unlock, ArrowUp, ArrowDown, Trash2, Edit3, Plus, RotateCcw, UploadCloud, Zap, MapPin } from 'lucide-react';

interface StopListProps {
  stops: Stop[];
  onAddStop: (address: string) => Promise<void>;
  onToggleLock: (stopId: string) => void;
  onMoveStop: (index: number, direction: number) => void;
  onDeleteStop: (stopId: string) => void;
  onEditStop: (stopId: string) => void;
  onOptimize: () => void;
  onReverse: () => void;
  onOpenImport: () => void;
  isSaving: boolean;
}

export const StopList: React.FC<StopListProps> = ({
  stops,
  onAddStop,
  onToggleLock,
  onMoveStop,
  onDeleteStop,
  onEditStop,
  onOptimize,
  onReverse,
  onOpenImport,
  isSaving,
}) => {
  const [inputVal, setInputVal] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim() || isAdding) return;
    const addr = inputVal.trim();
    setInputVal('');
    setIsAdding(true);
    try {
      await onAddStop(addr);
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="w-full lg:w-[420px] flex flex-col bg-editorial-surface border-r border-editorial-border h-full overflow-hidden flex-shrink-0">
      {/* Search & Add Input Box */}
      <div className="p-4 border-b border-editorial-border bg-editorial-surface flex flex-col gap-3">
        <form onSubmit={handleSubmit} className="relative flex items-center">
          <MapPin className="absolute left-3.5 w-4 h-4 text-editorial-subtle" />
          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            placeholder="Add address, landmark, or coordinates..."
            className="w-full h-10 pl-10 pr-20 rounded-xl bg-editorial-subsurface border border-editorial-border focus:border-editorial-ink text-xs text-editorial-ink placeholder-editorial-subtle outline-none transition-colors shadow-subtle"
            disabled={isSaving || isAdding}
          />
          <button
            type="submit"
            disabled={!inputVal.trim() || isSaving || isAdding}
            className="absolute right-1.5 h-7 px-3 rounded-lg bg-editorial-ink hover:bg-editorial-accent-hover text-editorial-bg text-xs font-medium flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Add
          </button>
        </form>

        {/* Quick Actions Row */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOptimize}
            disabled={stops.length < 3 || isSaving}
            className="flex-1 flex items-center justify-center gap-1.5 h-8 px-3 rounded-xl bg-editorial-ink hover:bg-editorial-accent-hover text-editorial-bg font-medium text-xs transition-colors disabled:opacity-40"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Optimize Tour</span>
          </button>

          <button
            onClick={onOpenImport}
            className="flex items-center gap-1.5 h-8 px-3.5 rounded-xl bg-editorial-surface hover:bg-editorial-subsurface border border-editorial-border text-xs font-medium text-editorial-body transition-colors shadow-subtle"
            title="Import addresses or CSV"
          >
            <UploadCloud className="w-3.5 h-3.5 text-editorial-subtle" />
            <span>Import</span>
          </button>

          <button
            onClick={onReverse}
            disabled={stops.length < 2 || isSaving}
            className="w-8 h-8 rounded-xl bg-editorial-surface hover:bg-editorial-subsurface border border-editorial-border text-editorial-body flex items-center justify-center transition-colors disabled:opacity-40 shadow-subtle"
            title="Reverse Route Sequence"
          >
            <RotateCcw className="w-3.5 h-3.5 text-editorial-subtle" />
          </button>
        </div>
      </div>

      {/* Stops Sequence Deck */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {stops.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-editorial-subtle">
            <div className="w-10 h-10 rounded-full bg-editorial-subsurface border border-editorial-border flex items-center justify-center mb-2.5">
              <MapPin className="w-4 h-4 text-editorial-subtle" />
            </div>
            <h4 className="font-serif text-base font-medium text-editorial-ink">No waypoints added</h4>
            <p className="text-xs text-editorial-subtle mt-1 max-w-[220px]">
              Type a location above or click Import to load stops from CSV or sample tours.
            </p>
          </div>
        ) : (
          stops.map((stop, idx) => {
            const isFirst = idx === 0;
            const isLast = idx === stops.length - 1 && stops.length > 1;
            const isLocked = !!stop.metadata?.locked;
            const geoStatus = stop.metadata?.geocodeStatus || 'ok';

            return (
              <div
                key={stop.stopId}
                className={`p-3 rounded-xl border transition-colors flex items-center gap-3 ${
                  isLocked
                    ? 'bg-amber-50/60 border-amber-300'
                    : 'bg-editorial-surface hover:bg-editorial-subsurface border-editorial-border shadow-subtle'
                }`}
              >
                {/* Sequence Badge */}
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-mono font-medium flex-shrink-0 ${
                    isFirst
                      ? 'bg-editorial-ink text-editorial-bg'
                      : isLast
                      ? 'bg-editorial-ink text-editorial-bg'
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
                    <span className="font-medium text-xs text-editorial-ink truncate">{stop.name}</span>
                    {isFirst && (
                      <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 rounded bg-editorial-muted text-editorial-ink">
                        Start
                      </span>
                    )}
                    {isLast && (
                      <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 rounded bg-editorial-muted text-editorial-ink">
                        End
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-editorial-subtle truncate mt-0.5">{stop.address}</p>

                  {geoStatus === 'ambiguous' && (
                    <span className="text-[9px] text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
                      Ambiguous match
                    </span>
                  )}
                  {geoStatus === 'error' && (
                    <span className="text-[9px] text-rose-800 bg-rose-100 px-1.5 py-0.5 rounded">
                      Geocode unavailable
                    </span>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => onToggleLock(stop.stopId)}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                      isLocked ? 'text-amber-800 bg-amber-200/80' : 'text-editorial-subtle hover:text-editorial-ink hover:bg-editorial-muted'
                    }`}
                    title={isLocked ? 'Unlock waypoint' : 'Lock waypoint in place'}
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
    </div>
  );
};

export default StopList;

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
    <div className="w-full lg:w-[440px] flex flex-col bg-aerospace-900 border-r border-cyan-500/15 h-full overflow-hidden flex-shrink-0">
      {/* Search & Add Input Box */}
      <div className="p-4 border-b border-cyan-500/15 bg-aerospace-900/60 backdrop-blur-md flex flex-col gap-3">
        <form onSubmit={handleSubmit} className="relative flex items-center">
          <MapPin className="absolute left-3 w-4 h-4 text-cyan-400" />
          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            placeholder="Add street address, city, or waypoint..."
            className="w-full h-11 pl-9 pr-12 rounded-xl bg-aerospace-950 border border-cyan-500/25 focus:border-cyan-400 text-xs text-white placeholder-slate-500 outline-none transition-all shadow-inner"
            disabled={isSaving || isAdding}
          />
          <button
            type="submit"
            disabled={!inputVal.trim() || isSaving || isAdding}
            className="absolute right-1.5 w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-aerospace-950 flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-glow-cyan"
            title="Add Waypoint"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
          </button>
        </form>

        {/* Quick Actions Ribbon */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOptimize}
            disabled={stops.length < 3 || isSaving}
            className="flex-1 flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-aerospace-950 font-bold text-xs shadow-glow-cyan transition-all disabled:opacity-35"
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span>Optimize Tour</span>
          </button>

          <button
            onClick={onOpenImport}
            className="flex items-center gap-1 h-8 px-3 rounded-lg bg-aerospace-850 hover:bg-aerospace-800 border border-cyan-500/20 text-xs font-semibold text-cyan-300 transition-all"
            title="Import CSV or paste addresses"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Import</span>
          </button>

          <button
            onClick={onReverse}
            disabled={stops.length < 2 || isSaving}
            className="w-8 h-8 rounded-lg bg-aerospace-850 hover:bg-aerospace-800 border border-cyan-500/20 text-slate-300 flex items-center justify-center transition-all disabled:opacity-35"
            title="Reverse Route Sequence"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Stops List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {stops.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-3">
              <MapPin className="w-6 h-6 text-cyan-400" />
            </div>
            <h4 className="font-sans font-bold text-sm text-slate-200">No stops scheduled</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-[240px]">
              Type a location above or click Import to upload 500+ stops via CSV.
            </p>
          </div>
        ) : (
          stops.map((stop, idx) => {
            const isFirst = idx === 0;
            const isLast = idx === stops.length - 1;
            const isLocked = !!stop.metadata?.locked;
            const geoStatus = stop.metadata?.geocodeStatus || 'ok';

            return (
              <div
                key={stop.stopId}
                className={`p-2.5 rounded-xl border transition-all flex items-center gap-2.5 ${
                  isLocked
                    ? 'bg-amber-950/20 border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.15)]'
                    : 'bg-aerospace-850/70 hover:bg-aerospace-800/80 border-cyan-500/15 hover:border-cyan-400/30'
                }`}
              >
                {/* Number Badge */}
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-mono font-bold flex-shrink-0 ${
                    isFirst
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : isLast
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                      : isLocked
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'bg-cyan-500/15 text-cyan-200 border border-cyan-500/30'
                  }`}
                >
                  {String(idx + 1).padStart(2, '0')}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-sans font-semibold text-xs text-white truncate">{stop.name}</span>
                    {isFirst && (
                      <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300">
                        Start
                      </span>
                    )}
                    {isLast && stops.length > 1 && (
                      <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300">
                        End
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5">{stop.address}</p>

                  {geoStatus === 'ambiguous' && (
                    <span className="text-[9px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                      Ambiguous location
                    </span>
                  )}
                  {geoStatus === 'error' && (
                    <span className="text-[9px] text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">
                      Geocoding failed
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onToggleLock(stop.stopId)}
                    className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${
                      isLocked ? 'text-amber-400 bg-amber-500/20' : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title={isLocked ? 'Unlock stop (allow 2-opt reordering)' : 'Lock stop in place (invariant)'}
                  >
                    {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                  </button>

                  <button
                    onClick={() => onEditStop(stop.stopId)}
                    className="w-6 h-6 rounded text-slate-400 hover:text-cyan-300 flex items-center justify-center"
                    title="Edit address"
                  >
                    <Edit3 className="w-3 h-3" />
                  </button>

                  <button
                    onClick={() => onMoveStop(idx, -1)}
                    disabled={idx === 0}
                    className="w-6 h-6 rounded text-slate-400 hover:text-slate-200 disabled:opacity-20 flex items-center justify-center"
                    title="Move up"
                  >
                    <ArrowUp className="w-3 h-3" />
                  </button>

                  <button
                    onClick={() => onMoveStop(idx, 1)}
                    disabled={idx === stops.length - 1}
                    className="w-6 h-6 rounded text-slate-400 hover:text-slate-200 disabled:opacity-20 flex items-center justify-center"
                    title="Move down"
                  >
                    <ArrowDown className="w-3 h-3" />
                  </button>

                  <button
                    onClick={() => onDeleteStop(stop.stopId)}
                    className="w-6 h-6 rounded text-slate-500 hover:text-rose-400 flex items-center justify-center"
                    title="Remove stop"
                  >
                    <Trash2 className="w-3 h-3" />
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


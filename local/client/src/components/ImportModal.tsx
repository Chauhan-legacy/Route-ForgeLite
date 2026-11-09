import React, { useState } from 'react';
import { X, UploadCloud, FileText, Sparkles, CheckCircle2, AlertTriangle, Play } from 'lucide-react';
import { Stop } from '../types';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportStops: (newStops: Array<{ name: string; address: string; lat?: number; lng?: number; locked?: boolean }>) => Promise<void>;
}

const SAMPLE_MISSIONS = [
  {
    title: 'San Francisco Tech & Landmarks (6 Stops)',
    description: 'Iconic tour from Ferry Building to Golden Gate Bridge.',
    stops: [
      { name: 'Ferry Building', address: '1 Ferry Building, San Francisco, CA 94111', lat: 37.7955, lng: -122.3937 },
      { name: 'Union Square', address: '333 Post St, San Francisco, CA 94108', lat: 37.7880, lng: -122.4075 },
      { name: 'Lombard Street', address: '1070 Lombard St, San Francisco, CA 94133', lat: 37.8021, lng: -122.4187 },
      { name: 'Palace of Fine Arts', address: '3301 Lyon St, San Francisco, CA 94123', lat: 37.8029, lng: -122.4484 },
      { name: 'Golden Gate Bridge', address: 'Golden Gate Bridge, San Francisco, CA', lat: 37.8199, lng: -122.4783, locked: true },
      { name: 'Twin Peaks', address: '501 Twin Peaks Blvd, San Francisco, CA 94114', lat: 37.7544, lng: -122.4477 }
    ]
  },
  {
    title: 'Tokyo Urban Tour (5 Stops)',
    description: 'Fast traversal across Tokyo hubs.',
    stops: [
      { name: 'Tokyo Station', address: '1 Chome Marunouchi, Chiyoda City, Tokyo', lat: 35.6812, lng: 139.7671 },
      { name: 'Akihabara Electric Town', address: 'Sotokanda, Chiyoda City, Tokyo', lat: 35.7022, lng: 139.7741 },
      { name: 'Senso-ji Asakusa', address: '2 Chome-3-1 Asakusa, Taito City, Tokyo', lat: 35.7148, lng: 139.7967 },
      { name: 'Tokyo Skytree', address: '1 Chome-1-2 Oshiage, Sumida City, Tokyo', lat: 35.7100, lng: 139.8107 },
      { name: 'Shibuya Crossing', address: 'Shibuya, Tokyo', lat: 35.6595, lng: 139.7004 }
    ]
  },
  {
    title: 'London Express Hub (5 Stops)',
    description: 'Central London multi-stop logistics route.',
    stops: [
      { name: 'Tower Bridge', address: 'Tower Bridge Rd, London SE1 2UP', lat: 51.5055, lng: -0.0754 },
      { name: 'St Pauls Cathedral', address: 'St. Paul\'s Churchyard, London EC4M 8AD', lat: 51.5138, lng: -0.0984 },
      { name: 'British Museum', address: 'Great Russell St, London WC1B 3DG', lat: 51.5194, lng: -0.1270 },
      { name: 'Buckingham Palace', address: 'London SW1A 1AA', lat: 51.5014, lng: -0.1419 },
      { name: 'Big Ben & Westminster', address: 'London SW1A 0AA', lat: 51.5007, lng: -0.1246 }
    ]
  }
];

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  onImportStops
}) => {
  const [activeTab, setActiveTab] = useState<'text' | 'file' | 'samples'>('samples');
  const [rawText, setRawText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleTextImport = async () => {
    if (!rawText.trim()) return;
    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
      const parsedStops: Array<{ name: string; address: string; lat?: number; lng?: number }> = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (i === 0 && (line.toLowerCase().includes('address') || line.toLowerCase().includes('name'))) {
          continue; // skip header
        }

        const parts = line.includes('\t') ? line.split('\t') : line.split(',');
        if (parts.length >= 2) {
          // Check if coordinates
          const num1 = parseFloat(parts[0].trim());
          const num2 = parseFloat(parts[1].trim());
          if (!isNaN(num1) && !isNaN(num2) && Math.abs(num1) <= 90 && Math.abs(num2) <= 180) {
            parsedStops.push({
              name: `Stop ${parsedStops.length + 1}`,
              address: `${num1.toFixed(4)}, ${num2.toFixed(4)}`,
              lat: num1,
              lng: num2
            });
          } else {
            parsedStops.push({
              name: parts[0].trim().replace(/^["']|["']$/g, ''),
              address: parts.slice(1).join(', ').trim().replace(/^["']|["']$/g, '')
            });
          }
        } else {
          parsedStops.push({
            name: `Waypoint ${parsedStops.length + 1}`,
            address: line.replace(/^["']|["']$/g, '')
          });
        }
      }

      if (parsedStops.length === 0) {
        throw new Error('No valid stops found in the pasted content.');
      }

      await onImportStops(parsedStops);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to parse import content.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setRawText(content);
        setActiveTab('text');
      }
    };
    reader.readAsText(file);
  };

  const loadSample = async (sample: typeof SAMPLE_MISSIONS[0]) => {
    setIsProcessing(true);
    try {
      await onImportStops(sample.stops);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load sample mission.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-aerospace-950/80 backdrop-blur-md">
      <div className="w-full max-w-xl bg-aerospace-900 border border-cyan-500/25 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-cyan-500/15 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <UploadCloud className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-sans font-bold text-sm text-white">Import Waypoints</h3>
              <p className="text-[11px] text-slate-400">CSV, TSV, coordinates, or pre-built sample tours</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-aerospace-850 hover:bg-aerospace-800 text-slate-400 hover:text-white flex items-center justify-center transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="px-6 pt-3 flex gap-2 border-b border-cyan-500/10">
          <button
            onClick={() => setActiveTab('samples')}
            className={`pb-2.5 px-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-all ${
              activeTab === 'samples'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>1-Click Samples</span>
          </button>

          <button
            onClick={() => setActiveTab('text')}
            className={`pb-2.5 px-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-all ${
              activeTab === 'text'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Paste Text / CSV</span>
          </button>

          <button
            onClick={() => setActiveTab('file')}
            className={`pb-2.5 px-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-all ${
              activeTab === 'file'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Upload File</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {activeTab === 'samples' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-300">
                Choose a pre-configured tour to immediately test route planning, multi-stop optimization, and road geometry:
              </p>
              {SAMPLE_MISSIONS.map((sample, i) => (
                <div
                  key={i}
                  className="p-3.5 rounded-2xl bg-aerospace-850/80 hover:bg-aerospace-800 border border-cyan-500/15 hover:border-cyan-400/40 transition-all flex items-center justify-between group"
                >
                  <div>
                    <h4 className="font-sans font-bold text-xs text-white group-hover:text-cyan-300 transition-colors">
                      {sample.title}
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">{sample.description}</p>
                    <span className="inline-block mt-1.5 text-[10px] font-mono text-cyan-400/80 bg-cyan-500/10 px-2 py-0.5 rounded-md">
                      {sample.stops.length} waypoints included
                    </span>
                  </div>
                  <button
                    onClick={() => loadSample(sample)}
                    disabled={isProcessing}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-aerospace-950 font-bold text-xs shadow-glow-cyan transition-all disabled:opacity-50"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Load</span>
                  </button>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'text' && (
            <div className="space-y-3">
              <label className="text-xs text-slate-300 block">
                Paste addresses or coordinates (one per line, or CSV format):
              </label>
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder={"Example format:\nFerry Building, San Francisco, CA\nUnion Square, San Francisco, CA\n37.8021, -122.4187\nGolden Gate Bridge, CA"}
                rows={8}
                className="w-full p-3 rounded-2xl bg-aerospace-950 border border-cyan-500/25 focus:border-cyan-400 text-xs text-slate-200 font-mono outline-none resize-none shadow-inner"
              />
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Supports Name, Address, or Lat, Lng</span>
                <span>{rawText.split('\n').filter(Boolean).length} lines entered</span>
              </div>
            </div>
          )}

          {activeTab === 'file' && (
            <div className="space-y-4">
              <label className="border-2 border-dashed border-cyan-500/30 hover:border-cyan-400/60 rounded-3xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all bg-aerospace-950/40 hover:bg-aerospace-950/80">
                <UploadCloud className="w-10 h-10 text-cyan-400 mb-2 animate-bounce" />
                <span className="text-xs font-bold text-slate-200">Drop CSV file here, or click to browse</span>
                <span className="text-[11px] text-slate-400 mt-1">Supports standard UTF-8 .csv or .tsv spreadsheets</span>
                <input
                  type="file"
                  accept=".csv,.tsv,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        {activeTab === 'text' && (
          <div className="px-6 py-4 border-t border-cyan-500/15 flex items-center justify-end gap-3 bg-aerospace-950/40">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleTextImport}
              disabled={!rawText.trim() || isProcessing}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-aerospace-950 font-bold text-xs shadow-glow-cyan transition-all disabled:opacity-40"
            >
              {isProcessing ? 'Processing...' : 'Import Waypoints'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};


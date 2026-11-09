import React, { useState } from 'react';
import { X, UploadCloud, FileText, Sparkles, AlertTriangle, ArrowRight } from 'lucide-react';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportStops: (newStops: Array<{ name: string; address: string; lat?: number; lng?: number; locked?: boolean }>) => Promise<void>;
}

const SAMPLE_MISSIONS = [
  {
    title: 'San Francisco Landmarks (6 Stops)',
    description: 'Traversal from Ferry Building through Union Square to Golden Gate Bridge.',
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
    title: 'Tokyo Urban Route (5 Stops)',
    description: 'Central traversal across Tokyo transit hubs and commercial centers.',
    stops: [
      { name: 'Tokyo Station', address: '1 Chome Marunouchi, Chiyoda City, Tokyo', lat: 35.6812, lng: 139.7671 },
      { name: 'Akihabara', address: 'Sotokanda, Chiyoda City, Tokyo', lat: 35.7022, lng: 139.7741 },
      { name: 'Senso-ji Asakusa', address: '2 Chome-3-1 Asakusa, Taito City, Tokyo', lat: 35.7148, lng: 139.7967 },
      { name: 'Tokyo Skytree', address: '1 Chome-1-2 Oshiage, Sumida City, Tokyo', lat: 35.7100, lng: 139.8107 },
      { name: 'Shibuya Crossing', address: 'Shibuya, Tokyo', lat: 35.6595, lng: 139.7004 }
    ]
  },
  {
    title: 'London Express Hub (5 Stops)',
    description: 'Central London logistics corridor across historical and civic districts.',
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
  const [activeTab, setActiveTab] = useState<'samples' | 'text' | 'file'>('samples');
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
          continue;
        }

        const parts = line.includes('\t') ? line.split('\t') : line.split(',');
        if (parts.length >= 2) {
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
        throw new Error('No valid stops found in the provided content.');
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
      setErrorMsg(err.message || 'Failed to load sample tour.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-editorial-surface border border-editorial-border rounded-2xl shadow-float flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-editorial-border flex items-center justify-between">
          <div>
            <h3 className="font-serif text-lg font-medium text-editorial-ink">Import Waypoints</h3>
            <p className="text-[11px] text-editorial-subtle">Load stops from sample tours, CSV files, or coordinates</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-editorial-subtle hover:text-editorial-ink hover:bg-editorial-subsurface flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="px-6 pt-3 flex gap-3 border-b border-editorial-border">
          <button
            onClick={() => setActiveTab('samples')}
            className={`pb-2.5 px-1 text-xs font-medium flex items-center gap-1.5 border-b-2 transition-colors ${
              activeTab === 'samples'
                ? 'border-editorial-ink text-editorial-ink'
                : 'border-transparent text-editorial-subtle hover:text-editorial-body'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Sample Tours</span>
          </button>

          <button
            onClick={() => setActiveTab('text')}
            className={`pb-2.5 px-1 text-xs font-medium flex items-center gap-1.5 border-b-2 transition-colors ${
              activeTab === 'text'
                ? 'border-editorial-ink text-editorial-ink'
                : 'border-transparent text-editorial-subtle hover:text-editorial-body'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Paste Text / CSV</span>
          </button>

          <button
            onClick={() => setActiveTab('file')}
            className={`pb-2.5 px-1 text-xs font-medium flex items-center gap-1.5 border-b-2 transition-colors ${
              activeTab === 'file'
                ? 'border-editorial-ink text-editorial-ink'
                : 'border-transparent text-editorial-subtle hover:text-editorial-body'
            }`}
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Upload File</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {activeTab === 'samples' && (
            <div className="space-y-2.5">
              <p className="text-xs text-editorial-subtle mb-3">
                Load a pre-configured multi-stop itinerary to test route calculation and sequence optimization:
              </p>
              {SAMPLE_MISSIONS.map((sample, i) => (
                <div
                  key={i}
                  className="p-3.5 rounded-xl bg-editorial-subsurface hover:bg-editorial-muted border border-editorial-border transition-colors flex items-center justify-between group"
                >
                  <div className="pr-4">
                    <h4 className="font-medium text-xs text-editorial-ink">
                      {sample.title}
                    </h4>
                    <p className="text-[11px] text-editorial-subtle mt-0.5">{sample.description}</p>
                    <span className="inline-block mt-1 text-[10px] font-mono text-editorial-body">
                      {sample.stops.length} waypoints included
                    </span>
                  </div>
                  <button
                    onClick={() => loadSample(sample)}
                    disabled={isProcessing}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-editorial-ink hover:bg-editorial-accent-hover text-editorial-bg text-xs font-medium transition-colors disabled:opacity-50 flex-shrink-0"
                  >
                    <span>Load</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'text' && (
            <div className="space-y-3">
              <label className="text-xs text-editorial-body block">
                Paste addresses or coordinates (one per line, or CSV format):
              </label>
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder={"Example format:\nFerry Building, San Francisco, CA\nUnion Square, San Francisco, CA\n37.8021, -122.4187\nGolden Gate Bridge, CA"}
                rows={8}
                className="w-full p-3 rounded-xl bg-editorial-subsurface border border-editorial-border focus:border-editorial-ink text-xs text-editorial-ink font-mono outline-none resize-none shadow-subtle"
              />
              <div className="flex items-center justify-between text-[11px] text-editorial-subtle">
                <span>Supports Name, Address, or Latitude, Longitude</span>
                <span>{rawText.split('\n').filter(Boolean).length} lines entered</span>
              </div>
            </div>
          )}

          {activeTab === 'file' && (
            <div className="space-y-4">
              <label className="border-2 border-dashed border-editorial-border hover:border-editorial-ink rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors bg-editorial-subsurface hover:bg-editorial-muted">
                <UploadCloud className="w-8 h-8 text-editorial-subtle mb-2" />
                <span className="text-xs font-medium text-editorial-ink">Select or drop CSV file</span>
                <span className="text-[11px] text-editorial-subtle mt-0.5">Supports UTF-8 .csv or .tsv format</span>
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
          <div className="px-6 py-3.5 border-t border-editorial-border flex items-center justify-end gap-2 bg-editorial-subsurface">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-editorial-subtle hover:text-editorial-ink"
            >
              Cancel
            </button>
            <button
              onClick={handleTextImport}
              disabled={!rawText.trim() || isProcessing}
              className="px-4 py-1.5 rounded-lg bg-editorial-ink hover:bg-editorial-accent-hover text-editorial-bg text-xs font-medium transition-colors disabled:opacity-40"
            >
              {isProcessing ? 'Processing...' : 'Import Waypoints'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImportModal;

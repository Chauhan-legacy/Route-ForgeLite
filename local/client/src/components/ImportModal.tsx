import React, { useState, useMemo } from 'react';
import { X, UploadCloud, FileText, Sparkles, AlertTriangle, ArrowRight, CheckCircle2, MapPin, Compass } from 'lucide-react';
import { parseCsvText, ParsedCsvStop } from '../services/csvParser';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportStops: (
    newStops: Array<{ name: string; address: string; lat?: number; lng?: number; locked?: boolean }>,
    replaceExisting?: boolean
  ) => Promise<void>;
  existingStopCount?: number;
}

const SAMPLE_MISSIONS = [
  {
    title: '12 Jyotirlinga Pilgrimage Circuit (India)',
    description: 'National sacred tour connecting Somnath, Dwarka, Ujjain, Kedarnath, and Rameshwaram.',
    stops: [
      { name: 'Somnath (Shri Somnath Jyotirlinga Temple)', address: 'Prabhas Patan, Veraval, Gir Somnath, Gujarat', lat: 20.888, lng: 70.4012 },
      { name: 'Nageshwar (Nageshvara Jyotirlinga Temple)', address: 'Dwarka, Devbhoomi Dwarka, Gujarat', lat: 22.4707, lng: 69.0773 },
      { name: 'Mahakaleshwar (Shri Mahakaleshwar Temple)', address: 'Ujjain, Ujjain, Madhya Pradesh', lat: 23.1828, lng: 75.7682 },
      { name: 'Omkareshwar (Shri Omkareshwar Temple)', address: 'Mandhata Island, Khandwa, Madhya Pradesh', lat: 22.2475, lng: 76.1517 },
      { name: 'Bhimashankar (Shri Bhimashankar Temple)', address: 'Bhimashankar, Pune, Maharashtra', lat: 19.0739, lng: 73.5351 },
      { name: 'Trimbakeshwar (Shri Trimbakeshwar Temple)', address: 'Trimbak, Nashik, Maharashtra', lat: 19.9333, lng: 73.5333 },
      { name: 'Grishneshwar (Shri Grishneshwar Temple)', address: 'Verul, Chhatrapati Sambhajinagar, Maharashtra', lat: 20.0232, lng: 75.1764 },
      { name: 'Mallikarjuna (Shri Mallikarjuna Swamy Temple)', address: 'Srisailam, Nandyal, Andhra Pradesh', lat: 16.0743, lng: 78.8682 },
      { name: 'Ramanathaswamy (Ramanathaswamy Temple)', address: 'Rameswaram, Ramanathapuram, Tamil Nadu', lat: 9.2881, lng: 79.3129 },
      { name: 'Kashi Vishwanath (Shri Kashi Vishwanath Temple)', address: 'Varanasi, Varanasi, Uttar Pradesh', lat: 25.3113, lng: 83.0104 },
      { name: 'Vaidyanath (Baidyanath Dham)', address: 'Deoghar, Deoghar, Jharkhand', lat: 24.4826, lng: 86.7013 },
      { name: 'Kedarnath (Shri Kedarnath Temple)', address: 'Kedarnath, Rudraprayag, Uttarakhand', lat: 30.7352, lng: 79.0669 }
    ]
  },
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
  }
];

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  onImportStops,
  existingStopCount = 0
}) => {
  const [activeTab, setActiveTab] = useState<'file' | 'text' | 'samples'>('file');
  const [rawText, setRawText] = useState('');
  const [replaceExisting, setReplaceExisting] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  // Live RFC 4180 parsing with coordinate detection
  const parseResult = useMemo(() => {
    if (!rawText.trim()) return null;
    return parseCsvText(rawText);
  }, [rawText]);

  if (!isOpen) return null;

  const handleExecuteImport = async () => {
    if (!parseResult || !parseResult.ok || parseResult.stops.length === 0) {
      setErrorMsg('No valid waypoints could be parsed from the provided content.');
      return;
    }

    setIsProcessing(true);
    setErrorMsg(null);

    try {
      await onImportStops(parseResult.stops, replaceExisting);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to import waypoints.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    setErrorMsg(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setRawText(content);
      }
    };
    reader.onerror = () => {
      setErrorMsg('Failed to read selected file.');
    };
    reader.readAsText(file);
  };

  const loadSample = async (sample: typeof SAMPLE_MISSIONS[0]) => {
    setIsProcessing(true);
    setErrorMsg(null);
    try {
      await onImportStops(sample.stops, replaceExisting);
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
            <p className="text-[11px] text-editorial-subtle">
              RFC 4180 CSV / TSV import with instant sub-meter coordinate mapping
            </p>
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
            onClick={() => setActiveTab('file')}
            className={`pb-2.5 px-1 text-xs font-medium flex items-center gap-1.5 border-b-2 transition-colors ${
              activeTab === 'file'
                ? 'border-editorial-ink text-editorial-ink'
                : 'border-transparent text-editorial-subtle hover:text-editorial-body'
            }`}
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Upload CSV</span>
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
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto max-h-[60vh] space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {activeTab === 'file' && (
            <div className="space-y-4">
              <label className="border-2 border-dashed border-editorial-border hover:border-editorial-ink rounded-2xl p-7 flex flex-col items-center justify-center cursor-pointer transition-colors bg-editorial-subsurface hover:bg-editorial-muted text-center group">
                <UploadCloud className="w-8 h-8 text-editorial-subtle group-hover:text-editorial-ink mb-2 transition-colors" />
                <span className="text-xs font-semibold text-editorial-ink">
                  {uploadedFileName ? `Loaded: ${uploadedFileName}` : 'Select or drop CSV file'}
                </span>
                <span className="text-[11px] text-editorial-subtle mt-0.5">
                  Supports CSV, TSV, coordinates, custom headers, and quoted text
                </span>
                <input
                  type="file"
                  accept=".csv,.tsv,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          )}

          {activeTab === 'text' && (
            <div className="space-y-2">
              <label className="text-xs text-editorial-body block">
                Paste CSV content, addresses, or latitude, longitude coordinates:
              </label>
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder={"Example CSV format:\nStop_No,Name,Temple,City,State,Latitude,Longitude\n1,Somnath,Shri Somnath Temple,\"Veraval\",Gujarat,20.888,70.4012\n2,Nageshwar,Nageshvara Temple,Dwarka,Gujarat,22.4707,69.0773"}
                rows={7}
                className="w-full p-3 rounded-xl bg-editorial-subsurface border border-editorial-border focus:border-editorial-ink text-xs text-editorial-ink font-mono outline-none resize-none shadow-subtle leading-relaxed"
              />
            </div>
          )}

          {/* Parsed Live Preview Section (shown for both 'file' and 'text' tabs) */}
          {(activeTab === 'file' || activeTab === 'text') && parseResult && (
            <div className="rounded-xl border border-editorial-border bg-editorial-subsurface p-3.5 space-y-2.5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>
                    {parseResult.stops.length} waypoints detected
                    {parseResult.hasCoordinates && ' with GPS coordinates'}
                  </span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-medium">
                  {parseResult.stops.filter(s => s.lat != null && s.lng != null).length}/{parseResult.stops.length} Geocoded
                </span>
              </div>

              {/* Waypoint preview rows */}
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {parseResult.stops.slice(0, 5).map((s, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded-lg bg-white border border-editorial-border/60 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <span className="w-5 h-5 rounded-full bg-editorial-subsurface text-editorial-ink text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                        {idx + 1}
                      </span>
                      <div className="truncate">
                        <div className="font-semibold text-editorial-ink truncate">{s.name}</div>
                        <div className="text-[10px] text-editorial-subtle truncate">{s.address}</div>
                      </div>
                    </div>
                    {s.lat != null && s.lng != null ? (
                      <span className="text-[10px] font-mono text-editorial-subtle flex-shrink-0 flex items-center gap-1">
                        <Compass className="w-3 h-3 text-purple-600" />
                        {s.lat.toFixed(3)}°, {s.lng.toFixed(3)}°
                      </span>
                    ) : (
                      <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded flex-shrink-0">
                        Auto-geocode
                      </span>
                    )}
                  </div>
                ))}
                {parseResult.stops.length > 5 && (
                  <div className="text-center text-[10px] text-editorial-subtle pt-1 font-mono">
                    + {parseResult.stops.length - 5} more waypoints ready to import
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Clean replacement toggle */}
          {(activeTab === 'file' || activeTab === 'text') && (
            <label className="flex items-center gap-2 text-xs text-editorial-body cursor-pointer select-none pt-1">
              <input
                type="checkbox"
                checked={replaceExisting}
                onChange={(e) => setReplaceExisting(e.target.checked)}
                className="w-4 h-4 rounded text-editorial-ink focus:ring-0 border-editorial-border cursor-pointer"
              />
              <span>
                Replace current route waypoints ({existingStopCount}) with imported stops
              </span>
            </label>
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
        </div>

        {/* Modal Footer */}
        {(activeTab === 'file' || activeTab === 'text') && (
          <div className="px-6 py-3.5 border-t border-editorial-border flex items-center justify-between bg-editorial-subsurface">
            <span className="text-[11px] text-editorial-subtle">
              {parseResult?.ok ? `${parseResult.stops.length} stops ready` : 'No file loaded'}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-editorial-subtle hover:text-editorial-ink"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteImport}
                disabled={!parseResult?.ok || parseResult.stops.length === 0 || isProcessing}
                className="px-4 py-1.5 rounded-lg bg-editorial-ink hover:bg-editorial-accent-hover text-editorial-bg text-xs font-medium transition-colors disabled:opacity-40 flex items-center gap-1.5"
              >
                <span>{isProcessing ? 'Importing...' : `Import ${parseResult?.stops.length || 0} Waypoints`}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImportModal;

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Stop } from '../types';
import { Maximize2, Minimize2, Crosshair, Target, MapPin } from 'lucide-react';

interface MapProps {
  stops: Stop[];
  routeGeometry: any | null;
  onMapClick?: (lat: number, lng: number) => void;
  onSelectStop?: (stopId: string) => void;
  onStopMove?: (stopId: string, lat: number, lng: number) => void;
  onMapCenterChange?: (center: { lat: number; lng: number }) => void;
  isPinpointMode?: boolean;
  onTogglePinpointMode?: () => void;
}

// 100% Free Vector Map Styles from OpenFreeMap (Zero API Key, Zero Watermarks, Zero Cost)
const OPENFREEMAP_STYLES = {
  positron: {
    name: 'Positron',
    url: 'https://tiles.openfreemap.org/styles/positron',
  },
  liberty: {
    name: 'Liberty',
    url: 'https://tiles.openfreemap.org/styles/liberty',
  },
  bright: {
    name: 'Bright',
    url: 'https://tiles.openfreemap.org/styles/bright',
  }
};

export const Map: React.FC<MapProps> = ({
  stops,
  routeGeometry,
  onMapClick,
  onSelectStop,
  onStopMove,
  onMapCenterChange,
  isPinpointMode,
  onTogglePinpointMode
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const isLoadedRef = useRef<boolean>(false);
  const hasFittedInitialBoundsRef = useRef<boolean>(false);
  const prevStopsCountRef = useRef<number>(stops.length);
  const isPinpointModeRef = useRef<boolean>(!!isPinpointMode);
  const onMapClickRef = useRef(onMapClick);
  const onMapCenterChangeRef = useRef(onMapCenterChange);

  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  useEffect(() => {
    onMapCenterChangeRef.current = onMapCenterChange;
  }, [onMapCenterChange]);

  useEffect(() => {
    isPinpointModeRef.current = !!isPinpointMode;
    if (mapContainerRef.current) {
      const canvas = mapContainerRef.current.querySelector('.maplibregl-canvas') as HTMLElement | null;
      if (canvas) {
        canvas.style.cursor = isPinpointMode ? 'crosshair' : '';
      }
    }
  }, [isPinpointMode]);

  const [activeStyleKey, setActiveStyleKey] = useState<keyof typeof OPENFREEMAP_STYLES>('positron');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Helper to construct GeoJSON LineString from routeGeometry
  const getGeoJsonRoute = useCallback((geom: any): GeoJSON.Feature<GeoJSON.LineString> | null => {
    if (!geom) return null;

    let coordinates: [number, number][] = [];

    if (Array.isArray(geom)) {
      if (geom.length > 0 && Array.isArray(geom[0])) {
        // Handle coordinates array
        coordinates = geom.map((pt: any) => {
          if (Array.isArray(pt) && pt.length >= 2) {
            // [lon, lat] for MapLibre GeoJSON
            return [pt[0], pt[1]] as [number, number];
          }
          return [0, 0] as [number, number];
        });
      }
    } else if (geom.type === 'LineString' && Array.isArray(geom.coordinates)) {
      coordinates = geom.coordinates as [number, number][];
    }

    if (coordinates.length < 2) return null;

    return {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates
      }
    };
  }, []);

  // Update or add route layers onto the active style
  const renderRouteLayers = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const geojsonData = getGeoJsonRoute(routeGeometry);

    const source = map.getSource('rf-route-source') as maplibregl.GeoJSONSource | undefined;

    if (!geojsonData) {
      if (source) {
        source.setData({
          type: 'FeatureCollection',
          features: []
        });
      }
      return;
    }

    if (source) {
      source.setData(geojsonData);
    } else {
      map.addSource('rf-route-source', {
        type: 'geojson',
        data: geojsonData
      });

      // Casing / Shadow line for crisp vector definition
      map.addLayer({
        id: 'rf-route-casing',
        type: 'line',
        source: 'rf-route-source',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#0F172A',
          'line-width': 5.5,
          'line-opacity': 0.15
        }
      });

      // Core path line
      map.addLayer({
        id: 'rf-route-core',
        type: 'line',
        source: 'rf-route-source',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#1E293B',
          'line-width': 3.5,
          'line-opacity': 0.95
        }
      });
    }

    // Fit route bounds ONLY once on initial route load, never during user drag/pan/scroll
    if (!hasFittedInitialBoundsRef.current && geojsonData.geometry.coordinates.length > 1) {
      hasFittedInitialBoundsRef.current = true;
      const bounds = new maplibregl.LngLatBounds();
      geojsonData.geometry.coordinates.forEach(coord => bounds.extend(coord));
      map.fitBounds(bounds, { padding: 60, maxZoom: 16, duration: 600 });
    }
  }, [routeGeometry, getGeoJsonRoute]);

  // Initialize MapLibre GL Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Explicitly set official worker URL to guarantee worker resolution in all environments
    try {
      maplibregl.setWorkerUrl('/assets/maplibre-gl-worker.mjs');
    } catch (e) {
      console.warn('Could not set MapLibre workerUrl:', e);
    }

    const initialStyle = OPENFREEMAP_STYLES[activeStyleKey].url;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: initialStyle,
      center: [-122.4194, 37.7749], // San Francisco default
      zoom: 12,
      attributionControl: false,
    });

    // Clean navigation control
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

    map.on('load', () => {
      isLoadedRef.current = true;
      map.resize();
      renderRouteLayers();
    });

    map.on('style.load', () => {
      renderRouteLayers();
    });

    map.on('error', (e) => {
      console.warn('MapLibre GL Notice:', e.error?.message || e);
    });

    // Handle window resize
    const handleResize = () => map.resize();
    window.addEventListener('resize', handleResize);

    // Map click handler: ONLY active when Pinpoint Mode is explicitly turned on by the user!
    // In normal mode, clicking on the map simply navigates the map naturally without plotting anything.
    map.on('click', (e) => {
      if (isPinpointModeRef.current && onMapClickRef.current) {
        onMapClickRef.current(e.lngLat.lat, e.lngLat.lng);
      }
    });

    // Notify map center changes for viewport-biased autocomplete
    map.on('moveend', () => {
      if (onMapCenterChangeRef.current) {
        const c = map.getCenter();
        onMapCenterChangeRef.current({ lat: c.lat, lng: c.lng });
      }
    });

    mapInstanceRef.current = map;

    return () => {
      window.removeEventListener('resize', handleResize);
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
      map.remove();
      mapInstanceRef.current = null;
      isLoadedRef.current = false;
    };
  }, []);

  // Handle Style Switch
  const handleStyleChange = (key: keyof typeof OPENFREEMAP_STYLES) => {
    if (key === activeStyleKey) return;
    setActiveStyleKey(key);
    const map = mapInstanceRef.current;
    if (map) {
      map.setStyle(OPENFREEMAP_STYLES[key].url);
    }
  };

  // Sync Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear existing markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    const validStops = stops
      .map(s => ({
        ...s,
        resolvedLat: s.lat ?? s.latitude,
        resolvedLng: s.lng ?? s.longitude
      }))
      .filter(s => s.resolvedLat != null && s.resolvedLng != null) as Array<Stop & { resolvedLat: number; resolvedLng: number }>;

    validStops.forEach((stop, idx) => {
      const isFirst = idx === 0;
      const isLast = idx === validStops.length - 1 && validStops.length > 1;
      const isLocked = !!stop.metadata?.locked;

      let bgColor = '#18181B';
      let textColor = '#FAF8F5';
      let border = '2px solid #FFFFFF';

      if (isFirst) {
        bgColor = '#047857'; // Refined Emerald Origin
      } else if (isLast) {
        bgColor = '#1D4ED8'; // Refined Royal Blue Destination
      }

      if (isLocked) {
        bgColor = '#B45309'; // Refined Amber Locked Invariant
        border = '2px solid #FEF3C7';
      }

      // Create custom DOM element for marker
      const el = document.createElement('div');
      el.className = 'rf-maplibre-marker';
      el.style.width = '28px';
      el.style.height = '28px';
      el.style.borderRadius = '50%';
      el.style.background = bgColor;
      el.style.color = textColor;
      el.style.border = border;
      el.style.boxShadow = '0 4px 10px rgba(0, 0, 0, 0.2)';
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
      el.style.fontFamily = "'JetBrains Mono', monospace, sans-serif";
      el.style.fontSize = '11px';
      el.style.fontWeight = '600';
      el.innerText = String(idx + 1);

      // Popup
      const popup = new maplibregl.Popup({ offset: 16, closeButton: true }).setHTML(`
        <div style="font-family: 'Plus Jakarta Sans', system-ui, sans-serif; min-width: 170px; color: #18181B; padding: 2px;">
          <div style="font-weight: 600; font-size: 13px; margin-bottom: 2px;">
            Stop ${idx + 1}: ${stop.name}
          </div>
          <div style="font-size: 11px; color: #71717A; margin-bottom: 6px;">
            ${stop.address}
          </div>
          <div style="display: flex; gap: 4px; font-size: 10px; align-items: center;">
            <span style="background: #F4F1EA; color: #27272A; padding: 2px 6px; border-radius: 4px; font-family: monospace;">
              ${stop.resolvedLat.toFixed(4)}, ${stop.resolvedLng.toFixed(4)}
            </span>
            ${isLocked ? '<span style="background: #FEF3C7; color: #92400E; padding: 2px 6px; border-radius: 4px; font-weight: 500;">Fixed Invariant</span>' : ''}
          </div>
        </div>
      `);

      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (onSelectStop) onSelectStop(stop.stopId);
      });

      el.style.cursor = 'grab';
      el.style.userSelect = 'none';
      (el.style as any).webkitUserSelect = 'none';
      el.title = `Stop ${idx + 1}: ${stop.name} (Drag to pinpoint exact position)`;

      const marker = new maplibregl.Marker({ element: el, draggable: true, anchor: 'center' })
        .setLngLat([stop.resolvedLng, stop.resolvedLat])
        .setPopup(popup)
        .addTo(map);

      marker.on('dragstart', () => {
        el.style.cursor = 'grabbing';
      });

      marker.on('dragend', () => {
        el.style.cursor = 'grab';
        const lngLat = marker.getLngLat();
        marker.setLngLat(lngLat); // Anchor immediately without coordinate drift
        if (onStopMove) {
          onStopMove(stop.stopId, lngLat.lat, lngLat.lng);
        }
      });

      markersRef.current.push(marker);
    });

    // Auto-fit if stops exist and no geometry rendered yet (only on initial load)
    if (!hasFittedInitialBoundsRef.current && validStops.length > 0 && !routeGeometry) {
      hasFittedInitialBoundsRef.current = true;
      const bounds = new maplibregl.LngLatBounds();
      validStops.forEach(s => bounds.extend([s.resolvedLng, s.resolvedLat]));
      map.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 600 });
    }

    // Auto-fit camera if bulk waypoints imported or route cleared/replaced
    if (Math.abs(stops.length - prevStopsCountRef.current) > 1 && validStops.length > 0) {
      prevStopsCountRef.current = stops.length;
      const bounds = new maplibregl.LngLatBounds();
      validStops.forEach(s => bounds.extend([s.resolvedLng, s.resolvedLat]));
      map.fitBounds(bounds, { padding: 70, maxZoom: 15, duration: 800 });
    } else {
      prevStopsCountRef.current = stops.length;
    }
  }, [stops, routeGeometry, onSelectStop, onStopMove]);

  // Update Route Polyline when geometry updates
  useEffect(() => {
    if (mapInstanceRef.current && isLoadedRef.current) {
      renderRouteLayers();
    }
  }, [routeGeometry, renderRouteLayers]);

  // Center / Fit Bounds on demand
  const fitBoundsToAll = () => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const geojsonData = getGeoJsonRoute(routeGeometry);
    if (geojsonData && geojsonData.geometry.coordinates.length > 1) {
      const bounds = new maplibregl.LngLatBounds();
      geojsonData.geometry.coordinates.forEach(c => bounds.extend(c));
      map.fitBounds(bounds, { padding: 60, maxZoom: 16 });
      return;
    }

    const validStops = stops
      .map(s => ({
        lat: s.lat ?? s.latitude,
        lng: s.lng ?? s.longitude
      }))
      .filter(s => s.lat != null && s.lng != null) as Array<{ lat: number; lng: number }>;

    if (validStops.length > 0) {
      const bounds = new maplibregl.LngLatBounds();
      validStops.forEach(s => bounds.extend([s.lng, s.lat]));
      map.fitBounds(bounds, { padding: 60, maxZoom: 15 });
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
    setTimeout(() => {
      mapInstanceRef.current?.resize();
    }, 200);
  };

  return (
    <div className={`relative w-full h-full bg-[#F4F1EA] overflow-hidden ${isFullscreen ? 'fixed inset-0 z-50' : ''} ${isPinpointMode ? 'cursor-crosshair' : ''}`}>
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Pinpoint Mode Banner */}
      {isPinpointMode && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[450] flex items-center gap-2 px-4 py-2 rounded-full bg-editorial-ink text-white shadow-float text-xs font-medium animate-in fade-in duration-150">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
          <span>Crosshair Pinpoint Mode: Click anywhere on map to drop a waypoint</span>
          <button
            onClick={onTogglePinpointMode}
            className="ml-2 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-white/20 hover:bg-white/30 text-white"
          >
            Done
          </button>
        </div>
      )}

      {/* Floating Action Controls */}
      <div className="absolute top-4 right-4 z-[400] flex items-center gap-2">
        {/* Pinpoint Crosshair Tool Toggle */}
        <button
          onClick={onTogglePinpointMode}
          className={`flex items-center gap-1.5 h-8 px-2.5 rounded-xl border transition-colors shadow-card text-xs font-medium ${
            isPinpointMode
              ? 'bg-red-600 text-white border-red-700 shadow-md'
              : 'bg-white hover:bg-editorial-subsurface text-editorial-body hover:text-editorial-ink border-editorial-border'
          }`}
          title="Toggle Sub-meter Pinpoint Mode (Click map to drop waypoint)"
        >
          <Target className="w-4 h-4" />
          <span className="hidden sm:inline">{isPinpointMode ? 'Crosshair On' : 'Drop Pin'}</span>
        </button>

        {/* OpenFreeMap Style Switcher */}
        <div className="flex items-center p-0.5 rounded-xl bg-white border border-editorial-border shadow-card">
          {(Object.keys(OPENFREEMAP_STYLES) as Array<keyof typeof OPENFREEMAP_STYLES>).map((k) => (
            <button
              key={k}
              onClick={() => handleStyleChange(k as keyof typeof OPENFREEMAP_STYLES)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-mono uppercase tracking-wider transition-colors ${
                activeStyleKey === k
                  ? 'bg-editorial-ink text-white font-medium shadow-sm'
                  : 'text-editorial-body hover:text-editorial-ink'
              }`}
            >
              {OPENFREEMAP_STYLES[k as keyof typeof OPENFREEMAP_STYLES].name}
            </button>
          ))}
        </div>

        {/* Fit Bounds */}
        <button
          onClick={fitBoundsToAll}
          className="w-8 h-8 rounded-xl bg-white border border-editorial-border text-editorial-body hover:text-editorial-ink flex items-center justify-center shadow-card transition-colors"
          title="Center route bounds"
        >
          <Crosshair className="w-4 h-4" />
        </button>

        {/* Fullscreen */}
        <button
          onClick={toggleFullscreen}
          className="w-8 h-8 rounded-xl bg-white border border-editorial-border text-editorial-body hover:text-editorial-ink flex items-center justify-center shadow-card transition-colors"
          title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>

      {/* OpenFreeMap Clean Attribution Pill (No Watermarks, 100% Free Vector Tiles) */}
      <div className="absolute bottom-4 left-4 z-[400] hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/95 backdrop-blur-sm border border-editorial-border text-[11px] text-editorial-subtle shadow-card pointer-events-none">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
        <span>OpenFreeMap Vector Tiles</span>
        <span className="text-editorial-border">|</span>
        <span>Draggable Waypoints Active</span>
        <span className="text-editorial-border">|</span>
        <span>Sub-Meter Precision</span>
      </div>
    </div>
  );
};

export default Map;

import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Stop } from '../types';
import { Maximize2, Minimize2, Crosshair, Layers } from 'lucide-react';

interface MapProps {
  stops: Stop[];
  routeGeometry: any | null;
  onMapClick?: (lat: number, lng: number) => void;
  onSelectStop?: (stopId: string) => void;
}

const TILE_LAYERS = {
  voyager: {
    name: 'Voyager',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
  },
  positron: {
    name: 'Positron',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
  },
  dark: {
    name: 'Dark Matter',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
  }
};

export const Map: React.FC<MapProps> = ({
  stops,
  routeGeometry,
  onMapClick,
  onSelectStop
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const currentTileLayerRef = useRef<L.TileLayer | null>(null);

  const [activeTileKey, setActiveTileKey] = useState<keyof typeof TILE_LAYERS>('voyager');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [37.7749, -122.4194],
      zoom: 12,
      zoomControl: false,
    });

    // Custom zoom control in bottom right
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Initial tile layer
    const tileConfig = TILE_LAYERS[activeTileKey];
    const tileLayer = L.tileLayer(tileConfig.url, {
      attribution: tileConfig.attribution,
      maxZoom: 19,
      subdomains: 'abcd'
    }).addTo(map);
    currentTileLayerRef.current = tileLayer;

    // Layer groups for markers and routes
    markersLayerRef.current = L.layerGroup().addTo(map);
    routeLayerRef.current = L.layerGroup().addTo(map);

    // Click handler
    map.on('click', (e: L.LeafletMouseEvent) => {
      if (onMapClick) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Tile Layer
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (currentTileLayerRef.current) {
      map.removeLayer(currentTileLayerRef.current);
    }

    const tileConfig = TILE_LAYERS[activeTileKey];
    const newTileLayer = L.tileLayer(tileConfig.url, {
      attribution: tileConfig.attribution,
      maxZoom: 19,
      subdomains: 'abcd'
    }).addTo(map);
    currentTileLayerRef.current = newTileLayer;
  }, [activeTileKey]);

  // Update Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersGroup = markersLayerRef.current;
    if (!map || !markersGroup) return;

    markersGroup.clearLayers();

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
        bgColor = '#047857'; // Refined Emerald
      } else if (isLast) {
        bgColor = '#1D4ED8'; // Refined Royal Blue
      }

      if (isLocked) {
        bgColor = '#B45309'; // Refined Amber
        border = '2px solid #FEF3C7';
      }

      const html = `
        <div style="
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: ${bgColor};
          color: ${textColor};
          border: ${border};
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.18);
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'JetBrains Mono', monospace, sans-serif;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
        ">
          ${idx + 1}
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'rf-clean-marker',
        html,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const marker = L.marker([stop.resolvedLat, stop.resolvedLng], { icon: customIcon });

      marker.bindPopup(`
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

      marker.on('click', () => {
        if (onSelectStop) onSelectStop(stop.stopId);
      });

      markersGroup.addLayer(marker);
    });

    if (validStops.length > 0 && !routeGeometry) {
      const bounds = L.latLngBounds(validStops.map(s => [s.resolvedLat, s.resolvedLng]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [stops, routeGeometry, onSelectStop]);

  // Update Route Polyline
  useEffect(() => {
    const map = mapInstanceRef.current;
    const routeGroup = routeLayerRef.current;
    if (!map || !routeGroup) return;

    routeGroup.clearLayers();

    if (!routeGeometry) return;

    let coords: [number, number][] = [];
    if (Array.isArray(routeGeometry)) {
      if (routeGeometry.length > 0 && Array.isArray(routeGeometry[0])) {
        coords = routeGeometry.map((pt: any) => {
          if (Array.isArray(pt) && pt.length >= 2) {
            return [pt[1], pt[0]] as [number, number];
          }
          return [0, 0] as [number, number];
        });
      }
    } else if (routeGeometry.type === 'LineString' && Array.isArray(routeGeometry.coordinates)) {
      coords = routeGeometry.coordinates.map((pt: any) => [pt[1], pt[0]] as [number, number]);
    }

    if (coords.length > 1) {
      // Clean, refined navy polyline
      const pathLine = L.polyline(coords, {
        color: '#1E293B',
        weight: 4,
        opacity: 0.85,
        lineCap: 'round',
        lineJoin: 'round'
      });

      routeGroup.addLayer(pathLine);
      map.fitBounds(pathLine.getBounds(), { padding: [50, 50], maxZoom: 16 });
    }
  }, [routeGeometry]);

  const fitBoundsToAll = () => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const validStops = stops
      .map(s => ({
        lat: s.lat ?? s.latitude,
        lng: s.lng ?? s.longitude
      }))
      .filter(s => s.lat != null && s.lng != null) as Array<{ lat: number; lng: number }>;

    if (validStops.length > 0) {
      const bounds = L.latLngBounds(validStops.map(s => [s.lat, s.lng]));
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
    setTimeout(() => {
      mapInstanceRef.current?.invalidateSize();
    }, 200);
  };

  return (
    <div className={`relative w-full h-full bg-[#F4F1EA] overflow-hidden ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Floating Action Controls */}
      <div className="absolute top-4 right-4 z-[400] flex items-center gap-2">
        {/* Layer Switcher */}
        <div className="flex items-center p-0.5 rounded-xl bg-white border border-editorial-border shadow-card">
          {(Object.keys(TILE_LAYERS) as Array<keyof typeof TILE_LAYERS>).map((k) => (
            <button
              key={k}
              onClick={() => setActiveTileKey(k)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-mono uppercase tracking-wider transition-colors ${
                activeTileKey === k
                  ? 'bg-editorial-ink text-white font-medium shadow-sm'
                  : 'text-editorial-body hover:text-editorial-ink'
              }`}
            >
              {k}
            </button>
          ))}
        </div>

        {/* Fit Bounds */}
        <button
          onClick={fitBoundsToAll}
          className="w-8 h-8 rounded-xl bg-white border border-editorial-border text-editorial-body hover:text-editorial-ink flex items-center justify-center shadow-card transition-colors"
          title="Center route"
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

      {/* Subtle attribution pill */}
      <div className="absolute bottom-4 left-4 z-[400] hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/90 backdrop-blur-sm border border-editorial-border text-[11px] text-editorial-subtle shadow-card pointer-events-none">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
        <span>CartoDB Basemap</span>
        <span className="text-editorial-border">|</span>
        <span>Click map to place waypoint</span>
      </div>
    </div>
  );
};

export default Map;

import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Stop } from '../types';
import { Maximize2, Minimize2, Crosshair } from 'lucide-react';

interface MapProps {
  stops: Stop[];
  routeGeometry: any | null;
  onMapClick?: (lat: number, lng: number) => void;
  onSelectStop?: (stopId: string) => void;
}

const TILE_LAYERS = {
  dark: {
    name: 'CartoDB Dark',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
  },
  voyager: {
    name: 'CartoDB Voyager',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
  },
  osm: {
    name: 'OpenStreetMap',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
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

  const [activeTileKey, setActiveTileKey] = useState<keyof typeof TILE_LAYERS>('dark');
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

      let bgColor = 'background: linear-gradient(135deg, #00f2fe 0%, #2563eb 100%);';
      let border = 'border: 2px solid #ffffff;';
      let boxShadow = 'box-shadow: 0 0 14px rgba(0, 242, 254, 0.6);';

      if (isFirst) {
        bgColor = 'background: linear-gradient(135deg, #10b981 0%, #059669 100%);';
        boxShadow = 'box-shadow: 0 0 14px rgba(16, 185, 129, 0.6);';
      } else if (isLast) {
        bgColor = 'background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%);';
        boxShadow = 'box-shadow: 0 0 14px rgba(139, 92, 246, 0.6);';
      }

      if (isLocked) {
        border = 'border: 2px solid #f59e0b;';
        boxShadow = 'box-shadow: 0 0 14px rgba(245, 158, 11, 0.7);';
      }

      const html = `
        <div style="
          position: relative;
          width: 30px;
          height: 30px;
          border-radius: 50%;
          ${bgColor}
          ${border}
          ${boxShadow}
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-family: 'JetBrains Mono', monospace, sans-serif;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
        ">
          ${idx + 1}
          ${isLocked ? '<span style="position: absolute; top: -5px; right: -5px; font-size: 10px;">🔒</span>' : ''}
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'rf-custom-marker',
        html,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });

      const marker = L.marker([stop.resolvedLat, stop.resolvedLng], { icon: customIcon });

      marker.bindPopup(`
        <div style="font-family: system-ui, sans-serif; min-width: 160px; color: #1e293b;">
          <div style="font-weight: 700; font-size: 13px; margin-bottom: 2px;">
            #${idx + 1}: ${stop.name}
          </div>
          <div style="font-size: 11px; color: #64748b; margin-bottom: 6px;">
            ${stop.address}
          </div>
          <div style="display: flex; gap: 4px; font-size: 10px;">
            <span style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-family: monospace;">
              ${stop.resolvedLat.toFixed(4)}, ${stop.resolvedLng.toFixed(4)}
            </span>
            ${isLocked ? '<span style="background: #fef3c7; color: #b45309; padding: 2px 6px; border-radius: 4px; font-weight: 600;">Locked 🔒</span>' : ''}
          </div>
        </div>
      `);

      marker.on('click', () => {
        if (onSelectStop) onSelectStop(stop.stopId);
      });

      markersGroup.addLayer(marker);
    });

    // Auto-fit if stops exist and no geometry
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

    // Normalize coordinates to [lat, lng]
    let coords: [number, number][] = [];
    if (Array.isArray(routeGeometry)) {
      if (routeGeometry.length > 0 && Array.isArray(routeGeometry[0])) {
        // If coordinate values are [lon, lat] (GeoJSON standard) where lon is between -180..180
        coords = routeGeometry.map((pt: any) => {
          if (Array.isArray(pt) && pt.length >= 2) {
            // Assume [lon, lat] if from GeoJSON
            return [pt[1], pt[0]] as [number, number];
          }
          return [0, 0] as [number, number];
        });
      }
    } else if (routeGeometry.type === 'LineString' && Array.isArray(routeGeometry.coordinates)) {
      coords = routeGeometry.coordinates.map((pt: any) => [pt[1], pt[0]] as [number, number]);
    }

    if (coords.length > 1) {
      // Outer glow underlayer
      const glowPolyline = L.polyline(coords, {
        color: '#00f2fe',
        weight: 7,
        opacity: 0.4,
        lineCap: 'round',
        lineJoin: 'round'
      });

      // Sharp core line
      const corePolyline = L.polyline(coords, {
        color: '#2563eb',
        weight: 3.5,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round'
      });

      routeGroup.addLayer(glowPolyline);
      routeGroup.addLayer(corePolyline);

      // Fit map to polyline
      map.fitBounds(corePolyline.getBounds(), { padding: [50, 50], maxZoom: 16 });
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
    <div className={`relative w-full h-full bg-aerospace-950 overflow-hidden ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Floating Map Action Controls */}
      <div className="absolute top-4 right-4 z-[400] flex items-center gap-2">
        {/* Layer Switcher */}
        <div className="flex items-center p-1 rounded-xl bg-aerospace-900/90 backdrop-blur-md border border-cyan-500/20 shadow-aerospace">
          {(Object.keys(TILE_LAYERS) as Array<keyof typeof TILE_LAYERS>).map((k) => (
            <button
              key={k}
              onClick={() => setActiveTileKey(k)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-mono uppercase tracking-wider transition-all ${
                activeTileKey === k
                  ? 'bg-cyan-500 text-aerospace-950 font-bold shadow-glow-cyan/50'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {k}
            </button>
          ))}
        </div>

        {/* Fit Bounds Button */}
        <button
          onClick={fitBoundsToAll}
          className="w-8 h-8 rounded-xl bg-aerospace-900/90 backdrop-blur-md border border-cyan-500/20 text-cyan-400 hover:text-cyan-300 flex items-center justify-center shadow-aerospace transition-all"
          title="Center and fit all waypoints"
        >
          <Crosshair className="w-4 h-4" />
        </button>

        {/* Fullscreen Toggle */}
        <button
          onClick={toggleFullscreen}
          className="w-8 h-8 rounded-xl bg-aerospace-900/90 backdrop-blur-md border border-cyan-500/20 text-cyan-400 hover:text-cyan-300 flex items-center justify-center shadow-aerospace transition-all"
          title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Map'}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Bottom info pill */}
      <div className="absolute bottom-4 left-4 z-[400] hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-aerospace-900/85 backdrop-blur-md border border-cyan-500/15 text-[11px] text-slate-400 shadow-aerospace pointer-events-none">
        <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
        <span>Leaflet + CartoDB Road Tiles</span>
        <span className="text-slate-600">|</span>
        <span>Click map to inspect coordinates</span>
      </div>
    </div>
  );
};
export default Map;

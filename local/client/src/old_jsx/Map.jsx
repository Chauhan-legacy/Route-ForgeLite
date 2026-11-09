import React, { useEffect, useRef } from 'react';
import L from 'leaflet';

export default function Map({ stops = [], routeGeometry = null, isFallback = false }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersLayerRef = useRef(null);
  const routeLayerRef = useRef(null);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      zoomControl: true
    }).setView([48.2082, 16.3738], 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    markersLayerRef.current = L.featureGroup().addTo(map);
    routeLayerRef.current = L.geoJSON(null).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Markers and Route Layer
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersGroup = markersLayerRef.current;
    const routeGroup = routeLayerRef.current;
    if (!map || !markersGroup) return;

    markersGroup.clearLayers();
    const bounds = [];

    stops.forEach((stop, idx) => {
      if (typeof stop.latitude === 'number' && typeof stop.longitude === 'number') {
        const isLocked = stop.metadata && stop.metadata.locked;
        const icon = L.divIcon({
          className: 'rf-marker-pin-wrapper',
          html: `<div class="rf-marker-pin ${isLocked ? 'locked' : ''}">${idx + 1}</div>`,
          iconSize: [26, 26],
          iconAnchor: [13, 13]
        });

        const marker = L.marker([stop.latitude, stop.longitude], { icon });
        marker.bindPopup(`
          <strong>Stop ${idx + 1}: ${escapeHtml(stop.name)}</strong><br>
          <span style="font-size:0.8rem;color:#666;">${escapeHtml(stop.address)}</span><br>
          ${isLocked ? '<span style="color:#f59e0b;font-size:0.75rem;">Locked stop</span>' : ''}
        `);

        markersGroup.addLayer(marker);
        bounds.push([stop.latitude, stop.longitude]);
      }
    });

    if (routeGroup) {
      routeGroup.clearLayers();
      if (routeGeometry) {
        routeGroup.addData(routeGeometry);
        routeGroup.setStyle({
          color: isFallback ? '#f59e0b' : '#3b82f6',
          weight: 5,
          opacity: 0.85,
          dashArray: isFallback ? '6, 8' : null
        });
      }
    }

    if (bounds.length > 0 && (!routeGeometry || stops.length <= 1)) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    } else if (routeGeometry && routeGroup && routeGroup.getBounds().isValid()) {
      map.fitBounds(routeGroup.getBounds(), { padding: [40, 40] });
    }
  }, [stops, routeGeometry, isFallback]);

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  return (
    <div className="map-container">
      <div ref={mapContainerRef} className="map-view" />
    </div>
  );
}


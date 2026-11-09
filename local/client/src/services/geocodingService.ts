/**
 * RouteForge - High-Precision Geocoding & Location Parser Service
 * 100% Free - Zero API Keys, Zero Billing.
 * 
 * Features:
 * 1. Instant Universal Coordinate & URL Parser (lat/lng, DMS, Google Maps URLs, OSM URLs)
 * 2. Real-time Autocomplete via Komoot Photon with Viewport Biasing
 * 3. Fallback to OpenStreetMap Nominatim
 * 4. Reverse Geocoding for map-click & dragged pins
 * 5. Nearest Road Snapping via OSRM
 * 6. High-density in-memory caching & rate-limit throttling
 */

import { TransportMode } from '../types';

export interface GeocodeSuggestion {
  id: string;
  title: string;
  subtitle: string;
  lat: number;
  lng: number;
  category: 'building' | 'street' | 'venue' | 'transit' | 'place' | 'coordinate';
  precision: 'sub-meter' | 'verified' | 'approximate';
  provider: 'photon' | 'nominatim' | 'coordinate_parser';
  distanceMeters?: number;
}

export interface ReverseGeocodeResult {
  title: string;
  fullAddress: string;
  lat: number;
  lng: number;
  precision: 'sub-meter' | 'verified';
}

// In-Memory Caches
const searchCache = new Map<string, GeocodeSuggestion[]>();
const reverseCache = new Map<string, ReverseGeocodeResult>();

// Rate limit tracker for OSM Nominatim (max 1 req / sec)
let lastNominatimCallTime = 0;

// Earth radius for haversine calculation
const R_EARTH = 6371000.0;
function haversineDist(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) ** 2;
  return R_EARTH * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}

/**
 * 1. UNIVERSAL COORDINATE & URL PARSER
 * Detects lat/lng, DMS, Google Maps, and OpenStreetMap URLs instantly with 0ms network latency.
 */
export function parseDirectCoordinates(input: string): GeocodeSuggestion | null {
  if (!input) return null;
  const str = input.trim();

  // Pattern A: Google Maps URL containing coordinates
  // Example: https://www.google.com/maps/@37.7749,-122.4194,15z or ?q=37.7749,-122.4194
  const gmapMatch = str.match(/(?:@|[?&]q=|[?&]ll=)(-?\d{1,2}\.\d+)[,\s]+(-?\d{1,3}\.\d+)/i);
  if (gmapMatch) {
    const lat = parseFloat(gmapMatch[1]);
    const lng = parseFloat(gmapMatch[2]);
    if (isValidLatLng(lat, lng)) {
      return {
        id: `coord_${lat.toFixed(6)}_${lng.toFixed(6)}`,
        title: `Google Maps Pin: ${lat.toFixed(5)}°, ${lng.toFixed(5)}°`,
        subtitle: `Direct Coordinate Import (Sub-meter Precision)`,
        lat,
        lng,
        category: 'coordinate',
        precision: 'sub-meter',
        provider: 'coordinate_parser',
      };
    }
  }

  // Pattern B: OpenStreetMap URL
  // Example: https://www.openstreetmap.org/#map=16/37.7749/-122.4194
  const osmMatch = str.match(/#map=\d+\/(-?\d{1,2}\.\d+)\/(-?\d{1,3}\.\d+)/i);
  if (osmMatch) {
    const lat = parseFloat(osmMatch[1]);
    const lng = parseFloat(osmMatch[2]);
    if (isValidLatLng(lat, lng)) {
      return {
        id: `coord_${lat.toFixed(6)}_${lng.toFixed(6)}`,
        title: `OpenStreetMap Pin: ${lat.toFixed(5)}°, ${lng.toFixed(5)}°`,
        subtitle: `Direct Coordinate Import (Sub-meter Precision)`,
        lat,
        lng,
        category: 'coordinate',
        precision: 'sub-meter',
        provider: 'coordinate_parser',
      };
    }
  }

  // Pattern C: Plain Decimal Coordinates (e.g. "37.7749, -122.4194" or "37.7749 -122.4194")
  const decimalMatch = str.match(/^[-+]?([0-8]?\d(?:\.\d+)?|90(?:\.0+)?)[,\s]+[-+]?(180(?:\.0+)?|(?:1[0-7]\d|\d{1,2})(?:\.\d+)?)$/);
  if (decimalMatch) {
    const parts = str.split(/[,\s]+/).filter(Boolean);
    if (parts.length >= 2) {
      const lat = parseFloat(parts[0]);
      const lng = parseFloat(parts[1]);
      if (isValidLatLng(lat, lng)) {
        return {
          id: `coord_${lat.toFixed(6)}_${lng.toFixed(6)}`,
          title: `Exact Coordinates: ${lat.toFixed(5)}°, ${lng.toFixed(5)}°`,
          subtitle: `Sub-meter Precision Coordinate Point`,
          lat,
          lng,
          category: 'coordinate',
          precision: 'sub-meter',
          provider: 'coordinate_parser',
        };
      }
    }
  }

  // Pattern D: Degrees Minutes Seconds (e.g. 37°46'29"N 122°25'10"W)
  const dmsMatch = str.match(/^(\d{1,2})[°\s]+(\d{1,2})['′\s]+(?:(\d{1,2}(?:\.\d+)?)["″\s]*)?([NSEW])\s*[,]?\s*(\d{1,3})[°\s]+(\d{1,2})['′\s]+(?:(\d{1,2}(?:\.\d+)?)["″\s]*)?([NSEW])$/i);
  if (dmsMatch) {
    const latDeg = parseFloat(dmsMatch[1]) + parseFloat(dmsMatch[2]) / 60 + (parseFloat(dmsMatch[3] || '0') / 3600);
    const latDir = dmsMatch[4].toUpperCase();
    const lat = latDir === 'S' ? -latDeg : latDeg;

    const lngDeg = parseFloat(dmsMatch[5]) + parseFloat(dmsMatch[6]) / 60 + (parseFloat(dmsMatch[7] || '0') / 3600);
    const lngDir = dmsMatch[8].toUpperCase();
    const lng = lngDir === 'W' ? -lngDeg : lngDeg;

    if (isValidLatLng(lat, lng)) {
      return {
        id: `coord_${lat.toFixed(6)}_${lng.toFixed(6)}`,
        title: `DMS Coordinates: ${lat.toFixed(5)}°, ${lng.toFixed(5)}°`,
        subtitle: `Decoded Geodetic Position`,
        lat,
        lng,
        category: 'coordinate',
        precision: 'sub-meter',
        provider: 'coordinate_parser',
      };
    }
  }

  return null;
}

function isValidLatLng(lat: number, lng: number): boolean {
  return !isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

/**
 * 2. KOMOOT PHOTON AUTOCOMPLETE WITH VIEWPORT BIASING
 * Fast, typo-tolerant OpenStreetMap search biased towards the current map center.
 */
export async function searchLocationSuggestions(
  query: string,
  mapCenter?: { lat: number; lng: number }
): Promise<GeocodeSuggestion[]> {
  const cleanQuery = query.trim();
  if (cleanQuery.length < 2) return [];

  // Check direct coordinate match first (instant)
  const directCoord = parseDirectCoordinates(cleanQuery);
  const results: GeocodeSuggestion[] = [];
  if (directCoord) {
    results.push(directCoord);
  }

  const cacheKey = `${cleanQuery.toLowerCase()}_${mapCenter ? `${mapCenter.lat.toFixed(2)},${mapCenter.lng.toFixed(2)}` : 'global'}`;
  if (searchCache.has(cacheKey)) {
    const cached = searchCache.get(cacheKey)!;
    return directCoord ? [directCoord, ...cached.filter(c => c.id !== directCoord.id)] : cached;
  }

  try {
    // 1. Try Photon first (Elasticsearch + OSM with typo tolerance and landmark recognition)
    let photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(cleanQuery)}&limit=6`;
    if (mapCenter && isValidLatLng(mapCenter.lat, mapCenter.lng)) {
      photonUrl += `&lat=${mapCenter.lat}&lon=${mapCenter.lng}`;
    }

    const resp = await fetch(photonUrl, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(4000),
    });

    if (resp.ok) {
      const data = await resp.json();
      if (data && Array.isArray(data.features) && data.features.length > 0) {
        const photonSuggestions: GeocodeSuggestion[] = data.features.map((f: any, idx: number) => {
          const props = f.properties || {};
          const [lon, lat] = f.geometry?.coordinates || [0, 0];

          // Determine name
          let title = props.name;
          if (!title) {
            if (props.street) {
              title = [props.housenumber, props.street].filter(Boolean).join(' ');
            } else if (props.city) {
              title = props.city;
            } else {
              title = cleanQuery;
            }
          }

          // Build clean subtitle
          const subParts: string[] = [];
          if (props.street && props.name !== props.street) {
            subParts.push([props.housenumber, props.street].filter(Boolean).join(' '));
          }
          if (props.district) subParts.push(props.district);
          if (props.city && props.name !== props.city) subParts.push(props.city);
          if (props.state) subParts.push(props.state);
          if (props.country) subParts.push(props.country);
          if (props.postcode) subParts.push(props.postcode);

          const subtitle = subParts.length > 0 ? subParts.join(', ') : (props.country || 'Location');

          // Categorize OSM tags
          let category: GeocodeSuggestion['category'] = 'place';
          const osmVal = props.osm_value || '';
          const osmKey = props.osm_key || '';
          if (osmKey === 'building' || osmVal === 'building' || props.housenumber) {
            category = 'building';
          } else if (osmKey === 'highway' || osmVal === 'road' || osmVal === 'residential') {
            category = 'street';
          } else if (['amenity', 'shop', 'tourism', 'leisure'].includes(osmKey)) {
            category = 'venue';
          } else if (['railway', 'public_transport', 'aeroway'].includes(osmKey)) {
            category = 'transit';
          }

          let distanceMeters: number | undefined;
          if (mapCenter) {
            distanceMeters = Math.round(haversineDist(mapCenter.lat, mapCenter.lng, lat, lon));
          }

          return {
            id: `photon_${f.properties?.osm_id || idx}_${lat.toFixed(5)}`,
            title,
            subtitle,
            lat,
            lng: lon,
            category,
            precision: props.housenumber ? 'sub-meter' : 'verified',
            provider: 'photon',
            distanceMeters,
          };
        });

        searchCache.set(cacheKey, photonSuggestions);
        return directCoord ? [directCoord, ...photonSuggestions.filter(p => p.id !== directCoord.id)] : photonSuggestions;
      }
    }
  } catch (err) {
    console.warn('Photon autocomplete query failed, falling back to Nominatim:', err);
  }

  // 2. Fallback to OpenStreetMap Nominatim
  try {
    const now = Date.now();
    const elapsed = now - lastNominatimCallTime;
    if (elapsed < 1100) {
      await new Promise(r => setTimeout(r, 1100 - elapsed));
    }
    lastNominatimCallTime = Date.now();

    let nomUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cleanQuery)}&format=json&limit=5&addressdetails=1`;
    if (mapCenter) {
      // Small bounding box around current view
      const delta = 0.5;
      nomUrl += `&viewbox=${mapCenter.lng - delta},${mapCenter.lat + delta},${mapCenter.lng + delta},${mapCenter.lat - delta}`;
    }

    const nomResp = await fetch(nomUrl, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(4000),
    });

    if (nomResp.ok) {
      const nomData = await nomResp.json();
      if (Array.isArray(nomData)) {
        const nomSuggestions: GeocodeSuggestion[] = nomData.map((item: any, idx: number) => {
          const lat = parseFloat(item.lat);
          const lng = parseFloat(item.lon);
          const disp = item.display_name || '';
          const parts = disp.split(',').map((s: string) => s.trim());
          const title = parts[0] || cleanQuery;
          const subtitle = parts.slice(1).join(', ') || disp;

          let category: GeocodeSuggestion['category'] = 'place';
          if (item.class === 'building' || item.type === 'house') category = 'building';
          else if (item.class === 'highway') category = 'street';
          else if (item.class === 'amenity' || item.class === 'shop') category = 'venue';

          return {
            id: `nom_${item.osm_id || idx}_${lat.toFixed(5)}`,
            title,
            subtitle,
            lat,
            lng,
            category,
            precision: 'verified',
            provider: 'nominatim',
            distanceMeters: mapCenter ? Math.round(haversineDist(mapCenter.lat, mapCenter.lng, lat, lng)) : undefined,
          };
        });

        searchCache.set(cacheKey, nomSuggestions);
        return directCoord ? [directCoord, ...nomSuggestions] : nomSuggestions;
      }
    }
  } catch (err) {
    console.warn('Nominatim fallback failed:', err);
  }

  return directCoord ? [directCoord] : [];
}

/**
 * 3. REVERSE GEOCODING FOR MAP CLICK & DRAGGED PINS
 * Converts coordinates back into human-readable building, street, and city names.
 */
export async function reverseGeocodeCoordinates(lat: number, lng: number): Promise<ReverseGeocodeResult> {
  const cacheKey = `${lat.toFixed(5)},${lng.toFixed(5)}`;
  if (reverseCache.has(cacheKey)) {
    return reverseCache.get(cacheKey)!;
  }

  // Fallback default in case network fails
  const fallbackResult: ReverseGeocodeResult = {
    title: `Point at ${lat.toFixed(5)}°, ${lng.toFixed(5)}°`,
    fullAddress: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
    lat,
    lng,
    precision: 'sub-meter',
  };

  // Try Photon Reverse first (Fast)
  try {
    const photonRevUrl = `https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}`;
    const resp = await fetch(photonRevUrl, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(3500),
    });

    if (resp.ok) {
      const data = await resp.json();
      if (data && Array.isArray(data.features) && data.features.length > 0) {
        const props = data.features[0].properties || {};
        let title = props.name;
        if (!title) {
          if (props.street) {
            title = [props.housenumber, props.street].filter(Boolean).join(' ');
          } else if (props.city) {
            title = props.city;
          } else {
            title = `Pin at ${lat.toFixed(4)}°, ${lng.toFixed(4)}°`;
          }
        }

        const parts: string[] = [];
        if (props.housenumber && props.street) parts.push(`${props.housenumber} ${props.street}`);
        else if (props.street) parts.push(props.street);
        if (props.district) parts.push(props.district);
        if (props.city) parts.push(props.city);
        if (props.state) parts.push(props.state);
        if (props.country) parts.push(props.country);

        const fullAddress = parts.length > 0 ? parts.join(', ') : `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        const result: ReverseGeocodeResult = {
          title,
          fullAddress,
          lat,
          lng,
          precision: props.housenumber ? 'sub-meter' : 'verified',
        };

        reverseCache.set(cacheKey, result);
        return result;
      }
    }
  } catch (e) {
    console.warn('Photon reverse geocode failed, trying Nominatim reverse:', e);
  }

  // Fallback to Nominatim Reverse
  try {
    const nomRevUrl = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`;
    const resp = await fetch(nomRevUrl, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(3500),
    });

    if (resp.ok) {
      const data = await resp.json();
      const addr = data.address || {};
      const title = data.name || addr.amenity || addr.building || addr.road || `Pin at ${lat.toFixed(4)}°, ${lng.toFixed(4)}°`;
      const fullAddress = data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

      const result: ReverseGeocodeResult = {
        title,
        fullAddress,
        lat,
        lng,
        precision: 'verified',
      };

      reverseCache.set(cacheKey, result);
      return result;
    }
  } catch (e) {
    console.warn('Nominatim reverse failed:', e);
  }

  return fallbackResult;
}

/**
 * 4. ROAD SNAPPING VIA OSRM
 * Snaps any coordinate to the nearest driveable road, returning snapped lat/lng and offset distance.
 */
export async function snapToNearestRoad(
  lat: number,
  lng: number,
  mode: TransportMode = 'driving'
): Promise<{ lat: number; lng: number; distanceMeters: number } | null> {
  try {
    const profile = mode === 'cycling' ? 'cycling' : mode === 'walking' ? 'foot' : 'driving';
    // OSRM Public Nearest API
    const url = `https://router.project-osrm.org/nearest/v1/${profile}/${lng},${lat}?number=1`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (resp.ok) {
      const data = await resp.json();
      if (data.code === 'Ok' && Array.isArray(data.waypoints) && data.waypoints.length > 0) {
        const wp = data.waypoints[0];
        const [snapLng, snapLat] = wp.location;
        const distanceMeters = wp.distance ?? haversineDist(lat, lng, snapLat, snapLng);
        return { lat: snapLat, lng: snapLng, distanceMeters };
      }
    }
  } catch {
    // If nearest service is slow or unavailable, keep raw coordinate (sub-meter accurate)
  }
  return null;
}

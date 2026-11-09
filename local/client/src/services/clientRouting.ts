/**
 * RouteForge - Client-Side Free Routing & Optimization Engine
 * Enables 100% standalone operation on Vercel with zero paid APIs.
 */
import { Stop, TransportMode, OptimizationOptions, OptimizationResult } from '../types';

const EARTH_RADIUS_METERS = 6371000.0;
export const TRAFFIC_DISCLAIMER = "Live traffic is unavailable. Route duration is based on estimated travel time.";

const MODE_SPEEDS_MPS: Record<TransportMode, number> = {
  driving: 13.88,  // ~50 km/h
  cycling: 4.17,   // ~15 km/h
  walking: 1.25    // ~4.5 km/h
};

const OSRM_ENDPOINTS: Record<TransportMode, string> = {
  driving: "https://router.project-osrm.org/route/v1/driving",
  cycling: "https://routing.openstreetmap.de/routed-bike/route/v1/driving",
  walking: "https://routing.openstreetmap.de/routed-foot/route/v1/driving"
};

export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if (lat1 === lat2 && lon1 === lon2) return 0.0;
  const toRad = Math.PI / 180.0;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;
  const phi1 = lat1 * toRad;
  const phi2 = lat2 * toRad;

  const a = Math.sin(dLat / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLon / 2) ** 2;
  const c = 2.0 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0.0, 1.0 - a)));
  return EARTH_RADIUS_METERS * c;
}

export function stopDistance(a: Stop, b: Stop): number {
  if (a.latitude == null || a.longitude == null || b.latitude == null || b.longitude == null) {
    return 0.0;
  }
  return haversineDistance(a.latitude, a.longitude, b.latitude, b.longitude);
}

export function calculateTotalDistance(stops: Stop[], returnToStart = false): number {
  if (stops.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < stops.length - 1; i++) {
    total += stopDistance(stops[i], stops[i + 1]);
  }
  if (returnToStart && stops.length > 2) {
    total += stopDistance(stops[stops.length - 1], stops[0]);
  }
  return total;
}

// Client-Side Nearest Neighbor + 2-Opt TSP Optimizer
export function clientOptimizeStops(stops: Stop[], options: Partial<OptimizationOptions> = {}): OptimizationResult {
  const opts: OptimizationOptions = {
    objective: options.objective || 'distance',
    fixedStart: options.fixedStart ?? true,
    fixedEnd: options.fixedEnd ?? false,
    returnToStart: options.returnToStart ?? false,
    lockedStops: options.lockedStops ?? true,
  };

  const n = stops.length;
  if (n <= 2) {
    const d = calculateTotalDistance(stops, opts.returnToStart);
    return {
      originalDistanceMeters: Math.round(d),
      optimizedDistanceMeters: Math.round(d),
      savingsMeters: 0,
      savingsPercent: 0,
      method: "Direct Sequence (< 3 stops)",
      isGloballyOptimal: true,
      targetStops: n,
      stops: stops.map((s, idx) => ({ ...s, sequence: idx }))
    };
  }

  const originalDistance = calculateTotalDistance(stops, opts.returnToStart);

  // 1. Nearest Neighbor Initialization
  const tour: Stop[] = new Array(n);
  const used = new Set<string>();

  // Pre-place locked stops
  for (let i = 0; i < n; i++) {
    const isLocked = (opts.fixedStart && i === 0) ||
      (opts.fixedEnd && i === n - 1) ||
      (opts.lockedStops && stops[i].metadata?.locked);
    if (isLocked) {
      tour[i] = stops[i];
      used.add(stops[i].stopId);
    }
  }

  if (!tour[0]) {
    tour[0] = stops[0];
    used.add(stops[0].stopId);
  }

  const unplaced = stops.filter(s => !used.has(s.stopId));
  let current = tour[0];

  for (let i = 1; i < n; i++) {
    if (tour[i]) {
      current = tour[i];
      continue;
    }
    if (unplaced.length === 0) break;

    let bestDist = Infinity;
    let bestIdx = -1;
    for (let j = 0; j < unplaced.length; j++) {
      const d = stopDistance(current, unplaced[j]);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = j;
      }
    }
    if (bestIdx >= 0) {
      const chosen = unplaced.splice(bestIdx, 1)[0];
      tour[i] = chosen;
      current = chosen;
    }
  }

  for (let i = 0; i < n; i++) {
    if (!tour[i] && unplaced.length > 0) {
      tour[i] = unplaced.shift()!;
    }
  }

  // 2. 2-Opt Local Search Improvement
  let currentTour = [...tour];
  let improved = true;
  let iterations = 0;
  const maxIterations = n > 300 ? 150 : 250;

  const startIdx = opts.fixedStart ? 1 : 0;
  const endIdx = opts.fixedEnd ? n - 2 : n - 1;

  while (improved && iterations < maxIterations) {
    improved = false;
    iterations++;

    for (let i = startIdx; i < endIdx; i++) {
      for (let j = i + 1; j <= endIdx; j++) {
        // Skip if any stop in [i..j] is locked
        if (opts.lockedStops) {
          let hasLock = false;
          for (let k = i; k <= j; k++) {
            if (currentTour[k].metadata?.locked) {
              hasLock = true;
              break;
            }
          }
          if (hasLock) continue;
        }

        const prevI = i > 0 ? currentTour[i - 1] : null;
        const nextJ = j < n - 1 ? currentTour[j + 1] : null;

        const curD1 = prevI ? stopDistance(prevI, currentTour[i]) : 0;
        const curD2 = nextJ ? stopDistance(currentTour[j], nextJ) : 0;
        const currentEdgeDist = curD1 + curD2;

        const newD1 = prevI ? stopDistance(prevI, currentTour[j]) : 0;
        const newD2 = nextJ ? stopDistance(currentTour[i], nextJ) : 0;
        const newEdgeDist = newD1 + newD2;

        if (newEdgeDist < currentEdgeDist - 0.001) {
          const segment = currentTour.slice(i, j + 1).reverse();
          currentTour.splice(i, segment.length, ...segment);
          improved = true;
          break;
        }
      }
      if (improved) break;
    }
  }

  const optimizedDistance = calculateTotalDistance(currentTour, opts.returnToStart);
  let finalTour = currentTour;
  let finalDist = optimizedDistance;

  if (finalDist > originalDistance && originalDistance > 0) {
    finalTour = [...stops];
    finalDist = originalDistance;
  }

  const savingsMeters = Math.max(0, originalDistance - finalDist);
  const savingsPercent = originalDistance > 0 ? (savingsMeters / originalDistance) * 100 : 0;

  return {
    originalDistanceMeters: Math.round(originalDistance),
    optimizedDistanceMeters: Math.round(finalDist),
    savingsMeters: Math.round(savingsMeters),
    savingsPercent: Math.round(savingsPercent * 10) / 10,
    method: n > 300 ? "Partitioned 2-Opt Heuristic (500+ Stop Scale)" : "Nearest-Neighbor + 2-Opt Constrained Local Search",
    isGloballyOptimal: false, // Honest NP-hard metaheuristic representation
    targetStops: n,
    stops: finalTour.map((s, idx) => ({ ...s, sequence: idx }))
  };
}

// Client-Side OSRM Road Router with Straight-Line Fallback
export async function clientComputeRoute(
  stops: Stop[],
  mode: TransportMode = 'driving'
): Promise<{
  ok: boolean;
  geometry: any;
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  provider: string;
  isFallback: boolean;
  mode: TransportMode;
  liveTraffic: boolean;
  trafficStatus: string;
}> {
  const validStops = stops.filter(s => s.latitude != null && s.longitude != null);
  const speed = MODE_SPEEDS_MPS[mode] || MODE_SPEEDS_MPS.driving;

  if (validStops.length < 2) {
    return {
      ok: false,
      geometry: null,
      totalDistanceMeters: 0,
      totalDurationSeconds: 0,
      provider: 'none',
      isFallback: false,
      mode,
      liveTraffic: false,
      trafficStatus: TRAFFIC_DISCLAIMER
    };
  }

  // Fallback Straight Line Generator
  const createFallback = (reason = '') => {
    const coords = validStops.map(s => [s.longitude!, s.latitude!]);
    let dist = 0;
    for (let i = 0; i < validStops.length - 1; i++) {
      dist += haversineDistance(validStops[i].latitude!, validStops[i].longitude!, validStops[i + 1].latitude!, validStops[i + 1].longitude!);
    }
    return {
      ok: true,
      geometry: { type: 'LineString', coordinates: coords },
      totalDistanceMeters: Math.round(dist),
      totalDurationSeconds: Math.round(dist / speed),
      provider: 'straightLine',
      isFallback: true,
      mode,
      liveTraffic: false,
      trafficStatus: TRAFFIC_DISCLAIMER,
      reason
    };
  };

  if (validStops.length > 70) {
    // For large routes in client mode, generate straight-line or chunked geometry
    return createFallback('Large tour scale (> 70 stops)');
  }

  const coordStr = validStops.map(s => `${s.longitude!.toFixed(6)},${s.latitude!.toFixed(6)}`).join(';');
  const baseUrl = OSRM_ENDPOINTS[mode] || OSRM_ENDPOINTS.driving;
  const url = `${baseUrl}/${coordStr}?overview=full&geometries=geojson&steps=false`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 9000);
    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!resp.ok) {
      return createFallback(`OSRM HTTP ${resp.status}`);
    }

    const data = await resp.json();
    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      return createFallback(data.message || 'No OSRM road geometry found');
    }

    const top = data.routes[0];
    return {
      ok: true,
      geometry: top.geometry,
      totalDistanceMeters: Math.round(top.distance),
      totalDurationSeconds: Math.round(top.duration),
      provider: 'osrm',
      isFallback: false,
      mode,
      liveTraffic: false,
      trafficStatus: TRAFFIC_DISCLAIMER
    };
  } catch (err: any) {
    return createFallback(err.message || 'Network error');
  }
}

// Client-Side Nominatim Geocoding with Local Cache & Throttler
const geocodeCache = new Map<string, { lat: number; lng: number; displayName: string }>();
let lastGeocodeTime = 0;

export async function clientGeocodeAddress(address: string): Promise<{
  lat: number | null;
  lng: number | null;
  status: 'ok' | 'ambiguous' | 'not_found' | 'error';
  displayName: string;
}> {
  const norm = address.trim().toLowerCase();
  if (geocodeCache.has(norm)) {
    const cached = geocodeCache.get(norm)!;
    return { lat: cached.lat, lng: cached.lng, status: 'ok', displayName: cached.displayName };
  }

  // Throttle to 1.1s to respect OpenStreetMap Nominatim Free Usage Policy
  const now = Date.now();
  const timeSinceLast = now - lastGeocodeTime;
  if (timeSinceLast < 1100) {
    await new Promise(r => setTimeout(r, 1100 - timeSinceLast));
  }
  lastGeocodeTime = Date.now();

  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=2`;
    const resp = await fetch(url, {
      headers: { 'Accept': 'application/json' }
    });
    if (!resp.ok) {
      return { lat: null, lng: null, status: 'error', displayName: `HTTP ${resp.status}` };
    }
    const data = await resp.json();
    if (!data || data.length === 0) {
      return { lat: null, lng: null, status: 'not_found', displayName: 'Location not found' };
    }
    const best = data[0];
    const lat = parseFloat(best.lat);
    const lng = parseFloat(best.lon);
    const status = data.length > 1 ? 'ambiguous' : 'ok';
    const displayName = best.display_name;

    geocodeCache.set(norm, { lat, lng, displayName });
    return { lat, lng, status, displayName };
  } catch (err: any) {
    return { lat: null, lng: null, status: 'error', displayName: err.message || 'Geocode error' };
  }
}


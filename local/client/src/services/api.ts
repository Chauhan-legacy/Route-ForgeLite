/**
 * RouteForge - Hybrid API Service
 * Transparently interfaces with Python FastAPI backend or client-side engine.
 */
import { Stop, RouteData, TransportMode, OptimizationOptions, OptimizationResult } from '../types';
import { clientOptimizeStops, clientComputeRoute, clientGeocodeAddress } from './clientRouting';

const API_BASE = import.meta.env.VITE_API_URL || '';

let isBackendAvailable = true;

export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/health`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });
    const data = await res.json();
    isBackendAvailable = res.ok && data.ok;
    return isBackendAvailable;
  } catch {
    isBackendAvailable = false;
    return false;
  }
}

async function postApi(endpoint: string, payload: any = {}): Promise<any> {
  const res = await fetch(`${API_BASE}/api/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const json = await res.json();
  if (!res.ok || !json.ok) {
    const err: any = new Error(json.error?.message || `API error on ${endpoint}`);
    err.code = json.error?.code || 'UNKNOWN';
    err.status = res.status;
    throw err;
  }
  return json;
}

export async function getRoute(routeId: string): Promise<{ route: RouteData; stops: Stop[]; revision: number }> {
  if (isBackendAvailable) {
    try {
      const res = await postApi('getRoute', { routeId });
      return {
        route: res.data.route,
        stops: res.data.stops,
        revision: res.revision,
      };
    } catch (e) {
      console.warn("Backend getRoute failed, falling back to local storage:", e);
    }
  }

  // Local storage fallback for Vercel standalone preview
  const stored = localStorage.getItem(`rf_route_${routeId}`);
  if (stored) {
    return JSON.parse(stored);
  }

  const newRoute: RouteData = {
    routeId,
    title: 'Aerospace Flight Run #1',
    revision: 1,
    status: 'active',
  };
  return { route: newRoute, stops: [], revision: 1 };
}

export async function createRoute(title = 'New Mission Run'): Promise<{ routeId: string; revision: number }> {
  if (isBackendAvailable) {
    try {
      const res = await postApi('createRoute', { title });
      return { routeId: res.data.routeId, revision: res.revision };
    } catch (e) {
      console.warn("Backend createRoute failed, creating client route:", e);
    }
  }

  const routeId = `rf_${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
  const routeObj = {
    route: { routeId, title, revision: 1, status: 'active' },
    stops: [],
    revision: 1,
  };
  localStorage.setItem(`rf_route_${routeId}`, JSON.stringify(routeObj));
  return { routeId, revision: 1 };
}

export async function addStop(
  routeId: string,
  expectedRevision: number,
  address: string,
  name?: string
): Promise<{ stop: Stop; revision: number }> {
  if (isBackendAvailable) {
    try {
      const res = await postApi('addStop', {
        routeId,
        expectedRevision,
        stop: { address, name: name || address.split(',')[0].trim() || 'Stop' },
      });
      return { stop: res.data, revision: res.revision };
    } catch (e) {
      console.warn("Backend addStop failed, geocoding on client:", e);
    }
  }

  // Client-side geocoding & storage
  const geo = await clientGeocodeAddress(address);
  const stopId = `stop_${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
  const newStop: Stop = {
    stopId,
    routeId,
    sequence: 999,
    name: name || address.split(',')[0].trim() || 'Stop',
    address,
    latitude: geo.lat,
    longitude: geo.lng,
    metadata: {
      geocodeStatus: geo.status,
      displayName: geo.displayName,
      locked: false,
    },
  };

  const stored = await getRoute(routeId);
  newStop.sequence = stored.stops.length;
  stored.stops.push(newStop);
  stored.revision = expectedRevision + 1;
  localStorage.setItem(`rf_route_${routeId}`, JSON.stringify(stored));

  return { stop: newStop, revision: stored.revision };
}

export async function removeStop(routeId: string, expectedRevision: number, stopId: string): Promise<{ revision: number }> {
  if (isBackendAvailable) {
    try {
      const res = await postApi('removeStop', { routeId, expectedRevision, stopId });
      return { revision: res.revision };
    } catch (e) {
      console.warn("Backend removeStop failed, handling on client:", e);
    }
  }

  const stored = await getRoute(routeId);
  stored.stops = stored.stops.filter(s => s.stopId !== stopId);
  stored.stops.forEach((s, idx) => { s.sequence = idx; });
  stored.revision = expectedRevision + 1;
  localStorage.setItem(`rf_route_${routeId}`, JSON.stringify(stored));
  return { revision: stored.revision };
}

export async function reorderStops(
  routeId: string,
  expectedRevision: number,
  sequence: string[]
): Promise<{ stops: Stop[]; revision: number }> {
  if (isBackendAvailable) {
    try {
      const res = await postApi('reorderStops', { routeId, expectedRevision, sequence });
      return { stops: res.data, revision: res.revision };
    } catch (e) {
      console.warn("Backend reorderStops failed, handling on client:", e);
    }
  }

  const stored = await getRoute(routeId);
  const mapById = new Map(stored.stops.map(s => [s.stopId, s]));
  const reordered: Stop[] = [];
  sequence.forEach((id, idx) => {
    const stop = mapById.get(id);
    if (stop) {
      reordered.push({ ...stop, sequence: idx });
    }
  });
  stored.stops = reordered;
  stored.revision = expectedRevision + 1;
  localStorage.setItem(`rf_route_${routeId}`, JSON.stringify(stored));
  return { stops: reordered, revision: stored.revision };
}

export async function updateStop(
  routeId: string,
  expectedRevision: number,
  stopId: string,
  changes: Partial<Stop>
): Promise<{ stop: Stop; revision: number }> {
  if (isBackendAvailable) {
    try {
      const res = await postApi('updateStop', { routeId, expectedRevision, stopId, changes });
      return { stop: res.data, revision: res.revision };
    } catch (e) {
      console.warn("Backend updateStop failed, handling on client:", e);
    }
  }

  const stored = await getRoute(routeId);
  const idx = stored.stops.findIndex(s => s.stopId === stopId);
  if (idx !== -1) {
    stored.stops[idx] = { ...stored.stops[idx], ...changes };
  }
  stored.revision = expectedRevision + 1;
  localStorage.setItem(`rf_route_${routeId}`, JSON.stringify(stored));
  return { stop: stored.stops[idx], revision: stored.revision };
}

export async function calculateRoute(
  routeId: string,
  stops: Stop[],
  mode: TransportMode = 'driving'
): Promise<any> {
  if (isBackendAvailable) {
    try {
      const res = await postApi('calculateRoute', {
        routeId,
        provider: 'osrm',
        mode,
        allowFallback: true,
      });
      return res.data;
    } catch (e) {
      console.warn("Backend calculateRoute failed, calculating on client:", e);
    }
  }

  return await clientComputeRoute(stops, mode);
}

export async function optimizeRoute(
  routeId: string,
  stops: Stop[],
  options: Partial<OptimizationOptions> = {}
): Promise<OptimizationResult & { revision: number }> {
  if (isBackendAvailable) {
    try {
      const res = await postApi('optimizeRoute', { routeId, options });
      return {
        ...res.data,
        revision: res.revision,
      };
    } catch (e) {
      console.warn("Backend optimizeRoute failed, optimizing on client:", e);
    }
  }

  const result = clientOptimizeStops(stops, options);
  const stored = await getRoute(routeId);
  stored.stops = result.stops;
  stored.revision = (stored.revision || 1) + 1;
  localStorage.setItem(`rf_route_${routeId}`, JSON.stringify(stored));

  return {
    ...result,
    revision: stored.revision,
  };
}

export async function listRoutes(): Promise<RouteData[]> {
  if (isBackendAvailable) {
    try {
      const res = await fetch(`${API_BASE}/api/listRoutes`);
      const data = await res.json();
      if (data.ok) return data.data;
    } catch {}
  }

  // Scan localStorage for routes
  const routes: RouteData[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('rf_route_')) {
      try {
        const val = JSON.parse(localStorage.getItem(key)!);
        if (val.route) routes.push(val.route);
      } catch {}
    }
  }
  return routes;
}


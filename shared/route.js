/**
 * RouteForge - Shared Routing Provider Abstraction
 * Supports OSRM road routing as primary and an explicitly labeled straight-line fallback.
 * UMD module compatible with Node.js, browsers, and Google Apps Script.
 */
(function (root, factory) {
  if (typeof exports === 'object' && typeof module !== 'undefined') {
    const f = factory();
    module.exports = f;
    Object.assign(exports, f);
  } else if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else {
    root.RouteForgeRoute = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const EARTH_RADIUS_METERS = 6371000;
  const FALLBACK_SPEED_MPS = 13.88; // ~50 km/h average straight-line speed estimate

  /**
   * Calculates Haversine distance in meters.
   */
  function haversineMeters(lat1, lon1, lat2, lon2) {
    if (lat1 === lat2 && lon1 === lon2) return 0;
    const toRad = Math.PI / 180;
    const dLat = (lat2 - lat1) * toRad;
    const dLon = (lon2 - lon1) * toRad;
    const phi1 = lat1 * toRad;
    const phi2 = lat2 * toRad;

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return EARTH_RADIUS_METERS * c;
  }

  /**
   * Computes a straight-line route between stops.
   * Clearly marked as straightLine provider.
   * @param {Array<Object>} validStops
   * @returns {Object}
   */
  function computeStraightLineRoute(validStops) {
    const coordinates = validStops.map(s => [s.longitude, s.latitude]);
    const legs = [];
    let totalDistanceMeters = 0;

    for (let i = 0; i < validStops.length - 1; i++) {
      const from = validStops[i];
      const to = validStops[i + 1];
      const dist = haversineMeters(from.latitude, from.longitude, to.latitude, to.longitude);
      const dur = dist / FALLBACK_SPEED_MPS;

      legs.push({
        distanceMeters: Math.round(dist),
        durationSeconds: Math.round(dur),
        summary: `Straight-line from Stop ${i + 1} to Stop ${i + 2}`
      });
      totalDistanceMeters += dist;
    }

    const totalDurationSeconds = totalDistanceMeters / FALLBACK_SPEED_MPS;

    return {
      ok: true,
      data: {
        legs,
        geometry: {
          type: 'LineString',
          coordinates
        },
        totalDistanceMeters: Math.round(totalDistanceMeters),
        totalDurationSeconds: Math.round(totalDurationSeconds),
        provider: 'straightLine',
        isFallback: true,
        disclaimer: 'Straight-line estimate only. Road geometry and driving directions are unavailable.'
      }
    };
  }

  /**
   * Calls OSRM public routing API to compute road directions.
   * @param {Array<Object>} stops
   * @param {Object} [options]
   * @param {Function} [options.fetchFn]
   * @param {string} [options.osrmUrl]
   * @param {boolean} [options.allowFallback=false]
   * @returns {Promise<Object>}
   */
  async function computeRoadRoute(stops, options = {}) {
    // Filter stops that have valid numeric coordinates
    const validStops = stops.filter(
      s =>
        s &&
        typeof s.latitude === 'number' &&
        !isNaN(s.latitude) &&
        typeof s.longitude === 'number' &&
        !isNaN(s.longitude)
    );

    if (validStops.length < 2) {
      return {
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'At least two geocoded stops with valid latitude and longitude are required for routing.'
        }
      };
    }

    if (options.provider === 'straightLine') {
      return computeStraightLineRoute(validStops);
    }

    // Coordinates formatted for OSRM: {lng},{lat};{lng},{lat}...
    const coordString = validStops
      .map(s => `${s.longitude.toFixed(6)},${s.latitude.toFixed(6)}`)
      .join(';');

    const baseUrl = options.osrmUrl || 'https://router.project-osrm.org/route/v1/driving';
    const url = `${baseUrl}/${coordString}?overview=full&geometries=geojson&steps=false`;

    const fetcher = options.fetchFn || (typeof fetch !== 'undefined' ? fetch : null);
    if (!fetcher) {
      if (options.allowFallback) {
        return computeStraightLineRoute(validStops);
      }
      return {
        ok: false,
        error: {
          code: 'PROVIDER_UNAVAILABLE',
          message: 'No HTTP fetch client available to query OSRM routing provider.'
        }
      };
    }

    try {
      const response = await fetcher(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'RouteForge/1.0 (Collaborative Route Planner; contact@routeforge.local)'
        }
      });

      if (!response.ok) {
        if (options.allowFallback) {
          const fallback = computeStraightLineRoute(validStops);
          fallback.data.providerError = `OSRM returned HTTP ${response.status}`;
          return fallback;
        }
        return {
          ok: false,
          error: {
            code: 'PROVIDER_UNAVAILABLE',
            message: `OSRM routing service responded with HTTP status ${response.status}.`
          }
        };
      }

      const json = await response.json();

      if (json.code !== 'Ok' || !Array.isArray(json.routes) || json.routes.length === 0) {
        if (options.allowFallback) {
          const fallback = computeStraightLineRoute(validStops);
          fallback.data.providerError = json.message || 'No route found by OSRM';
          return fallback;
        }
        return {
          ok: false,
          error: {
            code: 'PROVIDER_UNAVAILABLE',
            message: `OSRM routing failed: ${json.message || 'No valid route found between the specified points.'}`
          }
        };
      }

      const topRoute = json.routes[0];
      const legs = (topRoute.legs || []).map((leg, i) => ({
        distanceMeters: Math.round(leg.distance || 0),
        durationSeconds: Math.round(leg.duration || 0),
        summary: leg.summary || `Stop ${i + 1} to Stop ${i + 2}`
      }));

      return {
        ok: true,
        data: {
          legs,
          geometry: topRoute.geometry, // GeoJSON LineString: { type: 'LineString', coordinates: [[lng, lat], ...] }
          totalDistanceMeters: Math.round(topRoute.distance || 0),
          totalDurationSeconds: Math.round(topRoute.duration || 0),
          provider: 'osrm',
          isFallback: false
        }
      };
    } catch (err) {
      if (options.allowFallback) {
        const fallback = computeStraightLineRoute(validStops);
        fallback.data.providerError = err.message;
        return fallback;
      }
      return {
        ok: false,
        error: {
          code: 'PROVIDER_UNAVAILABLE',
          message: `Unable to connect to OSRM routing service: ${err.message}`
        }
      };
    }
  }

  return {
    haversineMeters,
    computeStraightLineRoute,
    computeRoadRoute
  };
});

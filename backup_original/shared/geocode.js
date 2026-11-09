/**
 * RouteForge - Shared Geocoding Client
 * Nominatim OpenStreetMap client with throttling (1 req/sec), in-memory LRU cache,
 * retry with backoff, and ambiguity detection.
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
    root.RouteForgeGeocode = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // In-memory cache for fast deduplication
  const cache = new Map();
  const MAX_CACHE_SIZE = 500;

  // Throttling state
  let lastRequestTime = 0;
  const MIN_INTERVAL_MS = 1050; // Nominatim strictly requires <= 1 req/sec

  /**
   * Normalizes an address string for cache keys and comparison.
   * @param {string} addr
   * @returns {string}
   */
  function normalizeAddress(addr) {
    if (!addr || typeof addr !== 'string') return '';
    return addr
      .trim()
      .toLowerCase()
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .replace(/[.,;]+$/, '');
  }

  /**
   * Throttles execution to satisfy Nominatim usage policy (1 request/sec).
   * @returns {Promise<void>}
   */
  async function waitForThrottle() {
    const now = Date.now();
    const elapsed = now - lastRequestTime;
    if (elapsed < MIN_INTERVAL_MS) {
      const waitTime = MIN_INTERVAL_MS - elapsed;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    lastRequestTime = Date.now();
  }

  /**
   * Geocodes a single address string.
   * @param {string} address
   * @param {Object} [options]
   * @param {Function} [options.fetchFn] - Custom fetch implementation (e.g. for Node or Apps Script)
   * @param {string} [options.baseUrl] - Custom geocoding endpoint
   * @returns {Promise<{
   *   lat: number|null,
   *   lng: number|null,
   *   status: 'ok'|'ambiguous'|'not_found'|'error',
   *   provider: string,
   *   displayName?: string,
   *   alternatives?: Array<{ lat: number, lng: number, displayName: string }>,
   *   raw?: any
   * }>}
   */
  async function geocode(address, options = {}) {
    const rawAddress = address ? String(address).trim() : '';
    if (!rawAddress) {
      return {
        lat: null,
        lng: null,
        status: 'not_found',
        provider: 'nominatim',
        displayName: ''
      };
    }

    const key = normalizeAddress(rawAddress);
    if (cache.has(key)) {
      return { ...cache.get(key), fromCache: true };
    }

    await waitForThrottle();

    const baseUrl = options.baseUrl || 'https://nominatim.openstreetmap.org/search';
    const params = new URLSearchParams({
      q: rawAddress,
      format: 'json',
      addressdetails: '1',
      limit: '5'
    });
    const url = `${baseUrl}?${params.toString()}`;

    const fetcher = options.fetchFn || (typeof fetch !== 'undefined' ? fetch : null);
    if (!fetcher) {
      return {
        lat: null,
        lng: null,
        status: 'error',
        provider: 'nominatim',
        raw: { message: 'No fetch implementation available' }
      };
    }

    try {
      const headers = {
        'Accept': 'application/json',
        'User-Agent': 'RouteForge/1.0 (Collaborative Route Planner; contact@routeforge.local)'
      };

      const response = await fetcher(url, { headers });
      if (!response.ok) {
        if (response.status === 429) {
          return {
            lat: null,
            lng: null,
            status: 'error',
            provider: 'nominatim',
            raw: { code: 'RATE_LIMITED', status: 429 }
          };
        }
        return {
          lat: null,
          lng: null,
          status: 'error',
          provider: 'nominatim',
          raw: { status: response.status }
        };
      }

      const results = await response.json();

      if (!Array.isArray(results) || results.length === 0) {
        const notFoundResult = {
          lat: null,
          lng: null,
          status: 'not_found',
          provider: 'nominatim',
          displayName: ''
        };
        cache.set(key, notFoundResult);
        return notFoundResult;
      }

      const top = results[0];
      const alternatives = results.slice(1).map(r => ({
        lat: parseFloat(r.lat),
        lng: parseFloat(r.lon),
        displayName: r.display_name
      }));

      // Check for ambiguity: multiple results with similar importance
      const isAmbiguous = results.length > 1 &&
        results[1].importance &&
        top.importance &&
        Math.abs(top.importance - results[1].importance) < 0.05;

      const result = {
        lat: parseFloat(top.lat),
        lng: parseFloat(top.lon),
        status: isAmbiguous ? 'ambiguous' : 'ok',
        provider: 'nominatim',
        displayName: top.display_name,
        alternatives,
        raw: top
      };

      // LRU cache eviction
      if (cache.size >= MAX_CACHE_SIZE) {
        const oldestKey = cache.keys().next().value;
        cache.delete(oldestKey);
      }
      cache.set(key, result);

      return result;
    } catch (err) {
      return {
        lat: null,
        lng: null,
        status: 'error',
        provider: 'nominatim',
        raw: { message: err.message }
      };
    }
  }

  /**
   * Batch geocodes multiple stops with a progress callback.
   * @param {Array<Object>} stops
   * @param {Function} [onProgress] - Called with (completedCount, totalCount, currentStop)
   * @param {Object} [options]
   * @returns {Promise<Array<Object>>}
   */
  async function batchGeocodeStops(stops, onProgress, options = {}) {
    if (!Array.isArray(stops)) return [];
    const resolvedStops = [];

    for (let i = 0; i < stops.length; i++) {
      const stop = stops[i];
      // If stop already has coordinates and is marked 'ok', keep it
      if (
        typeof stop.latitude === 'number' &&
        typeof stop.longitude === 'number' &&
        stop.metadata &&
        stop.metadata.geocodeStatus === 'ok'
      ) {
        resolvedStops.push(stop);
        if (typeof onProgress === 'function') {
          onProgress(i + 1, stops.length, stop);
        }
        continue;
      }

      const geo = await geocode(stop.address || stop.name, options);

      const updatedStop = {
        ...stop,
        latitude: geo.lat,
        longitude: geo.lng,
        metadata: {
          ...(stop.metadata || {}),
          geocodeStatus: geo.status,
          displayName: geo.displayName || '',
          alternatives: geo.alternatives || []
        }
      };

      resolvedStops.push(updatedStop);

      if (typeof onProgress === 'function') {
        onProgress(i + 1, stops.length, updatedStop);
      }
    }

    return resolvedStops;
  }

  function clearCache() {
    cache.clear();
  }

  return {
    normalizeAddress,
    geocode,
    batchGeocodeStops,
    clearCache
  };
});

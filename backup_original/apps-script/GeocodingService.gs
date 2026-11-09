/**
 * RouteForge - Apps Script Geocoding Service
 * Wraps Nominatim using UrlFetchApp with CacheService caching,
 * rate limit handling, and ambiguity detection.
 */

var GeocodingService = (function () {
  'use strict';

  var NOMINATIM_BASE = 'https://nominatim.openstreetmap.org/search';

  function normalize(addr) {
    if (!addr) return '';
    return String(addr).trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function geocode(address) {
    var rawAddr = address ? String(address).trim() : '';
    if (!rawAddr) {
      return {
        lat: null,
        lng: null,
        status: 'not_found',
        provider: 'nominatim',
        displayName: ''
      };
    }

    var key = 'geo_' + Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, normalize(rawAddr)));
    var cache = CacheService.getScriptCache();
    var cached = cache.get(key);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {}
    }

    // Rate-limit pause (Nominatim 1 req/sec max)
    Utilities.sleep(1100);

    var url = NOMINATIM_BASE + '?q=' + encodeURIComponent(rawAddr) + '&format=json&addressdetails=1&limit=5';
    var options = {
      method: 'get',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'RouteForge/1.0 (Collaborative Route Planner; AppsScript)'
      },
      muteHttpExceptions: true
    };

    try {
      var response = UrlFetchApp.fetch(url, options);
      var code = response.getResponseCode();

      if (code !== 200) {
        if (code === 429) {
          return { lat: null, lng: null, status: 'error', provider: 'nominatim', raw: { code: 'RATE_LIMITED' } };
        }
        return { lat: null, lng: null, status: 'error', provider: 'nominatim', raw: { httpStatus: code } };
      }

      var results = JSON.parse(response.getContentText());
      if (!results || results.length === 0) {
        var notFound = { lat: null, lng: null, status: 'not_found', provider: 'nominatim', displayName: '' };
        cache.put(key, JSON.stringify(notFound), 21600); // 6 hours
        return notFound;
      }

      var top = results[0];
      var isAmbiguous = results.length > 1 &&
        results[1].importance &&
        top.importance &&
        Math.abs(top.importance - results[1].importance) < 0.05;

      var res = {
        lat: parseFloat(top.lat),
        lng: parseFloat(top.lon),
        status: isAmbiguous ? 'ambiguous' : 'ok',
        provider: 'nominatim',
        displayName: top.display_name,
        raw: top
      };

      cache.put(key, JSON.stringify(res), 21600);
      return res;
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

  return {
    geocode: geocode
  };
})();


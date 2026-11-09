/**
 * ============================================================================
 * RouteForge - Complete Google Apps Script Backend (All-in-One Bundle)
 * Target Sheet ID: 1zzGu4PLQjgYvVpnrMgUY78DCzMbnCsiOYbYBzYBitXs
 * ============================================================================
 */

// 1. CONFIGURATION & SCHEMA INITIALIZATION
const CONFIG = {
  DEFAULT_SHEET_ID: '1zzGu4PLQjgYvVpnrMgUY78DCzMbnCsiOYbYBzYBitXs',
  DEFAULT_SHEET_NAME: 'RouteForge-Database',
  TABLES: {
    ROUTES: 'Routes',
    STOPS: 'Stops',
    HISTORY: 'RouteHistory'
  },
  HEADERS: {
    ROUTES: ['routeId', 'title', 'createdAt', 'updatedAt', 'revision', 'settings', 'ownerIdentifier', 'status'],
    STOPS: ['routeId', 'stopId', 'name', 'address', 'latitude', 'longitude', 'sequence', 'metadata'],
    HISTORY: ['routeId', 'revision', 'timestamp', 'changeType', 'changedBy', 'summary']
  }
};

function getSpreadsheet() {
  const props = PropertiesService.getScriptProperties();
  const configuredId = props.getProperty('SHEET_ID') || CONFIG.DEFAULT_SHEET_ID;

  if (configuredId) {
    try {
      return SpreadsheetApp.openById(configuredId);
    } catch (e) {
      Logger.log('Configured SHEET_ID failed to open, falling back: ' + e.message);
    }
  }

  try {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
  } catch (e) {}

  const newSheet = SpreadsheetApp.create(CONFIG.DEFAULT_SHEET_NAME);
  props.setProperty('SHEET_ID', newSheet.getId());
  return newSheet;
}

function initializeApp() {
  const ss = getSpreadsheet();
  const tables = [
    { name: CONFIG.TABLES.ROUTES, headers: CONFIG.HEADERS.ROUTES },
    { name: CONFIG.TABLES.STOPS, headers: CONFIG.HEADERS.STOPS },
    { name: CONFIG.TABLES.HISTORY, headers: CONFIG.HEADERS.HISTORY }
  ];

  tables.forEach(t => {
    let sheet = ss.getSheetByName(t.name);
    if (!sheet) {
      sheet = ss.insertSheet(t.name);
    }
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, t.headers.length).setValues([t.headers]);
      sheet.getRange(1, 1, 1, t.headers.length).setFontWeight('bold');
      sheet.setFrozenRows(1);
    }
  });

  const defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 3) {
    try { ss.deleteSheet(defaultSheet); } catch (e) {}
  }

  Logger.log('RouteForge schema initialized successfully. Sheet ID: ' + ss.getId());
  return { ok: true, sheetId: ss.getId(), url: ss.getUrl() };
}

// 2. OPTIMIZATION SERVICE (Nearest-Neighbor & 2-Opt)
var OptimizationService = (function () {
  'use strict';
  var EARTH_RADIUS_METERS = 6371000;

  function haversineMeters(lat1, lon1, lat2, lon2) {
    if (lat1 === lat2 && lon1 === lon2) return 0;
    var toRad = Math.PI / 180;
    var dLat = (lat2 - lat1) * toRad;
    var dLon = (lon2 - lon1) * toRad;
    var phi1 = lat1 * toRad;
    var phi2 = lat2 * toRad;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return EARTH_RADIUS_METERS * c;
  }

  function stopDist(a, b) {
    if (!a || !b || typeof a.latitude !== 'number' || typeof b.latitude !== 'number') return 0;
    return haversineMeters(a.latitude, a.longitude, b.latitude, b.longitude);
  }

  function calculateTotalDist(stops) {
    if (!stops || stops.length < 2) return 0;
    var total = 0;
    for (var i = 0; i < stops.length - 1; i++) {
      total += stopDist(stops[i], stops[i + 1]);
    }
    return total;
  }

  function optimizeStops(stops, options) {
    var opts = options || {};
    var fixedStart = opts.fixedStart !== undefined ? opts.fixedStart : true;
    var fixedEnd = opts.fixedEnd !== undefined ? opts.fixedEnd : false;
    var lockedStops = opts.lockedStops !== undefined ? opts.lockedStops : true;

    if (!stops || stops.length <= 2) {
      var d = calculateTotalDist(stops || []);
      return {
        originalDistanceMeters: Math.round(d),
        optimizedDistanceMeters: Math.round(d),
        savingsMeters: 0,
        savingsPercent: 0,
        stops: (stops || []).map(function (s, idx) { s.sequence = idx; return s; })
      };
    }

    var originalDist = calculateTotalDist(stops);
    var n = stops.length;
    var tour = new Array(n);
    var used = {};

    for (var i = 0; i < n; i++) {
      var isLock = (fixedStart && i === 0) || (fixedEnd && i === n - 1) || (lockedStops && stops[i].metadata && stops[i].metadata.locked);
      if (isLock) {
        tour[i] = stops[i];
        used[stops[i].stopId] = true;
      }
    }

    if (!tour[0]) {
      tour[0] = stops[0];
      used[stops[0].stopId] = true;
    }

    var unplaced = stops.filter(function (s) { return !used[s.stopId]; });
    var current = tour[0];

    for (var j = 1; j < n; j++) {
      if (tour[j]) { current = tour[j]; continue; }
      if (unplaced.length === 0) break;

      var bestDist = Infinity;
      var bestIdx = -1;
      for (var u = 0; u < unplaced.length; u++) {
        var dist = stopDist(current, unplaced[u]);
        if (dist < bestDist) { bestDist = dist; bestIdx = u; }
      }
      if (bestIdx >= 0) {
        var chosen = unplaced.splice(bestIdx, 1)[0];
        tour[j] = chosen;
        current = chosen;
      }
    }

    for (var k = 0; k < n; k++) {
      if (!tour[k] && unplaced.length > 0) tour[k] = unplaced.shift();
    }

    var startIdx = fixedStart ? 1 : 0;
    var endIdx = fixedEnd ? n - 2 : n - 1;
    var improved = true;
    var iter = 0;

    while (improved && iter < 100) {
      improved = false;
      iter++;
      for (var a = startIdx; a < endIdx; a++) {
        for (var b = a + 1; b <= endIdx; b++) {
          var hasLocked = false;
          if (lockedStops) {
            for (var sub = a; sub <= b; sub++) {
              if (tour[sub].metadata && tour[sub].metadata.locked) { hasLocked = true; break; }
            }
          }
          if (hasLocked) continue;

          var prevA = a > 0 ? tour[a - 1] : null;
          var nextB = b < n - 1 ? tour[b + 1] : null;
          var curD = (prevA ? stopDist(prevA, tour[a]) : 0) + (nextB ? stopDist(tour[b], nextB) : 0);
          var newD = (prevA ? stopDist(prevA, tour[b]) : 0) + (nextB ? stopDist(tour[a], nextB) : 0);

          if (newD < curD - 0.001) {
            var segment = tour.slice(a, b + 1).reverse();
            for (var s = 0; s < segment.length; s++) { tour[a + s] = segment[s]; }
            improved = true;
            break;
          }
        }
        if (improved) break;
      }
    }

    var optDist = calculateTotalDist(tour);
    if (optDist > originalDist && originalDist > 0) { tour = stops.slice(); optDist = originalDist; }
    var savings = Math.max(0, originalDist - optDist);
    var pct = originalDist > 0 ? (savings / originalDist) * 100 : 0;

    return {
      originalDistanceMeters: Math.round(originalDist),
      optimizedDistanceMeters: Math.round(optDist),
      savingsMeters: Math.round(savings),
      savingsPercent: Number(pct.toFixed(2)),
      stops: tour.map(function (s, idx) { s.sequence = idx; return s; })
    };
  }

  return { haversineMeters: haversineMeters, optimizeStops: optimizeStops };
})();

// 3. GEOCODING SERVICE
var GeocodingService = (function () {
  'use strict';
  var NOMINATIM_BASE = 'https://nominatim.openstreetmap.org/search';

  function normalize(addr) {
    if (!addr) return '';
    return String(addr).trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function geocode(address) {
    var rawAddr = address ? String(address).trim() : '';
    if (!rawAddr) return { lat: null, lng: null, status: 'not_found', provider: 'nominatim', displayName: '' };

    var key = 'geo_' + Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, normalize(rawAddr)));
    var cache = CacheService.getScriptCache();
    var cached = cache.get(key);
    if (cached) { try { return JSON.parse(cached); } catch (e) {} }

    Utilities.sleep(1100);
    var url = NOMINATIM_BASE + '?q=' + encodeURIComponent(rawAddr) + '&format=json&addressdetails=1&limit=5';
    var options = {
      method: 'get',
      headers: { 'Accept': 'application/json', 'User-Agent': 'RouteForge/1.0 (Collaborative Route Planner; AppsScript)' },
      muteHttpExceptions: true
    };

    try {
      var response = UrlFetchApp.fetch(url, options);
      if (response.getResponseCode() !== 200) {
        return { lat: null, lng: null, status: 'error', provider: 'nominatim' };
      }
      var results = JSON.parse(response.getContentText());
      if (!results || results.length === 0) {
        var notFound = { lat: null, lng: null, status: 'not_found', provider: 'nominatim', displayName: '' };
        cache.put(key, JSON.stringify(notFound), 21600);
        return notFound;
      }
      var top = results[0];
      var isAmbiguous = results.length > 1 && results[1].importance && top.importance && Math.abs(top.importance - results[1].importance) < 0.05;
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
      return { lat: null, lng: null, status: 'error', provider: 'nominatim', raw: { message: err.message } };
    }
  }

  return { geocode: geocode };
})();

// 4. STORAGE SERVICE (Sheets + LockService)
var StorageService = (function () {
  'use strict';
  function generateId(prefix) {
    return (prefix || '') + new Date().getTime().toString(36) + '-' + Math.random().toString(36).substring(2, 10);
  }

  function withLock(callback) {
    var lock = LockService.getScriptLock();
    try { lock.waitLock(10000); } catch (e) {
      throw new Error('STORAGE_TIMEOUT: Could not acquire lock within 10s.');
    }
    try { return callback(); } finally { lock.releaseLock(); }
  }

  function getSheet(name) {
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(name);
    if (!sheet) { initializeApp(); sheet = ss.getSheetByName(name); }
    return sheet;
  }

  function appendHistoryRecord(routeId, revision, changeType, changedBy, summary) {
    var historySheet = getSheet(CONFIG.TABLES.HISTORY);
    historySheet.appendRow([routeId, revision, new Date().toISOString(), changeType || 'update', changedBy || 'anonymous', summary || '']);
  }

  function findRouteRow(routeSheet, routeId) {
    var lastRow = routeSheet.getLastRow();
    if (lastRow < 2) return null;
    var values = routeSheet.getRange(2, 1, lastRow - 1, 8).getValues();
    for (var i = 0; i < values.length; i++) {
      if (values[i][0] === routeId && values[i][7] !== 'deleted') {
        return {
          rowNum: i + 2,
          data: {
            routeId: values[i][0],
            title: values[i][1],
            createdAt: values[i][2],
            updatedAt: values[i][3],
            revision: parseInt(values[i][4], 10),
            settings: JSON.parse(values[i][5] || '{}'),
            ownerIdentifier: values[i][6],
            status: values[i][7]
          }
        };
      }
    }
    return null;
  }

  function createRoute(params) {
    return withLock(function () {
      var routeSheet = getSheet(CONFIG.TABLES.ROUTES);
      var routeId = generateId('rf_');
      var now = new Date().toISOString();
      var title = (params && params.title && params.title.trim()) ? params.title.trim() : 'Untitled Route';
      var settings = JSON.stringify((params && params.settings) || { fixedStart: true, fixedEnd: false, provider: 'osrm' });
      var owner = (params && params.ownerIdentifier) || 'anonymous';
      var revision = 1;

      routeSheet.appendRow([routeId, title, now, now, revision, settings, owner, 'active']);
      appendHistoryRecord(routeId, revision, 'create', owner, 'Route created');

      return { routeId: routeId, revision: revision, url: '?routeId=' + routeId, createdAt: now, updatedAt: now };
    });
  }

  function getRoute(routeId) {
    var routeSheet = getSheet(CONFIG.TABLES.ROUTES);
    var found = findRouteRow(routeSheet, routeId);
    if (!found) { var err = new Error('Route ' + routeId + ' not found'); err.code = 'NOT_FOUND'; throw err; }

    var stopSheet = getSheet(CONFIG.TABLES.STOPS);
    var stopLastRow = stopSheet.getLastRow();
    var stops = [];
    if (stopLastRow >= 2) {
      var stopValues = stopSheet.getRange(2, 1, stopLastRow - 1, 8).getValues();
      for (var s = 0; s < stopValues.length; s++) {
        if (stopValues[s][0] === routeId) {
          stops.push({
            routeId: stopValues[s][0],
            stopId: stopValues[s][1],
            name: stopValues[s][2],
            address: stopValues[s][3],
            latitude: stopValues[s][4] !== '' ? parseFloat(stopValues[s][4]) : null,
            longitude: stopValues[s][5] !== '' ? parseFloat(stopValues[s][5]) : null,
            sequence: parseInt(stopValues[s][6], 10),
            metadata: JSON.parse(stopValues[s][7] || '{}')
          });
        }
      }
      stops.sort(function (a, b) { return a.sequence - b.sequence; });
    }

    return { route: found.data, stops: stops, history: [] };
  }

  function getRouteRevision(routeId) {
    var routeSheet = getSheet(CONFIG.TABLES.ROUTES);
    var found = findRouteRow(routeSheet, routeId);
    if (!found) { var err = new Error('Route ' + routeId + ' not found'); err.code = 'NOT_FOUND'; throw err; }
    return { revision: found.data.revision, updatedAt: found.data.updatedAt };
  }

  function updateRoute(routeId, expectedRevision, changes) {
    return withLock(function () {
      var routeSheet = getSheet(CONFIG.TABLES.ROUTES);
      var found = findRouteRow(routeSheet, routeId);
      if (!found) { var err = new Error('Route ' + routeId + ' not found'); err.code = 'NOT_FOUND'; throw err; }

      if (typeof expectedRevision === 'number' && found.data.revision !== expectedRevision) {
        var confErr = new Error('Revision conflict'); confErr.code = 'REVISION_CONFLICT'; throw confErr;
      }

      var nextRev = found.data.revision + 1;
      var now = new Date().toISOString();
      var newTitle = changes.title !== undefined ? String(changes.title).trim() : found.data.title;

      routeSheet.getRange(found.rowNum, 2).setValue(newTitle);
      routeSheet.getRange(found.rowNum, 4).setValue(now);
      routeSheet.getRange(found.rowNum, 5).setValue(nextRev);

      found.data.title = newTitle;
      found.data.revision = nextRev;
      return { route: found.data, revision: nextRev };
    });
  }

  function addStop(routeId, expectedRevision, stopData) {
    return withLock(function () {
      var routeSheet = getSheet(CONFIG.TABLES.ROUTES);
      var found = findRouteRow(routeSheet, routeId);
      if (!found) { var err = new Error('Route ' + routeId + ' not found'); err.code = 'NOT_FOUND'; throw err; }

      if (typeof expectedRevision === 'number' && found.data.revision !== expectedRevision) {
        var confErr = new Error('Revision conflict'); confErr.code = 'REVISION_CONFLICT'; throw confErr;
      }

      var stopSheet = getSheet(CONFIG.TABLES.STOPS);
      var stopId = stopData.stopId || generateId('stop_');
      var name = (stopData.name && stopData.name.trim()) || (stopData.address && stopData.address.split(',')[0].trim()) || 'Stop';
      var address = stopData.address ? stopData.address.trim() : '';
      var lat = typeof stopData.latitude === 'number' ? stopData.latitude : '';
      var lng = typeof stopData.longitude === 'number' ? stopData.longitude : '';
      var seq = typeof stopData.sequence === 'number' ? stopData.sequence : 0;
      var metadata = JSON.stringify(stopData.metadata || { locked: false, geocodeStatus: 'pending' });

      stopSheet.appendRow([routeId, stopId, name, address, lat, lng, seq, metadata]);

      var nextRev = found.data.revision + 1;
      var now = new Date().toISOString();
      routeSheet.getRange(found.rowNum, 4).setValue(now);
      routeSheet.getRange(found.rowNum, 5).setValue(nextRev);

      return {
        stop: { routeId: routeId, stopId: stopId, name: name, address: address, latitude: lat !== '' ? parseFloat(lat) : null, longitude: lng !== '' ? parseFloat(lng) : null, sequence: seq, metadata: JSON.parse(metadata) },
        revision: nextRev
      };
    });
  }

  function removeStop(routeId, expectedRevision, stopId) {
    return withLock(function () {
      var routeSheet = getSheet(CONFIG.TABLES.ROUTES);
      var found = findRouteRow(routeSheet, routeId);
      if (!found) { var err = new Error('Route ' + routeId + ' not found'); err.code = 'NOT_FOUND'; throw err; }

      if (typeof expectedRevision === 'number' && found.data.revision !== expectedRevision) {
        var confErr = new Error('Revision conflict'); confErr.code = 'REVISION_CONFLICT'; throw confErr;
      }

      var stopSheet = getSheet(CONFIG.TABLES.STOPS);
      var lastRow = stopSheet.getLastRow();
      if (lastRow >= 2) {
        var values = stopSheet.getRange(2, 1, lastRow - 1, 8).getValues();
        for (var i = 0; i < values.length; i++) {
          if (values[i][0] === routeId && values[i][1] === stopId) {
            stopSheet.deleteRow(i + 2);
            break;
          }
        }
      }

      var nextRev = found.data.revision + 1;
      var now = new Date().toISOString();
      routeSheet.getRange(found.rowNum, 4).setValue(now);
      routeSheet.getRange(found.rowNum, 5).setValue(nextRev);

      return { removedStopId: stopId, revision: nextRev };
    });
  }

  function reorderStops(routeId, expectedRevision, sequence) {
    return withLock(function () {
      var routeSheet = getSheet(CONFIG.TABLES.ROUTES);
      var found = findRouteRow(routeSheet, routeId);
      if (!found) { var err = new Error('Route ' + routeId + ' not found'); err.code = 'NOT_FOUND'; throw err; }

      if (typeof expectedRevision === 'number' && found.data.revision !== expectedRevision) {
        var confErr = new Error('Revision conflict'); confErr.code = 'REVISION_CONFLICT'; throw confErr;
      }

      var stopSheet = getSheet(CONFIG.TABLES.STOPS);
      var lastRow = stopSheet.getLastRow();
      var orderMap = {};
      for (var s = 0; s < sequence.length; s++) orderMap[sequence[s]] = s;

      if (lastRow >= 2) {
        var values = stopSheet.getRange(2, 1, lastRow - 1, 8).getValues();
        for (var i = 0; i < values.length; i++) {
          if (values[i][0] === routeId && orderMap[values[i][1]] !== undefined) {
            stopSheet.getRange(i + 2, 7).setValue(orderMap[values[i][1]]);
          }
        }
      }

      var nextRev = found.data.revision + 1;
      var now = new Date().toISOString();
      routeSheet.getRange(found.rowNum, 4).setValue(now);
      routeSheet.getRange(found.rowNum, 5).setValue(nextRev);

      var routeData = getRoute(routeId);
      return { stops: routeData.stops, revision: nextRev };
    });
  }

  function updateStop(routeId, expectedRevision, stopId, changes) {
    return withLock(function () {
      var routeSheet = getSheet(CONFIG.TABLES.ROUTES);
      var found = findRouteRow(routeSheet, routeId);
      if (!found) { var err = new Error('Route ' + routeId + ' not found'); err.code = 'NOT_FOUND'; throw err; }

      if (typeof expectedRevision === 'number' && found.data.revision !== expectedRevision) {
        var confErr = new Error('Revision conflict'); confErr.code = 'REVISION_CONFLICT'; throw confErr;
      }

      var stopSheet = getSheet(CONFIG.TABLES.STOPS);
      var lastRow = stopSheet.getLastRow();
      var targetRow = -1;
      var currentStop = null;

      if (lastRow >= 2) {
        var values = stopSheet.getRange(2, 1, lastRow - 1, 8).getValues();
        for (var i = 0; i < values.length; i++) {
          if (values[i][0] === routeId && values[i][1] === stopId) {
            targetRow = i + 2;
            currentStop = { name: values[i][2], address: values[i][3], sequence: values[i][6], metadata: JSON.parse(values[i][7] || '{}') };
            break;
          }
        }
      }

      if (targetRow === -1 || !currentStop) { var nErr = new Error('Stop not found'); nErr.code = 'NOT_FOUND'; throw nErr; }

      var newMetadata = changes.metadata !== undefined ? Object.assign({}, currentStop.metadata, changes.metadata) : currentStop.metadata;
      stopSheet.getRange(targetRow, 8).setValue(JSON.stringify(newMetadata));

      var nextRev = found.data.revision + 1;
      var now = new Date().toISOString();
      routeSheet.getRange(found.rowNum, 4).setValue(now);
      routeSheet.getRange(found.rowNum, 5).setValue(nextRev);

      return {
        stop: { routeId: routeId, stopId: stopId, name: currentStop.name, address: currentStop.address, sequence: currentStop.sequence, metadata: newMetadata },
        revision: nextRev
      };
    });
  }

  return {
    createRoute: createRoute,
    getRoute: getRoute,
    getRouteRevision: getRouteRevision,
    updateRoute: updateRoute,
    addStop: addStop,
    removeStop: removeStop,
    reorderStops: reorderStops,
    updateStop: updateStop
  };
})();

// 5. ROUTE SERVICE
var RouteService = (function () {
  'use strict';
  function createRoute(params) { return StorageService.createRoute(params); }
  function getRoute(routeId) { return StorageService.getRoute(routeId); }
  function getRouteRevision(routeId) { return StorageService.getRouteRevision(routeId); }
  function updateRoute(routeId, rev, changes) { return StorageService.updateRoute(routeId, rev, changes); }

  function addStop(routeId, rev, stopData) {
    if ((stopData.latitude === undefined || stopData.latitude === null) && stopData.address) {
      try {
        var geo = GeocodingService.geocode(stopData.address);
        stopData.latitude = geo.lat;
        stopData.longitude = geo.lng;
        stopData.metadata = stopData.metadata || {};
        stopData.metadata.geocodeStatus = geo.status;
      } catch (e) {}
    }
    return StorageService.addStop(routeId, rev, stopData);
  }

  function removeStop(routeId, rev, stopId) { return StorageService.removeStop(routeId, rev, stopId); }
  function reorderStops(routeId, rev, seq) { return StorageService.reorderStops(routeId, rev, seq); }
  function updateStop(routeId, rev, stopId, changes) { return StorageService.updateStop(routeId, rev, stopId, changes); }

  function calculateRoute(routeId, provider) {
    var routeData = StorageService.getRoute(routeId);
    var stops = routeData.stops;
    var valid = stops.filter(function (s) { return typeof s.latitude === 'number' && typeof s.longitude === 'number'; });

    if (valid.length < 2) {
      var err = new Error('At least two geocoded stops are required.');
      err.code = 'INVALID_INPUT';
      throw err;
    }

    if (provider === 'straightLine') {
      var coords = valid.map(function (s) { return [s.longitude, s.latitude]; });
      var total = 0;
      for (var i = 0; i < valid.length - 1; i++) {
        total += OptimizationService.haversineMeters(valid[i].latitude, valid[i].longitude, valid[i + 1].latitude, valid[i + 1].longitude);
      }
      return {
        geometry: { type: 'LineString', coordinates: coords },
        totalDistanceMeters: Math.round(total),
        totalDurationSeconds: Math.round(total / 13.88),
        provider: 'straightLine',
        isFallback: true
      };
    }

    var coordStr = valid.map(function (s) { return s.longitude.toFixed(6) + ',' + s.latitude.toFixed(6); }).join(';');
    var url = 'https://router.project-osrm.org/route/v1/driving/' + coordStr + '?overview=full&geometries=geojson&steps=false';

    try {
      var resp = UrlFetchApp.fetch(url, { headers: { 'Accept': 'application/json', 'User-Agent': 'RouteForge/1.0' }, muteHttpExceptions: true });
      var json = JSON.parse(resp.getContentText());
      if (json.code !== 'Ok' || !json.routes || json.routes.length === 0) {
        return calculateRoute(routeId, 'straightLine');
      }
      return {
        geometry: json.routes[0].geometry,
        totalDistanceMeters: Math.round(json.routes[0].distance || 0),
        totalDurationSeconds: Math.round(json.routes[0].duration || 0),
        provider: 'osrm',
        isFallback: false
      };
    } catch (e) {
      return calculateRoute(routeId, 'straightLine');
    }
  }

  function optimizeRoute(routeId, options) {
    var routeData = StorageService.getRoute(routeId);
    var opt = OptimizationService.optimizeStops(routeData.stops, options);
    var seq = opt.stops.map(function (s) { return s.stopId; });
    var upd = StorageService.reorderStops(routeId, routeData.route.revision, seq);
    return {
      originalDistanceMeters: opt.originalDistanceMeters,
      optimizedDistanceMeters: opt.optimizedDistanceMeters,
      savingsMeters: opt.savingsMeters,
      savingsPercent: opt.savingsPercent,
      stops: upd.stops,
      revision: upd.revision
    };
  }

  function exportRoute(routeId) {
    var routeData = StorageService.getRoute(routeId);
    var lines = ['Sequence,Name,Address,Latitude,Longitude,Locked,Status'];
    routeData.stops.forEach(function (s, idx) {
      var name = s.name.replace(/"/g, '""');
      if (name.length > 0 && ['=', '+', '-', '@'].indexOf(name.charAt(0)) !== -1) name = "'" + name;
      lines.push([(idx + 1), '"' + name + '"', '"' + s.address.replace(/"/g, '""') + '"', (s.latitude || ''), (s.longitude || ''), (s.metadata && s.metadata.locked ? 'Yes' : 'No'), 'ok'].join(','));
    });
    return { filename: 'RouteForge-stops.csv', content: lines.join('\r\n') };
  }

  return {
    createRoute: createRoute,
    getRoute: getRoute,
    getRouteRevision: getRouteRevision,
    updateRoute: updateRoute,
    addStop: addStop,
    removeStop: removeStop,
    reorderStops: reorderStops,
    updateStop: updateStop,
    calculateRoute: calculateRoute,
    optimizeRoute: optimizeRoute,
    exportRoute: exportRoute
  };
})();

// 6. DISPATCHER & WEB APP ENTRY POINTS (doGet / doPost)
function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || '';
  if (action) {
    var response = handleApiAction(action, e.parameter);
    return ContentService.createTextOutput(JSON.stringify(response)).setMimeType(ContentService.MimeType.JSON);
  }

  var template = HtmlService.createTemplateFromFile('Index');
  template.initialRouteId = (e && e.parameter && e.parameter.routeId) || '';
  return template.evaluate()
    .setTitle('RouteForge - Multi-Stop Route Planner')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  var action = (e && e.parameter && e.parameter.action) || '';
  var body = {};
  if (e && e.postData && e.postData.contents) {
    try { body = JSON.parse(e.postData.contents); } catch (err) {}
  }
  var response = handleApiAction(action, body);
  return ContentService.createTextOutput(JSON.stringify(response)).setMimeType(ContentService.MimeType.JSON);
}

function handleApiAction(action, params) {
  try {
    switch (action) {
      case 'initializeApp': return { ok: true, data: initializeApp() };
      case 'createRoute': var c = RouteService.createRoute(params); return { ok: true, data: c, revision: c.revision };
      case 'getRoute': var r = RouteService.getRoute(params.routeId); return { ok: true, data: r, revision: r.route.revision };
      case 'getRouteRevision': var rv = RouteService.getRouteRevision(params.routeId); return { ok: true, data: rv, revision: rv.revision };
      case 'updateRoute': var u = RouteService.updateRoute(params.routeId, params.expectedRevision, params.changes); return { ok: true, data: u.route, revision: u.revision };
      case 'addStop': var a = RouteService.addStop(params.routeId, params.expectedRevision, params.stop); return { ok: true, data: a.stop, revision: a.revision };
      case 'removeStop': var rm = RouteService.removeStop(params.routeId, params.expectedRevision, params.stopId); return { ok: true, data: rm, revision: rm.revision };
      case 'reorderStops': var ro = RouteService.reorderStops(params.routeId, params.expectedRevision, params.sequence); return { ok: true, data: ro.stops, revision: ro.revision };
      case 'updateStop': var us = RouteService.updateStop(params.routeId, params.expectedRevision, params.stopId, params.changes); return { ok: true, data: us.stop, revision: us.revision };
      case 'calculateRoute': return { ok: true, data: RouteService.calculateRoute(params.routeId, params.provider) };
      case 'optimizeRoute': var op = RouteService.optimizeRoute(params.routeId, params.options); return { ok: true, data: op, revision: op.revision };
      case 'exportRoute': return { ok: true, data: RouteService.exportRoute(params.routeId) };
      default: return { ok: false, error: { code: 'INVALID_INPUT', message: 'Unknown action: ' + action } };
    }
  } catch (err) {
    return { ok: false, error: { code: err.code || 'STORAGE_ERROR', message: err.message || String(err) } };
  }
}


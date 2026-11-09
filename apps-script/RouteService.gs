/**
 * RouteForge - Apps Script Route Service
 * High-level business operations for routing, optimization, geocoding, and export.
 */

var RouteService = (function () {
  'use strict';

  function createRoute(params) {
    return StorageService.createRoute(params);
  }

  function getRoute(routeId) {
    return StorageService.getRoute(routeId);
  }

  function getRouteRevision(routeId) {
    return StorageService.getRouteRevision(routeId);
  }

  function updateRoute(routeId, expectedRevision, changes) {
    return StorageService.updateRoute(routeId, expectedRevision, changes);
  }

  function addStop(routeId, expectedRevision, stopData) {
    // If coordinates are missing, attempt geocoding
    if (
      (stopData.latitude === undefined || stopData.latitude === null) &&
      stopData.address
    ) {
      try {
        var geo = GeocodingService.geocode(stopData.address);
        stopData.latitude = geo.lat;
        stopData.longitude = geo.lng;
        stopData.metadata = stopData.metadata || {};
        stopData.metadata.geocodeStatus = geo.status;
        stopData.metadata.displayName = geo.displayName || '';
      } catch (e) {
        // Continue with null coords
      }
    }
    return StorageService.addStop(routeId, expectedRevision, stopData);
  }

  function removeStop(routeId, expectedRevision, stopId) {
    return StorageService.removeStop(routeId, expectedRevision, stopId);
  }

  function reorderStops(routeId, expectedRevision, sequence) {
    return StorageService.reorderStops(routeId, expectedRevision, sequence);
  }

  function updateStop(routeId, expectedRevision, stopId, changes) {
    return StorageService.updateStop(routeId, expectedRevision, stopId, changes);
  }

  function computeStraightLine(validStops) {
    var coords = validStops.map(function (s) { return [s.longitude, s.latitude]; });
    var legs = [];
    var totalMeters = 0;
    var speedMps = 13.88;

    for (var i = 0; i < validStops.length - 1; i++) {
      var a = validStops[i];
      var b = validStops[i + 1];
      var dist = OptimizationService.haversineMeters(a.latitude, a.longitude, b.latitude, b.longitude);
      var dur = dist / speedMps;
      legs.push({
        distanceMeters: Math.round(dist),
        durationSeconds: Math.round(dur),
        summary: 'Straight line from Stop ' + (i + 1) + ' to Stop ' + (i + 2)
      });
      totalMeters += dist;
    }

    return {
      legs: legs,
      geometry: {
        type: 'LineString',
        coordinates: coords
      },
      totalDistanceMeters: Math.round(totalMeters),
      totalDurationSeconds: Math.round(totalMeters / speedMps),
      provider: 'straightLine',
      isFallback: true,
      disclaimer: 'Straight-line estimate only. Road geometry is unavailable.'
    };
  }

  function calculateRoute(routeId, provider) {
    var routeData = StorageService.getRoute(routeId);
    var stops = routeData.stops;

    var validStops = stops.filter(function (s) {
      return typeof s.latitude === 'number' && typeof s.longitude === 'number';
    });

    if (validStops.length < 2) {
      var err = new Error('At least two geocoded stops with valid latitude and longitude are required.');
      err.code = 'INVALID_INPUT';
      throw err;
    }

    if (provider === 'straightLine') {
      return computeStraightLine(validStops);
    }

    // Call OSRM
    var coordStr = validStops.map(function (s) {
      return s.longitude.toFixed(6) + ',' + s.latitude.toFixed(6);
    }).join(';');

    var url = 'https://router.project-osrm.org/route/v1/driving/' + coordStr + '?overview=full&geometries=geojson&steps=false';
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
        var uErr = new Error('OSRM routing service responded with status ' + code);
        uErr.code = 'PROVIDER_UNAVAILABLE';
        throw uErr;
      }

      var json = JSON.parse(response.getContentText());
      if (json.code !== 'Ok' || !json.routes || json.routes.length === 0) {
        var fErr = new Error('OSRM routing failed: ' + (json.message || 'No route found'));
        fErr.code = 'PROVIDER_UNAVAILABLE';
        throw fErr;
      }

      var top = json.routes[0];
      var legs = (top.legs || []).map(function (leg, idx) {
        return {
          distanceMeters: Math.round(leg.distance || 0),
          durationSeconds: Math.round(leg.duration || 0),
          summary: leg.summary || ('Stop ' + (idx + 1) + ' to Stop ' + (idx + 2))
        };
      });

      return {
        legs: legs,
        geometry: top.geometry,
        totalDistanceMeters: Math.round(top.distance || 0),
        totalDurationSeconds: Math.round(top.duration || 0),
        provider: 'osrm',
        isFallback: false
      };
    } catch (e) {
      if (e.code === 'PROVIDER_UNAVAILABLE') {
        throw e;
      }
      var connErr = new Error('Unable to connect to OSRM routing service: ' + e.message);
      connErr.code = 'PROVIDER_UNAVAILABLE';
      throw connErr;
    }
  }

  function optimizeRoute(routeId, options) {
    var routeData = StorageService.getRoute(routeId);
    var stops = routeData.stops;

    var optResult = OptimizationService.optimizeStops(stops, options);
    var newSequence = optResult.stops.map(function (s) { return s.stopId; });

    // Persist new sequence
    var updateResult = StorageService.reorderStops(routeId, routeData.route.revision, newSequence);

    return {
      originalDistanceMeters: optResult.originalDistanceMeters,
      optimizedDistanceMeters: optResult.optimizedDistanceMeters,
      savingsMeters: optResult.savingsMeters,
      savingsPercent: optResult.savingsPercent,
      stops: updateResult.stops,
      revision: updateResult.revision
    };
  }

  function sanitizeCell(val) {
    if (val === null || val === undefined) return '';
    var str = String(val);
    var dangerous = ['=', '+', '-', '@', '\t', '\r'];
    if (str.length > 0 && dangerous.indexOf(str.charAt(0)) !== -1) {
      str = "'" + str;
    }
    if (str.indexOf('"') !== -1 || str.indexOf(',') !== -1 || str.indexOf('\n') !== -1 || str.indexOf('\r') !== -1) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  function exportRoute(routeId, format) {
    var routeData = StorageService.getRoute(routeId);
    var stops = routeData.stops;

    var lines = ['Sequence,Name,Address,Latitude,Longitude,Locked,Status'];
    stops.forEach(function (s, idx) {
      var seq = s.sequence !== undefined ? s.sequence + 1 : idx + 1;
      var name = sanitizeCell(s.name);
      var address = sanitizeCell(s.address);
      var lat = s.latitude !== null && s.latitude !== undefined ? s.latitude : '';
      var lng = s.longitude !== null && s.longitude !== undefined ? s.longitude : '';
      var locked = s.metadata && s.metadata.locked ? 'Yes' : 'No';
      var status = (s.metadata && s.metadata.geocodeStatus) || 'ok';
      lines.push([seq, name, address, lat, lng, locked, status].join(','));
    });

    return {
      filename: (routeData.route.title.replace(/[^a-zA-Z0-9_-]/g, '_') || 'Route') + '.csv',
      mimeType: 'text/csv',
      content: lines.join('\r\n')
    };
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


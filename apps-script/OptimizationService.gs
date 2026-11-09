/**
 * RouteForge - Apps Script Optimization Service
 * Nearest Neighbor + 2-opt optimizer with locked stop support.
 */

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

    var a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
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

    // Fixed / locked slots
    for (var i = 0; i < n; i++) {
      var isLock = (fixedStart && i === 0) ||
        (fixedEnd && i === n - 1) ||
        (lockedStops && stops[i].metadata && stops[i].metadata.locked);
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
      if (tour[j]) {
        current = tour[j];
        continue;
      }
      if (unplaced.length === 0) break;

      var bestDist = Infinity;
      var bestIdx = -1;
      for (var u = 0; u < unplaced.length; u++) {
        var dist = stopDist(current, unplaced[u]);
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = u;
        }
      }

      if (bestIdx >= 0) {
        var chosen = unplaced.splice(bestIdx, 1)[0];
        tour[j] = chosen;
        current = chosen;
      }
    }

    for (var k = 0; k < n; k++) {
      if (!tour[k] && unplaced.length > 0) {
        tour[k] = unplaced.shift();
      }
    }

    // 2-opt refinement
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
              if (tour[sub].metadata && tour[sub].metadata.locked) {
                hasLocked = true;
                break;
              }
            }
          }
          if (hasLocked) continue;

          var prevA = a > 0 ? tour[a - 1] : null;
          var nextB = b < n - 1 ? tour[b + 1] : null;

          var curD = (prevA ? stopDist(prevA, tour[a]) : 0) + (nextB ? stopDist(tour[b], nextB) : 0);
          var newD = (prevA ? stopDist(prevA, tour[b]) : 0) + (nextB ? stopDist(tour[a], nextB) : 0);

          if (newD < curD - 0.001) {
            var segment = tour.slice(a, b + 1).reverse();
            for (var s = 0; s < segment.length; s++) {
              tour[a + s] = segment[s];
            }
            improved = true;
            break;
          }
        }
        if (improved) break;
      }
    }

    var optDist = calculateTotalDist(tour);
    if (optDist > originalDist && originalDist > 0) {
      tour = stops.slice();
      optDist = originalDist;
    }

    var savings = Math.max(0, originalDist - optDist);
    var pct = originalDist > 0 ? (savings / originalDist) * 100 : 0;

    return {
      originalDistanceMeters: Math.round(originalDist),
      optimizedDistanceMeters: Math.round(optDist),
      savingsMeters: Math.round(savings),
      savingsPercent: Number(pct.toFixed(2)),
      stops: tour.map(function (s, idx) {
        s.sequence = idx;
        return s;
      })
    };
  }

  return {
    haversineMeters: haversineMeters,
    optimizeStops: optimizeStops
  };
})();


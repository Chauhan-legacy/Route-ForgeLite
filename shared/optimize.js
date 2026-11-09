/**
 * RouteForge - Shared Route Optimization Core
 * Implements Nearest-Neighbor construction and 2-opt local search improvement
 * with constraints for fixed start, fixed end, and locked stops.
 * Zero-dependency UMD module.
 */
(function (root, factory) {
  if (typeof exports === 'object' && typeof module !== 'undefined') {
    const f = factory();
    module.exports = f;
    Object.assign(exports, f);
  } else if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else {
    root.RouteForgeOptimizer = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const EARTH_RADIUS_METERS = 6371000;

  /**
   * Calculates Great-Circle (Haversine) distance between two points in meters.
   * @param {number} lat1
   * @param {number} lon1
   * @param {number} lat2
   * @param {number} lon2
   * @returns {number} Distance in meters
   */
  function haversineDistance(lat1, lon1, lat2, lon2) {
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
   * Calculates the distance between two stops.
   * Returns 0 if either stop is missing coordinates.
   * @param {Object} stopA
   * @param {Object} stopB
   * @returns {number}
   */
  function stopDistance(stopA, stopB) {
    if (
      !stopA ||
      !stopB ||
      typeof stopA.latitude !== 'number' ||
      typeof stopA.longitude !== 'number' ||
      typeof stopB.latitude !== 'number' ||
      typeof stopB.longitude !== 'number'
    ) {
      return 0;
    }
    return haversineDistance(
      stopA.latitude,
      stopA.longitude,
      stopB.latitude,
      stopB.longitude
    );
  }

  /**
   * Calculates total route distance for an ordered array of stops.
   * @param {Array<Object>} stops
   * @returns {number} Total distance in meters
   */
  function calculateTotalRouteDistance(stops) {
    if (!Array.isArray(stops) || stops.length < 2) return 0;
    let total = 0;
    for (let i = 0; i < stops.length - 1; i++) {
      total += stopDistance(stops[i], stops[i + 1]);
    }
    return total;
  }

  /**
   * Precomputes distance matrix for a list of stops.
   * @param {Array<Object>} stops
   * @returns {number[][]}
   */
  function buildDistanceMatrix(stops) {
    const n = stops.length;
    const matrix = Array.from({ length: n }, () => new Float64Array(n));
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const d = stopDistance(stops[i], stops[j]);
        matrix[i][j] = d;
        matrix[j][i] = d;
      }
    }
    return matrix;
  }

  /**
   * Checks if an index position is strictly locked.
   * @param {number} idx
   * @param {number} totalCount
   * @param {Object} stop
   * @param {Object} options
   * @returns {boolean}
   */
  function isIndexLocked(idx, totalCount, stop, options) {
    if (options.fixedStart && idx === 0) return true;
    if (options.fixedEnd && idx === totalCount - 1) return true;
    if (options.lockedStops && stop && stop.metadata && stop.metadata.locked) {
      return true;
    }
    return false;
  }

  /**
   * Nearest-Neighbor construction heuristic respecting locks and fixed start/end.
   * @param {Array<Object>} stops
   * @param {Object} options
   * @returns {Array<Object>}
   */
  function nearestNeighborConstruction(stops, options) {
    const n = stops.length;
    if (n <= 2) return stops.slice();

    const result = new Array(n).fill(null);
    const used = new Set();

    // 1. Place all strictly locked stops and fixed ends into their required slots
    for (let i = 0; i < n; i++) {
      if (isIndexLocked(i, n, stops[i], options)) {
        result[i] = stops[i];
        used.add(stops[i].stopId || i);
      }
    }

    // If start is not locked but empty, initialize with stops[0]
    if (!result[0]) {
      result[0] = stops[0];
      used.add(stops[0].stopId || 0);
    }

    // Collect remaining unplaced stops
    const unplaced = stops.filter(s => !used.has(s.stopId || s));

    // Fill remaining empty slots using nearest neighbor
    let current = result[0];
    for (let i = 1; i < n; i++) {
      if (result[i] !== null) {
        // Slot is already occupied by a locked stop
        current = result[i];
        continue;
      }

      if (unplaced.length === 0) break;

      // Find unplaced stop nearest to `current`
      let bestDist = Infinity;
      let bestIdx = -1;

      for (let j = 0; j < unplaced.length; j++) {
        const dist = stopDistance(current, unplaced[j]);
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = j;
        }
      }

      if (bestIdx >= 0) {
        const chosen = unplaced.splice(bestIdx, 1)[0];
        result[i] = chosen;
        current = chosen;
      }
    }

    // Clean up any remaining unplaced (should not occur unless edge case)
    for (let i = 0; i < n; i++) {
      if (result[i] === null && unplaced.length > 0) {
        result[i] = unplaced.shift();
      }
    }

    return result.filter(Boolean);
  }

  /**
   * 2-Opt improvement local search respecting locked stops.
   * @param {Array<Object>} stops
   * @param {Object} options
   * @param {number} [maxIterations=150]
   * @returns {Array<Object>}
   */
  function twoOptOptimization(stops, options, maxIterations = 150) {
    let currentTour = stops.slice();
    const n = currentTour.length;
    if (n <= 3) return currentTour;

    let improved = true;
    let iterations = 0;

    while (improved && iterations < maxIterations) {
      improved = false;
      iterations++;

      // We test reversing the sub-segment between i and j (inclusive)
      const startIdx = options.fixedStart ? 1 : 0;
      const endIdx = options.fixedEnd ? n - 2 : n - 1;

      for (let i = startIdx; i < endIdx; i++) {
        for (let j = i + 1; j <= endIdx; j++) {
          // Check if any stop in the segment [i, j] is locked.
          // In 2-opt, reversing [i..j] moves all elements within it.
          // If any element inside [i..j] is marked locked, this swap is invalid!
          let hasLockedInside = false;
          for (let k = i; k <= j; k++) {
            if (options.lockedStops && currentTour[k].metadata && currentTour[k].metadata.locked) {
              hasLockedInside = true;
              break;
            }
          }
          if (hasLockedInside) continue;

          // Distance before swap:
          // edges (i-1 -> i) and (j -> j+1)
          const prevI = i > 0 ? currentTour[i - 1] : null;
          const nextJ = j < n - 1 ? currentTour[j + 1] : null;

          const d1 = prevI ? stopDistance(prevI, currentTour[i]) : 0;
          const d2 = nextJ ? stopDistance(currentTour[j], nextJ) : 0;
          const currentEdgeDist = d1 + d2;

          // Distance after swap:
          // edges (i-1 -> j) and (i -> nextJ)
          const newD1 = prevI ? stopDistance(prevI, currentTour[j]) : 0;
          const newD2 = nextJ ? stopDistance(currentTour[i], nextJ) : 0;
          const newEdgeDist = newD1 + newD2;

          if (newEdgeDist < currentEdgeDist - 1e-4) {
            // Perform 2-opt swap: reverse subsegment [i..j]
            const reversedSegment = currentTour.slice(i, j + 1).reverse();
            currentTour.splice(i, reversedSegment.length, ...reversedSegment);
            improved = true;
            break;
          }
        }
        if (improved) break;
      }
    }

    return currentTour;
  }

  /**
   * Optimizes a list of stops.
   * Returns comparison statistics: original distance, optimized distance, savings.
   * @param {Array<Object>} stops
   * @param {Object} [options]
   * @returns {{
   *   originalDistanceMeters: number,
   *   optimizedDistanceMeters: number,
   *   savingsMeters: number,
   *   savingsPercent: number,
   *   stops: Array<Object>
   * }}
   */
  function optimizeStops(stops, options = {}) {
    const opts = {
      fixedStart: options.fixedStart !== undefined ? Boolean(options.fixedStart) : true,
      fixedEnd: options.fixedEnd !== undefined ? Boolean(options.fixedEnd) : false,
      lockedStops: options.lockedStops !== undefined ? Boolean(options.lockedStops) : true
    };

    if (!Array.isArray(stops) || stops.length <= 2) {
      const dist = calculateTotalRouteDistance(stops || []);
      return {
        originalDistanceMeters: Math.round(dist),
        optimizedDistanceMeters: Math.round(dist),
        savingsMeters: 0,
        savingsPercent: 0,
        stops: (stops || []).map((s, idx) => ({ ...s, sequence: idx }))
      };
    }

    const originalDist = calculateTotalRouteDistance(stops);

    // Step 1: Nearest-neighbor initial tour
    const nnTour = nearestNeighborConstruction(stops, opts);

    // Step 2: 2-opt local search improvement
    const optimizedTour = twoOptOptimization(nnTour, opts);

    const optimizedDist = calculateTotalRouteDistance(optimizedTour);

    // If optimization somehow yielded worse distance than the original order
    // (e.g. user already had an optimal route), keep the original order
    let finalTour = optimizedTour;
    let finalDist = optimizedDist;
    if (finalDist > originalDist && originalDist > 0) {
      finalTour = stops.slice();
      finalDist = originalDist;
    }

    const savingsMeters = Math.max(0, originalDist - finalDist);
    const savingsPercent = originalDist > 0 ? (savingsMeters / originalDist) * 100 : 0;

    return {
      originalDistanceMeters: Math.round(originalDist),
      optimizedDistanceMeters: Math.round(finalDist),
      savingsMeters: Math.round(savingsMeters),
      savingsPercent: Number(savingsPercent.toFixed(2)),
      stops: finalTour.map((stop, index) => ({
        ...stop,
        sequence: index
      }))
    };
  }

  return {
    EARTH_RADIUS_METERS,
    haversineDistance,
    stopDistance,
    calculateTotalRouteDistance,
    buildDistanceMatrix,
    nearestNeighborConstruction,
    twoOptOptimization,
    optimizeStops
  };
});

/**
 * RouteForge - Shared Type Definitions (JSDoc)
 * Compatible with Node.js, modern browsers, and Google Apps Script.
 */

/**
 * @typedef {Object} RouteSettings
 * @property {boolean} [fixedStart=true] - Keep the first stop in place during optimization
 * @property {boolean} [fixedEnd=false] - Keep the last stop in place during optimization
 * @property {boolean} [roundTrip=false] - Return to the origin stop at the end of the route
 * @property {'osrm'|'straightLine'} [provider='osrm'] - Preferred routing engine
 */

/**
 * @typedef {Object} StopMetadata
 * @property {boolean} [locked=false] - If true, stop cannot be reordered during optimization
 * @property {'ok'|'ambiguous'|'not_found'|'error'|'pending'} [geocodeStatus='pending']
 * @property {Object} [raw] - Raw provider payload
 */

/**
 * @typedef {Object} Stop
 * @property {string} routeId - Foreign key to Route
 * @property {string} stopId - Unique identifier (UUID or nanoid)
 * @property {string} name - Human-readable label or customer name
 * @property {string} address - Original raw address input
 * @property {number|null} latitude - Resolved latitude coordinate
 * @property {number|null} longitude - Resolved longitude coordinate
 * @property {number} sequence - Zero-based order in the route
 * @property {StopMetadata} metadata - Operational metadata including lock flag
 */

/**
 * @typedef {Object} Route
 * @property {string} routeId - URL-safe unique identifier
 * @property {string} title - User-editable route title
 * @property {string} createdAt - ISO 8601 timestamp
 * @property {string} updatedAt - ISO 8601 timestamp
 * @property {number} revision - Monotonically increasing revision counter
 * @property {RouteSettings} settings - Configuration for optimization & routing
 * @property {string} [ownerIdentifier] - Optional owner / author identity
 * @property {'active'|'deleted'} status - Route status
 */

/**
 * @typedef {Object} RouteWithStops
 * @property {Route} route
 * @property {Stop[]} stops
 */

/**
 * @typedef {Object} RouteHistory
 * @property {string} routeId
 * @property {number} revision
 * @property {string} timestamp
 * @property {'create'|'update'|'optimize'|'delete'|'add_stop'|'remove_stop'|'reorder_stops'|'import'} changeType
 * @property {string} changedBy
 * @property {string} summary
 */

/**
 * @typedef {Object} GeocodeResult
 * @property {number|null} lat
 * @property {number|null} lng
 * @property {'ok'|'ambiguous'|'not_found'|'error'} status
 * @property {string} provider
 * @property {string} [displayName]
 * @property {any} [raw]
 */

/**
 * @typedef {Object} RouteLeg
 * @property {number} distanceMeters
 * @property {number} durationSeconds
 * @property {string} [summary]
 */

/**
 * @typedef {Object} RouteCalculationResult
 * @property {RouteLeg[]} legs
 * @property {{type: 'LineString', coordinates: [number, number][]}} geometry - GeoJSON LineString coordinates [lng, lat]
 * @property {number} totalDistanceMeters
 * @property {number} totalDurationSeconds
 * @property {'osrm'|'straightLine'} provider
 * @property {boolean} isFallback
 */

/**
 * @typedef {Object} OptimizationOptions
 * @property {boolean} [fixedStart=true]
 * @property {boolean} [fixedEnd=false]
 * @property {boolean} [lockedStops=true]
 */

/**
 * @typedef {Object} OptimizationResult
 * @property {string} routeId
 * @property {number} originalDistanceMeters
 * @property {number} optimizedDistanceMeters
 * @property {number} savingsMeters
 * @property {number} savingsPercent
 * @property {Stop[]} stops
 */

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {};
}


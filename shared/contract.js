/**
 * RouteForge - Shared Contract and Validation Rules
 * UMD bundle compatible with Node.js, browsers, and Google Apps Script.
 */
(function (root, factory) {
  if (typeof exports === 'object' && typeof module !== 'undefined') {
    const f = factory();
    module.exports = f;
    Object.assign(exports, f);
  } else if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else {
    root.RouteForgeContract = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const ErrorCodes = {
    INVALID_INPUT: 'INVALID_INPUT',
    NOT_FOUND: 'NOT_FOUND',
    REVISION_CONFLICT: 'REVISION_CONFLICT',
    PROVIDER_UNAVAILABLE: 'PROVIDER_UNAVAILABLE',
    RATE_LIMITED: 'RATE_LIMITED',
    STORAGE_ERROR: 'STORAGE_ERROR'
  };

  /**
   * Standard success response generator
   * @param {any} data
   * @param {number} [revision]
   */
  function formatSuccess(data, revision) {
    const res = { ok: true, data: data !== undefined ? data : null };
    if (typeof revision === 'number') {
      res.revision = revision;
    }
    return res;
  }

  /**
   * Standard error response generator
   * @param {string} code - from ErrorCodes
   * @param {string} message - user-facing clear description
   */
  function formatError(code, message) {
    return {
      ok: false,
      error: {
        code: code || ErrorCodes.INVALID_INPUT,
        message: message || 'An unexpected error occurred.'
      }
    };
  }

  /**
   * Validation helpers
   */
  function isNonEmptyString(val) {
    return typeof val === 'string' && val.trim().length > 0;
  }

  function isPositiveInteger(val) {
    return typeof val === 'number' && Number.isInteger(val) && val >= 0;
  }

  /**
   * Validates createRoute parameters
   * @param {Object} input
   */
  function validateCreateRoute(input) {
    if (!input || typeof input !== 'object') {
      return { valid: false, error: 'Request body must be an object.' };
    }
    if (input.title !== undefined && typeof input.title !== 'string') {
      return { valid: false, error: 'Route title must be a string.' };
    }
    return { valid: true };
  }

  /**
   * Validates getRoute parameters
   * @param {Object} input
   */
  function validateGetRoute(input) {
    if (!input || !isNonEmptyString(input.routeId)) {
      return { valid: false, error: 'routeId is required and must be a non-empty string.' };
    }
    return { valid: true };
  }

  /**
   * Validates getRouteRevision parameters
   * @param {Object} input
   */
  function validateGetRouteRevision(input) {
    if (!input || !isNonEmptyString(input.routeId)) {
      return { valid: false, error: 'routeId is required and must be a non-empty string.' };
    }
    return { valid: true };
  }

  /**
   * Validates updateRoute parameters
   * @param {Object} input
   */
  function validateUpdateRoute(input) {
    if (!input || !isNonEmptyString(input.routeId)) {
      return { valid: false, error: 'routeId is required.' };
    }
    if (!isPositiveInteger(input.expectedRevision)) {
      return { valid: false, error: 'expectedRevision is required and must be a non-negative integer.' };
    }
    if (!input.changes || typeof input.changes !== 'object') {
      return { valid: false, error: 'changes must be an object.' };
    }
    return { valid: true };
  }

  /**
   * Validates addStop parameters
   * @param {Object} input
   */
  function validateAddStop(input) {
    if (!input || !isNonEmptyString(input.routeId)) {
      return { valid: false, error: 'routeId is required.' };
    }
    if (!isPositiveInteger(input.expectedRevision)) {
      return { valid: false, error: 'expectedRevision is required and must be a non-negative integer.' };
    }
    if (!input.stop || typeof input.stop !== 'object') {
      return { valid: false, error: 'stop object is required.' };
    }
    if (!isNonEmptyString(input.stop.address) && !isNonEmptyString(input.stop.name)) {
      return { valid: false, error: 'stop must contain at least an address or a name.' };
    }
    return { valid: true };
  }

  /**
   * Validates removeStop parameters
   * @param {Object} input
   */
  function validateRemoveStop(input) {
    if (!input || !isNonEmptyString(input.routeId)) {
      return { valid: false, error: 'routeId is required.' };
    }
    if (!isPositiveInteger(input.expectedRevision)) {
      return { valid: false, error: 'expectedRevision is required.' };
    }
    if (!isNonEmptyString(input.stopId)) {
      return { valid: false, error: 'stopId is required.' };
    }
    return { valid: true };
  }

  /**
   * Validates reorderStops parameters
   * @param {Object} input
   */
  function validateReorderStops(input) {
    if (!input || !isNonEmptyString(input.routeId)) {
      return { valid: false, error: 'routeId is required.' };
    }
    if (!isPositiveInteger(input.expectedRevision)) {
      return { valid: false, error: 'expectedRevision is required.' };
    }
    if (!Array.isArray(input.sequence) || input.sequence.length === 0) {
      return { valid: false, error: 'sequence must be a non-empty array of stopIds.' };
    }
    return { valid: true };
  }

  /**
   * Validates updateStop parameters
   * @param {Object} input
   */
  function validateUpdateStop(input) {
    if (!input || !isNonEmptyString(input.routeId)) {
      return { valid: false, error: 'routeId is required.' };
    }
    if (!isPositiveInteger(input.expectedRevision)) {
      return { valid: false, error: 'expectedRevision is required.' };
    }
    if (!isNonEmptyString(input.stopId)) {
      return { valid: false, error: 'stopId is required.' };
    }
    if (!input.changes || typeof input.changes !== 'object') {
      return { valid: false, error: 'changes must be an object.' };
    }
    return { valid: true };
  }

  /**
   * Validates calculateRoute parameters
   * @param {Object} input
   */
  function validateCalculateRoute(input) {
    if (!input || !isNonEmptyString(input.routeId)) {
      return { valid: false, error: 'routeId is required.' };
    }
    if (input.provider && !['osrm', 'straightLine'].includes(input.provider)) {
      return { valid: false, error: 'provider must be "osrm" or "straightLine".' };
    }
    return { valid: true };
  }

  /**
   * Validates optimizeRoute parameters
   * @param {Object} input
   */
  function validateOptimizeRoute(input) {
    if (!input || !isNonEmptyString(input.routeId)) {
      return { valid: false, error: 'routeId is required.' };
    }
    if (input.options && typeof input.options !== 'object') {
      return { valid: false, error: 'options must be an object if provided.' };
    }
    return { valid: true };
  }

  /**
   * Validates exportRoute parameters
   * @param {Object} input
   */
  function validateExportRoute(input) {
    if (!input || !isNonEmptyString(input.routeId)) {
      return { valid: false, error: 'routeId is required.' };
    }
    if (input.format && input.format !== 'csv') {
      return { valid: false, error: 'Only "csv" format is currently supported.' };
    }
    return { valid: true };
  }

  return {
    ErrorCodes,
    formatSuccess,
    formatError,
    validateCreateRoute,
    validateGetRoute,
    validateGetRouteRevision,
    validateUpdateRoute,
    validateAddStop,
    validateRemoveStop,
    validateReorderStops,
    validateUpdateStop,
    validateCalculateRoute,
    validateOptimizeRoute,
    validateExportRoute
  };
});

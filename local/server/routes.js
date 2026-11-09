/**
 * RouteForge - Local Server API Routes
 * Matches Apps Script API contract and JSON shapes byte-for-byte.
 */
const express = require('express');
const contract = require('../../shared/contract');
const csv = require('../../shared/csv');
const optimizer = require('../../shared/optimize');
const geocoder = require('../../shared/geocode');
const routerProvider = require('../../shared/route');

// Per-route async mutex to serialize concurrent modifications
class RouteMutex {
  constructor() {
    this.locks = new Map();
  }

  async acquire(routeId) {
    while (this.locks.get(routeId)) {
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    this.locks.set(routeId, true);
  }

  release(routeId) {
    this.locks.delete(routeId);
  }
}

function createApiRouter(storageAdapter) {
  const router = express.Router();
  const mutex = new RouteMutex();

  // Helper error wrapper
  function sendError(res, code, message, status = 400) {
    return res.status(status).json(contract.formatError(code, message));
  }

  // initializeApp
  router.post('/initializeApp', async (req, res) => {
    try {
      await storageAdapter.init();
      res.json(contract.formatSuccess({ initialized: true }));
    } catch (err) {
      sendError(res, contract.ErrorCodes.STORAGE_ERROR, err.message, 500);
    }
  });

  // createRoute
  router.post('/createRoute', async (req, res) => {
    const valid = contract.validateCreateRoute(req.body);
    if (!valid.valid) {
      return sendError(res, contract.ErrorCodes.INVALID_INPUT, valid.error);
    }

    try {
      const created = await storageAdapter.createRoute(req.body);
      res.json(contract.formatSuccess(created, created.revision));
    } catch (err) {
      sendError(res, contract.ErrorCodes.STORAGE_ERROR, err.message, 500);
    }
  });

  // getRoute
  router.all('/getRoute', async (req, res) => {
    const routeId = req.body.routeId || req.query.routeId;
    const valid = contract.validateGetRoute({ routeId });
    if (!valid.valid) {
      return sendError(res, contract.ErrorCodes.INVALID_INPUT, valid.error);
    }

    try {
      const routeData = await storageAdapter.getRoute(routeId);
      res.json(contract.formatSuccess(routeData, routeData.route.revision));
    } catch (err) {
      const status = err.code === 'NOT_FOUND' ? 404 : 500;
      sendError(res, err.code || contract.ErrorCodes.STORAGE_ERROR, err.message, status);
    }
  });

  // getRouteRevision
  router.all('/getRouteRevision', async (req, res) => {
    const routeId = req.body.routeId || req.query.routeId;
    const valid = contract.validateGetRouteRevision({ routeId });
    if (!valid.valid) {
      return sendError(res, contract.ErrorCodes.INVALID_INPUT, valid.error);
    }

    try {
      const revData = await storageAdapter.getRouteRevision(routeId);
      res.json(contract.formatSuccess(revData, revData.revision));
    } catch (err) {
      const status = err.code === 'NOT_FOUND' ? 404 : 500;
      sendError(res, err.code || contract.ErrorCodes.STORAGE_ERROR, err.message, status);
    }
  });

  // updateRoute
  router.post('/updateRoute', async (req, res) => {
    const valid = contract.validateUpdateRoute(req.body);
    if (!valid.valid) {
      return sendError(res, contract.ErrorCodes.INVALID_INPUT, valid.error);
    }

    const { routeId, expectedRevision, changes } = req.body;
    await mutex.acquire(routeId);
    try {
      const result = await storageAdapter.updateRoute(routeId, expectedRevision, changes);
      res.json(contract.formatSuccess(result.route, result.revision));
    } catch (err) {
      const status = err.code === 'REVISION_CONFLICT' ? 409 : 500;
      sendError(res, err.code || contract.ErrorCodes.STORAGE_ERROR, err.message, status);
    } finally {
      mutex.release(routeId);
    }
  });

  // addStop
  router.post('/addStop', async (req, res) => {
    const valid = contract.validateAddStop(req.body);
    if (!valid.valid) {
      return sendError(res, contract.ErrorCodes.INVALID_INPUT, valid.error);
    }

    const { routeId, expectedRevision, stop } = req.body;

    // Automatic geocoding if coordinates not provided
    if ((stop.latitude === undefined || stop.latitude === null) && stop.address) {
      try {
        const geo = await geocoder.geocode(stop.address);
        stop.latitude = geo.lat;
        stop.longitude = geo.lng;
        stop.metadata = {
          ...(stop.metadata || {}),
          geocodeStatus: geo.status,
          displayName: geo.displayName || '',
          alternatives: geo.alternatives || []
        };
      } catch (e) {
        stop.metadata = { ...(stop.metadata || {}), geocodeStatus: 'error' };
      }
    }

    await mutex.acquire(routeId);
    try {
      const result = await storageAdapter.addStop(routeId, expectedRevision, stop);
      res.json(contract.formatSuccess(result.stop, result.revision));
    } catch (err) {
      const status = err.code === 'REVISION_CONFLICT' ? 409 : 500;
      sendError(res, err.code || contract.ErrorCodes.STORAGE_ERROR, err.message, status);
    } finally {
      mutex.release(routeId);
    }
  });

  // removeStop
  router.post('/removeStop', async (req, res) => {
    const valid = contract.validateRemoveStop(req.body);
    if (!valid.valid) {
      return sendError(res, contract.ErrorCodes.INVALID_INPUT, valid.error);
    }

    const { routeId, expectedRevision, stopId } = req.body;
    await mutex.acquire(routeId);
    try {
      const result = await storageAdapter.removeStop(routeId, expectedRevision, stopId);
      res.json(contract.formatSuccess(result, result.revision));
    } catch (err) {
      const status = err.code === 'REVISION_CONFLICT' ? 409 : 500;
      sendError(res, err.code || contract.ErrorCodes.STORAGE_ERROR, err.message, status);
    } finally {
      mutex.release(routeId);
    }
  });

  // reorderStops
  router.post('/reorderStops', async (req, res) => {
    const valid = contract.validateReorderStops(req.body);
    if (!valid.valid) {
      return sendError(res, contract.ErrorCodes.INVALID_INPUT, valid.error);
    }

    const { routeId, expectedRevision, sequence } = req.body;
    await mutex.acquire(routeId);
    try {
      const result = await storageAdapter.reorderStops(routeId, expectedRevision, sequence);
      res.json(contract.formatSuccess(result.stops, result.revision));
    } catch (err) {
      const status = err.code === 'REVISION_CONFLICT' ? 409 : 500;
      sendError(res, err.code || contract.ErrorCodes.STORAGE_ERROR, err.message, status);
    } finally {
      mutex.release(routeId);
    }
  });

  // updateStop
  router.post('/updateStop', async (req, res) => {
    const valid = contract.validateUpdateStop(req.body);
    if (!valid.valid) {
      return sendError(res, contract.ErrorCodes.INVALID_INPUT, valid.error);
    }

    const { routeId, expectedRevision, stopId, changes } = req.body;
    await mutex.acquire(routeId);
    try {
      const result = await storageAdapter.updateStop(routeId, expectedRevision, stopId, changes);
      res.json(contract.formatSuccess(result.stop, result.revision));
    } catch (err) {
      const status = err.code === 'REVISION_CONFLICT' ? 409 : 500;
      sendError(res, err.code || contract.ErrorCodes.STORAGE_ERROR, err.message, status);
    } finally {
      mutex.release(routeId);
    }
  });

  // calculateRoute
  router.post('/calculateRoute', async (req, res) => {
    const valid = contract.validateCalculateRoute(req.body);
    if (!valid.valid) {
      return sendError(res, contract.ErrorCodes.INVALID_INPUT, valid.error);
    }

    const { routeId, provider, allowFallback } = req.body;
    try {
      const routeData = await storageAdapter.getRoute(routeId);
      const stops = routeData.stops;

      const calcResult = await routerProvider.computeRoadRoute(stops, {
        provider: provider || 'osrm',
        allowFallback: allowFallback !== undefined ? allowFallback : false
      });

      if (!calcResult.ok) {
        return sendError(res, calcResult.error.code, calcResult.error.message, 502);
      }

      res.json(contract.formatSuccess(calcResult.data));
    } catch (err) {
      sendError(res, contract.ErrorCodes.STORAGE_ERROR, err.message, 500);
    }
  });

  // optimizeRoute
  router.post('/optimizeRoute', async (req, res) => {
    const valid = contract.validateOptimizeRoute(req.body);
    if (!valid.valid) {
      return sendError(res, contract.ErrorCodes.INVALID_INPUT, valid.error);
    }

    const { routeId, options } = req.body;
    await mutex.acquire(routeId);
    try {
      const routeData = await storageAdapter.getRoute(routeId);
      const optResult = optimizer.optimizeStops(routeData.stops, options);
      const sequence = optResult.stops.map(s => s.stopId);

      const updateResult = await storageAdapter.reorderStops(routeId, routeData.route.revision, sequence);

      res.json(contract.formatSuccess({
        originalDistanceMeters: optResult.originalDistanceMeters,
        optimizedDistanceMeters: optResult.optimizedDistanceMeters,
        savingsMeters: optResult.savingsMeters,
        savingsPercent: optResult.savingsPercent,
        stops: updateResult.stops
      }, updateResult.revision));
    } catch (err) {
      sendError(res, err.code || contract.ErrorCodes.STORAGE_ERROR, err.message, 500);
    } finally {
      mutex.release(routeId);
    }
  });

  // exportRoute
  router.post('/exportRoute', async (req, res) => {
    const valid = contract.validateExportRoute(req.body);
    if (!valid.valid) {
      return sendError(res, contract.ErrorCodes.INVALID_INPUT, valid.error);
    }

    const { routeId } = req.body;
    try {
      const routeData = await storageAdapter.getRoute(routeId);
      const csvContent = csv.exportStopsToCSV(routeData.stops, routeData.route.title);
      const cleanTitle = (routeData.route.title || 'Route').replace(/[^a-zA-Z0-9_-]/g, '_');

      res.json(contract.formatSuccess({
        filename: `${cleanTitle}-stops.csv`,
        mimeType: 'text/csv',
        content: csvContent
      }));
    } catch (err) {
      sendError(res, err.code || contract.ErrorCodes.STORAGE_ERROR, err.message, 500);
    }
  });

  // geocode single address
  router.post('/geocode', async (req, res) => {
    const { address } = req.body;
    if (!address || typeof address !== 'string') {
      return sendError(res, contract.ErrorCodes.INVALID_INPUT, 'address is required');
    }

    try {
      const result = await geocoder.geocode(address);
      res.json(contract.formatSuccess(result));
    } catch (err) {
      sendError(res, contract.ErrorCodes.PROVIDER_UNAVAILABLE, err.message, 502);
    }
  });

  return router;
}

module.exports = createApiRouter;


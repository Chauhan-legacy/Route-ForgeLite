/**
 * RouteForge - Google Apps Script Entry Point
 * Implements doGet / doPost for both HTML Web App rendering and JSON API contract.
 */

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || '';

  // If API action specified in query params, handle as JSON endpoint
  if (action) {
    var response = handleApiAction(action, e.parameter);
    return ContentService.createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // Otherwise serve Web App HTML
  var routeId = (e && e.parameter && e.parameter.routeId) || '';
  var template = HtmlService.createTemplateFromFile('Index');
  template.initialRouteId = routeId;

  return template.evaluate()
    .setTitle('RouteForge - Multi-Stop Route Planner')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  var action = (e && e.parameter && e.parameter.action) || '';
  var body = {};

  if (e && e.postData && e.postData.contents) {
    try {
      body = JSON.parse(e.postData.contents);
    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({
        ok: false,
        error: { code: 'INVALID_INPUT', message: 'Malformed JSON payload: ' + err.message }
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }

  var response = handleApiAction(action, body);
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Common API Dispatcher matching contract.js exactly
 */
function handleApiAction(action, params) {
  try {
    switch (action) {
      case 'initializeApp':
        var initResult = initializeApp();
        return { ok: true, data: initResult };

      case 'createRoute':
        var created = RouteService.createRoute(params);
        return { ok: true, data: created, revision: created.revision };

      case 'getRoute':
        if (!params.routeId) throw { code: 'INVALID_INPUT', message: 'routeId is required' };
        var routeData = RouteService.getRoute(params.routeId);
        return { ok: true, data: routeData, revision: routeData.route.revision };

      case 'getRouteRevision':
        if (!params.routeId) throw { code: 'INVALID_INPUT', message: 'routeId is required' };
        var revData = RouteService.getRouteRevision(params.routeId);
        return { ok: true, data: revData, revision: revData.revision };

      case 'updateRoute':
        if (!params.routeId) throw { code: 'INVALID_INPUT', message: 'routeId is required' };
        var updatedRoute = RouteService.updateRoute(params.routeId, params.expectedRevision, params.changes);
        return { ok: true, data: updatedRoute.route, revision: updatedRoute.revision };

      case 'addStop':
        if (!params.routeId) throw { code: 'INVALID_INPUT', message: 'routeId is required' };
        var addedStop = RouteService.addStop(params.routeId, params.expectedRevision, params.stop);
        return { ok: true, data: addedStop.stop, revision: addedStop.revision };

      case 'removeStop':
        if (!params.routeId) throw { code: 'INVALID_INPUT', message: 'routeId is required' };
        var removed = RouteService.removeStop(params.routeId, params.expectedRevision, params.stopId);
        return { ok: true, data: removed, revision: removed.revision };

      case 'reorderStops':
        if (!params.routeId) throw { code: 'INVALID_INPUT', message: 'routeId is required' };
        var reordered = RouteService.reorderStops(params.routeId, params.expectedRevision, params.sequence);
        return { ok: true, data: reordered.stops, revision: reordered.revision };

      case 'updateStop':
        if (!params.routeId) throw { code: 'INVALID_INPUT', message: 'routeId is required' };
        var updatedStop = RouteService.updateStop(params.routeId, params.expectedRevision, params.stopId, params.changes);
        return { ok: true, data: updatedStop.stop, revision: updatedStop.revision };

      case 'calculateRoute':
        if (!params.routeId) throw { code: 'INVALID_INPUT', message: 'routeId is required' };
        var calcResult = RouteService.calculateRoute(params.routeId, params.provider);
        return { ok: true, data: calcResult };

      case 'optimizeRoute':
        if (!params.routeId) throw { code: 'INVALID_INPUT', message: 'routeId is required' };
        var optResult = RouteService.optimizeRoute(params.routeId, params.options);
        return { ok: true, data: optResult, revision: optResult.revision };

      case 'exportRoute':
        if (!params.routeId) throw { code: 'INVALID_INPUT', message: 'routeId is required' };
        var expResult = RouteService.exportRoute(params.routeId, params.format);
        return { ok: true, data: expResult };

      case 'geocode':
        if (!params.address) throw { code: 'INVALID_INPUT', message: 'address is required' };
        var geoResult = GeocodingService.geocode(params.address);
        return { ok: true, data: geoResult };

      default:
        return {
          ok: false,
          error: { code: 'INVALID_INPUT', message: 'Unknown action: ' + action }
        };
    }
  } catch (err) {
    var code = err.code || 'STORAGE_ERROR';
    var msg = err.message || String(err);
    return {
      ok: false,
      error: { code: code, message: msg }
    };
  }
}


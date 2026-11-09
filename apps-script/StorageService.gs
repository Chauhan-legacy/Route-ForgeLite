/**
 * RouteForge - Google Sheets Storage Adapter
 * Implements transaction-safe CRUD with LockService, revision checking,
 * and 50-entry history retention capping.
 */

var StorageService = (function () {
  'use strict';

  function generateId(prefix) {
    var p = prefix || '';
    var rand = Math.random().toString(36).substring(2, 10);
    var ts = new Date().getTime().toString(36);
    return p + ts + '-' + rand;
  }

  function withLock(callback) {
    var lock = LockService.getScriptLock();
    try {
      lock.waitLock(10000); // Wait up to 10s for lock
    } catch (e) {
      throw new Error('STORAGE_TIMEOUT: Could not acquire database lock within 10 seconds.');
    }

    try {
      return callback();
    } finally {
      lock.releaseLock();
    }
  }

  function getSheet(name) {
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      initializeApp();
      sheet = ss.getSheetByName(name);
    }
    return sheet;
  }

  function appendHistoryRecord(routeId, revision, changeType, changedBy, summary) {
    var historySheet = getSheet(CONFIG.TABLES.HISTORY);
    var now = new Date().toISOString();
    historySheet.appendRow([
      routeId,
      revision,
      now,
      changeType || 'update',
      changedBy || 'anonymous',
      summary || ''
    ]);

    // Enforce 50-item retention cap per route
    var lastRow = historySheet.getLastRow();
    if (lastRow > 51) {
      var data = historySheet.getRange(2, 1, lastRow - 1, 6).getValues();
      var matchingIndices = [];
      for (var i = 0; i < data.length; i++) {
        if (data[i][0] === routeId) {
          matchingIndices.push(i + 2); // 1-based row number
        }
      }
      if (matchingIndices.length > 50) {
        var toDeleteCount = matchingIndices.length - 50;
        // Delete oldest matching entries from top
        for (var d = 0; d < toDeleteCount; d++) {
          historySheet.deleteRow(matchingIndices[d] - d);
        }
      }
    }
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

      routeSheet.appendRow([
        routeId,
        title,
        now,
        now,
        revision,
        settings,
        owner,
        'active'
      ]);

      appendHistoryRecord(routeId, revision, 'create', owner, 'Route created');

      return {
        routeId: routeId,
        revision: revision,
        url: '?routeId=' + routeId,
        createdAt: now,
        updatedAt: now
      };
    });
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

  function getRoute(routeId) {
    var routeSheet = getSheet(CONFIG.TABLES.ROUTES);
    var found = findRouteRow(routeSheet, routeId);
    if (!found) {
      var err = new Error('Route ' + routeId + ' not found');
      err.code = 'NOT_FOUND';
      throw err;
    }

    // Get stops
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

    // Get history (last 50)
    var histSheet = getSheet(CONFIG.TABLES.HISTORY);
    var histLastRow = histSheet.getLastRow();
    var history = [];
    if (histLastRow >= 2) {
      var histValues = histSheet.getRange(2, 1, histLastRow - 1, 6).getValues();
      for (var h = histValues.length - 1; h >= 0; h--) {
        if (histValues[h][0] === routeId) {
          history.push({
            routeId: histValues[h][0],
            revision: parseInt(histValues[h][1], 10),
            timestamp: histValues[h][2],
            changeType: histValues[h][3],
            changedBy: histValues[h][4],
            summary: histValues[h][5]
          });
          if (history.length >= 50) break;
        }
      }
    }

    return {
      route: found.data,
      stops: stops,
      history: history
    };
  }

  function getRouteRevision(routeId) {
    var routeSheet = getSheet(CONFIG.TABLES.ROUTES);
    var found = findRouteRow(routeSheet, routeId);
    if (!found) {
      var err = new Error('Route ' + routeId + ' not found');
      err.code = 'NOT_FOUND';
      throw err;
    }
    return {
      revision: found.data.revision,
      updatedAt: found.data.updatedAt
    };
  }

  function updateRoute(routeId, expectedRevision, changes) {
    return withLock(function () {
      var routeSheet = getSheet(CONFIG.TABLES.ROUTES);
      var found = findRouteRow(routeSheet, routeId);
      if (!found) {
        var err = new Error('Route ' + routeId + ' not found');
        err.code = 'NOT_FOUND';
        throw err;
      }

      if (typeof expectedRevision === 'number' && found.data.revision !== expectedRevision) {
        var confErr = new Error('Revision conflict: current revision is ' + found.data.revision + ', expected ' + expectedRevision);
        confErr.code = 'REVISION_CONFLICT';
        throw confErr;
      }

      var nextRev = found.data.revision + 1;
      var now = new Date().toISOString();

      var newTitle = changes.title !== undefined ? String(changes.title).trim() : found.data.title;
      var newSettings = changes.settings !== undefined ? Object.assign({}, found.data.settings, changes.settings) : found.data.settings;
      var newStatus = changes.status !== undefined ? changes.status : found.data.status;

      // Update row
      routeSheet.getRange(found.rowNum, 2).setValue(newTitle);
      routeSheet.getRange(found.rowNum, 4).setValue(now);
      routeSheet.getRange(found.rowNum, 5).setValue(nextRev);
      routeSheet.getRange(found.rowNum, 6).setValue(JSON.stringify(newSettings));
      routeSheet.getRange(found.rowNum, 8).setValue(newStatus);

      appendHistoryRecord(routeId, nextRev, 'update', changes.changedBy, 'Route metadata updated');

      found.data.title = newTitle;
      found.data.updatedAt = now;
      found.data.revision = nextRev;
      found.data.settings = newSettings;
      found.data.status = newStatus;

      return {
        route: found.data,
        revision: nextRev
      };
    });
  }

  function addStop(routeId, expectedRevision, stopData) {
    return withLock(function () {
      var routeSheet = getSheet(CONFIG.TABLES.ROUTES);
      var found = findRouteRow(routeSheet, routeId);
      if (!found) {
        var err = new Error('Route ' + routeId + ' not found');
        err.code = 'NOT_FOUND';
        throw err;
      }

      if (typeof expectedRevision === 'number' && found.data.revision !== expectedRevision) {
        var confErr = new Error('Revision conflict: current revision is ' + found.data.revision + ', expected ' + expectedRevision);
        confErr.code = 'REVISION_CONFLICT';
        throw confErr;
      }

      var stopSheet = getSheet(CONFIG.TABLES.STOPS);
      var stopId = stopData.stopId || generateId('stop_');
      var name = (stopData.name && stopData.name.trim()) || (stopData.address && stopData.address.split(',')[0].trim()) || 'Stop';
      var address = stopData.address ? stopData.address.trim() : '';
      var lat = typeof stopData.latitude === 'number' ? stopData.latitude : '';
      var lng = typeof stopData.longitude === 'number' ? stopData.longitude : '';
      var seq = typeof stopData.sequence === 'number' ? stopData.sequence : 0;
      var metadata = JSON.stringify(stopData.metadata || { locked: false, geocodeStatus: 'pending' });

      stopSheet.appendRow([
        routeId,
        stopId,
        name,
        address,
        lat,
        lng,
        seq,
        metadata
      ]);

      var nextRev = found.data.revision + 1;
      var now = new Date().toISOString();
      routeSheet.getRange(found.rowNum, 4).setValue(now);
      routeSheet.getRange(found.rowNum, 5).setValue(nextRev);

      appendHistoryRecord(routeId, nextRev, 'add_stop', stopData.changedBy, 'Added stop: ' + name);

      return {
        stop: {
          routeId: routeId,
          stopId: stopId,
          name: name,
          address: address,
          latitude: lat !== '' ? parseFloat(lat) : null,
          longitude: lng !== '' ? parseFloat(lng) : null,
          sequence: seq,
          metadata: JSON.parse(metadata)
        },
        revision: nextRev
      };
    });
  }

  function removeStop(routeId, expectedRevision, stopId) {
    return withLock(function () {
      var routeSheet = getSheet(CONFIG.TABLES.ROUTES);
      var found = findRouteRow(routeSheet, routeId);
      if (!found) {
        var err = new Error('Route ' + routeId + ' not found');
        err.code = 'NOT_FOUND';
        throw err;
      }

      if (typeof expectedRevision === 'number' && found.data.revision !== expectedRevision) {
        var confErr = new Error('Revision conflict: current revision is ' + found.data.revision + ', expected ' + expectedRevision);
        confErr.code = 'REVISION_CONFLICT';
        throw confErr;
      }

      var stopSheet = getSheet(CONFIG.TABLES.STOPS);
      var lastRow = stopSheet.getLastRow();
      var stopDeleted = false;
      var stopName = stopId;

      if (lastRow >= 2) {
        var values = stopSheet.getRange(2, 1, lastRow - 1, 8).getValues();
        for (var i = 0; i < values.length; i++) {
          if (values[i][0] === routeId && values[i][1] === stopId) {
            stopName = values[i][2];
            stopSheet.deleteRow(i + 2);
            stopDeleted = true;
            break;
          }
        }
      }

      if (!stopDeleted) {
        var nErr = new Error('Stop ' + stopId + ' not found');
        nErr.code = 'NOT_FOUND';
        throw nErr;
      }

      // Re-sequence remaining stops
      var refreshedLastRow = stopSheet.getLastRow();
      if (refreshedLastRow >= 2) {
        var refValues = stopSheet.getRange(2, 1, refreshedLastRow - 1, 8).getValues();
        var seqIdx = 0;
        for (var r = 0; r < refValues.length; r++) {
          if (refValues[r][0] === routeId) {
            stopSheet.getRange(r + 2, 7).setValue(seqIdx);
            seqIdx++;
          }
        }
      }

      var nextRev = found.data.revision + 1;
      var now = new Date().toISOString();
      routeSheet.getRange(found.rowNum, 4).setValue(now);
      routeSheet.getRange(found.rowNum, 5).setValue(nextRev);

      appendHistoryRecord(routeId, nextRev, 'remove_stop', null, 'Removed stop: ' + stopName);

      return { removedStopId: stopId, revision: nextRev };
    });
  }

  function reorderStops(routeId, expectedRevision, sequence) {
    return withLock(function () {
      var routeSheet = getSheet(CONFIG.TABLES.ROUTES);
      var found = findRouteRow(routeSheet, routeId);
      if (!found) {
        var err = new Error('Route ' + routeId + ' not found');
        err.code = 'NOT_FOUND';
        throw err;
      }

      if (typeof expectedRevision === 'number' && found.data.revision !== expectedRevision) {
        var confErr = new Error('Revision conflict: current revision is ' + found.data.revision + ', expected ' + expectedRevision);
        confErr.code = 'REVISION_CONFLICT';
        throw confErr;
      }

      var stopSheet = getSheet(CONFIG.TABLES.STOPS);
      var lastRow = stopSheet.getLastRow();
      var orderMap = {};
      for (var s = 0; s < sequence.length; s++) {
        orderMap[sequence[s]] = s;
      }

      if (lastRow >= 2) {
        var values = stopSheet.getRange(2, 1, lastRow - 1, 8).getValues();
        for (var i = 0; i < values.length; i++) {
          if (values[i][0] === routeId) {
            var sId = values[i][1];
            if (orderMap[sId] !== undefined) {
              stopSheet.getRange(i + 2, 7).setValue(orderMap[sId]);
            }
          }
        }
      }

      var nextRev = found.data.revision + 1;
      var now = new Date().toISOString();
      routeSheet.getRange(found.rowNum, 4).setValue(now);
      routeSheet.getRange(found.rowNum, 5).setValue(nextRev);

      appendHistoryRecord(routeId, nextRev, 'reorder_stops', null, 'Stops reordered');

      // Return updated stops
      var routeData = getRoute(routeId);
      return { stops: routeData.stops, revision: nextRev };
    });
  }

  function updateStop(routeId, expectedRevision, stopId, changes) {
    return withLock(function () {
      var routeSheet = getSheet(CONFIG.TABLES.ROUTES);
      var found = findRouteRow(routeSheet, routeId);
      if (!found) {
        var err = new Error('Route ' + routeId + ' not found');
        err.code = 'NOT_FOUND';
        throw err;
      }

      if (typeof expectedRevision === 'number' && found.data.revision !== expectedRevision) {
        var confErr = new Error('Revision conflict: current revision is ' + found.data.revision + ', expected ' + expectedRevision);
        confErr.code = 'REVISION_CONFLICT';
        throw confErr;
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
            currentStop = {
              name: values[i][2],
              address: values[i][3],
              latitude: values[i][4],
              longitude: values[i][5],
              sequence: values[i][6],
              metadata: JSON.parse(values[i][7] || '{}')
            };
            break;
          }
        }
      }

      if (targetRow === -1 || !currentStop) {
        var notFoundErr = new Error('Stop ' + stopId + ' not found');
        notFoundErr.code = 'NOT_FOUND';
        throw notFoundErr;
      }

      var newName = changes.name !== undefined ? String(changes.name).trim() : currentStop.name;
      var newAddress = changes.address !== undefined ? String(changes.address).trim() : currentStop.address;
      var newLat = changes.latitude !== undefined ? changes.latitude : currentStop.latitude;
      var newLng = changes.longitude !== undefined ? changes.longitude : currentStop.longitude;
      var newMetadata = changes.metadata !== undefined
        ? Object.assign({}, currentStop.metadata, changes.metadata)
        : currentStop.metadata;

      stopSheet.getRange(targetRow, 3).setValue(newName);
      stopSheet.getRange(targetRow, 4).setValue(newAddress);
      stopSheet.getRange(targetRow, 5).setValue(newLat !== null ? newLat : '');
      stopSheet.getRange(targetRow, 6).setValue(newLng !== null ? newLng : '');
      stopSheet.getRange(targetRow, 8).setValue(JSON.stringify(newMetadata));

      var nextRev = found.data.revision + 1;
      var now = new Date().toISOString();
      routeSheet.getRange(found.rowNum, 4).setValue(now);
      routeSheet.getRange(found.rowNum, 5).setValue(nextRev);

      appendHistoryRecord(routeId, nextRev, 'update', changes.changedBy, 'Updated stop: ' + newName);

      return {
        stop: {
          routeId: routeId,
          stopId: stopId,
          name: newName,
          address: newAddress,
          latitude: typeof newLat === 'number' ? newLat : null,
          longitude: typeof newLng === 'number' ? newLng : null,
          sequence: currentStop.sequence,
          metadata: newMetadata
        },
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


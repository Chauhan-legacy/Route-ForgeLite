/**
 * RouteForge - Apps Script Sync & Conflict Service
 */

var SyncService = (function () {
  'use strict';

  function verifyRevision(currentRevision, expectedRevision) {
    if (typeof expectedRevision === 'number' && currentRevision !== expectedRevision) {
      var err = new Error('Route was modified by another user. (Current rev: ' + currentRevision + ', expected: ' + expectedRevision + ')');
      err.code = 'REVISION_CONFLICT';
      throw err;
    }
  }

  return {
    verifyRevision: verifyRevision
  };
})();


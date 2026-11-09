const assert = require('assert');
const contract = require('../shared/contract');
const csv = require('../shared/csv');
const optimizer = require('../shared/optimize');
const route = require('../shared/route');

console.log('Testing Shared Modules...');

// 1. Contract Tests
{
  const res = contract.formatSuccess({ test: 123 }, 5);
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.revision, 5);
  assert.strictEqual(res.data.test, 123);

  const err = contract.formatError(contract.ErrorCodes.REVISION_CONFLICT, 'Conflict');
  assert.strictEqual(err.ok, false);
  assert.strictEqual(err.error.code, 'REVISION_CONFLICT');

  const v1 = contract.validateCreateRoute({ title: 'My Route' });
  assert.strictEqual(v1.valid, true);

  const v2 = contract.validateAddStop({ routeId: 'r1', expectedRevision: 0, stop: { name: 'S1' } });
  assert.strictEqual(v2.valid, true);

  const v3 = contract.validateAddStop({ routeId: 'r1', expectedRevision: -1, stop: {} });
  assert.strictEqual(v3.valid, false);

  console.log('✓ Contract & validation tests passed');
}

// 2. CSV Parser & Formula Injection Tests
{
  // Normal CSV with headers and quoted fields with commas
  const csvText = `Name,Address
"Cafe Central","Herrengasse 14, 1010 Wien"
"Stephansdom","Stephansplatz 3, 1010 Wien"
"Belvedere","Prinz Eugen-Straße 27, 1030 Wien"`;

  const parsed = csv.parseStopCSV(csvText);
  assert.strictEqual(parsed.success, true);
  assert.strictEqual(parsed.stops.length, 3);
  assert.strictEqual(parsed.stops[0].name, 'Cafe Central');
  assert.strictEqual(parsed.stops[0].address, 'Herrengasse 14, 1010 Wien');

  // Single address per row
  const rawList = `10 Downing St, London\nBuckingham Palace, London`;
  const parsedRaw = csv.parseStopCSV(rawList);
  assert.strictEqual(parsedRaw.success, true);
  assert.strictEqual(parsedRaw.stops.length, 2);

  // Malformed CSV (unclosed quote)
  const malformed = `Name,Address\n"Unclosed quote,Some address`;
  const parsedBad = csv.parseStopCSV(malformed);
  assert.strictEqual(parsedBad.success, false);
  assert(parsedBad.error.row > 0);
  assert(parsedBad.error.reason.includes('Unclosed'));

  // Formula injection testing in sanitizeCellForExport
  const formulaCell = '=1+2';
  const sanitized = csv.sanitizeCellForExport(formulaCell);
  assert(sanitized.startsWith("'="), 'Should prefix dangerous formula with single quote');

  const formulaWithQuotes = '=CMD("calc")';
  const sanitizedQuotes = csv.sanitizeCellForExport(formulaWithQuotes);
  assert(sanitizedQuotes.includes("'="), 'Should contain single quote prefix before formula inside CSV quote');

  const plusCell = '+12345';
  assert(csv.sanitizeCellForExport(plusCell).startsWith("'+"));

  const exportStr = csv.exportStopsToCSV([
    { name: '=Danger', address: '+Exploit', latitude: 48.2, longitude: 16.3 }
  ]);
  assert(exportStr.includes("'="));
  assert(exportStr.includes("'+"));

  console.log('✓ CSV parser and export formula injection tests passed');
}

// 3. Optimizer Tests
{
  // 4 collinear stops: A (0,0), B (0, 1), C (0, 2), D (0, 3)
  // Input in scrambled order: A, C, B, D
  const stops = [
    { stopId: 'A', sequence: 0, latitude: 0, longitude: 0, metadata: {} },
    { stopId: 'C', sequence: 1, latitude: 0, longitude: 2, metadata: {} },
    { stopId: 'B', sequence: 2, latitude: 0, longitude: 1, metadata: {} },
    { stopId: 'D', sequence: 3, latitude: 0, longitude: 3, metadata: {} }
  ];

  const opt = optimizer.optimizeStops(stops, { fixedStart: true, fixedEnd: true });
  assert.strictEqual(opt.stops[0].stopId, 'A');
  assert.strictEqual(opt.stops[1].stopId, 'B');
  assert.strictEqual(opt.stops[2].stopId, 'C');
  assert.strictEqual(opt.stops[3].stopId, 'D');
  assert(opt.savingsMeters > 0, 'Optimizer should reduce distance');

  // Locked stop test: lock C at sequence 1
  const stopsWithLock = [
    { stopId: 'A', sequence: 0, latitude: 0, longitude: 0, metadata: {} },
    { stopId: 'C', sequence: 1, latitude: 0, longitude: 2, metadata: { locked: true } },
    { stopId: 'B', sequence: 2, latitude: 0, longitude: 1, metadata: {} },
    { stopId: 'D', sequence: 3, latitude: 0, longitude: 3, metadata: {} }
  ];
  const optLocked = optimizer.optimizeStops(stopsWithLock, { fixedStart: true, fixedEnd: true, lockedStops: true });
  assert.strictEqual(optLocked.stops[1].stopId, 'C', 'Locked stop C must remain at index 1');

  console.log('✓ Optimizer nearest-neighbor & 2-opt tests passed');
}

// 4. Straight-line route test
{
  const stops = [
    { latitude: 48.2082, longitude: 16.3738 },
    { latitude: 48.1915, longitude: 16.3808 }
  ];
  const res = route.computeStraightLineRoute(stops);
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.data.provider, 'straightLine');
  assert.strictEqual(res.data.isFallback, true);
  assert(res.data.totalDistanceMeters > 1000);
  assert.strictEqual(res.data.geometry.coordinates.length, 2);

  console.log('✓ Straight-line route fallback test passed');
}

console.log('\nAll shared tests successfully passed!');

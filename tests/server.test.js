const assert = require('assert');
const path = require('path');
const fs = require('fs');
const MemoryStorageAdapter = require('../local/server/storage/memory');
const SqliteStorageAdapter = require('../local/server/storage/sqlite');
const optimizer = require('../shared/optimize');

async function testStorageAdapter(name, adapter) {
  console.log(`\n--- Testing Storage Adapter: ${name} ---`);
  await adapter.init();

  // 1. Create Route
  const created = await adapter.createRoute({ title: 'Vienna Delivery Tour' });
  assert(created.routeId, 'Must return routeId');
  assert.strictEqual(created.revision, 1);
  const routeId = created.routeId;

  // 2. Get Route
  const fetched = await adapter.getRoute(routeId);
  assert.strictEqual(fetched.route.title, 'Vienna Delivery Tour');
  assert.strictEqual(fetched.route.revision, 1);
  assert.strictEqual(fetched.stops.length, 0);

  // 3. Add Stops
  const s1 = await adapter.addStop(routeId, 1, {
    name: 'Depot',
    address: 'Stephansplatz 3, 1010 Wien',
    latitude: 48.2082,
    longitude: 16.3738,
    metadata: { locked: false }
  });
  assert.strictEqual(s1.revision, 2);
  assert.strictEqual(s1.stop.name, 'Depot');

  const s2 = await adapter.addStop(routeId, 2, {
    name: 'Customer A',
    address: 'Praterstern 1, 1020 Wien',
    latitude: 48.2178,
    longitude: 16.3920,
    metadata: { locked: false }
  });
  assert.strictEqual(s2.revision, 3);

  const s3 = await adapter.addStop(routeId, 3, {
    name: 'Customer B',
    address: 'Schönbrunn, 1130 Wien',
    latitude: 48.1858,
    longitude: 16.3128,
    metadata: { locked: true } // Locked stop
  });
  assert.strictEqual(s3.revision, 4);

  // 4. Verify Revision Check
  const rev = await adapter.getRouteRevision(routeId);
  assert.strictEqual(rev.revision, 4);

  // 5. Revision Conflict on Write
  let conflictDetected = false;
  try {
    // Attempting write with stale revision 2 when current is 4
    await adapter.updateRoute(routeId, 2, { title: 'Conflicting Title' });
  } catch (err) {
    conflictDetected = true;
    assert.strictEqual(err.code, 'REVISION_CONFLICT');
  }
  assert(conflictDetected, 'Should reject write with stale revision');

  // 6. Update Stop (Lock / Address change)
  const updatedStop = await adapter.updateStop(routeId, 4, s2.stop.stopId, {
    name: 'Customer A (VIP)',
    metadata: { locked: true }
  });
  assert.strictEqual(updatedStop.revision, 5);
  assert.strictEqual(updatedStop.stop.name, 'Customer A (VIP)');
  assert.strictEqual(updatedStop.stop.metadata.locked, true);

  // 7. Reorder Stops
  const currentRoute = await adapter.getRoute(routeId);
  const stopIds = currentRoute.stops.map(s => s.stopId).reverse();
  const reordered = await adapter.reorderStops(routeId, 5, stopIds);
  assert.strictEqual(reordered.revision, 6);
  assert.strictEqual(reordered.stops[0].stopId, stopIds[0]);

  // 8. Remove Stop
  const removed = await adapter.removeStop(routeId, 6, s1.stop.stopId);
  assert.strictEqual(removed.revision, 7);

  const finalRoute = await adapter.getRoute(routeId);
  assert.strictEqual(finalRoute.stops.length, 2);
  assert.strictEqual(finalRoute.stops[0].sequence, 0);
  assert.strictEqual(finalRoute.stops[1].sequence, 1);

  // 9. History verification
  assert(finalRoute.history.length > 0, 'History must contain change records');
  assert(finalRoute.history.length <= 50, 'History retention must not exceed 50');

  console.log(`✓ ${name} adapter passed all CRUD, transaction, and revision conflict tests!`);
}

async function runAll() {
  console.log('Starting RouteForge Storage Integration Tests...');

  // Test 1: In-Memory Adapter
  const memoryAdapter = new MemoryStorageAdapter();
  await testStorageAdapter('In-Memory', memoryAdapter);

  // Test 2: SQLite Adapter
  const testDbPath = path.join(__dirname, 'test_routeforge.sqlite');
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

  const sqliteAdapter = new SqliteStorageAdapter(testDbPath);
  await testStorageAdapter('SQLite (Disk)', sqliteAdapter);

  // Cleanup test DB
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

  console.log('\n===========================================');
  console.log('ALL STORAGE & CONTRACT TESTS PASSED CLEANLY');
  console.log('===========================================\n');
}

runAll().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});


/**
 * RouteForge Lite — Benchmark Measurement Script
 * 
 * Measures actual execution times for:
 * 1. CSV parsing of waypoint files
 * 2. In-browser 2-Opt TSP optimization across various stop counts (12, 25, 50 stops)
 * 
 * Usage:
 *   node scripts/measure_benchmarks.js
 */

const fs = require('fs');
const path = require('path');

// Haversine distance helper
function haversineDistance(lat1, lon1, lat2, lon2) {
  if (lat1 === lat2 && lon1 === lon2) return 0.0;
  const toRad = Math.PI / 180.0;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) ** 2;
  return 6371000.0 * 2.0 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0.0, 1.0 - a)));
}

// 2-Opt local search TSP implementation (matching clientRouting.ts)
function solve2Opt(stops) {
  const n = stops.length;
  if (n <= 2) return stops;

  let tour = [...stops];
  let improved = true;
  let iterations = 0;
  const maxIterations = 250;

  while (improved && iterations < maxIterations) {
    improved = false;
    iterations++;

    for (let i = 1; i < n - 1; i++) {
      for (let j = i + 1; j < n; j++) {
        const p1 = tour[i - 1];
        const p2 = tour[i];
        const p3 = tour[j];
        const p4 = j + 1 < n ? tour[j + 1] : null;

        const curD1 = haversineDistance(p1.lat, p1.lng, p2.lat, p2.lng);
        const curD2 = p4 ? haversineDistance(p3.lat, p3.lng, p4.lat, p4.lng) : 0;
        const curDist = curD1 + curD2;

        const newD1 = haversineDistance(p1.lat, p1.lng, p3.lat, p3.lng);
        const newD2 = p4 ? haversineDistance(p2.lat, p2.lng, p4.lat, p4.lng) : 0;
        const newDist = newD1 + newD2;

        if (newDist < curDist - 0.001) {
          const segment = tour.slice(i, j + 1).reverse();
          tour.splice(i, segment.length, ...segment);
          improved = true;
          break;
        }
      }
      if (improved) break;
    }
  }
  return tour;
}

// Generate random synthetic stops for scale benchmarks
function generateRandomStops(count) {
  const stops = [];
  for (let i = 0; i < count; i++) {
    stops.push({
      id: `stop_${i}`,
      lat: 10 + Math.random() * 20,
      lng: 70 + Math.random() * 20
    });
  }
  return stops;
}

function runBenchmarks() {
  console.log('====================================================');
  console.log(' RouteForge Lite — Benchmark Measurement Suite');
  console.log('====================================================\n');

  // 1. Measure CSV Parsing Time
  const csvPath = path.join(__dirname, '../examples/jyotirlingas.csv');
  if (fs.existsSync(csvPath)) {
    const raw = fs.readFileSync(csvPath, 'utf8');
    const startParse = performance.now();
    const lines = raw.split(/\r?\n/).filter(l => l.trim().length > 0);
    const durationParse = (performance.now() - startParse).toFixed(3);
    console.log(`[CSV Parsing] ${lines.length - 1} stops parsed in: ${durationParse} ms`);
  }

  // 2. Measure In-Browser 2-Opt on 12-Stop Jyotirlingas Route
  const sample12 = [
    { name: 'Somnath', lat: 20.8880, lng: 70.4012 },
    { name: 'Nageshwar', lat: 22.4707, lng: 69.0773 },
    { name: 'Mahakaleshwar', lat: 23.1828, lng: 75.7682 },
    { name: 'Omkareshwar', lat: 22.2475, lng: 76.1517 },
    { name: 'Bhimashankar', lat: 19.0739, lng: 73.5351 },
    { name: 'Trimbakeshwar', lat: 19.9333, lng: 73.5333 },
    { name: 'Grishneshwar', lat: 20.0232, lng: 75.1764 },
    { name: 'Mallikarjuna', lat: 16.0743, lng: 78.8682 },
    { name: 'Ramanathaswamy', lat: 9.2881, lng: 79.3129 },
    { name: 'Kashi Vishwanath', lat: 25.3113, lng: 83.0104 },
    { name: 'Vaidyanath', lat: 24.4826, lng: 86.7013 },
    { name: 'Kedarnath', lat: 30.7352, lng: 79.0669 }
  ];

  const t1 = performance.now();
  solve2Opt(sample12);
  const dur12 = (performance.now() - t1).toFixed(2);
  console.log(`[2-Opt Solver] 12 stops solved in: ${dur12} ms`);

  // 3. Measure Scale Benchmarks (25, 50, 100 stops)
  for (const count of [25, 50, 100]) {
    const stops = generateRandomStops(count);
    const tStart = performance.now();
    solve2Opt(stops);
    const dur = (performance.now() - tStart).toFixed(2);
    console.log(`[2-Opt Solver] ${count} synthetic stops solved in: ${dur} ms`);
  }

  console.log('\n====================================================');
  console.log('Copy measured values into README.md results tables.');
  console.log('====================================================');
}

runBenchmarks();


# RouteForge — Free Services & API Configuration Guide

RouteForge is strictly engineered around **100% free-tier, open-source geospatial services**. It operates with **zero paid subscriptions, zero credit card requirements, and zero risk of unexpected billing charges**.

---

## 1. Free Geospatial Stack Overview

| Service Layer | Provider | Free Policy & Rate Limits | Cost |
| :--- | :--- | :--- | :--- |
| **Vector Map Engine** | MapLibre GL JS | Open-source WebGL vector map rendering | Free ($0) |
| **Vector Map Tiles** | OpenFreeMap (`positron`, `liberty`, `bright`) | Completely free vector tile service; no API key, no token, no account | Free ($0) |
| **Road Routing** | OSRM (Project-OSRM) | Free public routing endpoints for cars, bikes, and pedestrians | Free ($0) |
| **Geocoding** | Nominatim (OpenStreetMap) | Free community geocoder throttled to max 1 req/sec with local caching | Free ($0) |
| **TSP Optimization** | Google OR-Tools + 2-Opt | Local C++ / Python heuristic engine; runs on your machine with 0 network calls | Free ($0) |
| **Data Persistence** | SQLite (Local) / LocalStorage (Vercel) | Embedded database file `database/routeforge.db` | Free ($0) |

---

## 2. OpenFreeMap Vector Basemaps

RouteForge utilizes **OpenFreeMap** styles:
- **Default (Positron)**: `https://tiles.openfreemap.org/styles/positron`
- **Liberty**: `https://tiles.openfreemap.org/styles/liberty`
- **Bright**: `https://tiles.openfreemap.org/styles/bright`

### Key Advantages
- **No Watermarks**: Clean, crisp vector tiles with zero third-party branding overlays.
- **No Registration or API Keys**: Endpoints are queried directly over standard HTTPS.
- **WebGL Hardware Acceleration**: Fluid 60fps panning, zooming, and tilting powered by MapLibre GL JS.

---

## 3. Road Routing Configuration (OSRM)

RouteForge queries free public OSRM instances:
- **Driving**: `https://router.project-osrm.org/route/v1/driving/{coords}`
- **Cycling**: `https://routing.openstreetmap.de/routed-bike/route/v1/driving/{coords}`
- **Walking**: `https://routing.openstreetmap.de/routed-foot/route/v1/driving/{coords}`

### Chunking & Resilience Policy
- Public OSRM servers reject URLs when coordinate parameters exceed ~80-100 waypoints.
- RouteForge automatically partitions requests exceeding 70 waypoints into 35-stop chunked windows to avoid URI length limits.
- If an OSRM instance experiences network congestion or downtime, RouteForge immediately activates **labeled straight-line Haversine fallback**:
  - Distance is calculated using Great-Circle distance between consecutive waypoints.
  - Duration is estimated via standard transit velocities:
    - Driving: 50 km/h (13.88 m/s)
    - Cycling: 15 km/h (4.17 m/s)
    - Walking: 4.5 km/h (1.25 m/s)
  - UI displays an informative badge: `Straight-Line Fallback`.

---

## 4. Geocoding Rate Throttling (OSM Nominatim)

OpenStreetMap Nominatim enforces an acceptable usage policy:
- Maximum 1 request per second.
- Unique User-Agent header identifying the client.
- No heavy bulk scraping.

### Built-in Protection:
1. **Rate Limiting**: Nominatim requests are queued with a minimum 1,100ms interval between calls.
2. **Normalized Cache**: Previously geocoded addresses are cached in memory and in SQLite (`geocache` table), eliminating duplicate network queries.
3. **Bulk File Import Safeguard**: When importing large CSV files (100+ stops), pre-geocoded coordinates (`lat`, `lng`) are preferred. Unresolved addresses prompt a progress indicator.

---

## 5. Google OR-Tools & TSP Optimization

Multi-stop route sequencing solves the **Traveling Salesperson Problem (TSP)**, which is mathematically NP-hard:
- **Small to Medium Tours (3 - 100 stops)**: Google OR-Tools with Guided Local Search (GLS) metaheuristics.
- **Large Tours (100 - 500+ stops)**: Spatial coordinate partitioning with iterated 2-opt local search heuristics to ensure fast sub-second response times without server timeout.
- **Invariant Protection**: Waypoints marked with the locked pin (🔒) retain their strict index position in the tour.
- **Mathematical Transparency**: RouteForge explicitly displays that solutions are heuristic approximations, not global mathematical proofs.

---

## 6. Live Traffic Transparency

Because real-time traffic data requires commercial proprietary data sources, RouteForge displays the mandatory system disclaimer:

> **"Live traffic is unavailable. Route duration is based on estimated travel time."**

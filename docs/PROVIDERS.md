# RouteForge - External Provider Specifications & Usage Policies

RouteForge relies on open-source geographic services for address geocoding and road-based route generation. Both Target A (Apps Script) and Target B (Local Node.js) interact with these services using identical provider abstractions.

---

## 1. Geocoding: OpenStreetMap Nominatim

### Endpoint
- Default URL: `https://nominatim.openstreetmap.org/search`
- Format: JSON (`format=json&addressdetails=1&limit=5`)

### Usage Policy & Compliance
OpenStreetMap Nominatim is a free community-supported service governed by the [Nominatim Usage Policy](https://operations.osmfoundation.org/policies/nominatim/):

1. **Rate Limiting**: Strictly maximum 1 request per second.
   - **RouteForge Compliance**: `shared/geocode.js` and `apps-script/GeocodingService.gs` enforce an internal throttle queue with a 1,100 ms minimum inter-request delay.
2. **Identification**: Must provide a descriptive HTTP `User-Agent` identifying the application.
   - **RouteForge Compliance**: All requests send `User-Agent: RouteForge/1.0 (Collaborative Route Planner; contact@routeforge.local)`.
3. **Caching**: Results must be cached locally to prevent duplicate requests.
   - **RouteForge Compliance**: Both targets implement two-tier caching:
     - Tier 1: In-memory LRU cache keyed by normalized lowercase address.
     - Tier 2: Persistent target storage (Google Sheets / SQLite) storing resolved coordinates per stop.

### Custom / Self-Hosted Geocoder
To point RouteForge to a private or self-hosted Nominatim/Photon instance:
- **Target A**: Set `NOMINATIM_BASE` in `apps-script/GeocodingService.gs` or in ScriptProperties.
- **Target B**: Set `GEOCODE_BASE_URL=http://your-geocoder:8080/search` in `.env`.

---

## 2. Routing: Project OSRM (Open Source Routing Machine)

### Endpoint
- Default URL: `https://router.project-osrm.org/route/v1/driving/{coords}?overview=full&geometries=geojson&steps=false`
- Coordinate format: `{lng1},{lat1};{lng2},{lat2};...` (Note: longitude precedes latitude).

### Public Demo Policy
The public demo server at `router.project-osrm.org` is provided by the Open Source Routing Machine project for testing and light application prototyping. It does not carry an SLA and is subject to rate limiting and periodic downtime.

### Straight-Line Fallback Behavior
To prevent application paralysis when OSRM is unreachable or over-capacity:
- RouteForge provides an **explicitly labeled Straight-Line Fallback engine**.
- It calculates Great-Circle distances using the Haversine formula and estimates durations at 50 km/h.
- **Strict Integrity Rule**: Straight-line routes are **never** disguised as driving directions. The UI displays an amber warning badge stating `"Straight-line estimate only. Road geometry is unavailable"`, and the polyline renders as a dashed orange line rather than solid blue road paths.

### Custom / Self-Hosted OSRM
For production volume or offline navigation:
- Docker container: `docker run -t -i -p 5000:5000 -v "${PWD}:/data" ghcr.io/project-osrm/osrm-backend osrm-routed --algorithm mld /data/map.osrm`
- Point RouteForge to `http://localhost:5000/route/v1/driving`.


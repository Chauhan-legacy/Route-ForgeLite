# RouteForge - Verification & Test Report

This document details both the automated test checklist and the manual test procedures for validating RouteForge on **Target A (Google Apps Script)** and **Target B (Local Node.js + React)**.

---

## 1. Automated Test Suite

RouteForge includes runnable unit and integration tests located in `tests/`:

```bash
# Run all automated tests
npm test
```

### Automated Checklist & Results

| Test Suite | Module | Test Scope | Result |
|---|---|---|---|
| **Contract** | `shared/contract.js` | Success/Error envelope formatting, validation of all 11 API endpoints | `PASSED` |
| **CSV Parser** | `shared/csv.js` | RFC 4180 quotes, embedded commas, unicode characters (`München`, `Café`), BOM stripping | `PASSED` |
| **Formula Injection** | `shared/csv.js` | Leading `=`, `+`, `-`, `@`, `\t`, `\r` cell sanitization | `PASSED` |
| **Error Diagnostics**| `shared/csv.js` | Unclosed quotes, missing address detection with exact row number | `PASSED` |
| **Optimizer Core** | `shared/optimize.js` | Nearest-Neighbor construction + 2-opt search, distance reduction verification | `PASSED` |
| **Locked Stops** | `shared/optimize.js` | Strict position preservation of locked stops during 2-opt swaps | `PASSED` |
| **Straight-Line** | `shared/route.js` | Fallback calculation, Haversine distance, speed estimation, provider labeling | `PASSED` |
| **In-Memory Storage**| `local/server/storage/memory.js` | CRUD, sequence numbering, revision incrementation, history retention cap (50) | `PASSED` |
| **SQLite Storage** | `local/server/storage/sqlite.js` | Table initialization, transactional writes, revision conflict detection (`REVISION_CONFLICT`) | `PASSED` |
| **Full E2E Workflow** | `tests/e2e.test.js` | 12-step acceptance criteria (creation, stops, route, 2-opt optimize, sync, conflict, CSV escape) | `PASSED` |

---

## 2. Manual Test Procedure (Step-by-Step for Both Targets)

Execute this 11-step verification procedure to confirm complete acceptance criteria on either Target A or Target B.

### Step 1: Route Initialization & Share URL
1. Open the application:
   - Target A: Open the deployed Google Apps Script Web App URL.
   - Target B: Open `http://localhost:5173`.
2. Observe that a new route is automatically initialized on the server.
3. Check the address bar: a URL-safe route identifier is appended (e.g., `?routeId=rf_...`).
4. Click **Share Link**: confirm the share URL is copied to your clipboard.

### Step 2: CSV Import with Quotes & Unicode
1. Click **📥 Import Addresses / CSV**.
2. Paste the following complex sample into the modal:
   ```csv
   Name,Address
   "Café Central","Herrengasse 14, 1010 Wien"
   "Stephansdom","Stephansplatz 3, 1010 Wien"
   "Belvedere Schloss","Prinz Eugen-Straße 27, 1030 Wien"
   "Prater Riesenrad","Riesenradplatz 1, 1020 Wien"
   ```
3. Click **Import & Geocode**.
4. **Verification**: Confirm all 4 stops parse with correct names, addresses, and unicode accents preserved.
5. Paste an invalid row with an unclosed quote:
   ```csv
   "Broken Quote, Nowhere St
   ```
6. **Verification**: Confirm the parser displays an error banner: `Malformed CSV at row 1: Unclosed quoted field reached end of input`.

### Step 3: Geocoding & Manual Correction Path
1. Observe that Nominatim automatically resolves latitude and longitude for the imported stops.
2. In the sidebar "Add address" field, enter a deliberate nonsense address: `asdkjhasd9871239812739xyz`.
3. Click **Add**.
4. **Verification**: The stop appears with an amber/red pill: `Location not found (click to correct)`.
5. Click the pill or edit icon (✏️); enter a valid address (e.g., `Karlsplatz 1, 1040 Wien`) and click **Save**.
6. **Verification**: Coordinates update, the error pill clears, and marker appears on the map.

### Step 4: Map Marker & Stop List Synchronization
1. Observe the Leaflet map: markers display circular badges numbered `1`, `2`, `3`, `4`.
2. Click marker #2 on the map: popup opens displaying `Stop 2: Stephansdom` and its address.
3. In the sidebar, click the Move Down (`↓`) button on Stop 1.
4. **Verification**: Stop 1 swaps with Stop 2 in the list, and marker numbers on the map re-number synchronously.

### Step 5: Road-Based Route Calculation
1. Click **Calculate Road**.
2. **Verification**:
   - The route engine queries OSRM (`router.project-osrm.org`).
   - A solid blue route polyline renders on the map tracking street geometry.
   - Summary displays road distance (km), estimated driving duration (min/hrs), and `Engine: Road route (OSRM)`.

### Step 6: Route Optimization & Savings Report
1. Notice the stops are currently in suboptimal order.
2. Click **⚡ Optimize**.
3. **Verification**:
   - The nearest-neighbor and 2-opt heuristic recalculates the optimal sequence.
   - A banner notification announces exact distance reduction: e.g., `Route optimized! Distance reduced from 14.8 km to 9.2 km (37.8% savings)`.
   - Stops re-sequence and the road route line redraws.
4. Toggle lock on Stop 2 (🔒); re-run optimize:
   - **Verification**: Stop 2 remains locked in place while unlocked stops optimize around it.

### Step 7 & 8: Cross-Device Collaborative Sync
1. On Device 1 (or Chrome Profile A), copy the share URL.
2. Open the URL on Device 2 (or Chrome Profile B / Incognito window).
3. **Verification**: Device 2 loads the identical route title, stops, sequence, and map.
4. On Device 1, add a new stop: `Hofburg, 1010 Wien`.
5. Without touching Device 2, wait 3.5 seconds (one poll cycle).
6. **Verification**: Device 2 automatically syncs, adds the new stop, increments revision number, and updates the map.

### Step 9: Revision Conflict Handling
1. On Device 1, change the route title to `Vienna Morning Route` (do not blur yet).
2. On Device 2, delete Stop 3 (triggering an immediate revision increment from revision `N` to `N+1`).
3. Now blur / save on Device 1 (sending stale expected revision `N`).
4. **Verification**:
   - Server rejects Device 1 write with code `REVISION_CONFLICT`.
   - Device 1 displays: `Revision conflict: Another user updated this route. Syncing changes...`.
   - Device 1 refreshes to the latest server state without losing server integrity.

### Step 10: Persistence Across Refreshes
1. Refresh Device 1 and Device 2.
2. For Target B, stop the server and restart with `STORAGE=sqlite`.
3. Refresh the page.
4. **Verification**: All stops, locks, metadata, and coordinates persist intact from database storage.

### Step 11: CSV Export & Formula-Injection Mitigation
1. Add a stop named `=SUM(A1:A10)` and address `@danger`.
2. Click **Export CSV**.
3. Open the downloaded `.csv` file in a text editor.
4. **Verification**:
   ```csv
   Sequence,Name,Address,Latitude,Longitude,Locked,Status
   ...,"'=SUM(A1:A10)","'@danger",...
   ```
   Dangerous formula characters (`=`, `@`, `+`, `-`) are prepended with `'` preventing arbitrary formula execution in Microsoft Excel or Google Sheets.


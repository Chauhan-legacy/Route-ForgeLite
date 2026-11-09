# RouteForge - Known Limitations & Architectural Trade-offs

This document provides a candid, comprehensive accounting of current constraints, deferred features, and architectural trade-offs in RouteForge v1.0.

---

## 1. Scope Adjustments & Cut Features

In accordance with the 15-minute time-boxed delivery constraint prioritizing core dual-target execution:

| Feature | Status | Reason for Deferral |
|---|---|---|
| **XLSX File Import** | Deferred | Parsing binary Excel files requires heavy external libraries (like `xlsx` or `exceljs`). CSV parsing with RFC 4180 quotes, unicode, and BOM support was prioritized because it runs with zero dependencies on both backends. |
| **OCR Image Import** | Deferred | Optical character recognition requires Tesseract.js (multi-megabyte WASM) or a cloud Vision API key, introducing external dependencies incompatible with zero-infrastructure Apps Script. |
| **PDF Route Sheet Export** | Deferred | Safe, formula-injection-protected CSV export was prioritized. Printable HTML/PDF rendering requires client-side `jspdf` or server-side headless Chrome. |
| **Read-Only Share Links** | Deferred | All shared links currently grant edit permissions to anyone holding the URL (`executeAs: Me`, `access: Anyone`). |
| **Role-Based Access Control** | Deferred | Enterprise auth (OAuth/SAML) was excluded in favor of shared-link collaboration. Target B provides an optional `AUTH_MODE=shared-secret`. |

---

## 2. UI Parity Differences: Target A (Apps Script) vs. Target B (React)

| Aspect | Target A (Apps Script Web App) | Target B (Node.js + React) |
|---|---|---|
| **Rendering Framework** | Vanilla JS DOM manipulation (inside `JavaScript.html`) | React 18 declarative component hierarchy with hooks |
| **Asset Delivery** | Bundled inline in `HtmlService` using `include()` partials | Vite bundled ES modules and CSS chunking |
| **Map Rendering** | Leaflet loaded via CDN script tag | Plain Leaflet initialized via React `useRef` lifecycle |
| **Drag & Drop Reordering** | Incremental Up/Down reordering buttons (`↑`, `↓`) | Incremental Up/Down buttons + inline edit state |
| **Visual Styling** | Same CSS design system (Navy/Slate palette, rounded cards) | Identical CSS styling and touch target sizing (>= 44px) |

---

## 3. Provider Limits & Public Infrastructure Dependencies

1. **Nominatim Geocoding Throttling**:
   - The public OpenStreetMap Nominatim endpoint restricts clients to **1 request per second**.
   - Importing a CSV with 30 stops will take approximately 33 seconds to geocode completely.
   - For high-volume production use, deploy a self-hosted Nominatim or Pelias instance.
2. **OSRM Public Routing Reliability**:
   - The public demo router (`router.project-osrm.org`) has no SLA and may return HTTP 429 or 502 during traffic spikes.
   - RouteForge detects these failures and falls back to an explicitly labeled straight-line distance estimate, never masquerading straight lines as road navigation.

---

## 4. Google Apps Script Platform Quotas (Target A)

When deployed to Google Apps Script:
- **Maximum Execution Duration**: 6 minutes per script execution. Large batch geocodes exceeding ~300 addresses in a single run will time out.
- **Concurrent Executions**: Google Workspace accounts allow up to 30 simultaneous web app executions; personal Gmail accounts allow 30.
- **UrlFetchApp Quota**: 20,000 calls per day for standard accounts; 100,000/day for Workspace accounts.
- **LockService Contention**: High concurrent write volume may occasionally hit the 10-second LockService timeout.

---

## 5. Local Security & Networking (Target B)

- **Unencrypted Transport (No TLS)**: The local Node.js Express server runs plain HTTP (`http://localhost:3001`). When exposed to a local area network via `--host 0.0.0.0`, traffic is unencrypted.
- **Shared Secret Auth**: When enabled, the secret is checked on all `/api/*` routes. However, there are no granular user permissions or session expirations.

---

## 6. Polling Latency vs. WebSockets

- Both targets utilize **3.5-second polling** against the lightweight `getRouteRevision` endpoint instead of persistent WebSockets or Server-Sent Events (SSE).
- **Reasoning**: Google Apps Script HTML Service does not support persistent WebSockets or SSE connections. Polling guarantees 100% architectural and operational equivalence between both deployment targets.

---

## 7. Code Duplication & Shared Logic

- Code in `shared/` (`contract.js`, `csv.js`, `optimize.js`, `geocode.js`, `route.js`) is written as universal UMD modules.
- In Target B, these files are imported directly by Node.js and bundled by Vite.
- In Target A, Apps Script runs V8 JavaScript in a shared global scope where `shared/*.js` files are represented as native `.gs` service wrappers (`OptimizationService.gs`, `GeocodingService.gs`, `StorageService.gs`).


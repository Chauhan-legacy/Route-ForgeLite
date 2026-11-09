# RouteForge - Local & Self-Hosted Deployment Guide (Target B)

This guide walks you through setting up and running **RouteForge Target B** (Node.js 20+ Express backend + React 18 / Vite frontend with Leaflet).

---

## 1. Prerequisites

- **Node.js**: v20.0.0 or later (v24.20.0 tested and supported).
- **npm**: v10.0.0 or later.
- Modern web browser (Chrome, Edge, Firefox, Safari).

---

## 2. Installation

From the project root:

```bash
# 1. Install root & server dependencies
cd local
npm install

# 2. Install client dependencies
cd client
npm install
cd ..
```

---

## 3. Configuration

Copy the example environment configuration:

```bash
cp .env.example .env
```

Key environment settings in `.env`:

| Variable | Default | Options | Purpose |
|---|---|---|---|
| `PORT` | `3001` | Integer | Backend Express HTTP port |
| `HOST` | `0.0.0.0` | IP string | Host interface to bind server |
| `STORAGE` | `memory` | `memory` \| `sqlite` | Storage backend adapter |
| `SQLITE_PATH` | `./routeforge.sqlite` | File path | Path to SQLite database file |
| `AUTH_MODE` | `none` | `none` \| `shared-secret` | Authentication requirement |
| `SHARED_SECRET`| `""` | String | Secret key when `AUTH_MODE=shared-secret` |

---

## 4. Development Mode (Hot-Reloading)

Run the backend Express server and Vite frontend dev server concurrently:

```bash
npm run dev
```

- **Frontend Client**: `http://localhost:5173` (Vite dev server)
- **Backend API**: `http://localhost:3001/api`
- Vite automatically proxies `/api/*` requests to the Express server on port 3001.

---

## 5. Verifying Data Persistence with SQLite

By default, RouteForge runs with `STORAGE=memory` for zero-setup ephemeral dev/testing. To persist routes and stops across server restarts:

1. Stop the server (`Ctrl+C`).
2. Set `STORAGE=sqlite` in `.env` (or via command line):
   ```bash
   STORAGE=sqlite npm run server
   ```
3. Open `http://localhost:5173`, create a route, add stops, and save.
4. Stop and restart the server.
5. Refresh the browser: all routes, stops, coordinates, and sequence revisions are preserved from `./routeforge.sqlite`.

---

## 6. Cross-Device LAN Testing (Smartphone & Laptop)

To test collaborative real-time sync between your computer and a smartphone on the same local Wi-Fi network:

1. Find your computer's local LAN IP address:
   - **Windows**: `ipconfig` (look for IPv4 Address under your active Wi-Fi/Ethernet adapter, e.g., `192.168.1.45`).
   - **macOS / Linux**: `ifconfig` or `ip addr`.
2. Start the development server binding to `0.0.0.0`:
   ```bash
   npm run dev
   ```
   *(Vite is already preconfigured in `vite.config.js` with `server: { host: true }`).*
3. Open `http://<your-lan-ip>:5173` on your smartphone browser.
4. Open `http://localhost:5173` on your desktop.
5. Create a route on desktop; copy the share URL with `?routeId=...` and open it on the phone.
6. Add or reorder a stop on either device and observe the update sync across within one poll interval (3.5s).

> [!CAUTION]
> **LAN Exposure Caveats & Security Notice**:
> - Exposing port 5173 and 3001 to your LAN allows anyone on your local network to access and edit routes.
> - If your Windows Defender Firewall or router client isolation blocks incoming connections, allow Node.js through the private network firewall rule.
> - This setup lacks TLS/HTTPS encryption and authentication by default. **Never expose this port directly to the public internet** without a reverse proxy (e.g. Caddy, Nginx, Cloudflare Tunnel) with TLS termination.

---

## 7. Production Build & Execution

To bundle the client into production static assets and run a unified standalone server:

```bash
# 1. Build React client bundle
npm run build

# 2. Start unified production server
npm run start
```

The Express server will automatically serve:
- API routes on `/api/*`
- Optimized static assets from `local/client/dist`
- Client SPA fallback on `http://localhost:3001`


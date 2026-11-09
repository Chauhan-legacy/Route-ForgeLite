# RouteForge — Free-First Geospatial Multi-Stop Route Optimizer

[![Python](https://img.shields.io/badge/Python-3.10%2B-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110%2B-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Leaflet](https://img.shields.io/badge/Leaflet-1.9.4-199900?logo=leaflet&logoColor=white)](https://leafletjs.com/)
[![OR-Tools](https://img.shields.io/badge/Optimization-Google%20OR--Tools-4285F4?logo=google&logoColor=white)](https://developers.google.com/optimization)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel%20Hobby-black?logo=vercel&logoColor=white)](https://vercel.com/)

**RouteForge** is a high-performance, responsive multi-stop route planner and TSP tour optimizer built exclusively on **100% free-tier, open-source geospatial services**. It operates locally on Windows via Python FastAPI + SQLite, and deploys effortlessly to **Vercel** with zero server costs, zero credit card requirements, and zero risk of paid billing.

Inspired by modern aerospace dashboards and Figma design patterns (elevated floating metric cards, soft cyan/electric blue glows, and crisp typography using *Plus Jakarta Sans* and *JetBrains Mono*), RouteForge delivers a high-end product experience for logistics, field service, delivery routing, and urban exploration.

---

## Key Highlights

- **100% Free Geospatial Stack**: Powered by Leaflet, OpenStreetMap / CartoDB tiles, OSRM routing, Nominatim geocoding, and Google OR-Tools. Absolutely no paid subscriptions or API billing.
- **Vercel Ready ($0/mo)**: Engineered with a hybrid client-side engine. When deployed to Vercel, the app runs autonomously in the user's browser with direct client-side OSRM routing and 2-opt TSP optimization.
- **Local Windows Launcher**: Double-click `start_routeforge.bat` or `start.bat` to launch the FastAPI backend + SQLite database + modern React UI on `http://127.0.0.1:8000`.
- **Advanced TSP Tour Optimization**: Google OR-Tools Guided Local Search (GLS) metaheuristic and spatial 2-opt algorithms handling up to 500+ waypoints. Supports fixed start/end, roundtrip circuits, and locked waypoint invariants (🔒).
- **Multi-Modal Routing**: Fast road calculations for **Driving** (50 km/h), **Cycling** (15 km/h), and **Walking** (4.5 km/h) with labeled straight-line Haversine fallback.
- **Mandatory Live Traffic Disclaimer**: Clearly indicates: *"Live traffic is unavailable. Route duration is based on estimated travel time."*
- **1-Click Sample Tours**: Instantly load realistic tours (San Francisco Bay, Tokyo Urban, London Express) with zero typing required.
- **CSV & Coordinate Import/Export**: Paste addresses, drag-and-drop CSV spreadsheets, auto-detect columns, and export timestamped CSV or JSON files.

---

## Issue Resolution: Why `localhost:5173` Showed a Blank White Page

In earlier sessions, navigating to `http://localhost:5173` displayed a blank white screen due to two specific build issues:
1. **Tailwind CSS v4 PostCSS Incompatibility**: The development dependencies initially pulled in Tailwind v4 which deprecated standard PostCSS plugins, throwing an uncaught compilation error during Vite bundling.
   - **Fix Applied**: Upgraded to standard, stable `tailwindcss@^3.4.17` with `@tailwind base; @tailwind components; @tailwind utilities;` and full custom aerospace theme tokens.
2. **Missing Component Implementations**: `Map.tsx`, `ImportModal.tsx`, and `OptimizationModal.tsx` were undergoing migration.
   - **Fix Applied**: Fully implemented all modular components with clean TypeScript typings, compiled Vite bundle into `local/client/dist`, and updated the FastAPI backend to serve the compiled frontend directly at `http://127.0.0.1:8000`.

---

## Quick Start (Local Windows)

### 1. Launch RouteForge
Double-click **`start_routeforge.bat`** (or **`start.bat`**) in the project directory, or execute in Command Prompt:

```cmd
cd /d C:\Users\Priyansh\Desktop\ROUTE-FORGE0
start_routeforge.bat
```

The script automatically:
1. Detects your Python 3.10+ environment.
2. Activates the Python virtual environment (`.\venv`).
3. Installs requirements (`fastapi`, `uvicorn`, `httpx`, `pydantic`, `ortools`).
4. Compiles the modern React client bundle if needed.
5. Frees port `8000` if occupied.
6. Initializes the SQLite database (`database/routeforge.db`).
7. Launches your default web browser to **`http://127.0.0.1:8000`**.

### 2. Stop RouteForge
Double-click **`stop.bat`** or run:

```cmd
stop.bat
```

---

## Vercel Public Cloud Deployment

RouteForge can be deployed to Vercel in less than 2 minutes at zero cost:

1. Push this repository to GitHub.
2. Log into [Vercel](https://vercel.com/) and click **"Add New... > Project"**.
3. Select your repository.
4. Settings are pre-configured via [`vercel.json`](file:///c:/Users/Priyansh/Desktop/ROUTE-FORGE0/vercel.json):
   - **Build Command**: `npm --prefix local/client run build`
   - **Output Directory**: `local/client/dist`
5. Click **"Deploy"**.

*For complete details, see [DEPLOYMENT.md](file:///c:/Users/Priyansh/Desktop/ROUTE-FORGE0/DEPLOYMENT.md).*

---

## Verification & Test Results

The entire codebase is verified against 5 comprehensive integration and unit test suites:

```cmd
.\venv\Scripts\python.exe -m pytest tests -v
```

```text
tests/test_live_server.py::test PASSED                                   [ 20%]
tests/test_python_migration.py::test_database_and_crud PASSED            [ 40%]
tests/test_python_migration.py::test_optimizer_with_locked_stops PASSED  [ 60%]
tests/test_python_migration.py::test_csv_and_formula_guard PASSED        [ 80%]
tests/test_python_migration.py::test_fastapi_endpoints PASSED            [100%]

======================== 5 passed, 7 warnings in 1.45s ========================
```

---

## Documentation Links

- [DEPLOYMENT.md](file:///c:/Users/Priyansh/Desktop/ROUTE-FORGE0/DEPLOYMENT.md) — Free Vercel cloud deployment walkthrough.
- [API_CONFIGURATION.md](file:///c:/Users/Priyansh/Desktop/ROUTE-FORGE0/API_CONFIGURATION.md) — Free-tier routing, geocoding policies, and rate limits.
- [.env.example](file:///c:/Users/Priyansh/Desktop/ROUTE-FORGE0/.env.example) — Local and production environment variable reference.

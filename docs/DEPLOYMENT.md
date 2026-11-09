# RouteForge — Free Deployment Guide: Vercel & Cloud Services

RouteForge is engineered with a **zero-cost, free-tier architecture**. It operates without paid API subscriptions, credit card mandates, or billing risk.

---

## 1. Map Architecture: MapLibre GL JS + OpenFreeMap

- **Vector Map Engine**: [MapLibre GL JS](https://maplibre.org/)
- **Default Vector Tile Style**: `https://tiles.openfreemap.org/styles/positron`
- **Alternative Free Vector Styles**:
  - Liberty: `https://tiles.openfreemap.org/styles/liberty`
  - Bright: `https://tiles.openfreemap.org/styles/bright`
- **Zero API Keys**: Tiles load directly over HTTPS without tokens, accounts, credit cards, or watermarks.

---

## 2. Frontend Deployment on Vercel (Hobby Free Plan)

### Step 1: Push Repository to GitHub
```cmd
git init
git add .
git commit -m "feat: MapLibre OpenFreeMap integration and Vercel readiness"
git branch -M main
git remote add origin https://github.com/<your-username>/routeforge.git
git push -u origin main
```

### Step 2: Import into Vercel
1. Go to [Vercel](https://vercel.com/) and sign in with your GitHub account.
2. Click **"Add New..."** > **"Project"**.
3. Select your `routeforge` repository.
4. Project settings are automatically detected via [`vercel.json`](file:///c:/Users/Priyansh/Desktop/ROUTE-FORGE0/vercel.json):
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm --prefix local/client run build`
   - **Output Directory**: `local/client/dist`
   - **Install Command**: `npm --prefix local/client install`
5. Click **"Deploy"**.

Within ~45 seconds, your site will be live at `https://routeforge-xxxx.vercel.app`.

### SPA Routing & Deep Links on Vercel
The included `vercel.json` defines single-page application (SPA) rewrites:
```json
{
  "version": 2,
  "buildCommand": "npm --prefix local/client run build",
  "outputDirectory": "local/client/dist",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```
Page refreshes, browser history, and deep route URLs (`/route/:id`) resolve properly without 404 errors.

---

## 3. Backend Architecture & Hosting Options

### Option A: 100% Autonomous Client-Side Engine (Default on Vercel)
- The frontend includes a standalone geospatial engine ([`clientRouting.ts`](file:///c:/Users/Priyansh/Desktop/ROUTE-FORGE0/local/client/src/services/clientRouting.ts)).
- If `VITE_API_URL` is empty, the app runs autonomously in the user's browser:
  - Routing: Direct public OSRM endpoints (`router.project-osrm.org`)
  - Tour Optimization: Client-side 2-opt TSP optimizer
  - Geocoding: Throttled OpenStreetMap Nominatim
  - Persistence: Browser `localStorage`
- **Cost**: **$0.00 / month forever**. No remote backend server is required for public access.

### Option B: Free Python Backend on Render (Optional)
If you wish to run the full Python FastAPI backend with Google OR-Tools in the cloud:
1. Sign up for free at [Render](https://render.com/).
2. Click **"New"** > **"Blueprint"** and connect your GitHub repository.
3. Render automatically reads the repository's [`render.yaml`](file:///c:/Users/Priyansh/Desktop/ROUTE-FORGE0/render.yaml) file:
   - **Plan**: `Free` ($0/mo)
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `python -m uvicorn backend.main:app --host 0.0.0.0 --port $PORT`
4. Copy your backend service URL (e.g., `https://routeforge-api.onrender.com`).
5. In your Vercel project settings under **Settings > Environment Variables**, add:
   - `VITE_API_URL` = `https://routeforge-api.onrender.com`
6. Redeploy the frontend on Vercel.

---

## 4. Local Windows Execution

To run locally on Windows:

```cmd
cd /d C:\Users\Priyansh\Desktop\ROUTE-FORGE0
start_routeforge.bat
```
*(or run `start.bat`)*

- The launcher activates the virtual environment, verifies dependencies, compiles the Vite frontend, checks the SQLite database, and opens **`http://127.0.0.1:8000`**.
- To stop the server:
  ```cmd
  stop.bat
  ```

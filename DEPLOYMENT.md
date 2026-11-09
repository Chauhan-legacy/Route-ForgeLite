# RouteForge — Vercel & Free Cloud Deployment Guide

This guide details how to deploy RouteForge to **Vercel** on the **Hobby Free Tier ($0/month)** with zero billing requirements, zero credit card prompts, and full public availability on desktop and mobile.

---

## 1. Zero-Cost Architecture on Vercel

RouteForge is engineered with a **hybrid resilient architecture**:
- **Client-Side Autonomous Mode (Default for Vercel)**:
  - When hosted on Vercel, the app operates completely autonomously in the user's browser.
  - Route calculation runs via public free OSRM road endpoints.
  - Traveling Salesperson (TSP) route optimization runs via client-side 2-opt algorithms.
  - Address search uses throttled OpenStreetMap Nominatim.
  - Route state is saved in the browser's persistent storage (`localStorage`).
  - **Result: 100% free hosting with zero backend server costs and zero billing activation!**
- **Connected Mode (Optional)**:
  - If you configure `VITE_API_URL`, the frontend connects to your Python FastAPI backend powered by Google OR-Tools and SQLite.

---

## 2. Deploying to Vercel via GitHub (Recommended)

### Step 1: Push Project to GitHub
1. Create a new repository on [GitHub](https://github.com/) (e.g., `routeforge`).
2. In your terminal, initialize and push:
```bash
git init
git add .
git commit -m "feat: complete RouteForge free multi-stop optimizer"
git branch -M main
git remote add origin https://github.com/<your-username>/routeforge.git
git push -u origin main
```

### Step 2: Import into Vercel
1. Log in to [Vercel](https://vercel.com/) (Free Hobby plan).
2. Click **"Add New..."** -> **"Project"**.
3. Select your GitHub repository (`routeforge`).
4. Configure the project settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `./` (leave default)
   - **Build Command**: `npm --prefix local/client run build`
   - **Output Directory**: `local/client/dist`
   - **Install Command**: `npm --prefix local/client install`
5. Click **"Deploy"**.

Within ~45 seconds, your public website will be live at `https://routeforge-xxxx.vercel.app`!

---

## 3. Deploying via Vercel CLI (Alternative)

If you prefer deploying directly from your Windows command line:

```bash
# 1. Install Vercel CLI globally (one-time)
npm install -g vercel

# 2. Build the client bundle locally
npm --prefix local/client run build

# 3. Deploy to Vercel
vercel --prod
```

When prompted:
- Set up and deploy? **Yes**
- Which scope? Select your personal free account
- Link to existing project? **No**
- What's your project's name? `routeforge`
- In which directory is your code located? `./`

---

## 4. Mobile & Desktop Responsive Access

Once deployed to Vercel:
- **Desktop**: Full dual-pane split workspace featuring the live sequence management deck on the left and the interactive high-contrast CartoDB Leaflet map on the right.
- **Mobile Phones (iOS & Android)**: Adaptive responsive layout with a floating bottom switcher pill to seamlessly toggle between the Waypoints Deck and Fullscreen Map View.
- **Offline / Standalone Preview**: The app continues to calculate routes and optimize stops even without an active internet connection using straight-line fallback.


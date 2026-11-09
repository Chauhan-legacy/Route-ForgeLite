# RouteForge - Google Apps Script Deployment Guide (Target A)

This guide walks you through deploying **RouteForge Target A** to Google Apps Script and Google Sheets with zero server infrastructure.

---

## 1. Prerequisites

- A standard **Google Account** (or Google Workspace account).
- Node.js installed locally.
- Google Clasp CLI installed:
  ```bash
  npm install -g @google/clasp
  ```
- Authenticate clasp with your Google Account:
  ```bash
  clasp login
  ```
  *(Make sure Google Apps Script API is enabled in your Google Account Settings under [script.google.com/home/usersettings](https://script.google.com/home/usersettings)).*

---

## 2. Setting Up the Google Sheet Database

1. Open [Google Sheets](https://sheets.new) and create a new blank spreadsheet.
2. Title it `RouteForge-Database`.
3. Copy the **Spreadsheet ID** from the browser URL:
   ```
   https://docs.google.com/spreadsheets/d/<SPREADSHEET_ID>/edit
   ```
4. Keep this ID handy for configuration.

---

## 3. Cloning or Creating the Apps Script Project

From the project root:

```bash
cd apps-script
```

### Option A: Create a new Apps Script Web App via Clasp
```bash
clasp create --type webapp --title "RouteForge"
```

### Option B: Bind to an existing script
If you created a container-bound script from **Extensions > Apps Script** in your sheet:
```bash
clasp clone <YOUR_SCRIPT_ID>
```

---

## 4. Push Files to Google Apps Script

Push all local script files (`.gs` and `.html`) to Apps Script:

```bash
clasp push
```

Verify that the following files are pushed:
- `appsscript.json` (Manifest)
- `Code.gs` (Entry point & API routing)
- `Configuration.gs` (Schema initialization)
- `StorageService.gs` (Google Sheets CRUD adapter & LockService)
- `RouteService.gs` (Business logic)
- `SyncService.gs` (Revision verification)
- `OptimizationService.gs` (Nearest Neighbor & 2-opt)
- `GeocodingService.gs` (Nominatim client & CacheService)
- `Index.html` (Main web UI shell)
- `Styles.html` (CSS styling)
- `JavaScript.html` (Client controller)

---

## 5. Configure Spreadsheet ID and Initialize Schema

1. Open the project in the Apps Script online editor:
   ```bash
   clasp open
   ```
2. In the Apps Script editor:
   - Navigate to **Project Settings** (gear icon on the left).
   - Under **Script Properties**, click **Add script property**:
     - **Property**: `SHEET_ID`
     - **Value**: `<YOUR_SPREADSHEET_ID>` (from Step 2).
   - Click **Save script properties**.
3. In the code editor, select `Configuration.gs`.
4. In the function dropdown at the top, select `initializeApp`.
5. Click **Run**.
6. When prompted, click **Review permissions** and authorize the scopes:
   - View and manage your spreadsheets (`https://www.googleapis.com/auth/spreadsheets`)
   - Connect to an external service (`https://www.googleapis.com/auth/script.external_request`)
7. Check the Execution log: `RouteForge schema initialized successfully. Sheet ID: ...`.
8. Return to your Google Sheet: you will see three tabs created: `Routes`, `Stops`, and `RouteHistory`.

---

## 6. Deploy as a Web App

1. In the Apps Script Editor, click the blue **Deploy** button > **New deployment**.
2. Click the gear icon next to "Select type" and select **Web app**.
3. Configure deployment settings:
   - **Description**: `RouteForge v1.0`
   - **Execute as**: `Me (<your-email@gmail.com>)`
   - **Who has access**: `Anyone with the link` (or `Anyone` depending on your domain)
4. Click **Deploy**.
5. Copy the generated **Web app URL** (e.g., `https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec`).

> [!IMPORTANT]
> **Security Implication of "Anyone with the link"**:
> Anyone who possesses a route URL (or the base web app URL) can view and edit routes stored in the spreadsheet. Google Apps Script does not enforce user-level RBAC by default in this mode. Do not store sensitive or private personal data without adding explicit authentication.

---

## 7. Cross-Device Verification Workflow

1. Open the Web App URL on your desktop browser.
2. RouteForge will create a new route and append `?routeId=rf_...` to the URL.
3. Add a stop or import sample CSV addresses.
4. Copy the full URL with the `?routeId=...` parameter.
5. Open the same URL on a smartphone or second browser profile.
6. Observe that:
   - The route title, stops, and markers render identically.
   - Adding or modifying a stop on Device 1 updates Device 2 automatically within one poll interval (3.5 seconds).
   - Both devices persist data directly into the Google Sheet.

---

## 8. Troubleshooting

- **Authorization prompt loops**: Make sure you have authorized `initializeApp()` once while logged into the Google account that owns the script.
- **Quota limits**: Google Apps Script free accounts are subject to:
  - `UrlFetchApp` calls: 20,000/day.
  - Script runtime: 6 minutes/execution.
  - Concurrent executions: 30 simultaneous users.
- **doGet returning HTML vs JSON**: The endpoint serves HTML by default. When an `?action=<name>` query parameter is included, it returns standard JSON.
- **CORS**: Not applicable because the web app frontend is served directly by Google Apps Script via `HtmlService`.


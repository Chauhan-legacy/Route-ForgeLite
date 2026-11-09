/**
 * RouteForge - Apps Script Configuration & Schema Initialization
 */

const CONFIG = {
  DEFAULT_SHEET_ID: '1zzGu4PLQjgYvVpnrMgUY78DCzMbnCsiOYbYBzYBitXs',
  DEFAULT_SHEET_NAME: 'RouteForge-Database',
  TABLES: {
    ROUTES: 'Routes',
    STOPS: 'Stops',
    HISTORY: 'RouteHistory'
  },
  HEADERS: {
    ROUTES: ['routeId', 'title', 'createdAt', 'updatedAt', 'revision', 'settings', 'ownerIdentifier', 'status'],
    STOPS: ['routeId', 'stopId', 'name', 'address', 'latitude', 'longitude', 'sequence', 'metadata'],
    HISTORY: ['routeId', 'revision', 'timestamp', 'changeType', 'changedBy', 'summary']
  }
};

/**
 * Retrieves the bound or configured Google Spreadsheet instance.
 * @returns {GoogleAppsScript.Spreadsheet.Spreadsheet}
 */
function getSpreadsheet() {
  const props = PropertiesService.getScriptProperties();
  const configuredId = props.getProperty('SHEET_ID') || CONFIG.DEFAULT_SHEET_ID;

  if (configuredId) {
    try {
      return SpreadsheetApp.openById(configuredId);
    } catch (e) {
      Logger.log('Configured SHEET_ID failed to open, falling back: ' + e.message);
    }
  }

  try {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
  } catch (e) {
    // Standalone script
  }

  // Create database spreadsheet if not configured
  const newSheet = SpreadsheetApp.create(CONFIG.DEFAULT_SHEET_NAME);
  props.setProperty('SHEET_ID', newSheet.getId());
  Logger.log('Created new RouteForge spreadsheet ID: ' + newSheet.getId());
  return newSheet;
}

/**
 * Initializes Google Sheets database schema with tables and headers.
 * Run once upon deployment.
 */
function initializeApp() {
  const ss = getSpreadsheet();
  const tables = [
    { name: CONFIG.TABLES.ROUTES, headers: CONFIG.HEADERS.ROUTES },
    { name: CONFIG.TABLES.STOPS, headers: CONFIG.HEADERS.STOPS },
    { name: CONFIG.TABLES.HISTORY, headers: CONFIG.HEADERS.HISTORY }
  ];

  tables.forEach(t => {
    let sheet = ss.getSheetByName(t.name);
    if (!sheet) {
      sheet = ss.insertSheet(t.name);
    }
    // Set headers if empty
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, t.headers.length).setValues([t.headers]);
      sheet.getRange(1, 1, 1, t.headers.length).setFontWeight('bold');
      sheet.setFrozenRows(1);
    }
  });

  // Remove default "Sheet1" if extra
  const defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 3) {
    try { ss.deleteSheet(defaultSheet); } catch (e) {}
  }

  Logger.log('RouteForge schema initialized successfully. Sheet ID: ' + ss.getId());
  return {
    ok: true,
    sheetId: ss.getId(),
    url: ss.getUrl()
  };
}


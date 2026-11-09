/**
 * RouteForge - Shared CSV Parser and Exporter
 * Zero-dependency RFC 4180-compliant parser with formula-injection guard,
 * Unicode/BOM support, and error diagnostics with exact row numbers.
 */
(function (root, factory) {
  if (typeof exports === 'object' && typeof module !== 'undefined') {
    const f = factory();
    module.exports = f;
    module.exports.default = f;
    module.exports.parseStopCSV = f.parseStopCSV;
    module.exports.parseCSVMatrix = f.parseCSVMatrix;
    module.exports.parsePastedAddresses = f.parsePastedAddresses;
    module.exports.sanitizeCellForExport = f.sanitizeCellForExport;
    module.exports.exportStopsToCSV = f.exportStopsToCSV;
    module.exports.stripBOM = f.stripBOM;
  } else if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else {
    root.RouteForgeCSV = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /**
   * Strips UTF-8 Byte Order Mark (BOM) if present
   * @param {string} text
   * @returns {string}
   */
  function stripBOM(text) {
    if (typeof text !== 'string') return '';
    if (text.charCodeAt(0) === 0xFEFF) {
      return text.slice(1);
    }
    return text;
  }

  /**
   * Tokenizes raw CSV text into a 2D array of strings.
   * Tracks line numbers for detailed error reporting.
   * @param {string} text
   * @returns {{ rows: string[][], error: { row: number, reason: string } | null }}
   */
  function parseCSVMatrix(text) {
    const cleanText = stripBOM(text);
    if (!cleanText.trim()) {
      return { rows: [], error: null };
    }

    const rows = [];
    let currentRow = [];
    let currentField = '';
    let insideQuotes = false;
    let currentRowIndex = 1;
    let fieldStartIndex = 1;

    for (let i = 0; i < cleanText.length; i++) {
      const char = cleanText[i];
      const nextChar = cleanText[i + 1];

      if (insideQuotes) {
        if (char === '"') {
          if (nextChar === '"') {
            // Escaped quote: "" -> "
            currentField += '"';
            i++; // skip next quote
          } else {
            // End of quoted field
            insideQuotes = false;
          }
        } else {
          if (char === '\n') {
            currentRowIndex++;
          }
          currentField += char;
        }
      } else {
        if (char === '"') {
          if (currentField.trim().length > 0) {
            return {
              rows: [],
              error: {
                row: currentRowIndex,
                reason: `Unexpected quote inside field starting at line ${currentRowIndex}`
              }
            };
          }
          insideQuotes = true;
        } else if (char === ',') {
          currentRow.push(currentField.trim());
          currentField = '';
        } else if (char === '\r') {
          // Check for CRLF
          if (nextChar === '\n') {
            i++;
          }
          currentRow.push(currentField.trim());
          if (currentRow.some(col => col.length > 0)) {
            rows.push(currentRow);
          }
          currentRow = [];
          currentField = '';
          currentRowIndex++;
        } else if (char === '\n') {
          currentRow.push(currentField.trim());
          if (currentRow.some(col => col.length > 0)) {
            rows.push(currentRow);
          }
          currentRow = [];
          currentField = '';
          currentRowIndex++;
        } else {
          currentField += char;
        }
      }
    }

    if (insideQuotes) {
      return {
        rows: [],
        error: {
          row: currentRowIndex,
          reason: `Unclosed quoted field reached end of input (started around line ${fieldStartIndex})`
        }
      };
    }

    // Push trailing field
    currentRow.push(currentField.trim());
    if (currentRow.some(col => col.length > 0)) {
      rows.push(currentRow);
    }

    return { rows, error: null };
  }

  /**
   * Parses CSV file content into Stop candidate objects: [{ name, address }]
   * @param {string} csvText
   * @returns {{ success: boolean, stops?: Array<{ name: string, address: string }>, warnings?: string[], error?: { row: number, reason: string } }}
   */
  function parseStopCSV(csvText) {
    if (!csvText || typeof csvText !== 'string' || !csvText.trim()) {
      return { success: false, error: { row: 1, reason: 'CSV content is empty' } };
    }

    const { rows, error } = parseCSVMatrix(csvText);
    if (error) {
      return { success: false, error };
    }

    if (rows.length === 0) {
      return { success: false, error: { row: 1, reason: 'No data rows found in CSV' } };
    }

    // Determine header mapping
    const headerRow = rows[0].map(h => h.toLowerCase());
    let addressCol = -1;
    let nameCol = -1;
    let dataStartRow = 0;

    for (let c = 0; c < headerRow.length; c++) {
      const col = headerRow[c];
      if (col === 'address' || col === 'addr' || col === 'location' || col === 'destination' || col === 'street') {
        addressCol = c;
      } else if (col === 'name' || col === 'title' || col === 'customer' || col === 'stop name' || col === 'label') {
        nameCol = c;
      }
    }

    if (addressCol !== -1) {
      dataStartRow = 1; // Header row exists
    } else {
      // No standard header found: heuristic detection
      if (rows[0].length === 1) {
        addressCol = 0;
        dataStartRow = 0;
      } else if (rows[0].length >= 2) {
        // Heuristic: check if first row looks like a header (e.g. contains 'address')
        const row0Joined = rows[0].join(' ').toLowerCase();
        if (row0Joined.includes('address') || row0Joined.includes('name')) {
          dataStartRow = 1;
          addressCol = 1;
          nameCol = 0;
        } else {
          // Default: column 0 = Name, column 1 = Address, or column 0 = Address
          dataStartRow = 0;
          nameCol = 0;
          addressCol = 1;
        }
      }
    }

    const stops = [];
    const warnings = [];
    const seenAddresses = new Set();

    for (let r = dataStartRow; r < rows.length; r++) {
      const rowNum = r + 1;
      const row = rows[r];

      let address = '';
      let name = '';

      if (addressCol >= 0 && addressCol < row.length) {
        address = row[addressCol];
      } else if (row.length === 1) {
        address = row[0];
      }

      if (nameCol >= 0 && nameCol < row.length) {
        name = row[nameCol];
      }

      if (!address) {
        return {
          success: false,
          error: {
            row: rowNum,
            reason: `Missing or empty address at row ${rowNum}`
          }
        };
      }

      if (!name) {
        name = address.split(',')[0].trim() || `Stop ${stops.length + 1}`;
      }

      const normalizedAddress = address.trim().toLowerCase();
      if (seenAddresses.has(normalizedAddress)) {
        warnings.push(`Row ${rowNum}: Duplicate address detected ("${address}")`);
      } else {
        seenAddresses.add(normalizedAddress);
      }

      stops.push({
        name: name.trim(),
        address: address.trim()
      });
    }

    if (stops.length === 0) {
      return {
        success: false,
        error: { row: 1, reason: 'No valid addresses could be parsed from the CSV' }
      };
    }

    return { success: true, stops, warnings };
  }

  /**
   * Parses pasted raw text (one address per line or tab/comma separated)
   * @param {string} rawText
   * @returns {{ success: boolean, stops: Array<{ name: string, address: string }>, error?: string }}
   */
  function parsePastedAddresses(rawText) {
    if (!rawText || !rawText.trim()) {
      return { success: false, stops: [], error: 'Pasted text is empty.' };
    }

    const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    const stops = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Check if line contains tab separator
      if (line.includes('\t')) {
        const parts = line.split('\t').map(p => p.trim());
        const name = parts[0];
        const address = parts.slice(1).join(', ') || parts[0];
        stops.push({ name, address });
      } else {
        // Single address per line
        stops.push({
          name: line.split(',')[0].trim() || `Stop ${stops.length + 1}`,
          address: line
        });
      }
    }

    return { success: true, stops };
  }

  /**
   * Sanitizes a cell against spreadsheet formula injection (=, +, -, @, \t, \r)
   * @param {any} value
   * @returns {string}
   */
  function sanitizeCellForExport(value) {
    if (value === null || value === undefined) return '';
    let str = String(value);

    // If starts with dangerous characters, prepend with single quote
    const dangerousChars = ['=', '+', '-', '@', '\t', '\r'];
    if (str.length > 0 && dangerousChars.includes(str.charAt(0))) {
      str = "'" + str;
    }

    // Escape quotes and wrap in quotes if contains comma, quote, or newline
    if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }

    return str;
  }

  /**
   * Exports stops to a safe CSV format
   * @param {Array<Object>} stops
   * @param {string} [routeTitle]
   * @returns {string}
   */
  function exportStopsToCSV(stops, routeTitle) {
    const headers = ['Sequence', 'Name', 'Address', 'Latitude', 'Longitude', 'Locked', 'Status'];
    const lines = [headers.join(',')];

    if (Array.isArray(stops)) {
      stops.forEach((stop, index) => {
        const seq = stop.sequence !== undefined ? stop.sequence + 1 : index + 1;
        const name = sanitizeCellForExport(stop.name || '');
        const address = sanitizeCellForExport(stop.address || '');
        const lat = stop.latitude !== null && stop.latitude !== undefined ? stop.latitude : '';
        const lng = stop.longitude !== null && stop.longitude !== undefined ? stop.longitude : '';
        const locked = stop.metadata && stop.metadata.locked ? 'Yes' : 'No';
        const status = (stop.metadata && stop.metadata.geocodeStatus) || 'ok';

        lines.push([seq, name, address, lat, lng, locked, status].join(','));
      });
    }

    return lines.join('\r\n');
  }

  return {
    stripBOM,
    parseCSVMatrix,
    parseStopCSV,
    parsePastedAddresses,
    sanitizeCellForExport,
    exportStopsToCSV
  };
});

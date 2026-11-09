/**
 * RouteForge - Client-Side RFC 4180 CSV & TSV Parser
 * Parses multi-column logistics and tour CSV files with quoted commas,
 * multiple headers, GPS coordinates, and stop titles.
 */

export interface ParsedCsvStop {
  name: string;
  address: string;
  lat?: number;
  lng?: number;
  locked?: boolean;
}

export interface CsvParseResult {
  ok: boolean;
  stops: ParsedCsvStop[];
  totalRows: number;
  hasCoordinates: boolean;
  warnings: string[];
  error?: string;
}

/**
 * Robust RFC 4180 field tokenizer
 * Handles quoted cells with embedded commas, newlines, and escaped double-quotes
 */
function tokenizeCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        // Escaped double quote
        currentField += '"';
        i++;
      } else {
        // Toggle quote state
        insideQuotes = !insideQuotes;
      }
    } else if (char === delimiter && !insideQuotes) {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++; // Skip \n
      }
      currentRow.push(currentField.trim());
      if (currentRow.some(cell => cell.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }

  // Push last field & row if not empty
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some(cell => cell.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

function cleanCell(val: string): string {
  if (!val) return '';
  return val.replace(/^["']|["']$/g, '').trim();
}

function parseCoordinateNumber(val: string): number | null {
  if (!val) return null;
  const cleaned = cleanCell(val).replace(/°/g, '').replace(/[NSEWnsew]/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Main CSV / TSV stop parser
 */
export function parseCsvText(rawText: string): CsvParseResult {
  let clean = rawText.trim();
  if (clean.charCodeAt(0) === 0xFEFF) {
    clean = clean.slice(1);
  }

  if (!clean) {
    return {
      ok: false,
      stops: [],
      totalRows: 0,
      hasCoordinates: false,
      warnings: [],
      error: 'CSV content is empty.'
    };
  }

  const firstLine = clean.split(/\r?\n/)[0] || '';
  let delimiter = ',';
  if (firstLine.includes('\t') && (firstLine.match(/\t/g)?.length || 0) > (firstLine.match(/,/g)?.length || 0)) {
    delimiter = '\t';
  } else if (firstLine.includes(';') && (firstLine.match(/;/g)?.length || 0) > (firstLine.match(/,/g)?.length || 0)) {
    delimiter = ';';
  }

  const rows = tokenizeCsv(clean, delimiter);
  if (rows.length === 0) {
    return {
      ok: false,
      stops: [],
      totalRows: 0,
      hasCoordinates: false,
      warnings: [],
      error: 'No rows found in the provided CSV.'
    };
  }

  const headerRaw = rows[0].map(cleanCell);
  const headerLower = headerRaw.map(h => h.toLowerCase().replace(/[\s\-_]+/g, '_'));

  // Header column index detectors
  let latCol = -1;
  let lngCol = -1;
  const nameCols: number[] = [];
  const addrCols: number[] = [];
  let lockedCol = -1;
  let hasHeader = false;

  const latPatterns = ['latitude', 'lat', 'lat_deg', 'y', 'gps_lat', 'coord_lat', 'latitude_(deg)'];
  const lngPatterns = ['longitude', 'lon', 'lng', 'long', 'x', 'gps_lon', 'gps_lng', 'coord_lon', 'longitude_(deg)'];
  const namePatterns = ['jyotirlinga_name', 'temple_name', 'stop_name', 'location_name', 'place_name', 'name', 'title', 'label', 'customer', 'landmark', 'point'];
  const addrPatterns = ['address', 'addr', 'full_address', 'street', 'city_town', 'city', 'district', 'state', 'town', 'location', 'postal_code', 'zip', 'country'];

  for (let idx = 0; idx < headerLower.length; idx++) {
    const col = headerLower[idx];
    if (latPatterns.includes(col) || col.startsWith('latitude') || col.startsWith('gps_lat')) {
      latCol = idx;
      hasHeader = true;
    } else if (lngPatterns.includes(col) || col.startsWith('longitude') || col.startsWith('gps_lon') || col.startsWith('gps_lng')) {
      lngCol = idx;
      hasHeader = true;
    } else if (['locked', 'fixed', 'pinned'].includes(col)) {
      lockedCol = idx;
      hasHeader = true;
    } else if (namePatterns.some(p => col === p || col.endsWith(`_${p}`))) {
      nameCols.push(idx);
      hasHeader = true;
    } else if (addrPatterns.some(p => col === p || col.endsWith(`_${p}`))) {
      addrCols.push(idx);
      hasHeader = true;
    }
  }

  const dataStart = hasHeader ? 1 : 0;
  const stops: ParsedCsvStop[] = [];
  const warnings: string[] = [];
  let coordsFoundCount = 0;

  for (let r = dataStart; r < rows.length; r++) {
    const row = rows[r].map(cleanCell);
    if (row.length === 0 || row.every(c => !c)) continue;

    let latVal: number | null = null;
    let lngVal: number | null = null;
    let name = '';
    let address = '';
    let locked = false;

    if (hasHeader) {
      if (latCol >= 0 && latCol < row.length) {
        latVal = parseCoordinateNumber(row[latCol]);
      }
      if (lngCol >= 0 && lngCol < row.length) {
        lngVal = parseCoordinateNumber(row[lngCol]);
      }

      if (nameCols.length > 0) {
        const parts = nameCols.map(c => row[c]).filter(Boolean);
        if (parts.length >= 2) {
          name = `${parts[0]} (${parts[1]})`;
        } else if (parts.length === 1) {
          name = parts[0];
        }
      }

      if (addrCols.length > 0) {
        const parts = addrCols.map(c => row[c]).filter(Boolean);
        address = parts.join(', ');
      }

      if (lockedCol >= 0 && lockedCol < row.length) {
        const val = row[lockedCol].toLowerCase();
        locked = ['yes', 'true', '1', 'locked', 'pinned'].includes(val);
      }
    }

    // Heuristics if address or coordinates not resolved via headers
    if (!address) {
      if (row.length === 1) {
        address = row[0];
      } else if (row.length >= 2) {
        const n0 = parseCoordinateNumber(row[0]);
        const n1 = parseCoordinateNumber(row[1]);
        if (n0 !== null && n1 !== null && Math.abs(n0) <= 90 && Math.abs(n1) <= 180) {
          latVal = n0;
          lngVal = n1;
          name = name || `Waypoint ${stops.length + 1}`;
          address = `${n0.toFixed(5)}, ${n1.toFixed(5)}`;
        } else {
          name = name || row[0];
          address = row.slice(1).filter(Boolean).join(', ');
        }
      }
    }

    if (!name) {
      name = address.split(',')[0].trim() || `Stop ${stops.length + 1}`;
    }

    // Check if coordinates valid
    const hasValidCoords = latVal !== null && lngVal !== null && Math.abs(latVal) <= 90 && Math.abs(lngVal) <= 180;
    if (hasValidCoords) {
      coordsFoundCount++;
    }

    stops.push({
      name,
      address,
      lat: hasValidCoords ? latVal! : undefined,
      lng: hasValidCoords ? lngVal! : undefined,
      locked
    });
  }

  if (stops.length === 0) {
    return {
      ok: false,
      stops: [],
      totalRows: rows.length,
      hasCoordinates: false,
      warnings,
      error: 'No valid waypoints could be parsed from the CSV.'
    };
  }

  return {
    ok: true,
    stops,
    totalRows: stops.length,
    hasCoordinates: coordsFoundCount > 0,
    warnings
  };
}

"""
RouteForge - Robust RFC 4180 CSV & TSV Parser and Exporter
Zero-dependency parsing with intelligent column detection, coordinate preservation,
formula injection protection, and UTF-8 BOM stripping.
"""
import io
import csv
import re
from typing import List, Dict, Any, Tuple, Optional

DANGEROUS_PREFIXES = ("=", "+", "-", "@", "\t", "\r")

def strip_bom(text: str) -> str:
    if text.startswith("\ufeff"):
        return text[1:]
    return text

def _parse_float(val: Any) -> Optional[float]:
    if val is None:
        return None
    s = str(val).strip().replace("°", "").replace("N", "").replace("E", "")
    try:
        return float(s)
    except (ValueError, TypeError):
        return None

def parse_csv_stops(csv_text: str) -> Tuple[bool, List[Dict[str, Any]], List[str], Dict[str, Any]]:
    clean_text = strip_bom(csv_text).strip()
    if not clean_text:
        return False, [], [], {"row": 1, "reason": "CSV content is empty"}

    # Detect delimiter: comma, tab, or semicolon
    first_line = clean_text.splitlines()[0]
    delimiter = ","
    if "\t" in first_line and first_line.count("\t") > first_line.count(","):
        delimiter = "\t"
    elif ";" in first_line and first_line.count(";") > first_line.count(","):
        delimiter = ";"

    try:
        reader = csv.reader(io.StringIO(clean_text), delimiter=delimiter)
        rows = [row for row in reader if row and any(cell.strip() for cell in row)]
    except Exception as e:
        return False, [], [], {"row": 1, "reason": f"Malformed CSV structure: {str(e)}"}

    if not rows:
        return False, [], [], {"row": 1, "reason": "No data rows found in CSV"}

    header_raw = [h.strip() for h in rows[0]]
    header_lower = [h.lower().replace(" ", "_").replace("-", "_") for h in header_raw]

    lat_col = -1
    lng_col = -1
    name_cols = []
    addr_cols = []
    locked_col = -1
    has_header = False

    # Header pattern matchers
    lat_patterns = ("latitude", "lat", "lat_deg", "y", "gps_lat", "latitude_(deg)")
    lng_patterns = ("longitude", "lng", "lon", "long", "x", "gps_lng", "gps_lon", "longitude_(deg)")
    name_patterns = ("jyotirlinga_name", "temple_name", "stop_name", "location_name", "name", "title", "label", "customer", "landmark")
    addr_patterns = ("address", "addr", "full_address", "street", "city_town", "city", "district", "state", "town", "location")

    for idx, col in enumerate(header_lower):
        if col in lat_patterns or any(col.startswith(p) for p in ("latitude", "gps_lat")):
            lat_col = idx
            has_header = True
        elif col in lng_patterns or any(col.startswith(p) for p in ("longitude", "gps_lng", "gps_lon")):
            lng_col = idx
            has_header = True
        elif col in ("locked", "fixed", "pinned"):
            locked_col = idx
            has_header = True
        elif any(col == p or col.endswith(f"_{p}") for p in name_patterns):
            name_cols.append(idx)
            has_header = True
        elif any(col == p or col.endswith(f"_{p}") for p in addr_patterns):
            addr_cols.append(idx)
            has_header = True

    # If first row was recognized as a header
    data_start = 1 if has_header else 0

    stops = []
    warnings = []
    seen = set()

    for r_idx in range(data_start, len(rows)):
        row = [cell.strip() for cell in rows[r_idx]]
        row_num = r_idx + 1

        if not row or not any(row):
            continue

        lat_val: Optional[float] = None
        lng_val: Optional[float] = None
        name = ""
        address = ""
        locked = False

        if has_header:
            # Extract coordinates if columns were identified
            if lat_col >= 0 and lat_col < len(row):
                lat_val = _parse_float(row[lat_col])
            if lng_col >= 0 and lng_col < len(row):
                lng_val = _parse_float(row[lng_col])

            # Extract name
            if name_cols:
                name_parts = [row[c] for c in name_cols if c < len(row) and row[c]]
                if len(name_parts) >= 2:
                    name = f"{name_parts[0]} ({name_parts[1]})"
                elif name_parts:
                    name = name_parts[0]

            # Extract address
            if addr_cols:
                addr_parts = [row[c] for c in addr_cols if c < len(row) and row[c]]
                address = ", ".join(addr_parts)

            # Locked
            if locked_col >= 0 and locked_col < len(row):
                locked = row[locked_col].lower() in ("yes", "true", "1", "locked", "pinned")

        # Heuristics for rows without explicit header match or fallback
        if not address:
            if len(row) == 1:
                address = row[0]
            elif len(row) >= 2:
                # Check if first two items are lat, lng
                p0 = _parse_float(row[0])
                p1 = _parse_float(row[1])
                if p0 is not None and p1 is not None and -90 <= p0 <= 90 and -180 <= p1 <= 180:
                    lat_val = p0
                    lng_val = p1
                    name = f"Waypoint {len(stops) + 1}"
                    address = f"{p0:.5f}, {p1:.5f}"
                else:
                    name = row[0] if not name else name
                    address = ", ".join(row[1:])

        if not name:
            name = address.split(",")[0].strip() or f"Stop {len(stops) + 1}"

        # Clean quotes
        name = re.sub(r'^["\']|["\']$', '', name).strip()
        address = re.sub(r'^["\']|["\']$', '', address).strip()

        stop_dict: Dict[str, Any] = {
            "name": name,
            "address": address
        }
        if lat_val is not None and -90 <= lat_val <= 90:
            stop_dict["latitude"] = lat_val
        if lng_val is not None and -180 <= lng_val <= 180:
            stop_dict["longitude"] = lng_val
        if locked:
            stop_dict["locked"] = True

        norm = address.lower()
        if norm in seen:
            warnings.append(f"Row {row_num}: Duplicate location ('{address}')")
        else:
            seen.add(norm)

        stops.append(stop_dict)

    if not stops:
        return False, [], [], {"row": 1, "reason": "No valid addresses could be parsed from the CSV"}

    return True, stops, warnings, {}

def parse_pasted_lines(raw_text: str) -> List[Dict[str, Any]]:
    ok, stops, _, _ = parse_csv_stops(raw_text)
    return stops if ok else []

def sanitize_cell_for_export(val: Any) -> str:
    if val is None:
        return ""
    s = str(val)
    if s and s.startswith(DANGEROUS_PREFIXES):
        s = "'" + s
    return s

def export_stops_csv(stops: List[Dict[str, Any]], title: str = "Route") -> str:
    output = io.StringIO()
    writer = csv.writer(output, lineterminator="\r\n")

    headers = ["Sequence", "Name", "Address", "Latitude", "Longitude", "Locked", "Status"]
    writer.writerow(headers)

    for idx, stop in enumerate(stops or []):
        seq = stop.get("sequence", idx) + 1
        name = sanitize_cell_for_export(stop.get("name", ""))
        addr = sanitize_cell_for_export(stop.get("address", ""))
        lat = stop.get("latitude") if stop.get("latitude") is not None else ""
        lng = stop.get("longitude") if stop.get("longitude") is not None else ""
        meta = stop.get("metadata") or {}
        locked = "Yes" if meta.get("locked") else "No"
        status = meta.get("geocodeStatus") or "ok"

        writer.writerow([seq, name, addr, lat, lng, locked, status])

    return output.getvalue()

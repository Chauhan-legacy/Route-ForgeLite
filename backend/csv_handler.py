"""
RouteForge - CSV Parser and Exporter (Python)
Zero-dependency RFC 4180 parsing with formula-injection guard and BOM stripping.
"""
import io
import csv
from typing import List, Dict, Any, Tuple

DANGEROUS_PREFIXES = ("=", "+", "-", "@", "\t", "\r")

def strip_bom(text: str) -> str:
    if text.startswith("\ufeff"):
        return text[1:]
    return text

def parse_csv_stops(csv_text: str) -> Tuple[bool, List[Dict[str, str]], List[str], Dict[str, Any]]:
    clean_text = strip_bom(csv_text).strip()
    if not clean_text:
        return False, [], [], {"row": 1, "reason": "CSV content is empty"}

    try:
        reader = csv.reader(io.StringIO(clean_text))
        rows = list(reader)
    except Exception as e:
        return False, [], [], {"row": 1, "reason": f"Malformed CSV structure: {str(e)}"}

    if not rows:
        return False, [], [], {"row": 1, "reason": "No data rows found in CSV"}

    # Detect header mapping
    header = [h.strip().lower() for h in rows[0]]
    addr_col = -1
    name_col = -1
    data_start = 0

    for idx, col in enumerate(header):
        if col in ("address", "addr", "location", "destination", "street"):
            addr_col = idx
        elif col in ("name", "title", "customer", "stop name", "label"):
            name_col = idx

    if addr_col != -1:
        data_start = 1
    else:
        # Heuristic detection
        row0_str = " ".join(header)
        if "address" in row0_str or "name" in row0_str:
            data_start = 1
            addr_col = 1
            name_col = 0
        elif len(rows[0]) == 1:
            addr_col = 0
            data_start = 0
        else:
            data_start = 0
            name_col = 0
            addr_col = 1

    stops = []
    warnings = []
    seen = set()

    for r_idx in range(data_start, len(rows)):
        row = rows[r_idx]
        row_num = r_idx + 1

        if not row or not any(cell.strip() for cell in row):
            continue

        address = ""
        name = ""

        if 0 <= addr_col < len(row):
            address = row[addr_col].strip()
        elif len(row) == 1:
            address = row[0].strip()

        if 0 <= name_col < len(row):
            name = row[name_col].strip()

        if not address:
            return False, [], [], {"row": row_num, "reason": f"Missing or empty address at row {row_num}"}

        if not name:
            name = address.split(",")[0].strip() or f"Stop {len(stops) + 1}"

        norm = address.lower()
        if norm in seen:
            warnings.append(f"Row {row_num}: Duplicate address ('{address}')")
        else:
            seen.add(norm)

        stops.append({"name": name, "address": address})

    if not stops:
        return False, [], [], {"row": 1, "reason": "No valid addresses could be parsed from the CSV"}

    return True, stops, warnings, {}

def parse_pasted_lines(raw_text: str) -> List[Dict[str, str]]:
    clean = strip_bom(raw_text).strip()
    if not clean:
        return []

    lines = [line.strip() for line in clean.splitlines() if line.strip()]
    stops = []
    for line in lines:
        if "\t" in line:
            parts = [p.strip() for p in line.split("\t") if p.strip()]
            name = parts[0]
            addr = ", ".join(parts[1:]) if len(parts) > 1 else parts[0]
            stops.append({"name": name, "address": addr})
        else:
            stops.append({
                "name": line.split(",")[0].strip() or f"Stop {len(stops) + 1}",
                "address": line
            })
    return stops

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


"""
RouteForge - SQLite Database Module
Manages transactional route, stop, and history persistence mirroring the original schema.
"""
import sqlite3
import json
import uuid
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional

DB_PATH = Path(__file__).parent.parent / "database" / "routeforge.db"

class RevisionConflictException(Exception):
    def __init__(self, current_rev: int, expected_rev: int):
        super().__init__(f"Revision conflict: current revision is {current_rev}, expected was {expected_rev}")
        self.code = "REVISION_CONFLICT"
        self.current_revision = current_rev
        self.expected_revision = expected_rev

class NotFoundException(Exception):
    def __init__(self, message: str):
        super().__init__(message)
        self.code = "NOT_FOUND"

def get_db_connection() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def init_db():
    conn = get_db_connection()
    try:
        with conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS Routes (
                    routeId TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    createdAt TEXT NOT NULL,
                    updatedAt TEXT NOT NULL,
                    revision INTEGER NOT NULL DEFAULT 1,
                    settings TEXT NOT NULL DEFAULT '{}',
                    ownerIdentifier TEXT,
                    status TEXT NOT NULL DEFAULT 'active'
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS Stops (
                    routeId TEXT NOT NULL,
                    stopId TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    address TEXT NOT NULL,
                    latitude REAL,
                    longitude REAL,
                    sequence INTEGER NOT NULL,
                    metadata TEXT NOT NULL DEFAULT '{}',
                    FOREIGN KEY(routeId) REFERENCES Routes(routeId) ON DELETE CASCADE
                )
            """)
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_stops_route_seq ON Stops (routeId, sequence)
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS RouteHistory (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    routeId TEXT NOT NULL,
                    revision INTEGER NOT NULL,
                    timestamp TEXT NOT NULL,
                    changeType TEXT NOT NULL,
                    changedBy TEXT,
                    summary TEXT,
                    FOREIGN KEY(routeId) REFERENCES Routes(routeId) ON DELETE CASCADE
                )
            """)
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_history_route ON RouteHistory (routeId, revision DESC)
            """)
    finally:
        conn.close()

def _generate_id(prefix: str = "") -> str:
    rand = uuid.uuid4().hex[:8]
    ts = hex(int(time.time() * 1000))[2:]
    return f"{prefix}{ts}-{rand}"

def _append_history(cursor, route_id: str, revision: int, change_type: str, changed_by: Optional[str], summary: str):
    now = datetime.utcnow().isoformat() + "Z"
    cursor.execute("""
        INSERT INTO RouteHistory (routeId, revision, timestamp, changeType, changedBy, summary)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (route_id, revision, now, change_type or "update", changed_by or "anonymous", summary or ""))

    # Enforce 50-entry retention cap
    cursor.execute("""
        DELETE FROM RouteHistory 
        WHERE routeId = ? AND id NOT IN (
            SELECT id FROM RouteHistory WHERE routeId = ? ORDER BY revision DESC, id DESC LIMIT 50
        )
    """, (route_id, route_id))

def create_route(title: Optional[str] = None, settings: Optional[Dict[str, Any]] = None, owner_identifier: Optional[str] = None) -> Dict[str, Any]:
    conn = get_db_connection()
    try:
        route_id = _generate_id("rf_")
        now = datetime.utcnow().isoformat() + "Z"
        clean_title = title.strip() if title and title.strip() else "Untitled Route"
        settings_json = json.dumps(settings or {"fixedStart": True, "fixedEnd": False, "provider": "osrm"})
        owner = owner_identifier or "anonymous"

        with conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO Routes (routeId, title, createdAt, updatedAt, revision, settings, ownerIdentifier, status)
                VALUES (?, ?, ?, ?, 1, ?, ?, 'active')
            """, (route_id, clean_title, now, now, settings_json, owner))
            _append_history(cursor, route_id, 1, "create", owner, "Route created")

        return {
            "routeId": route_id,
            "revision": 1,
            "url": f"?routeId={route_id}",
            "createdAt": now,
            "updatedAt": now
        }
    finally:
        conn.close()

def get_route(route_id: str) -> Dict[str, Any]:
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM Routes WHERE routeId = ? AND status != 'deleted'", (route_id,))
        row = cursor.fetchone()
        if not row:
            raise NotFoundException(f"Route {route_id} not found")

        cursor.execute("SELECT * FROM Stops WHERE routeId = ? ORDER BY sequence ASC", (route_id,))
        stop_rows = cursor.fetchall()

        cursor.execute("""
            SELECT routeId, revision, timestamp, changeType, changedBy, summary 
            FROM RouteHistory WHERE routeId = ? ORDER BY revision DESC LIMIT 50
        """, (route_id,))
        history_rows = cursor.fetchall()

        route_dict = dict(row)
        route_dict["settings"] = json.loads(route_dict["settings"] or "{}")

        stops = []
        for s in stop_rows:
            sd = dict(s)
            sd["metadata"] = json.loads(sd["metadata"] or "{}")
            stops.append(sd)

        history = [dict(h) for h in history_rows]

        return {
            "route": route_dict,
            "stops": stops,
            "history": history
        }
    finally:
        conn.close()

def get_route_revision(route_id: str) -> Dict[str, Any]:
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT revision, updatedAt, status FROM Routes WHERE routeId = ?", (route_id,))
        row = cursor.fetchone()
        if not row or row["status"] == "deleted":
            raise NotFoundException(f"Route {route_id} not found")

        return {
            "revision": row["revision"],
            "updatedAt": row["updatedAt"]
        }
    finally:
        conn.close()

def update_route(route_id: str, expected_revision: Optional[int], changes: Dict[str, Any]) -> Dict[str, Any]:
    conn = get_db_connection()
    try:
        with conn:
            cursor = conn.cursor()
            cursor.execute("SELECT revision, settings, status, title FROM Routes WHERE routeId = ?", (route_id,))
            row = cursor.fetchone()
            if not row or row["status"] == "deleted":
                raise NotFoundException(f"Route {route_id} not found")

            if expected_revision is not None and row["revision"] != expected_revision:
                raise RevisionConflictException(row["revision"], expected_revision)

            next_rev = row["revision"] + 1
            now = datetime.utcnow().isoformat() + "Z"

            new_title = changes.get("title", row["title"])
            if new_title is not None:
                new_title = str(new_title).strip()

            current_settings = json.loads(row["settings"] or "{}")
            if "settings" in changes and isinstance(changes["settings"], dict):
                current_settings.update(changes["settings"])

            new_status = changes.get("status", row["status"])

            cursor.execute("""
                UPDATE Routes 
                SET title = ?, settings = ?, status = ?, updatedAt = ?, revision = ?
                WHERE routeId = ?
            """, (new_title, json.dumps(current_settings), new_status, now, next_rev, route_id))

            _append_history(cursor, route_id, next_rev, "update", changes.get("changedBy"), "Route metadata updated")

        return {
            "route": {
                "routeId": route_id,
                "title": new_title,
                "settings": current_settings,
                "status": new_status,
                "updatedAt": now,
                "revision": next_rev
            },
            "revision": next_rev
        }
    finally:
        conn.close()

def add_stop(route_id: str, expected_revision: Optional[int], stop_data: Dict[str, Any]) -> Dict[str, Any]:
    conn = get_db_connection()
    try:
        with conn:
            cursor = conn.cursor()
            cursor.execute("SELECT revision, status FROM Routes WHERE routeId = ?", (route_id,))
            row = cursor.fetchone()
            if not row or row["status"] == "deleted":
                raise NotFoundException(f"Route {route_id} not found")

            if expected_revision is not None and row["revision"] != expected_revision:
                raise RevisionConflictException(row["revision"], expected_revision)

            cursor.execute("SELECT COUNT(*) as cnt FROM Stops WHERE routeId = ?", (route_id,))
            stop_count = cursor.fetchone()["cnt"]

            stop_id = stop_data.get("stopId") or _generate_id("stop_")
            sequence = stop_data.get("sequence", stop_count)
            address = (stop_data.get("address") or "").strip()
            name = (stop_data.get("name") or "").strip() or address.split(",")[0].strip() or f"Stop {stop_count + 1}"
            lat = stop_data.get("latitude")
            lng = stop_data.get("longitude")
            metadata = stop_data.get("metadata") or {"locked": False, "geocodeStatus": "pending"}

            cursor.execute("""
                INSERT INTO Stops (routeId, stopId, name, address, latitude, longitude, sequence, metadata)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (route_id, stop_id, name, address, lat, lng, sequence, json.dumps(metadata)))

            next_rev = row["revision"] + 1
            now = datetime.utcnow().isoformat() + "Z"
            cursor.execute("UPDATE Routes SET revision = ?, updatedAt = ? WHERE routeId = ?", (next_rev, now, route_id))

            _append_history(cursor, route_id, next_rev, "add_stop", stop_data.get("changedBy"), f"Added stop: {name}")

        return {
            "stop": {
                "routeId": route_id,
                "stopId": stop_id,
                "name": name,
                "address": address,
                "latitude": lat,
                "longitude": lng,
                "sequence": sequence,
                "metadata": metadata
            },
            "revision": next_rev
        }
    finally:
        conn.close()

def remove_stop(route_id: str, expected_revision: Optional[int], stop_id: str) -> Dict[str, Any]:
    conn = get_db_connection()
    try:
        with conn:
            cursor = conn.cursor()
            cursor.execute("SELECT revision, status FROM Routes WHERE routeId = ?", (route_id,))
            row = cursor.fetchone()
            if not row or row["status"] == "deleted":
                raise NotFoundException(f"Route {route_id} not found")

            if expected_revision is not None and row["revision"] != expected_revision:
                raise RevisionConflictException(row["revision"], expected_revision)

            cursor.execute("SELECT name FROM Stops WHERE routeId = ? AND stopId = ?", (route_id, stop_id))
            existing = cursor.fetchone()
            if not existing:
                raise NotFoundException(f"Stop {stop_id} not found in route {route_id}")

            cursor.execute("DELETE FROM Stops WHERE routeId = ? AND stopId = ?", (route_id, stop_id))

            # Re-index sequence for remaining stops
            cursor.execute("SELECT stopId FROM Stops WHERE routeId = ? ORDER BY sequence ASC", (route_id,))
            remaining = cursor.fetchall()
            for idx, r in enumerate(remaining):
                cursor.execute("UPDATE Stops SET sequence = ? WHERE routeId = ? AND stopId = ?", (idx, route_id, r["stopId"]))

            next_rev = row["revision"] + 1
            now = datetime.utcnow().isoformat() + "Z"
            cursor.execute("UPDATE Routes SET revision = ?, updatedAt = ? WHERE routeId = ?", (next_rev, now, route_id))

            _append_history(cursor, route_id, next_rev, "remove_stop", None, f"Removed stop: {existing['name']}")

        return {"removedStopId": stop_id, "revision": next_rev}
    finally:
        conn.close()

def reorder_stops(route_id: str, expected_revision: Optional[int], sequence: List[str]) -> Dict[str, Any]:
    conn = get_db_connection()
    try:
        with conn:
            cursor = conn.cursor()
            cursor.execute("SELECT revision, status FROM Routes WHERE routeId = ?", (route_id,))
            row = cursor.fetchone()
            if not row or row["status"] == "deleted":
                raise NotFoundException(f"Route {route_id} not found")

            if expected_revision is not None and row["revision"] != expected_revision:
                raise RevisionConflictException(row["revision"], expected_revision)

            for idx, s_id in enumerate(sequence):
                cursor.execute("UPDATE Stops SET sequence = ? WHERE routeId = ? AND stopId = ?", (idx, route_id, s_id))

            next_rev = row["revision"] + 1
            now = datetime.utcnow().isoformat() + "Z"
            cursor.execute("UPDATE Routes SET revision = ?, updatedAt = ? WHERE routeId = ?", (next_rev, now, route_id))

            _append_history(cursor, route_id, next_rev, "reorder_stops", None, "Stops reordered")

        # Fetch updated stops
        updated_route = get_route(route_id)
        return {"stops": updated_route["stops"], "revision": next_rev}
    finally:
        conn.close()

def update_stop(route_id: str, expected_revision: Optional[int], stop_id: str, changes: Dict[str, Any]) -> Dict[str, Any]:
    conn = get_db_connection()
    try:
        with conn:
            cursor = conn.cursor()
            cursor.execute("SELECT revision, status FROM Routes WHERE routeId = ?", (route_id,))
            row = cursor.fetchone()
            if not row or row["status"] == "deleted":
                raise NotFoundException(f"Route {route_id} not found")

            if expected_revision is not None and row["revision"] != expected_revision:
                raise RevisionConflictException(row["revision"], expected_revision)

            cursor.execute("SELECT * FROM Stops WHERE routeId = ? AND stopId = ?", (route_id, stop_id))
            cur_stop = cursor.fetchone()
            if not cur_stop:
                raise NotFoundException(f"Stop {stop_id} not found")

            name = changes.get("name", cur_stop["name"])
            address = changes.get("address", cur_stop["address"])
            lat = changes.get("latitude", cur_stop["latitude"])
            lng = changes.get("longitude", cur_stop["longitude"])

            meta = json.loads(cur_stop["metadata"] or "{}")
            if "metadata" in changes and isinstance(changes["metadata"], dict):
                meta.update(changes["metadata"])

            cursor.execute("""
                UPDATE Stops SET name = ?, address = ?, latitude = ?, longitude = ?, metadata = ?
                WHERE routeId = ? AND stopId = ?
            """, (name, address, lat, lng, json.dumps(meta), route_id, stop_id))

            next_rev = row["revision"] + 1
            now = datetime.utcnow().isoformat() + "Z"
            cursor.execute("UPDATE Routes SET revision = ?, updatedAt = ? WHERE routeId = ?", (next_rev, now, route_id))

            _append_history(cursor, route_id, next_rev, "update", changes.get("changedBy"), f"Updated stop: {name}")

        return {
            "stop": {
                "routeId": route_id,
                "stopId": stop_id,
                "name": name,
                "address": address,
                "latitude": lat,
                "longitude": lng,
                "sequence": cur_stop["sequence"],
                "metadata": meta
            },
            "revision": next_rev
        }
    finally:
        conn.close()

def delete_route(route_id: str) -> bool:
    conn = get_db_connection()
    try:
        with conn:
            cursor = conn.cursor()
            cursor.execute("UPDATE Routes SET status = 'deleted' WHERE routeId = ?", (route_id,))
            return cursor.rowcount > 0
    finally:
        conn.close()

def list_routes() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT routeId, title, createdAt, updatedAt, revision, status FROM Routes WHERE status != 'deleted' ORDER BY updatedAt DESC")
        rows = cursor.fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


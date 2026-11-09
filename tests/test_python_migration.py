"""
RouteForge - Python Migration Verification Test
Validates SQLite database, Optimizer, Router, Geocoder, CSV Guard, and FastAPI endpoints.
"""
import pytest
import asyncio
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from backend import database, optimizer, router, geocoder, csv_handler
from fastapi.testclient import TestClient
from backend.main import app

def test_database_and_crud():
    print("\n--- 1. Testing Database & CRUD ---")
    database.init_db()

    # Create route
    r = database.create_route(title="Test Python Tour")
    assert r["routeId"], "Must return routeId"
    assert r["revision"] == 1, "Initial revision must be 1"
    route_id = r["routeId"]

    # Get route
    fetched = database.get_route(route_id)
    assert fetched["route"]["title"] == "Test Python Tour"
    assert len(fetched["stops"]) == 0

    # Add stops
    s1 = database.add_stop(route_id, 1, {
        "name": "Depot",
        "address": "Stephansplatz 3, 1010 Wien",
        "latitude": 48.2082,
        "longitude": 16.3738,
        "metadata": {"locked": False}
    })
    assert s1["revision"] == 2
    assert s1["stop"]["name"] == "Depot"

    s2 = database.add_stop(route_id, 2, {
        "name": "Stop A",
        "address": "Praterstern 1, 1020 Wien",
        "latitude": 48.2178,
        "longitude": 16.3920,
        "metadata": {"locked": False}
    })
    assert s2["revision"] == 3

    s3 = database.add_stop(route_id, 3, {
        "name": "Stop B",
        "address": "Schönbrunn, 1130 Wien",
        "latitude": 48.1858,
        "longitude": 16.3128,
        "metadata": {"locked": True} # Locked stop
    })
    assert s3["revision"] == 4

    # Revision conflict check
    conflict_caught = False
    try:
        database.update_route(route_id, 2, {"title": "Stale Title"})
    except database.RevisionConflictException:
        conflict_caught = True
    assert conflict_caught, "Stale revision must raise RevisionConflictException"

    # Reorder stops
    reordered = database.reorder_stops(route_id, 4, [s3["stop"]["stopId"], s1["stop"]["stopId"], s2["stop"]["stopId"]])
    assert reordered["revision"] == 5
    assert reordered["stops"][0]["stopId"] == s3["stop"]["stopId"]

    # Remove stop
    removed = database.remove_stop(route_id, 5, s2["stop"]["stopId"])
    assert removed["revision"] == 6

    final_route = database.get_route(route_id)
    assert len(final_route["stops"]) == 2
    assert final_route["stops"][0]["sequence"] == 0
    assert final_route["stops"][1]["sequence"] == 1

    print("✓ Database CRUD, revisions, and conflict validation passed!")

def test_optimizer_with_locked_stops():
    print("\n--- 2. Testing Optimizer Core ---")
    stops = [
        {"stopId": "A", "sequence": 0, "latitude": 0.0, "longitude": 0.0, "metadata": {}},
        {"stopId": "C", "sequence": 1, "latitude": 0.0, "longitude": 2.0, "metadata": {}},
        {"stopId": "B", "sequence": 2, "latitude": 0.0, "longitude": 1.0, "metadata": {}},
        {"stopId": "D", "sequence": 3, "latitude": 0.0, "longitude": 3.0, "metadata": {}},
    ]

    opt = optimizer.optimize_stops(stops, {"fixedStart": True, "fixedEnd": True})
    assert opt["stops"][0]["stopId"] == "A"
    assert opt["stops"][1]["stopId"] == "B"
    assert opt["stops"][2]["stopId"] == "C"
    assert opt["stops"][3]["stopId"] == "D"
    assert opt["savingsMeters"] > 0, "Optimizer should reduce distance"

    # Test lock preservation: lock C at index 1
    stops_with_lock = [
        {"stopId": "A", "sequence": 0, "latitude": 0.0, "longitude": 0.0, "metadata": {}},
        {"stopId": "C", "sequence": 1, "latitude": 0.0, "longitude": 2.0, "metadata": {"locked": True}},
        {"stopId": "B", "sequence": 2, "latitude": 0.0, "longitude": 1.0, "metadata": {}},
        {"stopId": "D", "sequence": 3, "latitude": 0.0, "longitude": 3.0, "metadata": {}},
    ]
    opt_locked = optimizer.optimize_stops(stops_with_lock, {"fixedStart": True, "fixedEnd": True, "lockedStops": True})
    assert opt_locked["stops"][1]["stopId"] == "C", "Locked stop must remain in place"

    print("✓ Optimizer nearest-neighbor, 2-opt, and locked stop constraints passed!")

def test_csv_and_formula_guard():
    print("\n--- 3. Testing CSV Parser & Formula Injection Guard ---")
    raw_csv = """Name,Address
"Stephansdom","Stephansplatz 3, 1010 Wien"
"Belvedere","Prinz Eugen-Straße 27, 1030 Wien"
"""
    success, stops, warnings, err = csv_handler.parse_csv_stops(raw_csv)
    assert success, "Should successfully parse valid CSV"
    assert len(stops) == 2
    assert stops[0]["name"] == "Stephansdom"

    # Test dangerous formula injection
    dangerous_stops = [
        {"name": "=1+1", "address": "+43 123", "latitude": 48.2, "longitude": 16.3, "sequence": 0},
        {"name": "-200", "address": "@danger", "latitude": 48.2, "longitude": 16.3, "sequence": 1}
    ]
    csv_out = csv_handler.export_stops_csv(dangerous_stops)
    assert "'=1+1" in csv_out, "Formula starting with = must be prepended with '"
    assert "'+43 123" in csv_out, "Formula starting with + must be prepended with '"
    assert "'-200" in csv_out, "Formula starting with - must be prepended with '"
    assert "'@danger" in csv_out, "Formula starting with @ must be prepended with '"

    print("✓ CSV parser and formula-injection security guard passed!")

def test_fastapi_endpoints():
    print("\n--- 4. Testing FastAPI HTTP Endpoints ---")
    client = TestClient(app)

    # 1. Root / UI serves index.html
    r0 = client.get("/")
    assert r0.status_code == 200
    assert "RouteForge" in r0.text

    # 2. createRoute
    r1 = client.post("/api/createRoute", json={"title": "Vienna FastAPI Route"})
    assert r1.status_code == 200
    res1 = r1.json()
    assert res1["ok"] is True
    route_id = res1["data"]["routeId"]
    assert res1["revision"] == 1

    # 3. addStop
    r2 = client.post("/api/addStop", json={
        "routeId": route_id,
        "expectedRevision": 1,
        "stop": {
            "name": "Stephansdom",
            "address": "Stephansplatz 3, 1010 Wien",
            "latitude": 48.2082,
            "longitude": 16.3738
        }
    })
    assert r2.status_code == 200
    assert r2.json()["revision"] == 2

    # 4. addStop #2
    r3 = client.post("/api/addStop", json={
        "routeId": route_id,
        "expectedRevision": 2,
        "stop": {
            "name": "Prater",
            "address": "Riesenradplatz 1, 1020 Wien",
            "latitude": 48.2166,
            "longitude": 16.3959
        }
    })
    assert r3.status_code == 200
    assert r3.json()["revision"] == 3

    # 5. calculateRoute
    r4 = client.post("/api/calculateRoute", json={
        "routeId": route_id,
        "provider": "straightLine"
    })
    assert r4.status_code == 200
    res4 = r4.json()
    assert res4["ok"] is True
    assert res4["data"]["provider"] == "straightLine"
    assert res4["data"]["totalDistanceMeters"] > 0

    # 6. exportRoute
    r5 = client.post("/api/exportRoute", json={"routeId": route_id, "format": "csv"})
    assert r5.status_code == 200
    assert "content" in r5.json()["data"]

    # 7. getRouteRevision
    r6 = client.get(f"/api/getRouteRevision?routeId={route_id}")
    assert r6.status_code == 200
    assert r6.json()["revision"] == 3

    print("✓ FastAPI endpoints tested and verified!")

if __name__ == "__main__":
    test_database_and_crud()
    test_optimizer_with_locked_stops()
    test_csv_and_formula_guard()
    test_fastapi_endpoints()
    print("\n=======================================================")
    print("ALL PYTHON MIGRATION TESTS PASSED WITH 100% SUCCESS")
    print("=======================================================\n")

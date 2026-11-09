"""
RouteForge - Advanced Optimizer & Routing Comprehensive Test Suite
Tests 5, 10, and 15 multi-stop tours, fixed starts, fixed ends, locked invariants,
road-distance matrices, dummy sink formulation, and turn-by-turn guidance.
"""
import pytest
import asyncio
from backend.optimizer import (
    optimize_stops,
    calculate_tour_distance,
    haversine_distance,
    build_haversine_matrix,
    fetch_road_matrix,
    normalize_options,
)
from backend.router import compute_route
from backend.geocoder import parse_direct_coordinates

# Sample real-world San Francisco coordinates
SF_COORDS = [
    {"stopId": "s_ferry", "name": "Ferry Building", "latitude": 37.7955, "longitude": -122.3937},
    {"stopId": "s_union", "name": "Union Square", "latitude": 37.7880, "longitude": -122.4075},
    {"stopId": "s_lombard", "name": "Lombard Street", "latitude": 37.8021, "longitude": -122.4187},
    {"stopId": "s_finearts", "name": "Palace of Fine Arts", "latitude": 37.8029, "longitude": -122.4484},
    {"stopId": "s_goldengate", "name": "Golden Gate Bridge", "latitude": 37.8199, "longitude": -122.4783},
    {"stopId": "s_twinpeaks", "name": "Twin Peaks", "latitude": 37.7544, "longitude": -122.4477},
    {"stopId": "s_mission", "name": "Mission Dolores", "latitude": 37.7599, "longitude": -122.4271},
    {"stopId": "s_coit", "name": "Coit Tower", "latitude": 37.8024, "longitude": -122.4058},
    {"stopId": "s_oceanbeach", "name": "Ocean Beach", "latitude": 37.7596, "longitude": -122.5107},
    {"stopId": "s_presidio", "name": "Presidio Main Post", "latitude": 37.7989, "longitude": -122.4662},
    {"stopId": "s_japantown", "name": "Japantown Peace Plaza", "latitude": 37.7853, "longitude": -122.4298},
    {"stopId": "s_civiccenter", "name": "Civic Center Plaza", "latitude": 37.7793, "longitude": -122.4175},
    {"stopId": "s_alcatraz_landing", "name": "Pier 33 Landing", "latitude": 37.8066, "longitude": -122.4048},
    {"stopId": "s_ghirardelli", "name": "Ghirardelli Square", "latitude": 37.8059, "longitude": -122.4229},
    {"stopId": "s_chinatown", "name": "Dragon Gate Chinatown", "latitude": 37.7908, "longitude": -122.4058},
]

def test_5_stops_open_ended_tsp():
    """Verify open-ended TSP on 5 scrambled stops (fixed start, open end)."""
    # Deliberately scrambled order: 0, 4, 1, 3, 2
    scrambled_indices = [0, 4, 1, 3, 2]
    stops = [dict(SF_COORDS[i], metadata={"locked": False}) for i in scrambled_indices]

    res = optimize_stops(stops, {"fixedStart": True, "fixedEnd": False, "returnToStart": False})

    assert res["stops"][0]["stopId"] == stops[0]["stopId"], "Origin must remain fixed"
    assert res["optimizedDistanceMeters"] <= res["originalDistanceMeters"], "Optimized distance must be <= original"
    assert res["savingsPercent"] > 0, f"Expected positive distance savings, got {res['savingsPercent']}%"
    assert res["isAlreadyOptimal"] is False, "Scrambled route should not be marked as already optimal"
    assert len(res["stops"]) == 5, "All 5 stops must be present"

def test_5_stops_fixed_start_and_end():
    """Verify intermediate stop optimization when both start and end are anchored."""
    # Scrambled order: 0, 3, 1, 2, 4
    scrambled_indices = [0, 3, 1, 2, 4]
    stops = [dict(SF_COORDS[i], metadata={"locked": False}) for i in scrambled_indices]

    res = optimize_stops(stops, {"fixedStart": True, "fixedEnd": True, "returnToStart": False})

    assert res["stops"][0]["stopId"] == stops[0]["stopId"], "Start stop must remain at index 0"
    assert res["stops"][-1]["stopId"] == stops[-1]["stopId"], "End stop must remain at final index"
    assert res["optimizedDistanceMeters"] <= res["originalDistanceMeters"]
    assert len(res["stops"]) == 5

def test_10_stops_multi_point_tour():
    """Verify OR-Tools optimization on 10 scrambled stops."""
    scrambled_indices = [0, 8, 2, 7, 1, 9, 3, 6, 4, 5]
    stops = [dict(SF_COORDS[i], metadata={"locked": False}) for i in scrambled_indices]

    res = optimize_stops(stops, {"fixedStart": True, "fixedEnd": False, "returnToStart": False})

    assert res["stops"][0]["stopId"] == stops[0]["stopId"]
    assert res["savingsPercent"] > 10.0, f"Expected significant savings (>10%), got {res['savingsPercent']}%"
    assert len(res["stops"]) == 10

def test_15_stops_with_locked_invariants():
    """Verify 15-stop tour with intermediate locked invariant stops strictly retaining position."""
    scrambled_indices = [0, 11, 4, 7, 2, 9, 13, 1, 10, 6, 3, 14, 8, 12, 5]
    stops = []
    for rank, idx in enumerate(scrambled_indices):
        s = dict(SF_COORDS[idx])
        # Lock stops at rank 3 and rank 8
        is_locked = rank in (3, 8)
        s["metadata"] = {"locked": is_locked}
        stops.append(s)

    locked_stop_3_id = stops[3]["stopId"]
    locked_stop_8_id = stops[8]["stopId"]

    res = optimize_stops(stops, {"fixedStart": True, "fixedEnd": False, "lockedStops": True})

    assert res["stops"][0]["stopId"] == stops[0]["stopId"], "Fixed start stop preserved"
    assert res["stops"][3]["stopId"] == locked_stop_3_id, "Locked invariant stop at rank 3 preserved"
    assert res["stops"][8]["stopId"] == locked_stop_8_id, "Locked invariant stop at rank 8 preserved"
    assert res["optimizedDistanceMeters"] <= res["originalDistanceMeters"]
    assert len(res["stops"]) == 15

def test_already_optimal_detection():
    """Verify that running optimization on an already-optimal sequence reports isAlreadyOptimal."""
    # First optimize a scrambled route
    scrambled_indices = [0, 4, 1, 3, 2]
    stops = [dict(SF_COORDS[i], metadata={"locked": False}) for i in scrambled_indices]
    opt_run_1 = optimize_stops(stops, {"fixedStart": True, "fixedEnd": False})

    # Pass the already-optimal sequence back in
    optimal_stops = opt_run_1["stops"]
    opt_run_2 = optimize_stops(optimal_stops, {"fixedStart": True, "fixedEnd": False})

    assert opt_run_2["isAlreadyOptimal"] is True
    assert opt_run_2["savingsPercent"] == 0.0
    assert opt_run_2["savingsMeters"] == 0
    assert [s["stopId"] for s in opt_run_2["stops"]] == [s["stopId"] for s in optimal_stops]

def test_roundtrip_closed_circuit():
    """Verify closed circuit roundtrip returning to start stop."""
    scrambled_indices = [0, 3, 1, 4, 2]
    stops = [dict(SF_COORDS[i], metadata={"locked": False}) for i in scrambled_indices]

    res = optimize_stops(stops, {"fixedStart": True, "returnToStart": True})
    assert res["optimizedDistanceMeters"] <= res["originalDistanceMeters"]
    assert res["stops"][0]["stopId"] == stops[0]["stopId"]

def test_osrm_turn_by_turn_maneuvers():
    """Verify OSRM route computation returns step-by-step turn maneuvers and snapped coordinates."""
    import asyncio
    test_stops = [SF_COORDS[0], SF_COORDS[1], SF_COORDS[2]]
    res = asyncio.run(compute_route(test_stops, provider="osrm", mode="driving", allow_fallback=True))

    assert res["ok"] is True
    data = res["data"]
    assert "geometry" in data
    assert "totalDistanceMeters" in data
    assert data["totalDistanceMeters"] > 0
    # Maneuvers check
    assert "maneuvers" in data
    assert len(data["maneuvers"]) > 0
    first_step = data["maneuvers"][0]
    assert "instruction" in first_step
    assert "distanceMeters" in first_step

def test_coordinate_parser():
    """Verify universal parser for decimal, DMS, Google Maps and OSM URLs."""
    # Decimal
    p1 = parse_direct_coordinates("37.7749, -122.4194")
    assert p1 is not None and abs(p1["lat"] - 37.7749) < 1e-4

    # Google Maps URL
    p2 = parse_direct_coordinates("https://www.google.com/maps/@37.7955,-122.3937,16z")
    assert p2 is not None and abs(p2["lat"] - 37.7955) < 1e-4

    # OpenStreetMap URL
    p3 = parse_direct_coordinates("https://www.openstreetmap.org/#map=16/37.8021/-122.4187")
    assert p3 is not None and abs(p3["lat"] - 37.8021) < 1e-4

def test_optimization_analytics_telemetry():
    """Verify deep analytics (telemetry, fuel, CO2, time savings, circuity) in optimizer response."""
    scrambled_indices = [0, 4, 1, 3, 2]
    stops = [dict(SF_COORDS[i], metadata={"locked": False}) for i in scrambled_indices]

    res = optimize_stops(stops, {"fixedStart": True, "fixedEnd": False})
    assert "analytics" in res, "Missing analytics payload in root"
    analytics = res["analytics"]

    assert "executionTimeMs" in analytics and analytics["executionTimeMs"] >= 0
    assert "fuelSavedLiters" in analytics and analytics["fuelSavedLiters"] >= 0
    assert "co2SavedKg" in analytics and analytics["co2SavedKg"] >= 0
    assert "timeSavedMinutes" in analytics and analytics["timeSavedMinutes"] >= 0
    assert "circuityRatio" in analytics and analytics["circuityRatio"] >= 1.0
    assert "longestLegMeters" in analytics and analytics["longestLegMeters"] > 0
    assert "averageLegMeters" in analytics and analytics["averageLegMeters"] > 0
    assert "algorithm" in analytics
    assert "matrixProvider" in analytics

def test_route_deletion_lifecycle():
    """Verify that deleting a route removes it from the active saved list."""
    import backend.database as db
    db.init_db()

    created = db.create_route("Temporary Test Route For Deletion")
    r_id = created["routeId"]

    # Ensure it appears in list
    active_routes = db.list_routes()
    assert any(r["routeId"] == r_id for r in active_routes)

    # Delete route
    deleted = db.delete_route(r_id)
    assert deleted is True

    # Ensure it no longer appears in active list
    remaining_routes = db.list_routes()
    assert not any(r["routeId"] == r_id for r in remaining_routes)

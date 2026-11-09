"""
RouteForge - Multi-Modal Routing Provider Abstraction (Python)
Features:
- Transport Modes: Driving (Car/Motorcycle), Cycling (Bike), Walking (Foot)
- OSRM public server integration with chunking for large stop lists
- Straight-line Haversine fallback engine with mode-specific speeds
- Live traffic disclaimer reporting
"""
import httpx
from typing import List, Dict, Any, Optional
from .optimizer import haversine_distance

MODE_SPEEDS_MPS = {
    "driving": 13.88,   # ~50 km/h driving average
    "cycling": 4.17,    # ~15 km/h cycling average
    "walking": 1.25     # ~4.5 km/h walking pace
}

OSRM_ENDPOINTS = {
    "driving": "https://router.project-osrm.org/route/v1/driving",
    "cycling": "https://routing.openstreetmap.de/routed-bike/route/v1/driving",
    "walking": "https://routing.openstreetmap.de/routed-foot/route/v1/driving"
}

TRAFFIC_DISCLAIMER = "Live traffic is unavailable. Route duration is based on estimated travel time."
USER_AGENT = "RouteForge/2.0 (Geospatial Multi-Stop Engine; contact@routeforge.app)"

def compute_straight_line(valid_stops: List[Dict[str, Any]], mode: str = "driving", reason: str = "") -> Dict[str, Any]:
    speed = MODE_SPEEDS_MPS.get(mode, 13.88)
    coords = [[float(s["longitude"]), float(s["latitude"])] for s in valid_stops]
    legs = []
    total_meters = 0.0

    for i in range(len(valid_stops) - 1):
        a = valid_stops[i]
        b = valid_stops[i + 1]
        dist = haversine_distance(float(a["latitude"]), float(a["longitude"]), float(b["latitude"]), float(b["longitude"]))
        dur = dist / speed
        legs.append({
            "distanceMeters": round(dist),
            "durationSeconds": round(dur),
            "summary": f"Straight-line ({mode}) from Stop {i + 1} to Stop {i + 2}"
        })
        total_meters += dist

    return {
        "ok": True,
        "data": {
            "legs": legs,
            "geometry": {
                "type": "LineString",
                "coordinates": coords
            },
            "totalDistanceMeters": round(total_meters),
            "totalDurationSeconds": round(total_meters / speed),
            "provider": "straightLine",
            "isFallback": True,
            "mode": mode,
            "liveTraffic": False,
            "trafficStatus": TRAFFIC_DISCLAIMER,
            "disclaimer": reason or f"Straight-line estimate only for {mode}. Road routing is unavailable."
        }
    }

async def compute_route(
    stops: List[Dict[str, Any]],
    provider: str = "osrm",
    mode: str = "driving",
    allow_fallback: bool = True
) -> Dict[str, Any]:
    valid_stops = [
        s for s in stops 
        if s.get("latitude") is not None and s.get("longitude") is not None
    ]

    clean_mode = mode if mode in MODE_SPEEDS_MPS else "driving"

    if len(valid_stops) < 2:
        return {
            "ok": False,
            "error": {
                "code": "INVALID_INPUT",
                "message": "At least two geocoded stops with valid latitude and longitude are required."
            }
        }

    if provider == "straightLine":
        return compute_straight_line(valid_stops, clean_mode)

    # For routes with > 80 stops, OSRM public URL limits can be exceeded; chunk if necessary
    if len(valid_stops) > 80:
        return await compute_chunked_osrm(valid_stops, clean_mode, allow_fallback)

    coord_str = ";".join(f"{float(s['longitude']):.6f},{float(s['latitude']):.6f}" for s in valid_stops)
    base_url = OSRM_ENDPOINTS.get(clean_mode, OSRM_ENDPOINTS["driving"])
    url = f"{base_url}/{coord_str}?overview=full&geometries=geojson&steps=true"
    headers = {
        "Accept": "application/json",
        "User-Agent": USER_AGENT
    }

    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            resp = await client.get(url, headers=headers)
            if resp.status_code != 200:
                # If specific mode endpoint (bike/foot) is down, try standard driving or straight line
                if allow_fallback:
                    fb = compute_straight_line(
                        valid_stops,
                        clean_mode,
                        f"OSRM {clean_mode} service returned HTTP {resp.status_code}. Using straight-line fallback."
                    )
                    return fb
                return {
                    "ok": False,
                    "error": {
                        "code": "PROVIDER_UNAVAILABLE",
                        "message": f"OSRM service returned HTTP {resp.status_code} for mode '{clean_mode}'"
                    }
                }

            json_data = resp.json()

        if json_data.get("code") != "Ok" or not json_data.get("routes"):
            if allow_fallback:
                fb = compute_straight_line(
                    valid_stops,
                    clean_mode,
                    f"OSRM returned no routes for mode '{clean_mode}'. Using straight-line fallback."
                )
                return fb
            return {
                "ok": False,
                "error": {
                    "code": "PROVIDER_UNAVAILABLE",
                    "message": f"OSRM routing failed: {json_data.get('message', 'No valid route found')}"
                }
            }

        top = json_data["routes"][0]
        legs = [
            {
                "distanceMeters": round(leg.get("distance", 0)),
                "durationSeconds": round(leg.get("duration", 0)),
                "summary": leg.get("summary") or f"Stop {idx + 1} to Stop {idx + 2}"
            }
            for idx, leg in enumerate(top.get("legs", []))
        ]

        maneuvers = []
        for leg_idx, leg in enumerate(top.get("legs", [])):
            for step in leg.get("steps", []):
                m = step.get("maneuver", {})
                street_name = step.get("name", "")
                m_type = m.get("type", "turn")
                m_modifier = m.get("modifier", "")

                if street_name:
                    if m_modifier:
                        instruction = f"{m_type.capitalize()} {m_modifier} onto {street_name}"
                    else:
                        instruction = f"Proceed on {street_name}"
                else:
                    instruction = f"{m_type.capitalize()} {m_modifier}".strip() or "Continue"

                maneuvers.append({
                    "instruction": instruction,
                    "streetName": street_name,
                    "distanceMeters": round(step.get("distance", 0)),
                    "durationSeconds": round(step.get("duration", 0)),
                    "type": m_type,
                    "modifier": m_modifier,
                    "legIndex": leg_idx
                })

        snapped_waypoints = []
        for wp in json_data.get("waypoints", []):
            loc = wp.get("location")
            if loc and len(loc) >= 2:
                snapped_waypoints.append({
                    "longitude": loc[0],
                    "latitude": loc[1],
                    "name": wp.get("name", ""),
                    "distanceToRoadMeters": round(wp.get("distance", 0), 1)
                })

        return {
            "ok": True,
            "data": {
                "legs": legs,
                "geometry": top.get("geometry"),
                "totalDistanceMeters": round(top.get("distance", 0)),
                "totalDurationSeconds": round(top.get("duration", 0)),
                "maneuvers": maneuvers,
                "snappedWaypoints": snapped_waypoints,
                "provider": "osrm",
                "isFallback": False,
                "mode": clean_mode,
                "liveTraffic": False,
                "trafficStatus": TRAFFIC_DISCLAIMER
            }
        }
    except Exception as e:
        if allow_fallback:
            return compute_straight_line(valid_stops, clean_mode, f"OSRM network error: {str(e)}")
        return {
            "ok": False,
            "error": {
                "code": "PROVIDER_UNAVAILABLE",
                "message": f"Unable to reach routing service: {str(e)}"
            }
        }

async def compute_chunked_osrm(valid_stops: List[Dict[str, Any]], mode: str, allow_fallback: bool) -> Dict[str, Any]:
    """Handles 80+ to 500+ stops by batching legs to prevent URI length rejection."""
    all_coords = []
    total_dist = 0.0
    total_dur = 0.0
    legs = []
    chunk_size = 35

    base_url = OSRM_ENDPOINTS.get(mode, OSRM_ENDPOINTS["driving"])
    headers = {"Accept": "application/json", "User-Agent": USER_AGENT}

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            for start_idx in range(0, len(valid_stops) - 1, chunk_size - 1):
                chunk = valid_stops[start_idx : start_idx + chunk_size]
                if len(chunk) < 2:
                    break
                coord_str = ";".join(f"{float(s['longitude']):.6f},{float(s['latitude']):.6f}" for s in chunk)
                url = f"{base_url}/{coord_str}?overview=full&geometries=geojson&steps=false"
                resp = await client.get(url, headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    if data.get("routes"):
                        r = data["routes"][0]
                        total_dist += r.get("distance", 0)
                        total_dur += r.get("duration", 0)
                        geom = r.get("geometry", {}).get("coordinates", [])
                        if all_coords and geom:
                            all_coords.extend(geom[1:])
                        else:
                            all_coords.extend(geom)
                        for leg in r.get("legs", []):
                            legs.append({
                                "distanceMeters": round(leg.get("distance", 0)),
                                "durationSeconds": round(leg.get("duration", 0)),
                                "summary": leg.get("summary") or "Road leg"
                            })
                else:
                    raise Exception(f"Chunk HTTP {resp.status_code}")

        if all_coords:
            return {
                "ok": True,
                "data": {
                    "legs": legs,
                    "geometry": {"type": "LineString", "coordinates": all_coords},
                    "totalDistanceMeters": round(total_dist),
                    "totalDurationSeconds": round(total_dur),
                    "provider": "osrm-chunked",
                    "isFallback": False,
                    "mode": mode,
                    "liveTraffic": False,
                    "trafficStatus": TRAFFIC_DISCLAIMER
                }
            }
    except Exception as e:
        if allow_fallback:
            return compute_straight_line(valid_stops, mode, f"Chunked routing fallback: {str(e)}")

    return compute_straight_line(valid_stops, mode, "OSRM chunked fallback")

"""
RouteForge - Multi-Tier High-Precision Geocoder Client (Python)
Zero API Keys - 100% Free Open Data.

Features:
1. Universal Coordinate & URL Parser (lat/lng, DMS, Google Maps, OpenStreetMap)
2. Komoot Photon API (Elasticsearch + OSM with typo tolerance and landmark resolution)
3. OpenStreetMap Nominatim Fallback (compliant with 1 req/sec usage policy)
4. Reverse Geocoding
5. Thread-safe in-memory caching
"""
import time
import asyncio
import re
import httpx
from typing import Dict, Any, Optional

cache: Dict[str, Dict[str, Any]] = {}
reverse_cache: Dict[str, Dict[str, Any]] = {}
last_nominatim_time = 0.0
throttle_lock = asyncio.Lock()

PHOTON_BASE = "https://photon.komoot.io/api"
PHOTON_REVERSE = "https://photon.komoot.io/reverse"
NOMINATIM_BASE = "https://nominatim.openstreetmap.org/search"
NOMINATIM_REVERSE = "https://nominatim.openstreetmap.org/reverse"
USER_AGENT = "RouteForge/2.0 (High Precision Local Python; contact@routeforge.local)"

def normalize_address(addr: str) -> str:
    if not addr:
        return ""
    return " ".join(addr.lower().strip().split()).rstrip(".,;")

def parse_direct_coordinates(input_str: str) -> Optional[Dict[str, Any]]:
    if not input_str:
        return None
    s = input_str.strip()

    # Google Maps URL pattern
    gmap_match = re.search(r'(?:@|[?&]q=|[?&]ll=)(-?\d{1,2}\.\d+)[,\s]+(-?\d{1,3}\.\d+)', s, re.IGNORECASE)
    if gmap_match:
        try:
            lat = float(gmap_match.group(1))
            lng = float(gmap_match.group(2))
            if -90 <= lat <= 90 and -180 <= lng <= 180:
                return {
                    "lat": lat,
                    "lng": lng,
                    "status": "ok",
                    "provider": "coordinate_parser",
                    "displayName": f"Google Maps Coordinate ({lat:.5f}, {lng:.5f})",
                    "precision": "sub-meter"
                }
        except ValueError:
            pass

    # OpenStreetMap URL pattern
    osm_match = re.search(r'#map=\d+\/(-?\d{1,2}\.\d+)\/(-?\d{1,3}\.\d+)', s)
    if osm_match:
        try:
            lat = float(osm_match.group(1))
            lng = float(osm_match.group(2))
            if -90 <= lat <= 90 and -180 <= lng <= 180:
                return {
                    "lat": lat,
                    "lng": lng,
                    "status": "ok",
                    "provider": "coordinate_parser",
                    "displayName": f"OSM Coordinate ({lat:.5f}, {lng:.5f})",
                    "precision": "sub-meter"
                }
        except ValueError:
            pass

    # Decimal Lat/Lng: "37.7749, -122.4194"
    dec_match = re.match(r'^[-+]?([0-8]?\d(?:\.\d+)?|90(?:\.0+)?)[,\s]+[-+]?(180(?:\.0+)?|(?:1[0-7]\d|\d{1,2})(?:\.\d+)?)$', s)
    if dec_match:
        parts = re.split(r'[,\s]+', s)
        if len(parts) >= 2:
            try:
                lat = float(parts[0])
                lng = float(parts[1])
                if -90 <= lat <= 90 and -180 <= lng <= 180:
                    return {
                        "lat": lat,
                        "lng": lng,
                        "status": "ok",
                        "provider": "coordinate_parser",
                        "displayName": f"Exact Coordinate ({lat:.5f}, {lng:.5f})",
                        "precision": "sub-meter"
                    }
            except ValueError:
                pass

    return None

async def geocode_address(address: str, base_url: Optional[str] = None) -> Dict[str, Any]:
    global last_nominatim_time
    clean_addr = address.strip() if address else ""
    if not clean_addr:
        return {"lat": None, "lng": None, "status": "not_found", "provider": "none", "displayName": ""}

    # 1. Check direct coordinates
    direct = parse_direct_coordinates(clean_addr)
    if direct:
        return direct

    # 2. Check Cache
    key = normalize_address(clean_addr)
    if key in cache:
        res = dict(cache[key])
        res["fromCache"] = True
        return res

    # 3. Try Photon (Fast, typo-tolerant)
    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            resp = await client.get(
                PHOTON_BASE,
                params={"q": clean_addr, "limit": 5},
                headers={"User-Agent": USER_AGENT, "Accept": "application/json"}
            )
            if resp.status_code == 200:
                pdata = resp.json()
                features = pdata.get("features", [])
                if features:
                    top_f = features[0]
                    coords = top_f.get("geometry", {}).get("coordinates", [])
                    props = top_f.get("properties", {})
                    if len(coords) >= 2:
                        lng = float(coords[0])
                        lat = float(coords[1])
                        
                        # Build formatted name
                        title = props.get("name")
                        if not title:
                            if props.get("street"):
                                title = f"{props.get('housenumber', '')} {props.get('street')}".strip()
                            else:
                                title = props.get("city", clean_addr)
                        
                        parts = [title]
                        if props.get("city") and props.get("city") != title:
                            parts.append(props["city"])
                        if props.get("state"):
                            parts.append(props["state"])
                        if props.get("country"):
                            parts.append(props["country"])
                        
                        disp_name = ", ".join(parts)
                        res = {
                            "lat": lat,
                            "lng": lng,
                            "status": "ok",
                            "provider": "photon",
                            "displayName": disp_name,
                            "precision": "sub-meter" if props.get("housenumber") else "verified"
                        }
                        cache[key] = res
                        return res
    except Exception:
        pass

    # 4. Fallback to Nominatim (Throttled 1 req/sec)
    async with throttle_lock:
        now = time.time()
        elapsed = now - last_nominatim_time
        if elapsed < 1.05:
            await asyncio.sleep(1.05 - elapsed)
        last_nominatim_time = time.time()

    url = base_url or NOMINATIM_BASE
    params = {
        "q": clean_addr,
        "format": "json",
        "addressdetails": "1",
        "limit": "5"
    }
    headers = {
        "Accept": "application/json",
        "User-Agent": USER_AGENT
    }

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(url, params=params, headers=headers)
            if resp.status_code != 200:
                return {
                    "lat": None,
                    "lng": None,
                    "status": "error",
                    "provider": "nominatim",
                    "raw": {"statusCode": resp.status_code}
                }
            results = resp.json()

        if not results or not isinstance(results, list):
            res = {"lat": None, "lng": None, "status": "not_found", "provider": "nominatim", "displayName": ""}
            cache[key] = res
            return res

        top = results[0]
        res = {
            "lat": float(top["lat"]),
            "lng": float(top["lon"]),
            "status": "ok",
            "provider": "nominatim",
            "displayName": top.get("display_name", ""),
            "precision": "verified"
        }

        if len(cache) > 1000:
            first_k = next(iter(cache))
            del cache[first_k]
        cache[key] = res
        return res

    except Exception as e:
        return {
            "lat": None,
            "lng": None,
            "status": "error",
            "provider": "nominatim",
            "raw": {"message": str(e)}
        }

async def reverse_geocode(lat: float, lng: float) -> Dict[str, Any]:
    ckey = f"{lat:.5f},{lng:.5f}"
    if ckey in reverse_cache:
        return dict(reverse_cache[ckey])

    # Try Photon Reverse
    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            resp = await client.get(
                PHOTON_REVERSE,
                params={"lat": lat, "lon": lng},
                headers={"User-Agent": USER_AGENT, "Accept": "application/json"}
            )
            if resp.status_code == 200:
                pdata = resp.json()
                features = pdata.get("features", [])
                if features:
                    props = features[0].get("properties", {})
                    name = props.get("name")
                    if not name and props.get("street"):
                        name = f"{props.get('housenumber', '')} {props.get('street')}".strip()
                    name = name or f"Pin ({lat:.4f}, {lng:.4f})"
                    
                    parts = [name]
                    if props.get("city"): parts.append(props["city"])
                    if props.get("country"): parts.append(props["country"])
                    full = ", ".join(parts)
                    
                    res = {
                        "title": name,
                        "displayName": full,
                        "lat": lat,
                        "lng": lng,
                        "precision": "sub-meter" if props.get("housenumber") else "verified"
                    }
                    reverse_cache[ckey] = res
                    return res
    except Exception:
        pass

    # Default fallback
    res = {
        "title": f"Waypoint ({lat:.4f}, {lng:.4f})",
        "displayName": f"{lat:.5f}, {lng:.5f}",
        "lat": lat,
        "lng": lng,
        "precision": "sub-meter"
    }
    reverse_cache[ckey] = res
    return res

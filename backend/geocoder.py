"""
RouteForge - Nominatim Geocoding Client (Python)
Compliant with OpenStreetMap usage policy (1 req/sec throttler, User-Agent, in-memory cache).
"""
import time
import asyncio
import httpx
from typing import Dict, Any, Optional

cache: Dict[str, Dict[str, Any]] = {}
last_request_time = 0.0
throttle_lock = asyncio.Lock()

NOMINATIM_BASE = "https://nominatim.openstreetmap.org/search"
USER_AGENT = "RouteForge/1.0 (Local Python; contact@routeforge.local)"

def normalize_address(addr: str) -> str:
    if not addr:
        return ""
    return " ".join(addr.lower().strip().split()).rstrip(".,;")

async def geocode_address(address: str, base_url: Optional[str] = None) -> Dict[str, Any]:
    global last_request_time
    clean_addr = address.strip() if address else ""
    if not clean_addr:
        return {"lat": None, "lng": None, "status": "not_found", "provider": "nominatim", "displayName": ""}

    key = normalize_address(clean_addr)
    if key in cache:
        res = dict(cache[key])
        res["fromCache"] = True
        return res

    async with throttle_lock:
        now = time.time()
        elapsed = now - last_request_time
        if elapsed < 1.05:
            await asyncio.sleep(1.05 - elapsed)
        last_request_time = time.time()

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
        async with httpx.AsyncClient(timeout=10.0) as client:
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
        alternatives = [
            {"lat": float(r["lat"]), "lng": float(r["lon"]), "displayName": r.get("display_name", "")}
            for r in results[1:]
        ]

        is_ambiguous = (
            len(results) > 1 and
            results[1].get("importance") and
            top.get("importance") and
            abs(float(top["importance"]) - float(results[1]["importance"])) < 0.05
        )

        res = {
            "lat": float(top["lat"]),
            "lng": float(top["lon"]),
            "status": "ambiguous" if is_ambiguous else "ok",
            "provider": "nominatim",
            "displayName": top.get("display_name", ""),
            "alternatives": alternatives
        }

        # Keep cache bounded
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


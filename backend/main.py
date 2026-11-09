"""
RouteForge - FastAPI Application Entry Point
Exposes local REST API endpoints matching the original specification byte-for-byte
and serves the complete frontend application.
"""
import os
import re
from pathlib import Path
from typing import Dict, Any, Optional, List
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from . import database
from . import optimizer
from . import geocoder
from . import router
from . import csv_handler
from . import sheets_importer

app = FastAPI(title="RouteForge Local API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

FRONTEND_DIR = Path(__file__).parent.parent / "frontend"

@app.on_event("startup")
def on_startup():
    database.init_db()
    try:
        pid_file = Path(__file__).parent.parent / "database" / "routeforge.pid"
        pid_file.write_text(str(os.getpid()))
    except Exception:
        pass

@app.on_event("shutdown")
def on_shutdown():
    try:
        pid_file = Path(__file__).parent.parent / "database" / "routeforge.pid"
        if pid_file.exists():
            pid_file.unlink()
    except Exception:
        pass

# Models
class CreateRouteRequest(BaseModel):
    title: Optional[str] = "Untitled Route"
    settings: Optional[Dict[str, Any]] = None
    ownerIdentifier: Optional[str] = None

class GetRouteRequest(BaseModel):
    routeId: str

class UpdateRouteRequest(BaseModel):
    routeId: str
    expectedRevision: Optional[int] = None
    changes: Dict[str, Any]

class AddStopRequest(BaseModel):
    routeId: str
    expectedRevision: Optional[int] = None
    stop: Dict[str, Any]

class RemoveStopRequest(BaseModel):
    routeId: str
    expectedRevision: Optional[int] = None
    stopId: str

class ReorderStopsRequest(BaseModel):
    routeId: str
    expectedRevision: Optional[int] = None
    sequence: List[str]

class UpdateStopRequest(BaseModel):
    routeId: str
    expectedRevision: Optional[int] = None
    stopId: str
    changes: Dict[str, Any]

class CalculateRouteRequest(BaseModel):
    routeId: str
    provider: Optional[str] = "osrm"
    mode: Optional[str] = "driving"
    allowFallback: Optional[bool] = True

class OptimizeRouteRequest(BaseModel):
    routeId: str
    expectedRevision: Optional[int] = None
    options: Optional[Dict[str, Any]] = None
    stops: Optional[List[Dict[str, Any]]] = None

class ExportRouteRequest(BaseModel):
    routeId: str
    format: Optional[str] = "csv"

class GeocodeRequest(BaseModel):
    address: str

class ReverseGeocodeRequest(BaseModel):
    lat: float
    lng: float

class ImportSheetsRequest(BaseModel):
    spreadsheetId: str

class ParseCsvRequest(BaseModel):
    csvText: str

# API Endpoints
@app.get("/api/health")
def api_health():
    return {
        "ok": True,
        "status": "healthy",
        "service": "RouteForge Backend",
        "version": "2.1.0",
        "capabilities": {
            "optimizer": "ortools+2opt",
            "routing": ["driving", "cycling", "walking", "straightLine"],
            "geocoder": "nominatim-throttled",
            "storage": "sqlite3"
        }
    }

@app.post("/api/initializeApp")
def api_initialize_app():
    database.init_db()
    return {"ok": True, "data": {"initialized": True}}

@app.post("/api/createRoute")
def api_create_route(req: Optional[CreateRouteRequest] = None):
    req = req or CreateRouteRequest()
    try:
        res = database.create_route(title=req.title, settings=req.settings, owner_identifier=req.ownerIdentifier)
        return {"ok": True, "data": res, "revision": res["revision"]}
    except Exception as e:
        return JSONResponse(status_code=500, content={"ok": False, "error": {"code": "STORAGE_ERROR", "message": str(e)}})

@app.api_route("/api/getRoute", methods=["GET", "POST"])
async def api_get_route(req: Request, routeId: Optional[str] = None):
    r_id = routeId or req.query_params.get("routeId")
    if not r_id and req.method == "POST":
        try:
            body = await req.json()
            r_id = body.get("routeId")
        except Exception:
            pass

    if not r_id:
        return JSONResponse(status_code=400, content={"ok": False, "error": {"code": "INVALID_INPUT", "message": "routeId is required"}})

    try:
        data = database.get_route(r_id)
        return {"ok": True, "data": data, "revision": data["route"]["revision"]}
    except database.NotFoundException as e:
        return JSONResponse(status_code=404, content={"ok": False, "error": {"code": "NOT_FOUND", "message": str(e)}})
    except Exception as e:
        return JSONResponse(status_code=500, content={"ok": False, "error": {"code": "STORAGE_ERROR", "message": str(e)}})

@app.post("/api/getRouteJson")
def api_get_route_json(req: GetRouteRequest):
    try:
        data = database.get_route(req.routeId)
        return {"ok": True, "data": data, "revision": data["route"]["revision"]}
    except database.NotFoundException as e:
        return JSONResponse(status_code=404, content={"ok": False, "error": {"code": "NOT_FOUND", "message": str(e)}})
    except Exception as e:
        return JSONResponse(status_code=500, content={"ok": False, "error": {"code": "STORAGE_ERROR", "message": str(e)}})

@app.api_route("/api/getRouteRevision", methods=["GET", "POST"])
async def api_get_route_revision(req: Request, routeId: Optional[str] = None):
    r_id = routeId or req.query_params.get("routeId")
    if not r_id and req.method == "POST":
        try:
            body = await req.json()
            r_id = body.get("routeId")
        except Exception:
            pass

    if not r_id:
        return JSONResponse(status_code=400, content={"ok": False, "error": {"code": "INVALID_INPUT", "message": "routeId is required"}})
    try:
        data = database.get_route_revision(r_id)
        return {"ok": True, "data": data, "revision": data["revision"]}
    except database.NotFoundException as e:
        return JSONResponse(status_code=404, content={"ok": False, "error": {"code": "NOT_FOUND", "message": str(e)}})
    except Exception as e:
        return JSONResponse(status_code=500, content={"ok": False, "error": {"code": "STORAGE_ERROR", "message": str(e)}})

@app.post("/api/updateRoute")
def api_update_route(req: UpdateRouteRequest):
    try:
        res = database.update_route(req.routeId, req.expectedRevision, req.changes)
        return {"ok": True, "data": res["route"], "revision": res["revision"]}
    except database.RevisionConflictException as e:
        return JSONResponse(status_code=409, content={"ok": False, "error": {"code": e.code, "message": str(e)}})
    except database.NotFoundException as e:
        return JSONResponse(status_code=404, content={"ok": False, "error": {"code": "NOT_FOUND", "message": str(e)}})
    except Exception as e:
        return JSONResponse(status_code=500, content={"ok": False, "error": {"code": "STORAGE_ERROR", "message": str(e)}})

@app.post("/api/addStop")
async def api_add_stop(req: AddStopRequest):
    stop_data = dict(req.stop)
    # Automatic geocoding if coordinates not provided
    if (stop_data.get("latitude") is None or stop_data.get("longitude") is None) and stop_data.get("address"):
        geo = await geocoder.geocode_address(stop_data["address"])
        stop_data["latitude"] = geo["lat"]
        stop_data["longitude"] = geo["lng"]
        meta = stop_data.get("metadata") or {}
        meta["geocodeStatus"] = geo["status"]
        meta["displayName"] = geo.get("displayName", "")
        stop_data["metadata"] = meta

    try:
        res = database.add_stop(req.routeId, req.expectedRevision, stop_data)
        return {"ok": True, "data": res["stop"], "revision": res["revision"]}
    except database.RevisionConflictException as e:
        return JSONResponse(status_code=409, content={"ok": False, "error": {"code": e.code, "message": str(e)}})
    except database.NotFoundException as e:
        return JSONResponse(status_code=404, content={"ok": False, "error": {"code": "NOT_FOUND", "message": str(e)}})
    except Exception as e:
        return JSONResponse(status_code=500, content={"ok": False, "error": {"code": "STORAGE_ERROR", "message": str(e)}})

@app.post("/api/removeStop")
def api_remove_stop(req: RemoveStopRequest):
    try:
        res = database.remove_stop(req.routeId, req.expectedRevision, req.stopId)
        return {"ok": True, "data": res, "revision": res["revision"]}
    except database.RevisionConflictException as e:
        return JSONResponse(status_code=409, content={"ok": False, "error": {"code": e.code, "message": str(e)}})
    except database.NotFoundException as e:
        return JSONResponse(status_code=404, content={"ok": False, "error": {"code": "NOT_FOUND", "message": str(e)}})
    except Exception as e:
        return JSONResponse(status_code=500, content={"ok": False, "error": {"code": "STORAGE_ERROR", "message": str(e)}})

@app.post("/api/reorderStops")
def api_reorder_stops(req: ReorderStopsRequest):
    try:
        res = database.reorder_stops(req.routeId, req.expectedRevision, req.sequence)
        return {"ok": True, "data": res["stops"], "revision": res["revision"]}
    except database.RevisionConflictException as e:
        return JSONResponse(status_code=409, content={"ok": False, "error": {"code": e.code, "message": str(e)}})
    except database.NotFoundException as e:
        return JSONResponse(status_code=404, content={"ok": False, "error": {"code": "NOT_FOUND", "message": str(e)}})
    except Exception as e:
        return JSONResponse(status_code=500, content={"ok": False, "error": {"code": "STORAGE_ERROR", "message": str(e)}})

@app.post("/api/updateStop")
def api_update_stop(req: UpdateStopRequest):
    try:
        res = database.update_stop(req.routeId, req.expectedRevision, req.stopId, req.changes)
        return {"ok": True, "data": res["stop"], "revision": res["revision"]}
    except database.RevisionConflictException as e:
        return JSONResponse(status_code=409, content={"ok": False, "error": {"code": e.code, "message": str(e)}})
    except database.NotFoundException as e:
        return JSONResponse(status_code=404, content={"ok": False, "error": {"code": "NOT_FOUND", "message": str(e)}})
    except Exception as e:
        return JSONResponse(status_code=500, content={"ok": False, "error": {"code": "STORAGE_ERROR", "message": str(e)}})

@app.post("/api/calculateRoute")
async def api_calculate_route(req: CalculateRouteRequest):
    try:
        route_data = database.get_route(req.routeId)
        res = await router.compute_route(
            route_data["stops"],
            provider=req.provider or "osrm",
            mode=req.mode or "driving",
            allow_fallback=req.allowFallback
        )
        if not res.get("ok"):
            return JSONResponse(status_code=502, content=res)
        return res
    except database.NotFoundException as e:
        return JSONResponse(status_code=404, content={"ok": False, "error": {"code": "NOT_FOUND", "message": str(e)}})
    except Exception as e:
        return JSONResponse(status_code=500, content={"ok": False, "error": {"code": "STORAGE_ERROR", "message": str(e)}})

@app.post("/api/optimizeRoute")
def api_optimize_route(req: OptimizeRouteRequest):
    try:
        route_data = database.get_route(req.routeId)
        target_stops = req.stops if (req.stops and len(req.stops) >= 2) else route_data["stops"]
        opt_res = optimizer.optimize_stops(target_stops, options=req.options)
        new_seq = [s["stopId"] for s in opt_res["stops"]]

        # Persist reordered sequence
        upd = database.reorder_stops(req.routeId, route_data["route"]["revision"], new_seq)

        return {
            "ok": True,
            "data": {
                "originalDistanceMeters": opt_res["originalDistanceMeters"],
                "optimizedDistanceMeters": opt_res["optimizedDistanceMeters"],
                "savingsMeters": opt_res["savingsMeters"],
                "savingsPercent": opt_res["savingsPercent"],
                "method": opt_res.get("method", "2-Opt Local Search"),
                "isGloballyOptimal": opt_res.get("isGloballyOptimal", False),
                "isAlreadyOptimal": opt_res.get("isAlreadyOptimal", False),
                "analytics": opt_res.get("analytics"),
                "beforeAfter": opt_res.get("beforeAfter"),
                "stops": upd["stops"]
            },
            "revision": upd["revision"]
        }
    except database.NotFoundException as e:
        return JSONResponse(status_code=404, content={"ok": False, "error": {"code": "NOT_FOUND", "message": str(e)}})
    except Exception as e:
        return JSONResponse(status_code=500, content={"ok": False, "error": {"code": "STORAGE_ERROR", "message": str(e)}})

@app.post("/api/exportRoute")
def api_export_route(req: ExportRouteRequest):
    try:
        route_data = database.get_route(req.routeId)
        title = route_data["route"].get("title") or "Route"
        clean_title = re.sub(r"[^a-zA-Z0-9_\-]+", "_", title)

        if (req.format or "").lower() == "json":
            import json
            return {
                "ok": True,
                "data": {
                    "filename": f"{clean_title}.json",
                    "mimeType": "application/json",
                    "content": json.dumps(route_data, indent=2)
                }
            }

        csv_str = csv_handler.export_stops_csv(route_data["stops"], title)
        filename = f"{clean_title}-stops.csv"
        return {
            "ok": True,
            "data": {
                "filename": filename,
                "mimeType": "text/csv",
                "content": csv_str
            }
        }
    except database.NotFoundException as e:
        return JSONResponse(status_code=404, content={"ok": False, "error": {"code": "NOT_FOUND", "message": str(e)}})
    except Exception as e:
        return JSONResponse(status_code=500, content={"ok": False, "error": {"code": "STORAGE_ERROR", "message": str(e)}})

@app.post("/api/geocode")
async def api_geocode(req: GeocodeRequest):
    res = await geocoder.geocode_address(req.address)
    return {"ok": True, "data": res}

@app.post("/api/reverseGeocode")
async def api_reverse_geocode(req: ReverseGeocodeRequest):
    res = await geocoder.reverse_geocode(req.lat, req.lng)
    return {"ok": True, "data": res}

@app.post("/api/importGoogleSheets")
async def api_import_sheets(req: ImportSheetsRequest):
    res = await sheets_importer.import_from_published_sheets(req.spreadsheetId)
    return res

@app.post("/api/parseCsv")
def api_parse_csv(req: ParseCsvRequest):
    ok, stops, warnings, err = csv_handler.parse_csv_stops(req.csvText)
    if not ok:
        return JSONResponse(status_code=400, content={"ok": False, "error": err, "warnings": warnings})
    return {"ok": True, "data": {"stops": stops, "warnings": warnings}}

@app.get("/api/listRoutes")
def api_list_routes():
    routes = database.list_routes()
    return {"ok": True, "data": routes}

@app.post("/api/deleteRoute")
def api_delete_route(req: GetRouteRequest):
    success = database.delete_route(req.routeId)
    return {"ok": True, "data": {"deleted": success}}

# Frontend Static Files (Supports compiled React bundle with MapLibre worker and SPA routing)
DIST_DIR = Path(__file__).parent.parent / "local" / "client" / "dist"
MAPLIBRE_NODE_WORKER = Path(__file__).parent.parent / "local" / "client" / "node_modules" / "maplibre-gl" / "dist" / "maplibre-gl-worker.mjs"

@app.get("/assets/maplibre-gl-worker.mjs")
def serve_maplibre_worker():
    dist_worker = DIST_DIR / "assets" / "maplibre-gl-worker.mjs"
    if dist_worker.exists():
        return FileResponse(str(dist_worker), media_type="application/javascript")
    if MAPLIBRE_NODE_WORKER.exists():
        return FileResponse(str(MAPLIBRE_NODE_WORKER), media_type="application/javascript")
    raise HTTPException(status_code=404, detail="MapLibre worker not found")

if FRONTEND_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")

if DIST_DIR.exists() and (DIST_DIR / "index.html").exists():
    if (DIST_DIR / "assets").exists():
        app.mount("/assets", StaticFiles(directory=str(DIST_DIR / "assets")), name="assets")

    @app.get("/")
    def serve_dist_index():
        return FileResponse(str(DIST_DIR / "index.html"))

    @app.get("/route/{route_id}")
    def serve_dist_route(route_id: str):
        return FileResponse(str(DIST_DIR / "index.html"))

    @app.get("/{file_name:path}")
    def serve_dist_file(file_name: str):
        target = DIST_DIR / file_name
        if target.is_file():
            return FileResponse(str(target))
        return FileResponse(str(DIST_DIR / "index.html"))

elif FRONTEND_DIR.exists():
    @app.get("/")
    def serve_index():
        return FileResponse(str(FRONTEND_DIR / "index.html"))

    @app.get("/route/{route_id}")
    def serve_route(route_id: str):
        return FileResponse(str(FRONTEND_DIR / "index.html"))
        return FileResponse(str(FRONTEND_DIR / "index.html"))

    @app.get("/route/{route_id}")
    def serve_route(route_id: str):
        return FileResponse(str(FRONTEND_DIR / "index.html"))

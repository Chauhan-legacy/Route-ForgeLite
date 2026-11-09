"""
RouteForge - Google Sheets Migration Helper
Enables optional migration of routes and stops from an existing Google Sheet or exported CSVs.
"""
import httpx
from typing import Dict, Any, List
from .database import create_route, add_stop

async def import_from_published_sheets(spreadsheet_id: str) -> Dict[str, Any]:
    """
    Attempts to fetch published CSV data for Routes and Stops from a Google Sheet.
    """
    base_url = f"https://docs.google.com/spreadsheets/d/{spreadsheet_id}/gviz/tq?tqx=out:csv"
    routes_url = f"{base_url}&sheet=Routes"
    stops_url = f"{base_url}&sheet=Stops"

    imported_routes = 0
    imported_stops = 0

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp_routes = await client.get(routes_url)
            resp_stops = await client.get(stops_url)

        if resp_routes.status_code == 200:
            lines = resp_routes.text.splitlines()
            for line in lines[1:]:
                parts = [p.strip(' "') for p in line.split(",")]
                if len(parts) >= 2 and parts[0]:
                    r = create_route(title=parts[1])
                    imported_routes += 1

        return {
            "ok": True,
            "importedRoutes": imported_routes,
            "message": f"Successfully checked spreadsheet {spreadsheet_id}."
        }
    except Exception as e:
        return {
            "ok": False,
            "error": str(e),
            "message": "Direct Google Sheet public fetch requires the sheet to be published to web. Use CSV import instead."
        }


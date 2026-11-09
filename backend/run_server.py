"""
RouteForge - Python Server Runner
Launches the FastAPI backend on http://127.0.0.1:8000 with Uvicorn.
"""
import sys
import webbrowser
from pathlib import Path

# Add project root to sys.path
root_dir = Path(__file__).parent.parent.resolve()
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

import uvicorn
from backend.database import init_db

if __name__ == "__main__":
    print("=" * 55)
    print("RouteForge - High Precision Route Optimizer Server")
    print("=" * 55)
    print("Initializing SQLite database...")
    init_db()
    print("Database ready: database/routeforge.db")
    print("Serving at: http://127.0.0.1:8000")
    print("Press Ctrl+C to stop.")
    print("=" * 55)
    
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=False)


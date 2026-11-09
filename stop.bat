@echo off
setlocal
cd /d "%~dp0"

echo ===================================================
echo RouteForge - Stopping Local Server
echo ===================================================

if exist "venv\Scripts\python.exe" (
    "venv\Scripts\python.exe" backend\stop_server.py
    goto :done
)

python backend\stop_server.py 2>nul
if not errorlevel 1 goto :done

if exist "database\routeforge.pid" (
    set /p RF_PID=<"database\routeforge.pid"
    if defined RF_PID (
        taskkill /PID %RF_PID% /F /T >nul 2>&1
        del "database\routeforge.pid" >nul 2>&1
        echo [OK] Stopped RouteForge server.
    )
)

:done
echo ===================================================
echo RouteForge stop procedure finished.
echo ===================================================

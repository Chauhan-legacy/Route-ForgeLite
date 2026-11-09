@echo off
setlocal
cd /d "%~dp0"

echo ===================================================
echo RouteForge - Local Python and FastAPI Launcher
echo ===================================================

:: 1. Verify Python availability
python --version >nul 2>&1
if errorlevel 1 goto :no_python

:: 2. Check virtual environment
if exist "venv\Scripts\python.exe" goto :venv_ready

echo [INFO] Creating Python virtual environment in .\venv ...
python -m venv venv
if errorlevel 1 goto :venv_failed

:venv_ready
set "VENV_PYTHON=%~dp0venv\Scripts\python.exe"

:: 3. Check and install dependencies inside venv
echo [INFO] Verifying dependencies in virtual environment...
"%VENV_PYTHON%" -c "import fastapi, uvicorn, httpx, pydantic, multipart, ortools" >nul 2>&1
if not errorlevel 1 goto :deps_ready

echo [INFO] Installing packages from requirements.txt...
"%VENV_PYTHON%" -m pip install -r requirements.txt
if errorlevel 1 goto :pip_failed

:deps_ready
echo [OK] Virtual environment dependencies verified.

:: 3b. Verify React client build
if not exist "local\client\dist\index.html" (
    echo [INFO] Compiling client frontend with Vite...
    cmd /c "npm --prefix local\client run build"
)

:: 4. Stop any existing RouteForge server instance on port 8000
echo [INFO] Checking for existing RouteForge process...
"%VENV_PYTHON%" backend\stop_server.py >nul 2>&1

:: 5. Initialize/Verify SQLite Database (preserves existing data)
echo [INFO] Verifying SQLite database...
"%VENV_PYTHON%" -c "import backend.database as db; db.init_db()"
if errorlevel 1 goto :db_failed
echo [OK] Database ready: database\routeforge.db

:: 6. Launch browser
echo ===================================================
echo RouteForge is starting at:
echo   Local:   http://127.0.0.1:8000
echo   Network: http://0.0.0.0:8000
echo ===================================================
echo Opening RouteForge in browser...
start "" "http://127.0.0.1:8000"

:: 7. Start Uvicorn server using venv Python
"%VENV_PYTHON%" -m uvicorn backend.main:app --host 0.0.0.0 --port 8000
goto :eof

:no_python
echo [ERROR] Python 3 was not found in your system PATH.
echo Please install Python 3.10 or higher from https://www.python.org/
pause
exit /b 1

:venv_failed
echo [ERROR] Failed to create virtual environment in .\venv.
pause
exit /b 1

:pip_failed
echo [ERROR] Failed to install dependencies from requirements.txt.
pause
exit /b 1

:db_failed
echo [ERROR] Database initialization failed.
pause
exit /b 1

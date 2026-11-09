@echo off
echo ===================================================
echo Freeing ports 3001, 5173, and 5174...
echo ===================================================
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 3001, 5173, 5174 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }" >nul 2>&1

echo ===================================================
echo Starting RouteForge Local Stack (Express + React)
echo ===================================================
echo Backend API:  http://localhost:3001
echo Frontend App: http://localhost:5173
echo ===================================================

cd /d "%~dp0"
start http://localhost:5173
npm run dev

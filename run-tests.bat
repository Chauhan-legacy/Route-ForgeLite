@echo off
echo ===================================================
echo Running RouteForge Automated Test Suite
echo ===================================================

cd /d "%~dp0"
call npm test

echo.
pause


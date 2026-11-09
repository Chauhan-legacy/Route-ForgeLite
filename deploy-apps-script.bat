@echo off
echo ===================================================
echo RouteForge - Google Apps Script Deployment Helper
echo ===================================================
echo Using Spreadsheet ID: 1zzGu4PLQjgYvVpnrMgUY78DCzMbnCsiOYbYBzYBitXs
echo ===================================================
echo.
echo IMPORTANT: Make sure Google Apps Script API is ON:
echo https://script.google.com/home/usersettings
echo ===================================================
echo.

cd /d "%~dp0\apps-script"

echo Step 1: Checking clasp login status...
call clasp login --status 2>nul
if errorlevel 1 (
  echo Please authenticate with your Google account in the browser:
  call clasp login
)

echo.
echo Step 2: Creating or pushing project...
if not exist ".clasp.json" (
  call clasp create --type webapp --title "RouteForge"
)
call clasp push

echo.
echo Step 3: Opening Apps Script Editor in your browser...
call clasp open-script 2>nul
if errorlevel 1 (
  call clasp open 2>nul
)

echo.
echo ===================================================
echo NEXT STEPS IN THE APPS SCRIPT EDITOR:
echo 1. Select 'initializeApp' in the function dropdown and click Run.
echo 2. Click Deploy ^> New deployment ^> Web app.
echo 3. Set 'Execute as: Me' and 'Who has access: Anyone'.
echo ===================================================
pause

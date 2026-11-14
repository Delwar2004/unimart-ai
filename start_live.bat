@echo off
echo ========================================================
echo        UniMart AI - Starting Unified Live Server
echo ========================================================
echo.

cd /d "%~dp0"

echo [1/3] Checking Frontend Build...
if not exist "frontend\dist\index.html" (
    echo Building frontend...
    cd frontend && npm run build && cd ..
) else (
    echo Frontend build found.
)

echo.
echo [2/3] Starting Unified Backend Server on port 5000...
start "UniMart Backend" cmd /k "cd backend && npm start"

echo.
echo [3/3] Creating Live Public Tunnel...
echo Anyone in the world can access the live link displayed below:
echo --------------------------------------------------------
if exist "cloudflared.exe" (
    "cloudflared.exe" tunnel --url http://127.0.0.1:5000
) else if exist "..\cloudflared.exe" (
    "..\cloudflared.exe" tunnel --url http://127.0.0.1:5000
) else (
    ssh -o StrictHostKeyChecking=no -R 80:127.0.0.1:5000 nokey@localhost.run
)

pause

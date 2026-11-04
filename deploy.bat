@echo off
setlocal

cd /d "%~dp0"

echo Building frontend...
cd frontend
call npm run build
if errorlevel 1 (
    echo Frontend build failed.
    pause
    exit /b 1
)
cd ..

echo Starting backend (serves frontend + API) on port 8000...
start "SPA Backend" cmd /k "cd /d %~dp0backend && python -m uvicorn app:app --host 0.0.0.0 --port 8000"

echo Waiting for backend to start...
timeout /t 5 /nobreak >nul

echo Starting Cloudflare tunnel...
start "Cloudflare Tunnel - copy the trycloudflare.com URL" cmd /k "cloudflared tunnel --url http://127.0.0.1:8000"

echo.
echo Backend local:  http://127.0.0.1:8000
echo Cloudflare URL: see the "Cloudflare Tunnel" window
echo.
pause
@echo off
REM Run both backend and frontend servers
echo Starting backend server...
start "Backend" cmd /k "cd /d %~dp0backend && python -m uvicorn app:app --host 127.0.0.1 --port 8000"

echo Starting frontend server...
start "Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo Both servers are starting...
echo Backend: http://127.0.0.1:8000
echo Frontend: http://127.0.0.1:5173
pause
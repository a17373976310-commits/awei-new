@echo off
echo Starting Website Services...

:: Start Backend
echo Starting Backend (FastAPI)...
start "Website Backend" cmd /k "cd /d %~dp0backend && C:\Python314\python.exe main.py --port 8081"

:: Wait a moment for backend to initialize
timeout /t 3 /nobreak > nul

:: Start Frontend
echo Starting Frontend (Vite)...
start "Website Frontend" cmd /k "cd /d %~dp0 && npm run dev"

:: Wait for frontend to start
timeout /t 5 /nobreak > nul

:: Open Browser
echo Opening Browser...
start http://localhost:5173

echo.
echo All services are starting in separate windows.
echo Please keep those windows open while using the website.
pause

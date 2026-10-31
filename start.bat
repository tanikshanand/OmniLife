@echo off
title OmniLife Digital Twin Launcher
echo ===================================================
echo       OmniLife Digital Twin - Local Launcher
echo ===================================================
echo.

echo [1/3] Checking Ollama status...
curl -s http://localhost:11434/api/tags >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] Ollama is not running on port 11434.
    echo Please make sure Ollama is installed and run 'ollama run llama3.2' in another window.
) else (
    echo [OK] Ollama is running and responsive.
)
echo.

echo [2/3] Starting OmniLife FastAPI Backend on http://localhost:8000...
cd /d "%~dp0backend"
start "OmniLife Backend" cmd /k ".\.venv\Scripts\python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"

echo [3/3] Starting OmniLife Next.js Frontend on http://localhost:3000...
cd /d "%~dp0frontend"
start "OmniLife Frontend" cmd /k "npm run dev"

echo.
echo ===================================================
echo OmniLife is launching!
echo Backend:  http://localhost:8000
echo Frontend: http://localhost:3000
echo Docs:     http://localhost:8000/docs
echo.
echo Demo Account:
echo   Email:    demo@omnilife.ai
echo   Password: demo1234
echo ===================================================
timeout /t 3 >nul
start http://localhost:3000

# OmniLife Digital Twin Launcher (PowerShell)
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "      OmniLife Digital Twin - Local Launcher" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""

# Check Ollama
Write-Host "[1/3] Checking Ollama status..." -ForegroundColor Yellow
try {
    $ollama = Invoke-RestMethod -Uri "http://localhost:11434/api/tags" -TimeoutSec 2
    Write-Host "[OK] Ollama is running with models: $($ollama.models.name -join ', ')" -ForegroundColor Green
} catch {
    Write-Host "[WARNING] Ollama is not responding on http://localhost:11434." -ForegroundColor Red
    Write-Host "Please start Ollama using: ollama run llama3.2" -ForegroundColor Yellow
}

# Start Backend
Write-Host "[2/3] Starting Backend on http://localhost:8000..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\backend'; .\.venv\Scripts\python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"

# Start Frontend
Write-Host "[3/3] Starting Frontend on http://localhost:3000..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\frontend'; npm run dev"

Write-Host ""
Write-Host "===================================================" -ForegroundColor Green
Write-Host "OmniLife is running!" -ForegroundColor Green
Write-Host "Frontend: http://localhost:3000" -ForegroundColor White
Write-Host "Backend:  http://localhost:8000" -ForegroundColor White
Write-Host "API Docs: http://localhost:8000/docs" -ForegroundColor White
Write-Host ""
Write-Host "Demo Credentials:" -ForegroundColor Cyan
Write-Host "  Email:    demo@omnilife.ai" -ForegroundColor White
Write-Host "  Password: demo1234" -ForegroundColor White
Write-Host "===================================================" -ForegroundColor Green

Start-Sleep -Seconds 3
Start-Process "http://localhost:3000"

@echo off
title Lumora Marketplace Runner
echo ===================================================
echo             Lumora Digital Marketplace
echo ===================================================
echo.

echo [1/3] Seeding SQLite Database...
cd backend
.venv\Scripts\python.exe seed_db.py
if %ERRORLEVEL% neq 0 (
    echo [WARNING] Seeding failed or was already completed. Continuing...
) else (
    echo [SUCCESS] Database seeded successfully.
)
cd ..
echo.

echo [2/3] Starting FastAPI Backend on http://127.0.0.1:8000 ...
start "Lumora Backend" cmd /k "cd backend && .venv\Scripts\uvicorn.exe app.main:app --host 127.0.0.1 --port 8000"
echo.

echo [3/3] Starting Vite Frontend on http://localhost:5173 ...
start "Lumora Frontend" cmd /k "cd frontend && npm run dev"
echo.

echo ===================================================
echo All services started in separate terminal windows!
echo Opening http://localhost:5173 in your browser...
echo ===================================================
start http://localhost:5173
pause

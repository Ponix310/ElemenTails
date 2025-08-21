@echo off
echo Starting ElemenTails Development Server...
echo.
echo This will serve the game at http://localhost:8000
echo Press Ctrl+C to stop the server
echo.

REM Try Python 3 first
python serve.py
if %errorlevel% neq 0 (
    REM Try py command if python failed
    py serve.py
    if %errorlevel% neq 0 (
        echo.
        echo Python not found. Trying alternative method...
        echo.
        REM Try PowerShell as fallback
        powershell -Command "Start-Process 'http://localhost:8000'; python -m http.server 8000"
        if %errorlevel% neq 0 (
            echo.
            echo Could not start server. Please install Python or run manually:
            echo python -m http.server 8000
            pause
        )
    )
)

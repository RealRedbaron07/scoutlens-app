@echo off
echo 🔭 Starting ScoutLens...
echo.

where python >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo 📡 Server running at: http://localhost:8000
    echo Press Ctrl+C to stop
    echo.
    python -m http.server 8000
) else (
    where npx >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        echo 📡 Server running at: http://localhost:3000
        echo Press Ctrl+C to stop
        echo.
        npx serve .
    ) else (
        echo ❌ No server available!
        echo.
        echo Please install one of:
        echo   - Python: https://python.org
        echo   - Node.js: https://nodejs.org
        echo.
        echo Or just open index.html directly in your browser.
        pause
    )
)


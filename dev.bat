@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Install Node.js 22 LTS or a supported newer version from https://nodejs.org/
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [INFO] Installing locked dependencies...
  call npm ci
  if errorlevel 1 (
    pause
    exit /b 1
  )
)

echo.
echo Chiboshi - Measurement Playground
echo Open http://127.0.0.1:3000 when the server reports that it is ready.
echo Press Ctrl+C to stop. Optional AI features require your own configuration.
echo.
call npm run dev -- --port 3000
set "CHIBOSHI_EXIT_CODE=%ERRORLEVEL%"
pause
exit /b %CHIBOSHI_EXIT_CODE%

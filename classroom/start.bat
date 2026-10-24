@echo off
setlocal EnableDelayedExpansion

set "ROOT=%~dp0"
set "SERVER=%ROOT%server.js"
set "ENV_FILE=%ROOT%.env"
set "PORT=3000"

if exist "%ROOT%node.exe" (
    set "NODE=%ROOT%node.exe"
) else (
    where node >nul 2>&1
    if errorlevel 1 (
        echo [ERROR] node.exe not found.
        echo Place portable node.exe in this folder, or install Node.js.
        echo Download a supported Node.js 22 LTS or newer Windows build: https://nodejs.org/
        pause
        exit /b 1
    )
    set "NODE=node"
)

if not exist "%SERVER%" (
    echo [ERROR] server.js not found. Run npm run build first.
    pause
    exit /b 1
)

if exist "%ENV_FILE%" (
    for /f "usebackq tokens=1,* delims==" %%A in ("%ENV_FILE%") do (
        set "_k=%%A"
        if not "!_k!"=="" if not "!_k:~0,1!"=="#" (
            set "%%A=%%B"
        )
    )
)

set PORT=%PORT%
set HOSTNAME=127.0.0.1

start "" /b cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:%PORT%"

echo.
echo  ================================================
echo   Starting...  http://localhost:%PORT%
echo   Close this window to stop the server.
echo  ================================================
echo.

"%NODE%" "%SERVER%"
pause

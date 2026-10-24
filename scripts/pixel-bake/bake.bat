@echo off
chcp 65001 >nul
REM ===========================================================
REM lianggan pixel-bake one-shot runner
REM
REM Usage:
REM   bake.bat                       incremental
REM   bake.bat --force               regenerate all
REM   bake.bat --limit 5             only first 5 (debug)
REM   bake.bat --only sesame ant     only specific ids
REM ===========================================================

setlocal EnableExtensions

set ENV_NAME=lianggan-pixel
set HERE=%~dp0
set ROOT=%HERE%..\..
set CUDA_MODULE_LOADING=LAZY
REM Default offline (HF models already cached in HF_HOME).
REM For first-time FLUX download, set OFFLINE=0 before calling this script:
REM     set OFFLINE=0
REM     bake.bat --only sesame
if not "%OFFLINE%"=="0" (
    set HF_HUB_OFFLINE=1
    set TRANSFORMERS_OFFLINE=1
)

REM Auto-discover conda if not in PATH (same logic as setup.bat)
where conda >nul 2>nul
if not errorlevel 1 goto :CONDA_OK
set CONDA_ROOT=
for %%P in (
    "%USERPROFILE%\miniconda3" "%USERPROFILE%\Miniconda3"
    "%USERPROFILE%\anaconda3" "%USERPROFILE%\Anaconda3"
    "%USERPROFILE%\AppData\Local\miniconda3"
    "%LOCALAPPDATA%\miniconda3" "%LOCALAPPDATA%\anaconda3"
    "%ProgramData%\miniconda3" "%ProgramData%\Miniconda3"
    "%ProgramData%\anaconda3" "%ProgramData%\Anaconda3"
    "C:\miniconda3" "C:\Miniconda3" "C:\anaconda3" "C:\Anaconda3"
    "D:\miniconda3" "D:\anaconda3" "D:\anaconda" "D:\Anaconda"
    "D:\RJ\anaconda" "D:\RJ\Anaconda3"
) do (
    if exist "%%~P\Scripts\conda.exe" set CONDA_ROOT=%%~P
)
if "%CONDA_ROOT%"=="" (
    echo [bake] conda not found. Run setup.bat first or open Anaconda Prompt.
    goto :END_FAIL
)
set "PATH=%CONDA_ROOT%;%CONDA_ROOT%\Scripts;%CONDA_ROOT%\condabin;%CONDA_ROOT%\Library\bin;%PATH%"
:CONDA_OK

echo.
echo === Step 1/2: dump refs.json ===
pushd "%ROOT%"
call npx tsx scripts/pixel-bake/_dump-refs.mts > scripts/pixel-bake/refs.json
if errorlevel 1 (
    echo [bake] dump refs failed.
    popd
    goto :END_FAIL
)
popd
echo refs.json written.

echo.
echo === Step 2/2: run bake.py ===
echo [bake] CUDA_MODULE_LOADING=%CUDA_MODULE_LOADING%
call conda run --no-capture-output -n %ENV_NAME% python "%HERE%bake.py" %*
if errorlevel 1 (
    echo [bake] bake.py failed.
    goto :END_FAIL
)

echo.
echo === DONE ===
echo Output: public/icons/pixel/
echo Verify: http://localhost:3000/dev/icons
echo.
pause
exit /b 0

:END_FAIL
echo.
echo === bake FAILED ===
pause
exit /b 1

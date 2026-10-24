@echo off
chcp 65001 >nul
REM ===========================================================
REM lianggan visual-assets catalog overnight bake
REM
REM Reads scripts\pixel-bake\visual-assets.json (1000+ entries)
REM Generates PNGs to public\icons\pixel\<id>.png with:
REM   * incremental save: each PNG written immediately on success
REM   * resume safe: skips ids whose PNG already exists
REM   * manifest updated after every item
REM
REM Usage:
REM   bake-catalog.bat                          full overnight run
REM   bake-catalog.bat --force                  regenerate all
REM   bake-catalog.bat --category vehicle       only one category
REM   bake-catalog.bat --limit 10               smoke test 10 items
REM   bake-catalog.bat --only school_bus ant    specific ids
REM ===========================================================

setlocal EnableExtensions

set ENV_NAME=lianggan-pixel
set HERE=%~dp0
set ROOT=%HERE%..\..
set CUDA_MODULE_LOADING=LAZY

REM Auto-discover conda if not in PATH (mirror logic from bake.bat)
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
echo === lianggan visual-assets catalog bake ===
echo Catalog: %HERE%visual-assets.json
echo Output : %ROOT%\public\icons\pixel
echo.
echo (resume-safe: existing PNGs are skipped automatically;
echo  Ctrl+C anytime, re-run this script to continue.)
echo.

call conda run --no-capture-output -n %ENV_NAME% python "%HERE%bake.py" --catalog "%HERE%visual-assets.json" %*
if errorlevel 1 (
    echo [bake] bake.py failed.
    goto :END_FAIL
)

echo.
echo === DONE ===
echo Output: public\icons\pixel\
echo Verify: http://localhost:3000/dev/icons
echo.
pause
exit /b 0

:END_FAIL
echo.
echo === bake FAILED ===
pause
exit /b 1

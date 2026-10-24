@echo off
chcp 65001 >nul
REM ===========================================================
REM lianggan pixel-bake setup (China mirrors)
REM
REM Mirrors used:
REM   PyTorch wheels (cu124):  https://mirror.sjtu.edu.cn/pytorch-wheels/cu124
REM   Other PyPI packages:     https://mirrors.aliyun.com/pypi/simple/
REM ===========================================================

setlocal EnableExtensions

set ENV_NAME=lianggan-pixel
set HERE=%~dp0
set ENV_FILE=%HERE%environment.yml
set REQ_FILE=%HERE%requirements.txt

set TORCH_INDEX=https://mirror.sjtu.edu.cn/pytorch-wheels/cu124
set PYPI_INDEX=https://mirrors.aliyun.com/pypi/simple/

echo.
echo === Step 1/5: locate conda ===
where conda >nul 2>nul
if not errorlevel 1 goto :CONDA_OK

set CONDA_ROOT=
for %%P in (
    "%USERPROFILE%\miniconda3"
    "%USERPROFILE%\Miniconda3"
    "%USERPROFILE%\anaconda3"
    "%USERPROFILE%\Anaconda3"
    "%USERPROFILE%\AppData\Local\miniconda3"
    "%LOCALAPPDATA%\miniconda3"
    "%LOCALAPPDATA%\anaconda3"
    "%ProgramData%\miniconda3"
    "%ProgramData%\anaconda3"
    "C:\miniconda3"
    "C:\anaconda3"
    "D:\miniconda3"
    "D:\anaconda3"
    "D:\anaconda"
    "D:\Anaconda"
    "D:\RJ\anaconda"
    "D:\RJ\Anaconda3"
) do (
    if exist "%%~P\Scripts\conda.exe" set CONDA_ROOT=%%~P
)

if "%CONDA_ROOT%"=="" (
    echo [setup] conda not found.
    echo Find your conda with:  where /R %%USERPROFILE%% conda.exe
    goto :END_FAIL
)
echo [setup] found conda at: %CONDA_ROOT%
set "PATH=%CONDA_ROOT%;%CONDA_ROOT%\Scripts;%CONDA_ROOT%\condabin;%CONDA_ROOT%\Library\bin;%PATH%"

:CONDA_OK
conda --version

echo.
echo === Step 2/5: check nvidia-smi ===
where nvidia-smi >nul 2>nul
if errorlevel 1 (
    echo [setup] WARNING: nvidia-smi not found. CPU mode is impractically slow.
    echo Press any key to continue, or Ctrl+C to abort...
    pause >nul
) else (
    nvidia-smi --query-gpu=name,memory.total --format=csv,noheader
)

echo.
echo === Step 3/5: create or reuse env [%ENV_NAME%] ===
conda env list | findstr /B /C:"%ENV_NAME% " /C:"%ENV_NAME%	" >nul
if not errorlevel 1 (
    echo [setup] env %ENV_NAME% already exists, skipping create.
    goto :ENV_OK
)
echo [setup] creating slim env (only Python + pip, fast)...
call conda env create -f "%ENV_FILE%"
if errorlevel 1 (
    echo [setup] conda env create failed.
    goto :END_FAIL
)

:ENV_OK
echo.
echo === Step 4/5: pip install PyTorch (cu124) from SJTU mirror ===
echo [setup] this is the big one ^(~2.5GB^), expect 3-10 min on a good connection.
call conda run --no-capture-output -n %ENV_NAME% python -m pip install --upgrade pip -i %PYPI_INDEX%
if errorlevel 1 goto :END_FAIL

call conda run --no-capture-output -n %ENV_NAME% python -m pip install torch torchvision ^
    --index-url %TORCH_INDEX% ^
    --extra-index-url %PYPI_INDEX% ^
    --trusted-host mirror.sjtu.edu.cn
if errorlevel 1 (
    echo.
    echo [setup] PyTorch install failed. Try the official URL as fallback:
    echo   conda activate %ENV_NAME%
    echo   pip install torch torchvision --index-url https://download.pytorch.org/whl/cu124
    goto :END_FAIL
)

echo.
echo === Step 5/5: pip install rest of deps from Aliyun mirror ===
call conda run --no-capture-output -n %ENV_NAME% python -m pip install -r "%REQ_FILE%" -i %PYPI_INDEX%
if errorlevel 1 goto :END_FAIL

echo.
echo === Verify PyTorch + CUDA ===
call conda run --no-capture-output -n %ENV_NAME% python -c "import torch; print('torch', torch.__version__); print('cuda available:', torch.cuda.is_available()); print('device:', torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'cpu')"

echo.
echo === DONE ===
echo Next: bake.bat --limit 5
echo.
goto :END_OK

:END_FAIL
echo.
echo === setup FAILED ===
pause
exit /b 1

:END_OK
pause
exit /b 0

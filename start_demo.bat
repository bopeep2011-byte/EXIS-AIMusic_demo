@echo off
chcp 65001 >nul 2>&1
setlocal EnableExtensions
cd /d "%~dp0"

set "FOUNDATION=%~dp0..\exis_studio\foundation_dataset"
set "PYTHONPATH=%FOUNDATION%;%PYTHONPATH%"

echo.
echo  ========================================
echo   EXIS AI Music Demo
echo   http://127.0.0.1:8765
echo  ========================================
echo   Keep this window open — close to stop the server.
echo.

echo [1/2] Stopping any OLD server still on port 8765...
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8765 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue; Write-Host ('  stopped PID ' + $_.OwningProcess) }"
timeout /t 2 /nobreak >nul

echo [2/2] Starting demo server (audio_catalog_v06)...
echo.

where py >nul 2>&1
if %errorlevel%==0 (
  py -3 -c "import flask" >nul 2>&1
  if errorlevel 1 (
    echo [install] pip install flask...
    py -3 -m pip install flask -q
  )
  py -3 "%~dp0server\demo_server.py"
  goto :done
)

where python >nul 2>&1
if %errorlevel%==0 (
  python "%~dp0server\demo_server.py"
  goto :done
)

echo [ERROR] Python not found. Install Python 3.11+

:done
echo.
if errorlevel 1 echo [ERROR] Server failed — copy the error above.
pause

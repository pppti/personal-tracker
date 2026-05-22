@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title Skincare Inventory Intranet

echo.
echo ================================================
echo   Skincare Inventory Intranet
echo ================================================
echo.
echo Choose start mode:
echo.
echo   [1] SQLite single-file mode - easiest for trial/demo
echo   [2] Docker mode - recommended for company intranet
echo   [Q] Quit
echo.
choice /c 12Q /n /m "Input option (1/2/Q): "

if errorlevel 3 goto :end
if errorlevel 2 goto :docker
if errorlevel 1 goto :sqlite

:sqlite
echo.
echo Checking Python...
set PYTHON=
for %%p in ("%LOCALAPPDATA%\Programs\Python\Python312\python.exe" "%LOCALAPPDATA%\Programs\Python\Python311\python.exe" "%LOCALAPPDATA%\Programs\Python\Python310\python.exe" "python3" "python") do (
    if defined PYTHON goto :python_found
    %%~p --version >nul 2>&1
    if not errorlevel 1 set PYTHON=%%~p
)

:python_found
if not defined PYTHON (
    echo [ERROR] Python 3.10+ was not found.
    echo Install Python from: https://www.python.org/downloads/
    pause
    goto :end
)

echo [OK] Python ready: %PYTHON%
set WEB_PORT=5050
echo.
echo Local URL: http://localhost:%WEB_PORT%
echo LAN URL:   http://YOUR-COMPANY-PC-IP:%WEB_PORT%
echo Tip: run ipconfig to find the IPv4 address of this computer.
echo Press Ctrl+C to stop.
echo.
%PYTHON% app_sqlite.py
goto :end

:docker
echo.
echo Checking Docker...
docker --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker was not found. Install Docker Desktop first.
    echo Download: https://www.docker.com/products/docker-desktop/
    pause
    goto :end
)

echo [OK] Docker ready.
echo Starting Docker mode: MySQL + phpMyAdmin + Web...
docker compose up -d
echo.
echo ================================================
echo   Started.
echo   Web UI:       http://localhost:5000
echo   phpMyAdmin:   http://localhost:8080
echo   MySQL:        localhost:3306
echo.
echo   For colleagues: http://COMPANY-PC-IP:5000
echo   Find IP: ipconfig
echo   Stop: docker compose down
echo ================================================
pause

:end
endlocal

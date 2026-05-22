@echo off
chcp 65001 >nul
setlocal
title 包材管理系统

cd /d "%~dp0"

set "VENV_PY=%~dp0.venv\Scripts\python.exe"
set "BASE_PY="

if exist "%VENV_PY%" goto install_deps

if exist "%LocalAppData%\Programs\Python\Python312\python.exe" (
    set "BASE_PY=%LocalAppData%\Programs\Python\Python312\python.exe"
) else (
    for /f "delims=" %%P in ('where python 2^>nul') do (
        if not defined BASE_PY set "BASE_PY=%%P"
    )
)

if not defined BASE_PY (
    echo [错误] 未找到 Python。请先安装 Python 3.12 或更高版本。
    pause
    exit /b 1
)

echo [首次启动] 正在创建虚拟环境...
"%BASE_PY%" -m venv .venv
if errorlevel 1 (
    echo [错误] 创建虚拟环境失败。
    pause
    exit /b 1
)

:install_deps
echo [启动准备] 正在检查依赖...
if exist "%~dp0wheelhouse" (
    "%VENV_PY%" -m pip install --no-index --find-links "%~dp0wheelhouse" -r requirements.txt
) else (
    "%VENV_PY%" -m pip install -r requirements.txt
)
if errorlevel 1 (
    echo [错误] 依赖安装失败。
    pause
    exit /b 1
)

echo.
echo ============================================================
echo   护肤品包材管理系统
echo   访问地址: http://127.0.0.1:5000
echo   局域网访问: http://本机IP:5000
echo   按 Ctrl+C 停止
echo ============================================================
echo.

"%VENV_PY%" app.py
pause

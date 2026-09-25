@echo off
setlocal
title Dice Teaching System - Start All

echo ==========================================
echo   Dice Teaching System - One Click Start
echo ==========================================
echo.

where conda >nul 2>nul
if errorlevel 1 (
  echo [ERROR] conda not found in PATH.
  echo Please install Miniconda/Anaconda and reopen terminal.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm not found in PATH.
  echo Please install Node.js LTS and reopen terminal.
  pause
  exit /b 1
)

if not defined SECRET_KEY (
  echo [ERROR] SECRET_KEY environment variable is not set.
  echo Set a random secret in PowerShell before starting the services:
  echo   $env:SECRET_KEY = python -c "import secrets; print(secrets.token_urlsafe(32))"
  pause
  exit /b 1
)

if not exist "%~dp0backend\app.py" (
  echo [ERROR] backend\app.py not found.
  echo Make sure this script is in project root.
  pause
  exit /b 1
)

if not exist "%~dp0frontend\package.json" (
  echo [ERROR] frontend\package.json not found.
  echo Make sure this script is in project root.
  pause
  exit /b 1
)

start "backend (8000)" cmd /k "cd /d %~dp0backend && conda run -n math python app.py"
if errorlevel 1 (
  echo [ERROR] Failed to create backend window.
  pause
  exit /b 1
)

start "frontend (5173)" cmd /k "cd /d %~dp0frontend && npm run dev"
if errorlevel 1 (
  echo [ERROR] Failed to create frontend window.
  pause
  exit /b 1
)

echo [OK] Startup commands sent.
echo Wait 5-10 seconds, then open:
echo   http://localhost:5173
echo.
echo To stop services, run stop_all.bat
echo.
pause

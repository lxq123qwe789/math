@echo off
setlocal
title Dice Teaching System - First Time Setup

echo ==========================================
echo   Dice Teaching System - First Time Setup
echo ==========================================
echo This script should be run only once on a new computer.
echo.

where conda >nul 2>nul
if errorlevel 1 (
  echo [ERROR] conda not found in PATH.
  echo Please install Miniconda/Anaconda first.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm not found in PATH.
  echo Please install Node.js LTS first.
  pause
  exit /b 1
)

echo [1/4] Installing frontend dependencies...
cd /d "%~dp0frontend"
call npm install
if errorlevel 1 (
  echo [ERROR] Frontend dependency installation failed.
  pause
  exit /b 1
)

echo [2/4] Creating backend environment math (Python 3.12.13)...
cd /d "%~dp0backend"
call conda create -n math python=3.12.13 -y

echo [3/4] Installing backend dependencies...
call conda run -n math pip install -r requirements.txt
if errorlevel 1 (
  echo [ERROR] Backend dependency installation failed.
  pause
  exit /b 1
)

echo [4/4] Setup complete.
echo.
echo Next step: run start_all.bat
echo.
pause

@echo off
setlocal

set SCRIPT_DIR=%~dp0
powershell -NoExit -ExecutionPolicy Bypass -File "%SCRIPT_DIR%start_all.ps1"

endlocal

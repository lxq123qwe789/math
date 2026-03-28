$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Join-Path $projectRoot 'backend'
$frontendDir = Join-Path $projectRoot 'frontend'
$condaBat = 'E:\Miniconda\Scripts\activate.bat'

if (-not (Test-Path $backendDir)) {
    Write-Error "未找到 backend 目录：$backendDir"
}

if (-not (Test-Path $frontendDir)) {
    Write-Error "未找到 frontend 目录：$frontendDir"
}

if (-not (Test-Path $condaBat)) {
    Write-Error "未找到 Conda 激活脚本：$condaBat"
}

Write-Host '正在启动后端（math 环境）...' -ForegroundColor Cyan
$backendCmd = "`"$condaBat`" ; conda activate math ; Set-Location `"$backendDir`" ; python -s -m uvicorn app:app --host 0.0.0.0 --port 8000 --reload"
Start-Process powershell -ArgumentList '-NoExit', '-ExecutionPolicy', 'Bypass', '-Command', $backendCmd

Write-Host '正在启动前端（Vite）...' -ForegroundColor Cyan
$frontendCmd = "Set-Location `"$frontendDir`" ; npm run dev"
Start-Process powershell -ArgumentList '-NoExit', '-ExecutionPolicy', 'Bypass', '-Command', $frontendCmd

Write-Host ''
Write-Host '已触发启动：' -ForegroundColor Green
Write-Host '- 后端: http://localhost:8000' -ForegroundColor Green
Write-Host '- 前端: http://localhost:5173' -ForegroundColor Green

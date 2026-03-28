param(
    [switch]$WhatIf
)

$ports = @(8000, 5173)
$killed = @()

foreach ($port in $ports) {
    $listeners = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if (-not $listeners) {
        Write-Host "端口 $port 未检测到监听进程" -ForegroundColor DarkYellow
        continue
    }

    $pids = $listeners | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($pid in $pids) {
        $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
        if (-not $proc) {
            continue
        }

        if ($WhatIf) {
            Write-Host "[WhatIf] 将结束 PID=$pid Name=$($proc.ProcessName) (port $port)" -ForegroundColor Yellow
            continue
        }

        Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
        $killed += [PSCustomObject]@{
            Port = $port
            PID = $pid
            Name = $proc.ProcessName
        }
    }
}

if ($WhatIf) {
    Write-Host 'WhatIf 模式完成，未实际结束任何进程。' -ForegroundColor Yellow
    exit 0
}

if ($killed.Count -eq 0) {
    Write-Host '未结束任何进程。' -ForegroundColor DarkYellow
    exit 0
}

Write-Host '已结束以下进程：' -ForegroundColor Green
$killed | Format-Table -AutoSize

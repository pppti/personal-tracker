<#
  Install a Windows scheduled task for startup launch and automatic restart.
  Run this script from an elevated PowerShell window.
#>
$ErrorActionPreference = "Stop"

$taskName = "SkincareSupplierSystem"
$scriptDir = $PSScriptRoot
$venvPython = Join-Path $scriptDir ".venv\Scripts\python.exe"
$requirements = Join-Path $scriptDir "requirements.txt"
$appPath = Join-Path $scriptDir "app.py"

function Resolve-BasePython {
    $localPython = Join-Path $env:LOCALAPPDATA "Programs\Python\Python312\python.exe"
    if (Test-Path $localPython) {
        return $localPython
    }

    $cmd = Get-Command python -ErrorAction SilentlyContinue
    if ($cmd -and $cmd.Source -notlike "*\WindowsApps\python.exe") {
        return $cmd.Source
    }

    throw "Python was not found. Install Python 3.12 or later first."
}

if (-not (Test-Path $venvPython)) {
    $basePython = Resolve-BasePython
    Write-Host "Creating virtual environment..." -ForegroundColor Cyan
    & $basePython -m venv (Join-Path $scriptDir ".venv")
}

Write-Host "Installing dependencies..." -ForegroundColor Cyan
$wheelhouse = Join-Path $scriptDir "wheelhouse"
if (Test-Path $wheelhouse) {
    & $venvPython -m pip install --no-index --find-links $wheelhouse -r $requirements
} else {
    & $venvPython -m pip install -r $requirements
}

$action = New-ScheduledTaskAction `
    -Execute $venvPython `
    -Argument "`"$appPath`"" `
    -WorkingDirectory $scriptDir

$triggers = @(
    (New-ScheduledTaskTrigger -AtStartup),
    (New-ScheduledTaskTrigger -AtLogOn)
)

$principal = New-ScheduledTaskPrincipal `
    -UserId "$env:USERDOMAIN\$env:USERNAME" `
    -LogonType Interactive `
    -RunLevel Limited

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -MultipleInstances IgnoreNew `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $triggers `
    -Principal $principal `
    -Settings $settings `
    -Description "Skincare supplier management system startup task" `
    -Force | Out-Null

try {
    New-NetFirewallRule `
        -DisplayName "Skincare Supplier System 5000" `
        -Direction Inbound `
        -Action Allow `
        -Protocol TCP `
        -LocalPort 5000 `
        -ErrorAction SilentlyContinue | Out-Null
} catch {
    Write-Host "Tip: Could not create a firewall rule. If LAN access fails, allow inbound TCP 5000 manually." -ForegroundColor Yellow
}

Start-ScheduledTask -TaskName $taskName

Write-Host "Service task installed and started." -ForegroundColor Green
Write-Host "Task name: $taskName" -ForegroundColor Cyan
Write-Host "Local URL: http://127.0.0.1:5000" -ForegroundColor Cyan
Write-Host "LAN URL: http://YOUR-PC-IP:5000" -ForegroundColor Cyan
Write-Host ""
Write-Host "Management commands:" -ForegroundColor Yellow
Write-Host "Stop: Stop-ScheduledTask -TaskName '$taskName'" -ForegroundColor White
Write-Host "Start: Start-ScheduledTask -TaskName '$taskName'" -ForegroundColor White
Write-Host "Uninstall: Unregister-ScheduledTask -TaskName '$taskName' -Confirm:`$false" -ForegroundColor White

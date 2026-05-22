$ErrorActionPreference = "Stop"

$root = $PSScriptRoot
$packageRoot = Join-Path (Split-Path $root -Parent) "company-package"
$packageWebapp = Join-Path $packageRoot "webapp"
$zipPath = Join-Path (Split-Path $root -Parent) "skincare-webapp-company.zip"

if (Test-Path $packageRoot) {
    Remove-Item -LiteralPath $packageRoot -Recurse -Force
}
if (Test-Path $zipPath) {
    Remove-Item -LiteralPath $zipPath -Force
}

New-Item -ItemType Directory -Force -Path $packageWebapp | Out-Null

$excludeDirs = @(".venv", "__pycache__")
$excludeFiles = @("*.pyc", "*.log")

Get-ChildItem -LiteralPath $root -Force | ForEach-Object {
    if ($_.PSIsContainer -and $excludeDirs -contains $_.Name) {
        return
    }
    foreach ($pattern in $excludeFiles) {
        if ($_.Name -like $pattern) {
            return
        }
    }
    Copy-Item -LiteralPath $_.FullName -Destination $packageWebapp -Recurse -Force
}

Compress-Archive -LiteralPath $packageWebapp -DestinationPath $zipPath -Force
Write-Host "Created package: $zipPath"

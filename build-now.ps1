# Builds the desktop .exe to a timestamped folder
$ErrorActionPreference = "Stop"
$Root = "D:\school-ms\desktop"
Set-Location $Root

# Kill anything holding files
Write-Host "Killing any running School MS instances..." -ForegroundColor Cyan
Get-Process "School MS" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process electron -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# Timestamped output folder
$ts = Get-Date -Format "yyyyMMddHHmmss"
$out = "dist-$ts"

Write-Host "Building to $out ..." -ForegroundColor Cyan

# Patch electron-builder.yml just for this run
$yaml = Get-Content electron-builder.yml -Raw
$yamlBackup = $yaml
$yaml = $yaml -replace "output: dist($|\s)", "output: $out`$1"
Set-Content -Path electron-builder.yml -Value $yaml -Encoding UTF8

try {
    npx electron-builder --win --publish=never
}
finally {
    # Restore original yaml
    Set-Content -Path electron-builder.yml -Value $yamlBackup -Encoding UTF8
}

Write-Host ""
Write-Host "Done. Output: $Root\$out" -ForegroundColor Green
Get-ChildItem "$out\*.exe" -ErrorAction SilentlyContinue | Select-Object Name, @{n='MB';e={[math]::Round($_.Length/1MB)}}
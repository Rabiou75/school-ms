# kill-dev.ps1 — run before pnpm dev to clear zombie node processes
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1
$still = Get-NetTCPConnection -LocalPort 4000, 3000 -ErrorAction SilentlyContinue
if ($still) { Write-Host "Still busy:"; $still | Format-Table }
else { Write-Host "OK: ports 3000 and 4000 are free" }
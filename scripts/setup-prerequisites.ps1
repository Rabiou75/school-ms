$script = @'
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent

$nodeDir = Join-Path $root 'vendor\node'
$pgDir   = Join-Path $root 'vendor\postgres'
$vcpkg   = Join-Path $root 'desktop\build\vc_redist.x64.exe'

Write-Host "=== Checking Prerequisites ===" -ForegroundColor Cyan

# ---------------------------------------------------------
# 1. Node.js 18.20.4
# ---------------------------------------------------------
if (Test-Path (Join-Path $nodeDir 'node.exe')) {
    Write-Host "[OK] Node.js is already present in vendor\node" -ForegroundColor Green
} else {
    Write-Host "[DOWNLOAD] Node.js 18.20.4..." -ForegroundColor Yellow
    $nodeUrl = "https://nodejs.org/dist/v18.20.4/node-v18.20.4-win-x64.zip"
    $nodeZip = Join-Path $env:TEMP "node-v18.20.4.zip"
    $nodeTmp = Join-Path $env:TEMP "node-v18.20.4-extracted"

    Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeZip
    if (Test-Path $nodeTmp) { Remove-Item $nodeTmp -Recurse -Force }
    Expand-Archive -Path $nodeZip -DestinationPath $nodeTmp -Force
    
    New-Item -ItemType Directory -Force -Path $nodeDir | Out-Null
    Copy-Item -Path (Join-Path $nodeTmp 'node-v18.20.4-win-x64\*') -Destination $nodeDir -Recurse -Force
    
    Remove-Item $nodeZip -Force
    Remove-Item $nodeTmp -Recurse -Force
    Write-Host "[DONE] Node.js extracted to vendor\node" -ForegroundColor Green
}

# ---------------------------------------------------------
# 2. PostgreSQL 18.1 Binaries
# ---------------------------------------------------------
if (Test-Path (Join-Path $pgDir 'bin\initdb.exe')) {
    Write-Host "[OK] PostgreSQL is already present in vendor\postgres" -ForegroundColor Green
} else {
    Write-Host "[DOWNLOAD] PostgreSQL 18.1 binaries (approx 330MB)..." -ForegroundColor Yellow
    
    # EDB provides the portable binaries
    $pgUrl = "https://get.enterprisedb.com/postgresql/postgresql-18.1-1-windows-x64-binaries.zip"
    $pgZip = Join-Path $env:TEMP "postgresql-binaries.zip"
    $pgTmp = Join-Path $env:TEMP "postgresql-extracted"

    try {
        Invoke-WebRequest -Uri $pgUrl -OutFile $pgZip
        if (Test-Path $pgTmp) { Remove-Item $pgTmp -Recurse -Force }
        Expand-Archive -Path $pgZip -DestinationPath $pgTmp -Force
        
        New-Item -ItemType Directory -Force -Path $pgDir | Out-Null
        Copy-Item -Path (Join-Path $pgTmp 'pgsql\*') -Destination $pgDir -Recurse -Force
        
        Remove-Item $pgZip -Force
        Remove-Item $pgTmp -Recurse -Force
        Write-Host "[DONE] PostgreSQL extracted to vendor\postgres" -ForegroundColor Green
    } catch {
        Write-Host "[ERROR] Failed to download PostgreSQL. The link may be outdated." -ForegroundColor Red
        Write-Host "Please download the Windows x64 binaries zip manually from:" -ForegroundColor Yellow
        Write-Host "https://www.enterprisedb.com/download-postgresql-binaries" -ForegroundColor Yellow
        Write-Host "Extract the 'pgsql' folder into D:\school-ms\vendor\postgres" -ForegroundColor Yellow
        throw
    }
}

# ---------------------------------------------------------
# 3. Visual C++ Redistributable
# ---------------------------------------------------------
if (Test-Path $vcpkg) {
    Write-Host "[OK] VC++ Redistributable is already present" -ForegroundColor Green
} else {
    Write-Host "[DOWNLOAD] VC++ Redistributable x64..." -ForegroundColor Yellow
    $vcUrl = "https://aka.ms/vs/17/release/vc_redist.x64.exe"
    
    $vcDir = Split-Path $vcpkg -Parent
    if (-not (Test-Path $vcDir)) { New-Item -ItemType Directory -Force -Path $vcDir | Out-Null }
    
    Invoke-WebRequest -Uri $vcUrl -OutFile $vcpkg
    Write-Host "[DONE] VC++ Redistributable saved to desktop\build" -ForegroundColor Green
}

Write-Host "`nAll prerequisites are ready! You can now run .\scripts\build-embed.ps1" -ForegroundColor Cyan
'@

Set-Content -Path "D:\school-ms\scripts\setup-prerequisites.ps1" -Value $script -Encoding ASCII
Write-Host "Created scripts\setup-prerequisites.ps1 successfully!" -ForegroundColor Green
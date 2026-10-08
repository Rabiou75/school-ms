# Runs a one-shot backup of the school_ms database
# Works from the monorepo root

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$BackupDir = Join-Path $Root "backups"
New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null

$Stamp = Get-Date -Format "yyyy-MM-dd_HH-mm"
$File = Join-Path $BackupDir "school_ms_$Stamp.dump"

Write-Host "Backing up school_ms to $File..." -ForegroundColor Cyan

# Use pg_dump directly (works without Docker)
$env:PGPASSWORD = "school"
& pg_dump -U school -h localhost -d school_ms -Fc -f $File

if ($LASTEXITCODE -ne 0) {
    Write-Host "pg_dump failed" -ForegroundColor Red
    exit 1
}

$size = (Get-Item $File).Length
Write-Host "OK — $([math]::Round($size/1KB)) KB" -ForegroundColor Green
Write-Host "File: $File"
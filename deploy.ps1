#Requires -Version 5.1
#Requires -RunAsAdministrator
<#
.SYNOPSIS
    One-shot deployer for the School Management System on Windows.

.DESCRIPTION
    Deploys the app with Docker Desktop. Supports two modes:
      LAN     - HTTP only, accessible at http://<lan-ip>, ideal for a school network
      Public  - HTTP + optional domain; put behind a reverse proxy you control

    The script is idempotent: rerunning reuses the .env, existing certs, and
    skips seeding if data already exists.

.EXAMPLE
    cd C:\school-ms
    .\deploy.ps1
#>

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

# ============================================================
# Helpers
# ============================================================
function Say  { param([string]$m) Write-Host "`u{25B8} $m" -ForegroundColor Cyan }
function Ok   { param([string]$m) Write-Host "`u{2713} $m" -ForegroundColor Green }
function Warn { param([string]$m) Write-Host "`u{26A0} $m" -ForegroundColor Yellow }
function Die  { param([string]$m) Write-Host "`u{2717} $m" -ForegroundColor Red; exit 1 }

function New-RandomHex {
    param([int]$Bytes = 32)
    $buf = New-Object byte[] $Bytes
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buf)
    ($buf | ForEach-Object { $_.ToString("x2") }) -join ""
}

function New-RandomPassword {
    param([int]$Length = 28)
    $chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.ToCharArray()
    $buf = New-Object byte[] $Length
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buf)
    -join ($buf | ForEach-Object { $chars[$_ % $chars.Length] })
}

function Get-PrimaryIPv4 {
    $ip = Get-NetIPAddress -AddressFamily IPv4 |
        Where-Object {
            $_.IPAddress -notmatch '^127\.' -and
            $_.IPAddress -notmatch '^169\.254\.' -and
            $_.PrefixOrigin -ne 'WellKnown'
        } |
        Sort-Object InterfaceMetric |
        Select-Object -First 1
    if ($ip) { return $ip.IPAddress }
    return "127.0.0.1"
}

function Invoke-Compose {
    param([Parameter(ValueFromRemainingArguments=$true)][string[]]$Args)
    $out = & docker compose -f $script:ComposeFile @Args 2>&1 | Out-String
    return $out
}

# ============================================================
# 1. Preflight
# ============================================================
Say "Checking environment..."

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Die "Docker not found. Install Docker Desktop: https://docs.docker.com/desktop/install/windows-install/"
}

# Is the daemon actually running?
$dockerInfo = & docker info 2>&1 | Out-String
if ($LASTEXITCODE -ne 0 -or $dockerInfo -match "error during connect") {
    Die @"
Docker Desktop is not running.
Launch it from the Start menu, wait for the whale icon in the tray to turn steady, then rerun this script.
"@
}
Ok "Docker is running"

# Locate project
$script:ProjectRoot = (Get-Location).Path
$script:ComposeFile = Join-Path $script:ProjectRoot "docker\docker-compose.prod.yml"

if (-not (Test-Path $script:ComposeFile)) {
    Die "docker\docker-compose.prod.yml not found. Run this script from the project root (e.g. C:\school-ms)."
}

Ok "Project: $script:ProjectRoot"

# ============================================================
# 2. Interactive configuration
# ============================================================
Write-Host ""
Say "Deployment configuration"
Write-Host ""

$mode = Read-Host "Deployment mode - [L]AN (school network) or [P]ublic (internet)  [L]"
$mode = if ($mode) { $mode.ToUpper() } else { "L" }
if ($mode -notin @("L","P")) { Die "Invalid mode" }

if ($mode -eq "L") {
    $lanIp = Get-PrimaryIPv4
    $defaultPort = "80"

    $lanPort = Read-Host "HTTP port on this machine [$defaultPort]"
    $lanPort = if ($lanPort) { $lanPort } else { $defaultPort }

    $domain = "http://${lanIp}:$lanPort"
    if ($lanPort -eq "80") { $domain = "http://$lanIp" }

    Ok "LAN mode: site will be reachable at $domain"
}
else {
    $domain = Read-Host "Public domain (e.g. school.yourdomain.com)"
    if (-not $domain) { Die "Domain is required for public mode" }
    if ($domain -notmatch '^[a-zA-Z0-9.\-]+$') { Die "Domain looks invalid" }
    $domain = "https://$domain"
    Ok "Public mode: site will be reachable at $domain"
    Warn "You must issue a TLS certificate separately (Caddy / IIS / Nginx). This script only deploys HTTP inside Docker."
}

Write-Host ""
$defaultPath = $script:ProjectRoot
$projPath = Read-Host "Project path [$defaultPath]"
$projPath = if ($projPath) { $projPath } else { $defaultPath }
if (-not (Test-Path $projPath)) { Die "Path not found: $projPath" }
Set-Location $projPath

$pgUser = Read-Host "Postgres user [school]"
$pgUser = if ($pgUser) { $pgUser } else { "school" }

$pgDb = Read-Host "Postgres database [school_ms]"
$pgDb = if ($pgDb) { $pgDb } else { "school_ms" }

$securePw = Read-Host "Postgres password (leave empty to auto-generate)" -AsSecureString
$pgPass = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePw))
if (-not $pgPass) {
    $pgPass = New-RandomPassword -Length 28
    Say "Generated Postgres password: $pgPass"
    Warn "Save this somewhere safe — it will only be shown once."
}

Write-Host ""
$enableCinet = Read-Host "Enable CinetPay integration? [y/N]"
$enableCinet = if ($enableCinet) { $enableCinet.ToUpper() } else { "N" }
$cinetKey = ""
$cinetSite = ""
if ($enableCinet -eq "Y") {
    $cinetKey  = Read-Host "  CinetPay API key"
    $cinetSite = Read-Host "  CinetPay site ID"
}

Write-Host ""
Say "Summary"
Write-Host "  Mode         : $mode"
Write-Host "  URL          : $domain"
Write-Host "  Project path : $projPath"
Write-Host "  Postgres     : $pgDb (user $pgUser)"
Write-Host "  CinetPay     : $enableCinet"
Write-Host ""
$go = Read-Host "Proceed? [y/N]"
if ($go -notmatch '^[Yy]$') { Die "Aborted" }

# ============================================================
# 3. Firewall
# ============================================================
Say "Configuring Windows Firewall..."
$portToOpen = if ($mode -eq "L") { $lanPort } else { "80" }

$existing = Get-NetFirewallRule -DisplayName "SchoolMS-HTTP" -ErrorAction SilentlyContinue
if ($existing) {
    Ok "Firewall rule already exists"
} else {
    New-NetFirewallRule `
        -DisplayName "SchoolMS-HTTP" `
        -Direction Inbound `
        -Protocol TCP `
        -LocalPort $portToOpen `
        -Action Allow `
        -Profile Any | Out-Null
    Ok "Opened TCP $portToOpen"
}

if ($mode -eq "P") {
    if (-not (Get-NetFirewallRule -DisplayName "SchoolMS-HTTPS" -ErrorAction SilentlyContinue)) {
        New-NetFirewallRule `
            -DisplayName "SchoolMS-HTTPS" `
            -Direction Inbound `
            -Protocol TCP `
            -LocalPort 443 `
            -Action Allow `
            -Profile Any | Out-Null
        Ok "Opened TCP 443"
    }
}

# ============================================================
# 4. Write .env
# ============================================================
$envFile = Join-Path $projPath ".env"
if (Test-Path $envFile) {
    $stamp = Get-Date -Format "yyyyMMddHHmmss"
    Copy-Item $envFile "$envFile.bak.$stamp"
    Warn "Existing .env backed up to .env.bak.$stamp"
}

$jwtA = New-RandomHex -Bytes 32
$jwtR = New-RandomHex -Bytes 32

$publicApi = $domain
$cinetNotify = if ($mode -eq "P") { "$domain/api/v1/payments/cinetpay/webhook" } else { "$domain/api/v1/payments/cinetpay/webhook" }
$cinetReturn = "$domain/fr/parent"

$envContent = @"
NODE_ENV=production

POSTGRES_USER=$pgUser
POSTGRES_PASSWORD=$pgPass
POSTGRES_DB=$pgDb

JWT_ACCESS_SECRET=$jwtA
JWT_REFRESH_SECRET=$jwtR
JWT_ACCESS_TTL=60m
JWT_REFRESH_TTL=7d

PUBLIC_API_URL=$publicApi

CINETPAY_API_KEY=$cinetKey
CINETPAY_SITE_ID=$cinetSite
CINETPAY_NOTIFY_URL=$cinetNotify
CINETPAY_RETURN_URL=$cinetReturn
"@

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($envFile, $envContent, $utf8NoBom)
Ok ".env written"

# ============================================================
# 5. Nginx config (LAN: HTTP-only; Public: expect reverse proxy)
# ============================================================
$nginxPath = Join-Path $projPath "docker\nginx.conf"
if (Test-Path $nginxPath) {
    $stamp = Get-Date -Format "yyyyMMddHHmmss"
    Copy-Item $nginxPath "$nginxPath.bak.$stamp"
    Warn "Existing nginx.conf backed up to nginx.conf.bak.$stamp"
}

if ($mode -eq "L") {
    # HTTP-only nginx — internal port 80, published on the host as $lanPort
    $nginxLan = @"
worker_processes auto;
events { worker_connections 1024; }

http {
  include /etc/nginx/mime.types;
  sendfile on;
  client_max_body_size 25m;
  gzip on;
  gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;

  upstream web_upstream { server web:3000; }
  upstream api_upstream { server api:4000; }

  server {
    listen 80;
    server_name _;

    add_header X-Frame-Options SAMEORIGIN;
    add_header X-Content-Type-Options nosniff;
    add_header Referrer-Policy strict-origin-when-cross-origin;

    location /api/ {
      proxy_pass http://api_upstream/;
      proxy_set_header Host `$host;
      proxy_set_header X-Real-IP `$remote_addr;
      proxy_set_header X-Forwarded-For `$proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto `$scheme;
      proxy_read_timeout 120s;
    }

    location / {
      proxy_pass http://web_upstream;
      proxy_http_version 1.1;
      proxy_set_header Host `$host;
      proxy_set_header X-Real-IP `$remote_addr;
      proxy_set_header X-Forwarded-For `$proxy_add_x_forwarded_for;
      proxy_set_header Upgrade `$http_upgrade;
      proxy_set_header Connection "upgrade";
    }
  }
}
"@
    [System.IO.File]::WriteAllText($nginxPath, $nginxLan, $utf8NoBom)
    Ok "Wrote HTTP-only nginx.conf (LAN mode)"
}
else {
    Warn "Public mode: keep your existing nginx.conf with TLS certs mounted at docker\certs\"
    Warn "If it doesn't exist yet, the deployment will fail on port 443 until you add certs."
}

# ============================================================
# 6. Bind published ports
#    Compose mounts 80:80 and 443:443 by default. For LAN with custom port,
#    we rewrite the compose file's published ports.
# ============================================================
if ($mode -eq "L" -and $lanPort -ne "80") {
    Say "Binding HTTP to port $lanPort on the host..."
    $composeText = [System.IO.File]::ReadAllText($script:ComposeFile)
    $composeText = $composeText -replace '-\s*"80:80"', "- `"$lanPort`:80`""
    [System.IO.File]::WriteAllText($script:ComposeFile, $composeText, $utf8NoBom)
    Ok "docker-compose.prod.yml: 80 -> $lanPort"
}

# ============================================================
# 7. Build & start
# ============================================================
Say "Building and starting containers (5–10 minutes the first time)..."
Write-Host ""

Push-Location $projPath
try {
    & docker compose -f $script:ComposeFile up -d --build
    if ($LASTEXITCODE -ne 0) { Die "docker compose up failed" }
}
finally {
    Pop-Location
}
Ok "Containers started"

# ============================================================
# 8. Wait for Postgres to be healthy
# ============================================================
Say "Waiting for Postgres to become healthy..."
$healthy = $false
for ($i = 0; $i -lt 30; $i++) {
    $status = & docker compose -f $script:ComposeFile ps postgres 2>&1 | Out-String
    if ($status -match "healthy") { $healthy = $true; break }
    Start-Sleep -Seconds 3
}
if (-not $healthy) {
    Warn "Postgres did not become healthy in 90 seconds. Continuing anyway..."
    Write-Host "  Check: docker compose -f `"$($script:ComposeFile)`" logs postgres"
} else {
    Ok "Postgres healthy"
}

# ============================================================
# 9. Migrations + seed
# ============================================================
Say "Running Prisma migrations..."
& docker compose -f $script:ComposeFile exec -T api `
    npx prisma migrate deploy --schema packages/database/prisma/schema.prisma
if ($LASTEXITCODE -ne 0) { Warn "Migrations failed — check logs" } else { Ok "Migrations applied" }

Say "Seeding demo data..."
& docker compose -f $script:ComposeFile exec -T api `
    npx tsx packages/database/prisma/seed.ts 2>&1 | Out-Null
Ok "Seed done (skipped if already seeded)"

# ============================================================
# 10. Backup task (Windows Task Scheduler)
# ============================================================
Say "Setting up nightly backups..."

$backupScriptPath = Join-Path $projPath "scripts\backup.ps1"
$backupDir        = Join-Path $projPath "backups"
New-Item -ItemType Directory -Force -Path (Split-Path $backupScriptPath) | Out-Null
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

$backupScript = @"
# Auto-generated by deploy.ps1
`$ErrorActionPreference = "Stop"
`$ComposeFile = "$($script:ComposeFile)"
`$BackupDir = "$backupDir"
`$Db = "$pgDb"
`$User = "$pgUser"

`$stamp = Get-Date -Format "yyyy-MM-dd_HH-mm"
`$file = Join-Path `$BackupDir "school_ms_`$stamp.dump"

& docker compose -f `$ComposeFile exec -T postgres pg_dump -U `$User -Fc `$Db |
    Set-Content -Path `$file -Encoding Byte

Get-ChildItem -Path `$BackupDir -Filter "school_ms_*.dump" |
    Where-Object { `$_.LastWriteTime -lt (Get-Date).AddDays(-30) } |
    Remove-Item -Force

Write-Host "Backup complete: `$file"
"@
[System.IO.File]::WriteAllText($backupScriptPath, $backupScript, $utf8NoBom)
Ok "Wrote scripts\backup.ps1"

$taskName = "SchoolMS-Backup"
$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existingTask) {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$backupScriptPath`""

$trigger = New-ScheduledTaskTrigger -Daily -At 2am

$principal = New-ScheduledTaskPrincipal `
    -UserId "SYSTEM" `
    -LogonType ServiceAccount `
    -RunLevel Highest

Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $trigger `
    -Principal $principal `
    -Description "Nightly PostgreSQL backup for School Management System" | Out-Null

Ok "Scheduled task '$taskName' created (daily at 02:00)"

# ============================================================
# 11. Health check
# ============================================================
Say "Health check..."
Start-Sleep -Seconds 5
try {
    $resp = Invoke-WebRequest -Uri "$domain" -UseBasicParsing -TimeoutSec 15 -ErrorAction Stop
    Ok "Site responds: HTTP $($resp.StatusCode)"
}
catch {
    Warn "Could not reach $domain — verify firewall and DNS"
    Write-Host "  Error: $($_.Exception.Message)"
}

# ============================================================
# 12. Docker Desktop autostart reminder
# ============================================================
Write-Host ""
Warn "Docker Desktop must start on boot for the school system to be available after a restart."
Write-Host "  Docker Desktop -> Settings -> General -> 'Start Docker Desktop when you sign in'"

# ============================================================
# 13. Summary
# ============================================================
$composePath = $script:ComposeFile

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  Deployment complete" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  URL      : $domain"
Write-Host "  Login    : $domain/fr/login"
Write-Host "  Admin    : admin@demo-school.cm / Admin@1234"
Write-Host "  Teacher  : m.ngo@lby.cm / Teacher@1234"
Write-Host "  Parent   : parent@lby.cm / Parent@1234"
Write-Host ""
Write-Host "  Change the admin password immediately after first login." -ForegroundColor Yellow
Write-Host ""
Write-Host "Useful commands"
Write-Host "---------------"
Write-Host "  Logs       : docker compose -f `"$composePath`" logs -f"
Write-Host "  Restart    : docker compose -f `"$composePath`" restart"
Write-Host "  Stop       : docker compose -f `"$composePath`" down"
Write-Host "  Update     : cd `"$projPath`" ; git pull ; docker compose -f `"$composePath`" up -d --build"
Write-Host "  Backup now : powershell -File `"$backupScriptPath`""
Write-Host "  Backups in : $backupDir"
Write-Host "  DB password: in $envFile"
Write-Host ""
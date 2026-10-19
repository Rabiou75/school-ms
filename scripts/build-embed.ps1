$ErrorActionPreference = 'Stop'
$root    = Split-Path $PSScriptRoot -Parent
$embed   = Join-Path $root 'desktop\embed'
$apiDist = Join-Path $root 'apps\api\dist'
$webNext = Join-Path $root 'apps\web\.next'
$dbPkg   = Join-Path $root 'packages\database'
$sharedPkg = Join-Path $root 'packages\shared'

function Copy-Tree($src, $dst) {
  if (-not (Test-Path $src)) { throw "Source not found: $src" }
  New-Item -ItemType Directory -Force -Path $dst | Out-Null
  $null = robocopy $src $dst /MIR /MT:8 /NFL /NDL /NJH /NJS /NP /R:2 /W:2
  if ($LASTEXITCODE -ge 8) { throw "robocopy failed ($LASTEXITCODE)" }
}

Write-Host "=== Cleaning embed ==="
foreach ($p in @(
  (Join-Path $embed 'apps'),
  (Join-Path $embed 'node_modules'),
  (Join-Path $embed 'package-lock.json')
)) { if (Test-Path $p) { Remove-Item $p -Recurse -Force } }

Write-Host "=== Creating structure ==="
New-Item -ItemType Directory -Force -Path (Join-Path $embed 'apps\api\dist') | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $embed 'apps\web')      | Out-Null

Write-Host "=== Copying API ==="
Copy-Tree $apiDist (Join-Path $embed 'apps\api\dist')

Write-Host "=== Copying Web ==="
Copy-Tree $webNext (Join-Path $embed 'apps\web\.next')
# Next.js standalone does NOT include static assets - copy them in manually.
# Without this, the browser gets 404 on /_next/static/* and the UI is unstyled.
$webStatic  = Join-Path $root 'apps\web\.next\static'
$webPublic  = Join-Path $root 'apps\web\public'
$standalone = Join-Path $embed 'apps\web\.next\standalone\apps\web'
if (Test-Path $webStatic) { Copy-Tree $webStatic (Join-Path $standalone '.next\static') }
if (Test-Path $webPublic) { Copy-Tree $webPublic (Join-Path $standalone 'public') }

Write-Host "=== Installing embed node_modules ==="
Push-Location $embed
try { npm install --omit=dev --no-audit --no-fund } finally { Pop-Location }

Write-Host "=== Copying @school packages ==="
$schoolDest = Join-Path $embed 'node_modules\@school'
New-Item -ItemType Directory -Force -Path $schoolDest | Out-Null

$dbDest = Join-Path $schoolDest 'database'
New-Item -ItemType Directory -Force -Path $dbDest | Out-Null
Copy-Tree (Join-Path $dbPkg 'dist')         (Join-Path $dbDest 'dist')
Copy-Item (Join-Path $dbPkg 'package.json') $dbDest -Force
Copy-Tree (Join-Path $dbPkg 'prisma')       (Join-Path $dbDest 'prisma')

$sharedDest = Join-Path $schoolDest 'shared'
New-Item -ItemType Directory -Force -Path $sharedDest | Out-Null
Copy-Tree (Join-Path $sharedPkg 'dist')         (Join-Path $sharedDest 'dist')
Copy-Item (Join-Path $sharedPkg 'package.json') $sharedDest -Force

Write-Host "=== Generating Prisma client ==="
Push-Location $embed
try {
  $env:DATABASE_URL = 'postgresql://school:school@localhost:5432/school_ms?schema=public'
  npx prisma generate --schema "node_modules\@school\database\prisma\schema.prisma"
} finally { Pop-Location }

Write-Host "=== Verifying ==="
$checks = @(
  'node_modules\prisma\build\index.js',
  'node_modules\@prisma\client',
  'node_modules\.prisma\client\query_engine-windows.dll.node',
  'node_modules\@school\database\package.json',
  'node_modules\@school\database\dist\index.js',
  'node_modules\@school\database\prisma\schema.prisma',
  'node_modules\@school\database\prisma\migrations',
  'node_modules\@school\shared\package.json',
  'node_modules\@school\shared\dist\index.js',
  'apps\api\dist\main.js',
  'apps\web\.next\standalone\apps\web\.next\static'
)
$failed = $false
foreach ($c in $checks) {
  $ok = Test-Path (Join-Path $embed $c)
  if ($ok) { Write-Host ("  OK      " + $c) }
  else     { Write-Host ("  MISSING " + $c); $failed = $true }
}
if ($failed) { throw "embed build incomplete" }

Write-Host ""
Write-Host "=== embed ready ==="

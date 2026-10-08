# Build API + Web for the desktop package
$ErrorActionPreference = "Stop"
$Root = "D:\school-ms"
Set-Location $Root

Write-Host "`n=== 1. Building shared + database ===" -ForegroundColor Cyan
pnpm --filter @school/shared build
pnpm --filter @school/database build

Write-Host "`n=== 2. Compiling API ===" -ForegroundColor Cyan
Set-Location "$Root\apps\api"
npx nest build
Set-Location $Root

Write-Host "`n=== 3. Compiling seed.ts to seed.js ===" -ForegroundColor Cyan
# The desktop app needs a compiled seed.js (can't run tsx at runtime)
$seedTs = "$Root\packages\database\prisma\seed.ts"
$seedJs = "$Root\packages\database\prisma\seed.js"
if (Test-Path $seedTs) {
    npx tsc $seedTs --module CommonJS --target ES2021 --esModuleInterop --skipLibCheck --outDir "$Root\packages\database\prisma\tmp"
    if (Test-Path "$Root\packages\database\prisma\tmp\seed.js") {
        Move-Item -Force "$Root\packages\database\prisma\tmp\seed.js" $seedJs
        Remove-Item -Recurse -Force "$Root\packages\database\prisma\tmp"
        Write-Host "  + seed.js created" -ForegroundColor Green
    }
}

Write-Host "`n=== 4. Building Web (standalone) ===" -ForegroundColor Cyan
Set-Location "$Root\apps\web"
$env:API_INTERNAL_URL = "http://127.0.0.1:4400"
$env:NEXT_PUBLIC_API_URL = "http://127.0.0.1:4400"
npx next build
Set-Location $Root

Write-Host "`n=== 5. Verifying build artefacts ===" -ForegroundColor Cyan
$checks = @(
    "$Root\apps\api\dist\main.js",
    "$Root\apps\web\.next\standalone",
    "$Root\apps\web\.next\static",
    "$Root\packages\database\prisma\seed.js"
)
foreach ($p in $checks) {
    if (Test-Path $p) {
        Write-Host "  OK  $p" -ForegroundColor Green
    } else {
        Write-Host "  MISSING $p" -ForegroundColor Red
    }
}

Write-Host "`nBuild complete. Next: cd desktop ; npm run dist" -ForegroundColor Yellow
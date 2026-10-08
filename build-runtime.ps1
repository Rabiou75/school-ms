# Builds desktop/embed/ — a self-contained runtime for the packaged app
$ErrorActionPreference = "Stop"
$Root = "D:\school-ms"
$Embed = "$Root\desktop\embed"

Write-Host "`n=== 1. Preparing embed folder ===" -ForegroundColor Cyan
if (Test-Path $Embed) { Remove-Item -Recurse -Force $Embed }
New-Item -ItemType Directory -Force -Path $Embed | Out-Null

Write-Host "`n=== 2. Writing runtime package.json ===" -ForegroundColor Cyan
@'
{
  "name": "school-ms-runtime",
  "version": "1.0.0",
  "private": true,
  "dependencies": {
    "@nestjs/common": "^10.4.4",
    "@nestjs/config": "^3.2.3",
    "@nestjs/core": "^10.4.4",
    "@nestjs/jwt": "^10.2.0",
    "@nestjs/passport": "^10.0.3",
    "@nestjs/platform-express": "^10.4.4",
    "@prisma/client": "^5.22.0",
    "bcryptjs": "^2.4.3",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.1",
    "multer": "^1.4.5-lts.1",
    "nodemailer": "^6.9.15",
    "passport": "^0.7.0",
    "passport-jwt": "^4.0.1",
    "pdfkit": "^0.15.0",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1",
    "zod": "^3.23.8"
  }
}
'@ | Set-Content -Path "$Embed\package.json" -Encoding UTF8

Write-Host "`n=== 3. Installing runtime node_modules (real files, no symlinks) ===" -ForegroundColor Cyan
Push-Location $Embed
npm install --production --no-audit --no-fund --loglevel=error
Pop-Location

Write-Host "`n=== 4. Copying compiled API ===" -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path "$Embed\apps\api\dist" | Out-Null
Copy-Item -Recurse -Force "$Root\apps\api\dist\*" "$Embed\apps\api\dist\"
if (Test-Path "$Root\apps\api\assets") {
    New-Item -ItemType Directory -Force -Path "$Embed\apps\api\assets" | Out-Null
    Copy-Item -Recurse -Force "$Root\apps\api\assets\*" "$Embed\apps\api\assets\"
}

Write-Host "`n=== 5. Copying compiled Web (standalone) ===" -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path "$Embed\apps\web\.next" | Out-Null
if (Test-Path "$Root\apps\web\.next\standalone") {
    Copy-Item -Recurse -Force "$Root\apps\web\.next\standalone" "$Embed\apps\web\.next\standalone"
}
if (Test-Path "$Root\apps\web\.next\static") {
    Copy-Item -Recurse -Force "$Root\apps\web\.next\static" "$Embed\apps\web\.next\static"
}
if (Test-Path "$Root\apps\web\public") {
    Copy-Item -Recurse -Force "$Root\apps\web\public" "$Embed\apps\web\public"
}

# Standalone mode also needs its own node_modules or the runtime one.
# The standalone server.js does `require('next')` etc from its own folder,
# so we symlink-copy the runtime node_modules next to it.
New-Item -ItemType Directory -Force -Path "$Embed\apps\web\node_modules" | Out-Null
if (Test-Path "$Embed\apps\web\.next\standalone\apps\web\node_modules") {
    # Next.js bundles its own minimal node_modules here — keep it
}

Write-Host "`n=== 6. Copying @school/database + @school/shared into node_modules ===" -ForegroundColor Cyan

# Database package
$dbTarget = "$Embed\node_modules\@school\database"
New-Item -ItemType Directory -Force -Path "$dbTarget\dist" | Out-Null
New-Item -ItemType Directory -Force -Path "$dbTarget\prisma" | Out-Null
Copy-Item -Recurse -Force "$Root\packages\database\dist\*" "$dbTarget\dist\"
Copy-Item -Recurse -Force "$Root\packages\database\prisma\schema.prisma" "$dbTarget\prisma\"
if (Test-Path "$Root\packages\database\prisma\seed.js") {
    Copy-Item -Force "$Root\packages\database\prisma\seed.js" "$dbTarget\prisma\seed.js"
}
@'
{
  "name": "@school/database",
  "version": "0.1.0",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts"
}
'@ | Set-Content -Path "$dbTarget\package.json" -Encoding UTF8

# Shared package
$shTarget = "$Embed\node_modules\@school\shared"
New-Item -ItemType Directory -Force -Path "$shTarget\dist" | Out-Null
Copy-Item -Recurse -Force "$Root\packages\shared\dist\*" "$shTarget\dist\"
@'
{
  "name": "@school/shared",
  "version": "0.1.0",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts"
}
'@ | Set-Content -Path "$shTarget\package.json" -Encoding UTF8

Write-Host "`n=== 7. Copying Prisma generated client into embed node_modules ===" -ForegroundColor Cyan

# The generated client lives in .prisma/client (hidden folder)
$prismaSrc = "$Root\node_modules\.pnpm\@prisma+client@5.22.0_prisma@5.22.0\node_modules\.prisma\client"
if (!(Test-Path $prismaSrc)) {
    # Try alternative glob
    $found = Get-ChildItem -Path "$Root\node_modules\.pnpm" -Directory -Filter "@prisma+client*" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($found) {
        $prismaSrc = Join-Path $found.FullName "node_modules\.prisma\client"
    }
}

if (Test-Path $prismaSrc) {
    $prismaDst = "$Embed\node_modules\.prisma\client"
    New-Item -ItemType Directory -Force -Path $prismaDst | Out-Null
    Copy-Item -Recurse -Force "$prismaSrc\*" "$prismaDst\"
    Write-Host "  OK Prisma client copied" -ForegroundColor Green
} else {
    Write-Host "  ! Prisma client not found — API may fail at runtime" -ForegroundColor Yellow
}

Write-Host "`n=== 8. Size check ===" -ForegroundColor Cyan
$sizeMB = [math]::Round((Get-ChildItem $Embed -Recurse -File | Measure-Object -Property Length -Sum).Sum / 1MB, 0)
Write-Host "  Total: $sizeMB MB" -ForegroundColor Yellow

Write-Host "`n=== Build runtime complete ===" -ForegroundColor Green
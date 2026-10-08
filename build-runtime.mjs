import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, cpSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const root = process.cwd();
const embed = join(root, 'desktop', 'embed');

function log(msg) { console.log(msg); }
function ok(msg) { console.log('  OK  ' + msg); }
function warn(msg) { console.log('  !   ' + msg); }

// ============================================================
// 1. Reset embed folder
// ============================================================
log('\n=== 1. Preparing embed folder ===');
if (existsSync(embed)) rmSync(embed, { recursive: true, force: true });
mkdirSync(embed, { recursive: true });
ok('clean');

// ============================================================
// 2. Runtime package.json
// ============================================================
log('\n=== 2. Writing runtime package.json ===');
const runtimePkg = {
  name: 'school-ms-runtime',
  version: '1.0.0',
  private: true,
  dependencies: {
    '@nestjs/common': '^10.4.4',
    '@nestjs/config': '^3.2.3',
    '@nestjs/core': '^10.4.4',
    '@nestjs/jwt': '^10.2.0',
    '@nestjs/passport': '^10.0.3',
    '@nestjs/platform-express': '^10.4.4',
    '@prisma/client': '^5.22.0',
    'bcryptjs': '^2.4.3',
    'class-transformer': '^0.5.1',
    'class-validator': '^0.14.1',
    'multer': '^1.4.5-lts.1',
    'nodemailer': '^6.9.15',
    'passport': '^0.7.0',
    'passport-jwt': '^4.0.1',
    'pdfkit': '^0.15.0',
    'reflect-metadata': '^0.2.2',
    'rxjs': '^7.8.1',
    'zod': '^3.23.8',
  },
};
writeFileSync(join(embed, 'package.json'), JSON.stringify(runtimePkg, null, 2) + '\n', 'utf8');
ok('package.json');

// ============================================================
// 3. Install runtime node_modules
// ============================================================
log('\n=== 3. Installing runtime node_modules (this takes 1-3 min) ===');
try {
  execSync('npm install --production --no-audit --no-fund --loglevel=error', {
    cwd: embed,
    stdio: 'inherit',
    env: { ...process.env },
  });
  ok('npm install done');
} catch (e) {
  warn('npm install failed: ' + e.message);
  process.exit(1);
}

// ============================================================
// 4. Copy compiled API
// ============================================================
log('\n=== 4. Copying compiled API ===');
const apiDist = join(embed, 'apps', 'api', 'dist');
mkdirSync(apiDist, { recursive: true });
cpSync(join(root, 'apps', 'api', 'dist'), apiDist, { recursive: true });
ok('apps/api/dist');

const apiAssetsSrc = join(root, 'apps', 'api', 'assets');
if (existsSync(apiAssetsSrc)) {
  const apiAssetsDst = join(embed, 'apps', 'api', 'assets');
  mkdirSync(apiAssetsDst, { recursive: true });
  cpSync(apiAssetsSrc, apiAssetsDst, { recursive: true });
  ok('apps/api/assets');
}

// ============================================================
// 5. Copy compiled Web (standalone)
// ============================================================
log('\n=== 5. Copying compiled Web ===');
const nextDst = join(embed, 'apps', 'web', '.next');
mkdirSync(nextDst, { recursive: true });

const standaloneSrc = join(root, 'apps', 'web', '.next', 'standalone');
if (existsSync(standaloneSrc)) {
  cpSync(standaloneSrc, join(nextDst, 'standalone'), { recursive: true });
  ok('.next/standalone');
} else {
  warn('.next/standalone missing — did the Web build succeed?');
}

const staticSrc = join(root, 'apps', 'web', '.next', 'static');
if (existsSync(staticSrc)) {
  cpSync(staticSrc, join(nextDst, 'static'), { recursive: true });
  ok('.next/static');
}

const publicSrc = join(root, 'apps', 'web', 'public');
if (existsSync(publicSrc)) {
  cpSync(publicSrc, join(embed, 'apps', 'web', 'public'), { recursive: true });
  ok('public');
}

// ============================================================
// 6. Add @school/database + @school/shared to node_modules
// ============================================================
log('\n=== 6. Adding @school packages ===');

// @school/database
const dbDst = join(embed, 'node_modules', '@school', 'database');
mkdirSync(join(dbDst, 'dist'), { recursive: true });
mkdirSync(join(dbDst, 'prisma'), { recursive: true });
cpSync(join(root, 'packages', 'database', 'dist'), join(dbDst, 'dist'), { recursive: true });
cpSync(join(root, 'packages', 'database', 'prisma', 'schema.prisma'), join(dbDst, 'prisma', 'schema.prisma'));

const seedSrc = join(root, 'packages', 'database', 'prisma', 'seed.js');
if (existsSync(seedSrc)) {
  cpSync(seedSrc, join(dbDst, 'prisma', 'seed.js'));
}

writeFileSync(join(dbDst, 'package.json'), JSON.stringify({
  name: '@school/database',
  version: '0.1.0',
  main: './dist/index.js',
  types: './dist/index.d.ts',
}, null, 2) + '\n', 'utf8');
ok('@school/database');

// @school/shared
const shDst = join(embed, 'node_modules', '@school', 'shared');
mkdirSync(join(shDst, 'dist'), { recursive: true });
cpSync(join(root, 'packages', 'shared', 'dist'), join(shDst, 'dist'), { recursive: true });
writeFileSync(join(shDst, 'package.json'), JSON.stringify({
  name: '@school/shared',
  version: '0.1.0',
  main: './dist/index.js',
  types: './dist/index.d.ts',
}, null, 2) + '\n', 'utf8');
ok('@school/shared');

// ============================================================
// 7. Copy generated Prisma client into .prisma/client
// ============================================================
log('\n=== 7. Copying generated Prisma client ===');
let prismaSrc = null;

// Look for @prisma/client in the pnpm store
const pnpmDir = join(root, 'node_modules', '.pnpm');
if (existsSync(pnpmDir)) {
  const dirs = readdirSync(pnpmDir).filter((d) => d.startsWith('@prisma+client@'));
  if (dirs.length > 0) {
    const candidate = join(pnpmDir, dirs[0], 'node_modules', '.prisma', 'client');
    if (existsSync(candidate)) prismaSrc = candidate;
  }
}

// Fallback: root .prisma folder
if (!prismaSrc) {
  const alt = join(root, 'node_modules', '.prisma', 'client');
  if (existsSync(alt)) prismaSrc = alt;
}

if (prismaSrc) {
  const prismaDst = join(embed, 'node_modules', '.prisma', 'client');
  mkdirSync(prismaDst, { recursive: true });
  cpSync(prismaSrc, prismaDst, { recursive: true });
  ok('Prisma client copied from ' + prismaSrc);
} else {
  warn('Prisma client not found — API will fail at runtime');
}

// ============================================================
// 8. Size check
// ============================================================

// ---- Copy PostgreSQL binaries ----
log('\n=== 7b. Copying PostgreSQL binaries ===');
const pgSrc = join(root, 'desktop', 'pg-bundle', 'postgres');
if (existsSync(pgSrc)) {
  const pgDst = join(embed, 'postgres');
  mkdirSync(pgDst, { recursive: true });
  cpSync(pgSrc, pgDst, { recursive: true });
  ok('postgres/');
} else {
  warn('postgres folder missing — desktop will require system Postgres');
}

log('\n=== 8. Size check ===');
function dirSize(p) {
  let total = 0;
  for (const e of readdirSync(p)) {
    const full = join(p, e);
    const s = statSync(full);
    if (s.isDirectory()) total += dirSize(full);
    else total += s.size;
  }
  return total;
}
const mb = Math.round(dirSize(embed) / 1024 / 1024);
log('  Total: ' + mb + ' MB');

log('\nOK build-runtime.mjs done');
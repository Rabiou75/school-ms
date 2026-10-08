import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

// ============================================================
// 1. Patch desktop/main.js
// ============================================================
{
  const path = join(root, 'desktop/main.js');
  let s = readFileSync(path, 'utf8');

  // --- 1a. Add a global unhandled rejection handler ---
  if (!s.includes('process.on(\'unhandledRejection\'')) {
    s = s.replace(
      "const IS_DEV = !app.isPackaged;",
      "process.on('unhandledRejection', (reason) => {\n  try { require('node:fs').appendFileSync(require('node:path').join(app.getPath('userData'), 'logs', 'unhandled.log'), '[' + new Date().toISOString() + '] ' + (reason?.stack || reason) + '\\n'); } catch {}\n  console.error('[main] Unhandled rejection:', reason);\n});\n\nconst IS_DEV = !app.isPackaged;"
    );
    console.log('  + main.js — global unhandledRejection handler');
  }

  // --- 1b. Point embedded-postgres at the unpacked binaries ---
  const before = [
    "  const pgMod = await import('embedded-postgres');",
    "  const EmbeddedPostgres = pgMod.default || pgMod;",
    "",
    "  pg = new EmbeddedPostgres({",
    "    databaseDir: PGDATA,",
    "    user: 'school',",
    "    password: 'school',",
    "    port: PG_PORT,",
    "    persistent: true,",
    "  });"
  ].join('\n');

  const after = [
    "  const pgMod = await import('embedded-postgres');",
    "  const EmbeddedPostgres = pgMod.default || pgMod;",
    "",
    "  // In a packaged app, node_modules sits inside app.asar (read-only).",
    "  // The Postgres binaries are unpacked to app.asar.unpacked.",
    "  const asarPath = app.getAppPath();",
    "  const unpackedPath = asarPath.replace('app.asar', 'app.asar.unpacked');",
    "  const binariesDir = join(unpackedPath, 'node_modules', '@embedded-postgres', 'windows-x64', 'native', 'bin');",
    "  log('main', 'Binaries dir: ' + binariesDir);",
    "  const hasBinaries = existsSync(join(binariesDir, 'postgres.exe'));",
    "  log('main', 'Binaries present: ' + hasBinaries);",
    "",
    "  const opts = {",
    "    databaseDir: PGDATA,",
    "    user: 'school',",
    "    password: 'school',",
    "    port: PG_PORT,",
    "    persistent: true,",
    "  };",
    "  if (hasBinaries) opts.binariesDir = binariesDir;",
    "",
    "  pg = new EmbeddedPostgres(opts);"
  ].join('\n');

  if (s.includes(before)) {
    s = s.replace(before, after);
    console.log('  + main.js — binariesDir points to app.asar.unpacked');
  } else if (s.includes('binariesDir')) {
    console.log('  = main.js already patched');
  } else {
    console.log('  ! main.js anchor not found');
  }

  writeFileSync(path, s, 'utf8');
}

// ============================================================
// 2. Broaden asarUnpack in electron-builder.yml
// ============================================================
{
  const path = join(root, 'desktop/electron-builder.yml');
  let s = readFileSync(path, 'utf8');

  const before = [
    "asarUnpack:",
    "  - '**/node_modules/embedded-postgres/**'",
    "  - '**/node_modules/@embedded-postgres/**'"
  ].join('\n');

  const after = [
    "asarUnpack:",
    "  - '**/embedded-postgres/**'",
    "  - '**/@embedded-postgres/**'",
    "  - '**/*.exe'",
    "  - '**/*.dll'"
  ].join('\n');

  if (s.includes(before)) {
    s = s.replace(before, after);
    writeFileSync(path, s, 'utf8');
    console.log('  + electron-builder.yml — broadened asarUnpack');
  } else if (s.includes("'**/*.exe'")) {
    console.log('  = electron-builder.yml already patched');
  } else {
    console.log('  ! electron-builder.yml anchor not found');
  }
}

console.log('\nOK fix-desktop-asar.mjs done');
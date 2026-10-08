import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

// ============================================================
// 1. main.js — skip embedded Postgres, use system Postgres
// ============================================================
{
  const p = join(root, 'desktop/main.js');
  let s = readFileSync(p, 'utf8');

  // Replace entire startPostgres() body with a no-op
  const startMarker = 'async function startPostgres() {';
  const endMarker   = '// -------- Run migrations + seed --------';

  const si = s.indexOf(startMarker);
  const ei = s.indexOf(endMarker);

  if (si === -1 || ei === -1) {
    console.log('  ! startPostgres block not found');
  } else {
    const replacement = [
      "async function startPostgres() {",
      "  // Uses the PostgreSQL installation that ships with the school's Windows machine.",
      "  // Configure the connection in %APPDATA%\\School MS\\.env — see setup instructions.",
      "  setSplashStatus('Checking database...');",
      "",
      "  const net = require('node:net');",
      "  const pgHost = process.env.SCHOOL_PG_HOST || 'localhost';",
      "  const pgPort = Number(process.env.SCHOOL_PG_PORT) || 5432;",
      "",
      "  log('main', 'Checking Postgres at ' + pgHost + ':' + pgPort);",
      "",
      "  const up = await new Promise((resolve) => {",
      "    const s = net.connect(pgPort, pgHost);",
      "    s.on('connect', () => { s.destroy(); resolve(true); });",
      "    s.on('error', () => resolve(false));",
      "    setTimeout(() => resolve(false), 3000);",
      "  });",
      "",
      "  if (!up) {",
      "    throw new Error(",
      "      'PostgreSQL is not running on ' + pgHost + ':' + pgPort + '.\\n\\n' +",
      "      'Install PostgreSQL 18 from https://www.postgresql.org/download/windows/ ' +",
      "      'or start the existing service.\\n\\n' +",
      "      'Then create the database and user:\\n' +",
      "      '  CREATE USER school WITH PASSWORD \\'school\\' CREATEDB;\\n' +",
      "      '  CREATE DATABASE school_ms OWNER school;\\n'",
      "    );",
      "  }",
      "",
      "  log('main', 'Postgres is reachable');",
      "}",
      "",
      ""
    ].join('\n');

    s = s.slice(0, si) + replacement + s.slice(ei);
    console.log('  + startPostgres rewritten (system Postgres)');
  }

  // Update all DATABASE_URL references
  s = s.replace(
    /DATABASE_URL:\s*'postgresql:\/\/school:school@localhost:'\s*\+\s*PG_PORT\s*\+\s*'\/school_ms\?schema=public'/g,
    "DATABASE_URL: 'postgresql://school:school@' + (process.env.SCHOOL_PG_HOST || 'localhost') + ':' + (process.env.SCHOOL_PG_PORT || '5432') + '/school_ms?schema=public'"
  );
  s = s.replace(
    /DATABASE_URL:\s*'postgresql:\/\/school:school@localhost:\d+\/school_ms\?schema=public'/g,
    "DATABASE_URL: 'postgresql://school:school@' + (process.env.SCHOOL_PG_HOST || 'localhost') + ':' + (process.env.SCHOOL_PG_PORT || '5432') + '/school_ms?schema=public'"
  );
  console.log('  + DATABASE_URL now points at system Postgres');

  // Skip embedded Postgres shutdown on quit
  s = s.replace(
    "  try { if (pg) await pg.stop(); } catch {}",
    "  // no embedded Postgres to stop"
  );

  writeFileSync(p, s, 'utf8');
}

// ============================================================
// 2. package.json — drop embedded-postgres dependency
// ============================================================
{
  const p = join(root, 'desktop/package.json');
  const pkg = JSON.parse(readFileSync(p, 'utf8'));
  delete pkg.dependencies['embedded-postgres'];
  pkg.dependencies = pkg.dependencies || {};
  writeFileSync(p, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
  console.log('  + removed embedded-postgres dependency');
}

// ============================================================
// 3. electron-builder.yml — drop embedded-postgres from extraResources
// ============================================================
{
  const p = join(root, 'desktop/electron-builder.yml');
  let s = readFileSync(p, 'utf8');
  // Nothing to remove; embedded-postgres was in node_modules, not extraResources
  console.log('  = electron-builder.yml — no changes needed');
}

console.log('\nOK desktop now uses system Postgres');
console.log('');
console.log('IMPORTANT:');
console.log('  The target machine must have PostgreSQL 18 installed.');
console.log('  Setup commands (run once in psql as postgres superuser):');
console.log('    CREATE USER school WITH PASSWORD \'school\' CREATEDB;');
console.log('    CREATE DATABASE school_ms OWNER school;');
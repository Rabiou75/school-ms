import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const root = process.cwd();
const pgDir = join(root, 'desktop', 'embed', 'postgres');

// EnterpriseDB direct download URL (may change per release)
const PG_URL = 'https://get.enterprisedb.com/postgresql/postgresql-18.1-1-windows-x64-binaries.zip';

const zipPath = join(root, 'desktop', 'pg-binaries.zip');

if (existsSync(join(pgDir, 'bin', 'pg_ctl.exe'))) {
  console.log('OK Postgres already present at ' + pgDir);
  process.exit(0);
}

mkdirSync(join(root, 'desktop', 'embed'), { recursive: true });

console.log('Downloading PostgreSQL 18 binaries (~90 MB)...');
console.log('From: ' + PG_URL);
console.log('This takes 2-5 minutes on a slow connection.');

try {
  execSync(`curl.exe -L -o "${zipPath}" "${PG_URL}"`, { stdio: 'inherit' });
} catch (e) {
  console.error('Download failed: ' + e.message);
  console.log('');
  console.log('Manual download:');
  console.log('  1. Open https://www.enterprisedb.com/download-postgresql-binaries');
  console.log('  2. Download "Windows x86-64" ZIP (~100 MB)');
  console.log('  3. Save to: ' + zipPath);
  console.log('  4. Re-run: node get-postgres.mjs');
  process.exit(1);
}

console.log('Extracting...');
const tmp = join(root, 'desktop', 'pg-extract-tmp');
if (existsSync(tmp)) rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });

execSync(`tar.exe -xf "${zipPath}" -C "${tmp}"`, { stdio: 'inherit' });

// The zip contains a top-level folder like "pgsql"
import { readdirSync } from 'node:fs';
const top = readdirSync(tmp)[0];
const srcDir = join(tmp, top);

// Move to final location
if (existsSync(pgDir)) rmSync(pgDir, { recursive: true, force: true });
execSync(`robocopy "${srcDir}" "${pgDir}" /E /NFL /NDL /NJH /NJS /NC /NS /NP`, { stdio: 'ignore' });

// Clean up
rmSync(tmp, { recursive: true, force: true });
rmSync(zipPath, { force: true });

// Verify
const mustHave = ['bin/pg_ctl.exe', 'bin/postgres.exe', 'bin/initdb.exe', 'bin/psql.exe'];
for (const f of mustHave) {
  const exists = existsSync(join(pgDir, f));
  console.log('  ' + (exists ? 'OK ' : 'MISSING ') + f);
}

console.log('\nOK PostgreSQL staged at: ' + pgDir);
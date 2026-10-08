import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const path = join(process.cwd(), 'desktop', 'main.js');
let s = readFileSync(path, 'utf8');

// Find the startPostgres function
const startMarker = 'async function startPostgres() {';
const endMarker = '// -------- Run migrations + seed --------';

const si = s.indexOf(startMarker);
const ei = s.indexOf(endMarker);

if (si === -1 || ei === -1) {
  console.error('Cannot find startPostgres block');
  process.exit(1);
}

const newFunc = `async function startPostgres() {
  setSplashStatus('Checking database...');

  const net = require('node:net');

  // Priority: 1) system Postgres on 5432, 2) bundled Postgres on 55432
  const systemUp = await portOpen('localhost', 5432, 1000);
  if (systemUp) {
    log('main', 'Found system Postgres on 5432');
    process.env.SCHOOL_PG_PORT = '5432';
    return;
  }

  log('main', 'No system Postgres - starting bundled instance');
  await startBundledPostgres();
}

function portOpen(host, port, timeoutMs) {
  return new Promise((resolve) => {
    const s = require('node:net').connect(port, host);
    let done = false;
    s.on('connect', () => { if (!done) { done = true; s.destroy(); resolve(true); } });
    s.on('error', () => { if (!done) { done = true; resolve(false); } });
    setTimeout(() => { if (!done) { done = true; s.destroy(); resolve(false); } }, timeoutMs);
  });
}

async function startBundledPostgres() {
  const pgBin = join(RUNTIME, 'postgres', 'bin');
  const pgCtl = join(pgBin, 'pg_ctl.exe');
  const initdb = join(pgBin, 'initdb.exe');
  const dataDir = join(USER_DATA, 'pgdata');
  const logFile = join(LOGS, 'postgres.log');

  if (!existsSync(pgCtl)) {
    throw new Error('pg_ctl.exe not found at ' + pgCtl);
  }

  const initialized = existsSync(join(dataDir, 'PG_VERSION'));

  if (!initialized) {
    setSplashStatus('Creating database...');
    log('main', 'Running initdb');
    if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

    // initdb with text encoding UTF8, no locale issues
    await runProcess(initdb, [
      '-D', dataDir,
      '-U', 'school',
      '-A', 'trust',
      '-E', 'UTF8',
      '--no-locale',
    ], 'initdb');

    // Set password (trust for localhost only, we add auth below)
    log('main', 'initdb complete');
  }

  setSplashStatus('Starting database...');
  log('main', 'Starting bundled Postgres on port 55432');

  // pg_ctl start: it de-elevates postgres automatically via CreateProcessAsUser
  await runProcess(pgCtl, [
    '-D', dataDir,
    '-l', logFile,
    '-o', '-p 55432 -c listen_addresses=127.0.0.1',
    '-w',
    'start',
  ], 'pg_ctl', 60000);

  // Wait for port
  for (let i = 0; i < 30; i++) {
    if (await portOpen('127.0.0.1', 55432, 1000)) {
      log('main', 'Postgres is up on 55432');
      process.env.SCHOOL_PG_PORT = '55432';
      break;
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  // Create the DB if it doesn't exist
  const psql = join(pgBin, 'psql.exe');
  await runProcess(psql, [
    '-U', 'school',
    '-h', '127.0.0.1',
    '-p', '55432',
    '-d', 'postgres',
    '-tAc', "SELECT 1 FROM pg_database WHERE datname='school_ms'",
  ], 'psql-check').then(async (out) => {
    if (!out.includes('1')) {
      log('main', 'Creating database school_ms');
      await runProcess(psql, [
        '-U', 'school',
        '-h', '127.0.0.1',
        '-p', '55432',
        '-d', 'postgres',
        '-c', 'CREATE DATABASE school_ms',
      ], 'psql-create');
    }
  });
}

function runProcess(exe, args, tag, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const { spawn } = require('node:child_process');
    const p = spawn(exe, args, { windowsHide: true });
    let stdout = '', stderr = '';
    p.stdout.on('data', (d) => { stdout += d.toString(); });
    p.stderr.on('data', (d) => { stderr += d.toString(); });
    const timer = setTimeout(() => {
      try { p.kill(); } catch {}
      reject(new Error(tag + ' timeout'));
    }, timeoutMs);
    p.on('exit', (code) => {
      clearTimeout(timer);
      if (stdout.trim()) log(tag, stdout.trim().slice(0, 500));
      if (stderr.trim()) log(tag + ':err', stderr.trim().slice(0, 500));
      if (code === 0) resolve(stdout);
      else reject(new Error(tag + ' exited ' + code));
    });
    p.on('error', (e) => { clearTimeout(timer); reject(e); });
  });
}

async function stopBundledPostgres() {
  const pgBin = join(RUNTIME, 'postgres', 'bin');
  const pgCtl = join(pgBin, 'pg_ctl.exe');
  const dataDir = join(USER_DATA, 'pgdata');
  if (!existsSync(pgCtl)) return;
  try {
    await runProcess(pgCtl, ['-D', dataDir, '-m', 'fast', '-w', 'stop'], 'pg_ctl-stop', 15000);
    log('main', 'Postgres stopped');
  } catch (e) {
    log('main', 'Postgres stop failed: ' + e.message);
  }
}

`;

s = s.slice(0, si) + newFunc + s.slice(ei);

// Update DATABASE_URL to use SCHOOL_PG_PORT
s = s.replace(
  /DATABASE_URL: 'postgresql:\/\/school:school@[^']+'/g,
  "DATABASE_URL: 'postgresql://school:school@127.0.0.1:' + (process.env.SCHOOL_PG_PORT || '5432') + '/school_ms?schema=public'"
);

// Replace shutdown to use pg_ctl stop
s = s.replace(
  /try \{ if \(pg\) await pg\.stop\(\); \} catch \{\}/,
  "try { await stopBundledPostgres(); } catch {}"
);

s = s.replace(
  /\/\/ no embedded Postgres to stop/,
  "try { await stopBundledPostgres(); } catch {}"
);

writeFileSync(path, s, 'utf8');
console.log('OK main.js updated to use bundled Postgres');
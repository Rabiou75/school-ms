import { readFileSync, writeFileSync } from 'node:fs';

const mainPath = 'D:\\school-ms\\desktop\\main.js';
let s = readFileSync(mainPath, 'utf8');

const startMarker = 'async function startPostgres() {';
const endMarker = '// -------- Run migrations + seed --------';

const si = s.indexOf(startMarker);
const ei = s.indexOf(endMarker);

if (si === -1 || ei === -1) {
  console.error('Cannot find startPostgres block');
  console.error('  startMarker at:', si);
  console.error('  endMarker at:', ei);
  process.exit(1);
}

const newFunc = [
  'async function startPostgres() {',
  "  setSplashStatus('Checking database...');",
  '',
  "  const systemUp = await portOpen('localhost', 5432, 1000);",
  '  if (systemUp) {',
  "    log('main', 'Found system Postgres on 5432');",
  "    process.env.SCHOOL_PG_PORT = '5432';",
  '    return;',
  '  }',
  '',
  "  log('main', 'Starting bundled PostgreSQL');",
  '  await startBundledPostgres();',
  '}',
  '',
  'function portOpen(host, port, timeoutMs) {',
  '  return new Promise((resolve) => {',
  "    const net = require('node:net');",
  '    const s = net.connect(port, host);',
  '    let done = false;',
  "    s.on('connect', () => { if (!done) { done = true; s.destroy(); resolve(true); } });",
  "    s.on('error', () => { if (!done) { done = true; resolve(false); } });",
  "    setTimeout(() => { if (!done) { done = true; s.destroy(); resolve(false); } }, timeoutMs);",
  '  });',
  '}',
  '',
  'async function startBundledPostgres() {',
  "  const pgBin = join(RUNTIME, 'postgres', 'bin');",
  "  const pgCtl = join(pgBin, 'pg_ctl.exe');",
  "  const initdb = join(pgBin, 'initdb.exe');",
  "  const psql = join(pgBin, 'psql.exe');",
  "  const dataDir = join(USER_DATA, 'pgdata');",
  "  const logFile = join(LOGS, 'postgres.log');",
  '',
  '  if (!existsSync(pgCtl)) {',
  "    throw new Error('pg_ctl.exe not found at ' + pgCtl);",
  '  }',
  '',
  "  const initialized = existsSync(join(dataDir, 'PG_VERSION'));",
  '',
  '  if (!initialized) {',
  "    setSplashStatus('Creating database cluster...');",
  "    log('main', 'Running initdb');",
  '    if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });',
  '',
  '    await runProcess(initdb, [',
  "      '-D', dataDir,",
  "      '-U', 'school',",
  "      '-A', 'trust',",
  "      '-E', 'UTF8',",
  "      '--no-locale',",
  "    ], 'initdb', 120000);",
  '  }',
  '',
  "  setSplashStatus('Starting database...');",
  "  log('main', 'Starting Postgres on 55432');",
  '',
  '  await runProcess(pgCtl, [',
  "    '-D', dataDir,",
  "    '-l', logFile,",
  "    '-o', '-p 55432 -c listen_addresses=127.0.0.1',",
  "    '-w',",
  "    'start',",
  "  ], 'pg_ctl', 90000);",
  '',
  '  for (let i = 0; i < 30; i++) {',
  "    if (await portOpen('127.0.0.1', 55432, 1000)) {",
  "      log('main', 'Postgres is up on 55432');",
  "      process.env.SCHOOL_PG_PORT = '55432';",
  '      break;',
  '    }',
  '    await new Promise((r) => setTimeout(r, 500));',
  '  }',
  '',
  '  try {',
  '    const out = await runProcess(psql, [',
  "      '-U', 'school',",
  "      '-h', '127.0.0.1',",
  "      '-p', '55432',",
  "      '-d', 'postgres',",
  "      '-tAc', \"SELECT 1 FROM pg_database WHERE datname='school_ms'\",",
  "    ], 'psql-check', 15000);",
  '',
  "    if (!out.includes('1')) {",
  "      log('main', 'Creating database school_ms');",
  '      await runProcess(psql, [',
  "        '-U', 'school',",
  "        '-h', '127.0.0.1',",
  "        '-p', '55432',",
  "        '-d', 'postgres',",
  "        '-c', 'CREATE DATABASE school_ms',",
  "      ], 'psql-create', 15000);",
  '    }',
  '  } catch (e) {',
  "    log('main', 'DB check warning: ' + e.message);",
  '  }',
  '}',
  '',
  'function runProcess(exe, args, tag, timeoutMs) {',
  '  timeoutMs = timeoutMs || 30000;',
  '  return new Promise((resolve, reject) => {',
  "    const { spawn } = require('node:child_process');",
  '    const p = spawn(exe, args, { windowsHide: true });',
  "    let stdout = '', stderr = '';",
  "    p.stdout.on('data', (d) => { stdout += d.toString(); });",
  "    p.stderr.on('data', (d) => { stderr += d.toString(); });",
  '    const timer = setTimeout(() => {',
  '      try { p.kill(); } catch (e) {}',
  "      reject(new Error(tag + ' timeout'));",
  '    }, timeoutMs);',
  "    p.on('exit', (code) => {",
  '      clearTimeout(timer);',
  '      if (stdout.trim()) log(tag, stdout.trim().slice(0, 500));',
  "      if (stderr.trim()) log(tag + ':err', stderr.trim().slice(0, 500));",
  '      if (code === 0) resolve(stdout);',
  "      else reject(new Error(tag + ' exited ' + code));",
  '    });',
  "    p.on('error', (e) => { clearTimeout(timer); reject(e); });",
  '  });',
  '}',
  '',
  'async function stopBundledPostgres() {',
  "  const pgBin = join(RUNTIME, 'postgres', 'bin');",
  "  const pgCtl = join(pgBin, 'pg_ctl.exe');",
  "  const dataDir = join(USER_DATA, 'pgdata');",
  '  if (!existsSync(pgCtl)) return;',
  '  try {',
  "    await runProcess(pgCtl, ['-D', dataDir, '-m', 'fast', '-w', 'stop'], 'pg_ctl-stop', 15000);",
  "    log('main', 'Postgres stopped');",
  '  } catch (e) {',
  "    log('main', 'Postgres stop warning: ' + e.message);",
  '  }',
  '}',
  '',
  '',
].join('\n');

s = s.slice(0, si) + newFunc + s.slice(ei);

s = s.replace(
  /DATABASE_URL: 'postgresql:\/\/school:school@[^']+'/g,
  "DATABASE_URL: 'postgresql://school:school@127.0.0.1:' + (process.env.SCHOOL_PG_PORT || '5432') + '/school_ms?schema=public'"
);

s = s.replace(
  /try \{ if \(pg\) await pg\.stop\(\); \} catch \{\}/,
  'try { await stopBundledPostgres(); } catch (e) {}'
);

writeFileSync(mainPath, s, 'utf8');
console.log('OK main.js updated to use bundled Postgres');
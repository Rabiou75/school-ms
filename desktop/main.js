const { app, BrowserWindow, dialog, shell } = require('electron');
const { spawn, fork } = require('node:child_process');
const { existsSync, mkdirSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
const path = require('node:path');

process.on('unhandledRejection', (reason) => {
  try { require('node:fs').appendFileSync(require('node:path').join(app.getPath('userData'), 'logs', 'unhandled.log'), '[' + new Date().toISOString() + '] ' + (reason?.stack || reason) + '\n'); } catch {}
  console.error('[main] Unhandled rejection:', reason);
});

const IS_DEV = !app.isPackaged;
const USER_DATA = app.getPath('userData');
const RESOURCES = app.isPackaged ? process.resourcesPath : join(__dirname, '..');
const RUNTIME = app.isPackaged ? join(RESOURCES, 'runtime') : join(__dirname, '..');

const PG_PORT = 55432;
const API_PORT = 4400;
const WEB_PORT = 3300;

const PGDATA = join(USER_DATA, 'pgdata');
const UPLOADS = join(USER_DATA, 'uploads');
const LOGS = join(USER_DATA, 'logs');

[PGDATA, UPLOADS, LOGS].forEach((d) => { if (!existsSync(d)) mkdirSync(d, { recursive: true }); });

let splash = null;
let mainWindow = null;
let pg = null;
let apiProc = null;
let webProc = null;

// -------- Logging --------
function log(name, msg) {
  const line = '[' + new Date().toISOString() + '] ' + msg + '\n';
  try { require('node:fs').appendFileSync(join(LOGS, name + '.log'), line); } catch {}
  process.stdout.write('[' + name + '] ' + msg + '\n');
}

// -------- Splash screen --------
function createSplash() {
  splash = new BrowserWindow({
    width: 400, height: 260,
    frame: false, transparent: false,
    resizable: false, alwaysOnTop: true,
    webPreferences: { contextIsolation: true },
  });
  splash.loadFile(join(__dirname, 'splash.html'));
}

function setSplashStatus(status) {
  if (splash && !splash.isDestroyed()) {
    splash.webContents.executeJavaScript('window.setStatus(' + JSON.stringify(status) + ')').catch(() => {});
  }
}

// -------- Postgres --------
async function startPostgres() {
  setSplashStatus('Checking database...');

  const systemUp = await portOpen('localhost', 5432, 1000);
  if (systemUp) {
    log('main', 'Found system Postgres on 5432');
    process.env.SCHOOL_PG_PORT = '5432';
    return;
  }

  log('main', 'Starting bundled PostgreSQL');
  await startBundledPostgres();
}

function portOpen(host, port, timeoutMs) {
  return new Promise((resolve) => {
    const net = require('node:net');
    const s = net.connect(port, host);
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
  const psql = join(pgBin, 'psql.exe');
  const dataDir = join(USER_DATA, 'pgdata');
  const logFile = join(LOGS, 'postgres.log');

  if (!existsSync(pgCtl)) {
    throw new Error('pg_ctl.exe not found at ' + pgCtl);
  }

  const initialized = existsSync(join(dataDir, 'PG_VERSION'));

  if (!initialized) {
    setSplashStatus('Creating database cluster...');
    log('main', 'Running initdb');
    if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

    await runProcess(initdb, [
      '-D', dataDir,
      '-U', 'school',
      '-A', 'trust',
      '-E', 'UTF8',
      '--no-locale',
    ], 'initdb', 120000);
  }

  setSplashStatus('Starting database...');
  log('main', 'Starting Postgres on 55432');

  await runProcess(pgCtl, [
    '-D', dataDir,
    '-l', logFile,
    '-o', '-p 55432 -c listen_addresses=127.0.0.1',
    '-w',
    'start',
  ], 'pg_ctl', 90000);

  for (let i = 0; i < 30; i++) {
    if (await portOpen('127.0.0.1', 55432, 1000)) {
      log('main', 'Postgres is up on 55432');
      process.env.SCHOOL_PG_PORT = '55432';
      break;
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  try {
    const out = await runProcess(psql, [
      '-U', 'school',
      '-h', '127.0.0.1',
      '-p', '55432',
      '-d', 'postgres',
      '-tAc', "SELECT 1 FROM pg_database WHERE datname='school_ms'",
    ], 'psql-check', 15000);

    if (!out.includes('1')) {
      log('main', 'Creating database school_ms');
      await runProcess(psql, [
        '-U', 'school',
        '-h', '127.0.0.1',
        '-p', '55432',
        '-d', 'postgres',
        '-c', 'CREATE DATABASE school_ms',
      ], 'psql-create', 15000);
    }
  } catch (e) {
    log('main', 'DB check warning: ' + e.message);
  }
}

function runProcess(exe, args, tag, timeoutMs) {
  timeoutMs = timeoutMs || 30000;
  return new Promise((resolve, reject) => {
    const { spawn } = require('node:child_process');
    const p = spawn(exe, args, { windowsHide: true });
    let stdout = '', stderr = '';
    p.stdout.on('data', (d) => { stdout += d.toString(); });
    p.stderr.on('data', (d) => { stderr += d.toString(); });
    const timer = setTimeout(() => {
      try { p.kill(); } catch (e) {}
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
    log('main', 'Postgres stop warning: ' + e.message);
  }
}

// -------- Run migrations + seed --------
async function migrateIfNeeded() {
  setSplashStatus('Preparing database...');

  const prismaCli = join(RUNTIME, 'node_modules', 'prisma', 'build', 'index.js');
  const schemaPath = join(RUNTIME, 'node_modules', '@school', 'database', 'prisma', 'schema.prisma');
  const seedPath = join(RUNTIME, 'node_modules', '@school', 'database', 'prisma', 'seed.js');

  const env = {
    ...process.env,
    DATABASE_URL: 'postgresql://school:school@' + (process.env.SCHOOL_PG_HOST || 'localhost') + ':' + (process.env.SCHOOL_PG_PORT || '5432') + '/school_ms?schema=public',
  };

  // Migrate
  if (existsSync(prismaCli) && existsSync(schemaPath)) {
    log('main', 'Running prisma migrate deploy');
    await runNode(prismaCli, ['migrate', 'deploy', '--schema', schemaPath], env, 'migrate');
  } else {
    log('main', 'Prisma CLI not found at ' + prismaCli);
  }

  // Seed (idempotent — safe to run every start)
  if (existsSync(seedPath)) {
    log('main', 'Running seed');
    await runNode(seedPath, [], env, 'seed').catch((e) => log('main', 'Seed warning: ' + e.message));
  }
}

function runNode(scriptPath, args, env, tag) {
  return new Promise((resolve, reject) => {
    const p = fork(scriptPath, args, { env, silent: true, execArgv: [] });
    p.stdout?.on('data', (d) => log(tag, d.toString().trim()));
    p.stderr?.on('data', (d) => log(tag + ':err', d.toString().trim()));
    p.on('exit', (code) => code === 0 ? resolve() : reject(new Error(tag + ' exited ' + code)));
    p.on('error', reject);
    setTimeout(() => { try { p.kill(); } catch {} ; reject(new Error(tag + ' timeout')); }, 120000);
  });
}

// -------- Spawn API --------
async function startApi() {
  setSplashStatus('Starting server...');
  log('main', 'Starting API');

  const apiEntry = join(RUNTIME, 'apps', 'api', 'dist', 'main.js');
  if (!existsSync(apiEntry)) throw new Error('API entry missing: ' + apiEntry);

  apiProc = spawn(process.execPath, [apiEntry], {
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      NODE_ENV: 'production',
      API_PORT: String(API_PORT),
      NODE_OPTIONS: '--dns-result-order=ipv4first',
      DATABASE_URL: 'postgresql://school:school@' + (process.env.SCHOOL_PG_HOST || 'localhost') + ':' + (process.env.SCHOOL_PG_PORT || '5432') + '/school_ms?schema=public',
      JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || 'desktop_jwt_access_' + 'x'.repeat(20),
      JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'desktop_jwt_refresh_' + 'x'.repeat(20),
      JWT_ACCESS_TTL: '12h',
      JWT_REFRESH_TTL: '30d',
      UPLOAD_DIR: UPLOADS,
          NODE_PATH: join(RUNTIME, 'node_modules'),
},
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  apiProc.stdout.on('data', (d) => log('api', d.toString().trim()));
  apiProc.stderr.on('data', (d) => log('api:err', d.toString().trim()));
  apiProc.on('exit', (code) => log('main', 'API exited with ' + code));

  await waitForPort(API_PORT, 60000);
  log('main', 'API up on ' + API_PORT);
}

// -------- Spawn Web --------
async function startWeb() {
  setSplashStatus('Starting interface...');
  log('main', 'Starting Web');

  const webEntry = join(RUNTIME, 'apps', 'web', '.next', 'standalone', 'apps', 'web', 'server.js');
  const fallback = join(RUNTIME, 'apps', 'web', '.next', 'standalone', 'server.js');
  const entry = existsSync(webEntry) ? webEntry : fallback;

  if (!existsSync(entry)) throw new Error('Web entry missing. Looked at:\n' + webEntry + '\n' + fallback);

  webProc = spawn(process.execPath, [entry], {
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      NODE_ENV: 'production',
      PORT: String(WEB_PORT),
      HOSTNAME: '0.0.0.0',
      NODE_OPTIONS: '--dns-result-order=ipv4first',
      API_INTERNAL_URL: 'http://127.0.0.1:' + API_PORT,
      NEXT_PUBLIC_API_URL: 'http://127.0.0.1:' + API_PORT,
          NODE_PATH: join(RUNTIME, 'node_modules'),
},
    cwd: join(RUNTIME, 'apps', 'web'),
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  webProc.stdout.on('data', (d) => log('web', d.toString().trim()));
  webProc.stderr.on('data', (d) => log('web:err', d.toString().trim()));
  webProc.on('exit', (code) => log('main', 'Web exited with ' + code));

  await waitForPort(WEB_PORT, 60000);
  log('main', 'Web up on ' + WEB_PORT);
}

// -------- Port waiter --------
function waitForPort(port, timeoutMs) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const net = require('node:net');
    function tryOnce() {
      const s = net.connect(port, '127.0.0.1');
      s.on('connect', () => { s.destroy(); resolve(); });
      s.on('error', () => {
        s.destroy();
        if (Date.now() - started > timeoutMs) return reject(new Error('Timeout waiting for port ' + port));
        setTimeout(tryOnce, 500);
      });
    }
    tryOnce();
  });
}

// -------- Main window --------
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400, height: 900,
    minWidth: 1000, minHeight: 700,
    backgroundColor: '#f3f4f6',
    show: false,
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });

  mainWindow.loadURL('http://localhost:' + WEB_PORT + '/fr/login');

  mainWindow.once('ready-to-show', () => {
    if (splash) splash.destroy();
    mainWindow.show();
  });

  // External links open in the system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// -------- Error screen --------
function showError(err) {
  log('main', 'FATAL: ' + (err?.stack || err?.message || String(err)));
  if (splash) splash.destroy();
  dialog.showErrorBox(
    'School MS - Startup Failed',
    'The application failed to start.\n\n' +
    (err?.message || String(err)) + '\n\n' +
    'Logs: ' + LOGS
  );
  app.quit();
}

// -------- Lifecycle --------
app.whenReady().then(async () => {
  createSplash();
  try {
    await startPostgres();
    await migrateIfNeeded();
    await startApi();
    await startWeb();
    createWindow();
  } catch (e) {
    showError(e);
  }
});

app.on('window-all-closed', () => { app.quit(); });

app.on('before-quit', async (e) => {
  log('main', 'Shutting down...');
  try { if (webProc) webProc.kill(); } catch {}
  try { if (apiProc) apiProc.kill(); } catch {}
  // no embedded Postgres to stop
});

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const path = join(process.cwd(), 'desktop/main.js');
let s = readFileSync(path, 'utf8');

// ---- 1. Web: bind on 0.0.0.0 so both ::1 and 127.0.0.1 work ----
const webBefore = "      PORT: String(WEB_PORT),\n      HOSTNAME: '127.0.0.1',";
const webAfter  = "      PORT: String(WEB_PORT),\n      HOSTNAME: '0.0.0.0',\n      NODE_OPTIONS: '--dns-result-order=ipv4first',";

if (s.includes(webBefore)) {
  s = s.replace(webBefore, webAfter);
  console.log('  + Web: HOSTNAME=0.0.0.0 + ipv4-first DNS');
} else if (s.includes("HOSTNAME: '0.0.0.0'")) {
  console.log('  = Web already patched');
}

// ---- 2. API: add ipv4-first DNS ----
if (!s.match(/API_PORT.*\n.*NODE_OPTIONS/)) {
  s = s.replace(
    "      API_PORT: String(API_PORT),",
    "      API_PORT: String(API_PORT),\n      NODE_OPTIONS: '--dns-result-order=ipv4first',"
  );
  console.log('  + API: ipv4-first DNS');
}

// ---- 3. BrowserWindow: load via localhost (matches Next.js's internal view) ----
s = s.replace(
  "mainWindow.loadURL('http://127.0.0.1:' + WEB_PORT + '/fr/login');",
  "mainWindow.loadURL('http://localhost:' + WEB_PORT + '/fr/login');"
);
console.log('  + BrowserWindow: loads http://localhost:' + "' + WEB_PORT + '" + '/fr/login');

writeFileSync(path, s, 'utf8');
console.log('\nOK main.js patched');
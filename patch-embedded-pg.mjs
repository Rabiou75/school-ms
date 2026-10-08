import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const baseDir = join(root, 'desktop/node_modules/embedded-postgres');

if (!existsSync(baseDir)) {
  console.log('! embedded-postgres not found at ' + baseDir);
  process.exit(1);
}

// Find the dist entry
const distDir = join(baseDir, 'dist');
let target = null;

function findCandidate(dir) {
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir);
  for (const f of files) {
    if (f === 'index.js' || f === 'index.cjs' || f === 'index.mjs') return join(dir, f);
  }
  return null;
}

target = findCandidate(distDir);
if (!target) target = findCandidate(baseDir);

if (!target) {
  console.log('! could not find dist file');
  console.log('Contents of ' + distDir + ':');
  try { console.log(readdirSync(distDir)); } catch {}
  process.exit(1);
}

console.log('Patching: ' + target);
let s = readFileSync(target, 'utf8');
const original = s;

// ---- 1. Replace ALL chmod calls with a Windows no-op wrapper ----
// Matches: fs.promises.chmod(  |  fs.chmod(  |  chmodSync(  |  chmod(
// We do text replacement carefully to not double-patch.
const patches = [
  { from: /\bawait\s+fs\.promises\.chmod\(/g, to: 'await (process.platform === "win32" ? Promise.resolve : fs.promises.chmod)(' },
  { from: /\bfs\.promises\.chmod\(/g,        to: '(process.platform === "win32" ? () => Promise.resolve() : fs.promises.chmod)(' },
  { from: /\bawait\s+fs\.chmod\(/g,          to: 'await (process.platform === "win32" ? Promise.resolve : fs.chmod)(' },
  { from: /\bfs\.chmod\(/g,                  to: '(process.platform === "win32" ? () => Promise.resolve() : fs.chmod)(' },
  { from: /\bawait\s+chmod\(/g,              to: 'await (process.platform === "win32" ? Promise.resolve : chmod)(' },
  { from: /(?<![.\w])chmod\(/g,              to: '(process.platform === "win32" ? () => Promise.resolve() : chmod)(' },
];

let total = 0;
for (const p of patches) {
  const matches = s.match(p.from);
  if (matches) {
    s = s.replace(p.from, p.to);
    total += matches.length;
    console.log('  chmod pattern: ' + matches.length + ' replacements');
  }
}

// ---- 2. Force asar.unpacked resolution for the binaries dir ----
// The library likely does: path.join(__dirname, '..', 'node_modules', '@embedded-postgres', ...)
// or uses require.resolve to find the binaries.
// We rewrite any occurrence of 'app.asar/node_modules/@embedded-postgres'
// to 'app.asar.unpacked/node_modules/@embedded-postgres' at runtime.
if (!s.includes('__SCHOOL_MS_ASAR_FIX__')) {
  const guard = `
// __SCHOOL_MS_ASAR_FIX__ - redirect reads from app.asar to app.asar.unpacked
(function () {
  try {
    const Module = require('module');
    const path = require('path');
    const fs = require('fs');
    const asarPath = process.resourcesPath ? path.join(process.resourcesPath, 'app.asar') : null;
    const unpackedPath = process.resourcesPath ? path.join(process.resourcesPath, 'app.asar.unpacked') : null;
    if (!asarPath || !fs.existsSync(unpackedPath)) return;

    const origReadFileSync = fs.readFileSync;
    fs.readFileSync = function (p, ...args) {
      if (typeof p === 'string' && p.includes('app.asar' + path.sep) && !p.includes('app.asar.unpacked')) {
        const alt = p.replace('app.asar' + path.sep, 'app.asar.unpacked' + path.sep);
        if (fs.existsSync(alt)) return origReadFileSync.call(this, alt, ...args);
      }
      return origReadFileSync.call(this, p, ...args);
    };

    const origExistsSync = fs.existsSync;
    fs.existsSync = function (p) {
      if (typeof p === 'string' && p.includes('app.asar' + path.sep) && !p.includes('app.asar.unpacked')) {
        const alt = p.replace('app.asar' + path.sep, 'app.asar.unpacked' + path.sep);
        if (origExistsSync.call(this, alt)) return true;
      }
      return origExistsSync.call(this, p);
    };
  } catch (_) {}
})();
`;
  s = guard + '\n' + s;
  console.log('  + injected asar.unpacked redirect');
}

if (s !== original) {
  writeFileSync(target, s, 'utf8');
  console.log('\nOK wrote ' + target);
} else {
  console.log('\n! no changes were made — the patterns may not match this version');
}
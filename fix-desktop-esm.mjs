import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const path = join(process.cwd(), 'desktop/main.js');
let s = readFileSync(path, 'utf8');

// Replace the require with a dynamic import
const before = "  const EmbeddedPostgres = require('embedded-postgres').default;";
const after  = "  const pgMod = await import('embedded-postgres');\n  const EmbeddedPostgres = pgMod.default || pgMod;";

if (s.includes(before)) {
  s = s.replace(before, after);
  writeFileSync(path, s, 'utf8');
  console.log('OK patched main.js — dynamic import for embedded-postgres');
} else if (s.includes("await import('embedded-postgres')")) {
  console.log('= already patched');
} else {
  console.log('! anchor not found in main.js');
  const idx = s.indexOf('embedded-postgres');
  console.log(s.slice(Math.max(0, idx - 100), idx + 100));
}
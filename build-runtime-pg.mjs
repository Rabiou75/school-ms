import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const path = join(process.cwd(), 'build-runtime.mjs');
let s = readFileSync(path, 'utf8');

const marker = "log('\\n=== 8. Size check ===');";

if (!s.includes('Copying PostgreSQL binaries')) {
  const insert = [
    "",
    "// ---- Copy PostgreSQL binaries ----",
    "log('\\n=== 7b. Copying PostgreSQL binaries ===');",
    "const pgSrc = join(root, 'desktop', 'embed', 'postgres');",
    "if (existsSync(pgSrc)) {",
    "  const pgDst = join(embed, 'postgres');",
    "  mkdirSync(pgDst, { recursive: true });",
    "  cpSync(pgSrc, pgDst, { recursive: true });",
    "  ok('postgres/');",
    "} else {",
    "  warn('postgres folder missing — desktop will require system Postgres');",
    "}",
    "",
    "",
  ].join('\n');
  s = s.replace(marker, insert + marker);
  writeFileSync(path, s, 'utf8');
  console.log('OK build-runtime.mjs updated to include postgres');
} else {
  console.log('= build-runtime.mjs already includes postgres');
}
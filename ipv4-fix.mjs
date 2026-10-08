import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const path = join(process.cwd(), 'apps/api/src/main.ts');
let s = readFileSync(path, 'utf8');

if (s.includes('setDefaultResultOrder')) {
  console.log('= ipv4 already forced');
} else {
  // Add the DNS import at the top
  s = s.replace(
    "import 'reflect-metadata';",
    "import 'reflect-metadata';\nimport { setDefaultResultOrder } from 'node:dns';\nsetDefaultResultOrder('ipv4first');"
  );
  writeFileSync(path, s, 'utf8');
  console.log('+ main.ts - forced IPv4 DNS resolution');
}
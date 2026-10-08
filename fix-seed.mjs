import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const path = join(process.cwd(), 'packages/database/prisma/seed.ts');
let s = readFileSync(path, 'utf8');

const before = "main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());";
const after  = "main().catch((e) => { console.error(e); throw e; }).finally(() => prisma.$disconnect());";

if (s.includes(before)) {
  s = s.replace(before, after);
  writeFileSync(path, s, 'utf8');
  console.log('OK seed.ts patched — no more process reference');
} else if (s.includes("throw e; }).finally")) {
  console.log('= already patched');
} else {
  console.log('! last line is:');
  console.log(s.split('\n').slice(-3).join('\n'));
}
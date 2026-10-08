import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const path = join(process.cwd(), 'packages/database/prisma/schema.prisma');
let schema = readFileSync(path, 'utf8');

const m = schema.match(/model Payment \{[\s\S]*?\n\}/m);
if (!m) { console.error('Payment model not found'); process.exit(1); }

let block = m[0];
if (/\n\s+metadata\s+Json\?/.test(block)) {
  console.log('= Payment.metadata already exists');
} else {
  const idx = block.lastIndexOf('\n}');
  const ins = '\n  metadata Json?';
  block = block.slice(0, idx) + ins + block.slice(idx);
  schema = schema.replace(m[0], block);
  console.log('  + Payment.metadata Json?');
}

writeFileSync(path, schema, 'utf8');
console.log('✅ schema.prisma patched');
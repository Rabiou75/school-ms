import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const schemaPath = join(process.cwd(), 'packages/database/prisma/schema.prisma');
let schema = readFileSync(schemaPath, 'utf8');

// Patch the User model to add the reverse relation
const m = schema.match(/model User \{[\s\S]*?\n\}/m);
if (!m) {
  console.error('❌ User model not found');
  process.exit(1);
}

let block = m[0];

if (/\n\s+guardian\s+Guardian\?/.test(block)) {
  console.log('= User.guardian already present');
} else {
  // Insert before the closing brace
  const idx = block.lastIndexOf('\n}');
  const insertion = '\n  guardian Guardian?';
  block = block.slice(0, idx) + insertion + block.slice(idx);
  schema = schema.replace(m[0], block);
  console.log('  + User.guardian (reverse relation)');
}

writeFileSync(schemaPath, schema, 'utf8');
console.log('\n✅ schema.prisma patched');
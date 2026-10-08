import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const schemaPath = join(process.cwd(), 'packages/database/prisma/schema.prisma');
let schema = readFileSync(schemaPath, 'utf8');

// Find the Guardian model block
const m = schema.match(/model Guardian \{[\s\S]*?\n\}/m);
if (!m) {
  console.error('❌ Guardian model not found in schema');
  process.exit(1);
}

let block = m[0];

// Already patched?
if (/\n\s+userId\s+String\?/.test(block)) {
  console.log('= Guardian.userId already exists');
} else {
  // Insert userId + user relation just before the closing brace
  const idx = block.lastIndexOf('\n}');
  const insertion = '\n  userId String?  @unique\n  user   User?    @relation(fields: [userId], references: [id])';
  block = block.slice(0, idx) + insertion + block.slice(idx);
  schema = schema.replace(m[0], block);
  console.log('  + Guardian.userId + Guardian.user relation');
}

writeFileSync(schemaPath, schema, 'utf8');
console.log('\n✅ schema.prisma patched');
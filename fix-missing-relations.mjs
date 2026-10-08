import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const path = join(root, 'packages/database/prisma/schema.prisma');
let schema = readFileSync(path, 'utf8');

function addFieldToModel(modelName, fieldLine) {
  const re = new RegExp(`model ${modelName} \\{[\\s\\S]*?\\n\\}`, 'm');
  const m = schema.match(re);
  if (!m) { console.log('  ! ' + modelName + ' not found'); return; }
  const fname = fieldLine.trim().split(/\s+/)[0];
  if (new RegExp(`\\n\\s*${fname}\\s`).test(m[0])) { console.log('  = ' + modelName + '.' + fname); return; }
  const idx = m[0].lastIndexOf('\n}');
  schema = schema.replace(m[0], m[0].slice(0, idx) + '\n  ' + fieldLine + m[0].slice(idx));
  console.log('  + ' + modelName + '.' + fname);
}

addFieldToModel('BookLoan',    'school School @relation(fields: [schoolId], references: [id], onDelete: Cascade)');
addFieldToModel('PayrollItem', 'school School @relation(fields: [schoolId], references: [id], onDelete: Cascade)');

writeFileSync(path, schema, 'utf8');
console.log('\n✅ Missing relations added');
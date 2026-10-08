import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const schemaPath = join(root, 'packages/database/prisma/schema.prisma');
let schema = readFileSync(schemaPath, 'utf8');

// ---------- Payment model: add relation field ----------
const pm = schema.match(/model Payment \{[\s\S]*?\n\}/m);
if (!pm) { console.error('Payment model not found'); process.exit(1); }

let pblock = pm[0];
if (/\n\s+invoice\s+Invoice\s/.test(pblock)) {
  console.log('  = Payment.invoice relation already present');
} else {
  const idx = pblock.lastIndexOf('\n}');
  pblock = pblock.slice(0, idx) + '\n  invoice Invoice @relation(fields: [invoiceId], references: [id])' + pblock.slice(idx);
  schema = schema.replace(pm[0], pblock);
  console.log('  + Payment.invoice relation');
}

// ---------- Invoice model: add reverse relation ----------
const im = schema.match(/model Invoice \{[\s\S]*?\n\}/m);
if (!im) { console.error('Invoice model not found'); process.exit(1); }

let iblock = im[0];
if (/\n\s+payments\s+Payment\[\]/.test(iblock)) {
  console.log('  = Invoice.payments already present');
} else {
  const idx = iblock.lastIndexOf('\n}');
  iblock = iblock.slice(0, idx) + '\n  payments Payment[]' + iblock.slice(idx);
  schema = schema.replace(im[0], iblock);
  console.log('  + Invoice.payments reverse relation');
}

writeFileSync(schemaPath, schema, 'utf8');
console.log('\n✅ schema.prisma patched');
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

const files = [
  'apps/api/src/payments/receipt.service.ts',
  'apps/api/src/payroll/payslip.service.ts',
  'apps/api/src/exams/report-card.service.ts',
];

let patched = 0;

for (const rel of files) {
  const p = join(root, rel);
  let s;
  try { s = readFileSync(p, 'utf8'); } catch { console.log('  ! not found: ' + rel); continue; }

  if (s.includes('normalizeXAF')) {
    console.log('  = ' + rel + ' already patched');
    continue;
  }

  // Find the fmtXAF function and wrap its return with normalization
  const before = `function fmtXAF(n: number) {
  return new Intl.NumberFormat('fr-CM', { style: 'currency', currency: 'XAF', maximumFractionDigits: 0 }).format(n);
}`;

  const after = `function normalizeXAF(s: string): string {
  // Replace narrow/no-break spaces (U+202F, U+00A0, U+2009) with regular space
  // so Helvetica/Amiri can render them properly in the PDF.
  return s.replace(/[\\u202F\\u00A0\\u2009]/g, ' ');
}

function fmtXAF(n: number) {
  const s = new Intl.NumberFormat('fr-CM', { style: 'currency', currency: 'XAF', maximumFractionDigits: 0 }).format(n);
  return normalizeXAF(s);
}`;

  if (s.includes(before)) {
    s = s.replace(before, after);
    writeFileSync(p, s, 'utf8');
    console.log('  + ' + rel);
    patched++;
  } else {
    // Fallback: any other shape of fmtXAF
    const re = /function fmtXAF\(n:\s*number\)\s*\{[\s\S]*?\n\}/m;
    const m = s.match(re);
    if (m) {
      s = s.replace(re, after);
      writeFileSync(p, s, 'utf8');
      console.log('  + ' + rel + ' (fallback)');
      patched++;
    } else {
      console.log('  ! could not patch: ' + rel);
    }
  }
}

console.log('\n' + patched + ' file(s) patched');
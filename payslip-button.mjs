import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const path = join(process.cwd(), 'apps/web/app/[locale]/dashboard/payroll/page.tsx');
let s = readFileSync(path, 'utf8');

if (s.includes('downloadPayslip')) {
  console.log('= button already there');
  process.exit(0);
}

// Add import
s = s.replace(
  "import { formatXAF } from '@/lib/format';",
  "import { formatXAF } from '@/lib/format';\nimport { downloadPayslip } from '@/lib/payslip';"
);

// Add download handler inside the component (after `remove`)
s = s.replace(
  "  const totalNet = items.reduce",
  "  const downloadPdf = async (id: string) => {\n    try { await downloadPayslip(id, locale); }\n    catch (e: any) { setErr(String(e)); }\n  };\n\n  const totalNet = items.reduce"
);

// Add the PDF button in each row before the Pay button
s = s.replace(
  "                    {!it.paidAt && (\n                      <button onClick={() => payOne(it.id)} className=\"rounded bg-brand-600 px-3 py-1 text-xs text-white hover:bg-brand-700\">Payer</button>\n                    )}",
  "                    <button onClick={() => downloadPdf(it.id)} className=\"rounded border border-teal-600 px-2 py-1 text-xs text-teal-700 hover:bg-teal-50\">🧾 PDF</button>\n                    {!it.paidAt && (\n                      <button onClick={() => payOne(it.id)} className=\"ml-2 rounded bg-brand-600 px-3 py-1 text-xs text-white hover:bg-brand-700\">Payer</button>\n                    )}"
);

writeFileSync(path, s, 'utf8');
console.log('✅ PDF button added to payroll page');
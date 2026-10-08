import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

const root = process.cwd();
const put = (p, c) => {
  const full = join(root, p);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, c, 'utf8');
  console.log('  + ' + p);
};
const L = (a) => a.join('\n');

// ============================================================
// 1. Download helper
// ============================================================
put('apps/web/lib/receipt.ts', L([
  "import { apiFetch } from './api';",
  "",
  "export async function downloadReceipt(paymentId: string, locale: string = 'fr'): Promise<void> {",
  "  const res = await apiFetch('/api/v1/payments/' + paymentId + '/receipt?locale=' + locale);",
  "  if (!res.ok) {",
  "    const txt = await res.text().catch(() => '');",
  "    throw new Error('Receipt failed: ' + res.status + ' ' + txt.slice(0, 120));",
  "  }",
  "  const blob = await res.blob();",
  "  if (blob.size < 500) throw new Error('Receipt PDF too small: ' + blob.size + ' bytes');",
  "",
  "  const url = URL.createObjectURL(blob);",
  "  const a = document.createElement('a');",
  "  a.href = url;",
  "  a.download = 'receipt-' + paymentId.slice(-8) + '.pdf';",
  "  document.body.appendChild(a);",
  "  a.click();",
  "  a.remove();",
  "  setTimeout(() => URL.revokeObjectURL(url), 4000);",
  "}",
  ""
]));

// ============================================================
// 2. ReceiptButton component
// ============================================================
put('apps/web/components/ReceiptButton.tsx', L([
  "'use client';",
  "import { useState } from 'react';",
  "import { apiFetch } from '@/lib/api';",
  "import { downloadReceipt } from '@/lib/receipt';",
  "",
  "type Payment = { id: string; amount: number; method: string; paidAt: string; status: string; reference: string | null };",
  "",
  "export default function ReceiptButton({ invoiceId, locale = 'fr', amountPaid = 0 }: {",
  "  invoiceId: string;",
  "  locale?: string;",
  "  amountPaid?: number;",
  "}) {",
  "  const [loading, setLoading] = useState(false);",
  "  const [payments, setPayments] = useState<Payment[] | null>(null);",
  "  const [open, setOpen] = useState(false);",
  "  const [err, setErr] = useState<string | null>(null);",
  "",
  "  const fetchPayments = async (): Promise<Payment[]> => {",
  "    const r = await apiFetch('/api/v1/finance/invoices/' + invoiceId);",
  "    if (!r.ok) throw new Error('invoices ' + r.status);",
  "    const d = await r.json();",
  "    return (d.payments || []).filter((p: Payment) => p.status === 'SUCCESS');",
  "  };",
  "",
  "  const handleClick = async () => {",
  "    if (amountPaid <= 0) return;",
  "    setLoading(true); setErr(null);",
  "    try {",
  "      const list = await fetchPayments();",
  "      if (list.length === 0) { setErr('No payments'); setLoading(false); return; }",
  "      if (list.length === 1) {",
  "        await downloadReceipt(list[0].id, locale);",
  "      } else {",
  "        setPayments(list);",
  "        setOpen(true);",
  "      }",
  "    } catch (e: any) {",
  "      setErr(String(e));",
  "    } finally {",
  "      setLoading(false);",
  "    }",
  "  };",
  "",
  "  if (amountPaid <= 0) return <span className=\"text-xs text-gray-300\">—</span>;",
  "",
  "  return (",
  "    <div className=\"relative inline-block\">",
  "      <button",
  "        onClick={handleClick}",
  "        disabled={loading}",
  "        title=\"Download receipt\"",
  "        className=\"rounded border border-teal-600 px-2 py-1 text-xs text-teal-700 hover:bg-teal-50 disabled:opacity-50\"",
  "      >",
  "        {loading ? '…' : '🧾 PDF'}",
  "      </button>",
  "",
  "      {open && payments && (",
  "        <>",
  "          <div className=\"fixed inset-0 z-10\" onClick={() => setOpen(false)} />",
  "          <div className=\"absolute right-0 z-20 mt-1 w-60 rounded-lg border bg-white shadow-lg\">",
  "            <div className=\"border-b px-3 py-2 text-xs font-medium text-gray-600\">",
  "              Choose a payment",
  "            </div>",
  "            {payments.map((p) => (",
  "              <button",
  "                key={p.id}",
  "                onClick={async () => { setOpen(false); await downloadReceipt(p.id, locale); }}",
  "                className=\"block w-full px-3 py-2 text-left text-xs hover:bg-gray-50\"",
  "              >",
  "                <div className=\"font-medium\">{new Date(p.paidAt).toLocaleString()}</div>",
  "                <div className=\"text-gray-500\">",
  "                  {p.amount.toLocaleString('fr-CM')} XAF · {p.method}",
  "                </div>",
  "              </button>",
  "            ))}",
  "          </div>",
  "        </>",
  "      )}",
  "",
  "      {err && <span className=\"ml-1 text-[10px] text-red-600\">{err}</span>}",
  "    </div>",
  "  );",
  "}",
  ""
]));

// ============================================================
// 3. Patch admin finance page
// ============================================================
function patchAdmin() {
  const p = join(root, 'apps/web/app/[locale]/dashboard/finance/page.tsx');
  if (!existsSync(p)) { console.log('  ! admin finance page missing'); return; }
  let s = readFileSync(p, 'utf8');

  if (s.includes('ReceiptButton')) { console.log('  = admin finance already has ReceiptButton'); return; }

  // Add import after 'use client'
  s = s.replace(
    "import { formatXAF } from '@/lib/format';",
    "import { formatXAF } from '@/lib/format';\nimport ReceiptButton from '@/components/ReceiptButton';"
  );

  // The admin finance table has: number | student | total | paid | balance | status | [record payment button]
  // Find the row with the record payment button and inject receipt before it.
  const cell = "<td className=\"p-3 text-right\">";
  // Find the specific pattern: the record payment button cell
  if (s.includes("{t('recordPayment')}")) {
    s = s.replace(
      /(\s+)(\{inv\.status !== 'PAID' && \()/,
      "$1<td className=\"p-3 text-right\">\n                  <ReceiptButton invoiceId={inv.id} locale={locale} amountPaid={inv.amountPaid} />\n                </td>$1$2"
    );
    // Need to add a receipt column header
    s = s.replace(
      /<th className="p-3"><\/th>/,
      "<th className=\"p-3 font-medium\">Receipt</th>\n              <th className=\"p-3\"></th>"
    );
    // Update colspan from 7 to 8 for the empty row
    s = s.replace(
      /<td colSpan=\{7\} className="p-6 text-center text-gray-500">/,
      "<td colSpan={8} className=\"p-6 text-center text-gray-500\">"
    );
    writeFileSync(p, s, 'utf8');
    console.log('  + admin finance page patched');
  } else {
    console.log('  ! admin finance anchor not found — manual patch needed');
  }
}

// ============================================================
// 4. Patch parent invoices tab
// ============================================================
function patchParent() {
  const p = join(root, 'apps/web/app/[locale]/parent/children/[id]/page.tsx');
  if (!existsSync(p)) { console.log('  ! parent child page missing'); return; }
  let s = readFileSync(p, 'utf8');

  if (s.includes('ReceiptButton')) { console.log('  = parent page already has ReceiptButton'); return; }

  // Add import at the top
  s = s.replace(
    "import { formatXAF } from '@/lib/format';",
    "import { formatXAF } from '@/lib/format';\nimport ReceiptButton from '@/components/ReceiptButton';"
  );

  // Add a header column in the invoices table
  if (s.includes("<th className=\"p-3 font-medium\">{T.status[l]}</th>")) {
    s = s.replace(
      "<th className=\"p-3 font-medium\">{T.status[l]}</th>",
      "<th className=\"p-3 font-medium\">{T.status[l]}</th>\n                      <th className=\"p-3\"></th>"
    );

    // Add a cell after the status cell in the invoice rows
    // Look for the status <td> block that contains the status pill, then append a cell after it
    const statusCellEnd = "</span>\n                        </td>";
    const replacement = "</span>\n                        </td>\n                        <td className=\"p-3 text-right\">\n                          <ReceiptButton invoiceId={i.id} locale={locale} amountPaid={i.amountPaid} />\n                        </td>";
    s = s.replace(statusCellEnd, replacement);

    // Update colSpan for empty row (6 -> 7)
    s = s.replace(
      /colSpan=\{6\} className="p-6 text-center text-gray-500">\{T\.noInvoices\[l\]\}/,
      'colSpan={7} className="p-6 text-center text-gray-500">{T.noInvoices[l]}'
    );

    writeFileSync(p, s, 'utf8');
    console.log('  + parent page patched');
  } else {
    console.log('  ! parent page anchor not found — manual patch needed');
  }
}

// ============================================================
// 5. Patch student invoices page
// ============================================================
function patchStudent() {
  const p = join(root, 'apps/web/app/[locale]/student/invoices/page.tsx');
  if (!existsSync(p)) { console.log('  ! student invoices page missing'); return; }
  let s = readFileSync(p, 'utf8');

  if (s.includes('ReceiptButton')) { console.log('  = student page already has ReceiptButton'); return; }

  s = s.replace(
    "import { formatXAF } from '@/lib/format';",
    "import { formatXAF } from '@/lib/format';\nimport ReceiptButton from '@/components/ReceiptButton';"
  );

  if (s.includes("<th className=\"p-3 font-medium\">{T.status[l]}</th>")) {
    s = s.replace(
      "<th className=\"p-3 font-medium\">{T.status[l]}</th>",
      "<th className=\"p-3 font-medium\">{T.status[l]}</th>\n                  <th className=\"p-3\"></th>"
    );

    const statusCellEnd = "</span>\n                    </td>";
    const replacement = "</span>\n                    </td>\n                    <td className=\"p-3 text-right\">\n                      <ReceiptButton invoiceId={i.id} locale={locale} amountPaid={i.amountPaid} />\n                    </td>";
    s = s.replace(statusCellEnd, replacement);

    s = s.replace(
      /colSpan=\{6\} className="p-6 text-center text-gray-500">\{T\.empty\[l\]\}/,
      'colSpan={7} className="p-6 text-center text-gray-500">{T.empty[l]}'
    );

    writeFileSync(p, s, 'utf8');
    console.log('  + student page patched');
  } else {
    console.log('  ! student page anchor not found — manual patch needed');
  }
}

patchAdmin();
patchParent();
patchStudent();

console.log('\n✅ Receipt download UI written');
console.log('');
console.log('Try:');
console.log('  - Admin  : /fr/dashboard/finance       → 🧾 PDF button per invoice');
console.log('  - Parent : /fr/parent/children/<id>    → Factures tab → 🧾 PDF');
console.log('  - Student: /fr/student/invoices        → 🧾 PDF');
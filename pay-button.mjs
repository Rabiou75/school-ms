import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const pagePath = join(root, 'apps/web/app/[locale]/parent/children/[id]/page.tsx');

let src = readFileSync(pagePath, 'utf8');

// 1. Add payNow helper after the ChildDetail component opening — inject right after the state declarations
if (!src.includes('payNow')) {
  // Insert the payNow function right before the return statement of ChildDetail
  const anchor = '  const childName = (grades?.student || invoices?.student || attendance?.student)?.firstName;';
  const injection = anchor + `

  const payNow = async (invoiceId: string) => {
    const r = await apiFetch('/api/v1/payments/cinetpay/init/' + invoiceId, { method: 'POST' });
    if (!r.ok) {
      const err = await r.text();
      alert('Erreur CinetPay: ' + err);
      return;
    }
    const data = await r.json();
    if (data.checkoutUrl) {
      window.location.href = data.checkoutUrl;
    }
  };`;
  src = src.replace(anchor, injection);
  console.log('  + payNow helper');
} else {
  console.log('  = payNow already present');
}

// 2. Add a "Actions" column header to the invoices table
if (!src.includes('T.pay')) {
  // Add T.pay entry
  src = src.replace(
    /date:\s*\{\s*en:\s*'Date',\s*fr:\s*'Date',\s*ar:\s*'التاريخ'\s*\},/,
    `date:       { en: 'Date',       fr: 'Date',          ar: 'التاريخ' },
  pay:        { en: 'Pay',        fr: 'Payer',         ar: 'دفع' },`
  );
  // Add column header
  src = src.replace(
    /(<th className="p-3 font-medium">\{T\.status\[l\]\}<\/th>)/,
    `$1
                      <th className="p-3"></th>`
  );
  // Add pay button cell
  src = src.replace(
    /(<td className="p-3">\s*<span className=\{[\s\S]*?\}>\{i\.status\}<\/span>\s*<\/td>)/,
    `$1
                        <td className="p-3 text-right">
                          {i.status !== 'PAID' && i.balance > 0 && (
                            <button
                              onClick={() => payNow(i.id)}
                              className="rounded bg-brand-600 px-3 py-1 text-xs text-white hover:bg-brand-700"
                            >
                              💳 {T.pay[l]}
                            </button>
                          )}
                        </td>`
  );
  console.log('  + Pay column and button');
}

writeFileSync(pagePath, src, 'utf8');
console.log('\n✅ Parent portal "Payer" button added');
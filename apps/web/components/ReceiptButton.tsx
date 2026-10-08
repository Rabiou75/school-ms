'use client';
import { useState } from 'react';
import { apiFetch } from '@/lib/api';
import { downloadReceipt } from '@/lib/receipt';

type Payment = { id: string; amount: number; method: string; paidAt: string; status: string; reference: string | null };

export default function ReceiptButton({ invoiceId, invoiceNo, locale = 'fr', amountPaid = 0 }: {
  invoiceId: string;
  invoiceNo?: string;
  locale?: string;
  amountPaid?: number;
}) {
  const [loading, setLoading] = useState(false);
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const fetchPayments = async (): Promise<Payment[]> => {
    const r = await apiFetch('/api/v1/finance/invoices/' + invoiceId);
    if (!r.ok) throw new Error('invoices ' + r.status);
    const d = await r.json();
    return (d.payments || []).filter((p: Payment) => p.status === 'SUCCESS');
  };

  const handleClick = async () => {
    if (amountPaid <= 0) return;
    setLoading(true); setErr(null);
    try {
      const list = await fetchPayments();
      if (list.length === 0) { setErr('No payments'); setLoading(false); return; }
      if (list.length === 1) {
        await downloadReceipt(list[0].id, locale, invoiceNo);
      } else {
        setPayments(list);
        setOpen(true);
      }
    } catch (e: any) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  };

  if (amountPaid <= 0) return <span className="text-xs text-gray-300">—</span>;

  return (
    <div className="relative inline-block">
      <button
        onClick={handleClick}
        disabled={loading}
        title="Download receipt"
        className="rounded border border-teal-600 px-2 py-1 text-xs text-teal-700 hover:bg-teal-50 disabled:opacity-50"
      >
        {loading ? '…' : '🧾 PDF'}
      </button>

      {open && payments && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-60 rounded-lg border bg-white shadow-lg">
            <div className="border-b px-3 py-2 text-xs font-medium text-gray-600">
              Choose a payment
            </div>
            {payments.map((p) => (
              <button
                key={p.id}
                onClick={async () => { setOpen(false); await downloadReceipt(p.id, locale, invoiceNo); }}
                className="block w-full px-3 py-2 text-left text-xs hover:bg-gray-50"
              >
                <div className="font-medium">{new Date(p.paidAt).toLocaleString()}</div>
                <div className="text-gray-500">
                  {p.amount.toLocaleString('fr-CM')} XAF · {p.method}
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {err && <span className="ml-1 text-[10px] text-red-600">{err}</span>}
    </div>
  );
}

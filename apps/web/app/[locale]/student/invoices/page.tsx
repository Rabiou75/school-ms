'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { formatXAF } from '@/lib/format';
import ReceiptButton from '@/components/ReceiptButton';

export default function StudentInvoices() {
  const { locale } = useParams() as { locale: string };
  const l = locale === 'en' || locale === 'ar' ? locale : 'fr';
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  const T = {
    title:   { en: 'My invoices', fr: 'Mes factures', ar: 'فواتيري' },
    billed:  { en: 'Billed', fr: 'Facture', ar: 'المفوتر' },
    paid:    { en: 'Paid', fr: 'Paye', ar: 'المدفوع' },
    balance: { en: 'Balance', fr: 'Solde', ar: 'الرصيد' },
    number:  { en: 'Number', fr: 'Numero', ar: 'الرقم' },
    due:     { en: 'Due', fr: 'Echeance', ar: 'الاستحقاق' },
    total:   { en: 'Total', fr: 'Total', ar: 'الاجمالي' },
    status:  { en: 'Status', fr: 'Statut', ar: 'الحالة' },
    empty:   { en: 'No invoices.', fr: 'Aucune facture.', ar: 'لا توجد فواتير.' },
    loading: { en: 'Loading…', fr: 'Chargement…', ar: 'جار التحميل…' },
    hint:    { en: 'Ask your parents to pay via the parent portal.', fr: 'Demandez a vos parents de payer via le portail parent.', ar: 'اطلب من والديك الدفع عبر بوابة الوالدين.' },
  };

  useEffect(() => {
    apiFetch('/api/v1/student/invoices')
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setData)
      .catch((e) => setErr(String(e)));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold">{T.title[l]}</h1>
      {err && <p className="mt-4 text-red-600">{err}</p>}
      {!data && !err && <p className="mt-4 text-gray-500">{T.loading[l]}</p>}
      {data && (
        <>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border bg-teal-50 p-4">
              <div className="text-xs uppercase text-teal-800 opacity-70">{T.billed[l]}</div>
              <div className="mt-1 text-2xl font-bold text-teal-900">{formatXAF(data.summary.totalBilled)}</div>
            </div>
            <div className="rounded-xl border bg-green-50 p-4">
              <div className="text-xs uppercase text-green-800 opacity-70">{T.paid[l]}</div>
              <div className="mt-1 text-2xl font-bold text-green-900">{formatXAF(data.summary.totalPaid)}</div>
            </div>
            <div className="rounded-xl border bg-red-50 p-4">
              <div className="text-xs uppercase text-red-800 opacity-70">{T.balance[l]}</div>
              <div className="mt-1 text-2xl font-bold text-red-900">{formatXAF(data.summary.balance)}</div>
            </div>
          </div>
          <div className="mt-6 overflow-x-auto rounded-lg border">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="p-3 font-medium">{T.number[l]}</th>
                  <th className="p-3 font-medium">{T.due[l]}</th>
                  <th className="p-3 text-right font-medium">{T.total[l]}</th>
                  <th className="p-3 text-right font-medium">{T.paid[l]}</th>
                  <th className="p-3 text-right font-medium">{T.balance[l]}</th>
                  <th className="p-3 font-medium">{T.status[l]}</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {data.invoices.length === 0 && (
                  <tr><td colSpan={7} className="p-6 text-center text-gray-500">{T.empty[l]}</td></tr>
                )}
                {data.invoices.map((i: any) => (
                  <tr key={i.id} className="border-t">
                    <td className="p-3 font-mono text-xs">{i.invoiceNo}</td>
                    <td className="p-3 text-xs">{new Date(i.dueDate).toLocaleDateString()}</td>
                    <td className="p-3 text-right">{formatXAF(i.total)}</td>
                    <td className="p-3 text-right text-green-700">{formatXAF(i.amountPaid)}</td>
                    <td className="p-3 text-right font-medium">{formatXAF(i.balance)}</td>
                    <td className="p-3">
                      <span className={'rounded-full px-2 py-0.5 text-xs font-medium ' +
                        (i.status === 'PAID' ? 'bg-green-100 text-green-800' :
                         i.status === 'PARTIAL' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800')}>
                        {i.status}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <ReceiptButton invoiceId={i.id} invoiceNo={i.invoiceNo} locale={locale} amountPaid={i.amountPaid} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-gray-500">{T.hint[l]}</p>
        </>
      )}
    </div>
  );
}

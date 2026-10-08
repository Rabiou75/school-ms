import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

const root = process.cwd();
const put = (p, c) => {
  const full = join(root, p);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, c, 'utf8');
  console.log('  + ' + p);
};

// ---------- format helper ----------
put('apps/web/lib/format.ts', `export const formatXAF = (n: number, locale = 'fr'): string =>
  new Intl.NumberFormat(locale === 'ar' ? 'ar-CM' : locale + '-CM', {
    style: 'currency',
    currency: 'XAF',
    maximumFractionDigits: 0,
  }).format(n);
`);

// ---------- finance page ----------
const page = `'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { apiFetch } from '@/lib/api';
import { formatXAF } from '@/lib/format';

type Summary = {
  currency: string;
  totalBilled: number;
  totalCollected: number;
  totalOutstanding: number;
  invoiceCount: number;
};
type Invoice = {
  id: string;
  invoiceNo: string;
  total: number;
  amountPaid: number;
  balance: number;
  status: string;
  dueDate: string;
  student: { id: string; firstName: string; lastName: string; admissionNo: string };
};
type Student = { id: string; firstName: string; lastName: string; admissionNo: string };

const METHODS = ['CASH','MTN_MOMO','ORANGE_MONEY','BANK_TRANSFER','CHEQUE','CARD','OTHER'] as const;

export default function FinancePage() {
  const t = useTranslations('finance');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [payFor, setPayFor] = useState<Invoice | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    try {
      const [s, i, st] = await Promise.all([
        apiFetch('/api/v1/finance/summary').then((r) => r.json()),
        apiFetch('/api/v1/finance/invoices').then((r) => r.json()),
        apiFetch('/api/v1/students').then((r) => r.json()),
      ]);
      setSummary(s);
      setInvoices(i);
      setStudents(st);
      setErr(null);
    } catch (e: any) {
      setErr(String(e));
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <button
          onClick={() => setShowNew(true)}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700"
        >
          + {t('newInvoice')}
        </button>
      </div>

      {err && <p className="mt-4 text-red-600">{err}</p>}

      {summary && (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card label={t('billed')} value={formatXAF(summary.totalBilled)} ring="border-gray-200" />
          <Card label={t('collected')} value={formatXAF(summary.totalCollected)} ring="border-green-200" />
          <Card label={t('outstanding')} value={formatXAF(summary.totalOutstanding)} ring="border-red-200" />
        </div>
      )}

      <h2 className="mt-10 text-lg font-semibold">{t('invoices')}</h2>
      <div className="mt-4 overflow-x-auto rounded-lg border">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-3 font-medium">{t('number')}</th>
              <th className="p-3 font-medium">{t('student')}</th>
              <th className="p-3 text-right font-medium">{t('total')}</th>
              <th className="p-3 text-right font-medium">{t('paid')}</th>
              <th className="p-3 text-right font-medium">{t('balance')}</th>
              <th className="p-3 font-medium">{t('status')}</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-gray-500">
                  {t('noInvoices')}
                </td>
              </tr>
            )}
            {invoices.map((inv) => (
              <tr key={inv.id} className="border-t hover:bg-gray-50">
                <td className="p-3 font-mono text-xs">{inv.invoiceNo}</td>
                <td className="p-3">
                  {inv.student.firstName} {inv.student.lastName}
                  <span className="ml-2 text-xs text-gray-500">{inv.student.admissionNo}</span>
                </td>
                <td className="p-3 text-right">{formatXAF(inv.total)}</td>
                <td className="p-3 text-right text-green-700">{formatXAF(inv.amountPaid)}</td>
                <td className="p-3 text-right font-medium">{formatXAF(inv.balance)}</td>
                <td className="p-3"><StatusBadge status={inv.status} /></td>
                <td className="p-3 text-right">
                  {inv.status !== 'PAID' && (
                    <button
                      onClick={() => setPayFor(inv)}
                      className="rounded bg-brand-600 px-3 py-1 text-xs text-white hover:bg-brand-700"
                    >
                      {t('recordPayment')}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showNew && (
        <NewInvoiceModal
          students={students}
          onClose={() => setShowNew(false)}
          onSaved={() => { setShowNew(false); load(); }}
        />
      )}
      {payFor && (
        <PaymentModal
          invoice={payFor}
          onClose={() => setPayFor(null)}
          onSaved={() => { setPayFor(null); load(); }}
        />
      )}
    </div>
  );
}

function Card({ label, value, ring }: { label: string; value: string; ring: string }) {
  return (
    <div className={'rounded-xl border bg-white p-5 ' + ring}>
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    UNPAID: 'bg-red-100 text-red-800',
    PARTIAL: 'bg-yellow-100 text-yellow-800',
    PAID: 'bg-green-100 text-green-800',
    OVERDUE: 'bg-red-200 text-red-900',
    CANCELLED: 'bg-gray-200 text-gray-700',
  };
  return (
    <span className={'rounded-full px-2 py-0.5 text-xs font-medium ' + (map[status] || 'bg-gray-100 text-gray-700')}>
      {status}
    </span>
  );
}

function NewInvoiceModal({
  students, onClose, onSaved,
}: { students: Student[]; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations('finance');
  const [studentId, setStudentId] = useState(students[0]?.id || '');
  const [total, setTotal] = useState(150000);
  const [due, setDue] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      const r = await apiFetch('/api/v1/finance/invoices', {
        method: 'POST',
        body: JSON.stringify({ studentId, total: Number(total), dueDate: due }),
      });
      if (!r.ok) throw new Error(await r.text());
      onSaved();
    } catch (e: any) {
      setErr(String(e));
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose} title={t('newInvoice')}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium">{t('student')}</label>
          <select
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            className="mt-1 w-full rounded border px-3 py-2"
          >
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.admissionNo} — {s.firstName} {s.lastName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium">{t('amountXAF')}</label>
          <input
            type="number"
            min={1}
            step={1000}
            value={total}
            onChange={(e) => setTotal(Number(e.target.value))}
            className="mt-1 w-full rounded border px-3 py-2"
          />
          <p className="mt-1 text-xs text-gray-500">= {formatXAF(Number(total))}</p>
        </div>
        <div>
          <label className="block text-sm font-medium">{t('dueDate')}</label>
          <input
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </div>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded border px-4 py-2 text-sm">
            {t('cancel')}
          </button>
          <button
            disabled={saving}
            className="rounded bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? '…' : t('save')}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function PaymentModal({
  invoice, onClose, onSaved,
}: { invoice: Invoice; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations('finance');
  const [amount, setAmount] = useState(invoice.balance);
  const [method, setMethod] = useState<typeof METHODS[number]>('MTN_MOMO');
  const [reference, setReference] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      const r = await apiFetch('/api/v1/finance/invoices/' + invoice.id + '/payments', {
        method: 'POST',
        body: JSON.stringify({
          amount: Number(amount),
          method,
          reference: reference || undefined,
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      onSaved();
    } catch (e: any) {
      setErr(String(e));
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose} title={t('recordPayment') + ' — ' + invoice.invoiceNo}>
      <form onSubmit={submit} className="space-y-4">
        <div className="rounded bg-gray-50 p-3 text-sm">
          <div className="flex justify-between"><span>{t('total')}</span><span>{formatXAF(invoice.total)}</span></div>
          <div className="flex justify-between"><span>{t('paid')}</span><span>{formatXAF(invoice.amountPaid)}</span></div>
          <div className="flex justify-between font-medium"><span>{t('balance')}</span><span>{formatXAF(invoice.balance)}</span></div>
        </div>
        <div>
          <label className="block text-sm font-medium">{t('amountXAF')}</label>
          <input
            type="number"
            min={1}
            max={invoice.balance}
            step={500}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">{t('method')}</label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as any)}
            className="mt-1 w-full rounded border px-3 py-2"
          >
            {METHODS.map((m) => (
              <option key={m} value={m}>{m.replace('_', ' ')}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium">{t('reference')}</label>
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder={t('referencePlaceholder')}
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </div>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded border px-4 py-2 text-sm">
            {t('cancel')}
          </button>
          <button
            disabled={saving}
            className="rounded bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? '…' : t('save')}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Modal({
  title, children, onClose,
}: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
`;
put('apps/web/app/[locale]/dashboard/finance/page.tsx', page);

// ---------- merge i18n keys ----------
const finance = {
  en: {
    title: 'Finance',
    billed: 'Total billed',
    collected: 'Total collected',
    outstanding: 'Outstanding',
    invoices: 'Invoices',
    number: 'Number',
    student: 'Student',
    total: 'Total',
    paid: 'Paid',
    balance: 'Balance',
    status: 'Status',
    newInvoice: 'New invoice',
    recordPayment: 'Record payment',
    noInvoices: 'No invoices yet.',
    amountXAF: 'Amount (XAF)',
    dueDate: 'Due date',
    method: 'Payment method',
    reference: 'Reference',
    referencePlaceholder: 'e.g. MOMO-2026-001',
    cancel: 'Cancel',
    save: 'Save',
  },
  fr: {
    title: 'Finances',
    billed: 'Total facture',
    collected: 'Total encaisse',
    outstanding: 'Impaye',
    invoices: 'Factures',
    number: 'Numero',
    student: 'Eleve',
    total: 'Total',
    paid: 'Paye',
    balance: 'Solde',
    status: 'Statut',
    newInvoice: 'Nouvelle facture',
    recordPayment: 'Enregistrer un paiement',
    noInvoices: 'Aucune facture pour le moment.',
    amountXAF: 'Montant (XAF)',
    dueDate: 'Echeance',
    method: 'Moyen de paiement',
    reference: 'Reference',
    referencePlaceholder: 'ex. MOMO-2026-001',
    cancel: 'Annuler',
    save: 'Enregistrer',
  },
  ar: {
    title: 'المالية',
    billed: 'إجمالي الفواتير',
    collected: 'إجمالي المحصل',
    outstanding: 'المتأخرات',
    invoices: 'الفواتير',
    number: 'الرقم',
    student: 'الطالب',
    total: 'الإجمالي',
    paid: 'المدفوع',
    balance: 'الرصيد',
    status: 'الحالة',
    newInvoice: 'فاتورة جديدة',
    recordPayment: 'تسجيل الدفع',
    noInvoices: 'لا توجد فواتير بعد.',
    amountXAF: 'المبلغ (XAF)',
    dueDate: 'تاريخ الاستحقاق',
    method: 'طريقة الدفع',
    reference: 'المرجع',
    referencePlaceholder: 'مثال MOMO-2026-001',
    cancel: 'إلغاء',
    save: 'حفظ',
  },
};

for (const locale of ['en', 'fr', 'ar']) {
  const file = join(root, 'apps/web/messages/' + locale + '.json');
  const data = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
  data.finance = { ...(data.finance || {}), ...finance[locale] };
  writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  console.log('  ~ apps/web/messages/' + locale + '.json (finance keys merged)');
}

console.log('\n✅ Finance UI written. Next: restart dev and open /fr/dashboard/finance');
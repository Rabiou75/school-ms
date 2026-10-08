import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const root = process.cwd();
const put = (p, c) => {
  const full = join(root, p);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, c, 'utf8');
  console.log('  + ' + p);
};

// ---------- Parent layout ----------
put('apps/web/app/[locale]/parent/layout.tsx', `import Link from 'next/link';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import UserMenu from '@/components/UserMenu';

export default function ParentLayout({
  children, params: { locale },
}: { children: React.ReactNode; params: { locale: string } }) {
  const l = (locale === 'en' || locale === 'ar') ? locale : 'fr';
  const nav = [
    { key: '',                icon: '🏠', label: { en: 'Home',           fr: 'Accueil',     ar: 'الرئيسية' } },
    { key: '/announcements',  icon: '📢', label: { en: 'Announcements',  fr: 'Annonces',    ar: 'الإعلانات' } },
  ];

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="w-64 border-r bg-white">
        <div className="flex h-16 items-center border-b px-4">
          <span className="text-lg font-bold text-brand-600">SMS</span>
          <span className="ml-2 text-xs text-gray-400">Parents</span>
        </div>
        <nav className="p-3 space-y-1">
          {nav.map((n) => (
            <Link
              key={n.key}
              href={'/' + locale + '/parent' + n.key}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              <span className="text-base">{n.icon}</span>
              <span>{n.label[l]}</span>
            </Link>
          ))}
        </nav>
      </aside>
      <div className="flex-1">
        <header className="flex h-16 items-center justify-between border-b bg-white px-6">
          <div />
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <UserMenu />
          </div>
        </header>
        <main className="p-8">{children}</main>
      </div>
    </div>
  );
}
`);

// ---------- Parent home ----------
put('apps/web/app/[locale]/parent/page.tsx', `'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';

type Child = {
  id: string;
  admissionNo: string;
  firstName: string;
  lastName: string;
  gender: string;
  dateOfBirth: string;
  className: string | null;
  classId: string | null;
};
type Me = {
  id: string;
  firstName: string;
  lastName: string;
  relation: string;
  phone: string;
  email: string | null;
  children: Child[];
};

const T = {
  welcome:    { en: 'Welcome',    fr: 'Bienvenue',     ar: 'مرحبا' },
  loading:    { en: 'Loading...', fr: 'Chargement...', ar: 'جار التحميل...' },
  myChildren: { en: 'My children', fr: 'Mes enfants',  ar: 'أطفالي' },
  class:      { en: 'Class',      fr: 'Classe',        ar: 'الفصل' },
  born:       { en: 'Born',       fr: 'Ne le',         ar: 'مواليد' },
  grades:     { en: 'Grades',     fr: 'Notes',         ar: 'العلامات' },
  invoices:   { en: 'Invoices',   fr: 'Factures',      ar: 'الفواتير' },
  attendance: { en: 'Attendance', fr: 'Presence',      ar: 'الحضور' },
  noChildren: { en: 'No children linked to your account.', fr: 'Aucun enfant lie a votre compte.', ar: 'لا يوجد أطفال.' },
} as const;

export default function ParentHome() {
  const { locale } = useParams() as { locale: string };
  const l: 'en' | 'fr' | 'ar' =
    locale === 'en' || locale === 'ar' ? locale : 'fr';
  const [me, setMe] = useState<Me | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    apiFetch('/api/v1/parent/me')
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setMe)
      .catch((e) => setErr(String(e)));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold">
        {me ? T.welcome[l] + ', ' + me.firstName + ' ' + me.lastName : T.loading[l]}
      </h1>
      {err && <p className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{err}</p>}

      {me && (
        <>
          <h2 className="mt-8 text-lg font-semibold">{T.myChildren[l]}</h2>
          {me.children.length === 0 && (
            <p className="mt-4 text-gray-500">{T.noChildren[l]}</p>
          )}
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {me.children.map((c) => (
              <div key={c.id} className="rounded-xl border bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-100 text-lg font-bold text-teal-800">
                    {c.firstName[0]}{c.lastName[0]}
                  </div>
                  <div>
                    <div className="font-bold">{c.firstName} {c.lastName}</div>
                    <div className="font-mono text-xs text-gray-500">{c.admissionNo}</div>
                  </div>
                </div>
                <div className="mt-4 space-y-1 text-sm">
                  <div><span className="text-gray-500">{T.class[l]}: </span>{c.className || '—'}</div>
                  <div className="text-xs text-gray-500">{T.born[l]}: {new Date(c.dateOfBirth).toLocaleDateString()}</div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                  <Link href={'/' + locale + '/parent/children/' + c.id + '?tab=grades'}
                        className="rounded bg-brand-600 px-3 py-1 text-white hover:bg-brand-700">
                    {T.grades[l]}
                  </Link>
                  <Link href={'/' + locale + '/parent/children/' + c.id + '?tab=invoices'}
                        className="rounded border border-brand-600 px-3 py-1 text-brand-700 hover:bg-teal-50">
                    {T.invoices[l]}
                  </Link>
                  <Link href={'/' + locale + '/parent/children/' + c.id + '?tab=attendance'}
                        className="rounded border border-brand-600 px-3 py-1 text-brand-700 hover:bg-teal-50">
                    {T.attendance[l]}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
`);

// ---------- Announcements ----------
put('apps/web/app/[locale]/parent/announcements/page.tsx', `'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';

const T = {
  title: { en: 'Announcements', fr: 'Annonces',     ar: 'الإعلانات' },
  empty: { en: 'No announcements.', fr: 'Aucune annonce.', ar: 'لا توجد إعلانات.' },
} as const;

export default function ParentAnnouncements() {
  const { locale } = useParams() as { locale: string };
  const l: 'en' | 'fr' | 'ar' = locale === 'en' || locale === 'ar' ? locale : 'fr';
  const [rows, setRows] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    apiFetch('/api/v1/parent/announcements')
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => setRows(Array.isArray(d) ? d : []))
      .catch((e) => setErr(String(e)));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold">{T.title[l]}</h1>
      {err && <p className="mt-4 text-red-600">{err}</p>}
      <div className="mt-6 space-y-3">
        {rows.length === 0 && !err && <p className="text-gray-500">{T.empty[l]}</p>}
        {rows.map((a) => (
          <div key={a.id} className="rounded-xl border bg-white p-5">
            <div className="font-semibold">{a.title}</div>
            <div className="mt-1 text-xs text-gray-500">
              {a.publishedAt ? new Date(a.publishedAt).toLocaleString() : ''}
            </div>
            <p className="mt-3 text-sm text-gray-700 whitespace-pre-wrap">{a.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
`);

// ---------- Child detail (tabs) ----------
put('apps/web/app/[locale]/parent/children/[id]/page.tsx', `'use client';
import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { formatXAF } from '@/lib/format';

const T = {
  grades:     { en: 'Grades',     fr: 'Notes',         ar: 'العلامات' },
  invoices:   { en: 'Invoices',   fr: 'Factures',      ar: 'الفواتير' },
  attendance: { en: 'Attendance', fr: 'Presence',      ar: 'الحضور' },
  back:       { en: 'Back',       fr: 'Retour',        ar: 'رجوع' },
  loading:    { en: 'Loading...', fr: 'Chargement...', ar: 'جار التحميل...' },
  noGrades:   { en: 'No grades yet.',  fr: 'Aucune note.',   ar: 'لا توجد علامات.' },
  noInvoices: { en: 'No invoices yet.', fr: 'Aucune facture.', ar: 'لا توجد فواتير.' },
  billed:     { en: 'Billed',     fr: 'Facture',       ar: 'المفوتر' },
  paid:       { en: 'Paid',       fr: 'Paye',          ar: 'المدفوع' },
  balance:    { en: 'Balance',    fr: 'Solde',         ar: 'الرصيد' },
  number:     { en: 'Number',     fr: 'Numero',        ar: 'الرقم' },
  total:      { en: 'Total',      fr: 'Total',         ar: 'الاجمالي' },
  status:     { en: 'Status',     fr: 'Statut',        ar: 'الحالة' },
  due:        { en: 'Due',        fr: 'Echeance',      ar: 'الاستحقاق' },
  present:    { en: 'Present',    fr: 'Presents',      ar: 'حاضر' },
  absent:     { en: 'Absent',     fr: 'Absents',       ar: 'غائب' },
  late:       { en: 'Late',       fr: 'Retards',       ar: 'متأخر' },
  excused:    { en: 'Excused',    fr: 'Excuses',       ar: 'بعذر' },
  rate:       { en: 'Rate',       fr: 'Taux',          ar: 'النسبة' },
  subject:    { en: 'Subject',    fr: 'Matiere',       ar: 'المادة' },
  score:      { en: 'Score',      fr: 'Note',          ar: 'العلامة' },
  coef:       { en: 'Coef',       fr: 'Coef',          ar: 'المعامل' },
  average:    { en: 'Average',    fr: 'Moyenne',       ar: 'المعدل' },
  recent:     { en: 'Recent records', fr: 'Enregistrements recents', ar: 'السجلات الأخيرة' },
  date:       { en: 'Date',       fr: 'Date',          ar: 'التاريخ' },
} as const;

export default function ChildDetail() {
  const { locale, id } = useParams() as { locale: string; id: string };
  const search = useSearchParams();
  const router = useRouter();
  const tab = search.get('tab') || 'grades';
  const l: 'en' | 'fr' | 'ar' = locale === 'en' || locale === 'ar' ? locale : 'fr';

  const [grades, setGrades] = useState<any>(null);
  const [invoices, setInvoices] = useState<any>(null);
  const [attendance, setAttendance] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setErr(null);
    if (tab === 'grades' && !grades) {
      apiFetch('/api/v1/parent/children/' + id + '/grades')
        .then((r) => r.ok ? r.json() : Promise.reject(r.status))
        .then(setGrades).catch((e) => setErr(String(e)));
    }
    if (tab === 'invoices' && !invoices) {
      apiFetch('/api/v1/parent/children/' + id + '/invoices')
        .then((r) => r.ok ? r.json() : Promise.reject(r.status))
        .then(setInvoices).catch((e) => setErr(String(e)));
    }
    if (tab === 'attendance' && !attendance) {
      apiFetch('/api/v1/parent/children/' + id + '/attendance')
        .then((r) => r.ok ? r.json() : Promise.reject(r.status))
        .then(setAttendance).catch((e) => setErr(String(e)));
    }
  }, [tab, id, grades, invoices, attendance]);

  const childName = (grades?.student || invoices?.student || attendance?.student)?.firstName;

  return (
    <div>
      <button onClick={() => router.back()} className="text-sm text-gray-600 hover:text-gray-900">← {T.back[l]}</button>
      <h1 className="mt-2 text-2xl font-bold">{childName || T.loading[l]}</h1>

      <div className="mt-6 flex gap-2 border-b">
        {(['grades','invoices','attendance'] as const).map((k) => (
          <button
            key={k}
            onClick={() => router.push('/' + locale + '/parent/children/' + id + '?tab=' + k)}
            className={
              'border-b-2 px-4 py-2 text-sm ' +
              (tab === k ? 'border-brand-600 font-medium text-brand-700' : 'border-transparent text-gray-600 hover:text-gray-900')
            }
          >
            {T[k][l]}
          </button>
        ))}
      </div>

      {err && <p className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{err}</p>}

      {tab === 'grades' && (
        <div className="mt-6">
          {!grades && !err && <p className="text-gray-500">{T.loading[l]}</p>}
          {grades && grades.exams.length === 0 && <p className="text-gray-500">{T.noGrades[l]}</p>}
          {grades && grades.exams.map((e: any) => (
            <div key={e.exam.id} className="mb-6 rounded-xl border bg-white p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">{e.exam.name}</div>
                  <div className="text-xs text-gray-500">{e.exam.type} — {new Date(e.exam.startDate).toLocaleDateString()}</div>
                </div>
                {e.average !== null && (
                  <div className="rounded-lg bg-teal-50 px-3 py-1 text-sm font-bold text-teal-800">
                    {T.average[l]}: {e.average.toFixed(2)} / 20
                  </div>
                )}
              </div>
              <table className="mt-4 w-full border-collapse text-sm">
                <thead className="bg-gray-50 text-left">
                  <tr>
                    <th className="p-2 font-medium">{T.subject[l]}</th>
                    <th className="p-2 text-center font-medium">{T.coef[l]}</th>
                    <th className="p-2 text-right font-medium">{T.score[l]}</th>
                  </tr>
                </thead>
                <tbody>
                  {e.marks.map((m: any, i: number) => (
                    <tr key={i} className="border-t">
                      <td className="p-2">{m.subject} <span className="text-xs text-gray-400">({m.code})</span></td>
                      <td className="p-2 text-center">{m.coefficient}</td>
                      <td className="p-2 text-right font-medium">{m.score} / {m.maxScore}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {tab === 'invoices' && (
        <div className="mt-6">
          {!invoices && !err && <p className="text-gray-500">{T.loading[l]}</p>}
          {invoices && (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-xl border bg-teal-50 p-4">
                  <div className="text-xs uppercase text-teal-800 opacity-70">{T.billed[l]}</div>
                  <div className="mt-1 text-2xl font-bold text-teal-900">{formatXAF(invoices.summary.totalBilled)}</div>
                </div>
                <div className="rounded-xl border bg-green-50 p-4">
                  <div className="text-xs uppercase text-green-800 opacity-70">{T.paid[l]}</div>
                  <div className="mt-1 text-2xl font-bold text-green-900">{formatXAF(invoices.summary.totalPaid)}</div>
                </div>
                <div className="rounded-xl border bg-red-50 p-4">
                  <div className="text-xs uppercase text-red-800 opacity-70">{T.balance[l]}</div>
                  <div className="mt-1 text-2xl font-bold text-red-900">{formatXAF(invoices.summary.balance)}</div>
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
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.invoices.length === 0 && (
                      <tr><td colSpan={6} className="p-6 text-center text-gray-500">{T.noInvoices[l]}</td></tr>
                    )}
                    {invoices.invoices.map((i: any) => (
                      <tr key={i.id} className="border-t">
                        <td className="p-3 font-mono text-xs">{i.invoiceNo}</td>
                        <td className="p-3 text-xs">{new Date(i.dueDate).toLocaleDateString()}</td>
                        <td className="p-3 text-right">{formatXAF(i.total)}</td>
                        <td className="p-3 text-right text-green-700">{formatXAF(i.amountPaid)}</td>
                        <td className="p-3 text-right font-medium">{formatXAF(i.balance)}</td>
                        <td className="p-3">
                          <span className={
                            'rounded-full px-2 py-0.5 text-xs font-medium ' +
                            (i.status === 'PAID' ? 'bg-green-100 text-green-800' :
                             i.status === 'PARTIAL' ? 'bg-yellow-100 text-yellow-800' :
                             'bg-red-100 text-red-800')
                          }>{i.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'attendance' && (
        <div className="mt-6">
          {!attendance && !err && <p className="text-gray-500">{T.loading[l]}</p>}
          {attendance && (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <Stat label={T.present[l]} value={attendance.summary.PRESENT} tone="green" />
                <Stat label={T.absent[l]} value={attendance.summary.ABSENT} tone="red" />
                <Stat label={T.late[l]} value={attendance.summary.LATE} tone="amber" />
                <Stat label={T.excused[l]} value={attendance.summary.EXCUSED} tone="blue" />
                <Stat label={T.rate[l]} value={attendance.summary.rate + '%'} tone="brand" />
              </div>
              <h3 className="mt-6 text-sm font-semibold">{T.recent[l]}</h3>
              <div className="mt-2 max-h-96 overflow-y-auto rounded-lg border">
                <table className="w-full border-collapse text-sm">
                  <thead className="sticky top-0 bg-gray-50 text-left">
                    <tr>
                      <th className="p-2 font-medium">{T.date[l]}</th>
                      <th className="p-2 font-medium">{T.status[l]}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendance.recent.length === 0 && (
                      <tr><td colSpan={2} className="p-4 text-center text-gray-500">—</td></tr>
                    )}
                    {attendance.recent.map((r: any, i: number) => (
                      <tr key={i} className="border-t">
                        <td className="p-2 text-xs">{new Date(r.date).toLocaleDateString()}</td>
                        <td className="p-2">
                          <span className={
                            'rounded-full px-2 py-0.5 text-xs font-medium ' +
                            (r.status === 'PRESENT' ? 'bg-green-100 text-green-800' :
                             r.status === 'ABSENT' ? 'bg-red-100 text-red-800' :
                             r.status === 'LATE' ? 'bg-yellow-100 text-yellow-800' :
                             'bg-blue-100 text-blue-800')
                          }>{r.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone: 'green'|'red'|'amber'|'blue'|'brand' }) {
  const colors: Record<string, string> = {
    green: 'border-green-200 bg-green-50 text-green-900',
    red: 'border-red-200 bg-red-50 text-red-900',
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    blue: 'border-blue-200 bg-blue-50 text-blue-900',
    brand: 'border-teal-200 bg-teal-50 text-teal-900',
  };
  return (
    <div className={'rounded-xl border p-3 ' + colors[tone]}>
      <div className="text-[10px] uppercase tracking-wide opacity-70">{label}</div>
      <div className="mt-1 text-xl font-bold">{value}</div>
    </div>
  );
}
`);

console.log('\n✅ Parent frontend written (4 files)');
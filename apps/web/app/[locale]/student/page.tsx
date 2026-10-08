'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { formatXAF } from '@/lib/format';

const T = {
  welcome:   { en: 'Hello', fr: 'Bonjour', ar: 'مرحبا' },
  admission: { en: 'Admission no', fr: 'Matricule', ar: 'رقم التسجيل' },
  klass:     { en: 'Class', fr: 'Classe', ar: 'الفصل' },
  loading:   { en: 'Loading…', fr: 'Chargement…', ar: 'جار التحميل…' },
  glance:    { en: 'Quick glance', fr: 'Apercu rapide', ar: 'نظرة سريعة' },
  rate:      { en: 'Attendance rate', fr: 'Taux de presence', ar: 'نسبة الحضور' },
  outstanding: { en: 'Outstanding balance', fr: 'Solde impaye', ar: 'الرصيد المستحق' },
  examsTaken:  { en: 'Exams taken', fr: 'Examens passes', ar: 'الامتحانات' },
  recentExams: { en: 'Recent exams', fr: 'Examens recents', ar: 'الامتحانات الأخيرة' },
  subject:   { en: 'Subject', fr: 'Matiere', ar: 'المادة' },
  score:     { en: 'Score', fr: 'Note', ar: 'العلامة' },
  average:   { en: 'Average', fr: 'Moyenne', ar: 'المعدل' },
  noMarks:   { en: 'No marks yet.', fr: 'Aucune note.', ar: 'لا توجد علامات.' },
};

export default function StudentHome() {
  const { locale } = useParams() as { locale: string };
  const l: 'en'|'fr'|'ar' = locale === 'en' || locale === 'ar' ? locale : 'fr';
  const [me, setMe] = useState<any>(null);
  const [grades, setGrades] = useState<any>(null);
  const [att, setAtt] = useState<any>(null);
  const [inv, setInv] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch('/api/v1/student/me').then((r) => r.ok ? r.json() : null),
      apiFetch('/api/v1/student/grades').then((r) => r.ok ? r.json() : null),
      apiFetch('/api/v1/student/attendance').then((r) => r.ok ? r.json() : null),
      apiFetch('/api/v1/student/invoices').then((r) => r.ok ? r.json() : null),
    ]).then(([a, b, c, d]) => { setMe(a); setGrades(b); setAtt(c); setInv(d); })
      .catch((e) => setErr(String(e)));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold">{me ? T.welcome[l] + ', ' + me.firstName : T.loading[l]}</h1>
      {me && (
        <p className="mt-1 text-sm text-gray-500">
          {T.admission[l]}: <span className="font-mono">{me.admissionNo}</span> · {T.klass[l]}: {me.className || '—'}
        </p>
      )}
      {err && <p className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{err}</p>}

      <h2 className="mt-8 text-lg font-semibold">{T.glance[l]}</h2>
      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card label={T.rate[l]} value={att ? att.summary.rate + '%' : '—'} tone="green" />
        <Card label={T.outstanding[l]} value={inv ? formatXAF(inv.summary.balance) : '—'} tone="red" />
        <Card label={T.examsTaken[l]} value={grades ? grades.exams.length : '—'} tone="violet" />
      </div>

      <h2 className="mt-10 text-lg font-semibold">{T.recentExams[l]}</h2>
      {grades && grades.exams.length === 0 && <p className="mt-3 text-gray-500">{T.noMarks[l]}</p>}
      <div className="mt-3 space-y-4">
        {grades && grades.exams.slice(0, 3).map((e: any) => (
          <div key={e.exam.id} className="rounded-xl border bg-white p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold">{e.exam.name}</div>
                <div className="text-xs text-gray-500">{e.exam.type} · {new Date(e.exam.startDate).toLocaleDateString()}</div>
              </div>
              {e.average !== null && (
                <div className="rounded-lg bg-teal-50 px-3 py-1 text-sm font-bold text-teal-800">
                  {T.average[l]}: {e.average.toFixed(2)} / 20 {e.rank ? '· #' + e.rank + '/' + e.classSize : ''}
                </div>
              )}
            </div>
            <table className="mt-3 w-full border-collapse text-sm">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="p-2 font-medium">{T.subject[l]}</th>
                  <th className="p-2 text-right font-medium">{T.score[l]}</th>
                </tr>
              </thead>
              <tbody>
                {e.marks.map((m: any, i: number) => (
                  <tr key={i} className="border-t">
                    <td className="p-2">{m.subject} <span className="text-xs text-gray-400">({m.code})</span></td>
                    <td className="p-2 text-right font-medium">{m.score} / {m.maxScore}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}

function Card({ label, value, tone }: { label: string; value: any; tone: 'green'|'red'|'violet' }) {
  const colors: Record<string, string> = {
    green:  'border-green-200 bg-green-50 text-green-900',
    red:    'border-red-200 bg-red-50 text-red-900',
    violet: 'border-violet-200 bg-violet-50 text-violet-900',
  };
  return (
    <div className={'rounded-xl border p-5 ' + colors[tone]}>
      <div className="text-xs uppercase tracking-wide opacity-70">{label}</div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
    </div>
  );
}

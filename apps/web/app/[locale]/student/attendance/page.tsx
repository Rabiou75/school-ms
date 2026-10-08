'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';

export default function StudentAttendance() {
  const { locale } = useParams() as { locale: string };
  const l = locale === 'en' || locale === 'ar' ? locale : 'fr';
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  const T = {
    title:   { en: 'My attendance', fr: 'Ma presence', ar: 'حضوري' },
    present: { en: 'Present', fr: 'Presents', ar: 'حاضر' },
    absent:  { en: 'Absent', fr: 'Absents', ar: 'غائب' },
    late:    { en: 'Late', fr: 'Retards', ar: 'متأخر' },
    excused: { en: 'Excused', fr: 'Excuses', ar: 'بعذر' },
    rate:    { en: 'Rate', fr: 'Taux', ar: 'النسبة' },
    recent:  { en: 'Recent records', fr: 'Enregistrements recents', ar: 'السجلات الأخيرة' },
    date:    { en: 'Date', fr: 'Date', ar: 'التاريخ' },
    status:  { en: 'Status', fr: 'Statut', ar: 'الحالة' },
    loading: { en: 'Loading…', fr: 'Chargement…', ar: 'جار التحميل…' },
  };

  useEffect(() => {
    apiFetch('/api/v1/student/attendance')
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
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Stat label={T.present[l]} value={data.summary.PRESENT} tone="green" />
            <Stat label={T.absent[l]} value={data.summary.ABSENT} tone="red" />
            <Stat label={T.late[l]} value={data.summary.LATE} tone="amber" />
            <Stat label={T.excused[l]} value={data.summary.EXCUSED} tone="blue" />
            <Stat label={T.rate[l]} value={data.summary.rate + '%'} tone="brand" />
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
                {data.recent.length === 0 && (
                  <tr><td colSpan={2} className="p-4 text-center text-gray-500">—</td></tr>
                )}
                {data.recent.map((r: any, i: number) => (
                  <tr key={i} className="border-t">
                    <td className="p-2 text-xs">{new Date(r.date).toLocaleDateString()}</td>
                    <td className="p-2">
                      <span className={'rounded-full px-2 py-0.5 text-xs font-medium ' +
                        (r.status === 'PRESENT' ? 'bg-green-100 text-green-800' :
                         r.status === 'ABSENT' ? 'bg-red-100 text-red-800' :
                         r.status === 'LATE' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800')}>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone: 'green'|'red'|'amber'|'blue'|'brand' }) {
  const colors: Record<string, string> = {
    green: 'border-green-200 bg-green-50 text-green-900',
    red:   'border-red-200 bg-red-50 text-red-900',
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    blue:  'border-blue-200 bg-blue-50 text-blue-900',
    brand: 'border-teal-200 bg-teal-50 text-teal-900',
  };
  return (
    <div className={'rounded-xl border p-3 ' + colors[tone]}>
      <div className="text-[10px] uppercase tracking-wide opacity-70">{label}</div>
      <div className="mt-1 text-xl font-bold">{value}</div>
    </div>
  );
}

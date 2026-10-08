'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';

export default function StudentGrades() {
  const { locale } = useParams() as { locale: string };
  const l = locale === 'en' || locale === 'ar' ? locale : 'fr';
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  const T = {
    title:   { en: 'My grades', fr: 'Mes notes', ar: 'علاماتي' },
    subject: { en: 'Subject', fr: 'Matiere', ar: 'المادة' },
    score:   { en: 'Score', fr: 'Note', ar: 'العلامة' },
    coef:    { en: 'Coef', fr: 'Coef', ar: 'المعامل' },
    average: { en: 'Average', fr: 'Moyenne', ar: 'المعدل' },
    rank:    { en: 'Rank', fr: 'Rang', ar: 'الترتيب' },
    noData:  { en: 'No grades yet.', fr: 'Aucune note.', ar: 'لا توجد علامات.' },
    loading: { en: 'Loading…', fr: 'Chargement…', ar: 'جار التحميل…' },
  };

  useEffect(() => {
    apiFetch('/api/v1/student/grades')
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setData)
      .catch((e) => setErr(String(e)));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold">{T.title[l]}</h1>
      {err && <p className="mt-4 text-red-600">{err}</p>}
      {!data && !err && <p className="mt-4 text-gray-500">{T.loading[l]}</p>}
      {data && data.exams.length === 0 && <p className="mt-4 text-gray-500">{T.noData[l]}</p>}
      <div className="mt-6 space-y-6">
        {data?.exams.map((e: any) => (
          <div key={e.exam.id} className="rounded-xl border bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-semibold">{e.exam.name}</div>
                <div className="text-xs text-gray-500">{e.exam.type} · {new Date(e.exam.startDate).toLocaleDateString()}</div>
              </div>
              <div className="flex gap-2">
                {e.average !== null && (
                  <span className="rounded-lg bg-teal-50 px-3 py-1 text-sm font-bold text-teal-800">
                    {T.average[l]}: {e.average.toFixed(2)} / 20
                  </span>
                )}
                {e.rank && (
                  <span className="rounded-lg bg-violet-50 px-3 py-1 text-sm font-bold text-violet-800">
                    {T.rank[l]}: #{e.rank}/{e.classSize}
                  </span>
                )}
              </div>
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
    </div>
  );
}

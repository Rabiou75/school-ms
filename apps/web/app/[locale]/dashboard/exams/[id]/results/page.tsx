'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';

type Row = {
  student: { id: string; admissionNo: string; firstName: string; lastName: string };
  subjectCount: number;
  average: number | null;
  rank: number | null;
  marks: { subject: string; code: string; score: number; maxScore: number; coefficient: number }[];
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function grade20(avg: number | null): { label: string; cls: string } {
  if (avg === null) return { label: '—', cls: 'text-gray-400' };
  if (avg >= 16) return { label: 'A', cls: 'text-green-700 font-bold' };
  if (avg >= 14) return { label: 'B', cls: 'text-green-600' };
  if (avg >= 12) return { label: 'C', cls: 'text-yellow-700' };
  if (avg >= 10) return { label: 'D', cls: 'text-orange-700' };
  return { label: 'F', cls: 'text-red-700 font-bold' };
}

export default function ResultsPage() {
  const t = useTranslations('exams');
  const { locale, id } = useParams() as { locale: string; id: string };
  const search = useSearchParams();
  const router = useRouter();
  const classId = search.get('classId') || '';
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!classId) return;
    apiFetch('/api/v1/exams/' + id + '/results?classId=' + classId)
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((d) => setRows(Array.isArray(d.rows) ? d.rows : []))
      .catch((e) => setErr(String(e)));
  }, [classId, id]);

  const download = async (studentId: string, filename: string) => {
    const token = localStorage.getItem('accessToken');
    const res = await fetch(API_URL + '/api/v1/exams/' + id + '/report-card/' + studentId + '?classId=' + classId, {
      headers: { Authorization: 'Bearer ' + token },
    });
    if (!res.ok) { alert('PDF error ' + res.status); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('results')}</h1>
        <button onClick={() => router.back()} className="rounded border px-4 py-2 text-sm hover:bg-gray-50">
          {t('back')}
        </button>
      </div>

      {err && <p className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{err}</p>}

      <div className="mt-6 overflow-x-auto rounded-lg border">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-3 font-medium">{t('rank')}</th>
              <th className="p-3 font-medium">{t('student')}</th>
              <th className="p-3 text-right font-medium">{t('subjectsTaken')}</th>
              <th className="p-3 text-right font-medium">{t('average')}</th>
              <th className="p-3 font-medium">{t('grade')}</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !err && (
              <tr><td colSpan={6} className="p-6 text-center text-gray-500">{t('noResults')}</td></tr>
            )}
            {rows.map((r) => {
              const g = grade20(r.average);
              return (
                <tr key={r.student.id} className="border-t hover:bg-gray-50">
                  <td className="p-3 font-mono text-xs">{r.rank ?? '—'}</td>
                  <td className="p-3">
                    <div className="font-medium">{r.student.firstName} {r.student.lastName}</div>
                    <div className="text-[10px] text-gray-500 font-mono">{r.student.admissionNo}</div>
                  </td>
                  <td className="p-3 text-right">{r.subjectCount}</td>
                  <td className="p-3 text-right font-medium">
                    {r.average !== null ? r.average.toFixed(2) + ' / 20' : '—'}
                  </td>
                  <td className={'p-3 ' + g.cls}>{g.label}</td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => download(r.student.id, 'bulletin-' + r.student.admissionNo + '.pdf')}
                      className="rounded border border-brand-600 px-3 py-1 text-xs text-brand-700 hover:bg-brand-50"
                    >
                      {t('pdf')}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

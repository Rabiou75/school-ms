'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';

export default function StudentAnnouncements() {
  const { locale } = useParams() as { locale: string };
  const l = locale === 'en' || locale === 'ar' ? locale : 'fr';
  const [rows, setRows] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const T = {
    title:   { en: 'Announcements', fr: 'Annonces', ar: 'الإعلانات' },
    empty:   { en: 'No announcements.', fr: 'Aucune annonce.', ar: 'لا توجد إعلانات.' },
    loading: { en: 'Loading…', fr: 'Chargement…', ar: 'جار التحميل…' },
  };

  useEffect(() => {
    apiFetch('/api/v1/student/announcements')
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setRows(Array.isArray(d) ? d : []))
      .catch((e) => setErr(String(e)));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold">{T.title[l]}</h1>
      {err && <p className="mt-4 text-red-600">{err}</p>}
      {!err && rows.length === 0 && <p className="mt-4 text-gray-500">{T.loading[l]}</p>}
      <div className="mt-6 space-y-3">
        {rows.map((a) => (
          <div key={a.id} className="rounded-xl border bg-white p-5">
            <div className="font-semibold">{a.title}</div>
            <div className="mt-1 text-xs text-gray-500">
              {a.publishedAt ? new Date(a.publishedAt).toLocaleString() : ''}
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm text-gray-700">{a.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';

type Exam = {
  id: string;
  name: string;
  type: string;
  startDate: string;
  endDate: string;
  class?: { id: string; name: string } | null;
  term?: { id: string; name: string } | null;
  _count?: { marks: number };
};

type Class = { id: string; name: string };

export default function ExamsPage() {
  const t = useTranslations('exams');
  const { locale } = useParams() as { locale: string };
  const [exams, setExams] = useState<Exam[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [show, setShow] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    try {
      const [e, c] = await Promise.all([
        apiFetch('/api/v1/exams').then((r) => r.json()),
        apiFetch('/api/v1/classes').then((r) => r.json()),
      ]);
      setExams(Array.isArray(e) ? e : []);
      setClasses(Array.isArray(c) ? c : []);
      setErr(null);
    } catch (e: any) { setErr(String(e)); }
  };
  useEffect(() => { load(); }, []);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <button
          onClick={() => setShow(true)}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700"
        >
          + {t('newExam')}
        </button>
      </div>

      {err && <p className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{err}</p>}

      <div className="mt-6 overflow-x-auto rounded-lg border">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-3 font-medium">{t('name')}</th>
              <th className="p-3 font-medium">{t('type')}</th>
              <th className="p-3 font-medium">{t('class')}</th>
              <th className="p-3 font-medium">{t('dates')}</th>
              <th className="p-3 font-medium">{t('marks')}</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {exams.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-gray-500">{t('noExams')}</td></tr>
            )}
            {exams.map((e) => (
              <tr key={e.id} className="border-t hover:bg-gray-50">
                <td className="p-3 font-medium">{e.name}</td>
                <td className="p-3"><span className="rounded bg-gray-100 px-2 py-0.5 text-xs">{e.type}</span></td>
                <td className="p-3">{e.class?.name || '—'}</td>
                <td className="p-3 text-xs text-gray-600">
                  {new Date(e.startDate).toLocaleDateString()} → {new Date(e.endDate).toLocaleDateString()}
                </td>
                <td className="p-3 text-right">{e._count?.marks ?? 0}</td>
                <td className="p-3 text-right">
                  <Link href={'/' + locale + '/dashboard/exams/' + e.id}
                        className="rounded bg-brand-600 px-3 py-1 text-xs text-white hover:bg-brand-700">
                    {t('enter')}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {show && (
        <NewExamModal
          classes={classes}
          onClose={() => setShow(false)}
          onSaved={() => { setShow(false); load(); }}
        />
      )}
    </div>
  );
}

function NewExamModal({ classes, onClose, onSaved }: { classes: Class[]; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations('exams');
  const [name, setName] = useState('');
  const [type, setType] = useState('MID_TERM');
  const [classId, setClassId] = useState(classes[0]?.id || '');
  const [start, setStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [end, setEnd] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString().slice(0, 10);
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setErr(null);
    try {
      const r = await apiFetch('/api/v1/exams', {
        method: 'POST',
        body: JSON.stringify({ name, type, classId, startDate: start, endDate: end }),
      });
      if (!r.ok) throw new Error(await r.text());
      onSaved();
    } catch (e: any) { setErr(String(e)); setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg space-y-4 rounded-xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold">{t('newExam')}</h3>
        <div>
          <label className="block text-sm font-medium">{t('name')}</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required
                 className="mt-1 w-full rounded border px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium">{t('type')}</label>
          <select value={type} onChange={(e) => setType(e.target.value)}
                  className="mt-1 w-full rounded border px-3 py-2">
            <option value="QUIZ">QUIZ</option>
            <option value="MID_TERM">MID_TERM</option>
            <option value="FINAL">FINAL</option>
            <option value="MOCK">MOCK</option>
            <option value="CONTINUOUS">CONTINUOUS</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium">{t('class')}</label>
          <select value={classId} onChange={(e) => setClassId(e.target.value)} required
                  className="mt-1 w-full rounded border px-3 py-2">
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium">{t('start')}</label>
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)}
                   className="mt-1 w-full rounded border px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium">{t('end')}</label>
            <input type="date" value={end} onChange={(e) => setEnd(e.target.value)}
                   className="mt-1 w-full rounded border px-3 py-2" />
          </div>
        </div>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded border px-4 py-2 text-sm">{t('cancel')}</button>
          <button disabled={saving}
                  className="rounded bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700 disabled:opacity-50">
            {saving ? '...' : t('save')}
          </button>
        </div>
      </form>
    </div>
  );
}

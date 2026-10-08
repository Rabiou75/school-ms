'use client';
import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';

type Subject = { id: string; name: string; code: string };
type Student = { id: string; admissionNo: string; firstName: string; lastName: string };
type GridStudent = { student: Student; marks: Record<string, { score: number; maxScore: number; coefficient: number }> };
type Grid = { exam: any; klass: any; subjects: Subject[]; students: GridStudent[] };

export default function ExamGridPage() {
  const t = useTranslations('exams');
  const { locale, id } = useParams() as { locale: string; id: string };
  const router = useRouter();
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [classId, setClassId] = useState('');
  const [grid, setGrid] = useState<Grid | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    apiFetch('/api/v1/classes')
      .then((r) => r.ok ? r.json() : [])
      .then((c) => {
        setClasses(Array.isArray(c) ? c : []);
        if (!classId && c[0]?.id) setClassId(c[0].id);
      });
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    if (!classId) return;
    setGrid(null); setDraft({}); setOk(null);
    apiFetch('/api/v1/exams/' + id + '/grid?classId=' + classId)
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((g: Grid) => setGrid(g))
      .catch((e) => setErr(String(e)));
  }, [classId, id]);

  const cellKey = (sid: string, subId: string) => sid + ':' + subId;

  const setScore = (sid: string, subId: string, value: string) => {
    setDraft((d) => ({ ...d, [cellKey(sid, subId)]: value }));
  };

  const current = (sid: string, subId: string): string => {
    const k = cellKey(sid, subId);
    if (k in draft) return draft[k];
    const m = grid?.students.find((s) => s.student.id === sid)?.marks[subId];
    return m !== undefined ? String(m.score) : '';
  };

  const save = async () => {
    if (!grid) return;
    setSaving(true); setErr(null); setOk(null);
    try {
      const entries = Object.entries(draft)
        .filter(([_, v]) => v !== '' && !isNaN(Number(v)))
        .map(([k, v]) => {
          const [studentId, subjectId] = k.split(':');
          return { studentId, subjectId, score: Number(v), maxScore: 20, coefficient: 1 };
        });
      if (entries.length === 0) { setOk(t('noChanges')); setSaving(false); return; }
      const r = await apiFetch('/api/v1/exams/' + id + '/marks', {
        method: 'POST',
        body: JSON.stringify({ entries }),
      });
      if (!r.ok) throw new Error(await r.text());
      setOk(t('saved'));
      setDraft({});
      const g = await apiFetch('/api/v1/exams/' + id + '/grid?classId=' + classId).then((r) => r.json());
      setGrid(g);
    } catch (e: any) { setErr(String(e)); }
    finally { setSaving(false); }
  };

  const dirty = useMemo(() => Object.keys(draft).length, [draft]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{grid?.exam?.name || t('marksEntry')}</h1>
          {grid?.exam?.type && <div className="text-xs text-gray-500">{grid.exam.type}</div>}
        </div>
        <div className="flex items-center gap-2">
          <select value={classId} onChange={(e) => setClassId(e.target.value)}
                  className="rounded border px-3 py-2 text-sm">
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button
            onClick={() => router.push('/' + locale + '/dashboard/exams/' + id + '/results?classId=' + classId)}
            className="rounded border px-4 py-2 text-sm hover:bg-gray-50"
          >
            {t('viewResults')}
          </button>
          <button onClick={save} disabled={saving}
                  className="rounded bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700 disabled:opacity-50">
            {saving ? '...' : t('save') + (dirty ? ' (' + dirty + ')' : '')}
          </button>
        </div>
      </div>

      {err && <p className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{err}</p>}
      {ok && <p className="mt-4 rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800">{ok}</p>}

      {!grid && !err && <p className="mt-8 text-center text-gray-500">{t('loading')}</p>}

      {grid && (
        <div className="mt-6 overflow-x-auto rounded-lg border">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="p-2 font-medium">{t('student')}</th>
                {grid.subjects.map((sub) => (
                  <th key={sub.id} className="p-2 text-center font-medium">
                    {sub.code}
                    <div className="text-[10px] font-normal text-gray-500">{sub.name}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grid.students.map((gs) => (
                <tr key={gs.student.id} className="border-t">
                  <td className="p-2 whitespace-nowrap">
                    <div className="font-medium">{gs.student.firstName} {gs.student.lastName}</div>
                    <div className="text-[10px] text-gray-500 font-mono">{gs.student.admissionNo}</div>
                  </td>
                  {grid.subjects.map((sub) => {
                    const val = current(gs.student.id, sub.id);
                    const isDraft = cellKey(gs.student.id, sub.id) in draft;
                    return (
                      <td key={sub.id} className="p-1 text-center">
                        <input
                          type="number"
                          min={0} max={20} step={0.25}
                          value={val}
                          onChange={(e) => setScore(gs.student.id, sub.id, e.target.value)}
                          className={
                            'w-16 rounded border px-2 py-1 text-center text-sm ' +
                            (isDraft ? 'border-brand-500 bg-teal-50' : 'border-gray-200')
                          }
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

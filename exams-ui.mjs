import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

const root = process.cwd();
const put = (p, c) => {
  const full = join(root, p);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, c, 'utf8');
  console.log('  + ' + p);
};

// ============================================================
// Exams list page
// ============================================================
put('apps/web/app/[locale]/dashboard/exams/page.tsx', `'use client';
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
`);

// ============================================================
// Marks entry grid
// ============================================================
put('apps/web/app/[locale]/dashboard/exams/[id]/page.tsx', `'use client';
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
`);

// ============================================================
// Results page
// ============================================================
put('apps/web/app/[locale]/dashboard/exams/[id]/results/page.tsx', `'use client';
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
`);

// ============================================================
// i18n
// ============================================================
const exams = {
  en: {
    title: 'Exams & Grades', newExam: 'New exam', name: 'Name', type: 'Type', class: 'Class',
    dates: 'Dates', marks: 'Marks', enter: 'Enter marks', noExams: 'No exams yet.',
    start: 'Start date', end: 'End date', save: 'Save', cancel: 'Cancel',
    marksEntry: 'Marks entry', viewResults: 'View results', student: 'Student',
    loading: 'Loading...', noChanges: 'No changes to save.', saved: 'Marks saved.',
    results: 'Results', rank: 'Rank', subjectsTaken: 'Subjects', average: 'Average',
    grade: 'Grade', noResults: 'No results yet.', back: 'Back', pdf: 'PDF',
  },
  fr: {
    title: 'Examens & Notes', newExam: 'Nouvel examen', name: 'Nom', type: 'Type', class: 'Classe',
    dates: 'Dates', marks: 'Notes', enter: 'Saisir les notes', noExams: 'Aucun examen.',
    start: 'Date debut', end: 'Date fin', save: 'Enregistrer', cancel: 'Annuler',
    marksEntry: 'Saisie des notes', viewResults: 'Voir resultats', student: 'Eleve',
    loading: 'Chargement...', noChanges: 'Aucune modification.', saved: 'Notes enregistrees.',
    results: 'Resultats', rank: 'Rang', subjectsTaken: 'Matieres', average: 'Moyenne',
    grade: 'Mention', noResults: 'Aucun resultat.', back: 'Retour', pdf: 'PDF',
  },
  ar: {
    title: 'الامتحانات والعلامات', newExam: 'امتحان جديد', name: 'الاسم', type: 'النوع',
    class: 'الفصل', dates: 'التواريخ', marks: 'العلامات', enter: 'إدخال العلامات',
    noExams: 'لا توجد امتحانات.', start: 'تاريخ البداية', end: 'تاريخ النهاية',
    save: 'حفظ', cancel: 'إلغاء', marksEntry: 'إدخال العلامات', viewResults: 'عرض النتائج',
    student: 'الطالب', loading: 'جار التحميل...', noChanges: 'لا تغييرات.',
    saved: 'تم الحفظ.', results: 'النتائج', rank: 'الترتيب', subjectsTaken: 'المواد',
    average: 'المعدل', grade: 'التقدير', noResults: 'لا نتائج.', back: 'رجوع', pdf: 'PDF',
  },
};
for (const locale of ['en', 'fr', 'ar']) {
  const f = join(root, 'apps/web/messages/' + locale + '.json');
  const d = existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : {};
  d.exams = { ...(d.exams || {}), ...exams[locale] };
  writeFileSync(f, JSON.stringify(d, null, 2), 'utf8');
  console.log('  ~ apps/web/messages/' + locale + '.json (exams keys)');
}

console.log('\n✅ Exams UI written');
'use client';
import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { apiFetch } from '@/lib/api';

type Status = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
type Row = {
  student: {
    id: string;
    admissionNo: string;
    firstName: string;
    lastName: string;
    classId: string | null;
    className: string | null;
  };
  attendance: { id: string; status: Status } | null;
};
type Summary = Record<Status, number>;

const STATUSES: Status[] = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'];

const STATUS_STYLE: Record<Status, string> = {
  PRESENT: 'bg-green-100 text-green-800 border-green-300',
  ABSENT: 'bg-red-100 text-red-800 border-red-300',
  LATE: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  EXCUSED: 'bg-blue-100 text-blue-800 border-blue-300',
};

export default function AttendancePage() {
  const t = useTranslations('attendance');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [classId, setClassId] = useState<string>('');
  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const load = async () => {
    try {
      const qs = new URLSearchParams({ date });
      if (classId) qs.set('classId', classId);
      const [sheetR, sumR] = await Promise.all([
        apiFetch('/api/v1/attendance?' + qs.toString()),
        apiFetch('/api/v1/attendance/summary?date=' + date),
      ]);
      if (!sheetR.ok) throw new Error('sheet ' + sheetR.status);
      if (!sumR.ok) throw new Error('summary ' + sumR.status);
      const sheet = await sheetR.json();
      const sum = await sumR.json();
      setRows(Array.isArray(sheet) ? sheet : []);
      setSummary(sum);
      setErr(null);
    } catch (e: any) {
      setRows([]);
      setErr(String(e));
    }
  };

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    if (!token) return;
    apiFetch('/api/v1/classes')
      .then((r) => (r.ok ? r.json() : []))
      .then((c) => setClasses(Array.isArray(c) ? c : []))
      .catch(() => setClasses([]));
  }, []);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [date, classId]);

  const markOne = async (studentId: string, status: Status) => {
    setSaving(studentId);
    try {
      const r = await apiFetch('/api/v1/attendance', {
        method: 'POST',
        body: JSON.stringify({ studentId, date, status }),
      });
      if (!r.ok) throw new Error(await r.text());
      await load();
    } catch (e: any) {
      setErr(String(e));
    } finally {
      setSaving(null);
    }
  };

  const markAllPresent = async () => {
    if (!classId) {
      setErr('Selectionnez une classe pour marquer tout le monde present.');
      return;
    }
    setSaving('__all__');
    try {
      const r = await apiFetch('/api/v1/attendance/bulk', {
        method: 'POST',
        body: JSON.stringify({ classId, date, status: 'PRESENT' }),
      });
      if (!r.ok) throw new Error(await r.text());
      await load();
    } catch (e: any) {
      setErr(String(e));
    } finally {
      setSaving(null);
    }
  };

  const presentPct = useMemo(() => {
    if (!summary) return 0;
    const total = STATUSES.reduce((s, k) => s + (summary[k] || 0), 0);
    if (!total) return 0;
    return Math.round(((summary.PRESENT + summary.LATE) / total) * 100);
  }, [summary]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded border px-3 py-2 text-sm"
          />
          <select
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className="rounded border px-3 py-2 text-sm"
          >
            <option value="">{t('allClasses')}</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button
            onClick={markAllPresent}
            disabled={!classId || saving === '__all__'}
            className="rounded bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {saving === '__all__' ? '...' : t('markAllPresent')}
          </button>
        </div>
      </div>

      {err && <p className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{err}</p>}

      {summary && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Stat label={t('present')} value={summary.PRESENT} tone="green" />
          <Stat label={t('absent')} value={summary.ABSENT} tone="red" />
          <Stat label={t('late')} value={summary.LATE} tone="yellow" />
          <Stat label={t('excused')} value={summary.EXCUSED} tone="blue" />
          <Stat label={t('rate')} value={presentPct + '%'} tone="brand" />
        </div>
      )}

      <div className="mt-6 overflow-x-auto rounded-lg border">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-3 font-medium">{t('matricule')}</th>
              <th className="p-3 font-medium">{t('name')}</th>
              <th className="p-3 font-medium">{t('class')}</th>
              <th className="p-3 font-medium">{t('status')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !err && (
              <tr><td colSpan={4} className="p-6 text-center text-gray-500">{t('noStudents')}</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.student.id} className="border-t hover:bg-gray-50">
                <td className="p-3 font-mono text-xs">{r.student.admissionNo}</td>
                <td className="p-3">{r.student.firstName} {r.student.lastName}</td>
                <td className="p-3">{r.student.className || '-'}</td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
                    {STATUSES.map((s) => {
                      const active = r.attendance?.status === s;
                      return (
                        <button
                          key={s}
                          disabled={saving === r.student.id}
                          onClick={() => markOne(r.student.id, s)}
                          className={
                            'rounded border px-3 py-1 text-xs font-medium transition ' +
                            (active
                              ? STATUS_STYLE[s]
                              : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50')
                          }
                        >
                          {t(s.toLowerCase() as any)}
                        </button>
                      );
                    })}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone: 'green' | 'red' | 'yellow' | 'blue' | 'brand' }) {
  const colors: Record<string, string> = {
    green: 'border-green-200 bg-green-50 text-green-800',
    red: 'border-red-200 bg-red-50 text-red-800',
    yellow: 'border-yellow-200 bg-yellow-50 text-yellow-800',
    blue: 'border-blue-200 bg-blue-50 text-blue-800',
    brand: 'border-teal-200 bg-teal-50 text-teal-800',
  };
  return (
    <div className={'rounded-xl border p-4 ' + colors[tone]}>
      <div className="text-xs uppercase tracking-wide opacity-70">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}

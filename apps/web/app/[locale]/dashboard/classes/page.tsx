'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';

type ClassRow = {
  id: string;
  name: string;
  level: string | null;
  capacity: number;
  academicYear: string | null;
  studentCount: number;
};

export default function ClassesPage() {
  const t = useTranslations('classes');
  const { locale } = useParams() as { locale: string };
  const [rows, setRows] = useState<ClassRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ClassRow | null>(null);
  const [showNew, setShowNew] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await apiFetch('/api/v1/classes');
      if (!r.ok) throw new Error(r.status + ' ' + r.statusText);
      const d = await r.json();
      setRows(Array.isArray(d) ? d : []);
      setErr(null);
    } catch (e: any) { setRows([]); setErr(String(e)); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const remove = async (c: ClassRow) => {
    if (!confirm(t('confirmDelete').replace('{name}', c.name))) return;
    try {
      const r = await apiFetch('/api/v1/classes/' + c.id, { method: 'DELETE' });
      if (!r.ok) {
        const txt = await r.text();
        if (txt.includes('class_has_students')) {
          setErr(t('hasStudents'));
          return;
        }
        throw new Error(txt);
      }
      load();
    } catch (e: any) { setErr(String(e)); }
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <button
          onClick={() => setShowNew(true)}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700"
        >
          + {t('newClass')}
        </button>
      </div>

      {err && <p className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{err}</p>}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading && <p className="text-gray-500">{t('loading')}</p>}
        {!loading && rows.length === 0 && !err && (
          <p className="text-gray-500">{t('noClasses')}</p>
        )}
        {rows.map((c) => {
          const fill = c.capacity > 0 ? Math.round((c.studentCount / c.capacity) * 100) : 0;
          return (
            <div key={c.id} className="rounded-xl border bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-lg font-bold">{c.name}</div>
                  {c.academicYear && (
                    <div className="text-xs text-gray-500">{t('year')}: {c.academicYear}</div>
                  )}
                </div>
                <span className="rounded bg-teal-50 px-2 py-1 text-xs font-medium text-teal-700">
                  {c.studentCount}/{c.capacity}
                </span>
              </div>
              <div className="mt-4 h-2 w-full overflow-hidden rounded bg-gray-100">
                <div className="h-full bg-teal-500" style={{ width: fill + '%' }} />
              </div>
              <div className="mt-4 flex items-center justify-between text-xs">
                <Link
                  href={'/' + locale + '/dashboard/students?class=' + c.id}
                  className="text-brand-600 hover:underline"
                >
                  {t('viewStudents')} →
                </Link>
                <div className="flex gap-2">
                  <button onClick={() => setEditing(c)}
                          className="rounded border border-gray-300 px-2 py-1 hover:bg-gray-50">
                    {t('edit')}
                  </button>
                  <button onClick={() => remove(c)}
                          className="rounded border border-red-300 px-2 py-1 text-red-700 hover:bg-red-50">
                    {t('delete')}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {(showNew || editing) && (
        <ClassModal
          klass={editing}
          onClose={() => { setShowNew(false); setEditing(null); }}
          onSaved={() => { setShowNew(false); setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function ClassModal({
  klass, onClose, onSaved,
}: { klass: ClassRow | null; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations('classes');
  const isEdit = !!klass;
  const [form, setForm] = useState({
    name: klass?.name ?? '',
    level: klass?.level ?? '',
    capacity: klass?.capacity ?? 40,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setErr(null);
    try {
      const url = isEdit ? '/api/v1/classes/' + klass!.id : '/api/v1/classes';
      const method = isEdit ? 'PUT' : 'POST';
      const r = await apiFetch(url, {
        method,
        body: JSON.stringify({ ...form, capacity: Number(form.capacity) }),
      });
      if (!r.ok) {
        const txt = await r.text();
        if (txt.includes('class_name_exists')) { setErr(t('nameExists')); setSaving(false); return; }
        if (txt.includes('no_current_academic_year')) { setErr(t('noYear')); setSaving(false); return; }
        throw new Error(txt);
      }
      onSaved();
    } catch (e: any) { setErr(String(e)); setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md space-y-4 rounded-xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold">{isEdit ? t('editTitle') : t('newTitle')}</h3>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-700">{t('name')}</span>
          <input required value={form.name}
                 onChange={(e) => setForm({ ...form, name: e.target.value })}
                 placeholder="6eme B"
                 className="w-full rounded border px-3 py-2" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-700">{t('level')}</span>
          <input value={form.level}
                 onChange={(e) => setForm({ ...form, level: e.target.value })}
                 placeholder="6eme"
                 className="w-full rounded border px-3 py-2" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-700">{t('capacity')}</span>
          <input required type="number" min={1} max={200} value={form.capacity}
                 onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })}
                 className="w-full rounded border px-3 py-2" />
        </label>
        {err && <p className="text-sm text-red-600 whitespace-pre-wrap">{err}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded border px-4 py-2 text-sm">
            {t('cancel')}
          </button>
          <button disabled={saving}
                  className="rounded bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700 disabled:opacity-50">
            {saving ? '...' : t('save')}
          </button>
        </div>
      </form>
    </div>
  );
}

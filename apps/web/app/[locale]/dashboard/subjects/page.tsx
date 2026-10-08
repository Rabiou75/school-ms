'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { apiFetch } from '@/lib/api';

type Subject = {
  id: string;
  code: string;
  name: string;
  nameFr: string | null;
  nameAr: string | null;
};

export default function SubjectsPage() {
  const t = useTranslations('subjects');
  const [rows, setRows] = useState<Subject[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<Subject | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const r = await apiFetch('/api/v1/subjects');
      if (!r.ok) throw new Error(r.status + ' ' + r.statusText);
      const d = await r.json();
      setRows(Array.isArray(d) ? d : []);
      setErr(null);
    } catch (e: any) { setRows([]); setErr(String(e)); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const remove = async (s: Subject) => {
    if (!confirm(t('confirmDelete').replace('{name}', s.name))) return;
    try {
      const r = await apiFetch('/api/v1/subjects/' + s.id, { method: 'DELETE' });
      if (!r.ok) {
        const txt = await r.text();
        if (txt.includes('subject_has_marks')) { setErr(t('hasMarks')); return; }
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
          + {t('newSubject')}
        </button>
      </div>

      {err && <p className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{err}</p>}

      <div className="mt-6 overflow-x-auto rounded-lg border">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-3 font-medium">{t('code')}</th>
              <th className="p-3 font-medium">{t('name')}</th>
              <th className="p-3 font-medium">{t('nameFr')}</th>
              <th className="p-3 font-medium">{t('nameAr')}</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={5} className="p-6 text-center text-gray-500">{t('loading')}</td></tr>}
            {!loading && rows.length === 0 && !err && (
              <tr><td colSpan={5} className="p-6 text-center text-gray-500">{t('noSubjects')}</td></tr>
            )}
            {rows.map((s) => (
              <tr key={s.id} className="border-t hover:bg-gray-50">
                <td className="p-3 font-mono text-xs">{s.code}</td>
                <td className="p-3 font-medium">{s.name}</td>
                <td className="p-3 text-xs">{s.nameFr || '—'}</td>
                <td className="p-3 text-xs" dir="rtl">{s.nameAr || '—'}</td>
                <td className="p-3 text-right whitespace-nowrap">
                  <button onClick={() => setEditing(s)}
                          className="rounded border border-gray-300 px-3 py-1 text-xs hover:bg-gray-50">
                    {t('edit')}
                  </button>
                  <button onClick={() => remove(s)}
                          className="ml-2 rounded border border-red-300 px-3 py-1 text-xs text-red-700 hover:bg-red-50">
                    {t('delete')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(showNew || editing) && (
        <SubjectModal
          subject={editing}
          onClose={() => { setShowNew(false); setEditing(null); }}
          onSaved={() => { setShowNew(false); setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function SubjectModal({
  subject, onClose, onSaved,
}: { subject: Subject | null; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations('subjects');
  const isEdit = !!subject;
  const [form, setForm] = useState({
    code:   subject?.code ?? '',
    name:   subject?.name ?? '',
    nameFr: subject?.nameFr ?? '',
    nameAr: subject?.nameAr ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setErr(null);
    try {
      const url = isEdit ? '/api/v1/subjects/' + subject!.id : '/api/v1/subjects';
      const method = isEdit ? 'PUT' : 'POST';
      const r = await apiFetch(url, { method, body: JSON.stringify(form) });
      if (!r.ok) {
        const txt = await r.text();
        if (txt.includes('subject_code_exists')) { setErr(t('codeExists')); setSaving(false); return; }
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
          <span className="mb-1 block text-xs font-medium text-gray-700">{t('code')}</span>
          <input required value={form.code}
                 onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                 placeholder="MATH"
                 className="w-full rounded border px-3 py-2 font-mono" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-700">{t('name')}</span>
          <input required value={form.name}
                 onChange={(e) => setForm({ ...form, name: e.target.value })}
                 placeholder="Mathematics"
                 className="w-full rounded border px-3 py-2" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-700">{t('nameFr')}</span>
          <input value={form.nameFr}
                 onChange={(e) => setForm({ ...form, nameFr: e.target.value })}
                 placeholder="Mathematiques"
                 className="w-full rounded border px-3 py-2" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-700">{t('nameAr')}</span>
          <input value={form.nameAr} dir="rtl"
                 onChange={(e) => setForm({ ...form, nameAr: e.target.value })}
                 placeholder="الرياضيات"
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

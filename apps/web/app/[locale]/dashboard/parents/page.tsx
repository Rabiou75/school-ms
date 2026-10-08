'use client';
import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { apiFetch } from '@/lib/api';

type Guardian = {
  id: string;
  firstName: string;
  lastName: string;
  relation: string;
  phone: string;
  email: string | null;
  hasAccount: boolean;
  accountActive: boolean | null;
  childrenCount: number;
  children: { id: string; firstName: string; lastName: string; admissionNo: string }[];
};

export default function ParentsPage() {
  const t = useTranslations('parents');
  const [rows, setRows] = useState<Guardian[]>([]);
  const [q, setQ] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Guardian | null>(null);
  const [showNew, setShowNew] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await apiFetch('/api/v1/guardians');
      if (!r.ok) throw new Error(r.status + ' ' + r.statusText);
      const d = await r.json();
      setRows(Array.isArray(d) ? d : []);
      setErr(null);
    } catch (e: any) { setRows([]); setErr(String(e)); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!q) return rows;
    const n = q.toLowerCase();
    return rows.filter((g) =>
      g.firstName.toLowerCase().includes(n) ||
      g.lastName.toLowerCase().includes(n) ||
      g.phone.toLowerCase().includes(n) ||
      (g.email || '').toLowerCase().includes(n)
    );
  }, [rows, q]);

  const remove = async (g: Guardian) => {
    if (!confirm(t('confirmDelete').replace('{name}', g.firstName + ' ' + g.lastName))) return;
    try {
      const r = await apiFetch('/api/v1/guardians/' + g.id, { method: 'DELETE' });
      if (!r.ok) {
        const txt = await r.text();
        if (txt.includes('guardian_has_children')) { setErr(t('hasChildren')); return; }
        throw new Error(txt);
      }
      load();
    } catch (e: any) { setErr(String(e)); }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <div className="flex items-center gap-2">
          <input
            placeholder={t('search')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-64 rounded border px-3 py-2 text-sm"
          />
          <button
            onClick={() => setShowNew(true)}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700"
          >
            + {t('newParent')}
          </button>
        </div>
      </div>

      {err && <p className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{err}</p>}

      <div className="mt-6 overflow-x-auto rounded-lg border">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-3 font-medium">{t('name')}</th>
              <th className="p-3 font-medium">{t('relation')}</th>
              <th className="p-3 font-medium">{t('phone')}</th>
              <th className="p-3 font-medium">{t('email')}</th>
              <th className="p-3 font-medium">{t('account')}</th>
              <th className="p-3 text-center font-medium">{t('children')}</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="p-6 text-center text-gray-500">{t('loading')}</td></tr>}
            {!loading && filtered.length === 0 && !err && (
              <tr><td colSpan={7} className="p-6 text-center text-gray-500">
                {q ? t('noResults') : t('noParents')}
              </td></tr>
            )}
            {filtered.map((g) => (
              <tr key={g.id} className="border-t hover:bg-gray-50">
                <td className="p-3">
                  <div className="font-medium">{g.firstName} {g.lastName}</div>
                </td>
                <td className="p-3 text-xs">{g.relation}</td>
                <td className="p-3 font-mono text-xs">{g.phone}</td>
                <td className="p-3 text-xs">{g.email || '—'}</td>
                <td className="p-3">
                  {g.hasAccount ? (
                    <span className={'rounded-full px-2 py-0.5 text-xs font-medium ' +
                      (g.accountActive ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700')}>
                      {g.accountActive ? t('active') : t('inactive')}
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                      {t('noAccount')}
                    </span>
                  )}
                </td>
                <td className="p-3 text-center">
                  <span className="rounded bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700">
                    {g.childrenCount}
                  </span>
                </td>
                <td className="p-3 text-right whitespace-nowrap">
                  <button onClick={() => setEditing(g)}
                          className="rounded border border-gray-300 px-3 py-1 text-xs hover:bg-gray-50">
                    {t('edit')}
                  </button>
                  <button onClick={() => remove(g)}
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
        <GuardianModal
          guardian={editing}
          onClose={() => { setShowNew(false); setEditing(null); }}
          onSaved={() => { setShowNew(false); setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function GuardianModal({
  guardian, onClose, onSaved,
}: { guardian: Guardian | null; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations('parents');
  const isEdit = !!guardian;
  const [form, setForm] = useState({
    firstName: guardian?.firstName ?? '',
    lastName:  guardian?.lastName ?? '',
    relation:  guardian?.relation ?? 'Pere',
    phone:     guardian?.phone ?? '',
    email:     guardian?.email ?? '',
    password:  '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setErr(null);
    try {
      const url = isEdit ? '/api/v1/guardians/' + guardian!.id : '/api/v1/guardians';
      const method = isEdit ? 'PUT' : 'POST';
      const payload: any = {
        firstName: form.firstName,
        lastName: form.lastName,
        relation: form.relation,
        phone: form.phone,
        email: form.email || undefined,
      };
      if (form.password) payload.password = form.password;

      const r = await apiFetch(url, { method, body: JSON.stringify(payload) });
      if (!r.ok) {
        const txt = await r.text();
        if (txt.includes('email_already_registered')) { setErr(t('emailTaken')); setSaving(false); return; }
        if (txt.includes('email_required_for_account')) { setErr(t('emailRequired')); setSaving(false); return; }
        throw new Error(txt);
      }
      onSaved();
    } catch (e: any) { setErr(String(e)); setSaving(false); }
  };

  const accountWillBeCreated = !guardian?.hasAccount && form.email && form.password;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl space-y-4 rounded-xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold">{isEdit ? t('editTitle') : t('newTitle')}</h3>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t('firstName')}>
            <input required value={form.firstName}
                   onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                   className="w-full rounded border px-3 py-2" />
          </Field>
          <Field label={t('lastName')}>
            <input required value={form.lastName}
                   onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                   className="w-full rounded border px-3 py-2" />
          </Field>
          <Field label={t('relation')}>
            <select value={form.relation}
                    onChange={(e) => setForm({ ...form, relation: e.target.value })}
                    className="w-full rounded border px-3 py-2">
              <option value="Pere">Père</option>
              <option value="Mere">Mère</option>
              <option value="Tuteur">Tuteur</option>
              <option value="Tutrice">Tutrice</option>
              <option value="Autre">Autre</option>
            </select>
          </Field>
          <Field label={t('phone')}>
            <input required value={form.phone}
                   onChange={(e) => setForm({ ...form, phone: e.target.value })}
                   placeholder="+237 6 XX XX XX XX"
                   className="w-full rounded border px-3 py-2" />
          </Field>
        </div>

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-600">
            {guardian?.hasAccount ? t('loginAccount') : t('createLoginAccount')}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('email')}>
              <input type="email" value={form.email}
                     onChange={(e) => setForm({ ...form, email: e.target.value })}
                     placeholder="parent@example.com"
                     className="w-full rounded border px-3 py-2" />
            </Field>
            <Field label={guardian?.hasAccount ? t('newPassword') : t('password')}>
              <input type="password" value={form.password}
                     onChange={(e) => setForm({ ...form, password: e.target.value })}
                     placeholder={guardian?.hasAccount ? t('leaveBlank') : t('minChars')}
                     className="w-full rounded border px-3 py-2" />
            </Field>
          </div>
          {accountWillBeCreated && (
            <p className="mt-2 text-xs text-teal-700">
              ✓ {t('accountInfo')}
            </p>
          )}
          {!guardian?.hasAccount && !form.password && (
            <p className="mt-2 text-xs text-gray-500">
              {t('optionalAccountHint')}
            </p>
          )}
        </div>

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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-700">{label}</span>
      {children}
    </label>
  );
}

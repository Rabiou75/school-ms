'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { apiFetch } from '@/lib/api';
import { formatXAF } from '@/lib/format';

type Staff = {
  id: string;
  employeeNo: string;
  firstName: string;
  lastName: string;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  position: string;
  hireDate: string;
  baseSalary: number;
  isActive: boolean;
  user?: { email: string; role: string } | null;
};

export default function StaffPage() {
  const t = useTranslations('staff');
  const [rows, setRows] = useState<Staff[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Staff | null>(null);
  const [showNew, setShowNew] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await apiFetch('/api/v1/staff');
      if (!r.ok) throw new Error(r.status + ' ' + r.statusText);
      const d = await r.json();
      setRows(Array.isArray(d) ? d : []);
      setErr(null);
    } catch (e: any) { setRows([]); setErr(String(e)); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const remove = async (s: Staff) => {
    if (!confirm(t('confirmDelete').replace('{name}', s.firstName + ' ' + s.lastName))) return;
    try {
      const r = await apiFetch('/api/v1/staff/' + s.id, { method: 'DELETE' });
      if (!r.ok) throw new Error(await r.text());
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
          + {t('newStaff')}
        </button>
      </div>

      {err && <p className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{err}</p>}

      <div className="mt-6 overflow-x-auto rounded-lg border">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-3 font-medium">{t('employeeNo')}</th>
              <th className="p-3 font-medium">{t('name')}</th>
              <th className="p-3 font-medium">{t('position')}</th>
              <th className="p-3 font-medium">{t('hireDate')}</th>
              <th className="p-3 text-right font-medium">{t('salary')}</th>
              <th className="p-3 font-medium">{t('status')}</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="p-6 text-center text-gray-500">{t('loading')}</td></tr>}
            {!loading && rows.length === 0 && !err && (
              <tr><td colSpan={7} className="p-6 text-center text-gray-500">{t('noStaff')}</td></tr>
            )}
            {rows.map((s) => (
              <tr key={s.id} className="border-t hover:bg-gray-50">
                <td className="p-3 font-mono text-xs">{s.employeeNo}</td>
                <td className="p-3">
                  <div className="font-medium">{s.firstName} {s.lastName}</div>
                  <div className="text-[10px] text-gray-500">{s.gender}</div>
                </td>
                <td className="p-3">{s.position}</td>
                <td className="p-3 text-xs">{new Date(s.hireDate).toLocaleDateString()}</td>
                <td className="p-3 text-right font-medium">{formatXAF(s.baseSalary)}</td>
                <td className="p-3">
                  <span className={'rounded-full px-2 py-0.5 text-xs font-medium ' + (s.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700')}>
                    {s.isActive ? t('active') : t('inactive')}
                  </span>
                </td>
                <td className="p-3 text-right whitespace-nowrap">
                  <button onClick={() => setEditing(s)} className="rounded border border-gray-300 px-3 py-1 text-xs hover:bg-gray-50">
                    {t('edit')}
                  </button>
                  <button onClick={() => remove(s)} className="ml-2 rounded border border-red-300 px-3 py-1 text-xs text-red-700 hover:bg-red-50">
                    {t('delete')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(showNew || editing) && (
        <StaffModal
          staff={editing}
          onClose={() => { setShowNew(false); setEditing(null); }}
          onSaved={() => { setShowNew(false); setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function StaffModal({
  staff, onClose, onSaved,
}: { staff: Staff | null; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations('staff');
  const isEdit = !!staff;
  const [form, setForm] = useState({
    employeeNo: staff?.employeeNo ?? '',
    firstName:  staff?.firstName ?? '',
    lastName:   staff?.lastName ?? '',
    gender:     (staff?.gender ?? 'MALE') as 'MALE' | 'FEMALE' | 'OTHER',
    position:   staff?.position ?? '',
    hireDate:   staff?.hireDate ? staff.hireDate.slice(0, 10) : new Date().toISOString().slice(0, 10),
    baseSalary: staff?.baseSalary ?? 150000,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setErr(null);
    try {
      const url = isEdit ? '/api/v1/staff/' + staff!.id : '/api/v1/staff';
      const method = isEdit ? 'PUT' : 'POST';
      const r = await apiFetch(url, {
        method,
        body: JSON.stringify({ ...form, baseSalary: Number(form.baseSalary) }),
      });
      if (!r.ok) throw new Error(await r.text());
      onSaved();
    } catch (e: any) { setErr(String(e)); setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl space-y-4 rounded-xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold">{isEdit ? t('editTitle') : t('newTitle')}</h3>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('employeeNo')}>
            <input required value={form.employeeNo}
                   onChange={(e) => setForm({ ...form, employeeNo: e.target.value })}
                   className="w-full rounded border px-3 py-2" />
          </Field>
          <Field label={t('gender')}>
            <select value={form.gender}
                    onChange={(e) => setForm({ ...form, gender: e.target.value as any })}
                    className="w-full rounded border px-3 py-2">
              <option value="MALE">{t('male')}</option>
              <option value="FEMALE">{t('female')}</option>
              <option value="OTHER">{t('other')}</option>
            </select>
          </Field>
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
          <Field label={t('position')}>
            <input required value={form.position}
                   onChange={(e) => setForm({ ...form, position: e.target.value })}
                   placeholder="Teacher - Mathematics"
                   className="w-full rounded border px-3 py-2" />
          </Field>
          <Field label={t('hireDate')}>
            <input required type="date" value={form.hireDate}
                   onChange={(e) => setForm({ ...form, hireDate: e.target.value })}
                   className="w-full rounded border px-3 py-2" />
          </Field>
          <Field label={t('salaryXAF') + ' — ' + formatXAF(Number(form.baseSalary))}>
            <input required type="number" min={0} step={5000} value={form.baseSalary}
                   onChange={(e) => setForm({ ...form, baseSalary: Number(e.target.value) })}
                   className="w-full rounded border px-3 py-2" />
          </Field>
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

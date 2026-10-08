import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const root = process.cwd();
const put = (p, c) => {
  const full = join(root, p);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, c, 'utf8');
  console.log('  + ' + p);
};

const page = `'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { apiFetch, getUser, setSession, getToken, type AuthUser } from '@/lib/api';

type Tab = 'school' | 'account' | 'users' | 'integrations' | 'years';

export default function SettingsPage() {
  const t = useTranslations('settings');
  const [tab, setTab] = useState<Tab>('school');

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: 'school',       label: t('tabSchool'),       icon: '🏫' },
    { key: 'account',      label: t('tabAccount'),      icon: '👤' },
    { key: 'users',        label: t('tabUsers'),        icon: '🔑' },
    { key: 'integrations', label: t('tabIntegrations'), icon: '🔌' },
    { key: 'years',        label: t('tabYears'),        icon: '📅' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <p className="mt-1 text-sm text-gray-500">{t('subtitle')}</p>

      <div className="mt-6 flex flex-wrap gap-2 border-b">
        {TABS.map((x) => (
          <button
            key={x.key}
            onClick={() => setTab(x.key)}
            className={
              'border-b-2 px-4 py-2 text-sm ' +
              (tab === x.key
                ? 'border-brand-600 font-medium text-brand-700'
                : 'border-transparent text-gray-600 hover:text-gray-900')
            }
          >
            <span className="mr-2">{x.icon}</span>
            {x.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === 'school' && <SchoolTab />}
        {tab === 'account' && <AccountTab />}
        {tab === 'users' && <UsersTab />}
        {tab === 'integrations' && <IntegrationsTab />}
        {tab === 'years' && <YearsTab />}
      </div>
    </div>
  );
}

// ============================================================
function SchoolTab() {
  const t = useTranslations('settings');
  const [form, setForm] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch('/api/v1/settings/school')
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setForm)
      .catch((e) => setErr(String(e)));
  }, []);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const save = async () => {
    setSaving(true); setOk(null); setErr(null);
    try {
      const r = await apiFetch('/api/v1/settings/school', {
        method: 'PUT',
        body: JSON.stringify({
          name: form.name, email: form.email, phone: form.phone,
          address: form.address, city: form.city, logoUrl: form.logoUrl,
          country: form.country, currency: form.currency,
          defaultLocale: form.defaultLocale, timezone: form.timezone,
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      setOk(t('saved'));
    } catch (e: any) { setErr(String(e)); }
    finally { setSaving(false); }
  };

  if (!form) return <p className="text-gray-500">{t('loading')}</p>;

  return (
    <div className="max-w-2xl space-y-4 rounded-xl border bg-white p-6">
      <Field label={t('schoolName')}>
        <input value={form.name || ''} onChange={set('name')} className="w-full rounded border px-3 py-2" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('email')}>
          <input value={form.email || ''} onChange={set('email')} className="w-full rounded border px-3 py-2" />
        </Field>
        <Field label={t('phone')}>
          <input value={form.phone || ''} onChange={set('phone')} className="w-full rounded border px-3 py-2" />
        </Field>
        <Field label={t('city')}>
          <input value={form.city || ''} onChange={set('city')} className="w-full rounded border px-3 py-2" />
        </Field>
        <Field label={t('country')}>
          <input value={form.country || ''} onChange={set('country')} className="w-full rounded border px-3 py-2" />
        </Field>
        <Field label={t('currency')}>
          <select value={form.currency || 'XAF'} onChange={set('currency')} className="w-full rounded border px-3 py-2">
            <option value="XAF">XAF — Franc CFA</option>
            <option value="EUR">EUR — Euro</option>
            <option value="USD">USD — Dollar</option>
          </select>
        </Field>
        <Field label={t('defaultLocale')}>
          <select value={form.defaultLocale || 'fr'} onChange={set('defaultLocale')} className="w-full rounded border px-3 py-2">
            <option value="fr">Français</option>
            <option value="en">English</option>
            <option value="ar">العربية</option>
          </select>
        </Field>
      </div>
      <Field label={t('address')}>
        <input value={form.address || ''} onChange={set('address')} className="w-full rounded border px-3 py-2" />
      </Field>
      <Field label={t('logoUrl')}>
        <input value={form.logoUrl || ''} onChange={set('logoUrl')} placeholder="https://…" className="w-full rounded border px-3 py-2" />
      </Field>

      {err && <p className="text-sm text-red-600">{err}</p>}
      {ok && <p className="text-sm text-green-700">{ok}</p>}

      <div className="flex justify-end">
        <button onClick={save} disabled={saving}
                className="rounded bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700 disabled:opacity-50">
          {saving ? '…' : t('save')}
        </button>
      </div>
    </div>
  );
}

// ============================================================
function AccountTab() {
  const t = useTranslations('settings');
  const [me, setMe] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState({ firstName: '', lastName: '', phone: '', locale: 'fr' });
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  useEffect(() => {
    const u = getUser();
    setMe(u);
    if (u) setProfile({ firstName: u.firstName, lastName: u.lastName, phone: '', locale: u.locale || 'fr' });
    apiFetch('/api/v1/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((full) => {
        if (full) {
          setProfile({ firstName: full.firstName, lastName: full.lastName, phone: full.phone || '', locale: full.locale || 'fr' });
          const token = getToken();
          if (token) setSession(token, { ...full });
        }
      })
      .catch(() => {});
  }, []);

  const saveProfile = async () => {
    setSavingProfile(true); setErr(null); setOk(null);
    try {
      const r = await apiFetch('/api/v1/settings/account/profile', {
        method: 'PUT',
        body: JSON.stringify(profile),
      });
      if (!r.ok) throw new Error(await r.text());
      const updated = await r.json();
      const token = getToken();
      if (token) setSession(token, updated);
      setOk(t('profileSaved'));
    } catch (e: any) { setErr(String(e)); }
    finally { setSavingProfile(false); }
  };

  const changePassword = async () => {
    if (pw.newPassword !== pw.confirm) { setErr(t('passwordMismatch')); return; }
    setSavingPw(true); setErr(null); setOk(null);
    try {
      const r = await apiFetch('/api/v1/settings/account/password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword: pw.currentPassword, newPassword: pw.newPassword }),
      });
      if (!r.ok) {
        const txt = await r.text();
        if (txt.includes('current_password_incorrect')) { setErr(t('currentPasswordWrong')); setSavingPw(false); return; }
        if (txt.includes('password_too_short')) { setErr(t('passwordTooShort')); setSavingPw(false); return; }
        throw new Error(txt);
      }
      setPw({ currentPassword: '', newPassword: '', confirm: '' });
      setOk(t('passwordChanged'));
    } catch (e: any) { setErr(String(e)); }
    finally { setSavingPw(false); }
  };

  if (!me) return <p className="text-gray-500">{t('loading')}</p>;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4 rounded-xl border bg-white p-6">
        <h2 className="text-lg font-semibold">{t('myProfile')}</h2>
        <Field label={t('firstName')}>
          <input value={profile.firstName} onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
                 className="w-full rounded border px-3 py-2" />
        </Field>
        <Field label={t('lastName')}>
          <input value={profile.lastName} onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
                 className="w-full rounded border px-3 py-2" />
        </Field>
        <Field label={t('phone')}>
          <input value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                 className="w-full rounded border px-3 py-2" />
        </Field>
        <Field label={t('locale')}>
          <select value={profile.locale} onChange={(e) => setProfile({ ...profile, locale: e.target.value })}
                  className="w-full rounded border px-3 py-2">
            <option value="fr">Français</option>
            <option value="en">English</option>
            <option value="ar">العربية</option>
          </select>
        </Field>
        <Field label={t('email')}>
          <input value={me.email} disabled className="w-full rounded border bg-gray-50 px-3 py-2 text-gray-500" />
        </Field>
        <div className="flex justify-end">
          <button onClick={saveProfile} disabled={savingProfile}
                  className="rounded bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700 disabled:opacity-50">
            {savingProfile ? '…' : t('saveProfile')}
          </button>
        </div>
      </div>

      <div className="space-y-4 rounded-xl border bg-white p-6">
        <h2 className="text-lg font-semibold">{t('changePassword')}</h2>
        <Field label={t('currentPassword')}>
          <input type="password" value={pw.currentPassword}
                 onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })}
                 className="w-full rounded border px-3 py-2" />
        </Field>
        <Field label={t('newPassword')}>
          <input type="password" value={pw.newPassword}
                 onChange={(e) => setPw({ ...pw, newPassword: e.target.value })}
                 className="w-full rounded border px-3 py-2" />
        </Field>
        <Field label={t('confirmPassword')}>
          <input type="password" value={pw.confirm}
                 onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
                 className="w-full rounded border px-3 py-2" />
        </Field>
        <p className="text-xs text-gray-500">{t('passwordHint')}</p>
        <div className="flex justify-end">
          <button onClick={changePassword} disabled={savingPw}
                  className="rounded bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700 disabled:opacity-50">
            {savingPw ? '…' : t('changePasswordButton')}
          </button>
        </div>
      </div>

      <div className="lg:col-span-2 space-y-2">
        {err && <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{err}</p>}
        {ok && <p className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800">{ok}</p>}
      </div>
    </div>
  );
}

// ============================================================
function UsersTab() {
  const t = useTranslations('settings');
  const [rows, setRows] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [resetFor, setResetFor] = useState<any | null>(null);

  const load = () => {
    apiFetch('/api/v1/settings/users')
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => setRows(Array.isArray(d) ? d : []))
      .catch((e) => setErr(String(e)));
  };
  useEffect(load, []);

  const changeRole = async (u: any, role: string) => {
    await apiFetch('/api/v1/settings/users/' + u.id, { method: 'PUT', body: JSON.stringify({ role }) });
    load();
  };
  const toggleActive = async (u: any) => {
    await apiFetch('/api/v1/settings/users/' + u.id, { method: 'PUT', body: JSON.stringify({ isActive: !u.isActive }) });
    load();
  };

  const ROLES = ['SUPER_ADMIN', 'ADMIN', 'PRINCIPAL', 'TEACHER', 'ACCOUNTANT', 'LIBRARIAN', 'PARENT', 'STUDENT'];

  return (
    <div>
      <h2 className="text-lg font-semibold">{t('usersTitle')}</h2>
      <p className="mt-1 text-sm text-gray-500">{t('usersHint')}</p>
      {err && <p className="mt-4 text-red-600">{err}</p>}

      <div className="mt-4 overflow-x-auto rounded-lg border">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-3 font-medium">{t('userName')}</th>
              <th className="p-3 font-medium">{t('email')}</th>
              <th className="p-3 font-medium">{t('userRole')}</th>
              <th className="p-3 font-medium">{t('userStatus')}</th>
              <th className="p-3 font-medium">{t('userLastLogin')}</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-gray-500">{t('noUsers')}</td></tr>}
            {rows.map((u) => (
              <tr key={u.id} className="border-t hover:bg-gray-50">
                <td className="p-3 font-medium">{u.firstName} {u.lastName}</td>
                <td className="p-3 text-xs">{u.email}</td>
                <td className="p-3">
                  <select value={u.role} onChange={(e) => changeRole(u, e.target.value)}
                          className="rounded border px-2 py-1 text-xs">
                    {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </td>
                <td className="p-3">
                  <button onClick={() => toggleActive(u)}
                          className={'rounded-full px-2 py-0.5 text-xs font-medium ' +
                            (u.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700')}>
                    {u.isActive ? t('active') : t('inactive')}
                  </button>
                </td>
                <td className="p-3 text-xs text-gray-500">
                  {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : '—'}
                </td>
                <td className="p-3 text-right">
                  <button onClick={() => setResetFor(u)}
                          className="rounded border border-gray-300 px-3 py-1 text-xs hover:bg-gray-50">
                    {t('resetPassword')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {resetFor && <ResetPasswordModal user={resetFor} onClose={() => setResetFor(null)} onSaved={() => setResetFor(null)} />}
    </div>
  );
}

function ResetPasswordModal({ user, onClose, onSaved }: { user: any; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations('settings');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setErr(null);
    try {
      const r = await apiFetch('/api/v1/settings/users/' + user.id + '/reset-password', {
        method: 'POST',
        body: JSON.stringify({ newPassword: pw }),
      });
      if (!r.ok) {
        const txt = await r.text();
        if (txt.includes('password_too_short')) { setErr(t('passwordTooShort')); setSaving(false); return; }
        throw new Error(txt);
      }
      onSaved();
    } catch (e: any) { setErr(String(e)); setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md space-y-4 rounded-xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold">{t('resetPassword')}</h3>
        <p className="text-xs text-gray-500">{user.firstName} {user.lastName} — {user.email}</p>
        <Field label={t('newPassword')}>
          <input type="text" value={pw} onChange={(e) => setPw(e.target.value)}
                 placeholder={t('minChars')} className="w-full rounded border px-3 py-2" />
        </Field>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded border px-4 py-2 text-sm">{t('cancel')}</button>
          <button disabled={saving} className="rounded bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700 disabled:opacity-50">
            {saving ? '…' : t('save')}
          </button>
        </div>
      </form>
    </div>
  );
}

// ============================================================
function IntegrationsTab() {
  const t = useTranslations('settings');
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch('/api/v1/settings/integrations')
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setData)
      .catch((e) => setErr(String(e)));
  }, []);

  const save = async () => {
    setSaving(true); setErr(null); setOk(null);
    try {
      const r = await apiFetch('/api/v1/settings/integrations', {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      if (!r.ok) throw new Error(await r.text());
      setOk(t('saved'));
    } catch (e: any) { setErr(String(e)); }
    finally { setSaving(false); }
  };

  if (!data) return <p className="text-gray-500">{t('loading')}</p>;

  const setSmtp = (k: string, v: any) => setData({ ...data, smtp: { ...data.smtp, [k]: v } });
  const setSms  = (k: string, v: any) => setData({ ...data, sms:  { ...data.sms,  [k]: v } });
  const setCpt  = (k: string, v: any) => setData({ ...data, cinetpay: { ...data.cinetpay, [k]: v } });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4 rounded-xl border bg-white p-6">
        <h2 className="text-lg font-semibold">📧 {t('smtpTitle')}</h2>
        <Field label={t('smtpHost')}>
          <input value={data.smtp.host} onChange={(e) => setSmtp('host', e.target.value)} className="w-full rounded border px-3 py-2" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('smtpPort')}>
            <input type="number" value={data.smtp.port} onChange={(e) => setSmtp('port', Number(e.target.value))} className="w-full rounded border px-3 py-2" />
          </Field>
          <Field label={t('smtpUser')}>
            <input value={data.smtp.user} onChange={(e) => setSmtp('user', e.target.value)} className="w-full rounded border px-3 py-2" />
          </Field>
        </div>
        <Field label={t('smtpPass')}>
          <input type="password" value={data.smtp.pass} onChange={(e) => setSmtp('pass', e.target.value)} className="w-full rounded border px-3 py-2" />
        </Field>
        <Field label={t('smtpFrom')}>
          <input value={data.smtp.from} onChange={(e) => setSmtp('from', e.target.value)} placeholder="School <no-reply@school.cm>" className="w-full rounded border px-3 py-2" />
        </Field>
      </div>

      <div className="space-y-4 rounded-xl border bg-white p-6">
        <h2 className="text-lg font-semibold">💬 {t('smsTitle')}</h2>
        <Field label={t('smsProvider')}>
          <select value={data.sms.provider} onChange={(e) => setSms('provider', e.target.value)} className="w-full rounded border px-3 py-2">
            <option value="africastalking">Africa&apos;s Talking</option>
            <option value="twilio">Twilio</option>
            <option value="orange">Orange SMS</option>
            <option value="mtn">MTN SMS</option>
          </select>
        </Field>
        <Field label={t('smsUsername')}>
          <input value={data.sms.username} onChange={(e) => setSms('username', e.target.value)} className="w-full rounded border px-3 py-2" />
        </Field>
        <Field label={t('smsApiKey')}>
          <input type="password" value={data.sms.apiKey} onChange={(e) => setSms('apiKey', e.target.value)} className="w-full rounded border px-3 py-2" />
        </Field>
        <Field label={t('smsSender')}>
          <input value={data.sms.sender} onChange={(e) => setSms('sender', e.target.value)} placeholder="SCHOOL" className="w-full rounded border px-3 py-2" />
        </Field>
      </div>

      <div className="space-y-4 rounded-xl border bg-white p-6 lg:col-span-2">
        <h2 className="text-lg font-semibold">💳 {t('cinetpayTitle')}</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('cinetpayApiKey')}>
            <input type="password" value={data.cinetpay.apiKey} onChange={(e) => setCpt('apiKey', e.target.value)}
                   placeholder="sk_test_… or sk_live_…" className="w-full rounded border px-3 py-2" />
          </Field>
          <Field label={t('cinetpaySiteId')}>
            <input value={data.cinetpay.siteId} onChange={(e) => setCpt('siteId', e.target.value)} className="w-full rounded border px-3 py-2" />
          </Field>
        </div>
        <p className="text-xs text-gray-500">{t('cinetpayHint')}</p>
      </div>

      <div className="lg:col-span-2 space-y-2">
        {err && <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{err}</p>}
        {ok && <p className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800">{ok}</p>}
      </div>

      <div className="lg:col-span-2 flex justify-end">
        <button onClick={save} disabled={saving}
                className="rounded bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700 disabled:opacity-50">
          {saving ? '…' : t('save')}
        </button>
      </div>
    </div>
  );
}

// ============================================================
function YearsTab() {
  const t = useTranslations('settings');
  const [rows, setRows] = useState<any[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = () => {
    apiFetch('/api/v1/settings/academic-years')
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => setRows(Array.isArray(d) ? d : []))
      .catch((e) => setErr(String(e)));
  };
  useEffect(load, []);

  const setCurrent = async (id: string) => {
    await apiFetch('/api/v1/settings/academic-years/' + id + '/set-current', { method: 'POST' });
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t('yearsTitle')}</h2>
        <button onClick={() => setShowNew(true)}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700">
          + {t('newYear')}
        </button>
      </div>

      {err && <p className="mt-4 text-red-600">{err}</p>}

      <div className="mt-4 overflow-hidden rounded-lg border">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-3 font-medium">{t('yearName')}</th>
              <th className="p-3 font-medium">{t('yearStart')}</th>
              <th className="p-3 font-medium">{t('yearEnd')}</th>
              <th className="p-3 font-medium">{t('yearStatus')}</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-gray-500">{t('noYears')}</td></tr>}
            {rows.map((y) => (
              <tr key={y.id} className="border-t">
                <td className="p-3 font-medium">{y.name}</td>
                <td className="p-3 text-xs">{new Date(y.startDate).toLocaleDateString()}</td>
                <td className="p-3 text-xs">{new Date(y.endDate).toLocaleDateString()}</td>
                <td className="p-3">
                  {y.isCurrent ? (
                    <span className="rounded-full bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-800">{t('current')}</span>
                  ) : (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{t('archived')}</span>
                  )}
                </td>
                <td className="p-3 text-right">
                  {!y.isCurrent && (
                    <button onClick={() => setCurrent(y.id)}
                            className="rounded border border-brand-600 px-3 py-1 text-xs text-brand-700 hover:bg-teal-50">
                      {t('setCurrent')}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showNew && <NewYearModal onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); load(); }} />}
    </div>
  );
}

function NewYearModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const t = useTranslations('settings');
  const [form, setForm] = useState({ name: '', startDate: '', endDate: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setErr(null);
    try {
      const r = await apiFetch('/api/v1/settings/academic-years', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error(await r.text());
      onSaved();
    } catch (e: any) { setErr(String(e)); setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md space-y-4 rounded-xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold">{t('newYear')}</h3>
        <Field label={t('yearName')}>
          <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                 placeholder="2026-2027" className="w-full rounded border px-3 py-2" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('yearStart')}>
            <input required type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                   className="w-full rounded border px-3 py-2" />
          </Field>
          <Field label={t('yearEnd')}>
            <input required type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                   className="w-full rounded border px-3 py-2" />
          </Field>
        </div>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded border px-4 py-2 text-sm">{t('cancel')}</button>
          <button disabled={saving} className="rounded bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700 disabled:opacity-50">
            {saving ? '…' : t('save')}
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
`;

put('apps/web/app/[locale]/dashboard/settings/page.tsx', page);
console.log('\n✅ Settings page written');
console.log('   File: apps/web/app/[locale]/dashboard/settings/page.tsx');
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const pagePath = join(root, 'apps/web/app/[locale]/dashboard/settings/page.tsx');
let src = readFileSync(pagePath, 'utf8');

// ============================================================
// Replace the entire UsersTab component with the extended one
// ============================================================
const startMarker = 'function UsersTab() {';
const endMarker = 'function ResetPasswordModal(';

const startIdx = src.indexOf(startMarker);
const endIdx   = src.indexOf(endMarker);

if (startIdx === -1 || endIdx === -1) {
  console.error('Could not locate UsersTab block — inspect the file manually.');
  process.exit(1);
}

const newUsersTab = `function UsersTab() {
  const t = useTranslations('settings');
  const [rows, setRows] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [editing, setEditing] = useState<any | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [resetFor, setResetFor] = useState<any | null>(null);
  const [me, setMe] = useState<any>(null);

  useEffect(() => {
    setMe(getUser());
  }, []);

  const load = () => {
    apiFetch('/api/v1/settings/users')
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => setRows(Array.isArray(d) ? d : []))
      .catch((e) => setErr(String(e)));
  };
  useEffect(load, []);

  const changeRole = async (u: any, role: string) => {
    setErr(null);
    const r = await apiFetch('/api/v1/settings/users/' + u.id, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    });
    if (!r.ok) {
      const txt = await r.text();
      if (txt.includes('cannot_demote_self')) { setErr(t('cannotDemoteSelf')); return; }
      if (txt.includes('last_super_admin')) { setErr(t('lastSuperAdmin')); return; }
      setErr(txt);
      return;
    }
    load();
  };

  const toggleActive = async (u: any) => {
    setErr(null);
    const r = await apiFetch('/api/v1/settings/users/' + u.id, {
      method: 'PUT',
      body: JSON.stringify({ isActive: !u.isActive }),
    });
    if (!r.ok) {
      const txt = await r.text();
      if (txt.includes('cannot_deactivate_self')) { setErr(t('cannotDeactivateSelf')); return; }
      setErr(txt);
      return;
    }
    load();
  };

  const remove = async (u: any) => {
    if (!confirm(t('confirmDeleteUser').replace('{name}', u.firstName + ' ' + u.lastName))) return;
    setErr(null); setOk(null);
    try {
      const r = await apiFetch('/api/v1/settings/users/' + u.id, { method: 'DELETE' });
      if (!r.ok) {
        const txt = await r.text();
        if (txt.includes('cannot_delete_self')) { setErr(t('cannotDeleteSelf')); return; }
        if (txt.includes('last_super_admin')) { setErr(t('lastSuperAdmin')); return; }
        setErr(txt);
        return;
      }
      const result = await r.json();
      if (result.mode === 'deactivated') {
        setOk(t('deactivatedNotDeleted'));
      } else {
        setOk(t('userDeleted'));
      }
      load();
    } catch (e: any) { setErr(String(e)); }
  };

  const ROLES = ['SUPER_ADMIN', 'ADMIN', 'PRINCIPAL', 'TEACHER', 'ACCOUNTANT', 'LIBRARIAN', 'PARENT', 'STUDENT'];

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{t('usersTitle')}</h2>
          <p className="mt-1 text-sm text-gray-500">{t('usersHint')}</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700"
        >
          + {t('newUser')}
        </button>
      </div>

      {err && (
        <p className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{err}</p>
      )}
      {ok && (
        <p className="mt-4 rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800">{ok}</p>
      )}

      <div className="mt-4 overflow-x-auto rounded-lg border">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-3 font-medium">{t('userName')}</th>
              <th className="p-3 font-medium">{t('email')}</th>
              <th className="p-3 font-medium">{t('userRole')}</th>
              <th className="p-3 font-medium">{t('userStatus')}</th>
              <th className="p-3 font-medium">{t('userLastLogin')}</th>
              <th className="p-3 text-right font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-gray-500">{t('noUsers')}</td></tr>
            )}
            {rows.map((u) => {
              const isSelf = me && me.id === u.id;
              return (
                <tr key={u.id} className="border-t hover:bg-gray-50">
                  <td className="p-3">
                    <div className="font-medium">
                      {u.firstName} {u.lastName}
                      {isSelf && <span className="ml-2 rounded bg-teal-100 px-2 py-0.5 text-[10px] font-medium text-teal-800">{t('you')}</span>}
                    </div>
                  </td>
                  <td className="p-3 text-xs">{u.email}</td>
                  <td className="p-3">
                    <select
                      value={u.role}
                      onChange={(e) => changeRole(u, e.target.value)}
                      className="rounded border px-2 py-1 text-xs"
                    >
                      {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => toggleActive(u)}
                      className={'rounded-full px-2 py-0.5 text-xs font-medium ' +
                        (u.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700')}
                    >
                      {u.isActive ? t('active') : t('inactive')}
                    </button>
                  </td>
                  <td className="p-3 text-xs text-gray-500">
                    {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : '—'}
                  </td>
                  <td className="p-3 text-right whitespace-nowrap">
                    <button
                      onClick={() => setEditing(u)}
                      className="rounded border border-gray-300 px-3 py-1 text-xs hover:bg-gray-50"
                    >
                      {t('edit')}
                    </button>
                    <button
                      onClick={() => setResetFor(u)}
                      className="ml-2 rounded border border-gray-300 px-3 py-1 text-xs hover:bg-gray-50"
                    >
                      🔑
                    </button>
                    <button
                      onClick={() => remove(u)}
                      disabled={isSelf}
                      title={isSelf ? t('cannotDeleteSelf') : ''}
                      className="ml-2 rounded border border-red-300 px-3 py-1 text-xs text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {t('delete')}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showNew && (
        <UserModal
          user={null}
          onClose={() => setShowNew(false)}
          onSaved={() => { setShowNew(false); load(); }}
        />
      )}
      {editing && (
        <UserModal
          user={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
      {resetFor && (
        <ResetPasswordModal
          user={resetFor}
          onClose={() => setResetFor(null)}
          onSaved={() => { setResetFor(null); setOk(t('passwordChanged')); }}
        />
      )}
    </div>
  );
}

// ============================================================
function UserModal({
  user, onClose, onSaved,
}: { user: any | null; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations('settings');
  const isEdit = !!user;
  const [form, setForm] = useState({
    firstName: user?.firstName ?? '',
    lastName:  user?.lastName ?? '',
    email:     user?.email ?? '',
    phone:     user?.phone ?? '',
    role:      user?.role ?? 'TEACHER',
    locale:    user?.locale ?? 'fr',
    password:  '',
    isActive:  user?.isActive ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const ROLES = ['SUPER_ADMIN', 'ADMIN', 'PRINCIPAL', 'TEACHER', 'ACCOUNTANT', 'LIBRARIAN', 'PARENT', 'STUDENT'];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setErr(null);
    try {
      const payload: any = {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone || undefined,
        role: form.role,
        locale: form.locale,
      };
      if (!isEdit) {
        payload.password = form.password;
      }
      if (isEdit) {
        payload.isActive = form.isActive;
      }

      const url = isEdit ? '/api/v1/settings/users/' + user.id : '/api/v1/settings/users';
      const method = isEdit ? 'PUT' : 'POST';
      const r = await apiFetch(url, { method, body: JSON.stringify(payload) });
      if (!r.ok) {
        const txt = await r.text();
        if (txt.includes('email_already_registered')) { setErr(t('emailTaken')); setSaving(false); return; }
        if (txt.includes('password_too_short')) { setErr(t('passwordTooShort')); setSaving(false); return; }
        if (txt.includes('cannot_demote_self')) { setErr(t('cannotDemoteSelf')); setSaving(false); return; }
        if (txt.includes('cannot_deactivate_self')) { setErr(t('cannotDeactivateSelf')); setSaving(false); return; }
        if (txt.includes('last_super_admin')) { setErr(t('lastSuperAdmin')); setSaving(false); return; }
        throw new Error(txt);
      }
      onSaved();
    } catch (e: any) { setErr(String(e)); setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl space-y-4 rounded-xl bg-white p-6 shadow-xl"
      >
        <h3 className="text-lg font-semibold">{isEdit ? t('editUser') : t('newUser')}</h3>

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
          <Field label={t('email')}>
            <input required type="email" value={form.email}
                   onChange={(e) => setForm({ ...form, email: e.target.value })}
                   className="w-full rounded border px-3 py-2" />
          </Field>
          <Field label={t('phone')}>
            <input value={form.phone}
                   onChange={(e) => setForm({ ...form, phone: e.target.value })}
                   placeholder="+237 6 XX XX XX XX"
                   className="w-full rounded border px-3 py-2" />
          </Field>
          <Field label={t('userRole')}>
            <select value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                    className="w-full rounded border px-3 py-2">
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </Field>
          <Field label={t('locale')}>
            <select value={form.locale}
                    onChange={(e) => setForm({ ...form, locale: e.target.value })}
                    className="w-full rounded border px-3 py-2">
              <option value="fr">Français</option>
              <option value="en">English</option>
              <option value="ar">العربية</option>
            </select>
          </Field>
        </div>

        {!isEdit && (
          <Field label={t('password')}>
            <input required type="text" value={form.password}
                   onChange={(e) => setForm({ ...form, password: e.target.value })}
                   placeholder={t('minChars')}
                   className="w-full rounded border px-3 py-2" />
            <p className="mt-1 text-xs text-gray-500">{t('passwordHint')}</p>
          </Field>
        )}

        {isEdit && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isActive}
                   onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
            {t('accountActive')}
          </label>
        )}

        {err && <p className="text-sm text-red-600 whitespace-pre-wrap">{err}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded border px-4 py-2 text-sm">
            {t('cancel')}
          </button>
          <button disabled={saving}
                  className="rounded bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700 disabled:opacity-50">
            {saving ? '…' : t('save')}
          </button>
        </div>
      </form>
    </div>
  );
}

// ============================================================
`;

src = src.slice(0, startIdx) + newUsersTab + src.slice(endIdx);
writeFileSync(pagePath, src, 'utf8');
console.log('  + UsersTab + UserModal rewritten');

// ============================================================
// Merge additional i18n keys
// ============================================================
const extra = {
  en: {
    newUser: 'New user', editUser: 'Edit user', edit: 'Edit', delete: 'Delete',
    you: 'you', password: 'Password', accountActive: 'Account is active',
    emailTaken: 'This email is already registered.',
    cannotDeleteSelf: 'You cannot delete your own account.',
    cannotDemoteSelf: 'You cannot demote yourself from Super Admin.',
    cannotDeactivateSelf: 'You cannot deactivate your own account.',
    lastSuperAdmin: 'Cannot remove or demote the last active Super Admin.',
    userDeleted: 'User deleted.',
    deactivatedNotDeleted: 'This user has linked records (guardian/staff/student) — account was deactivated instead of deleted.',
    confirmDeleteUser: 'Delete {name}? If they have linked records, they will be deactivated instead.',
  },
  fr: {
    newUser: 'Nouvel utilisateur', editUser: 'Modifier utilisateur', edit: 'Modifier', delete: 'Supprimer',
    you: 'vous', password: 'Mot de passe', accountActive: 'Compte actif',
    emailTaken: 'Cet email est deja utilise.',
    cannotDeleteSelf: 'Vous ne pouvez pas supprimer votre propre compte.',
    cannotDemoteSelf: 'Vous ne pouvez pas vous retirer le role Super Admin.',
    cannotDeactivateSelf: 'Vous ne pouvez pas desactiver votre propre compte.',
    lastSuperAdmin: 'Impossible de supprimer ou retrograder le dernier Super Admin actif.',
    userDeleted: 'Utilisateur supprime.',
    deactivatedNotDeleted: 'Cet utilisateur a des enregistrements lies (tuteur/personnel/eleve) — compte desactive au lieu d\'etre supprime.',
    confirmDeleteUser: 'Supprimer {name} ? S\'il a des enregistrements lies, il sera desactive.',
  },
  ar: {
    newUser: 'مستخدم جديد', editUser: 'تعديل المستخدم', edit: 'تعديل', delete: 'حذف',
    you: 'أنت', password: 'كلمة المرور', accountActive: 'الحساب نشط',
    emailTaken: 'هذا البريد مستخدم بالفعل.',
    cannotDeleteSelf: 'لا يمكنك حذف حسابك.',
    cannotDemoteSelf: 'لا يمكنك إزالة دور المدير العام عن نفسك.',
    cannotDeactivateSelf: 'لا يمكنك تعطيل حسابك.',
    lastSuperAdmin: 'لا يمكن حذف أو تخفيض آخر مدير عام نشط.',
    userDeleted: 'تم حذف المستخدم.',
    deactivatedNotDeleted: 'هذا المستخدم لديه سجلات مرتبطة — تم تعطيل الحساب بدلاً من حذفه.',
    confirmDeleteUser: 'حذف {name}؟ إذا كانت هناك سجلات مرتبطة، سيتم التعطيل.',
  },
};

for (const locale of ['en', 'fr', 'ar']) {
  const f = join(root, 'apps/web/messages/' + locale + '.json');
  let raw = readFileSync(f, 'utf8');
  if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
  const data = JSON.parse(raw);
  data.settings = { ...(data.settings || {}), ...extra[locale] };
  writeFileSync(f, JSON.stringify(data, null, 2), 'utf8');
  console.log('  ~ messages/' + locale + '.json');
}

console.log('\n✅ Users CRUD UI written');
'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { apiFetch } from '@/lib/api';

type Announcement = {
  id: string;
  title: string;
  body: string;
  audience: string;
  classId: string | null;
  publishedAt: string | null;
  createdAt: string;
};

type Class = { id: string; name: string };

export default function AnnouncementsPage() {
  const t = useTranslations('announcements');
  const [rows, setRows] = useState<Announcement[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [showNew, setShowNew] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [a, c] = await Promise.all([
        apiFetch('/api/v1/announcements').then((r) => (r.ok ? r.json() : [])),
        apiFetch('/api/v1/classes').then((r) => (r.ok ? r.json() : [])),
      ]);
      setRows(Array.isArray(a) ? a : []);
      setClasses(Array.isArray(c) ? c : []);
      setErr(null);
    } catch (e: any) { setErr(String(e)); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const remove = async (a: Announcement) => {
    if (!confirm(t('confirmDelete').replace('{title}', a.title))) return;
    try {
      const r = await apiFetch('/api/v1/announcements/' + a.id, { method: 'DELETE' });
      if (!r.ok) throw new Error(await r.text());
      load();
    } catch (e: any) { setErr(String(e)); }
  };

  const rebroadcast = async (a: Announcement) => {
    if (!confirm(t('confirmRebroadcast'))) return;
    setOk(null);
    try {
      const r = await apiFetch('/api/v1/announcements/' + a.id + '/rebroadcast', {
        method: 'POST',
        body: JSON.stringify({ channels: ['IN_APP'] }),
      });
      if (!r.ok) throw new Error(await r.text());
      const result = await r.json();
      setOk(t('broadcastSent').replace('{n}', String(result.sent)).replace('{total}', String(result.total)));
    } catch (e: any) { setErr(String(e)); }
  };

  const audienceLabel = (a: Announcement) => {
    if (a.audience === 'CLASS' && a.classId) {
      const c = classes.find((x) => x.id === a.classId);
      return 'CLASS — ' + (c?.name || '?');
    }
    return a.audience;
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <button
          onClick={() => setShowNew(true)}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700"
        >
          + {t('newAnnouncement')}
        </button>
      </div>

      {err && <p className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{err}</p>}
      {ok && <p className="mt-4 rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800">{ok}</p>}

      <div className="mt-6 space-y-3">
        {loading && <p className="text-gray-500">{t('loading')}</p>}
        {!loading && rows.length === 0 && !err && (
          <p className="rounded-lg border bg-white p-8 text-center text-gray-500">{t('noAnnouncements')}</p>
        )}
        {rows.map((a) => (
          <div key={a.id} className="rounded-lg border bg-white p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{a.title}</h3>
                  <span className={'rounded-full px-2 py-0.5 text-[10px] font-medium ' +
                    (a.publishedAt ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700')}>
                    {a.publishedAt ? t('published') : t('draft')}
                  </span>
                  <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-medium text-teal-800">
                    {audienceLabel(a)}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{a.body}</p>
                <p className="mt-2 text-xs text-gray-400">
                  {a.publishedAt
                    ? new Date(a.publishedAt).toLocaleString()
                    : 'Created ' + new Date(a.createdAt).toLocaleString()}
                </p>
              </div>
              <div className="flex flex-shrink-0 flex-col gap-1">
                {a.publishedAt && (
                  <button onClick={() => rebroadcast(a)}
                          className="rounded border border-brand-600 px-3 py-1 text-xs text-brand-700 hover:bg-teal-50">
                    {t('rebroadcast')}
                  </button>
                )}
                <button onClick={() => setEditing(a)}
                        className="rounded border border-gray-300 px-3 py-1 text-xs hover:bg-gray-50">
                  {t('edit')}
                </button>
                <button onClick={() => remove(a)}
                        className="rounded border border-red-300 px-3 py-1 text-xs text-red-700 hover:bg-red-50">
                  {t('delete')}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {(showNew || editing) && (
        <AnnouncementModal
          announcement={editing}
          classes={classes}
          onClose={() => { setShowNew(false); setEditing(null); }}
          onSaved={(msg) => {
            setShowNew(false); setEditing(null);
            if (msg) setOk(msg);
            load();
          }}
        />
      )}
    </div>
  );
}

function AnnouncementModal({
  announcement, classes, onClose, onSaved,
}: { announcement: Announcement | null; classes: Class[]; onClose: () => void; onSaved: (msg?: string) => void }) {
  const t = useTranslations('announcements');
  const isEdit = !!announcement;
  const [form, setForm] = useState({
    title: announcement?.title ?? '',
    body: announcement?.body ?? '',
    audience: announcement?.audience ?? 'ALL',
    classId: announcement?.classId ?? '',
    publish: announcement ? !!announcement.publishedAt : true,
    inApp: true,
    email: false,
    sms: false,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setErr(null);
    try {
      const channels: string[] = [];
      if (form.inApp) channels.push('IN_APP');
      if (form.email) channels.push('EMAIL');
      if (form.sms) channels.push('SMS');

      const payload: any = {
        title: form.title,
        body: form.body,
        audience: form.audience,
        publish: form.publish,
        channels,
      };
      if (form.audience === 'CLASS') payload.classId = form.classId || undefined;

      const url = isEdit ? '/api/v1/announcements/' + announcement!.id : '/api/v1/announcements';
      const method = isEdit ? 'PUT' : 'POST';
      const r = await apiFetch(url, { method, body: JSON.stringify(payload) });
      if (!r.ok) throw new Error(await r.text());

      const msg = form.publish
        ? (isEdit ? t('updatedAndPublished') : t('createdAndPublished'))
        : (isEdit ? t('updated') : t('savedAsDraft'));
      onSaved(msg);
    } catch (e: any) { setErr(String(e)); setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl space-y-4 rounded-xl bg-white p-6 shadow-xl"
      >
        <h3 className="text-lg font-semibold">{isEdit ? t('editTitle') : t('newTitle')}</h3>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-700">{t('announcementTitle')}</span>
          <input required value={form.title}
                 onChange={(e) => setForm({ ...form, title: e.target.value })}
                 placeholder={t('titlePlaceholder')}
                 className="w-full rounded border px-3 py-2" />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-700">{t('message')}</span>
          <textarea required rows={6} value={form.body}
                    onChange={(e) => setForm({ ...form, body: e.target.value })}
                    className="w-full rounded border px-3 py-2"
                    placeholder={t('bodyPlaceholder')} />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-700">{t('audience')}</span>
            <select value={form.audience}
                    onChange={(e) => setForm({ ...form, audience: e.target.value })}
                    className="w-full rounded border px-3 py-2">
              <option value="ALL">👥 {t('audAll')}</option>
              <option value="PARENTS">👨‍👩‍👧 {t('audParents')}</option>
              <option value="STAFF">👩‍🏫 {t('audStaff')}</option>
              <option value="STUDENTS">🎓 {t('audStudents')}</option>
              <option value="CLASS">🏫 {t('audClass')}</option>
            </select>
          </label>

          {form.audience === 'CLASS' && (
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-700">{t('selectClass')}</span>
              <select value={form.classId}
                      onChange={(e) => setForm({ ...form, classId: e.target.value })}
                      className="w-full rounded border px-3 py-2">
                <option value="">—</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
          )}
        </div>

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-600">{t('channels')}</div>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.inApp}
                     onChange={(e) => setForm({ ...form, inApp: e.target.checked })} />
              🔔 {t('chInApp')}
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.email}
                     onChange={(e) => setForm({ ...form, email: e.target.checked })} />
              📧 {t('chEmail')}
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.sms}
                     onChange={(e) => setForm({ ...form, sms: e.target.checked })} />
              💬 {t('chSms')}
            </label>
          </div>
          <p className="mt-2 text-xs text-gray-500">{t('channelsHint')}</p>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.publish}
                 onChange={(e) => setForm({ ...form, publish: e.target.checked })} />
          {t('publishNow')}
        </label>

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

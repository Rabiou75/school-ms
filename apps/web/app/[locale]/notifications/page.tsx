'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

const T = {
  title:      { en: 'Notifications', fr: 'Notifications', ar: 'الإشعارات' },
  subtitle:   { en: 'All your recent notifications', fr: 'Toutes vos notifications recentes', ar: 'جميع إشعاراتك' },
  all:        { en: 'All', fr: 'Toutes', ar: 'الكل' },
  unread:     { en: 'Unread', fr: 'Non lues', ar: 'غير مقروءة' },
  markAll:    { en: 'Mark all read', fr: 'Tout marquer lu', ar: 'تحديد الكل' },
  clearAll:   { en: 'Clear all', fr: 'Tout effacer', ar: 'حذف الكل' },
  empty:      { en: 'No notifications.', fr: 'Aucune notification.', ar: 'لا توجد إشعارات.' },
  back:       { en: 'Back to dashboard', fr: 'Retour au tableau', ar: 'رجوع' },
  confirmClear: { en: 'Delete all notifications?', fr: 'Effacer toutes les notifications ?', ar: 'حذف جميع الإشعارات؟' },
  loading:    { en: 'Loading…', fr: 'Chargement…', ar: 'جار التحميل…' },
} as const;

const ICON: Record<string, string> = {
  INVOICE_CREATED:   '🧾',
  PAYMENT_RECEIVED:  '💰',
  ATTENDANCE_ABSENT: '❌',
  ATTENDANCE_LATE:   '⏰',
  MARKS_PUBLISHED:   '📝',
  MANUAL:            '📢',
  TEST:              '🔔',
};

export default function NotificationsPage() {
  const router = useRouter();
  const { locale } = useParams() as { locale: string };
  const l: 'en' | 'fr' | 'ar' = locale === 'en' || locale === 'ar' ? locale : 'fr';

  const [items, setItems] = useState<Notification[]>([]);
  const [tab, setTab] = useState<'all' | 'unread'>('all');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const qs = tab === 'unread' ? '?unread=1' : '';
      const r = await apiFetch('/api/v1/notifications' + qs);
      const d = r.ok ? await r.json() : [];
      setItems(Array.isArray(d) ? d : []);
    } catch { setItems([]); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [tab]);

  const openNotification = async (n: Notification) => {
    if (!n.readAt) {
      await apiFetch('/api/v1/notifications/' + n.id + '/read', { method: 'POST' }).catch(() => {});
    }
    if (n.link) router.push(n.link);
    else load();
  };

  const markAllRead = async () => {
    await apiFetch('/api/v1/notifications/read-all', { method: 'POST' }).catch(() => {});
    load();
  };

  const clearAll = async () => {
    if (!confirm(T.confirmClear[l])) return;
    await apiFetch('/api/v1/notifications', { method: 'DELETE' }).catch(() => {});
    load();
  };

  const remove = async (id: string) => {
    await apiFetch('/api/v1/notifications/' + id, { method: 'DELETE' }).catch(() => {});
    setItems((prev) => prev.filter((x) => x.id !== id));
  };

  const unreadCount = items.filter((n) => !n.readAt).length;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{T.title[l]}</h1>
          <p className="mt-1 text-sm text-gray-500">{T.subtitle[l]}</p>
        </div>
        <button
          onClick={() => router.push('/' + locale + '/dashboard')}
          className="rounded border px-4 py-2 text-sm hover:bg-gray-50"
        >
          ← {T.back[l]}
        </button>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-b">
        <div className="flex gap-1">
          <button
            onClick={() => setTab('all')}
            className={
              'border-b-2 px-4 py-2 text-sm ' +
              (tab === 'all' ? 'border-brand-600 font-medium text-brand-700' : 'border-transparent text-gray-600 hover:text-gray-900')
            }
          >
            {T.all[l]}
          </button>
          <button
            onClick={() => setTab('unread')}
            className={
              'border-b-2 px-4 py-2 text-sm ' +
              (tab === 'unread' ? 'border-brand-600 font-medium text-brand-700' : 'border-transparent text-gray-600 hover:text-gray-900')
            }
          >
            {T.unread[l]} {tab === 'unread' && unreadCount > 0 ? '(' + unreadCount + ')' : ''}
          </button>
        </div>

        <div className="flex gap-2 pb-2">
          <button onClick={markAllRead} className="rounded border px-3 py-1.5 text-xs hover:bg-gray-50">
            {T.markAll[l]}
          </button>
          <button onClick={clearAll}
                  className="rounded border border-red-300 px-3 py-1.5 text-xs text-red-700 hover:bg-red-50">
            {T.clearAll[l]}
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {loading && <p className="text-gray-500">{T.loading[l]}</p>}
        {!loading && items.length === 0 && (
          <p className="rounded-lg border bg-white p-8 text-center text-gray-500">{T.empty[l]}</p>
        )}
        {items.map((n) => (
          <div
            key={n.id}
            className={
              'flex gap-3 rounded-lg border bg-white p-4 transition hover:border-brand-200 ' +
              (n.readAt ? '' : 'border-l-4 border-l-brand-600')
            }
          >
            <button
              onClick={() => openNotification(n)}
              className="min-w-0 flex-1 text-left"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="flex items-center gap-2 font-semibold">
                  <span className="text-base">{ICON[n.type] || '🔔'}</span>
                  {n.title}
                </span>
                <span className="flex-shrink-0 text-xs text-gray-400">
                  {new Date(n.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{n.body}</p>
              {n.link && (
                <span className="mt-2 inline-block text-xs text-brand-600">→</span>
              )}
            </button>
            <button
              onClick={() => remove(n.id)}
              className="flex-shrink-0 self-start text-gray-300 hover:text-red-600"
              aria-label="Delete"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

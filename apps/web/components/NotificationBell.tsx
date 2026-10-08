'use client';
import { useEffect, useRef, useState } from 'react';
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
  title:    { en: 'Notifications', fr: 'Notifications',  ar: 'الإشعارات' },
  empty:    { en: 'No notifications.', fr: 'Aucune notification.', ar: 'لا توجد إشعارات.' },
  markAll:  { en: 'Mark all as read', fr: 'Tout marquer lu', ar: 'تحديد الكل كمقروء' },
  viewAll:  { en: 'View all', fr: 'Tout voir', ar: 'عرض الكل' },
  justNow:  { en: 'just now', fr: 'a l\'instant', ar: 'الآن' },
  minAgo:   { en: 'm ago', fr: 'min', ar: 'د' },
  hourAgo:  { en: 'h ago', fr: 'h', ar: 'س' },
  dayAgo:   { en: 'd ago', fr: 'j', ar: 'ي' },
} as const;

function pickLocale(): 'en' | 'fr' | 'ar' {
  if (typeof window === 'undefined') return 'fr';
  const first = window.location.pathname.split('/').filter(Boolean)[0];
  return (['en', 'fr', 'ar'].includes(first) ? first : 'fr') as any;
}

function timeAgo(iso: string, l: 'en' | 'fr' | 'ar'): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return T.justNow[l];
  if (mins < 60) return mins + ' ' + T.minAgo[l];
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours + ' ' + T.hourAgo[l];
  const days = Math.floor(hours / 24);
  return days + ' ' + T.dayAgo[l];
}

const ICON: Record<string, string> = {
  INVOICE_CREATED:   '🧾',
  PAYMENT_RECEIVED:  '💰',
  ATTENDANCE_ABSENT: '❌',
  ATTENDANCE_LATE:   '⏰',
  MARKS_PUBLISHED:   '📝',
  MANUAL:            '📢',
  TEST:              '🔔',
};

export default function NotificationBell() {
  const router = useRouter();
  const { locale } = useParams() as { locale: string };
  const l = pickLocale();

  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = async () => {
    try {
      const [list, count] = await Promise.all([
        apiFetch('/api/v1/notifications?unread=0').then((r) => (r.ok ? r.json() : [])),
        apiFetch('/api/v1/notifications/unread-count').then((r) => (r.ok ? r.json() : { count: 0 })),
      ]);
      setItems(Array.isArray(list) ? list.slice(0, 10) : []);
      setUnread(count?.count ?? 0);
      setLoaded(true);
    } catch {
      setLoaded(true);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const openNotification = async (n: Notification) => {
    if (!n.readAt) {
      await apiFetch('/api/v1/notifications/' + n.id + '/read', { method: 'POST' }).catch(() => {});
      setUnread((u) => Math.max(0, u - 1));
    }
    setOpen(false);
    if (n.link) router.push(n.link);
  };

  const markAllRead = async () => {
    await apiFetch('/api/v1/notifications/read-all', { method: 'POST' }).catch(() => {});
    await load();
  };

  const viewAll = () => {
    setOpen(false);
    router.push('/' + locale + '/notifications');
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm hover:bg-gray-50"
        aria-label={T.title[l]}
      >
        <span className="text-base">🔔</span>
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-1 w-96 overflow-hidden rounded-lg border bg-white shadow-xl">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <span className="text-sm font-semibold">{T.title[l]}</span>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs text-brand-600 hover:underline">
                {T.markAll[l]}
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {!loaded && <div className="p-4 text-center text-sm text-gray-500">…</div>}
            {loaded && items.length === 0 && (
              <div className="p-6 text-center text-sm text-gray-500">{T.empty[l]}</div>
            )}
            {items.map((n) => (
              <button
                key={n.id}
                onClick={() => openNotification(n)}
                className={
                  'flex w-full gap-3 border-b px-4 py-3 text-left last:border-0 hover:bg-gray-50 ' +
                  (n.readAt ? '' : 'bg-teal-50/50')
                }
              >
                <span className="text-lg">{ICON[n.type] || '🔔'}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-medium">{n.title}</span>
                    {!n.readAt && <span className="h-2 w-2 flex-shrink-0 rounded-full bg-brand-600" />}
                  </span>
                  <span className="mt-0.5 line-clamp-2 text-xs text-gray-600">{n.body}</span>
                  <span className="mt-1 block text-[10px] text-gray-400">{timeAgo(n.createdAt, l)}</span>
                </span>
              </button>
            ))}
          </div>

          <button
            onClick={viewAll}
            className="block w-full border-t bg-gray-50 px-4 py-2 text-center text-xs font-medium text-brand-700 hover:bg-gray-100"
          >
            {T.viewAll[l]} →
          </button>
        </div>
      )}
    </div>
  );
}

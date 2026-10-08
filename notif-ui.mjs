import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

const root = process.cwd();
const put = (p, c) => {
  const full = join(root, p);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, c, 'utf8');
  console.log('  + ' + p);
};

// ============================================================
// 1. NotificationBell component
// ============================================================
put('apps/web/components/NotificationBell.tsx', `'use client';
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
  justNow:  { en: 'just now', fr: 'a l\\'instant', ar: 'الآن' },
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
`);

// ============================================================
// 2. Full notifications page
// ============================================================
put('apps/web/app/[locale]/notifications/page.tsx', `'use client';
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
`);

// ============================================================
// 3. Add bell to dashboard layout header
// ============================================================
const dashPath = join(root, 'apps/web/app/[locale]/dashboard/layout.tsx');
let dash = readFileSync(dashPath, 'utf8');

if (!dash.includes('NotificationBell')) {
  dash = dash.replace(
    "import UserMenu from '@/components/UserMenu';",
    "import UserMenu from '@/components/UserMenu';\nimport NotificationBell from '@/components/NotificationBell';"
  );
  dash = dash.replace(
    /(\s+)<LanguageSwitcher \/>\s+<UserMenu \/>/,
    '$1<NotificationBell />$1<LanguageSwitcher />$1<UserMenu />'
  );
  writeFileSync(dashPath, dash, 'utf8');
  console.log('  + dashboard/layout.tsx — NotificationBell added to header');
} else {
  console.log('  = dashboard layout already has the bell');
}

// ============================================================
// 4. Add bell to parent layout header
// ============================================================
const parentPath = join(root, 'apps/web/app/[locale]/parent/layout.tsx');
let parent = readFileSync(parentPath, 'utf8');

if (!parent.includes('NotificationBell')) {
  parent = parent.replace(
    "import UserMenu from '@/components/UserMenu';",
    "import UserMenu from '@/components/UserMenu';\nimport NotificationBell from '@/components/NotificationBell';"
  );
  parent = parent.replace(
    /(\s+)<LanguageSwitcher \/>\s+<UserMenu \/>/,
    '$1<NotificationBell />$1<LanguageSwitcher />$1<UserMenu />'
  );
  writeFileSync(parentPath, parent, 'utf8');
  console.log('  + parent/layout.tsx — NotificationBell added to header');
} else {
  console.log('  = parent layout already has the bell');
}

console.log('\n✅ Notifications UI written');
console.log('');
console.log('Files:');
console.log('  - apps/web/components/NotificationBell.tsx');
console.log('  - apps/web/app/[locale]/notifications/page.tsx');
console.log('  - dashboard + parent layouts updated');
console.log('');
console.log('No backend rebuild needed. Next.js hot-reloads.');
console.log('Try: http://localhost:3000/fr/dashboard — look top-right for the bell.');
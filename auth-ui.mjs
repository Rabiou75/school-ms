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
// 1) Update api.ts — add logout helper, getCurrentUser helper
// ============================================================
put('apps/web/lib/api.ts', `const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export type AuthUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  locale: string;
  schoolId?: string | null;
};

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('accessToken');
}

export function getUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('authUser');
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function setSession(token: string, user: AuthUser): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('accessToken', token);
  localStorage.setItem('authUser', JSON.stringify(user));
}

export function clearSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('accessToken');
  localStorage.removeItem('authUser');
}

function currentLocale(): string {
  if (typeof window === 'undefined') return 'fr';
  const first = window.location.pathname.split('/').filter(Boolean)[0];
  return ['en', 'fr', 'ar'].includes(first) ? first : 'fr';
}

export function logout(): void {
  clearSession();
  window.location.href = '/' + currentLocale() + '/login';
}

export async function apiFetch(path: string, init: RequestInit = {}) {
  const token = getToken();
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', 'Bearer ' + token);

  const res = await fetch(API_URL + path, { ...init, headers });

  if (res.status === 401 && typeof window !== 'undefined') {
    clearSession();
    window.location.href = '/' + currentLocale() + '/login';
  }
  return res;
}
`);

// ============================================================
// 2) UserMenu component — shows name + role + logout dropdown
// ============================================================
put('apps/web/components/UserMenu.tsx', `'use client';
import { useEffect, useState } from 'react';
import { getUser, logout, type AuthUser } from '@/lib/api';

const ROLE_LABEL: Record<string, { en: string; fr: string; ar: string }> = {
  SUPER_ADMIN: { en: 'Super Admin', fr: 'Super Admin', ar: 'مدير عام' },
  ADMIN:       { en: 'Admin',       fr: 'Admin',       ar: 'مدير' },
  PRINCIPAL:   { en: 'Principal',   fr: 'Directeur',   ar: 'المدير' },
  TEACHER:     { en: 'Teacher',     fr: 'Enseignant',  ar: 'معلم' },
  STUDENT:     { en: 'Student',     fr: 'Eleve',       ar: 'طالب' },
  PARENT:      { en: 'Parent',      fr: 'Parent',      ar: 'ولي' },
  ACCOUNTANT:  { en: 'Accountant',  fr: 'Comptable',   ar: 'محاسب' },
  LIBRARIAN:   { en: 'Librarian',   fr: 'Bibliothecaire', ar: 'أمين مكتبة' },
};

const T = {
  profile: { en: 'Profile', fr: 'Profil', ar: 'الملف الشخصي' },
  logout:  { en: 'Logout',  fr: 'Deconnexion', ar: 'خروج' },
  signIn:  { en: 'Sign in', fr: 'Connexion', ar: 'دخول' },
  loading: { en: 'Loading...', fr: 'Chargement...', ar: 'جار التحميل...' },
} as const;

function pickLocale(): 'en' | 'fr' | 'ar' {
  if (typeof window === 'undefined') return 'fr';
  const first = window.location.pathname.split('/').filter(Boolean)[0];
  return (['en', 'fr', 'ar'].includes(first) ? first : 'fr') as any;
}

export default function UserMenu() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const l = pickLocale();

  useEffect(() => {
    setUser(getUser());
    setMounted(true);
  }, []);

  if (!mounted) return <div className="h-8 w-32 animate-pulse rounded bg-gray-100" />;

  if (!user) {
    return (
      <a
        href={'/' + l + '/login'}
        className="rounded-lg bg-brand-600 px-4 py-1.5 text-sm text-white hover:bg-brand-700"
      >
        {T.signIn[l]}
      </a>
    );
  }

  const initials = (user.firstName?.[0] || '') + (user.lastName?.[0] || '');
  const fullName = user.firstName + ' ' + user.lastName;
  const roleText = ROLE_LABEL[user.role]?.[l] ?? user.role;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2 py-1 hover:bg-gray-50"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
          {initials.toUpperCase()}
        </span>
        <span className="hidden text-left sm:block">
          <span className="block text-xs font-medium leading-tight">{fullName}</span>
          <span className="block text-[10px] leading-tight text-gray-500">{roleText}</span>
        </span>
        <span className="text-xs text-gray-400">▾</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-64 overflow-hidden rounded-lg border bg-white shadow-lg">
            <div className="border-b bg-gray-50 px-4 py-3">
              <div className="text-sm font-medium">{fullName}</div>
              <div className="text-xs text-gray-500">{user.email}</div>
              <div className="mt-1 inline-block rounded bg-teal-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-teal-800">
                {roleText}
              </div>
            </div>
            <button
              disabled
              className="block w-full cursor-not-allowed px-4 py-2 text-left text-sm text-gray-400"
            >
              {T.profile[l]}
            </button>
            <button
              onClick={logout}
              className="block w-full border-t px-4 py-2 text-left text-sm text-red-700 hover:bg-red-50"
            >
              ⏻ {T.logout[l]}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
`);

// ============================================================
// 3) Dashboard layout — user menu + logout + nav
// ============================================================
put('apps/web/app/[locale]/dashboard/layout.tsx', `import Link from 'next/link';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import UserMenu from '@/components/UserMenu';

type NavKey = 'dashboard' | 'students' | 'staff' | 'classes' | 'subjects' | 'attendance' | 'exams' | 'finance';

const NAV: NavKey[] = ['dashboard', 'students', 'staff', 'classes', 'subjects', 'attendance', 'exams', 'finance'];

const LABELS: Record<NavKey, { en: string; fr: string; ar: string }> = {
  dashboard:  { en: 'Dashboard',  fr: 'Tableau de bord', ar: 'لوحة التحكم' },
  students:   { en: 'Students',   fr: 'Eleves',          ar: 'الطلاب' },
  staff:      { en: 'Staff',      fr: 'Personnel',       ar: 'الموظفون' },
  classes:    { en: 'Classes',    fr: 'Classes',         ar: 'الفصول' },
  subjects:   { en: 'Subjects',   fr: 'Matieres',        ar: 'المواد' },
  attendance: { en: 'Attendance', fr: 'Presence',        ar: 'الحضور' },
  exams:      { en: 'Exams',      fr: 'Examens',         ar: 'الامتحانات' },
  finance:    { en: 'Finance',    fr: 'Finances',        ar: 'المالية' },
};

const ICONS: Record<NavKey, string> = {
  dashboard: '📊', students: '🎓', staff: '👩‍🏫', classes: '🏫',
  subjects: '📚', attendance: '✅', exams: '📝', finance: '💰',
};

export default function DashboardLayout({
  children, params: { locale },
}: { children: React.ReactNode; params: { locale: string } }) {
  const l = (locale === 'en' || locale === 'ar') ? locale : 'fr';

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="w-64 border-r bg-white">
        <div className="flex h-16 items-center border-b px-4">
          <span className="text-lg font-bold text-brand-600">SMS</span>
          <span className="ml-2 text-xs text-gray-400">LBY</span>
        </div>
        <nav className="p-3 space-y-1">
          {NAV.map((k) => (
            <Link
              key={k}
              href={'/' + locale + '/dashboard' + (k === 'dashboard' ? '' : '/' + k)}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              <span className="text-base">{ICONS[k]}</span>
              <span>{LABELS[k][l]}</span>
            </Link>
          ))}
        </nav>
      </aside>

      <div className="flex-1">
        <header className="flex h-16 items-center justify-between border-b bg-white px-6">
          <div className="text-sm text-gray-500">
            {/* Breadcrumb could go here later */}
          </div>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <UserMenu />
          </div>
        </header>
        <main className="p-8">{children}</main>
      </div>
    </div>
  );
}
`);

// ============================================================
// 4) Login page — save session (token + user) on success
// ============================================================
put('apps/web/app/[locale]/login/page.tsx', `'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { setSession } from '@/lib/api';

export default function LoginPage({ params: { locale } }: { params: { locale: string } }) {
  const t = useTranslations('auth');
  const router = useRouter();
  const [email, setEmail] = useState('admin@demo-school.cm');
  const [password, setPassword] = useState('Admin@1234');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch('http://localhost:4000/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        setErr(locale === 'fr' ? 'Identifiants invalides' : locale === 'ar' ? 'بيانات غير صحيحة' : 'Invalid credentials');
        setLoading(false);
        return;
      }
      const data = await res.json();
      setSession(data.accessToken, data.user);
      router.push('/' + locale + '/dashboard');
    } catch (e: any) {
      setErr(String(e));
      setLoading(false);
    }
  }

  return (
    <main className="relative mx-auto max-w-md px-6 py-20">
      <div className="absolute right-6 top-6">
        <LanguageSwitcher />
      </div>
      <h1 className="text-2xl font-bold">{t('login')}</h1>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <input
          className="w-full rounded border px-3 py-2"
          placeholder={t('email')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
        <input
          className="w-full rounded border px-3 py-2"
          type="password"
          placeholder={t('password')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button
          disabled={loading}
          className="w-full rounded bg-brand-600 py-2 text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? '...' : t('signIn')}
        </button>
      </form>
    </main>
  );
}
`);

// ============================================================
// 5) Root page — redirect to login if not signed in
// ============================================================
put('apps/web/app/[locale]/page.tsx', `'use client';
import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getToken } from '@/lib/api';

export default function Home() {
  const { locale } = useParams() as { locale: string };
  const router = useRouter();

  useEffect(() => {
    const token = getToken();
    router.replace('/' + locale + (token ? '/dashboard' : '/login'));
  }, [locale, router]);

  return (
    <main className="flex min-h-screen items-center justify-center">
      <p className="text-gray-500">Redirecting…</p>
    </main>
  );
}
`);

console.log('\n✅ Auth UI written: UserMenu + logout + session handling');
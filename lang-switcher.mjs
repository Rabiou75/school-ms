import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

const root = process.cwd();
const put = (p, c) => {
  const full = join(root, p);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, c, 'utf8');
  console.log('  + ' + p);
};

// ---------- LanguageSwitcher component ----------
put('apps/web/components/LanguageSwitcher.tsx', `'use client';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const LOCALES = [
  { code: 'fr', label: 'FR', full: 'Français', flag: '🇫🇷' },
  { code: 'en', label: 'EN', full: 'English',  flag: '🇬🇧' },
  { code: 'ar', label: 'AR', full: 'العربية',  flag: '🇸🇦' },
] as const;

type LocaleCode = typeof LOCALES[number]['code'];

export default function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname() || '/fr/dashboard';
  const [open, setOpen] = useState(false);

  const segments = pathname.split('/').filter(Boolean);
  const current: LocaleCode = (segments[0] as LocaleCode) || 'fr';
  const rest = segments.slice(1).join('/');

  const switchTo = (code: LocaleCode) => {
    // Persist choice so next-intl middleware uses it next visit
    document.cookie = 'NEXT_LOCALE=' + code + '; path=/; max-age=31536000; SameSite=Lax';
    const target = '/' + code + (rest ? '/' + rest : '');
    window.location.href = target;
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
        aria-label="Change language"
      >
        <span className="text-base">🌐</span>
        <span className="font-medium uppercase">{current}</span>
        <span className="text-xs text-gray-400">▾</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-lg border bg-white shadow-lg">
            {LOCALES.map((l) => (
              <button
                key={l.code}
                onClick={() => switchTo(l.code)}
                className={
                  'flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-gray-50 ' +
                  (l.code === current ? 'bg-teal-50 text-teal-900 font-medium' : '')
                }
              >
                <span className="text-base">{l.flag}</span>
                <span>{l.full}</span>
                {l.code === current && <span className="ml-auto text-teal-600">✓</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
`);

// ---------- Patch dashboard layout to include switcher ----------
put('apps/web/app/[locale]/dashboard/layout.tsx', `import Link from 'next/link';
import { useTranslations } from 'next-intl';
import LanguageSwitcher from '@/components/LanguageSwitcher';

export default function DashboardLayout({
  children, params: { locale },
}: { children: React.ReactNode; params: { locale: string } }) {
  const t = useTranslations('nav');
  const items = ['dashboard','students','classes','attendance','exams','finance','settings'];
  const labels: Record<string, string> = {
    dashboard: locale === 'fr' ? 'Tableau de bord' : locale === 'ar' ? 'لوحة التحكم' : 'Dashboard',
    students: locale === 'fr' ? 'Eleves' : locale === 'ar' ? 'الطلاب' : 'Students',
    classes: locale === 'fr' ? 'Classes' : locale === 'ar' ? 'الفصول' : 'Classes',
    attendance: locale === 'fr' ? 'Presence' : locale === 'ar' ? 'الحضور' : 'Attendance',
    exams: locale === 'fr' ? 'Examens' : locale === 'ar' ? 'الامتحانات' : 'Exams',
    finance: locale === 'fr' ? 'Finances' : locale === 'ar' ? 'المالية' : 'Finance',
    settings: locale === 'fr' ? 'Parametres' : locale === 'ar' ? 'الإعدادات' : 'Settings',
  };
  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="w-64 border-r bg-white">
        <div className="flex h-16 items-center border-b px-4">
          <span className="text-lg font-bold text-brand-600">SMS</span>
        </div>
        <nav className="p-3 space-y-1">
          {items.map((k) => (
            <Link
              key={k}
              href={'/' + locale + '/dashboard' + (k === 'dashboard' ? '' : '/' + k)}
              className="block rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              {labels[k]}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="flex-1">
        <header className="flex h-16 items-center justify-between border-b bg-white px-6">
          <div />
          <LanguageSwitcher />
        </header>
        <main className="p-8">{children}</main>
      </div>
    </div>
  );
}
`);

// ---------- Patch login page to include switcher ----------
put('apps/web/app/[locale]/login/page.tsx', `'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import LanguageSwitcher from '@/components/LanguageSwitcher';

export default function LoginPage({ params: { locale } }: { params: { locale: string } }) {
  const t = useTranslations('auth');
  const router = useRouter();
  const [email, setEmail] = useState('admin@demo-school.cm');
  const [password, setPassword] = useState('Admin@1234');
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const res = await fetch('http://localhost:4000/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) { setErr('Invalid credentials'); return; }
    const data = await res.json();
    localStorage.setItem('accessToken', data.accessToken);
    router.push('/' + locale + '/dashboard');
  }

  return (
    <main className="relative mx-auto max-w-md px-6 py-20">
      <div className="absolute right-6 top-6">
        <LanguageSwitcher />
      </div>
      <h1 className="text-2xl font-bold">{t('login')}</h1>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <input className="w-full rounded border px-3 py-2" placeholder={t('email')}
          value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="w-full rounded border px-3 py-2" type="password"
          placeholder={t('password')} value={password}
          onChange={(e) => setPassword(e.target.value)} />
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button className="w-full rounded bg-brand-600 py-2 text-white hover:bg-brand-700">
          {t('signIn')}
        </button>
      </form>
    </main>
  );
}
`);

console.log('\n✅ Language switcher added to dashboard header and login page');
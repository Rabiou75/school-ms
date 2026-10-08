import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

const login = `'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { setSession } from '@/lib/api';

export default function LoginPage({ params: { locale } }: { params: { locale: string } }) {
  const t = useTranslations('auth');
  const router = useRouter();
  const [email, setEmail] = useState('parent@lby.cm');
  const [password, setPassword] = useState('Parent@1234');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function doLogin(emailIn: string, passwordIn: string) {
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch('http://localhost:4000/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailIn, password: passwordIn }),
      });
      if (!res.ok) {
        setErr(locale === 'fr' ? 'Identifiants invalides' : locale === 'ar' ? 'بيانات غير صحيحة' : 'Invalid credentials');
        setLoading(false);
        return;
      }
      const data = await res.json();
      setSession(data.accessToken, data.user);

      // Role-based redirect
      const target = data.user.role === 'PARENT' ? '/parent' : '/dashboard';
      router.push('/' + locale + target);
    } catch (e: any) {
      setErr(String(e));
      setLoading(false);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    doLogin(email, password);
  }

  return (
    <main className="relative mx-auto max-w-md px-6 py-20">
      <div className="absolute right-6 top-6">
        <LanguageSwitcher />
      </div>
      <h1 className="text-2xl font-bold">{t('login')}</h1>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <input className="w-full rounded border px-3 py-2" placeholder={t('email')}
          value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        <input className="w-full rounded border px-3 py-2" type="password"
          placeholder={t('password')} value={password}
          onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button disabled={loading}
          className="w-full rounded bg-brand-600 py-2 text-white hover:bg-brand-700 disabled:opacity-50">
          {loading ? '...' : t('signIn')}
        </button>
      </form>

      <div className="mt-8 rounded-lg border bg-gray-50 p-4">
        <div className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-500">
          Demo accounts — click to sign in
        </div>
        <div className="space-y-2">
          <button type="button" disabled={loading} onClick={() => doLogin('admin@demo-school.cm', 'Admin@1234')}
            className="flex w-full items-center justify-between rounded-lg border border-teal-200 bg-white px-3 py-2 text-left text-sm hover:bg-gray-50 disabled:opacity-50">
            <span>
              <span className="block font-medium">Admin</span>
              <span className="block font-mono text-[10px] text-gray-500">admin@demo-school.cm</span>
            </span>
            <span className="text-xs text-brand-600">→</span>
          </button>
          <button type="button" disabled={loading} onClick={() => doLogin('m.ngo@lby.cm', 'Teacher@1234')}
            className="flex w-full items-center justify-between rounded-lg border border-violet-200 bg-white px-3 py-2 text-left text-sm hover:bg-gray-50 disabled:opacity-50">
            <span>
              <span className="block font-medium">Teacher</span>
              <span className="block font-mono text-[10px] text-gray-500">m.ngo@lby.cm</span>
            </span>
            <span className="text-xs text-brand-600">→</span>
          </button>
          <button type="button" disabled={loading} onClick={() => doLogin('parent@lby.cm', 'Parent@1234')}
            className="flex w-full items-center justify-between rounded-lg border border-amber-200 bg-white px-3 py-2 text-left text-sm hover:bg-gray-50 disabled:opacity-50">
            <span>
              <span className="block font-medium">Parent</span>
              <span className="block font-mono text-[10px] text-gray-500">parent@lby.cm</span>
            </span>
            <span className="text-xs text-brand-600">→</span>
          </button>
        </div>
      </div>
    </main>
  );
}
`;

writeFileSync(join(root, 'apps/web/app/[locale]/login/page.tsx'), login, 'utf8');
console.log('✅ login page rewritten with role-based redirect + demo buttons');
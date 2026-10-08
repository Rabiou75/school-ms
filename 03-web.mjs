import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const root = process.cwd();
const files = {};
const put = (p, c) => { files[p] = c; };

put('apps/web/package.json', `{
  "name": "web",
  "version": "0.1.0",
  "scripts": {
    "dev": "next dev -p 3000",
    "build": "next build",
    "start": "next start -p 3000"
  },
  "dependencies": {
    "next": "14.2.15",
    "next-intl": "^3.20.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "@school/shared": "workspace:*"
  },
  "devDependencies": {
    "@types/node": "^22.7.5",
    "@types/react": "^18.3.11",
    "@types/react-dom": "^18.3.1",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.13",
    "typescript": "^5.6.3"
  }
}
`);

put('apps/web/next.config.mjs', `import createNextIntlPlugin from 'next-intl/plugin';
const withNextIntl = createNextIntlPlugin('./i18n.ts');

const nextConfig = {
  output: 'standalone',
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: (process.env.API_INTERNAL_URL || 'http://localhost:4000') + '/api/:path*',
      },
    ];
  },
};
export default withNextIntl(nextConfig);
`);

put('apps/web/i18n.ts', `import { getRequestConfig } from 'next-intl/server';
import { notFound } from 'next/navigation';

const locales = ['en', 'fr', 'ar'];

export default getRequestConfig(async ({ locale }) => {
  if (!locales.includes(locale)) notFound();
  return { messages: (await import('./messages/' + locale + '.json')).default };
});
`);

put('apps/web/middleware.ts', `import createMiddleware from 'next-intl/middleware';

export default createMiddleware({
  locales: ['en', 'fr', 'ar'],
  defaultLocale: 'fr',
  localePrefix: 'always',
});

export const config = { matcher: ['/((?!api|_next|.*\\\\..*).*)'] };
`);

put('apps/web/tsconfig.json', `{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "preserve",
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "noEmit": true,
    "allowJs": true,
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
`);

put('apps/web/next-env.d.ts', `/// <reference types="next" />
/// <reference types="next/image-types/global" />
`);

put('apps/web/tailwind.config.ts', `import type { Config } from 'tailwindcss';
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: { extend: { colors: { brand: { 500: '#0f766e', 600: '#0d6f6a', 700: '#0a5a56' } } } },
  plugins: [],
};
export default config;
`);

put('apps/web/postcss.config.js', `module.exports = { plugins: { tailwindcss: {}, autoprefixer: {} } };
`);

put('apps/web/app/globals.css', `@tailwind base;
@tailwind components;
@tailwind utilities;
`);

put('apps/web/messages/en.json', JSON.stringify({
  app: { name: "School Management", tagline: "Complete management system" },
  auth: { login: "Login", email: "Email", password: "Password", signIn: "Sign in" },
  nav: { dashboard: "Dashboard", students: "Students", staff: "Staff", classes: "Classes",
         attendance: "Attendance", exams: "Exams", finance: "Finance", settings: "Settings" }
}, null, 2));

put('apps/web/messages/fr.json', JSON.stringify({
  app: { name: "Gestion Scolaire", tagline: "Systeme complet de gestion" },
  auth: { login: "Connexion", email: "Email", password: "Mot de passe", signIn: "Se connecter" },
  nav: { dashboard: "Tableau de bord", students: "Eleves", staff: "Personnel", classes: "Classes",
         attendance: "Presence", exams: "Examens", finance: "Finances", settings: "Parametres" }
}, null, 2));

put('apps/web/messages/ar.json', JSON.stringify({
  app: { name: "إدارة المدرسة", tagline: "نظام إدارة متكامل" },
  auth: { login: "تسجيل الدخول", email: "البريد الإلكتروني", password: "كلمة المرور", signIn: "دخول" },
  nav: { dashboard: "لوحة التحكم", students: "الطلاب", staff: "الموظفون", classes: "الفصول",
         attendance: "الحضور", exams: "الامتحانات", finance: "المالية", settings: "الإعدادات" }
}, null, 2));

// TSX pages: build as arrays of lines to avoid template-literal pitfalls
put('apps/web/app/[locale]/layout.tsx', [
  "import { NextIntlClientProvider } from 'next-intl';",
  "import { getMessages } from 'next-intl/server';",
  "import '../globals.css';",
  "",
  "export default async function LocaleLayout({",
  "  children, params: { locale },",
  "}: { children: React.ReactNode; params: { locale: string } }) {",
  "  const messages = await getMessages();",
  "  const dir = locale === 'ar' ? 'rtl' : 'ltr';",
  "  return (",
  "    <html lang={locale} dir={dir}>",
  "      <body className=\"min-h-screen bg-gray-50 text-gray-900 antialiased\">",
  "        <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>",
  "      </body>",
  "    </html>",
  "  );",
  "}",
  ""
].join('\n'));

put('apps/web/app/[locale]/page.tsx', [
  "import { useTranslations } from 'next-intl';",
  "import Link from 'next/link';",
  "",
  "export default function Home({ params: { locale } }: { params: { locale: string } }) {",
  "  const t = useTranslations('app');",
  "  const ta = useTranslations('auth');",
  "  return (",
  "    <main className=\"mx-auto max-w-3xl px-6 py-20\">",
  "      <h1 className=\"text-4xl font-bold text-brand-600\">{t('name')}</h1>",
  "      <p className=\"mt-4 text-lg text-gray-700\">{t('tagline')}</p>",
  "      <Link href={'/' + locale + '/login'} className=\"mt-8 inline-block rounded-lg bg-brand-600 px-6 py-3 text-white hover:bg-brand-700\">",
  "        {ta('signIn')}",
  "      </Link>",
  "    </main>",
  "  );",
  "}",
  ""
].join('\n'));

put('apps/web/app/[locale]/login/page.tsx', [
  "'use client';",
  "import { useState } from 'react';",
  "import { useTranslations } from 'next-intl';",
  "import { useRouter } from 'next/navigation';",
  "",
  "export default function LoginPage({ params: { locale } }: { params: { locale: string } }) {",
  "  const t = useTranslations('auth');",
  "  const router = useRouter();",
  "  const [email, setEmail] = useState('admin@demo-school.cm');",
  "  const [password, setPassword] = useState('Admin@1234');",
  "  const [err, setErr] = useState<string | null>(null);",
  "",
  "  async function submit(e: React.FormEvent) {",
  "    e.preventDefault();",
  "    setErr(null);",
  "    const res = await fetch('/api/v1/auth/login', {",
  "      method: 'POST',",
  "      headers: { 'Content-Type': 'application/json' },",
  "      body: JSON.stringify({ email, password }),",
  "    });",
  "    if (!res.ok) { setErr('Invalid credentials'); return; }",
  "    const data = await res.json();",
  "    localStorage.setItem('accessToken', data.accessToken);",
  "    router.push('/' + locale + '/dashboard');",
  "  }",
  "",
  "  return (",
  "    <main className=\"mx-auto max-w-md px-6 py-20\">",
  "      <h1 className=\"text-2xl font-bold\">{t('login')}</h1>",
  "      <form onSubmit={submit} className=\"mt-6 space-y-4\">",
  "        <input className=\"w-full rounded border px-3 py-2\" placeholder={t('email')}",
  "          value={email} onChange={(e) => setEmail(e.target.value)} />",
  "        <input className=\"w-full rounded border px-3 py-2\" type=\"password\"",
  "          placeholder={t('password')} value={password}",
  "          onChange={(e) => setPassword(e.target.value)} />",
  "        {err && <p className=\"text-sm text-red-600\">{err}</p>}",
  "        <button className=\"w-full rounded bg-brand-600 py-2 text-white hover:bg-brand-700\">",
  "          {t('signIn')}",
  "        </button>",
  "      </form>",
  "    </main>",
  "  );",
  "}",
  ""
].join('\n'));

let n = 0;
for (const [rel, content] of Object.entries(files)) {
  const full = join(root, rel);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content, 'utf8');
  n++;
  console.log('  + ' + rel);
}
console.log('\n✅ Web: wrote ' + n + ' files');
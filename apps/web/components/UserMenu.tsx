'use client';
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

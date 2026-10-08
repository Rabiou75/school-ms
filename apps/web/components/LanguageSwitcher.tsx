'use client';
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

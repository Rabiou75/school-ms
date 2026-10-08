import Link from 'next/link';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import UserMenu from '@/components/UserMenu';
import NotificationBell from '@/components/NotificationBell';
import SchoolLogo from '@/components/SchoolLogo';

export default function ParentLayout({
  children, params: { locale },
}: { children: React.ReactNode; params: { locale: string } }) {
  const l = (locale === 'en' || locale === 'ar') ? locale : 'fr';
  const nav = [
    { key: '',                icon: '🏠', label: { en: 'Home',           fr: 'Accueil',     ar: 'الرئيسية' } },
    { key: '/announcements',  icon: '📢', label: { en: 'Announcements',  fr: 'Annonces',    ar: 'الإعلانات' } },
  ];

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="w-64 border-r bg-white">
        <div className="flex h-16 items-center border-b px-4">
          <SchoolLogo />
        </div>
        <nav className="p-3 space-y-1">
          {nav.map((n) => (
            <Link
              key={n.key}
              href={'/' + locale + '/parent' + n.key}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              <span className="text-base">{n.icon}</span>
              <span>{n.label[l]}</span>
            </Link>
          ))}
        </nav>
      </aside>
      <div className="flex-1">
        <header className="flex h-16 items-center justify-between border-b bg-white px-6">
          <div />
          <div className="flex items-center gap-3">
            <NotificationBell />
            <LanguageSwitcher />
            <UserMenu />
          </div>
        </header>
        <main className="p-8">{children}</main>
      </div>
    </div>
  );
}

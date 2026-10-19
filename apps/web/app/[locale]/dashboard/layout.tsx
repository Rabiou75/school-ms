'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import UserMenu from '@/components/UserMenu';
import NotificationBell from '@/components/NotificationBell';
import SchoolLogo from '@/components/SchoolLogo';
import { getUser, type AuthUser } from '@/lib/api';

type NavKey =
  | 'dashboard' | 'students' | 'parents' | 'staff' | 'classes'
  | 'subjects' | 'timetable' | 'attendance' | 'exams' | 'finance'
  | 'library' | 'payroll' | 'import' | 'announcements'
  | 'settings' | 'help' | 'about';

const ALL_KEYS: NavKey[] = [
  'dashboard', 'students', 'parents', 'staff', 'classes', 'subjects',
  'timetable', 'attendance', 'exams', 'finance',
  'library', 'payroll', 'import', 'announcements',
  'settings', 'help', 'about',
];

// Role → allowed menu items
const ROLE_MENU: Record<string, NavKey[]> = {
  SUPER_ADMIN: ALL_KEYS,
  ADMIN: ALL_KEYS,
  PRINCIPAL: [
    'dashboard', 'students', 'parents', 'staff', 'classes', 'subjects',
    'timetable', 'attendance', 'exams', 'finance', 'library', 'announcements',
    'help', 'about',
  ],
  TEACHER: [
    'dashboard', 'students', 'classes', 'subjects', 'timetable',
    'attendance', 'exams', 'library', 'announcements', 'help', 'about',
  ],
  ACCOUNTANT: [
    'dashboard', 'students', 'parents', 'finance', 'payroll', 'import',
    'announcements', 'help', 'about',
  ],
  LIBRARIAN: [
    'dashboard', 'students', 'library', 'announcements', 'help', 'about',
  ],
  NURSE: ['dashboard', 'students', 'announcements', 'help', 'about'],
  TRANSPORT_MANAGER: ['dashboard', 'students', 'announcements', 'help', 'about'],
  HOSTEL_MANAGER: ['dashboard', 'students', 'announcements', 'help', 'about'],
};

const LABELS: Record<NavKey, { en: string; fr: string; ar: string }> = {
  dashboard:     { en: 'Dashboard',     fr: 'Tableau de bord', ar: 'لوحة التحكم' },
  students:      { en: 'Students',      fr: 'Eleves',          ar: 'الطلاب' },
  parents:       { en: 'Parents',       fr: 'Parents',         ar: 'أولياء الأمور' },
  staff:         { en: 'Staff',         fr: 'Personnel',       ar: 'الموظفون' },
  classes:       { en: 'Classes',       fr: 'Classes',         ar: 'الفصول' },
  subjects:      { en: 'Subjects',      fr: 'Matieres',        ar: 'المواد' },
  timetable:     { en: 'Timetable',     fr: 'Emploi du temps', ar: 'الجدول' },
  attendance:    { en: 'Attendance',    fr: 'Presence',        ar: 'الحضور' },
  exams:         { en: 'Exams',         fr: 'Examens',         ar: 'الامتحانات' },
  finance:       { en: 'Finance',       fr: 'Finances',        ar: 'المالية' },
  library:       { en: 'Library',       fr: 'Bibliotheque',    ar: 'المكتبة' },
  payroll:       { en: 'Payroll',       fr: 'Paie',            ar: 'الرواتب' },
  import:        { en: 'Bulk Import',   fr: 'Import en masse', ar: 'الاستيراد' },
  announcements: { en: 'Announcements', fr: 'Annonces',        ar: 'الإعلانات' },
  settings:      { en: 'Settings',      fr: 'Parametres',      ar: 'الإعدادات' },
  help:          { en: 'Help',          fr: 'Aide',            ar: 'المساعدة' },
  about:         { en: 'About',         fr: 'A propos',        ar: 'حول' },
};

const ICONS: Record<NavKey, string> = {
  dashboard: '📊', students: '🎓', parents: '👨‍👩‍👧', staff: '👩‍🏫',
  classes: '🏫', subjects: '📚', timetable: '📅', attendance: '✅',
  exams: '📝', finance: '💰', library: '📖', payroll: '💵',
  import: '📥', announcements: '📢', settings: '⚙️',
  help: '❓', about: 'ℹ️',
};

// Section breaks — inserted only if the following item is visible
const SECTION_BREAKS: NavKey[] = ['attendance', 'library', 'settings', 'help'];

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin', ADMIN: 'Administrateur', PRINCIPAL: 'Directeur',
  TEACHER: 'Enseignant', ACCOUNTANT: 'Comptable', LIBRARIAN: 'Bibliothecaire',
  NURSE: 'Infirmier', TRANSPORT_MANAGER: 'Transport', HOSTEL_MANAGER: 'Internat',
  STUDENT: 'Eleve', PARENT: 'Parent',
};

export default function DashboardLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  const l = locale === 'en' || locale === 'ar' ? locale : 'fr';
  const [user, setUser] = useState<AuthUser | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setUser(getUser());
    setMounted(true);

    // Listen for logout or user changes in other tabs
    const onStorage = () => setUser(getUser());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // While loading, show an empty sidebar (avoids flicker)
  const role = user?.role || '';
  const allowed: NavKey[] = mounted
    ? (ROLE_MENU[role] || ROLE_MENU.TEACHER)
    : [];

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="w-64 overflow-y-auto border-r bg-white">
        <div className="flex h-16 items-center border-b px-4">
          <SchoolLogo />
        </div>

        <nav className="p-3 space-y-1">
          {allowed.map((k) => {
            const showBreak =
              SECTION_BREAKS.includes(k) && allowed.indexOf(k) > 0;
            return (
              <div key={k}>
                {showBreak && <div className="my-2 border-t border-gray-100" />}
                <Link
                  href={'/' + locale + '/dashboard' + (k === 'dashboard' ? '' : '/' + k)}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <span className="text-base">{ICONS[k]}</span>
                  <span>{LABELS[k][l]}</span>
                </Link>
              </div>
            );
          })}
        </nav>

        <div className="border-t p-3 text-center text-[10px] text-gray-400">
          {mounted && user ? (
            <>
              <div className="font-medium text-gray-500">{ROLE_LABEL[role] || role}</div>
              <div className="mt-1">v1.1.0</div>
            </>
          ) : (
            <span>v1.1.0</span>
          )}
        </div>
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

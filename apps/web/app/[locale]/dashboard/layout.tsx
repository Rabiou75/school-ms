import Link from 'next/link';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import UserMenu from '@/components/UserMenu';
import NotificationBell from '@/components/NotificationBell';
import SchoolLogo from '@/components/SchoolLogo';

type NavKey =
  | 'dashboard' | 'students' | 'parents' | 'staff' | 'classes'
  | 'subjects' | 'attendance' | 'exams' | 'finance' | 'timetable'
  | 'library' | 'payroll' | 'import' | 'announcements' | 'settings';

const NAV: NavKey[] = [
  'dashboard',
  'students',
  'parents',
  'staff',
  'classes',
  'subjects',
  'timetable',
  'attendance',
  'exams',
  'finance',
  'library',
  'payroll',
  'import',
  'announcements',
  'settings',
];

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
};

const ICONS: Record<NavKey, string> = {
  dashboard: '📊', students: '🎓', parents: '👨‍👩‍👧', staff: '👩‍🏫',
  classes: '🏫', subjects: '📚', timetable: '📅', attendance: '✅',
  exams: '📝', finance: '💰', library: '📖', payroll: '💵',
  import: '📥', announcements: '📢', settings: '⚙️',
};

export default function DashboardLayout({
  children, params: { locale },
}: { children: React.ReactNode; params: { locale: string } }) {
  const l = locale === 'en' || locale === 'ar' ? locale : 'fr';

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="w-64 overflow-y-auto border-r bg-white">
        <div className="flex h-16 items-center border-b px-4">
          <SchoolLogo />
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

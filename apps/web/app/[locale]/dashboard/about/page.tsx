'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';

type Lang = 'en' | 'fr' | 'ar';

const T: Record<string, Record<Lang, string>> = {
  title:        { en: 'About', fr: 'A propos', ar: 'حول التطبيق' },
  subtitle:     { en: 'Application information and system status.', fr: 'Informations sur l\'application et etat du systeme.', ar: 'معلومات التطبيق وحالة النظام.' },
  version:      { en: 'Version', fr: 'Version', ar: 'الإصدار' },
  buildDate:    { en: 'Build date', fr: 'Date de compilation', ar: 'تاريخ البناء' },
  license:      { en: 'License', fr: 'Licence', ar: 'الترخيص' },
  platform:     { en: 'Platform', fr: 'Plateforme', ar: 'المنصة' },
  nodeVersion:  { en: 'Node.js version', fr: 'Version de Node.js', ar: 'إصدار Node.js' },
  uptime:       { en: 'Server uptime', fr: 'Duree de fonctionnement', ar: 'مدة التشغيل' },
  databaseSize: { en: 'Database size', fr: 'Taille de la base', ar: 'حجم قاعدة البيانات' },
  dataOverview: { en: 'Data overview', fr: 'Apercu des donnees', ar: 'نظرة على البيانات' },
  students:     { en: 'Students', fr: 'Eleves', ar: 'الطلاب' },
  users:        { en: 'Users', fr: 'Utilisateurs', ar: 'المستخدمون' },
  staff:        { en: 'Staff', fr: 'Personnel', ar: 'الموظفون' },
  guardians:    { en: 'Parents', fr: 'Parents', ar: 'أولياء الأمور' },
  classes:      { en: 'Classes', fr: 'Classes', ar: 'الفصول' },
  subjects:     { en: 'Subjects', fr: 'Matieres', ar: 'المواد' },
  invoices:     { en: 'Invoices', fr: 'Factures', ar: 'الفواتير' },
  payments:     { en: 'Payments', fr: 'Paiements', ar: 'المدفوعات' },
  attendance:   { en: 'Attendance records', fr: 'Enregistrements de presence', ar: 'سجلات الحضور' },
  marks:        { en: 'Marks entered', fr: 'Notes saisies', ar: 'العلامات المدخلة' },
  announcements:{ en: 'Announcements', fr: 'Annonces', ar: 'الإعلانات' },
  credits:      { en: 'Built with', fr: 'Construit avec', ar: 'بُني باستخدام' },
  docLinks:     { en: 'Documentation', fr: 'Documentation', ar: 'التوثيق' },
  github:       { en: 'GitHub repository', fr: 'Depot GitHub', ar: 'مستودع GitHub' },
  help:         { en: 'Help page', fr: 'Page d\'aide', ar: 'صفحة المساعدة' },
  loading:      { en: 'Loading...', fr: 'Chargement...', ar: 'جار التحميل...' },
  error:        { en: 'Failed to load system info', fr: 'Echec du chargement', ar: 'فشل التحميل' },
};

const TECH = [
  'Next.js 14', 'React 18', 'Tailwind CSS',
  'NestJS 10', 'Prisma ORM', 'PostgreSQL 18',
  'TypeScript', 'PDFKit', 'next-intl', 'Electron',
];

function formatUptime(sec: number): string {
  if (sec < 60) return sec + 's';
  const m = Math.floor(sec / 60);
  if (m < 60) return m + 'm';
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h < 24) return h + 'h ' + mm + 'm';
  const d = Math.floor(h / 24);
  return d + 'd ' + (h % 24) + 'h';
}

export default function AboutPage() {
  const params = useParams() as { locale?: string };
  const locale = params?.locale || 'fr';
  const l: Lang = locale === 'en' || locale === 'ar' ? locale : 'fr';
  const [info, setInfo] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    apiFetch('/api/v1/system/about')
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setInfo)
      .catch((e) => setErr(String(e)));
  }, []);

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold">{T.title[l]}</h1>
      <p className="mt-1 text-sm text-gray-500">{T.subtitle[l]}</p>

      {err && (
        <p className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {T.error[l]}: {err}
        </p>
      )}

      {!info && !err && <p className="mt-8 text-gray-500">{T.loading[l]}</p>}

      {info && (
        <>
          <section className="mt-8 rounded-xl border bg-white p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-brand-600 text-2xl font-bold text-white">
                SMS
              </div>
              <div>
                <div className="text-xl font-bold">{info.name}</div>
                <div className="text-sm text-gray-500">School Management System</div>
              </div>
            </div>

            <dl className="mt-6 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
              <KV label={T.version[l]} value={info.version} />
              <KV label={T.buildDate[l]} value={info.buildDate} />
              <KV label={T.license[l]} value={info.license} />
              <KV label={T.platform[l]} value={info.platform} />
              <KV label={T.nodeVersion[l]} value={info.nodeVersion} />
              <KV label={T.uptime[l]} value={formatUptime(info.uptimeSeconds || 0)} />
              <KV label={T.databaseSize[l]} value={info.databaseSize} />
            </dl>
          </section>

          <section className="mt-8">
            <h2 className="text-lg font-semibold">{T.dataOverview[l]}</h2>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <Stat label={T.students[l]} value={info.counts.students} />
              <Stat label={T.users[l]} value={info.counts.users} />
              <Stat label={T.staff[l]} value={info.counts.staff} />
              <Stat label={T.guardians[l]} value={info.counts.guardians} />
              <Stat label={T.classes[l]} value={info.counts.classes} />
              <Stat label={T.subjects[l]} value={info.counts.subjects} />
              <Stat label={T.invoices[l]} value={info.counts.invoices} />
              <Stat label={T.payments[l]} value={info.counts.payments} />
              <Stat label={T.attendance[l]} value={info.counts.attendance} />
              <Stat label={T.marks[l]} value={info.counts.marks} />
              <Stat label={T.announcements[l]} value={info.counts.announcements} />
            </div>
          </section>

          <section className="mt-8 rounded-xl border bg-white p-6">
            <h2 className="text-lg font-semibold">{T.credits[l]}</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {TECH.map((t) => (
                <span key={t} className="rounded-full border bg-gray-50 px-3 py-1 text-xs text-gray-700">{t}</span>
              ))}
            </div>
          </section>

          <section className="mt-8 rounded-xl border bg-white p-6">
            <h2 className="text-lg font-semibold">{T.docLinks[l]}</h2>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <a href={'/' + locale + '/dashboard/help'} className="text-brand-600 hover:underline">
                  {T.help[l]}
                </a>
              </li>
              <li>
                <a href="https://github.com/Rabiou75/school-ms" target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">
                  {T.github[l]}
                </a>
              </li>
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

function KV({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="mt-1 font-medium">{value || '—'}</dd>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-xl font-bold">{value}</div>
    </div>
  );
}

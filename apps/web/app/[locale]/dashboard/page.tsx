'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { formatXAF } from '@/lib/format';

type Stats = {
  students: number;
  staff: number;
  classes: number;
  subjects: number;
  finance: {
    totalBilled: number;
    totalCollected: number;
    totalOutstanding: number;
    invoiceCount: number;
  };
  attendance: {
    date: string;
    present: number;
    absent: number;
    late: number;
    excused: number;
    rate: number;
  };
  upcomingExams: number;
  announcements: number;
};

export default function DashboardPage() {
  const t = useTranslations('dashboard');
  const { locale } = useParams() as { locale: string };
  const [stats, setStats] = useState<Stats | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    apiFetch('/api/v1/dashboard/stats')
      .then(async (r) => {
        if (!r.ok) throw new Error(r.status + ' ' + r.statusText);
        return r.json();
      })
      .then(setStats)
      .catch((e) => setErr(String(e)));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold">{t('title')}</h1>

      {err && (
        <p className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          Erreur : {err} —{' '}
          <a href={'/' + locale + '/login'} className="underline">reconnectez-vous</a>
        </p>
      )}

      {!stats && !err && <p className="mt-8 text-gray-500">{t('loading')}</p>}

      {stats && (
        <>
          <h2 className="mt-6 text-lg font-semibold">Etablissement</h2>
          <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <BigCard label={t('students')} value={stats.students} icon="🎓" tone="brand" href={'/' + locale + '/dashboard/students'} />
            <BigCard label={t('staff')} value={stats.staff} icon="👩‍🏫" tone="violet" href={'/' + locale + '/dashboard/staff'} />
            <BigCard label={t('classes')} value={stats.classes} icon="🏫" tone="sky" href={'/' + locale + '/dashboard/classes'} />
            <BigCard label={t('subjects')} value={stats.subjects} icon="📚" tone="amber" href={'/' + locale + '/dashboard/subjects'} />
          </div>

          <h2 className="mt-10 text-lg font-semibold">{t('finance')}</h2>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <BigCard label={t('billed')} value={formatXAF(stats.finance.totalBilled)} icon="🧾" tone="brand" href={'/' + locale + '/dashboard/finance'} />
            <BigCard label={t('collected')} value={formatXAF(stats.finance.totalCollected)} icon="💰" tone="green" href={'/' + locale + '/dashboard/finance'} />
            <BigCard label={t('outstanding')} value={formatXAF(stats.finance.totalOutstanding)} icon="⏳" tone="red" href={'/' + locale + '/dashboard/finance'} />
          </div>

          <h2 className="mt-10 text-lg font-semibold">{t('attendanceToday')}</h2>
          <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <BigCard label={t('present')} value={stats.attendance.present} icon="✅" tone="green" href={'/' + locale + '/dashboard/attendance'} />
            <BigCard label={t('absent')} value={stats.attendance.absent} icon="❌" tone="red" href={'/' + locale + '/dashboard/attendance'} />
            <BigCard label={t('late')} value={stats.attendance.late} icon="⏰" tone="amber" href={'/' + locale + '/dashboard/attendance'} />
            <BigCard label={t('rate')} value={stats.attendance.rate + '%'} icon="📊" tone="sky" href={'/' + locale + '/dashboard/attendance'} />
          </div>

          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <BigCard label={t('upcomingExams')} value={stats.upcomingExams} icon="📝" tone="violet" href={'/' + locale + '/dashboard/exams'} />
            <BigCard label={t('announcements')} value={stats.announcements} icon="📢" tone="amber" href={'/' + locale + '/dashboard/announcements'} />
          </div>
        </>
      )}
    </div>
  );
}

function BigCard({
  label, value, icon, tone, href,
}: { label: string; value: number | string; icon: string; tone: 'brand'|'green'|'red'|'amber'|'sky'|'violet'; href?: string }) {
  const colors: Record<string, string> = {
    brand: 'border-teal-200 bg-teal-50 text-teal-900',
    green: 'border-green-200 bg-green-50 text-green-900',
    red: 'border-red-200 bg-red-50 text-red-900',
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    sky: 'border-sky-200 bg-sky-50 text-sky-900',
    violet: 'border-violet-200 bg-violet-50 text-violet-900',
  };
  const inner = (
    <div className={'rounded-xl border p-5 transition ' + colors[tone] + (href ? ' hover:shadow-md' : '')}>
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wide opacity-70">{label}</div>
        <div className="text-xl">{icon}</div>
      </div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

const root = process.cwd();
const put = (p, c) => {
  const full = join(root, p);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, c, 'utf8');
  console.log('  + ' + p);
};

// ---------- Dashboard service ----------
put('apps/api/src/dashboard/dashboard.service.ts', `import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async stats(schoolId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      students,
      staff,
      classes,
      subjects,
      billed,
      collected,
      outstanding,
      invoices,
      todayAttendance,
      upcomingExams,
      announcements,
    ] = await Promise.all([
      this.prisma.student.count({ where: { schoolId, isActive: true } }),
      this.prisma.staff.count({ where: { schoolId, isActive: true } }),
      this.prisma.class.count({ where: { schoolId } }),
      this.prisma.subject.count({ where: { schoolId } }),
      this.prisma.invoice.aggregate({ where: { schoolId }, _sum: { total: true } }),
      this.prisma.payment.aggregate({ where: { schoolId }, _sum: { amount: true } }),
      this.prisma.invoice.aggregate({
        where: { schoolId, status: { not: 'PAID' } },
        _sum: { balance: true },
      }),
      this.prisma.invoice.count({ where: { schoolId } }),
      this.prisma.attendance.groupBy({
        by: ['status'],
        where: {
          date: { gte: today, lt: tomorrow },
          student: { schoolId },
        },
        _count: { _all: true },
      }),
      this.prisma.exam.count({
        where: { schoolId, startDate: { gte: today } },
      }),
      this.prisma.announcement.count({
        where: { schoolId, publishedAt: { not: null } },
      }),
    ]);

    const attMap: Record<string, number> = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 };
    for (const r of todayAttendance) attMap[r.status] = r._count._all;
    const attTotal = Object.values(attMap).reduce((s, n) => s + n, 0);
    const attRate = attTotal > 0 ? Math.round(((attMap.PRESENT + attMap.LATE) / attTotal) * 100) : 0;

    return {
      currency: 'XAF',
      students,
      staff,
      classes,
      subjects,
      finance: {
        totalBilled: billed._sum.total ?? 0,
        totalCollected: collected._sum.amount ?? 0,
        totalOutstanding: outstanding._sum.balance ?? 0,
        invoiceCount: invoices,
      },
      attendance: {
        date: today.toISOString().slice(0, 10),
        present: attMap.PRESENT,
        absent: attMap.ABSENT,
        late: attMap.LATE,
        excused: attMap.EXCUSED,
        rate: attRate,
      },
      upcomingExams,
      announcements,
    };
  }
}
`);

put('apps/api/src/dashboard/dashboard.controller.ts', `import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private svc: DashboardService) {}

  @Get('stats')
  stats(@Req() req: any) {
    return this.svc.stats(req.user.schoolId);
  }
}
`);

put('apps/api/src/dashboard/dashboard.module.ts', `import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';

@Module({
  providers: [DashboardService],
  controllers: [DashboardController],
})
export class DashboardModule {}
`);

put('apps/api/src/app.module.ts', `import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { StudentsModule } from './students/students.module';
import { FinanceModule } from './finance/finance.module';
import { AttendanceModule } from './attendance/attendance.module';
import { ClassesModule } from './classes/classes.module';
import { ExamsModule } from './exams/exams.module';
import { DashboardModule } from './dashboard/dashboard.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
    PrismaModule,
    AuthModule,
    StudentsModule,
    FinanceModule,
    AttendanceModule,
    ClassesModule,
    ExamsModule,
    DashboardModule,
  ],
})
export class AppModule {}
`);

// ---------- Dashboard page ----------
put('apps/web/app/[locale]/dashboard/page.tsx', `'use client';
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
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setStats)
      .catch((e) => setErr(String(e)));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      {err && (
        <p className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          Erreur : {err} — <a href={'/' + locale + '/login'} className="underline">reconnectez-vous</a>
        </p>
      )}

      {!stats && !err && <p className="mt-8 text-gray-500">{t('loading')}</p>}

      {stats && (
        <>
          {/* People */}
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <BigCard label={t('students')} value={stats.students} icon="🎓" tone="brand" href={'/' + locale + '/dashboard/students'} />
            <BigCard label={t('staff')} value={stats.staff} icon="👩‍🏫" tone="violet" href={'/' + locale + '/dashboard/staff'} />
            <BigCard label={t('classes')} value={stats.classes} icon="🏫" tone="sky" href={'/' + locale + '/dashboard/classes'} />
            <BigCard label={t('subjects')} value={stats.subjects} icon="📚" tone="amber" />
          </div>

          {/* Finance */}
          <h2 className="mt-10 text-lg font-semibold">{t('finance')}</h2>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <BigCard label={t('billed')} value={formatXAF(stats.finance.totalBilled)} icon="🧾" tone="brand" href={'/' + locale + '/dashboard/finance'} />
            <BigCard label={t('collected')} value={formatXAF(stats.finance.totalCollected)} icon="💰" tone="green" href={'/' + locale + '/dashboard/finance'} />
            <BigCard label={t('outstanding')} value={formatXAF(stats.finance.totalOutstanding)} icon="⏳" tone="red" href={'/' + locale + '/dashboard/finance'} />
          </div>

          {/* Attendance */}
          <h2 className="mt-10 text-lg font-semibold">{t('attendanceToday')}</h2>
          <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <BigCard label={t('present')} value={stats.attendance.present} icon="✅" tone="green" href={'/' + locale + '/dashboard/attendance'} />
            <BigCard label={t('absent')} value={stats.attendance.absent} icon="❌" tone="red" href={'/' + locale + '/dashboard/attendance'} />
            <BigCard label={t('late')} value={stats.attendance.late} icon="⏰" tone="amber" href={'/' + locale + '/dashboard/attendance'} />
            <BigCard label={t('rate')} value={stats.attendance.rate + '%'} icon="📊" tone="sky" href={'/' + locale + '/dashboard/attendance'} />
          </div>

          {/* Misc */}
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <BigCard label={t('upcomingExams')} value={stats.upcomingExams} icon="📝" tone="violet" href={'/' + locale + '/dashboard/exams'} />
            <BigCard label={t('announcements')} value={stats.announcements} icon="📢" tone="amber" />
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
`);

// ---------- i18n ----------
const dashboard = {
  en: {
    title: 'Dashboard', loading: 'Loading...',
    students: 'Students', staff: 'Staff', classes: 'Classes', subjects: 'Subjects',
    finance: 'Finance', billed: 'Total billed', collected: 'Collected', outstanding: 'Outstanding',
    attendanceToday: "Today's attendance",
    present: 'Present', absent: 'Absent', late: 'Late', rate: 'Rate',
    upcomingExams: 'Upcoming exams', announcements: 'Announcements',
  },
  fr: {
    title: 'Tableau de bord', loading: 'Chargement...',
    students: 'Eleves', staff: 'Personnel', classes: 'Classes', subjects: 'Matieres',
    finance: 'Finances', billed: 'Total facture', collected: 'Encaisse', outstanding: 'Impaye',
    attendanceToday: "Presence aujourd'hui",
    present: 'Presents', absent: 'Absents', late: 'En retard', rate: 'Taux',
    upcomingExams: 'Examens a venir', announcements: 'Annonces',
  },
  ar: {
    title: 'لوحة التحكم', loading: 'جار التحميل...',
    students: 'الطلاب', staff: 'الموظفون', classes: 'الفصول', subjects: 'المواد',
    finance: 'المالية', billed: 'إجمالي الفواتير', collected: 'المحصل', outstanding: 'المتأخرات',
    attendanceToday: 'حضور اليوم',
    present: 'حاضر', absent: 'غائب', late: 'متأخر', rate: 'النسبة',
    upcomingExams: 'الامتحانات القادمة', announcements: 'الإعلانات',
  },
};
for (const locale of ['en', 'fr', 'ar']) {
  const f = join(root, 'apps/web/messages/' + locale + '.json');
  const d = existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : {};
  d.dashboard = { ...(d.dashboard || {}), ...dashboard[locale] };
  writeFileSync(f, JSON.stringify(d, null, 2), 'utf8');
  console.log('  ~ apps/web/messages/' + locale + '.json (dashboard keys)');
}

console.log('\n✅ Dashboard stats written');
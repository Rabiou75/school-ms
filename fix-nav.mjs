import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const root = process.cwd();
const put = (p, c) => {
  const full = join(root, p);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, c, 'utf8');
  console.log('  + ' + p);
};

// ============================================================
// 1) Fix sidebar — restore staff + subjects, drop settings (no page yet)
// ============================================================
put('apps/web/app/[locale]/dashboard/layout.tsx', `import Link from 'next/link';
import LanguageSwitcher from '@/components/LanguageSwitcher';

type NavKey = 'dashboard' | 'students' | 'staff' | 'classes' | 'subjects' | 'attendance' | 'exams' | 'finance';

const NAV: NavKey[] = ['dashboard', 'students', 'staff', 'classes', 'subjects', 'attendance', 'exams', 'finance'];

const LABELS: Record<NavKey, { en: string; fr: string; ar: string }> = {
  dashboard:  { en: 'Dashboard',  fr: 'Tableau de bord', ar: 'لوحة التحكم' },
  students:   { en: 'Students',   fr: 'Eleves',          ar: 'الطلاب' },
  staff:      { en: 'Staff',      fr: 'Personnel',       ar: 'الموظفون' },
  classes:    { en: 'Classes',    fr: 'Classes',         ar: 'الفصول' },
  subjects:   { en: 'Subjects',   fr: 'Matieres',        ar: 'المواد' },
  attendance: { en: 'Attendance', fr: 'Presence',        ar: 'الحضور' },
  exams:      { en: 'Exams',      fr: 'Examens',         ar: 'الامتحانات' },
  finance:    { en: 'Finance',    fr: 'Finances',        ar: 'المالية' },
};

const ICONS: Record<NavKey, string> = {
  dashboard: '📊', students: '🎓', staff: '👩‍🏫', classes: '🏫',
  subjects: '📚', attendance: '✅', exams: '📝', finance: '💰',
};

export default function DashboardLayout({
  children, params: { locale },
}: { children: React.ReactNode; params: { locale: string } }) {
  const l = (locale === 'en' || locale === 'ar') ? locale : 'fr';

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="w-64 border-r bg-white">
        <div className="flex h-16 items-center border-b px-4">
          <span className="text-lg font-bold text-brand-600">SMS</span>
          <span className="ml-2 text-xs text-gray-400">LBY</span>
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
          <LanguageSwitcher />
        </header>
        <main className="p-8">{children}</main>
      </div>
    </div>
  );
}
`);

// ============================================================
// 2) Classes page
// ============================================================
put('apps/web/app/[locale]/dashboard/classes/page.tsx', `'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';

type ClassRow = {
  id: string;
  name: string;
  level: string | null;
  capacity: number;
  academicYear: string | null;
  studentCount: number;
};

export default function ClassesPage() {
  const t = useTranslations('classes');
  const { locale } = useParams() as { locale: string };
  const [rows, setRows] = useState<ClassRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/api/v1/classes')
      .then(async (r) => {
        if (!r.ok) throw new Error(r.status + ' ' + r.statusText);
        return r.json();
      })
      .then((d) => setRows(Array.isArray(d) ? d : []))
      .catch((e) => setErr(String(e)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
      </div>

      {err && <p className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{err}</p>}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading && <p className="text-gray-500">{t('loading')}</p>}
        {!loading && rows.length === 0 && !err && (
          <p className="text-gray-500">{t('noClasses')}</p>
        )}
        {rows.map((c) => {
          const fill = c.capacity > 0 ? Math.round((c.studentCount / c.capacity) * 100) : 0;
          return (
            <div key={c.id} className="rounded-xl border bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-lg font-bold">{c.name}</div>
                  {c.academicYear && (
                    <div className="text-xs text-gray-500">{t('year')}: {c.academicYear}</div>
                  )}
                </div>
                <span className="rounded bg-teal-50 px-2 py-1 text-xs font-medium text-teal-700">
                  {c.studentCount}/{c.capacity}
                </span>
              </div>
              <div className="mt-4 h-2 w-full overflow-hidden rounded bg-gray-100">
                <div className="h-full bg-teal-500" style={{ width: fill + '%' }} />
              </div>
              <div className="mt-4 flex justify-between text-xs">
                <Link
                  href={'/' + locale + '/dashboard/students?class=' + c.id}
                  className="text-brand-600 hover:underline"
                >
                  {t('viewStudents')} →
                </Link>
                <Link
                  href={'/' + locale + '/dashboard/attendance?classId=' + c.id}
                  className="text-brand-600 hover:underline"
                >
                  {t('attendance')} →
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
`);

// ============================================================
// 3) Staff page
// ============================================================
put('apps/api/src/staff/staff.service.ts', `import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StaffService {
  constructor(private prisma: PrismaService) {}

  list(schoolId: string) {
    return this.prisma.staff.findMany({
      where: { schoolId, isActive: true },
      include: { user: { select: { email: true, role: true } } },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
  }
}
`);

put('apps/api/src/staff/staff.controller.ts', `import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { StaffService } from './staff.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('staff')
export class StaffController {
  constructor(private svc: StaffService) {}

  @Get()
  list(@Req() req: any) {
    return this.svc.list(req.user.schoolId);
  }
}
`);

put('apps/api/src/staff/staff.module.ts', `import { Module } from '@nestjs/common';
import { StaffService } from './staff.service';
import { StaffController } from './staff.controller';

@Module({
  providers: [StaffService],
  controllers: [StaffController],
})
export class StaffModule {}
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
import { StaffModule } from './staff/staff.module';

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
    StaffModule,
  ],
})
export class AppModule {}
`);

put('apps/web/app/[locale]/dashboard/staff/page.tsx', `'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { apiFetch } from '@/lib/api';
import { formatXAF } from '@/lib/format';

type Staff = {
  id: string;
  employeeNo: string;
  firstName: string;
  lastName: string;
  gender: string;
  position: string;
  hireDate: string;
  baseSalary: number;
  isActive: boolean;
  user?: { email: string; role: string } | null;
};

export default function StaffPage() {
  const t = useTranslations('staff');
  const [rows, setRows] = useState<Staff[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/api/v1/staff')
      .then(async (r) => {
        if (!r.ok) throw new Error(r.status + ' ' + r.statusText);
        return r.json();
      })
      .then((d) => setRows(Array.isArray(d) ? d : []))
      .catch((e) => setErr(String(e)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold">{t('title')}</h1>

      {err && <p className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{err}</p>}

      <div className="mt-6 overflow-x-auto rounded-lg border">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-3 font-medium">{t('employeeNo')}</th>
              <th className="p-3 font-medium">{t('name')}</th>
              <th className="p-3 font-medium">{t('position')}</th>
              <th className="p-3 font-medium">{t('email')}</th>
              <th className="p-3 font-medium">{t('hireDate')}</th>
              <th className="p-3 text-right font-medium">{t('salary')}</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="p-6 text-center text-gray-500">{t('loading')}</td></tr>}
            {!loading && rows.length === 0 && !err && (
              <tr><td colSpan={6} className="p-6 text-center text-gray-500">{t('noStaff')}</td></tr>
            )}
            {rows.map((s) => (
              <tr key={s.id} className="border-t hover:bg-gray-50">
                <td className="p-3 font-mono text-xs">{s.employeeNo}</td>
                <td className="p-3">
                  <div className="font-medium">{s.firstName} {s.lastName}</div>
                  <div className="text-[10px] text-gray-500">{s.gender}</div>
                </td>
                <td className="p-3">{s.position}</td>
                <td className="p-3 text-xs">{s.user?.email || '—'}</td>
                <td className="p-3 text-xs">{new Date(s.hireDate).toLocaleDateString()}</td>
                <td className="p-3 text-right font-medium">{formatXAF(s.baseSalary)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
`);

// ============================================================
// 4) Subjects page (stub — will grow later)
// ============================================================
put('apps/api/src/subjects/subjects.service.ts', `import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SubjectsService {
  constructor(private prisma: PrismaService) {}

  list(schoolId: string) {
    return this.prisma.subject.findMany({
      where: { schoolId },
      orderBy: { name: 'asc' },
    });
  }
}
`);

put('apps/api/src/subjects/subjects.controller.ts', `import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { SubjectsService } from './subjects.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('subjects')
export class SubjectsController {
  constructor(private svc: SubjectsService) {}

  @Get()
  list(@Req() req: any) {
    return this.svc.list(req.user.schoolId);
  }
}
`);

put('apps/api/src/subjects/subjects.module.ts', `import { Module } from '@nestjs/common';
import { SubjectsService } from './subjects.service';
import { SubjectsController } from './subjects.controller';

@Module({
  providers: [SubjectsService],
  controllers: [SubjectsController],
})
export class SubjectsModule {}
`);

put('apps/web/app/[locale]/dashboard/subjects/page.tsx', `'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { apiFetch } from '@/lib/api';

type Subject = {
  id: string;
  code: string;
  name: string;
  nameFr: string | null;
  nameAr: string | null;
};

export default function SubjectsPage() {
  const t = useTranslations('subjects');
  const [rows, setRows] = useState<Subject[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    apiFetch('/api/v1/subjects')
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => setRows(Array.isArray(d) ? d : []))
      .catch((e) => setErr(String(e)));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      {err && <p className="mt-4 text-red-600">{err}</p>}
      <div className="mt-6 overflow-x-auto rounded-lg border">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-3 font-medium">{t('code')}</th>
              <th className="p-3 font-medium">{t('name')}</th>
              <th className="p-3 font-medium">{t('nameFr')}</th>
              <th className="p-3 font-medium">{t('nameAr')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !err && (
              <tr><td colSpan={4} className="p-6 text-center text-gray-500">{t('noSubjects')}</td></tr>
            )}
            {rows.map((s) => (
              <tr key={s.id} className="border-t">
                <td className="p-3 font-mono text-xs">{s.code}</td>
                <td className="p-3">{s.name}</td>
                <td className="p-3 text-xs">{s.nameFr || '—'}</td>
                <td className="p-3 text-xs" dir="rtl">{s.nameAr || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
`);

// ============================================================
// 5) Register SubjectsModule
// ============================================================
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
import { StaffModule } from './staff/staff.module';
import { SubjectsModule } from './subjects/subjects.module';

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
    StaffModule,
    SubjectsModule,
  ],
})
export class AppModule {}
`);

console.log('\n✅ Sidebar fixed + classes/staff/subjects pages created');
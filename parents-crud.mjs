import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const root = process.cwd();
const put = (p, c) => {
  const full = join(root, p);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, c, 'utf8');
  console.log('  + ' + p);
};

// ============================================================
// Shared schema
// ============================================================
put('packages/shared/src/schemas/guardian.ts', `import { z } from 'zod';

export const createGuardianSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  relation: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email().optional().or(z.literal('')),
  // If password provided, also create a PARENT user account
  password: z.string().min(8).optional().or(z.literal('')),
});

export const updateGuardianSchema = createGuardianSchema.partial();
export type CreateGuardianDto = z.infer<typeof createGuardianSchema>;
export type UpdateGuardianDto = z.infer<typeof updateGuardianSchema>;
`);

put('packages/shared/src/index.ts', `export * from './schemas/auth';
export * from './schemas/student';
export * from './schemas/finance';
export * from './schemas/attendance';
export * from './schemas/exam';
export * from './schemas/staff';
export * from './schemas/klass';
export * from './schemas/subject';
export * from './schemas/guardian';
export * from './constants';
`);

// ============================================================
// Backend service
// ============================================================
put('apps/api/src/guardians/guardians.service.ts', `import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGuardianDto, UpdateGuardianDto } from '@school/shared';

@Injectable()
export class GuardiansService {
  constructor(private prisma: PrismaService) {}

  async list(schoolId: string, q?: string) {
    const where: any = { schoolId };
    if (q) {
      where.OR = [
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName:  { contains: q, mode: 'insensitive' } },
        { phone:     { contains: q } },
      ];
    }
    const guardians = await this.prisma.guardian.findMany({
      where,
      include: {
        user: { select: { id: true, email: true, role: true, isActive: true } },
        students: {
          where: { isActive: true },
          select: { id: true, firstName: true, lastName: true, admissionNo: true },
          orderBy: { firstName: 'asc' },
        },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
    return guardians.map((g) => ({
      id: g.id,
      firstName: g.firstName,
      lastName: g.lastName,
      relation: g.relation,
      phone: g.phone,
      email: g.email ?? g.user?.email ?? null,
      hasAccount: !!g.userId,
      accountActive: g.user?.isActive ?? null,
      childrenCount: g.students.length,
      children: g.students,
    }));
  }

  async get(id: string) {
    const g = await this.prisma.guardian.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, role: true, isActive: true } },
        students: {
          where: { isActive: true },
          select: { id: true, firstName: true, lastName: true, admissionNo: true },
        },
      },
    });
    if (!g) throw new NotFoundException('guardian_not_found');
    return g;
  }

  async create(schoolId: string, dto: CreateGuardianDto) {
    const email = (dto.email || '').trim() || null;
    const password = (dto.password || '').trim() || null;

    let userId: string | null = null;

    if (email && password) {
      // Create parent user account
      const existing = await this.prisma.user.findUnique({ where: { email } });
      if (existing) throw new ConflictException('email_already_registered');
      const user = await this.prisma.user.create({
        data: {
          schoolId,
          email,
          passwordHash: await bcrypt.hash(password, 10),
          firstName: dto.firstName,
          lastName: dto.lastName,
          role: 'PARENT',
          locale: 'fr',
        },
      });
      userId = user.id;
    }

    return this.prisma.guardian.create({
      data: {
        schoolId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        relation: dto.relation,
        phone: dto.phone,
        email,
        userId,
      },
    });
  }

  async update(id: string, dto: UpdateGuardianDto) {
    const g = await this.prisma.guardian.findUnique({ where: { id } });
    if (!g) throw new NotFoundException('guardian_not_found');

    // Simple field updates
    const data: any = {
      firstName: dto.firstName,
      lastName: dto.lastName,
      relation: dto.relation,
      phone: dto.phone,
    };
    if (dto.email !== undefined) data.email = (dto.email || '').trim() || null;

    // Optional: create a login account on the fly
    const email = (dto.email || '').trim() || null;
    const password = (dto.password || '').trim() || null;
    if (password && password.length >= 8) {
      if (!email) throw new BadRequestException('email_required_for_account');
      if (g.userId) {
        // Update existing account password
        await this.prisma.user.update({
          where: { id: g.userId },
          data: {
            passwordHash: await bcrypt.hash(password, 10),
            firstName: dto.firstName ?? g.firstName,
            lastName: dto.lastName ?? g.lastName,
            email,
          },
        });
      } else {
        const existing = await this.prisma.user.findUnique({ where: { email } });
        if (existing) throw new ConflictException('email_already_registered');
        const user = await this.prisma.user.create({
          data: {
            schoolId: g.schoolId,
            email,
            passwordHash: await bcrypt.hash(password, 10),
            firstName: dto.firstName ?? g.firstName,
            lastName: dto.lastName ?? g.lastName,
            role: 'PARENT',
            locale: 'fr',
          },
        });
        data.userId = user.id;
      }
    }

    return this.prisma.guardian.update({ where: { id }, data });
  }

  async remove(id: string) {
    const g = await this.prisma.guardian.findUnique({
      where: { id },
      include: { _count: { select: { students: true } } },
    });
    if (!g) throw new NotFoundException('guardian_not_found');

    if (g._count.students > 0) {
      throw new BadRequestException('guardian_has_children');
    }

    // Deactivate account if it exists
    if (g.userId) {
      await this.prisma.user.update({ where: { id: g.userId }, data: { isActive: false } });
    }
    await this.prisma.guardian.delete({ where: { id } });
    return { ok: true };
  }
}
`);

put('apps/api/src/guardians/guardians.controller.ts', `import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { GuardiansService } from './guardians.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../common/pipes/zod.pipe';
import {
  createGuardianSchema, updateGuardianSchema,
  CreateGuardianDto, UpdateGuardianDto,
} from '@school/shared';

@UseGuards(JwtAuthGuard)
@Controller('guardians')
export class GuardiansController {
  constructor(private svc: GuardiansService) {}

  @Get()
  list(@Req() req: any, @Query('q') q?: string) {
    return this.svc.list(req.user.schoolId, q);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.svc.get(id);
  }

  @Post()
  create(@Req() req: any, @Body(new ZodValidationPipe(createGuardianSchema)) dto: CreateGuardianDto) {
    return this.svc.create(req.user.schoolId, dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body(new ZodValidationPipe(updateGuardianSchema)) dto: UpdateGuardianDto) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}
`);

put('apps/api/src/guardians/guardians.module.ts', `import { Module } from '@nestjs/common';
import { GuardiansService } from './guardians.service';
import { GuardiansController } from './guardians.controller';

@Module({
  providers: [GuardiansService],
  controllers: [GuardiansController],
})
export class GuardiansModule {}
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
import { SubjectsModule } from './subjects/subjects.module';
import { ParentModule } from './parent/parent.module';
import { GuardiansModule } from './guardians/guardians.module';

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
    ParentModule,
    GuardiansModule,
  ],
})
export class AppModule {}
`);

// ============================================================
// Frontend — parents page
// ============================================================
put('apps/web/app/[locale]/dashboard/parents/page.tsx', `'use client';
import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { apiFetch } from '@/lib/api';

type Guardian = {
  id: string;
  firstName: string;
  lastName: string;
  relation: string;
  phone: string;
  email: string | null;
  hasAccount: boolean;
  accountActive: boolean | null;
  childrenCount: number;
  children: { id: string; firstName: string; lastName: string; admissionNo: string }[];
};

export default function ParentsPage() {
  const t = useTranslations('parents');
  const [rows, setRows] = useState<Guardian[]>([]);
  const [q, setQ] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Guardian | null>(null);
  const [showNew, setShowNew] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await apiFetch('/api/v1/guardians');
      if (!r.ok) throw new Error(r.status + ' ' + r.statusText);
      const d = await r.json();
      setRows(Array.isArray(d) ? d : []);
      setErr(null);
    } catch (e: any) { setRows([]); setErr(String(e)); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!q) return rows;
    const n = q.toLowerCase();
    return rows.filter((g) =>
      g.firstName.toLowerCase().includes(n) ||
      g.lastName.toLowerCase().includes(n) ||
      g.phone.toLowerCase().includes(n) ||
      (g.email || '').toLowerCase().includes(n)
    );
  }, [rows, q]);

  const remove = async (g: Guardian) => {
    if (!confirm(t('confirmDelete').replace('{name}', g.firstName + ' ' + g.lastName))) return;
    try {
      const r = await apiFetch('/api/v1/guardians/' + g.id, { method: 'DELETE' });
      if (!r.ok) {
        const txt = await r.text();
        if (txt.includes('guardian_has_children')) { setErr(t('hasChildren')); return; }
        throw new Error(txt);
      }
      load();
    } catch (e: any) { setErr(String(e)); }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <div className="flex items-center gap-2">
          <input
            placeholder={t('search')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-64 rounded border px-3 py-2 text-sm"
          />
          <button
            onClick={() => setShowNew(true)}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700"
          >
            + {t('newParent')}
          </button>
        </div>
      </div>

      {err && <p className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{err}</p>}

      <div className="mt-6 overflow-x-auto rounded-lg border">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-3 font-medium">{t('name')}</th>
              <th className="p-3 font-medium">{t('relation')}</th>
              <th className="p-3 font-medium">{t('phone')}</th>
              <th className="p-3 font-medium">{t('email')}</th>
              <th className="p-3 font-medium">{t('account')}</th>
              <th className="p-3 text-center font-medium">{t('children')}</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="p-6 text-center text-gray-500">{t('loading')}</td></tr>}
            {!loading && filtered.length === 0 && !err && (
              <tr><td colSpan={7} className="p-6 text-center text-gray-500">
                {q ? t('noResults') : t('noParents')}
              </td></tr>
            )}
            {filtered.map((g) => (
              <tr key={g.id} className="border-t hover:bg-gray-50">
                <td className="p-3">
                  <div className="font-medium">{g.firstName} {g.lastName}</div>
                </td>
                <td className="p-3 text-xs">{g.relation}</td>
                <td className="p-3 font-mono text-xs">{g.phone}</td>
                <td className="p-3 text-xs">{g.email || '—'}</td>
                <td className="p-3">
                  {g.hasAccount ? (
                    <span className={'rounded-full px-2 py-0.5 text-xs font-medium ' +
                      (g.accountActive ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700')}>
                      {g.accountActive ? t('active') : t('inactive')}
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                      {t('noAccount')}
                    </span>
                  )}
                </td>
                <td className="p-3 text-center">
                  <span className="rounded bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700">
                    {g.childrenCount}
                  </span>
                </td>
                <td className="p-3 text-right whitespace-nowrap">
                  <button onClick={() => setEditing(g)}
                          className="rounded border border-gray-300 px-3 py-1 text-xs hover:bg-gray-50">
                    {t('edit')}
                  </button>
                  <button onClick={() => remove(g)}
                          className="ml-2 rounded border border-red-300 px-3 py-1 text-xs text-red-700 hover:bg-red-50">
                    {t('delete')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(showNew || editing) && (
        <GuardianModal
          guardian={editing}
          onClose={() => { setShowNew(false); setEditing(null); }}
          onSaved={() => { setShowNew(false); setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function GuardianModal({
  guardian, onClose, onSaved,
}: { guardian: Guardian | null; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations('parents');
  const isEdit = !!guardian;
  const [form, setForm] = useState({
    firstName: guardian?.firstName ?? '',
    lastName:  guardian?.lastName ?? '',
    relation:  guardian?.relation ?? 'Pere',
    phone:     guardian?.phone ?? '',
    email:     guardian?.email ?? '',
    password:  '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setErr(null);
    try {
      const url = isEdit ? '/api/v1/guardians/' + guardian!.id : '/api/v1/guardians';
      const method = isEdit ? 'PUT' : 'POST';
      const payload: any = {
        firstName: form.firstName,
        lastName: form.lastName,
        relation: form.relation,
        phone: form.phone,
        email: form.email || undefined,
      };
      if (form.password) payload.password = form.password;

      const r = await apiFetch(url, { method, body: JSON.stringify(payload) });
      if (!r.ok) {
        const txt = await r.text();
        if (txt.includes('email_already_registered')) { setErr(t('emailTaken')); setSaving(false); return; }
        if (txt.includes('email_required_for_account')) { setErr(t('emailRequired')); setSaving(false); return; }
        throw new Error(txt);
      }
      onSaved();
    } catch (e: any) { setErr(String(e)); setSaving(false); }
  };

  const accountWillBeCreated = !guardian?.hasAccount && form.email && form.password;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl space-y-4 rounded-xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold">{isEdit ? t('editTitle') : t('newTitle')}</h3>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t('firstName')}>
            <input required value={form.firstName}
                   onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                   className="w-full rounded border px-3 py-2" />
          </Field>
          <Field label={t('lastName')}>
            <input required value={form.lastName}
                   onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                   className="w-full rounded border px-3 py-2" />
          </Field>
          <Field label={t('relation')}>
            <select value={form.relation}
                    onChange={(e) => setForm({ ...form, relation: e.target.value })}
                    className="w-full rounded border px-3 py-2">
              <option value="Pere">Père</option>
              <option value="Mere">Mère</option>
              <option value="Tuteur">Tuteur</option>
              <option value="Tutrice">Tutrice</option>
              <option value="Autre">Autre</option>
            </select>
          </Field>
          <Field label={t('phone')}>
            <input required value={form.phone}
                   onChange={(e) => setForm({ ...form, phone: e.target.value })}
                   placeholder="+237 6 XX XX XX XX"
                   className="w-full rounded border px-3 py-2" />
          </Field>
        </div>

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-600">
            {guardian?.hasAccount ? t('loginAccount') : t('createLoginAccount')}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('email')}>
              <input type="email" value={form.email}
                     onChange={(e) => setForm({ ...form, email: e.target.value })}
                     placeholder="parent@example.com"
                     className="w-full rounded border px-3 py-2" />
            </Field>
            <Field label={guardian?.hasAccount ? t('newPassword') : t('password')}>
              <input type="password" value={form.password}
                     onChange={(e) => setForm({ ...form, password: e.target.value })}
                     placeholder={guardian?.hasAccount ? t('leaveBlank') : t('minChars')}
                     className="w-full rounded border px-3 py-2" />
            </Field>
          </div>
          {accountWillBeCreated && (
            <p className="mt-2 text-xs text-teal-700">
              ✓ {t('accountInfo')}
            </p>
          )}
          {!guardian?.hasAccount && !form.password && (
            <p className="mt-2 text-xs text-gray-500">
              {t('optionalAccountHint')}
            </p>
          )}
        </div>

        {err && <p className="text-sm text-red-600 whitespace-pre-wrap">{err}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded border px-4 py-2 text-sm">
            {t('cancel')}
          </button>
          <button disabled={saving}
                  className="rounded bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700 disabled:opacity-50">
            {saving ? '...' : t('save')}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-700">{label}</span>
      {children}
    </label>
  );
}
`);

// ============================================================
// Sidebar — add Parents link
// ============================================================
put('apps/web/app/[locale]/dashboard/layout.tsx', `import Link from 'next/link';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import UserMenu from '@/components/UserMenu';

type NavKey = 'dashboard' | 'students' | 'parents' | 'staff' | 'classes' | 'subjects' | 'attendance' | 'exams' | 'finance';

const NAV: NavKey[] = ['dashboard', 'students', 'parents', 'staff', 'classes', 'subjects', 'attendance', 'exams', 'finance'];

const LABELS: Record<NavKey, { en: string; fr: string; ar: string }> = {
  dashboard:  { en: 'Dashboard',  fr: 'Tableau de bord', ar: 'لوحة التحكم' },
  students:   { en: 'Students',   fr: 'Eleves',          ar: 'الطلاب' },
  parents:    { en: 'Parents',    fr: 'Parents',         ar: 'أولياء الأمور' },
  staff:      { en: 'Staff',      fr: 'Personnel',       ar: 'الموظفون' },
  classes:    { en: 'Classes',    fr: 'Classes',         ar: 'الفصول' },
  subjects:   { en: 'Subjects',   fr: 'Matieres',        ar: 'المواد' },
  attendance: { en: 'Attendance', fr: 'Presence',        ar: 'الحضور' },
  exams:      { en: 'Exams',      fr: 'Examens',         ar: 'الامتحانات' },
  finance:    { en: 'Finance',    fr: 'Finances',        ar: 'المالية' },
};

const ICONS: Record<NavKey, string> = {
  dashboard: '📊', students: '🎓', parents: '👨‍👩‍👧', staff: '👩‍🏫',
  classes: '🏫', subjects: '📚', attendance: '✅', exams: '📝', finance: '💰',
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
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <UserMenu />
          </div>
        </header>
        <main className="p-8">{children}</main>
      </div>
    </div>
  );
}
`);

// ============================================================
// i18n keys — written as raw JSON objects that we can merge safely
// ============================================================
const parents = {
  en: {
    title: 'Parents / Guardians',
    search: 'Search by name, phone or email…',
    newParent: 'New parent',
    name: 'Name', relation: 'Relation', phone: 'Phone', email: 'Email',
    account: 'Account', children: 'Children',
    active: 'Active', inactive: 'Inactive', noAccount: 'No account',
    edit: 'Edit', delete: 'Delete', save: 'Save', cancel: 'Cancel',
    loading: 'Loading…', noParents: 'No parents yet.', noResults: 'No match.',
    firstName: 'First name', lastName: 'Last name',
    createLoginAccount: 'Create parent login account (optional)',
    loginAccount: 'Parent login account',
    password: 'Password (min 8 chars)',
    newPassword: 'New password',
    leaveBlank: 'Leave blank to keep current password',
    minChars: 'Min 8 characters',
    accountInfo: 'An account will be created for this parent so they can log in to the portal.',
    optionalAccountHint: 'Optional: set a password to give this parent portal access.',
    emailTaken: 'This email is already registered to another user.',
    emailRequired: 'Email is required to create an account.',
    editTitle: 'Edit parent', newTitle: 'New parent',
    confirmDelete: 'Delete {name}? This cannot be undone.',
    hasChildren: 'Cannot delete: this parent still has linked students. Reassign or archive them first.',
  },
  fr: {
    title: 'Parents / Tuteurs',
    search: 'Rechercher par nom, telephone ou email…',
    newParent: 'Nouveau parent',
    name: 'Nom', relation: 'Relation', phone: 'Telephone', email: 'Email',
    account: 'Compte', children: 'Enfants',
    active: 'Actif', inactive: 'Inactif', noAccount: 'Sans compte',
    edit: 'Modifier', delete: 'Supprimer', save: 'Enregistrer', cancel: 'Annuler',
    loading: 'Chargement…', noParents: 'Aucun parent.', noResults: 'Aucun resultat.',
    firstName: 'Prenom', lastName: 'Nom',
    createLoginAccount: 'Creer un compte parent (optionnel)',
    loginAccount: 'Compte parent',
    password: 'Mot de passe (min 8)',
    newPassword: 'Nouveau mot de passe',
    leaveBlank: 'Laisser vide pour conserver',
    minChars: 'Minimum 8 caracteres',
    accountInfo: 'Un compte sera cree pour que ce parent puisse se connecter au portail.',
    optionalAccountHint: 'Optionnel : definir un mot de passe pour donner acces au portail parent.',
    emailTaken: 'Cet email est deja utilise.',
    emailRequired: 'Email requis pour creer un compte.',
    editTitle: 'Modifier le parent', newTitle: 'Nouveau parent',
    confirmDelete: 'Supprimer {name} ? Irreversible.',
    hasChildren: 'Suppression impossible : des eleves sont encore lies a ce parent.',
  },
  ar: {
    title: 'أولياء الأمور',
    search: 'بحث بالاسم أو الهاتف أو البريد…',
    newParent: 'ولي أمر جديد',
    name: 'الاسم', relation: 'العلاقة', phone: 'الهاتف', email: 'البريد',
    account: 'الحساب', children: 'الأبناء',
    active: 'نشط', inactive: 'غير نشط', noAccount: 'بدون حساب',
    edit: 'تعديل', delete: 'حذف', save: 'حفظ', cancel: 'إلغاء',
    loading: 'جار التحميل…', noParents: 'لا يوجد أولياء.', noResults: 'لا نتائج.',
    firstName: 'الاسم الأول', lastName: 'اسم العائلة',
    createLoginAccount: 'إنشاء حساب دخول لولي الأمر (اختياري)',
    loginAccount: 'حساب ولي الأمر',
    password: 'كلمة المرور (8 أحرف على الأقل)',
    newPassword: 'كلمة المرور الجديدة',
    leaveBlank: 'اتركه فارغاً للاحتفاظ بالحالية',
    minChars: '8 أحرف على الأقل',
    accountInfo: 'سيتم إنشاء حساب ليتمكن ولي الأمر من الدخول إلى البوابة.',
    optionalAccountHint: 'اختياري: عيّن كلمة مرور لمنح ولي الأمر الوصول.',
    emailTaken: 'هذا البريد مستخدم بالفعل.',
    emailRequired: 'البريد مطلوب لإنشاء الحساب.',
    editTitle: 'تعديل ولي الأمر', newTitle: 'ولي أمر جديد',
    confirmDelete: 'حذف {name}؟',
    hasChildren: 'لا يمكن الحذف: يوجد طلاب مرتبطون.',
  },
};

// Merge safely (strip BOM before parsing)
for (const locale of ['en', 'fr', 'ar']) {
  const path = join(root, 'apps/web/messages/' + locale + '.json');
  let raw = readFileSync(path, 'utf8');
  if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
  const data = JSON.parse(raw);
  data.parents = { ...(data.parents || {}), ...parents[locale] };
  writeFileSync(path, JSON.stringify(data, null, 2), 'utf8');
  console.log('  ~ apps/web/messages/' + locale + '.json (parents keys)');
}

console.log('\n✅ Parents CRUD written');
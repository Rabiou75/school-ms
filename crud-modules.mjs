import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

const root = process.cwd();
const put = (p, c) => {
  const full = join(root, p);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, c, 'utf8');
  console.log('  + ' + p);
};

// ============================================================
// SHARED SCHEMAS
// ============================================================
put('packages/shared/src/schemas/staff.ts', `import { z } from 'zod';

export const createStaffSchema = z.object({
  employeeNo: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
  position: z.string().min(1),
  hireDate: z.string(),
  baseSalary: z.number().int().min(0),
  email: z.string().email().optional(),
  phone: z.string().optional(),
});
export type CreateStaffDto = z.infer<typeof createStaffSchema>;

export const updateStaffSchema = createStaffSchema.partial();
export type UpdateStaffDto = z.infer<typeof updateStaffSchema>;
`);

put('packages/shared/src/schemas/klass.ts', `import { z } from 'zod';

export const createClassSchema = z.object({
  name: z.string().min(1),
  level: z.string().optional(),
  capacity: z.number().int().positive().default(40),
});
export type CreateClassDto = z.infer<typeof createClassSchema>;

export const updateClassSchema = createClassSchema.partial();
export type UpdateClassDto = z.infer<typeof updateClassSchema>;
`);

put('packages/shared/src/schemas/subject.ts', `import { z } from 'zod';

export const createSubjectSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  nameFr: z.string().optional(),
  nameAr: z.string().optional(),
});
export type CreateSubjectDto = z.infer<typeof createSubjectSchema>;

export const updateSubjectSchema = createSubjectSchema.partial();
export type UpdateSubjectDto = z.infer<typeof updateSubjectSchema>;
`);

put('packages/shared/src/index.ts', `export * from './schemas/auth';
export * from './schemas/student';
export * from './schemas/finance';
export * from './schemas/attendance';
export * from './schemas/exam';
export * from './schemas/staff';
export * from './schemas/klass';
export * from './schemas/subject';
export * from './constants';
`);

// ============================================================
// STAFF SERVICE + CONTROLLER
// ============================================================
put('apps/api/src/staff/staff.service.ts', `import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStaffDto, UpdateStaffDto } from '@school/shared';

@Injectable()
export class StaffService {
  constructor(private prisma: PrismaService) {}

  list(schoolId: string) {
    return this.prisma.staff.findMany({
      where: { schoolId },
      include: { user: { select: { email: true, role: true } } },
      orderBy: [{ isActive: 'desc' }, { lastName: 'asc' }, { firstName: 'asc' }],
    });
  }

  async create(schoolId: string, dto: CreateStaffDto) {
    const dup = await this.prisma.staff.findUnique({
      where: { schoolId_employeeNo: { schoolId, employeeNo: dto.employeeNo } },
    });
    if (dup) throw new ConflictException('employee_no_exists');
    return this.prisma.staff.create({
      data: {
        schoolId,
        employeeNo: dto.employeeNo,
        firstName: dto.firstName,
        lastName: dto.lastName,
        gender: dto.gender,
        position: dto.position,
        hireDate: new Date(dto.hireDate),
        baseSalary: dto.baseSalary,
      },
    });
  }

  async update(id: string, dto: UpdateStaffDto) {
    const exists = await this.prisma.staff.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('staff_not_found');
    return this.prisma.staff.update({
      where: { id },
      data: {
        ...dto,
        hireDate: dto.hireDate ? new Date(dto.hireDate) : undefined,
      },
    });
  }

  async remove(id: string) {
    const exists = await this.prisma.staff.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('staff_not_found');
    return this.prisma.staff.update({ where: { id }, data: { isActive: false } });
  }
}
`);

put('apps/api/src/staff/staff.controller.ts', `import { Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { StaffService } from './staff.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../common/pipes/zod.pipe';
import { createStaffSchema, updateStaffSchema, CreateStaffDto, UpdateStaffDto } from '@school/shared';

@UseGuards(JwtAuthGuard)
@Controller('staff')
export class StaffController {
  constructor(private svc: StaffService) {}

  @Get()
  list(@Req() req: any) { return this.svc.list(req.user.schoolId); }

  @Post()
  create(@Req() req: any, @Body(new ZodValidationPipe(createStaffSchema)) dto: CreateStaffDto) {
    return this.svc.create(req.user.schoolId, dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body(new ZodValidationPipe(updateStaffSchema)) dto: UpdateStaffDto) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}
`);

// ============================================================
// CLASSES SERVICE + CONTROLLER
// ============================================================
put('apps/api/src/classes/classes.service.ts', `import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClassDto, UpdateClassDto } from '@school/shared';

@Injectable()
export class ClassesService {
  constructor(private prisma: PrismaService) {}

  async list(schoolId: string) {
    const classes = await this.prisma.class.findMany({
      where: { schoolId },
      include: {
        academicYear: { select: { name: true } },
        _count: { select: { students: true } },
      },
      orderBy: { name: 'asc' },
    });
    return classes.map((c) => ({
      id: c.id,
      name: c.name,
      level: c.level,
      capacity: c.capacity,
      academicYear: c.academicYear?.name ?? null,
      studentCount: c._count.students,
    }));
  }

  async create(schoolId: string, dto: CreateClassDto) {
    const year = await this.prisma.academicYear.findFirst({
      where: { schoolId, isCurrent: true },
    });
    if (!year) throw new BadRequestException('no_current_academic_year');

    const dup = await this.prisma.class.findFirst({
      where: { schoolId, academicYearId: year.id, name: dto.name },
    });
    if (dup) throw new BadRequestException('class_name_exists');

    return this.prisma.class.create({
      data: {
        schoolId,
        academicYearId: year.id,
        name: dto.name,
        level: dto.level ?? null,
        capacity: dto.capacity ?? 40,
      },
    });
  }

  async update(id: string, dto: UpdateClassDto) {
    const exists = await this.prisma.class.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('class_not_found');
    return this.prisma.class.update({
      where: { id },
      data: {
        name: dto.name,
        level: dto.level,
        capacity: dto.capacity,
      },
    });
  }

  async remove(id: string) {
    const students = await this.prisma.student.count({
      where: { classId: id, isActive: true },
    });
    if (students > 0) throw new BadRequestException('class_has_students');
    await this.prisma.class.delete({ where: { id } });
    return { ok: true };
  }
}
`);

put('apps/api/src/classes/classes.controller.ts', `import { Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { ClassesService } from './classes.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../common/pipes/zod.pipe';
import { createClassSchema, updateClassSchema, CreateClassDto, UpdateClassDto } from '@school/shared';

@UseGuards(JwtAuthGuard)
@Controller('classes')
export class ClassesController {
  constructor(private svc: ClassesService) {}

  @Get()
  list(@Req() req: any) { return this.svc.list(req.user.schoolId); }

  @Post()
  create(@Req() req: any, @Body(new ZodValidationPipe(createClassSchema)) dto: CreateClassDto) {
    return this.svc.create(req.user.schoolId, dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body(new ZodValidationPipe(updateClassSchema)) dto: UpdateClassDto) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}
`);

// ============================================================
// SUBJECTS SERVICE + CONTROLLER
// ============================================================
put('apps/api/src/subjects/subjects.service.ts', `import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSubjectDto, UpdateSubjectDto } from '@school/shared';

@Injectable()
export class SubjectsService {
  constructor(private prisma: PrismaService) {}

  list(schoolId: string) {
    return this.prisma.subject.findMany({
      where: { schoolId },
      orderBy: { name: 'asc' },
    });
  }

  async create(schoolId: string, dto: CreateSubjectDto) {
    const dup = await this.prisma.subject.findUnique({
      where: { schoolId_code: { schoolId, code: dto.code } },
    });
    if (dup) throw new BadRequestException('subject_code_exists');
    return this.prisma.subject.create({
      data: {
        schoolId,
        code: dto.code,
        name: dto.name,
        nameFr: dto.nameFr ?? null,
        nameAr: dto.nameAr ?? null,
      },
    });
  }

  async update(id: string, dto: UpdateSubjectDto) {
    const exists = await this.prisma.subject.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('subject_not_found');
    return this.prisma.subject.update({
      where: { id },
      data: {
        code: dto.code,
        name: dto.name,
        nameFr: dto.nameFr,
        nameAr: dto.nameAr,
      },
    });
  }

  async remove(id: string) {
    const marks = await this.prisma.mark.count({ where: { subjectId: id } });
    if (marks > 0) throw new BadRequestException('subject_has_marks');
    await this.prisma.subject.delete({ where: { id } });
    return { ok: true };
  }
}
`);

put('apps/api/src/subjects/subjects.controller.ts', `import { Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { SubjectsService } from './subjects.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../common/pipes/zod.pipe';
import { createSubjectSchema, updateSubjectSchema, CreateSubjectDto, UpdateSubjectDto } from '@school/shared';

@UseGuards(JwtAuthGuard)
@Controller('subjects')
export class SubjectsController {
  constructor(private svc: SubjectsService) {}

  @Get()
  list(@Req() req: any) { return this.svc.list(req.user.schoolId); }

  @Post()
  create(@Req() req: any, @Body(new ZodValidationPipe(createSubjectSchema)) dto: CreateSubjectDto) {
    return this.svc.create(req.user.schoolId, dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body(new ZodValidationPipe(updateSubjectSchema)) dto: UpdateSubjectDto) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}
`);

// ============================================================
// FRONTEND — Staff page with CRUD
// ============================================================
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
  gender: 'MALE' | 'FEMALE' | 'OTHER';
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
  const [editing, setEditing] = useState<Staff | null>(null);
  const [showNew, setShowNew] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await apiFetch('/api/v1/staff');
      if (!r.ok) throw new Error(r.status + ' ' + r.statusText);
      const d = await r.json();
      setRows(Array.isArray(d) ? d : []);
      setErr(null);
    } catch (e: any) { setRows([]); setErr(String(e)); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const remove = async (s: Staff) => {
    if (!confirm(t('confirmDelete').replace('{name}', s.firstName + ' ' + s.lastName))) return;
    try {
      const r = await apiFetch('/api/v1/staff/' + s.id, { method: 'DELETE' });
      if (!r.ok) throw new Error(await r.text());
      load();
    } catch (e: any) { setErr(String(e)); }
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <button
          onClick={() => setShowNew(true)}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700"
        >
          + {t('newStaff')}
        </button>
      </div>

      {err && <p className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{err}</p>}

      <div className="mt-6 overflow-x-auto rounded-lg border">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-3 font-medium">{t('employeeNo')}</th>
              <th className="p-3 font-medium">{t('name')}</th>
              <th className="p-3 font-medium">{t('position')}</th>
              <th className="p-3 font-medium">{t('hireDate')}</th>
              <th className="p-3 text-right font-medium">{t('salary')}</th>
              <th className="p-3 font-medium">{t('status')}</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="p-6 text-center text-gray-500">{t('loading')}</td></tr>}
            {!loading && rows.length === 0 && !err && (
              <tr><td colSpan={7} className="p-6 text-center text-gray-500">{t('noStaff')}</td></tr>
            )}
            {rows.map((s) => (
              <tr key={s.id} className="border-t hover:bg-gray-50">
                <td className="p-3 font-mono text-xs">{s.employeeNo}</td>
                <td className="p-3">
                  <div className="font-medium">{s.firstName} {s.lastName}</div>
                  <div className="text-[10px] text-gray-500">{s.gender}</div>
                </td>
                <td className="p-3">{s.position}</td>
                <td className="p-3 text-xs">{new Date(s.hireDate).toLocaleDateString()}</td>
                <td className="p-3 text-right font-medium">{formatXAF(s.baseSalary)}</td>
                <td className="p-3">
                  <span className={'rounded-full px-2 py-0.5 text-xs font-medium ' + (s.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700')}>
                    {s.isActive ? t('active') : t('inactive')}
                  </span>
                </td>
                <td className="p-3 text-right whitespace-nowrap">
                  <button onClick={() => setEditing(s)} className="rounded border border-gray-300 px-3 py-1 text-xs hover:bg-gray-50">
                    {t('edit')}
                  </button>
                  <button onClick={() => remove(s)} className="ml-2 rounded border border-red-300 px-3 py-1 text-xs text-red-700 hover:bg-red-50">
                    {t('delete')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(showNew || editing) && (
        <StaffModal
          staff={editing}
          onClose={() => { setShowNew(false); setEditing(null); }}
          onSaved={() => { setShowNew(false); setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function StaffModal({
  staff, onClose, onSaved,
}: { staff: Staff | null; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations('staff');
  const isEdit = !!staff;
  const [form, setForm] = useState({
    employeeNo: staff?.employeeNo ?? '',
    firstName:  staff?.firstName ?? '',
    lastName:   staff?.lastName ?? '',
    gender:     (staff?.gender ?? 'MALE') as 'MALE' | 'FEMALE' | 'OTHER',
    position:   staff?.position ?? '',
    hireDate:   staff?.hireDate ? staff.hireDate.slice(0, 10) : new Date().toISOString().slice(0, 10),
    baseSalary: staff?.baseSalary ?? 150000,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setErr(null);
    try {
      const url = isEdit ? '/api/v1/staff/' + staff!.id : '/api/v1/staff';
      const method = isEdit ? 'PUT' : 'POST';
      const r = await apiFetch(url, {
        method,
        body: JSON.stringify({ ...form, baseSalary: Number(form.baseSalary) }),
      });
      if (!r.ok) throw new Error(await r.text());
      onSaved();
    } catch (e: any) { setErr(String(e)); setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl space-y-4 rounded-xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold">{isEdit ? t('editTitle') : t('newTitle')}</h3>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('employeeNo')}>
            <input required value={form.employeeNo}
                   onChange={(e) => setForm({ ...form, employeeNo: e.target.value })}
                   className="w-full rounded border px-3 py-2" />
          </Field>
          <Field label={t('gender')}>
            <select value={form.gender}
                    onChange={(e) => setForm({ ...form, gender: e.target.value as any })}
                    className="w-full rounded border px-3 py-2">
              <option value="MALE">{t('male')}</option>
              <option value="FEMALE">{t('female')}</option>
              <option value="OTHER">{t('other')}</option>
            </select>
          </Field>
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
          <Field label={t('position')}>
            <input required value={form.position}
                   onChange={(e) => setForm({ ...form, position: e.target.value })}
                   placeholder="Teacher - Mathematics"
                   className="w-full rounded border px-3 py-2" />
          </Field>
          <Field label={t('hireDate')}>
            <input required type="date" value={form.hireDate}
                   onChange={(e) => setForm({ ...form, hireDate: e.target.value })}
                   className="w-full rounded border px-3 py-2" />
          </Field>
          <Field label={t('salaryXAF') + ' — ' + formatXAF(Number(form.baseSalary))}>
            <input required type="number" min={0} step={5000} value={form.baseSalary}
                   onChange={(e) => setForm({ ...form, baseSalary: Number(e.target.value) })}
                   className="w-full rounded border px-3 py-2" />
          </Field>
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
// FRONTEND — Classes page with CRUD
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
  const [editing, setEditing] = useState<ClassRow | null>(null);
  const [showNew, setShowNew] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await apiFetch('/api/v1/classes');
      if (!r.ok) throw new Error(r.status + ' ' + r.statusText);
      const d = await r.json();
      setRows(Array.isArray(d) ? d : []);
      setErr(null);
    } catch (e: any) { setRows([]); setErr(String(e)); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const remove = async (c: ClassRow) => {
    if (!confirm(t('confirmDelete').replace('{name}', c.name))) return;
    try {
      const r = await apiFetch('/api/v1/classes/' + c.id, { method: 'DELETE' });
      if (!r.ok) {
        const txt = await r.text();
        if (txt.includes('class_has_students')) {
          setErr(t('hasStudents'));
          return;
        }
        throw new Error(txt);
      }
      load();
    } catch (e: any) { setErr(String(e)); }
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <button
          onClick={() => setShowNew(true)}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700"
        >
          + {t('newClass')}
        </button>
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
              <div className="mt-4 flex items-center justify-between text-xs">
                <Link
                  href={'/' + locale + '/dashboard/students?class=' + c.id}
                  className="text-brand-600 hover:underline"
                >
                  {t('viewStudents')} →
                </Link>
                <div className="flex gap-2">
                  <button onClick={() => setEditing(c)}
                          className="rounded border border-gray-300 px-2 py-1 hover:bg-gray-50">
                    {t('edit')}
                  </button>
                  <button onClick={() => remove(c)}
                          className="rounded border border-red-300 px-2 py-1 text-red-700 hover:bg-red-50">
                    {t('delete')}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {(showNew || editing) && (
        <ClassModal
          klass={editing}
          onClose={() => { setShowNew(false); setEditing(null); }}
          onSaved={() => { setShowNew(false); setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function ClassModal({
  klass, onClose, onSaved,
}: { klass: ClassRow | null; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations('classes');
  const isEdit = !!klass;
  const [form, setForm] = useState({
    name: klass?.name ?? '',
    level: klass?.level ?? '',
    capacity: klass?.capacity ?? 40,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setErr(null);
    try {
      const url = isEdit ? '/api/v1/classes/' + klass!.id : '/api/v1/classes';
      const method = isEdit ? 'PUT' : 'POST';
      const r = await apiFetch(url, {
        method,
        body: JSON.stringify({ ...form, capacity: Number(form.capacity) }),
      });
      if (!r.ok) {
        const txt = await r.text();
        if (txt.includes('class_name_exists')) { setErr(t('nameExists')); setSaving(false); return; }
        if (txt.includes('no_current_academic_year')) { setErr(t('noYear')); setSaving(false); return; }
        throw new Error(txt);
      }
      onSaved();
    } catch (e: any) { setErr(String(e)); setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md space-y-4 rounded-xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold">{isEdit ? t('editTitle') : t('newTitle')}</h3>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-700">{t('name')}</span>
          <input required value={form.name}
                 onChange={(e) => setForm({ ...form, name: e.target.value })}
                 placeholder="6eme B"
                 className="w-full rounded border px-3 py-2" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-700">{t('level')}</span>
          <input value={form.level}
                 onChange={(e) => setForm({ ...form, level: e.target.value })}
                 placeholder="6eme"
                 className="w-full rounded border px-3 py-2" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-700">{t('capacity')}</span>
          <input required type="number" min={1} max={200} value={form.capacity}
                 onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })}
                 className="w-full rounded border px-3 py-2" />
        </label>
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
`);

// ============================================================
// FRONTEND — Subjects page with CRUD
// ============================================================
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
  const [editing, setEditing] = useState<Subject | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const r = await apiFetch('/api/v1/subjects');
      if (!r.ok) throw new Error(r.status + ' ' + r.statusText);
      const d = await r.json();
      setRows(Array.isArray(d) ? d : []);
      setErr(null);
    } catch (e: any) { setRows([]); setErr(String(e)); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const remove = async (s: Subject) => {
    if (!confirm(t('confirmDelete').replace('{name}', s.name))) return;
    try {
      const r = await apiFetch('/api/v1/subjects/' + s.id, { method: 'DELETE' });
      if (!r.ok) {
        const txt = await r.text();
        if (txt.includes('subject_has_marks')) { setErr(t('hasMarks')); return; }
        throw new Error(txt);
      }
      load();
    } catch (e: any) { setErr(String(e)); }
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <button
          onClick={() => setShowNew(true)}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700"
        >
          + {t('newSubject')}
        </button>
      </div>

      {err && <p className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{err}</p>}

      <div className="mt-6 overflow-x-auto rounded-lg border">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-3 font-medium">{t('code')}</th>
              <th className="p-3 font-medium">{t('name')}</th>
              <th className="p-3 font-medium">{t('nameFr')}</th>
              <th className="p-3 font-medium">{t('nameAr')}</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={5} className="p-6 text-center text-gray-500">{t('loading')}</td></tr>}
            {!loading && rows.length === 0 && !err && (
              <tr><td colSpan={5} className="p-6 text-center text-gray-500">{t('noSubjects')}</td></tr>
            )}
            {rows.map((s) => (
              <tr key={s.id} className="border-t hover:bg-gray-50">
                <td className="p-3 font-mono text-xs">{s.code}</td>
                <td className="p-3 font-medium">{s.name}</td>
                <td className="p-3 text-xs">{s.nameFr || '—'}</td>
                <td className="p-3 text-xs" dir="rtl">{s.nameAr || '—'}</td>
                <td className="p-3 text-right whitespace-nowrap">
                  <button onClick={() => setEditing(s)}
                          className="rounded border border-gray-300 px-3 py-1 text-xs hover:bg-gray-50">
                    {t('edit')}
                  </button>
                  <button onClick={() => remove(s)}
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
        <SubjectModal
          subject={editing}
          onClose={() => { setShowNew(false); setEditing(null); }}
          onSaved={() => { setShowNew(false); setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function SubjectModal({
  subject, onClose, onSaved,
}: { subject: Subject | null; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations('subjects');
  const isEdit = !!subject;
  const [form, setForm] = useState({
    code:   subject?.code ?? '',
    name:   subject?.name ?? '',
    nameFr: subject?.nameFr ?? '',
    nameAr: subject?.nameAr ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setErr(null);
    try {
      const url = isEdit ? '/api/v1/subjects/' + subject!.id : '/api/v1/subjects';
      const method = isEdit ? 'PUT' : 'POST';
      const r = await apiFetch(url, { method, body: JSON.stringify(form) });
      if (!r.ok) {
        const txt = await r.text();
        if (txt.includes('subject_code_exists')) { setErr(t('codeExists')); setSaving(false); return; }
        throw new Error(txt);
      }
      onSaved();
    } catch (e: any) { setErr(String(e)); setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md space-y-4 rounded-xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold">{isEdit ? t('editTitle') : t('newTitle')}</h3>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-700">{t('code')}</span>
          <input required value={form.code}
                 onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                 placeholder="MATH"
                 className="w-full rounded border px-3 py-2 font-mono" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-700">{t('name')}</span>
          <input required value={form.name}
                 onChange={(e) => setForm({ ...form, name: e.target.value })}
                 placeholder="Mathematics"
                 className="w-full rounded border px-3 py-2" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-700">{t('nameFr')}</span>
          <input value={form.nameFr}
                 onChange={(e) => setForm({ ...form, nameFr: e.target.value })}
                 placeholder="Mathematiques"
                 className="w-full rounded border px-3 py-2" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-700">{t('nameAr')}</span>
          <input value={form.nameAr} dir="rtl"
                 onChange={(e) => setForm({ ...form, nameAr: e.target.value })}
                 placeholder="الرياضيات"
                 className="w-full rounded border px-3 py-2" />
        </label>
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
`);

// ============================================================
// i18n
// ============================================================
const dict = {
  en: {
    staff: {
      title: 'Staff', newStaff: 'New staff member', editTitle: 'Edit staff', newTitle: 'New staff',
      employeeNo: 'Employee no', name: 'Name', position: 'Position',
      email: 'Email', hireDate: 'Hire date', salary: 'Base salary', salaryXAF: 'Base salary (XAF)',
      status: 'Status', active: 'Active', inactive: 'Inactive',
      edit: 'Edit', delete: 'Delete', save: 'Save', cancel: 'Cancel',
      loading: 'Loading...', noStaff: 'No staff yet.',
      firstName: 'First name', lastName: 'Last name',
      male: 'Male', female: 'Female', other: 'Other', gender: 'Gender',
      confirmDelete: 'Deactivate {name}? (soft-delete, reversible)',
    },
    classes: {
      title: 'Classes', newClass: 'New class', editTitle: 'Edit class', newTitle: 'New class',
      name: 'Name', level: 'Level', capacity: 'Capacity',
      year: 'Year', viewStudents: 'View students', attendance: 'Attendance',
      edit: 'Edit', delete: 'Delete', save: 'Save', cancel: 'Cancel',
      loading: 'Loading...', noClasses: 'No classes yet.',
      confirmDelete: 'Delete class {name}? This cannot be undone.',
      hasStudents: 'Cannot delete: this class still has students.',
      nameExists: 'A class with this name already exists for the current year.',
      noYear: 'No current academic year set. Create one first.',
    },
    subjects: {
      title: 'Subjects', newSubject: 'New subject', editTitle: 'Edit subject', newTitle: 'New subject',
      code: 'Code', name: 'Name (EN)', nameFr: 'Name (FR)', nameAr: 'Name (AR)',
      edit: 'Edit', delete: 'Delete', save: 'Save', cancel: 'Cancel',
      loading: 'Loading...', noSubjects: 'No subjects yet.',
      confirmDelete: 'Delete subject {name}?',
      hasMarks: 'Cannot delete: this subject already has marks recorded.',
      codeExists: 'A subject with this code already exists.',
    },
  },
  fr: {
    staff: {
      title: 'Personnel', newStaff: 'Nouveau membre', editTitle: 'Modifier', newTitle: 'Nouveau membre',
      employeeNo: 'Matricule', name: 'Nom', position: 'Poste',
      email: 'Email', hireDate: 'Date embauche', salary: 'Salaire de base', salaryXAF: 'Salaire de base (XAF)',
      status: 'Statut', active: 'Actif', inactive: 'Inactif',
      edit: 'Modifier', delete: 'Desactiver', save: 'Enregistrer', cancel: 'Annuler',
      loading: 'Chargement...', noStaff: 'Aucun personnel.',
      firstName: 'Prenom', lastName: 'Nom',
      male: 'Masculin', female: 'Feminin', other: 'Autre', gender: 'Sexe',
      confirmDelete: 'Desactiver {name} ? (reversible)',
    },
    classes: {
      title: 'Classes', newClass: 'Nouvelle classe', editTitle: 'Modifier la classe', newTitle: 'Nouvelle classe',
      name: 'Nom', level: 'Niveau', capacity: 'Capacite',
      year: 'Annee', viewStudents: 'Voir les eleves', attendance: 'Presence',
      edit: 'Modifier', delete: 'Supprimer', save: 'Enregistrer', cancel: 'Annuler',
      loading: 'Chargement...', noClasses: 'Aucune classe.',
      confirmDelete: 'Supprimer la classe {name} ? Irreversible.',
      hasStudents: 'Impossible de supprimer : des eleves sont encore inscrits.',
      nameExists: 'Une classe avec ce nom existe deja pour l\'annee en cours.',
      noYear: 'Aucune annee scolaire en cours.',
    },
    subjects: {
      title: 'Matieres', newSubject: 'Nouvelle matiere', editTitle: 'Modifier', newTitle: 'Nouvelle matiere',
      code: 'Code', name: 'Nom (EN)', nameFr: 'Nom (FR)', nameAr: 'Nom (AR)',
      edit: 'Modifier', delete: 'Supprimer', save: 'Enregistrer', cancel: 'Annuler',
      loading: 'Chargement...', noSubjects: 'Aucune matiere.',
      confirmDelete: 'Supprimer {name} ?',
      hasMarks: 'Impossible de supprimer : des notes sont enregistrees.',
      codeExists: 'Ce code existe deja.',
    },
  },
  ar: {
    staff: {
      title: 'الموظفون', newStaff: 'موظف جديد', editTitle: 'تعديل', newTitle: 'موظف جديد',
      employeeNo: 'الرقم الوظيفي', name: 'الاسم', position: 'المنصب',
      email: 'البريد', hireDate: 'تاريخ التعيين', salary: 'الراتب', salaryXAF: 'الراتب (XAF)',
      status: 'الحالة', active: 'نشط', inactive: 'غير نشط',
      edit: 'تعديل', delete: 'حذف', save: 'حفظ', cancel: 'إلغاء',
      loading: 'جار التحميل...', noStaff: 'لا يوجد موظفون.',
      firstName: 'الاسم الأول', lastName: 'اسم العائلة',
      male: 'ذكر', female: 'أنثى', other: 'آخر', gender: 'الجنس',
      confirmDelete: 'إلغاء تنشيط {name}؟',
    },
    classes: {
      title: 'الفصول', newClass: 'فصل جديد', editTitle: 'تعديل الفصل', newTitle: 'فصل جديد',
      name: 'الاسم', level: 'المستوى', capacity: 'السعة',
      year: 'السنة', viewStudents: 'عرض الطلاب', attendance: 'الحضور',
      edit: 'تعديل', delete: 'حذف', save: 'حفظ', cancel: 'إلغاء',
      loading: 'جار التحميل...', noClasses: 'لا توجد فصول.',
      confirmDelete: 'حذف الفصل {name}؟',
      hasStudents: 'لا يمكن الحذف: يوجد طلاب مسجلون.',
      nameExists: 'يوجد فصل بهذا الاسم.',
      noYear: 'لا توجد سنة دراسية حالية.',
    },
    subjects: {
      title: 'المواد', newSubject: 'مادة جديدة', editTitle: 'تعديل', newTitle: 'مادة جديدة',
      code: 'الرمز', name: 'الاسم (EN)', nameFr: 'الاسم (FR)', nameAr: 'الاسم (AR)',
      edit: 'تعديل', delete: 'حذف', save: 'حفظ', cancel: 'إلغاء',
      loading: 'جار التحميل...', noSubjects: 'لا توجد مواد.',
      confirmDelete: 'حذف {name}؟',
      hasMarks: 'لا يمكن الحذف: توجد علامات.',
      codeExists: 'الرمز مستخدم بالفعل.',
    },
  },
};

for (const locale of ['en', 'fr', 'ar']) {
  const f = join(root, 'apps/web/messages/' + locale + '.json');
  const d = existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : {};
  d.staff = { ...(d.staff || {}), ...dict[locale].staff };
  d.classes = { ...(d.classes || {}), ...dict[locale].classes };
  d.subjects = { ...(d.subjects || {}), ...dict[locale].subjects };
  writeFileSync(f, JSON.stringify(d, null, 2), 'utf8');
  console.log('  ~ apps/web/messages/' + locale + '.json');
}

console.log('\n✅ Staff + Classes + Subjects CRUD written');
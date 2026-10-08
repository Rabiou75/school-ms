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
// Backend: add DELETE + extend update on students
// (already exists — just verify by rewriting cleanly)
// ============================================================
put('apps/api/src/students/students.service.ts', `import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStudentDto, UpdateStudentDto } from '@school/shared';

@Injectable()
export class StudentsService {
  constructor(private prisma: PrismaService) {}

  list(schoolId: string, q?: string) {
    const where: any = { schoolId };
    if (q) {
      where.OR = [
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName:  { contains: q, mode: 'insensitive' } },
        { admissionNo: { contains: q, mode: 'insensitive' } },
      ];
    }
    return this.prisma.student.findMany({
      where,
      include: { class: true, guardian: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async get(id: string) {
    const s = await this.prisma.student.findUnique({
      where: { id },
      include: { class: true, guardian: true, invoices: true },
    });
    if (!s) throw new NotFoundException('student_not_found');
    return s;
  }

  create(schoolId: string, dto: CreateStudentDto) {
    return this.prisma.student.create({
      data: { ...dto, schoolId, dateOfBirth: new Date(dto.dateOfBirth) },
    });
  }

  update(id: string, dto: UpdateStudentDto) {
    return this.prisma.student.update({
      where: { id },
      data: dto.dateOfBirth ? { ...dto, dateOfBirth: new Date(dto.dateOfBirth) } : dto,
    });
  }

  remove(id: string) {
    return this.prisma.student.update({ where: { id }, data: { isActive: false } });
  }
}
`);

// ============================================================
// Students page (full CRUD)
// ============================================================
put('apps/web/app/[locale]/dashboard/students/page.tsx', `'use client';
import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { apiFetch } from '@/lib/api';

type Gender = 'MALE' | 'FEMALE' | 'OTHER';
type Student = {
  id: string;
  admissionNo: string;
  firstName: string;
  lastName: string;
  gender: Gender;
  dateOfBirth: string;
  phone: string | null;
  email: string | null;
  isActive: boolean;
  class?: { id: string; name: string } | null;
  guardian?: { firstName: string; lastName: string; phone: string } | null;
};
type Class = { id: string; name: string };

export default function StudentsPage() {
  const t = useTranslations('students');
  const [rows, setRows] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Student | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [s, c] = await Promise.all([
        apiFetch('/api/v1/students').then((r) => r.ok ? r.json() : Promise.reject(r.status)),
        apiFetch('/api/v1/classes').then((r) => r.ok ? r.json() : []),
      ]);
      setRows(Array.isArray(s) ? s : []);
      setClasses(Array.isArray(c) ? c : []);
      setErr(null);
    } catch (e: any) {
      setRows([]);
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!q) return rows;
    const needle = q.toLowerCase();
    return rows.filter((s) =>
      s.firstName.toLowerCase().includes(needle) ||
      s.lastName.toLowerCase().includes(needle) ||
      s.admissionNo.toLowerCase().includes(needle)
    );
  }, [rows, q]);

  const remove = async (s: Student) => {
    if (!confirm(t('confirmDelete').replace('{name}', s.firstName + ' ' + s.lastName))) return;
    try {
      const r = await apiFetch('/api/v1/students/' + s.id, { method: 'DELETE' });
      if (!r.ok) throw new Error(await r.text());
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
            + {t('newStudent')}
          </button>
        </div>
      </div>

      {err && (
        <p className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {t('error')}: {err}
        </p>
      )}

      <div className="mt-6 overflow-x-auto rounded-lg border">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-3 font-medium">{t('admissionNo')}</th>
              <th className="p-3 font-medium">{t('name')}</th>
              <th className="p-3 font-medium">{t('gender')}</th>
              <th className="p-3 font-medium">{t('dob')}</th>
              <th className="p-3 font-medium">{t('class')}</th>
              <th className="p-3 font-medium">{t('phone')}</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} className="p-6 text-center text-gray-500">{t('loading')}</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={7} className="p-6 text-center text-gray-500">
                {q ? t('noResults') : t('noStudents')}
              </td></tr>
            )}
            {filtered.map((s) => (
              <tr key={s.id} className="border-t hover:bg-gray-50">
                <td className="p-3 font-mono text-xs">{s.admissionNo}</td>
                <td className="p-3 font-medium">{s.firstName} {s.lastName}</td>
                <td className="p-3 text-xs">{s.gender}</td>
                <td className="p-3 text-xs">{new Date(s.dateOfBirth).toLocaleDateString()}</td>
                <td className="p-3">{s.class?.name || '—'}</td>
                <td className="p-3 text-xs">{s.phone || '—'}</td>
                <td className="p-3 text-right whitespace-nowrap">
                  <button
                    onClick={() => setEditing(s)}
                    className="rounded border border-gray-300 px-3 py-1 text-xs hover:bg-gray-50"
                  >
                    {t('edit')}
                  </button>
                  <button
                    onClick={() => remove(s)}
                    className="ml-2 rounded border border-red-300 px-3 py-1 text-xs text-red-700 hover:bg-red-50"
                  >
                    {t('delete')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(showNew || editing) && (
        <StudentModal
          student={editing}
          classes={classes}
          onClose={() => { setShowNew(false); setEditing(null); }}
          onSaved={() => { setShowNew(false); setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function StudentModal({
  student, classes, onClose, onSaved,
}: { student: Student | null; classes: Class[]; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations('students');
  const isEdit = !!student;
  const [form, setForm] = useState({
    admissionNo: student?.admissionNo ?? '',
    firstName:   student?.firstName ?? '',
    lastName:    student?.lastName ?? '',
    gender:      (student?.gender ?? 'MALE') as Gender,
    dateOfBirth: student?.dateOfBirth ? student.dateOfBirth.slice(0, 10) : '',
    classId:     student?.class?.id ?? (classes[0]?.id ?? ''),
    phone:       student?.phone ?? '',
    email:       student?.email ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setErr(null);
    try {
      const payload: any = {
        admissionNo: form.admissionNo,
        firstName: form.firstName,
        lastName: form.lastName,
        gender: form.gender,
        dateOfBirth: form.dateOfBirth,
        classId: form.classId || undefined,
        phone: form.phone || undefined,
        email: form.email || undefined,
      };
      const url = isEdit ? '/api/v1/students/' + student!.id : '/api/v1/students';
      const method = isEdit ? 'PUT' : 'POST';
      const r = await apiFetch(url, { method, body: JSON.stringify(payload) });
      if (!r.ok) {
        const body = await r.text();
        throw new Error(body);
      }
      onSaved();
    } catch (e: any) { setErr(String(e)); setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl space-y-4 rounded-xl bg-white p-6 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{isEdit ? t('editTitle') : t('newTitle')}</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700">✕</button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t('admissionNo')}>
            <input required value={form.admissionNo} onChange={set('admissionNo')}
                   className="w-full rounded border px-3 py-2" />
          </Field>
          <Field label={t('gender')}>
            <select value={form.gender} onChange={set('gender')}
                    className="w-full rounded border px-3 py-2">
              <option value="MALE">{t('male')}</option>
              <option value="FEMALE">{t('female')}</option>
              <option value="OTHER">{t('other')}</option>
            </select>
          </Field>
          <Field label={t('firstName')}>
            <input required value={form.firstName} onChange={set('firstName')}
                   className="w-full rounded border px-3 py-2" />
          </Field>
          <Field label={t('lastName')}>
            <input required value={form.lastName} onChange={set('lastName')}
                   className="w-full rounded border px-3 py-2" />
          </Field>
          <Field label={t('dob')}>
            <input required type="date" value={form.dateOfBirth} onChange={set('dateOfBirth')}
                   className="w-full rounded border px-3 py-2" />
          </Field>
          <Field label={t('class')}>
            <select value={form.classId} onChange={set('classId')}
                    className="w-full rounded border px-3 py-2">
              <option value="">—</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label={t('phone')}>
            <input value={form.phone} onChange={set('phone')}
                   placeholder="+237 6 XX XX XX XX"
                   className="w-full rounded border px-3 py-2" />
          </Field>
          <Field label={t('email')}>
            <input type="email" value={form.email} onChange={set('email')}
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
// i18n
// ============================================================
const students = {
  en: {
    title: 'Students', search: 'Search…', newStudent: 'New student',
    admissionNo: 'Admission no', name: 'Name', gender: 'Gender', dob: 'Date of birth',
    class: 'Class', phone: 'Phone', email: 'Email',
    edit: 'Edit', delete: 'Delete', save: 'Save', cancel: 'Cancel',
    loading: 'Loading…', noStudents: 'No students yet.', noResults: 'No match.',
    error: 'Error', editTitle: 'Edit student', newTitle: 'New student',
    firstName: 'First name', lastName: 'Last name',
    male: 'Male', female: 'Female', other: 'Other',
    confirmDelete: 'Delete {name}? This is reversible (soft-delete).',
  },
  fr: {
    title: 'Eleves', search: 'Rechercher…', newStudent: 'Nouvel eleve',
    admissionNo: 'Matricule', name: 'Nom', gender: 'Sexe', dob: 'Date de naissance',
    class: 'Classe', phone: 'Telephone', email: 'Email',
    edit: 'Modifier', delete: 'Supprimer', save: 'Enregistrer', cancel: 'Annuler',
    loading: 'Chargement…', noStudents: 'Aucun eleve.', noResults: 'Aucun resultat.',
    error: 'Erreur', editTitle: 'Modifier l\'eleve', newTitle: 'Nouvel eleve',
    firstName: 'Prenom', lastName: 'Nom',
    male: 'Masculin', female: 'Feminin', other: 'Autre',
    confirmDelete: 'Supprimer {name} ? (reversible)',
  },
  ar: {
    title: 'الطلاب', search: 'بحث…', newStudent: 'طالب جديد',
    admissionNo: 'رقم التسجيل', name: 'الاسم', gender: 'الجنس', dob: 'تاريخ الميلاد',
    class: 'الفصل', phone: 'الهاتف', email: 'البريد',
    edit: 'تعديل', delete: 'حذف', save: 'حفظ', cancel: 'إلغاء',
    loading: 'جار التحميل…', noStudents: 'لا يوجد طلاب.', noResults: 'لا نتائج.',
    error: 'خطأ', editTitle: 'تعديل الطالب', newTitle: 'طالب جديد',
    firstName: 'الاسم الأول', lastName: 'اسم العائلة',
    male: 'ذكر', female: 'أنثى', other: 'آخر',
    confirmDelete: 'حذف {name}؟',
  },
};
for (const locale of ['en', 'fr', 'ar']) {
  const f = join(root, 'apps/web/messages/' + locale + '.json');
  const d = existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : {};
  d.students = { ...(d.students || {}), ...students[locale] };
  writeFileSync(f, JSON.stringify(d, null, 2), 'utf8');
  console.log('  ~ apps/web/messages/' + locale + '.json (students keys)');
}

console.log('\n✅ Students UI written');
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
// 1. Shared schema
// ============================================================
put('packages/shared/src/schemas/announcement.ts', `import { z } from 'zod';

export const announcementAudiences = ['ALL', 'STUDENTS', 'PARENTS', 'STAFF', 'CLASS'] as const;

export const createAnnouncementSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  audience: z.enum(announcementAudiences).default('ALL'),
  classId: z.string().optional().nullable(),
  publish: z.boolean().default(true),
  channels: z.array(z.enum(['IN_APP','EMAIL','SMS'])).default(['IN_APP']),
});

export const updateAnnouncementSchema = createAnnouncementSchema.partial();
export type CreateAnnouncementDto = z.infer<typeof createAnnouncementSchema>;
export type UpdateAnnouncementDto = z.infer<typeof updateAnnouncementSchema>;
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
export * from './schemas/announcement';
export * from './constants';
`);

// ============================================================
// 2. Backend service
// ============================================================
put('apps/api/src/announcements/announcements.service.ts', `import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateAnnouncementDto, UpdateAnnouncementDto } from '@school/shared';

@Injectable()
export class AnnouncementsService {
  private readonly logger = new Logger(AnnouncementsService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  list(schoolId: string) {
    return this.prisma.announcement.findMany({
      where: { schoolId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async get(id: string) {
    const a = await this.prisma.announcement.findUnique({ where: { id } });
    if (!a) throw new NotFoundException('announcement_not_found');
    return a;
  }

  async create(schoolId: string, dto: CreateAnnouncementDto, authorId: string) {
    const a = await this.prisma.announcement.create({
      data: {
        schoolId,
        title: dto.title,
        body: dto.body,
        audience: dto.audience ?? 'ALL',
        classId: dto.classId ?? null,
        publishedAt: dto.publish ? new Date() : null,
      },
    });

    if (dto.publish) {
      this.broadcast(schoolId, a.id, dto.channels ?? ['IN_APP']).catch((e) =>
        this.logger.warn('Announcement broadcast failed: ' + e.message),
      );
    }

    return a;
  }

  async update(id: string, dto: UpdateAnnouncementDto) {
    const existing = await this.prisma.announcement.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('announcement_not_found');

    const wasPublished = !!existing.publishedAt;
    const data: any = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.body !== undefined) data.body = dto.body;
    if (dto.audience !== undefined) data.audience = dto.audience;
    if (dto.classId !== undefined) data.classId = dto.classId;
    if (dto.publish !== undefined) {
      data.publishedAt = dto.publish ? (existing.publishedAt ?? new Date()) : null;
    }

    const updated = await this.prisma.announcement.update({ where: { id }, data });

    // First-time publish via update → broadcast
    if (dto.publish && !wasPublished) {
      this.broadcast(updated.schoolId, updated.id, dto.channels ?? ['IN_APP']).catch(() => {});
    }

    return updated;
  }

  async remove(id: string) {
    const exists = await this.prisma.announcement.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('announcement_not_found');
    await this.prisma.announcement.delete({ where: { id } });
    return { ok: true };
  }

  async broadcast(schoolId: string, announcementId: string, channels: Array<'IN_APP'|'EMAIL'|'SMS'>) {
    const a = await this.prisma.announcement.findUnique({ where: { id: announcementId } });
    if (!a || !a.publishedAt) return { ok: false, reason: 'not_published' };

    const link = '/fr/notifications';
    const payload = {
      type: 'ANNOUNCEMENT',
      title: '📢 ' + a.title,
      body: a.body,
      link,
      channels,
    };

    let recipients: { id: string }[] = [];

    switch (a.audience) {
      case 'ALL':
        recipients = await this.prisma.user.findMany({
          where: { schoolId, isActive: true },
          select: { id: true },
        });
        break;
      case 'STUDENTS':
        recipients = await this.prisma.user.findMany({
          where: { schoolId, isActive: true, role: 'STUDENT' },
          select: { id: true },
        });
        break;
      case 'PARENTS':
        recipients = await this.prisma.user.findMany({
          where: { schoolId, isActive: true, role: 'PARENT' },
          select: { id: true },
        });
        break;
      case 'STAFF':
        recipients = await this.prisma.user.findMany({
          where: { schoolId, isActive: true, role: { in: ['TEACHER','ADMIN','SUPER_ADMIN','PRINCIPAL','ACCOUNTANT','LIBRARIAN'] } },
          select: { id: true },
        });
        break;
      case 'CLASS': {
        if (!a.classId) break;
        const guardians = await this.prisma.guardian.findMany({
          where: { students: { some: { classId: a.classId, isActive: true } }, userId: { not: null } },
          select: { userId: true },
        });
        recipients = guardians.map((g) => ({ id: g.userId! })).filter((x) => x.id);
        break;
      }
    }

    let sent = 0;
    for (const r of recipients) {
      const result = await this.notifications.dispatch({
        userId: r.id,
        schoolId,
        ...payload,
      }).catch(() => null);
      if (result?.ok) sent++;
    }

    this.logger.log(\`Announcement "\${a.title}" sent to \${sent}/\${recipients.length} users\`);
    return { ok: true, sent, total: recipients.length };
  }

  /** Manually re-broadcast an existing announcement */
  async rebroadcast(id: string, channels: Array<'IN_APP'|'EMAIL'|'SMS'>) {
    const a = await this.prisma.announcement.findUnique({ where: { id } });
    if (!a) throw new NotFoundException('announcement_not_found');
    return this.broadcast(a.schoolId, id, channels);
  }
}
`);

// ============================================================
// 3. Backend controller
// ============================================================
put('apps/api/src/announcements/announcements.controller.ts', `import { Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { AnnouncementsService } from './announcements.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../common/pipes/zod.pipe';
import {
  createAnnouncementSchema, updateAnnouncementSchema,
  CreateAnnouncementDto, UpdateAnnouncementDto,
} from '@school/shared';

@UseGuards(JwtAuthGuard)
@Controller('announcements')
export class AnnouncementsController {
  constructor(private svc: AnnouncementsService) {}

  @Get()
  list(@Req() req: any) { return this.svc.list(req.user.schoolId); }

  @Get(':id')
  get(@Param('id') id: string) { return this.svc.get(id); }

  @Post()
  create(
    @Req() req: any,
    @Body(new ZodValidationPipe(createAnnouncementSchema)) dto: CreateAnnouncementDto,
  ) {
    return this.svc.create(req.user.schoolId, dto, req.user.sub);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body(new ZodValidationPipe(updateAnnouncementSchema)) dto: UpdateAnnouncementDto) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.svc.remove(id); }

  @Post(':id/rebroadcast')
  rebroadcast(@Param('id') id: string, @Body() body: { channels?: Array<'IN_APP'|'EMAIL'|'SMS'> }) {
    return this.svc.rebroadcast(id, body.channels ?? ['IN_APP']);
  }
}
`);

put('apps/api/src/announcements/announcements.module.ts', `import { Module } from '@nestjs/common';
import { AnnouncementsService } from './announcements.service';
import { AnnouncementsController } from './announcements.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  providers: [AnnouncementsService],
  controllers: [AnnouncementsController],
})
export class AnnouncementsModule {}
`);

// ============================================================
// 4. Register in app.module
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
import { ParentModule } from './parent/parent.module';
import { GuardiansModule } from './guardians/guardians.module';
import { PaymentsModule } from './payments/payments.module';
import { SettingsModule } from './settings/settings.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AnnouncementsModule } from './announcements/announcements.module';

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
    PaymentsModule,
    SettingsModule,
    NotificationsModule,
    AnnouncementsModule,
  ],
})
export class AppModule {}
`);

// ============================================================
// 5. Admin announcements page
// ============================================================
put('apps/web/app/[locale]/dashboard/announcements/page.tsx', `'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { apiFetch } from '@/lib/api';

type Announcement = {
  id: string;
  title: string;
  body: string;
  audience: string;
  classId: string | null;
  publishedAt: string | null;
  createdAt: string;
};

type Class = { id: string; name: string };

export default function AnnouncementsPage() {
  const t = useTranslations('announcements');
  const [rows, setRows] = useState<Announcement[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [showNew, setShowNew] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [a, c] = await Promise.all([
        apiFetch('/api/v1/announcements').then((r) => (r.ok ? r.json() : [])),
        apiFetch('/api/v1/classes').then((r) => (r.ok ? r.json() : [])),
      ]);
      setRows(Array.isArray(a) ? a : []);
      setClasses(Array.isArray(c) ? c : []);
      setErr(null);
    } catch (e: any) { setErr(String(e)); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const remove = async (a: Announcement) => {
    if (!confirm(t('confirmDelete').replace('{title}', a.title))) return;
    try {
      const r = await apiFetch('/api/v1/announcements/' + a.id, { method: 'DELETE' });
      if (!r.ok) throw new Error(await r.text());
      load();
    } catch (e: any) { setErr(String(e)); }
  };

  const rebroadcast = async (a: Announcement) => {
    if (!confirm(t('confirmRebroadcast'))) return;
    setOk(null);
    try {
      const r = await apiFetch('/api/v1/announcements/' + a.id + '/rebroadcast', {
        method: 'POST',
        body: JSON.stringify({ channels: ['IN_APP'] }),
      });
      if (!r.ok) throw new Error(await r.text());
      const result = await r.json();
      setOk(t('broadcastSent').replace('{n}', String(result.sent)).replace('{total}', String(result.total)));
    } catch (e: any) { setErr(String(e)); }
  };

  const audienceLabel = (a: Announcement) => {
    if (a.audience === 'CLASS' && a.classId) {
      const c = classes.find((x) => x.id === a.classId);
      return 'CLASS — ' + (c?.name || '?');
    }
    return a.audience;
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <button
          onClick={() => setShowNew(true)}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700"
        >
          + {t('newAnnouncement')}
        </button>
      </div>

      {err && <p className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{err}</p>}
      {ok && <p className="mt-4 rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800">{ok}</p>}

      <div className="mt-6 space-y-3">
        {loading && <p className="text-gray-500">{t('loading')}</p>}
        {!loading && rows.length === 0 && !err && (
          <p className="rounded-lg border bg-white p-8 text-center text-gray-500">{t('noAnnouncements')}</p>
        )}
        {rows.map((a) => (
          <div key={a.id} className="rounded-lg border bg-white p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{a.title}</h3>
                  <span className={'rounded-full px-2 py-0.5 text-[10px] font-medium ' +
                    (a.publishedAt ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700')}>
                    {a.publishedAt ? t('published') : t('draft')}
                  </span>
                  <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-medium text-teal-800">
                    {audienceLabel(a)}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{a.body}</p>
                <p className="mt-2 text-xs text-gray-400">
                  {a.publishedAt
                    ? new Date(a.publishedAt).toLocaleString()
                    : 'Created ' + new Date(a.createdAt).toLocaleString()}
                </p>
              </div>
              <div className="flex flex-shrink-0 flex-col gap-1">
                {a.publishedAt && (
                  <button onClick={() => rebroadcast(a)}
                          className="rounded border border-brand-600 px-3 py-1 text-xs text-brand-700 hover:bg-teal-50">
                    {t('rebroadcast')}
                  </button>
                )}
                <button onClick={() => setEditing(a)}
                        className="rounded border border-gray-300 px-3 py-1 text-xs hover:bg-gray-50">
                  {t('edit')}
                </button>
                <button onClick={() => remove(a)}
                        className="rounded border border-red-300 px-3 py-1 text-xs text-red-700 hover:bg-red-50">
                  {t('delete')}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {(showNew || editing) && (
        <AnnouncementModal
          announcement={editing}
          classes={classes}
          onClose={() => { setShowNew(false); setEditing(null); }}
          onSaved={(msg) => {
            setShowNew(false); setEditing(null);
            if (msg) setOk(msg);
            load();
          }}
        />
      )}
    </div>
  );
}

function AnnouncementModal({
  announcement, classes, onClose, onSaved,
}: { announcement: Announcement | null; classes: Class[]; onClose: () => void; onSaved: (msg?: string) => void }) {
  const t = useTranslations('announcements');
  const isEdit = !!announcement;
  const [form, setForm] = useState({
    title: announcement?.title ?? '',
    body: announcement?.body ?? '',
    audience: announcement?.audience ?? 'ALL',
    classId: announcement?.classId ?? '',
    publish: announcement ? !!announcement.publishedAt : true,
    inApp: true,
    email: false,
    sms: false,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setErr(null);
    try {
      const channels: string[] = [];
      if (form.inApp) channels.push('IN_APP');
      if (form.email) channels.push('EMAIL');
      if (form.sms) channels.push('SMS');

      const payload: any = {
        title: form.title,
        body: form.body,
        audience: form.audience,
        publish: form.publish,
        channels,
      };
      if (form.audience === 'CLASS') payload.classId = form.classId || undefined;

      const url = isEdit ? '/api/v1/announcements/' + announcement!.id : '/api/v1/announcements';
      const method = isEdit ? 'PUT' : 'POST';
      const r = await apiFetch(url, { method, body: JSON.stringify(payload) });
      if (!r.ok) throw new Error(await r.text());

      const msg = form.publish
        ? (isEdit ? t('updatedAndPublished') : t('createdAndPublished'))
        : (isEdit ? t('updated') : t('savedAsDraft'));
      onSaved(msg);
    } catch (e: any) { setErr(String(e)); setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl space-y-4 rounded-xl bg-white p-6 shadow-xl"
      >
        <h3 className="text-lg font-semibold">{isEdit ? t('editTitle') : t('newTitle')}</h3>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-700">{t('announcementTitle')}</span>
          <input required value={form.title}
                 onChange={(e) => setForm({ ...form, title: e.target.value })}
                 placeholder={t('titlePlaceholder')}
                 className="w-full rounded border px-3 py-2" />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-700">{t('message')}</span>
          <textarea required rows={6} value={form.body}
                    onChange={(e) => setForm({ ...form, body: e.target.value })}
                    className="w-full rounded border px-3 py-2 font-sans"
                    placeholder={t('bodyPlaceholder')} />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-700">{t('audience')}</span>
            <select value={form.audience}
                    onChange={(e) => setForm({ ...form, audience: e.target.value })}
                    className="w-full rounded border px-3 py-2">
              <option value="ALL">👥 {t('audAll')}</option>
              <option value="PARENTS">👨‍👩‍👧 {t('audParents')}</option>
              <option value="STAFF">👩‍🏫 {t('audStaff')}</option>
              <option value="STUDENTS">🎓 {t('audStudents')}</option>
              <option value="CLASS">🏫 {t('audClass')}</option>
            </select>
          </label>

          {form.audience === 'CLASS' && (
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-700">{t('selectClass')}</span>
              <select value={form.classId}
                      onChange={(e) => setForm({ ...form, classId: e.target.value })}
                      className="w-full rounded border px-3 py-2">
                <option value="">—</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
          )}
        </div>

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-600">{t('channels')}</div>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.inApp}
                     onChange={(e) => setForm({ ...form, inApp: e.target.checked })} />
              🔔 {t('chInApp')}
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.email}
                     onChange={(e) => setForm({ ...form, email: e.target.checked })} />
              📧 {t('chEmail')}
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.sms}
                     onChange={(e) => setForm({ ...form, sms: e.target.checked })} />
              💬 {t('chSms')}
            </label>
          </div>
          <p className="mt-2 text-xs text-gray-500">{t('channelsHint')}</p>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.publish}
                 onChange={(e) => setForm({ ...form, publish: e.target.checked })} />
          {t('publishNow')}
        </label>

        {err && <p className="text-sm text-red-600 whitespace-pre-wrap">{err}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded border px-4 py-2 text-sm">
            {t('cancel')}
          </button>
          <button disabled={saving}
                  className="rounded bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700 disabled:opacity-50">
            {saving ? '…' : t('save')}
          </button>
        </div>
      </form>
    </div>
  );
}
`);

// ============================================================
// 6. Sidebar — add Announcements
// ============================================================
const dashPath = join(root, 'apps/web/app/[locale]/dashboard/layout.tsx');
let dash = readFileSync(dashPath, 'utf8');

if (!dash.includes("'announcements'")) {
  dash = dash.replace(
    "type NavKey = 'dashboard' | 'students' | 'parents' | 'staff' | 'classes' | 'subjects' | 'attendance' | 'exams' | 'finance' | 'settings';",
    "type NavKey = 'dashboard' | 'students' | 'parents' | 'staff' | 'classes' | 'subjects' | 'attendance' | 'exams' | 'finance' | 'announcements' | 'settings';"
  );
  dash = dash.replace(
    "const NAV: NavKey[] = ['dashboard', 'students', 'parents', 'staff', 'classes', 'subjects', 'attendance', 'exams', 'finance', 'settings'];",
    "const NAV: NavKey[] = ['dashboard', 'students', 'parents', 'staff', 'classes', 'subjects', 'attendance', 'exams', 'finance', 'announcements', 'settings'];"
  );
  dash = dash.replace(
    "  settings:   { en: 'Settings',   fr: 'Parametres',      ar: 'الإعدادات' },",
    "  announcements: { en: 'Announcements', fr: 'Annonces',   ar: 'الإعلانات' },\n  settings:   { en: 'Settings',   fr: 'Parametres',      ar: 'الإعدادات' },"
  );
  dash = dash.replace(
    "  finance: '💰', settings: '⚙️',",
    "  finance: '💰', announcements: '📢', settings: '⚙️',"
  );
  writeFileSync(dashPath, dash, 'utf8');
  console.log('  + dashboard/layout.tsx — Announcements link added');
} else {
  console.log('  = sidebar already has Announcements');
}

// ============================================================
// 7. i18n
// ============================================================
const dict = {
  en: {
    title: 'Announcements', newAnnouncement: 'New announcement',
    newTitle: 'New announcement', editTitle: 'Edit announcement',
    announcementTitle: 'Title', titlePlaceholder: 'e.g. Parent-teacher meeting',
    message: 'Message', bodyPlaceholder: 'Write your announcement…',
    audience: 'Audience',
    audAll: 'All users', audParents: 'Parents', audStaff: 'Staff',
    audStudents: 'Students', audClass: 'A specific class',
    selectClass: 'Class',
    channels: 'Delivery channels',
    chInApp: 'In-app', chEmail: 'Email', chSms: 'SMS',
    channelsHint: 'In-app always works. Email and SMS require configuration in Settings → Integrations.',
    publishNow: 'Publish now (delivers to the audience)',
    save: 'Save', cancel: 'Cancel',
    edit: 'Edit', delete: 'Delete', rebroadcast: 'Re-send',
    published: 'Published', draft: 'Draft',
    loading: 'Loading…', noAnnouncements: 'No announcements yet.',
    confirmDelete: 'Delete "{title}"? This cannot be undone.',
    confirmRebroadcast: 'Re-send this announcement to the audience?',
    broadcastSent: 'Sent to {n} of {total} users.',
    savedAsDraft: 'Saved as draft.',
    updated: 'Updated.',
    createdAndPublished: 'Published and sent to the audience.',
    updatedAndPublished: 'Updated and published.',
  },
  fr: {
    title: 'Annonces', newAnnouncement: 'Nouvelle annonce',
    newTitle: 'Nouvelle annonce', editTitle: 'Modifier l\\'annonce',
    announcementTitle: 'Titre', titlePlaceholder: 'ex. Reunion parents-professeurs',
    message: 'Message', bodyPlaceholder: 'Ecrivez votre annonce…',
    audience: 'Destinataires',
    audAll: 'Tous les utilisateurs', audParents: 'Parents', audStaff: 'Personnel',
    audStudents: 'Eleves', audClass: 'Une classe specifique',
    selectClass: 'Classe',
    channels: 'Canaux de diffusion',
    chInApp: 'In-app', chEmail: 'Email', chSms: 'SMS',
    channelsHint: 'In-app fonctionne toujours. Email et SMS necessitent une configuration dans Parametres → Integrations.',
    publishNow: 'Publier maintenant (diffuse aux destinataires)',
    save: 'Enregistrer', cancel: 'Annuler',
    edit: 'Modifier', delete: 'Supprimer', rebroadcast: 'Renvoyer',
    published: 'Publiee', draft: 'Brouillon',
    loading: 'Chargement…', noAnnouncements: 'Aucune annonce.',
    confirmDelete: 'Supprimer « {title} » ? Irreversible.',
    confirmRebroadcast: 'Renvoyer cette annonce aux destinataires ?',
    broadcastSent: 'Envoye a {n} sur {total} utilisateurs.',
    savedAsDraft: 'Enregistre comme brouillon.',
    updated: 'Mis a jour.',
    createdAndPublished: 'Publiee et diffusee.',
    updatedAndPublished: 'Mise a jour et publiee.',
  },
  ar: {
    title: 'الإعلانات', newAnnouncement: 'إعلان جديد',
    newTitle: 'إعلان جديد', editTitle: 'تعديل الإعلان',
    announcementTitle: 'العنوان', titlePlaceholder: 'مثال: اجتماع أولياء الأمور',
    message: 'الرسالة', bodyPlaceholder: 'اكتب إعلانك…',
    audience: 'الجمهور',
    audAll: 'جميع المستخدمين', audParents: 'أولياء الأمور', audStaff: 'الموظفون',
    audStudents: 'الطلاب', audClass: 'فصل محدد',
    selectClass: 'الفصل',
    channels: 'قنوات الإرسال',
    chInApp: 'داخل التطبيق', chEmail: 'البريد', chSms: 'رسائل نصية',
    channelsHint: 'داخل التطبيق يعمل دائماً. البريد والرسائل تحتاج تهيئة في الإعدادات.',
    publishNow: 'نشر الآن (يُرسل إلى الجمهور)',
    save: 'حفظ', cancel: 'إلغاء',
    edit: 'تعديل', delete: 'حذف', rebroadcast: 'إعادة الإرسال',
    published: 'منشور', draft: 'مسودة',
    loading: 'جار التحميل…', noAnnouncements: 'لا توجد إعلانات.',
    confirmDelete: 'حذف "{title}"؟',
    confirmRebroadcast: 'إعادة إرسال هذا الإعلان؟',
    broadcastSent: 'تم الإرسال إلى {n} من {total}.',
    savedAsDraft: 'تم الحفظ كمسودة.',
    updated: 'تم التحديث.',
    createdAndPublished: 'تم النشر والإرسال.',
    updatedAndPublished: 'تم التحديث والنشر.',
  },
};

for (const locale of ['en', 'fr', 'ar']) {
  const f = join(root, 'apps/web/messages/' + locale + '.json');
  let raw = readFileSync(f, 'utf8');
  if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
  const data = JSON.parse(raw);
  data.announcements = { ...(data.announcements || {}), ...dict[locale] };
  writeFileSync(f, JSON.stringify(data, null, 2), 'utf8');
  console.log('  ~ messages/' + locale + '.json');
}

console.log('\n✅ Announcements module written');
console.log('');
console.log('Next:');
console.log('  Get-Process node | Stop-Process -Force');
console.log('  pnpm --filter @school/shared build');
console.log('  cd apps\\api ; npx nest build ; cd ..\\..');
console.log('  pnpm dev');
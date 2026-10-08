import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const root = process.cwd();

// ============================================================
// 1. Add classId to Announcement model
// ============================================================
const schemaPath = join(root, 'packages/database/prisma/schema.prisma');
let schema = readFileSync(schemaPath, 'utf8');

const m = schema.match(/model Announcement \{[\s\S]*?\n\}/m);
if (!m) {
  console.error('Announcement model not found');
  process.exit(1);
}

let block = m[0];
if (/\n\s+classId\s+String\?/.test(block)) {
  console.log('  = Announcement.classId already present');
} else {
  const idx = block.lastIndexOf('\n}');
  block = block.slice(0, idx) + '\n  classId    String?' + block.slice(idx);
  schema = schema.replace(m[0], block);
  writeFileSync(schemaPath, schema, 'utf8');
  console.log('  + Announcement.classId');
}

// ============================================================
// 2. Write the announcements module files
// ============================================================
const put = (p, c) => {
  const full = join(root, p);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, c, 'utf8');
  console.log('  + ' + p);
};

put('apps/api/src/announcements/announcements.service.ts', `import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

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

  async create(schoolId: string, dto: any, authorId: string) {
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

  async update(id: string, dto: any) {
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

  async broadcast(schoolId: string, announcementId: string, channels: string[]) {
    const a = await this.prisma.announcement.findUnique({ where: { id: announcementId } });
    if (!a || !a.publishedAt) return { ok: false, reason: 'not_published' };

    let recipients: { id: string }[] = [];
    switch (a.audience) {
      case 'ALL':
        recipients = await this.prisma.user.findMany({ where: { schoolId, isActive: true }, select: { id: true } });
        break;
      case 'STUDENTS':
        recipients = await this.prisma.user.findMany({ where: { schoolId, isActive: true, role: 'STUDENT' }, select: { id: true } });
        break;
      case 'PARENTS':
        recipients = await this.prisma.user.findMany({ where: { schoolId, isActive: true, role: 'PARENT' }, select: { id: true } });
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
        type: 'ANNOUNCEMENT',
        title: '📢 ' + a.title,
        body: a.body,
        link: '/fr/notifications',
        channels: channels as any,
      }).catch(() => null);
      if (result?.ok) sent++;
    }
    this.logger.log('Announcement "' + a.title + '" sent to ' + sent + '/' + recipients.length + ' users');
    return { ok: true, sent, total: recipients.length };
  }

  async rebroadcast(id: string, channels: string[]) {
    const a = await this.prisma.announcement.findUnique({ where: { id } });
    if (!a) throw new NotFoundException('announcement_not_found');
    return this.broadcast(a.schoolId, id, channels);
  }
}
`);

put('apps/api/src/announcements/announcements.controller.ts', `import { Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { AnnouncementsService } from './announcements.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('announcements')
export class AnnouncementsController {
  constructor(private svc: AnnouncementsService) {}

  @Get()
  list(@Req() req: any) { return this.svc.list(req.user.schoolId); }

  @Get(':id')
  get(@Param('id') id: string) { return this.svc.get(id); }

  @Post()
  create(@Req() req: any, @Body() dto: any) { return this.svc.create(req.user.schoolId, dto, req.user.sub); }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: any) { return this.svc.update(id, dto); }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.svc.remove(id); }

  @Post(':id/rebroadcast')
  rebroadcast(@Param('id') id: string, @Body() body: { channels?: string[] }) {
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

console.log('\\n✅ Announcements module + schema fix written');
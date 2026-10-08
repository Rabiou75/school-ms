import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailProvider } from './providers/email.provider';
import { SmsProvider } from './providers/sms.provider';

export type DispatchPayload = {
  userId: string;
  schoolId?: string | null;
  type: string;
  title: string;
  body: string;
  link?: string;
  channels?: Array<'IN_APP' | 'EMAIL' | 'SMS'>;
  email?: string;
  phone?: string;
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private prisma: PrismaService,
    private email: EmailProvider,
    private sms: SmsProvider,
  ) {}

  // ---------- Config helpers (reads SchoolSetting for the given school) ----------
  private async getIntegrationCfg(schoolId: string | null | undefined, key: 'smtp' | 'sms' | 'cinetpay') {
    if (!schoolId) return null;
    const row = await this.prisma.schoolSetting.findUnique({
      where: { schoolId_key: { schoolId, key } },
    });
    if (!row) return null;
    try { return JSON.parse(row.value); } catch { return null; }
  }

  private async getRecipient(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, phone: true, schoolId: true, firstName: true, locale: true },
    });
  }

  // ---------- Dispatch (the main entry point) ----------
  async dispatch(payload: DispatchPayload) {
    const user = await this.getRecipient(payload.userId);
    if (!user) {
      this.logger.warn('dispatch: user not found ' + payload.userId);
      return { ok: false, reason: 'user_not_found' };
    }

    const schoolId = payload.schoolId ?? user.schoolId ?? null;
    const channels = payload.channels ?? ['IN_APP', 'EMAIL'];

    // 1. In-app
    let inAppId: string | null = null;
    if (channels.includes('IN_APP')) {
      const n = await this.prisma.notification.create({
        data: {
          userId: user.id,
          schoolId,
          type: payload.type,
          title: payload.title,
          body: payload.body,
          link: payload.link ?? null,
        },
      });
      inAppId = n.id;

      await this.prisma.notificationLog.create({
        data: {
          userId: user.id,
          schoolId,
          channel: 'IN_APP',
          to: user.id,
          subject: payload.title,
          body: payload.body,
          status: 'SENT',
        },
      });
    }

    // 2. Email
    if (channels.includes('EMAIL') && (payload.email ?? user.email)) {
      const cfg = await this.getIntegrationCfg(schoolId, 'smtp');
      if (cfg) {
        const result = await this.email.send(cfg, {
          to: payload.email ?? user.email!,
          subject: payload.title,
          body: payload.body,
        });
        await this.prisma.notificationLog.create({
          data: {
            userId: user.id,
            schoolId,
            channel: 'EMAIL',
            to: payload.email ?? user.email!,
            subject: payload.title,
            body: payload.body,
            status: result.ok ? 'SENT' : 'FAILED',
            providerId: result.providerId ?? null,
            error: result.error ?? null,
          },
        });
      } else {
        this.logger.debug('EMAIL skipped: SMTP not configured for school ' + schoolId);
      }
    }

    // 3. SMS
    if (channels.includes('SMS') && (payload.phone ?? user.phone)) {
      const cfg = await this.getIntegrationCfg(schoolId, 'sms');
      if (cfg) {
        const result = await this.sms.send(cfg, payload.phone ?? user.phone!, payload.body);
        await this.prisma.notificationLog.create({
          data: {
            userId: user.id,
            schoolId,
            channel: 'SMS',
            to: payload.phone ?? user.phone!,
            body: payload.body,
            status: result.ok ? 'SENT' : 'FAILED',
            providerId: result.providerId ?? null,
            error: result.error ?? null,
          },
        });
      } else {
        this.logger.debug('SMS skipped: SMS not configured for school ' + schoolId);
      }
    }

    return { ok: true, inAppId };
  }

  // ---------- Queries ----------
  async list(userId: string, opts: { unreadOnly?: boolean; take?: number } = {}) {
    const where: any = { userId };
    if (opts.unreadOnly) where.readAt = null;
    return this.prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: opts.take ?? 50,
    });
  }

  async unreadCount(userId: string) {
    const count = await this.prisma.notification.count({ where: { userId, readAt: null } });
    return { count };
  }

  async markRead(userId: string, id: string) {
    await this.prisma.notification.updateMany({
      where: { id, userId },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }

  async markAllRead(userId: string) {
    const r = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true, updated: r.count };
  }

  async remove(userId: string, id: string) {
    await this.prisma.notification.deleteMany({ where: { id, userId } });
    return { ok: true };
  }

  async clearAll(userId: string) {
    const r = await this.prisma.notification.deleteMany({ where: { userId } });
    return { ok: true, deleted: r.count };
  }

  // ---------- Helpers for event hooks ----------

  /** Notify the guardian (parent) of a student. */
  async notifyGuardianOfStudent(
    studentId: string,
    opts: {
      type: string;
      title: string;
      body: string;
      link?: string;
      channels?: Array<'IN_APP' | 'EMAIL' | 'SMS'>;
    },
  ) {
    try {
      const student = await this.prisma.student.findUnique({
        where: { id: studentId },
        include: {
          guardian: {
            include: {
              user: {
                select: { id: true, email: true, phone: true, schoolId: true, isActive: true },
              },
            },
          },
        },
      });
      if (!student) return { ok: false, reason: 'student_not_found' };
      if (!student.guardian?.userId || !student.guardian.user) {
        return { ok: false, reason: 'no_guardian_account' };
      }
      if (!student.guardian.user.isActive) return { ok: false, reason: 'guardian_inactive' };

      return await this.dispatch({
        userId: student.guardian.user.id,
        schoolId: student.guardian.user.schoolId ?? student.schoolId,
        type: opts.type,
        title: opts.title,
        body: opts.body,
        link: opts.link,
        channels: opts.channels,
      });
    } catch (e: any) {
      this.logger.warn('notifyGuardianOfStudent failed: ' + e.message);
      return { ok: false, reason: 'error' };
    }
  }

  /** Notify every active user in a school with a given role. */
  async notifyRole(
    schoolId: string,
    role: string,
    opts: {
      type: string;
      title: string;
      body: string;
      link?: string;
      channels?: Array<'IN_APP' | 'EMAIL' | 'SMS'>;
    },
  ) {
    try {
      const users = await this.prisma.user.findMany({
        where: { schoolId, role: role as any, isActive: true },
        select: { id: true, schoolId: true },
      });
      const results = await Promise.all(
        users.map((u) =>
          this.dispatch({
            userId: u.id,
            schoolId: u.schoolId,
            type: opts.type,
            title: opts.title,
            body: opts.body,
            link: opts.link,
            channels: opts.channels,
          }).catch(() => null),
        ),
      );
      return { ok: true, notified: results.filter((r) => r?.ok).length };
    } catch (e: any) {
      this.logger.warn('notifyRole failed: ' + e.message);
      return { ok: false, reason: 'error' };
    }
  }

  /** Convenience: notify admins of a school. */
  notifySchoolAdmins(schoolId: string, opts: { type: string; title: string; body: string; link?: string; channels?: Array<'IN_APP' | 'EMAIL' | 'SMS'> }) {
    return this.notifyRole(schoolId, 'SUPER_ADMIN', opts).then(() =>
      this.notifyRole(schoolId, 'ADMIN', opts),
    );
  }

  // ---------- Test endpoint (send a test notification to self) ----------
  async sendTest(userId: string) {
    const user = await this.getRecipient(userId);
    if (!user) return { ok: false };
    return this.dispatch({
      userId,
      schoolId: user.schoolId,
      type: 'TEST',
      title: 'Test notification',
      body: 'This is a test. If you see this, notifications are working.',
      channels: ['IN_APP'],
    });
  }

  // ---------- Logs (for admin) ----------
  listLogs(schoolId: string | null, take = 100) {
    return this.prisma.notificationLog.findMany({
      where: schoolId ? { schoolId } : {},
      orderBy: { createdAt: 'desc' },
      take,
    });
  }
  // ---------- SMTP test ----------
  async testEmail(userId: string, to: string) {
    const user = await this.getRecipient(userId);
    if (!user) throw new NotFoundException('user_not_found');

    const cfg = await this.getIntegrationCfg(user.schoolId, 'smtp');
    if (!cfg || !cfg.host) throw new BadRequestException('smtp_not_configured');

    const subject = 'SMTP test - School MS';
    const body = 'If you received this email, your SMTP configuration is working correctly.';

    const result = await this.email.send(cfg, { to, subject, body });

    await this.prisma.notificationLog.create({
      data: {
        userId,
        schoolId: user.schoolId,
        channel: 'EMAIL',
        to,
        subject,
        body,
        status: result.ok ? 'SENT' : 'FAILED',
        providerId: result.providerId ?? null,
        error: result.error ?? null,
      },
    }).catch(() => {});

    return { ok: result.ok, providerId: result.providerId ?? null, error: result.error ?? null };
  }

}

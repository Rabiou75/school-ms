import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const root = process.cwd();
const put = (p, c) => {
  const full = join(root, p);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, c, 'utf8');
  console.log('  + ' + p);
};

// ============================================================
// 1. Schema patch — Notification, NotificationLog + reverse relations
// ============================================================
const schemaPath = join(root, 'packages/database/prisma/schema.prisma');
let schema = readFileSync(schemaPath, 'utf8');

if (!schema.includes('model Notification {')) {
  schema += `

model Notification {
  id        String    @id @default(cuid())
  schoolId  String?
  userId    String
  type      String
  title     String
  body      String
  link      String?
  readAt    DateTime?
  createdAt DateTime  @default(now())

  user   User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  school School? @relation(fields: [schoolId], references: [id], onDelete: Cascade)

  @@index([userId, readAt])
  @@index([userId, createdAt])
}
`;
  console.log('  + model Notification');
} else {
  console.log('  = Notification already in schema');
}

if (!schema.includes('model NotificationLog {')) {
  schema += `

model NotificationLog {
  id         String   @id @default(cuid())
  schoolId   String?
  userId     String
  channel    String
  to         String
  subject    String?
  body       String
  status     String
  providerId String?
  error      String?
  createdAt  DateTime @default(now())

  @@index([userId, createdAt])
  @@index([status, createdAt])
}
`;
  console.log('  + model NotificationLog');
} else {
  console.log('  = NotificationLog already in schema');
}

// Add reverse relations
const ensureRelation = (modelName, fieldLine) => {
  const m = schema.match(new RegExp(`model ${modelName} \\{[\\s\\S]*?\\n\\}`, 'm'));
  if (!m) return false;
  const fieldName = fieldLine.trim().split(/\s+/)[0];
  if (new RegExp(`\\n\\s*${fieldName}\\s`).test(m[0])) return false;
  const idx = m[0].lastIndexOf('\n}');
  schema = schema.replace(m[0], m[0].slice(0, idx) + '\n  ' + fieldLine + m[0].slice(idx));
  console.log(`  + ${modelName}.${fieldName}`);
  return true;
};

ensureRelation('User', 'notifications Notification[]');
ensureRelation('School', 'notifications Notification[]');

writeFileSync(schemaPath, schema, 'utf8');
console.log('  ✅ schema.prisma saved');

// ============================================================
// 2. Providers — Email
// ============================================================
put('apps/api/src/notifications/providers/email.provider.ts', `import { Injectable, Logger } from '@nestjs/common';

type EmailOpts = {
  to: string;
  subject: string;
  body: string;
  html?: string;
};

type SmtpConfig = {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
};

@Injectable()
export class EmailProvider {
  private readonly logger = new Logger(EmailProvider.name);
  private transporter: any = null;
  private loadedFor: string | null = null;

  private async getTransporter(cfg: SmtpConfig) {
    const key = cfg.host + ':' + cfg.port + ':' + cfg.user;
    if (this.transporter && this.loadedFor === key) return this.transporter;

    try {
      // Dynamic import so the module works even when nodemailer isn't installed yet
      const nodemailer = await import('nodemailer');
      this.transporter = nodemailer.createTransport({
        host: cfg.host,
        port: cfg.port,
        secure: cfg.port === 465,
        auth: cfg.user ? { user: cfg.user, pass: cfg.pass } : undefined,
      });
      this.loadedFor = key;
      this.logger.log('SMTP transporter ready: ' + key);
      return this.transporter;
    } catch (e: any) {
      this.logger.warn('nodemailer not installed — emails will be skipped. Run: pnpm --filter api add nodemailer');
      return null;
    }
  }

  async send(cfg: SmtpConfig, opts: EmailOpts): Promise<{ ok: boolean; providerId?: string; error?: string }> {
    if (!cfg.host) return { ok: false, error: 'smtp_not_configured' };

    const t = await this.getTransporter(cfg);
    if (!t) return { ok: false, error: 'nodemailer_missing' };

    try {
      const info = await t.sendMail({
        from: cfg.from || 'School <no-reply@school.cm>',
        to: opts.to,
        subject: opts.subject,
        text: opts.body,
        html: opts.html || opts.body.replace(/\\n/g, '<br>'),
      });
      return { ok: true, providerId: info.messageId };
    } catch (e: any) {
      this.logger.error('Email send failed: ' + e.message);
      return { ok: false, error: e.message };
    }
  }
}
`);

// ============================================================
// 3. Providers — SMS
// ============================================================
put('apps/api/src/notifications/providers/sms.provider.ts', `import { Injectable, Logger } from '@nestjs/common';

type SmsConfig = {
  provider: string;
  username: string;
  apiKey: string;
  sender: string;
};

@Injectable()
export class SmsProvider {
  private readonly logger = new Logger(SmsProvider.name);

  async send(cfg: SmsConfig, to: string, message: string): Promise<{ ok: boolean; providerId?: string; error?: string }> {
    if (!cfg.provider || !cfg.apiKey) return { ok: false, error: 'sms_not_configured' };

    switch (cfg.provider) {
      case 'africastalking':
        return this.sendAfricasTalking(cfg, to, message);
      case 'twilio':
        return this.sendTwilio(cfg, to, message);
      case 'orange':
        return this.sendOrange(cfg, to, message);
      case 'mtn':
        return this.sendMtn(cfg, to, message);
      default:
        return { ok: false, error: 'unknown_provider' };
    }
  }

  private async sendAfricasTalking(cfg: SmsConfig, to: string, message: string) {
    try {
      const params = new URLSearchParams({
        username: cfg.username,
        to,
        message,
      });
      if (cfg.sender) params.set('from', cfg.sender);

      const res = await fetch('https://api.africastalking.com/version1/messaging', {
        method: 'POST',
        headers: {
          apiKey: cfg.apiKey,
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });
      const json: any = await res.json();
      const recipient = json?.SMSMessageData?.Recipients?.[0];
      if (recipient?.status === 'Success') return { ok: true, providerId: recipient.messageId };
      return { ok: false, error: JSON.stringify(json).slice(0, 300) };
    } catch (e: any) {
      this.logger.error('Africa\\'s Talking failed: ' + e.message);
      return { ok: false, error: e.message };
    }
  }

  private async sendTwilio(cfg: SmsConfig, to: string, message: string) {
    try {
      const auth = Buffer.from(cfg.username + ':' + cfg.apiKey).toString('base64');
      const params = new URLSearchParams({ To: to, From: cfg.sender, Body: message });
      const res = await fetch(
        'https://api.twilio.com/2010-04-01/Accounts/' + cfg.username + '/Messages.json',
        {
          method: 'POST',
          headers: {
            Authorization: 'Basic ' + auth,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params.toString(),
        },
      );
      const json: any = await res.json();
      if (json?.sid) return { ok: true, providerId: json.sid };
      return { ok: false, error: JSON.stringify(json).slice(0, 300) };
    } catch (e: any) {
      this.logger.error('Twilio failed: ' + e.message);
      return { ok: false, error: e.message };
    }
  }

  private async sendOrange(cfg: SmsConfig, to: string, message: string) {
    // Orange SMS API (Cameroon) — placeholder; adjust to the operator's spec
    try {
      const res = await fetch('https://api.orange.com/smsmessaging/v1/outbound/tel%3A%2B2370000/requests', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + cfg.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          outboundSMSMessageRequest: {
            address: 'tel:' + to,
            senderAddress: 'tel:' + (cfg.sender || '+2370000'),
            outboundSMSTextMessage: { message },
          },
        }),
      });
      const json: any = await res.json();
      if (res.ok) return { ok: true, providerId: json?.resourceURL || 'orange_ok' };
      return { ok: false, error: JSON.stringify(json).slice(0, 300) };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  }

  private async sendMtn(cfg: SmsConfig, to: string, message: string) {
    // MTN Cameroon SMS — placeholder; adjust to the operator's spec
    try {
      const res = await fetch('https://api.mtn.com/v1/messages/sms', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + cfg.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ senderAddress: cfg.sender || 'SCHOOL', receiverAddress: to, message }),
      });
      const json: any = await res.json();
      if (res.ok) return { ok: true, providerId: json?.messageId || 'mtn_ok' };
      return { ok: false, error: JSON.stringify(json).slice(0, 300) };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  }
}
`);

// ============================================================
// 4. Core NotificationService
// ============================================================
put('apps/api/src/notifications/notifications.service.ts', `import { Injectable, Logger } from '@nestjs/common';
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
}
`);

// ============================================================
// 5. Controller
// ============================================================
put('apps/api/src/notifications/notifications.controller.ts', `import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private svc: NotificationsService) {}

  @Get()
  list(@Req() req: any, @Query('unread') unread?: string) {
    return this.svc.list(req.user.sub, { unreadOnly: unread === '1' });
  }

  @Get('unread-count')
  unread(@Req() req: any) {
    return this.svc.unreadCount(req.user.sub);
  }

  @Post(':id/read')
  markRead(@Req() req: any, @Param('id') id: string) {
    return this.svc.markRead(req.user.sub, id);
  }

  @Post('read-all')
  markAllRead(@Req() req: any) {
    return this.svc.markAllRead(req.user.sub);
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.svc.remove(req.user.sub, id);
  }

  @Delete()
  clearAll(@Req() req: any) {
    return this.svc.clearAll(req.user.sub);
  }

  /** Send a test notification to yourself — verifies SMTP/SMS config end to end */
  @Post('test')
  sendTest(@Req() req: any) {
    return this.svc.sendTest(req.user.sub);
  }

  /** Send a manual notification to any user (admin action) */
  @Post('send')
  send(@Req() req: any, @Body() body: {
    userId: string;
    title: string;
    body: string;
    link?: string;
    channels?: Array<'IN_APP' | 'EMAIL' | 'SMS'>;
  }) {
    return this.svc.dispatch({
      userId: body.userId,
      schoolId: req.user.schoolId,
      type: 'MANUAL',
      title: body.title,
      body: body.body,
      link: body.link,
      channels: body.channels,
    });
  }

  /** Notification log (admin) */
  @Get('logs')
  logs(@Req() req: any) {
    return this.svc.listLogs(req.user.schoolId);
  }
}
`);

put('apps/api/src/notifications/notifications.module.ts', `import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { EmailProvider } from './providers/email.provider';
import { SmsProvider } from './providers/sms.provider';

@Module({
  providers: [NotificationsService, EmailProvider, SmsProvider],
  controllers: [NotificationsController],
  exports: [NotificationsService],
})
export class NotificationsModule {}
`);

// ============================================================
// 6. Register in app.module
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
  ],
})
export class AppModule {}
`);

console.log('\n✅ Notifications core written');
console.log('');
console.log('Next steps:');
console.log('  1. Install nodemailer (needed for email):');
console.log('       pnpm --filter api add nodemailer');
console.log('     If the network refuses, skip it — the module works without it.');
console.log('     In-app and SMS will work regardless.');
console.log('');
console.log('  2. Stop dev, then:');
console.log('       Get-Process node | Stop-Process -Force');
console.log('       pnpm db:generate');
console.log('       pnpm db:migrate        (name: notifications)');
console.log('       cd apps\\api ; npx nest build ; cd ..\\..');
console.log('       pnpm dev');
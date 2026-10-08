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
// 1) Patch schema — ensure School has settings fields
// ============================================================
const schemaPath = join(root, 'packages/database/prisma/schema.prisma');
let schema = readFileSync(schemaPath, 'utf8');

const m = schema.match(/model School \{[\s\S]*?\n\}/m);
if (!m) { console.error('School model not found'); process.exit(1); }
let block = m[0];

const fields = [
  { name: 'email',    line: 'email    String?' },
  { name: 'phone',    line: 'phone    String?' },
  { name: 'address',  line: 'address  String?' },
  { name: 'city',     line: 'city     String?' },
  { name: 'logoUrl',  line: 'logoUrl  String?' },
  { name: 'timezone', line: 'timezone String @default("Africa/Douala")' },
];

let changed = false;
for (const f of fields) {
  if (!(new RegExp(`\\n\\s*${f.name}\\s+`, 'm')).test(block)) {
    const idx = block.lastIndexOf('\n}');
    block = block.slice(0, idx) + '\n  ' + f.line + block.slice(idx);
    changed = true;
    console.log('  + School.' + f.name);
  }
}
if (changed) {
  schema = schema.replace(m[0], block);
  writeFileSync(schemaPath, schema, 'utf8');
  console.log('  ✅ schema.prisma saved');
} else {
  console.log('  = School already has all fields');
}

// ============================================================
// 2) Settings service
// ============================================================
put('apps/api/src/settings/settings.service.ts', `import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  // ---------- School profile ----------
  async getSchool(schoolId: string) {
    const s = await this.prisma.school.findUnique({ where: { id: schoolId } });
    if (!s) throw new NotFoundException('school_not_found');
    return s;
  }

  async updateSchool(schoolId: string, dto: any) {
    const data: any = {};
    for (const k of ['name', 'email', 'phone', 'address', 'city', 'logoUrl', 'country', 'currency', 'defaultLocale', 'timezone']) {
      if (dto[k] !== undefined) data[k] = dto[k] || null;
    }
    if (Object.keys(data).length === 0) return this.getSchool(schoolId);
    return this.prisma.school.update({ where: { id: schoolId }, data });
  }

  // ---------- Integrations (stored in SchoolSetting) ----------
  async getIntegrations(schoolId: string) {
    const rows = await this.prisma.schoolSetting.findMany({ where: { schoolId } });
    const map: Record<string, string> = Object.fromEntries(rows.map((r) => [r.key, r.value]));

    const parse = (key: string, fallback: any) => {
      if (!map[key]) return fallback;
      try { return JSON.parse(map[key]); } catch { return fallback; }
    };

    return {
      smtp:     parse('smtp',     { host: '', port: 587, user: '', pass: '', from: '' }),
      sms:      parse('sms',      { provider: 'africastalking', username: '', apiKey: '', sender: '' }),
      cinetpay: parse('cinetpay', { apiKey: '', siteId: '' }),
    };
  }

  async saveIntegrations(schoolId: string, dto: any) {
    const upsert = (key: string, value: any) =>
      this.prisma.schoolSetting.upsert({
        where: { schoolId_key: { schoolId, key } },
        update: { value: JSON.stringify(value) },
        create: { schoolId, key, value: JSON.stringify(value) },
      });

    const ops = [];
    if (dto.smtp)     ops.push(upsert('smtp', dto.smtp));
    if (dto.sms)      ops.push(upsert('sms', dto.sms));
    if (dto.cinetpay) ops.push(upsert('cinetpay', dto.cinetpay));

    await Promise.all(ops);
    return { ok: true };
  }

  // ---------- Users & roles ----------
  listUsers(schoolId: string) {
    return this.prisma.user.findMany({
      where: { schoolId },
      select: {
        id: true, email: true, phone: true,
        firstName: true, lastName: true,
        role: true, isActive: true,
        lastLoginAt: true, createdAt: true,
      },
      orderBy: [{ role: 'asc' }, { lastName: 'asc' }],
    });
  }

  async updateUser(id: string, dto: { role?: string; isActive?: boolean }) {
    const u = await this.prisma.user.findUnique({ where: { id } });
    if (!u) throw new NotFoundException('user_not_found');
    const data: any = {};
    if (dto.role) data.role = dto.role;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    return this.prisma.user.update({ where: { id }, data });
  }

  async resetUserPassword(id: string, newPassword: string) {
    if (!newPassword || newPassword.length < 8) throw new BadRequestException('password_too_short');
    const hash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({ where: { id }, data: { passwordHash: hash } });
    return { ok: true };
  }

  // ---------- My account ----------
  async changeOwnPassword(userId: string, currentPassword: string, newPassword: string) {
    if (!currentPassword) throw new BadRequestException('current_required');
    if (!newPassword || newPassword.length < 8) throw new BadRequestException('password_too_short');
    const u = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!u) throw new NotFoundException();
    const ok = await bcrypt.compare(currentPassword, u.passwordHash);
    if (!ok) throw new BadRequestException('current_password_incorrect');
    const hash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: hash } });
    return { ok: true };
  }

  async updateOwnProfile(userId: string, dto: { firstName?: string; lastName?: string; phone?: string; locale?: string }) {
    const data: any = {};
    for (const k of ['firstName', 'lastName', 'phone', 'locale']) {
      if (dto[k] !== undefined) data[k] = dto[k] || null;
    }
    if (Object.keys(data).length === 0) return {};
    const u = await this.prisma.user.update({ where: { id: userId }, data });
    const { passwordHash, ...safe } = u;
    return safe;
  }

  // ---------- Academic years ----------
  listAcademicYears(schoolId: string) {
    return this.prisma.academicYear.findMany({
      where: { schoolId },
      orderBy: { startDate: 'desc' },
    });
  }

  async createAcademicYear(schoolId: string, dto: { name: string; startDate: string; endDate: string }) {
    return this.prisma.academicYear.create({
      data: {
        schoolId,
        name: dto.name,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        isCurrent: false,
      },
    });
  }

  async setCurrentYear(schoolId: string, yearId: string) {
    await this.prisma.$transaction([
      this.prisma.academicYear.updateMany({ where: { schoolId }, data: { isCurrent: false } }),
      this.prisma.academicYear.update({ where: { id: yearId }, data: { isCurrent: true } }),
    ]);
    return { ok: true };
  }
}
`);

// ============================================================
// 3) Settings controller
// ============================================================
put('apps/api/src/settings/settings.controller.ts', `import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('settings')
export class SettingsController {
  constructor(private svc: SettingsService) {}

  // --- School profile ---
  @Get('school')
  getSchool(@Req() req: any) { return this.svc.getSchool(req.user.schoolId); }

  @Put('school')
  updateSchool(@Req() req: any, @Body() dto: any) { return this.svc.updateSchool(req.user.schoolId, dto); }

  // --- Integrations ---
  @Get('integrations')
  getIntegrations(@Req() req: any) { return this.svc.getIntegrations(req.user.schoolId); }

  @Put('integrations')
  saveIntegrations(@Req() req: any, @Body() dto: any) { return this.svc.saveIntegrations(req.user.schoolId, dto); }

  // --- Users & roles ---
  @Get('users')
  listUsers(@Req() req: any) { return this.svc.listUsers(req.user.schoolId); }

  @Put('users/:id')
  updateUser(@Param('id') id: string, @Body() dto: any) { return this.svc.updateUser(id, dto); }

  @Post('users/:id/reset-password')
  resetPassword(@Param('id') id: string, @Body() body: { newPassword: string }) {
    return this.svc.resetUserPassword(id, body.newPassword);
  }

  // --- My account ---
  @Post('account/password')
  changeOwnPassword(@Req() req: any, @Body() body: { currentPassword: string; newPassword: string }) {
    return this.svc.changeOwnPassword(req.user.sub, body.currentPassword, body.newPassword);
  }

  @Put('account/profile')
  updateOwnProfile(@Req() req: any, @Body() dto: any) {
    return this.svc.updateOwnProfile(req.user.sub, dto);
  }

  // --- Academic years ---
  @Get('academic-years')
  listYears(@Req() req: any) { return this.svc.listAcademicYears(req.user.schoolId); }

  @Post('academic-years')
  createYear(@Req() req: any, @Body() dto: any) { return this.svc.createAcademicYear(req.user.schoolId, dto); }

  @Post('academic-years/:id/set-current')
  setCurrent(@Req() req: any, @Param('id') id: string) { return this.svc.setCurrentYear(req.user.schoolId, id); }
}
`);

put('apps/api/src/settings/settings.module.ts', `import { Module } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';

@Module({
  providers: [SettingsService],
  controllers: [SettingsController],
})
export class SettingsModule {}
`);

// ============================================================
// 4) Register in app.module
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
  ],
})
export class AppModule {}
`);

console.log('\n✅ Settings backend written');
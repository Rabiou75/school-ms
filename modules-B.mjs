import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const root = process.cwd();
const put = (p, c) => {
  const full = join(root, p);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, c, 'utf8');
  console.log('  + ' + p);
};
const L = (a) => a.join('\n');

// ============ PAYROLL ============
put('apps/api/src/payroll/payroll.service.ts', L([
  "import { BadRequestException, Injectable } from '@nestjs/common';",
  "import { PrismaService } from '../prisma/prisma.service';",
  "",
  "@Injectable()",
  "export class PayrollService {",
  "  constructor(private prisma: PrismaService) {}",
  "",
  "  list(schoolId: string, year: number, month: number) {",
  "    return this.prisma.payrollItem.findMany({",
  "      where: { schoolId, year, month },",
  "      include: { staff: { select: { id: true, firstName: true, lastName: true, position: true, employeeNo: true } } },",
  "      orderBy: { staff: { lastName: 'asc' } },",
  "    });",
  "  }",
  "",
  "  async generate(schoolId: string, year: number, month: number, extraDeductions: Record<string, number> = {}) {",
  "    if (month < 1 || month > 12) throw new BadRequestException('invalid_month');",
  "    const existing = await this.prisma.payrollItem.count({ where: { schoolId, year, month } });",
  "    if (existing > 0) throw new BadRequestException('payroll_already_generated');",
  "    const staff = await this.prisma.staff.findMany({ where: { schoolId, isActive: true } });",
  "    if (staff.length === 0) throw new BadRequestException('no_active_staff');",
  "    const items = staff.map((s) => {",
  "      const gross = s.baseSalary;",
  "      const ded = Number(extraDeductions[s.id]) || 0;",
  "      return { schoolId, staffId: s.id, month, year, grossPay: gross, deductions: ded, netPay: Math.max(0, gross - ded) };",
  "    });",
  "    await this.prisma.$transaction(items.map((it) => this.prisma.payrollItem.create({ data: it })));",
  "    return { created: items.length, total: items.reduce((a, i) => a + i.netPay, 0) };",
  "  }",
  "",
  "  async markPaid(id: string) {",
  "    return this.prisma.payrollItem.update({ where: { id }, data: { paidAt: new Date() } });",
  "  }",
  "",
  "  async markAllPaid(schoolId: string, year: number, month: number) {",
  "    const r = await this.prisma.payrollItem.updateMany({",
  "      where: { schoolId, year, month, paidAt: null },",
  "      data: { paidAt: new Date() },",
  "    });",
  "    return { updated: r.count };",
  "  }",
  "",
  "  async updateItem(id: string, dto: { deductions?: number; notes?: string }) {",
  "    const item = await this.prisma.payrollItem.findUnique({ where: { id } });",
  "    if (!item) throw new BadRequestException('item_not_found');",
  "    const data: any = {};",
  "    if (dto.deductions !== undefined) {",
  "      data.deductions = Number(dto.deductions);",
  "      data.netPay = Math.max(0, item.grossPay - Number(dto.deductions));",
  "    }",
  "    if (dto.notes !== undefined) data.notes = dto.notes || null;",
  "    return this.prisma.payrollItem.update({ where: { id }, data });",
  "  }",
  "",
  "  async remove(id: string) {",
  "    await this.prisma.payrollItem.delete({ where: { id } });",
  "    return { ok: true };",
  "  }",
  "}",
  ""
]));

put('apps/api/src/payroll/payroll.controller.ts', L([
  "import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';",
  "import { PayrollService } from './payroll.service';",
  "import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';",
  "",
  "@UseGuards(JwtAuthGuard)",
  "@Controller('payroll')",
  "export class PayrollController {",
  "  constructor(private svc: PayrollService) {}",
  "",
  "  @Get()",
  "  list(@Req() req: any, @Query('year') year: string, @Query('month') month: string) {",
  "    const y = Number(year) || new Date().getFullYear();",
  "    const m = Number(month) || new Date().getMonth() + 1;",
  "    return this.svc.list(req.user.schoolId, y, m);",
  "  }",
  "",
  "  @Post('generate')",
  "  generate(@Req() req: any, @Body() body: { year: number; month: number; deductions?: Record<string, number> }) {",
  "    return this.svc.generate(req.user.schoolId, Number(body.year), Number(body.month), body.deductions || {});",
  "  }",
  "",
  "  @Post(':id/pay')",
  "  markPaid(@Param('id') id: string) { return this.svc.markPaid(id); }",
  "",
  "  @Post('pay-all')",
  "  markAllPaid(@Req() req: any, @Body() body: { year: number; month: number }) {",
  "    return this.svc.markAllPaid(req.user.schoolId, Number(body.year), Number(body.month));",
  "  }",
  "",
  "  @Put(':id')",
  "  update(@Param('id') id: string, @Body() dto: any) { return this.svc.updateItem(id, dto); }",
  "",
  "  @Delete(':id')",
  "  remove(@Param('id') id: string) { return this.svc.remove(id); }",
  "}",
  ""
]));

put('apps/api/src/payroll/payroll.module.ts', L([
  "import { Module } from '@nestjs/common';",
  "import { PayrollService } from './payroll.service';",
  "import { PayrollController } from './payroll.controller';",
  "",
  "@Module({ providers: [PayrollService], controllers: [PayrollController] })",
  "export class PayrollModule {}",
  ""
]));

// ============ BULK IMPORT ============
put('apps/api/src/bulk-import/bulk-import.service.ts', L([
  "import { BadRequestException, Injectable, Logger } from '@nestjs/common';",
  "import * as bcrypt from 'bcryptjs';",
  "import { PrismaService } from '../prisma/prisma.service';",
  "",
  "@Injectable()",
  "export class BulkImportService {",
  "  private readonly logger = new Logger(BulkImportService.name);",
  "  constructor(private prisma: PrismaService) {}",
  "",
  "  private normGender(g?: string): 'MALE' | 'FEMALE' | 'OTHER' {",
  "    const v = (g || 'MALE').toUpperCase().trim();",
  "    if (v.startsWith('F') || v === 'FEMME') return 'FEMALE';",
  "    if (v.startsWith('M') || v === 'HOMME') return 'MALE';",
  "    return 'OTHER';",
  "  }",
  "",
  "  async importStudents(schoolId: string, rows: any[]) {",
  "    if (!Array.isArray(rows) || rows.length === 0) throw new BadRequestException('no_rows');",
  "    if (rows.length > 2000) throw new BadRequestException('too_many_rows_max_2000');",
  "    const classes = await this.prisma.class.findMany({ where: { schoolId } });",
  "    const classByName = new Map(classes.map((c) => [c.name.toLowerCase().trim(), c.id]));",
  "    const results = { created: 0, skipped: 0, errors: [] as any[], parentAccountsCreated: 0 };",
  "",
  "    for (let i = 0; i < rows.length; i++) {",
  "      const row = rows[i];",
  "      try {",
  "        if (!row.firstName || !row.lastName) {",
  "          results.errors.push({ row: i + 1, reason: 'missing_name' });",
  "          continue;",
  "        }",
  "        let admissionNo = (row.admissionNo || '').trim();",
  "        if (!admissionNo) {",
  "          const prefix = 'STU-' + new Date().getFullYear() + '-';",
  "          const last = await this.prisma.student.findFirst({",
  "            where: { schoolId, admissionNo: { startsWith: prefix } },",
  "            orderBy: { admissionNo: 'desc' },",
  "          });",
  "          const n = last ? parseInt(last.admissionNo.slice(prefix.length), 10) + 1 : 1;",
  "          admissionNo = prefix + String(n).padStart(4, '0');",
  "        }",
  "        const exists = await this.prisma.student.findUnique({",
  "          where: { schoolId_admissionNo: { schoolId, admissionNo } },",
  "        });",
  "        if (exists) {",
  "          results.skipped++;",
  "          results.errors.push({ row: i + 1, reason: 'duplicate_admission_no' });",
  "          continue;",
  "        }",
  "        let guardianId: string | null = null;",
  "        if (row.guardianFirstName && row.guardianPhone) {",
  "          const g = await this.prisma.guardian.findFirst({",
  "            where: { schoolId, firstName: row.guardianFirstName, phone: row.guardianPhone },",
  "          });",
  "          if (g) guardianId = g.id;",
  "          else {",
  "            const created = await this.prisma.guardian.create({",
  "              data: {",
  "                schoolId,",
  "                firstName: row.guardianFirstName,",
  "                lastName: row.guardianLastName || row.lastName,",
  "                relation: row.guardianRelation || 'Pere',",
  "                phone: row.guardianPhone,",
  "              },",
  "            });",
  "            guardianId = created.id;",
  "          }",
  "        }",
  "        const classId = row.className ? classByName.get(row.className.toLowerCase().trim()) ?? null : null;",
  "        const dob = row.dateOfBirth ? new Date(row.dateOfBirth) : new Date(2010, 0, 1);",
  "        await this.prisma.student.create({",
  "          data: {",
  "            schoolId,",
  "            admissionNo,",
  "            firstName: row.firstName.trim(),",
  "            lastName: row.lastName.trim(),",
  "            gender: this.normGender(row.gender),",
  "            dateOfBirth: isNaN(dob.getTime()) ? new Date(2010, 0, 1) : dob,",
  "            classId,",
  "            guardianId,",
  "            phone: row.phone?.trim() || null,",
  "            email: row.email?.trim() || null,",
  "          },",
  "        });",
  "        results.created++;",
  "      } catch (e: any) {",
  "        results.errors.push({ row: i + 1, reason: e.message || 'unknown' });",
  "      }",
  "    }",
  "    return results;",
  "  }",
  "",
  "  async previewStudents(schoolId: string, rows: any[]) {",
  "    const classes = await this.prisma.class.findMany({ where: { schoolId } });",
  "    const classByName = new Map(classes.map((c) => [c.name.toLowerCase().trim(), c.name]));",
  "    return rows.map((r, i) => {",
  "      const issues: string[] = [];",
  "      if (!r.firstName) issues.push('missing firstName');",
  "      if (!r.lastName) issues.push('missing lastName');",
  "      if (r.className && !classByName.has(r.className.toLowerCase().trim())) issues.push('unknown class: ' + r.className);",
  "      return { row: i + 1, input: r, issues, willCreate: issues.length === 0 };",
  "    });",
  "  }",
  "",
  "  async generateParentAccounts(schoolId: string) {",
  "    const guardians = await this.prisma.guardian.findMany({",
  "      where: { schoolId, userId: null },",
  "      include: { students: { where: { isActive: true }, select: { id: true } } },",
  "    });",
  "    const generated: any[] = [];",
  "    const skipped: any[] = [];",
  "    for (const g of guardians) {",
  "      try {",
  "        if (!g.phone) { skipped.push({ guardian: g.firstName + ' ' + g.lastName, reason: 'no_phone' }); continue; }",
  "        const base = (g.firstName + '.' + g.lastName).toLowerCase().replace(/[^a-z0-9]/g, '');",
  "        const suffix = (g.phone || '').replace(/\\D/g, '').slice(-4) || String(Math.floor(Math.random() * 9000) + 1000);",
  "        let email = base + suffix + '@school.local';",
  "        let attempt = 0;",
  "        while (await this.prisma.user.findUnique({ where: { email } })) {",
  "          attempt++;",
  "          email = base + suffix + '-' + attempt + '@school.local';",
  "          if (attempt > 5) throw new Error('could_not_generate_unique_email');",
  "        }",
  "        const rawPw = this.generatePassword();",
  "        const hash = await bcrypt.hash(rawPw, 10);",
  "        const user = await this.prisma.user.create({",
  "          data: {",
  "            schoolId,",
  "            email,",
  "            passwordHash: hash,",
  "            firstName: g.firstName,",
  "            lastName: g.lastName,",
  "            phone: g.phone,",
  "            role: 'PARENT',",
  "            locale: 'fr',",
  "          },",
  "        });",
  "        await this.prisma.guardian.update({ where: { id: g.id }, data: { userId: user.id } });",
  "        generated.push({ guardian: g.firstName + ' ' + g.lastName, email, password: rawPw, childCount: g.students.length });",
  "      } catch (e: any) {",
  "        skipped.push({ guardian: g.firstName + ' ' + g.lastName, reason: e.message });",
  "      }",
  "    }",
  "    return { generated, skipped, totalGuardiansWithoutAccount: guardians.length };",
  "  }",
  "",
  "  private generatePassword(): string {",
  "    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';",
  "    let s = '';",
  "    for (let i = 0; i < 10; i++) s += chars[Math.floor(Math.random() * chars.length)];",
  "    return s;",
  "  }",
  "}",
  ""
]));

put('apps/api/src/bulk-import/bulk-import.controller.ts', L([
  "import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';",
  "import { BulkImportService } from './bulk-import.service';",
  "import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';",
  "",
  "@UseGuards(JwtAuthGuard)",
  "@Controller('bulk-import')",
  "export class BulkImportController {",
  "  constructor(private svc: BulkImportService) {}",
  "",
  "  @Post('students/preview')",
  "  preview(@Req() req: any, @Body() body: { rows: any[] }) {",
  "    return this.svc.previewStudents(req.user.schoolId, body.rows || []);",
  "  }",
  "",
  "  @Post('students')",
  "  importStudents(@Req() req: any, @Body() body: { rows: any[] }) {",
  "    return this.svc.importStudents(req.user.schoolId, body.rows || []);",
  "  }",
  "",
  "  @Post('parents/generate')",
  "  generateParents(@Req() req: any) {",
  "    return this.svc.generateParentAccounts(req.user.schoolId);",
  "  }",
  "}",
  ""
]));

put('apps/api/src/bulk-import/bulk-import.module.ts', L([
  "import { Module } from '@nestjs/common';",
  "import { BulkImportService } from './bulk-import.service';",
  "import { BulkImportController } from './bulk-import.controller';",
  "",
  "@Module({ providers: [BulkImportService], controllers: [BulkImportController] })",
  "export class BulkImportModule {}",
  ""
]));

// ============ REGISTER IN APP MODULE ============
const appMod = `import { Module } from '@nestjs/common';
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
import { StudentPortalModule } from './student-portal/student-portal.module';
import { TimetableModule } from './timetable/timetable.module';
import { LibraryModule } from './library/library.module';
import { PayrollModule } from './payroll/payroll.module';
import { BulkImportModule } from './bulk-import/bulk-import.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
    PrismaModule, AuthModule, StudentsModule, FinanceModule,
    AttendanceModule, ClassesModule, ExamsModule, DashboardModule,
    StaffModule, SubjectsModule, ParentModule, GuardiansModule,
    PaymentsModule, SettingsModule, NotificationsModule,
    AnnouncementsModule, StudentPortalModule,
    TimetableModule, LibraryModule, PayrollModule, BulkImportModule,
  ],
})
export class AppModule {}
`;
writeFileSync(join(root, 'apps/api/src/app.module.ts'), appMod, 'utf8');
console.log('  + apps/api/src/app.module.ts (all 20 modules)');

console.log('\n✅ Payroll + Bulk import + app.module written');
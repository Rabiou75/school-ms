import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

const root = process.cwd();
const put = (p, c) => {
  const full = join(root, p);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, c, 'utf8');
  console.log('  + ' + p);
};
const L = (a) => a.join('\n');

// ============================================================
// 1. Add version constants to @school/shared
// ============================================================
put('packages/shared/src/constants.ts', L([
  "export const SUPPORTED_LOCALES = ['en', 'fr', 'ar'] as const;",
  "export type Locale = (typeof SUPPORTED_LOCALES)[number];",
  "export const DEFAULT_LOCALE: Locale = 'fr';",
  "export const CURRENCY = 'XAF';",
  "export const RTL_LOCALES: Locale[] = ['ar'];",
  "",
  "export const APP_NAME = 'School MS';",
  "export const APP_VERSION = '1.1.0';",
  "export const APP_BUILD_DATE = '2026-10-13';",
  "export const APP_LICENSE = 'Proprietary';",
  "export const APP_GITHUB = 'https://github.com/Rabiou75/school-ms';",
  "export const APP_SUPPORT_EMAIL = 'support@school-ms.local';",
  "",
  "export const formatXAF = (amount: number, locale: Locale = 'fr'): string =>",
  "  new Intl.NumberFormat(locale === 'ar' ? 'ar-CM' : `${locale}-CM`, {",
  "    style: 'currency',",
  "    currency: 'XAF',",
  "    maximumFractionDigits: 0,",
  "  }).format(amount);",
  ""
]));

// ============================================================
// 2. Backend system module
// ============================================================
put('apps/api/src/system/system.service.ts', L([
  "import { Injectable } from '@nestjs/common';",
  "import { PrismaService } from '../prisma/prisma.service';",
  "import { APP_BUILD_DATE, APP_LICENSE, APP_NAME, APP_VERSION } from '@school/shared';",
  "",
  "@Injectable()",
  "export class SystemService {",
  "  constructor(private prisma: PrismaService) {}",
  "",
  "  async about(schoolId: string) {",
  "    const [",
  "      students, users, staff, guardians, classes, subjects,",
  "      invoices, payments, attendance, marks, announcements,",
  "    ] = await Promise.all([",
  "      this.prisma.student.count({ where: { schoolId } }),",
  "      this.prisma.user.count({ where: { schoolId } }),",
  "      this.prisma.staff.count({ where: { schoolId } }),",
  "      this.prisma.guardian.count({ where: { schoolId } }),",
  "      this.prisma.class.count({ where: { schoolId } }),",
  "      this.prisma.subject.count({ where: { schoolId } }),",
  "      this.prisma.invoice.count({ where: { schoolId } }),",
  "      this.prisma.payment.count({ where: { schoolId } }),",
  "      this.prisma.attendance.count({ where: { student: { schoolId } } }),",
  "      this.prisma.mark.count({ where: { student: { schoolId } } }),",
  "      this.prisma.announcement.count({ where: { schoolId } }),",
  "    ]);",
  "",
  "    let dbSize = 'unknown';",
  "    try {",
  "      const res: any = await this.prisma.$queryRaw`",
  "        SELECT pg_size_pretty(pg_database_size(current_database())) AS size",
  "      `;",
  "      dbSize = res?.[0]?.size ?? 'unknown';",
  "    } catch {}",
  "",
  "    const uptimeSec = Math.floor(process.uptime());",
  "",
  "    return {",
  "      name: APP_NAME,",
  "      version: APP_VERSION,",
  "      buildDate: APP_BUILD_DATE,",
  "      license: APP_LICENSE,",
  "      platform: process.platform,",
  "      nodeVersion: process.version,",
  "      uptimeSeconds: uptimeSec,",
  "      databaseSize: dbSize,",
  "      counts: {",
  "        students, users, staff, guardians, classes, subjects,",
  "        invoices, payments, attendance, marks, announcements,",
  "      },",
  "    };",
  "  }",
  "}",
  ""
]));

put('apps/api/src/system/system.controller.ts', L([
  "import { Controller, Get, Req, UseGuards } from '@nestjs/common';",
  "import { SystemService } from './system.service';",
  "import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';",
  "",
  "@UseGuards(JwtAuthGuard)",
  "@Controller('system')",
  "export class SystemController {",
  "  constructor(private svc: SystemService) {}",
  "",
  "  @Get('about')",
  "  about(@Req() req: any) {",
  "    return this.svc.about(req.user.schoolId);",
  "  }",
  "}",
  ""
]));

put('apps/api/src/system/system.module.ts', L([
  "import { Module } from '@nestjs/common';",
  "import { SystemService } from './system.service';",
  "import { SystemController } from './system.controller';",
  "",
  "@Module({",
  "  providers: [SystemService],",
  "  controllers: [SystemController],",
  "})",
  "export class SystemModule {}",
  ""
]));

// ============================================================
// 3. Register SystemModule in app.module
// ============================================================
{
  const p = join(root, 'apps/api/src/app.module.ts');
  let s = readFileSync(p, 'utf8');
  if (!s.includes('SystemModule')) {
    s = s.replace(
      "import { BulkImportModule } from './bulk-import/bulk-import.module';",
      "import { BulkImportModule } from './bulk-import/bulk-import.module';\nimport { SystemModule } from './system/system.module';"
    );
    s = s.replace(
      "    TimetableModule, LibraryModule, PayrollModule, BulkImportModule,",
      "    TimetableModule, LibraryModule, PayrollModule, BulkImportModule,\n    SystemModule,"
    );
    writeFileSync(p, s, 'utf8');
    console.log('  + app.module.ts — SystemModule registered');
  } else {
    console.log('  = app.module.ts already has SystemModule');
  }
}

// ============================================================
// 4. Bump versions in package.json files
// ============================================================
for (const rel of ['package.json', 'desktop/package.json']) {
  const p = join(root, rel);
  if (!existsSync(p)) continue;
  const pkg = JSON.parse(readFileSync(p, 'utf8'));
  pkg.version = '1.1.0';
  writeFileSync(p, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
  console.log('  + ' + rel + ' -> version 1.1.0');
}

console.log('\nOK add-about-backend.mjs done');
console.log('');
console.log('Next:');
console.log('  pnpm --filter @school/shared build');
console.log('  cd apps\\api && npx nest build && cd ..\\..');
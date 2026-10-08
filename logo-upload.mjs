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

// 1. Backend — upload endpoint
put('apps/api/src/settings/logo.controller.ts', L([
  "import { Controller, Post, Req, UploadedFile, UseGuards, UseInterceptors, BadRequestException } from '@nestjs/common';",
  "import { FileInterceptor } from '@nestjs/platform-express';",
  "import { diskStorage } from 'multer';",
  "import { extname, join } from 'node:path';",
  "import { existsSync, mkdirSync } from 'node:fs';",
  "import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';",
  "import { PrismaService } from '../prisma/prisma.service';",
  "",
  "const UPLOAD_DIR = join(process.cwd(), 'uploads', 'logos');",
  "if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });",
  "",
  "@UseGuards(JwtAuthGuard)",
  "@Controller('settings/logo')",
  "export class LogoController {",
  "  constructor(private prisma: PrismaService) {}",
  "",
  "  @Post()",
  "  @UseInterceptors(FileInterceptor('file', {",
  "    storage: diskStorage({",
  "      destination: UPLOAD_DIR,",
  "      filename: (_req, file, cb) => {",
  "        const ext = extname(file.originalname).toLowerCase();",
  "        const name = 'logo-' + Date.now() + ext;",
  "        cb(null, name);",
  "      },",
  "    }),",
  "    limits: { fileSize: 2 * 1024 * 1024 },",
  "    fileFilter: (_req, file, cb) => {",
  "      const ok = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(file.mimetype);",
  "      cb(ok ? null : new BadRequestException('invalid_file_type'), ok);",
  "    },",
  "  }))",
  "  async upload(@Req() req: any, @UploadedFile() file: any) {",
  "    if (!file) throw new BadRequestException('no_file');",
  "    const publicUrl = '/uploads/logos/' + file.filename;",
  "    await this.prisma.school.update({",
  "      where: { id: req.user.schoolId },",
  "      data: { logoUrl: publicUrl },",
  "    });",
  "    return { ok: true, logoUrl: publicUrl };",
  "  }",
  "}",
  ""
]));

// 2. Register in app.module
put('apps/api/src/app.module.ts', L([
  "import { Module } from '@nestjs/common';",
  "import { ConfigModule } from '@nestjs/config';",
  "import { PrismaModule } from './prisma/prisma.module';",
  "import { AuthModule } from './auth/auth.module';",
  "import { StudentsModule } from './students/students.module';",
  "import { FinanceModule } from './finance/finance.module';",
  "import { AttendanceModule } from './attendance/attendance.module';",
  "import { ClassesModule } from './classes/classes.module';",
  "import { ExamsModule } from './exams/exams.module';",
  "import { DashboardModule } from './dashboard/dashboard.module';",
  "import { StaffModule } from './staff/staff.module';",
  "import { SubjectsModule } from './subjects/subjects.module';",
  "import { ParentModule } from './parent/parent.module';",
  "import { GuardiansModule } from './guardians/guardians.module';",
  "import { PaymentsModule } from './payments/payments.module';",
  "import { SettingsModule } from './settings/settings.module';",
  "import { NotificationsModule } from './notifications/notifications.module';",
  "import { AnnouncementsModule } from './announcements/announcements.module';",
  "import { StudentPortalModule } from './student-portal/student-portal.module';",
  "import { TimetableModule } from './timetable/timetable.module';",
  "import { LibraryModule } from './library/library.module';",
  "import { PayrollModule } from './payroll/payroll.module';",
  "import { BulkImportModule } from './bulk-import/bulk-import.module';",
  "import { LogoController } from './settings/logo.controller';",
  "",
  "@Module({",
  "  imports: [",
  "    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),",
  "    PrismaModule, AuthModule, StudentsModule, FinanceModule,",
  "    AttendanceModule, ClassesModule, ExamsModule, DashboardModule,",
  "    StaffModule, SubjectsModule, ParentModule, GuardiansModule,",
  "    PaymentsModule, SettingsModule, NotificationsModule,",
  "    AnnouncementsModule, StudentPortalModule,",
  "    TimetableModule, LibraryModule, PayrollModule, BulkImportModule,",
  "  ],",
  "  controllers: [LogoController],",
  "})",
  "export class AppModule {}",
  ""
]));

// 3. Serve uploads folder as static
put('apps/api/src/main.ts', L([
  "import 'reflect-metadata';",
  "import { NestFactory } from '@nestjs/core';",
  "import { NestExpressApplication } from '@nestjs/platform-express';",
  "import { join } from 'node:path';",
  "import { existsSync, mkdirSync } from 'node:fs';",
  "import { AppModule } from './app.module';",
  "",
  "async function bootstrap() {",
  "  const app = await NestFactory.create<NestExpressApplication>(AppModule, { cors: true });",
  "  app.setGlobalPrefix('api/v1', { exclude: ['uploads/(.*)'] });",
  "  const uploadsDir = join(process.cwd(), 'uploads');",
  "  if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true });",
  "  app.useStaticAssets(uploadsDir, { prefix: '/uploads' });",
  "  const port = process.env.API_PORT || 4000;",
  "  await app.listen(port);",
  "  console.log('API on http://localhost:' + port + '/api/v1');",
  "}",
  "bootstrap();",
  ""
]));

// 4. Install multer types
console.log('\\n✅ Logo upload backend written');
console.log('\\nNext:');
console.log('  pnpm --filter api add -D @types/multer');
console.log('  cd apps\\\\api ; npx nest build ; cd ..\\\\..');
console.log('  .\\\\kill-dev.ps1 ; pnpm dev');
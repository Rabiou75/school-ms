import { Module } from '@nestjs/common';
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
import { LogoController } from './settings/logo.controller';

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
  controllers: [LogoController],
})
export class AppModule {}

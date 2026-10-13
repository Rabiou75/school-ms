import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { APP_BUILD_DATE, APP_LICENSE, APP_NAME, APP_VERSION } from '@school/shared';

@Injectable()
export class SystemService {
  constructor(private prisma: PrismaService) {}

  async about(schoolId: string) {
    const [
      students, users, staff, guardians, classes, subjects,
      invoices, payments, attendance, marks, announcements,
    ] = await Promise.all([
      this.prisma.student.count({ where: { schoolId } }),
      this.prisma.user.count({ where: { schoolId } }),
      this.prisma.staff.count({ where: { schoolId } }),
      this.prisma.guardian.count({ where: { schoolId } }),
      this.prisma.class.count({ where: { schoolId } }),
      this.prisma.subject.count({ where: { schoolId } }),
      this.prisma.invoice.count({ where: { schoolId } }),
      this.prisma.payment.count({ where: { schoolId } }),
      this.prisma.attendance.count({ where: { student: { schoolId } } }),
      this.prisma.mark.count({ where: { student: { schoolId } } }),
      this.prisma.announcement.count({ where: { schoolId } }),
    ]);

    let dbSize = 'unknown';
    try {
      const res: any = await this.prisma.$queryRaw`
        SELECT pg_size_pretty(pg_database_size(current_database())) AS size
      `;
      dbSize = res?.[0]?.size ?? 'unknown';
    } catch {}

    const uptimeSec = Math.floor(process.uptime());

    return {
      name: APP_NAME,
      version: APP_VERSION,
      buildDate: APP_BUILD_DATE,
      license: APP_LICENSE,
      platform: process.platform,
      nodeVersion: process.version,
      uptimeSeconds: uptimeSec,
      databaseSize: dbSize,
      counts: {
        students, users, staff, guardians, classes, subjects,
        invoices, payments, attendance, marks, announcements,
      },
    };
  }
}

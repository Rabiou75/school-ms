import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { APP_BUILD_DATE, APP_LICENSE, APP_NAME, APP_VERSION } from '@school/shared';

@Injectable()
export class SystemService {
  constructor(private prisma: PrismaService) {}

  /** True when no school has been created yet. Used by the desktop wizard. */
  async needsSetup(): Promise<boolean> {
    const count = await this.prisma.school.count();
    return count === 0;
  }

  async setup(dto: any) {
    const name = (dto.schoolName || '').trim();
    const adminEmail = (dto.adminEmail || '').trim().toLowerCase();
    const adminPassword = dto.adminPassword || '';
    const adminFirstName = (dto.adminFirstName || 'Admin').trim();
    const adminLastName = (dto.adminLastName || 'Admin').trim();
    const currency = dto.currency || 'XAF';
    const defaultLocale = dto.defaultLocale || 'fr';
    const country = dto.country || 'CM';

    if (!name) throw new BadRequestException('school_name_required');
    if (!adminEmail) throw new BadRequestException('admin_email_required');
    if (!adminPassword || adminPassword.length < 8)
      throw new BadRequestException('password_too_short');

    if (!(await this.needsSetup())) throw new BadRequestException('already_setup');

    const existing = await this.prisma.user.findUnique({ where: { email: adminEmail } });
    if (existing) throw new ConflictException('email_already_registered');

    const slug = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'school';

    const passwordHash = await bcrypt.hash(adminPassword, 10);

    const result = await this.prisma.$transaction(async (tx) => {
      const school = await tx.school.create({
        data: { name, slug, currency, defaultLocale, country },
      });

      const admin = await tx.user.create({
        data: {
          schoolId: school.id,
          email: adminEmail,
          passwordHash,
          firstName: adminFirstName,
          lastName: adminLastName,
          role: 'SUPER_ADMIN',
          locale: defaultLocale,
        },
      });

      // Default academic year: Sept to July, rolling
      const now = new Date();
      const startYear = now.getMonth() < 8 ? now.getFullYear() - 1 : now.getFullYear();
      await tx.academicYear.create({
        data: {
          schoolId: school.id,
          name: startYear + '-' + (startYear + 1),
          startDate: new Date(startYear, 8, 1),
          endDate: new Date(startYear + 1, 6, 31),
          isCurrent: true,
        },
      });

      return { school, admin };
    });

    return {
      ok: true,
      schoolId: result.school.id,
      schoolName: result.school.name,
      adminEmail: result.admin.email,
    };
  }

  /** Quick demo setup — creates a demo school without the wizard. */
  async setupDemo() {
    if (!(await this.needsSetup())) throw new BadRequestException('already_setup');
    return this.setup({
      schoolName: 'Demo Bilingual School',
      adminEmail: 'admin@demo-school.cm',
      adminPassword: 'Admin@1234',
      adminFirstName: 'Super',
      adminLastName: 'Admin',
      currency: 'XAF',
      defaultLocale: 'fr',
      country: 'CM',
    });
  }

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

    return {
      name: APP_NAME,
      version: APP_VERSION,
      buildDate: APP_BUILD_DATE,
      license: APP_LICENSE,
      platform: process.platform,
      nodeVersion: process.version,
      uptimeSeconds: Math.floor(process.uptime()),
      databaseSize: dbSize,
      counts: {
        students, users, staff, guardians, classes, subjects,
        invoices, payments, attendance, marks, announcements,
      },
    };
  }
}

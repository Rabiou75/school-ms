import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
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
    const map: Record<string, string> = Object.fromEntries(
      rows.map((r: { key: string; value: string }) => [r.key, r.value]),
    );

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
        firstName: true, lastName: true, locale: true,
        role: true, isActive: true,
        lastLoginAt: true, createdAt: true,
      },
      orderBy: [{ role: 'asc' }, { lastName: 'asc' }],
    });
  }

  async createUser(schoolId: string, dto: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role: string;
    phone?: string;
    locale?: string;
  }) {
    if (!dto.email) throw new BadRequestException('email_required');
    if (!dto.password || dto.password.length < 8) throw new BadRequestException('password_too_short');
    if (!dto.firstName || !dto.lastName) throw new BadRequestException('name_required');

    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('email_already_registered');

    const hash = await bcrypt.hash(dto.password, 10);
    const u = await this.prisma.user.create({
      data: {
        schoolId,
        email: dto.email,
        passwordHash: hash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: dto.role as any,
        phone: dto.phone || null,
        locale: dto.locale || 'fr',
      },
    });
    const { passwordHash, ...safe } = u;
    return safe;
  }

  async updateUser(id: string, dto: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    role?: string;
    isActive?: boolean;
    locale?: string;
  }, currentUserId: string) {
    const u = await this.prisma.user.findUnique({ where: { id } });
    if (!u) throw new NotFoundException('user_not_found');

    // Guardrail: cannot demote yourself from SUPER_ADMIN
    if (u.id === currentUserId && u.role === 'SUPER_ADMIN' && dto.role && dto.role !== 'SUPER_ADMIN') {
      throw new BadRequestException('cannot_demote_self');
    }
    // Guardrail: cannot deactivate yourself
    if (u.id === currentUserId && dto.isActive === false) {
      throw new BadRequestException('cannot_deactivate_self');
    }
    // Guardrail: cannot demote the last active SUPER_ADMIN
    if (u.role === 'SUPER_ADMIN' && dto.role && dto.role !== 'SUPER_ADMIN') {
      const count = await this.prisma.user.count({
        where: { schoolId: u.schoolId, role: 'SUPER_ADMIN', isActive: true },
      });
      if (count <= 1) throw new BadRequestException('last_super_admin');
    }

    const data: any = {};
    if (dto.firstName !== undefined) data.firstName = dto.firstName;
    if (dto.lastName !== undefined) data.lastName = dto.lastName;
    if (dto.phone !== undefined) data.phone = dto.phone || null;
    if (dto.role !== undefined) data.role = dto.role;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.locale !== undefined) data.locale = dto.locale;

    if (dto.email !== undefined && dto.email !== u.email) {
      const dup = await this.prisma.user.findUnique({ where: { email: dto.email } });
      if (dup) throw new ConflictException('email_already_registered');
      data.email = dto.email;
    }

    const updated = await this.prisma.user.update({ where: { id }, data });
    const { passwordHash, ...safe } = updated;
    return safe;
  }

  async deleteUser(id: string, currentUserId: string) {
    if (id === currentUserId) throw new BadRequestException('cannot_delete_self');

    const u = await this.prisma.user.findUnique({ where: { id } });
    if (!u) throw new NotFoundException('user_not_found');

    if (u.role === 'SUPER_ADMIN') {
      const count = await this.prisma.user.count({
        where: { schoolId: u.schoolId, role: 'SUPER_ADMIN', isActive: true },
      });
      if (count <= 1) throw new BadRequestException('last_super_admin');
    }

    // Check for linked records that would block a hard delete
    const [guardians, staff, students] = await Promise.all([
      this.prisma.guardian.count({ where: { userId: id } }),
      this.prisma.staff.count({ where: { userId: id } }),
      this.prisma.student.count({ where: { userId: id } }),
    ]);

    if (guardians + staff + students > 0) {
      // Cannot hard-delete — deactivate instead so history is preserved
      await this.prisma.user.update({ where: { id }, data: { isActive: false } });
      return {
        ok: true,
        mode: 'deactivated',
        reason: 'has_linked_records',
        linked: { guardians, staff, students },
      };
    }

    await this.prisma.user.delete({ where: { id } });
    return { ok: true, mode: 'deleted' };
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
    const data: Record<string, any> = {};
    const allowed = ['firstName', 'lastName', 'phone', 'locale'] as const;
    for (const k of allowed) {
      if ((dto as any)[k] !== undefined) data[k] = (dto as any)[k] || null;
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

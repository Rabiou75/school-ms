import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGuardianDto, UpdateGuardianDto } from '@school/shared';

@Injectable()
export class GuardiansService {
  constructor(private prisma: PrismaService) {}

  async list(schoolId: string, q?: string) {
    const where: any = { schoolId };
    if (q) {
      where.OR = [
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName:  { contains: q, mode: 'insensitive' } },
        { phone:     { contains: q } },
      ];
    }
    const guardians = await this.prisma.guardian.findMany({
      where,
      include: {
        user: { select: { id: true, email: true, role: true, isActive: true } },
        students: {
          where: { isActive: true },
          select: { id: true, firstName: true, lastName: true, admissionNo: true },
          orderBy: { firstName: 'asc' },
        },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
    return guardians.map((g) => ({
      id: g.id,
      firstName: g.firstName,
      lastName: g.lastName,
      relation: g.relation,
      phone: g.phone,
      email: g.email ?? g.user?.email ?? null,
      hasAccount: !!g.userId,
      accountActive: g.user?.isActive ?? null,
      childrenCount: g.students.length,
      children: g.students,
    }));
  }

  async get(id: string) {
    const g = await this.prisma.guardian.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, role: true, isActive: true } },
        students: {
          where: { isActive: true },
          select: { id: true, firstName: true, lastName: true, admissionNo: true },
        },
      },
    });
    if (!g) throw new NotFoundException('guardian_not_found');
    return g;
  }

  async create(schoolId: string, dto: CreateGuardianDto) {
    const email = (dto.email || '').trim() || null;
    const password = (dto.password || '').trim() || null;

    let userId: string | null = null;

    if (email && password) {
      // Create parent user account
      const existing = await this.prisma.user.findUnique({ where: { email } });
      if (existing) throw new ConflictException('email_already_registered');
      const user = await this.prisma.user.create({
        data: {
          schoolId,
          email,
          passwordHash: await bcrypt.hash(password, 10),
          firstName: dto.firstName,
          lastName: dto.lastName,
          role: 'PARENT',
          locale: 'fr',
        },
      });
      userId = user.id;
    }

    return this.prisma.guardian.create({
      data: {
        schoolId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        relation: dto.relation,
        phone: dto.phone,
        email,
        userId,
      },
    });
  }

  async update(id: string, dto: UpdateGuardianDto) {
    const g = await this.prisma.guardian.findUnique({ where: { id } });
    if (!g) throw new NotFoundException('guardian_not_found');

    // Simple field updates
    const data: any = {
      firstName: dto.firstName,
      lastName: dto.lastName,
      relation: dto.relation,
      phone: dto.phone,
    };
    if (dto.email !== undefined) data.email = (dto.email || '').trim() || null;

    // Optional: create a login account on the fly
    const email = (dto.email || '').trim() || null;
    const password = (dto.password || '').trim() || null;
    if (password && password.length >= 8) {
      if (!email) throw new BadRequestException('email_required_for_account');
      if (g.userId) {
        // Update existing account password
        await this.prisma.user.update({
          where: { id: g.userId },
          data: {
            passwordHash: await bcrypt.hash(password, 10),
            firstName: dto.firstName ?? g.firstName,
            lastName: dto.lastName ?? g.lastName,
            email,
          },
        });
      } else {
        const existing = await this.prisma.user.findUnique({ where: { email } });
        if (existing) throw new ConflictException('email_already_registered');
        const user = await this.prisma.user.create({
          data: {
            schoolId: g.schoolId,
            email,
            passwordHash: await bcrypt.hash(password, 10),
            firstName: dto.firstName ?? g.firstName,
            lastName: dto.lastName ?? g.lastName,
            role: 'PARENT',
            locale: 'fr',
          },
        });
        data.userId = user.id;
      }
    }

    return this.prisma.guardian.update({ where: { id }, data });
  }

  async remove(id: string) {
    const g = await this.prisma.guardian.findUnique({
      where: { id },
      include: { _count: { select: { students: true } } },
    });
    if (!g) throw new NotFoundException('guardian_not_found');

    if (g._count.students > 0) {
      throw new BadRequestException('guardian_has_children');
    }

    // Deactivate account if it exists
    if (g.userId) {
      await this.prisma.user.update({ where: { id: g.userId }, data: { isActive: false } });
    }
    await this.prisma.guardian.delete({ where: { id } });
    return { ok: true };
  }
}

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClassDto, UpdateClassDto } from '@school/shared';

@Injectable()
export class ClassesService {
  constructor(private prisma: PrismaService) {}

  async list(schoolId: string) {
    const classes = await this.prisma.class.findMany({
      where: { schoolId },
      include: {
        academicYear: { select: { name: true } },
        _count: { select: { students: true } },
      },
      orderBy: { name: 'asc' },
    });
    return classes.map((c) => ({
      id: c.id,
      name: c.name,
      level: c.level,
      capacity: c.capacity,
      academicYear: c.academicYear?.name ?? null,
      studentCount: c._count.students,
    }));
  }

  async create(schoolId: string, dto: CreateClassDto) {
    const year = await this.prisma.academicYear.findFirst({
      where: { schoolId, isCurrent: true },
    });
    if (!year) throw new BadRequestException('no_current_academic_year');

    const dup = await this.prisma.class.findFirst({
      where: { schoolId, academicYearId: year.id, name: dto.name },
    });
    if (dup) throw new BadRequestException('class_name_exists');

    return this.prisma.class.create({
      data: {
        schoolId,
        academicYearId: year.id,
        name: dto.name,
        level: dto.level ?? null,
        capacity: dto.capacity ?? 40,
      },
    });
  }

  async update(id: string, dto: UpdateClassDto) {
    const exists = await this.prisma.class.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('class_not_found');
    return this.prisma.class.update({
      where: { id },
      data: {
        name: dto.name,
        level: dto.level,
        capacity: dto.capacity,
      },
    });
  }

  async remove(id: string) {
    const students = await this.prisma.student.count({
      where: { classId: id, isActive: true },
    });
    if (students > 0) throw new BadRequestException('class_has_students');
    await this.prisma.class.delete({ where: { id } });
    return { ok: true };
  }
}

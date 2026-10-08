import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStudentDto, UpdateStudentDto } from '@school/shared';

@Injectable()
export class StudentsService {
  constructor(private prisma: PrismaService) {}

  list(schoolId: string, q?: string) {
    const where: any = { schoolId };
    if (q) {
      where.OR = [
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName:  { contains: q, mode: 'insensitive' } },
        { admissionNo: { contains: q, mode: 'insensitive' } },
      ];
    }
    return this.prisma.student.findMany({
      where,
      include: { class: true, guardian: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async get(id: string) {
    const s = await this.prisma.student.findUnique({
      where: { id },
      include: { class: true, guardian: true, invoices: true },
    });
    if (!s) throw new NotFoundException('student_not_found');
    return s;
  }

  create(schoolId: string, dto: CreateStudentDto) {
    return this.prisma.student.create({
      data: { ...dto, schoolId, dateOfBirth: new Date(dto.dateOfBirth) },
    });
  }

  update(id: string, dto: UpdateStudentDto) {
    return this.prisma.student.update({
      where: { id },
      data: dto.dateOfBirth ? { ...dto, dateOfBirth: new Date(dto.dateOfBirth) } : dto,
    });
  }

  remove(id: string) {
    return this.prisma.student.update({ where: { id }, data: { isActive: false } });
  }
}

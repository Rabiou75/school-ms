import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSubjectDto, UpdateSubjectDto } from '@school/shared';

@Injectable()
export class SubjectsService {
  constructor(private prisma: PrismaService) {}

  list(schoolId: string) {
    return this.prisma.subject.findMany({
      where: { schoolId },
      orderBy: { name: 'asc' },
    });
  }

  async create(schoolId: string, dto: CreateSubjectDto) {
    const dup = await this.prisma.subject.findUnique({
      where: { schoolId_code: { schoolId, code: dto.code } },
    });
    if (dup) throw new BadRequestException('subject_code_exists');
    return this.prisma.subject.create({
      data: {
        schoolId,
        code: dto.code,
        name: dto.name,
        nameFr: dto.nameFr ?? null,
        nameAr: dto.nameAr ?? null,
      },
    });
  }

  async update(id: string, dto: UpdateSubjectDto) {
    const exists = await this.prisma.subject.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('subject_not_found');
    return this.prisma.subject.update({
      where: { id },
      data: {
        code: dto.code,
        name: dto.name,
        nameFr: dto.nameFr,
        nameAr: dto.nameAr,
      },
    });
  }

  async remove(id: string) {
    const marks = await this.prisma.mark.count({ where: { subjectId: id } });
    if (marks > 0) throw new BadRequestException('subject_has_marks');
    await this.prisma.subject.delete({ where: { id } });
    return { ok: true };
  }
}

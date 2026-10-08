import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TimetableService {
  constructor(private prisma: PrismaService) {}

  listByClass(classId: string) {
    return this.prisma.timetableSlot.findMany({
      where: { classId },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        teacher: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  }

  listByTeacher(teacherId: string) {
    return this.prisma.timetableSlot.findMany({
      where: { teacherId },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        class: { select: { id: true, name: true } },
      },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  }

  async create(schoolId: string, dto: any) {
    if (!dto.classId || !dto.subjectId) throw new BadRequestException('class_and_subject_required');
    if (dto.dayOfWeek === undefined || !dto.startTime || !dto.endTime) throw new BadRequestException('time_required');
    if (dto.startTime >= dto.endTime) throw new BadRequestException('invalid_time_range');
    const day = Number(dto.dayOfWeek);
    const conflicts = await this.prisma.timetableSlot.findMany({ where: { classId: dto.classId, dayOfWeek: day } });
    for (const c of conflicts) {
      if (dto.startTime < c.endTime && dto.endTime > c.startTime) throw new BadRequestException('class_time_conflict');
    }
    if (dto.teacherId) {
      const tc = await this.prisma.timetableSlot.findMany({ where: { teacherId: dto.teacherId, dayOfWeek: day } });
      for (const c of tc) {
        if (dto.startTime < c.endTime && dto.endTime > c.startTime) throw new BadRequestException('teacher_time_conflict');
      }
    }
    return this.prisma.timetableSlot.create({
      data: {
        schoolId,
        classId: dto.classId,
        subjectId: dto.subjectId,
        teacherId: dto.teacherId || null,
        dayOfWeek: day,
        startTime: dto.startTime,
        endTime: dto.endTime,
        room: dto.room || null,
      },
    });
  }

  async update(id: string, dto: any) {
    const exists = await this.prisma.timetableSlot.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('slot_not_found');
    const data: any = {};
    if (dto.subjectId !== undefined) data.subjectId = dto.subjectId;
    if (dto.teacherId !== undefined) data.teacherId = dto.teacherId || null;
    if (dto.dayOfWeek !== undefined) data.dayOfWeek = Number(dto.dayOfWeek);
    if (dto.startTime !== undefined) data.startTime = dto.startTime;
    if (dto.endTime !== undefined) data.endTime = dto.endTime;
    if (dto.room !== undefined) data.room = dto.room || null;
    return this.prisma.timetableSlot.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.prisma.timetableSlot.delete({ where: { id } });
    return { ok: true };
  }
}

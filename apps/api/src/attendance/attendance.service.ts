import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MarkAttendanceDto, BulkAttendanceDto } from '@school/shared';

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async sheet(schoolId: string, date: string, classId?: string) {
    const where: any = { schoolId, isActive: true };
    if (classId) where.classId = classId;
    const students = await this.prisma.student.findMany({
      where,
      include: { class: true },
      orderBy: [{ class: { name: 'asc' } }, { lastName: 'asc' }],
    });

    const d = new Date(date + 'T00:00:00.000Z');
    const next = new Date(d);
    next.setUTCDate(next.getUTCDate() + 1);

    const records = await this.prisma.attendance.findMany({
      where: { date: { gte: d, lt: next }, studentId: { in: students.map((s) => s.id) } },
    });
    const byStudent = new Map(records.map((r) => [r.studentId, r]));

    return students.map((s) => ({
      student: {
        id: s.id,
        admissionNo: s.admissionNo,
        firstName: s.firstName,
        lastName: s.lastName,
        classId: s.classId,
        className: s.class?.name ?? null,
      },
      attendance: byStudent.get(s.id) ?? null,
    }));
  }

  async mark(schoolId: string, dto: MarkAttendanceDto) {
    const d = new Date(dto.date + 'T00:00:00.000Z');
    const record = await this.prisma.attendance.upsert({
      where: { studentId_date: { studentId: dto.studentId, date: d } },
      update: { status: dto.status, remarks: dto.remarks ?? null },
      create: {
        studentId: dto.studentId,
        date: d,
        status: dto.status,
        remarks: dto.remarks ?? null,
        recordedBy: schoolId,
      },
    });

    // Notify parent on ABSENT / LATE
    if (dto.status === 'ABSENT' || dto.status === 'LATE') {
      this.notifyAttendance(schoolId, dto.studentId, dto.status, dto.date).catch((e) =>
        this.logger.warn('Attendance notification failed: ' + e.message),
      );
    }

    return record;
  }

  private async notifyAttendance(schoolId: string, studentId: string, status: string, date: string) {
    const student = await this.prisma.student.findUnique({ where: { id: studentId } });
    if (!student) return;

    const label = status === 'ABSENT' ? 'Absence' : 'Retard';
    const body =
      'Votre enfant ' + student.firstName + ' ' + student.lastName + ' a ete marque ' +
      (status === 'ABSENT' ? 'absent' : 'en retard') + ' le ' +
      new Date(date).toLocaleDateString('fr-FR') + '.';

    await this.notifications.notifyGuardianOfStudent(studentId, {
      type: 'ATTENDANCE_' + status,
      title: label + ' — ' + student.firstName + ' ' + student.lastName,
      body,
      link: '/fr/parent/children/' + studentId + '?tab=attendance',
      channels: ['IN_APP', 'SMS'],   // SMS is high-signal here
    });
  }

  async bulk(schoolId: string, dto: BulkAttendanceDto) {
    const students = await this.prisma.student.findMany({
      where: { schoolId, classId: dto.classId, isActive: true },
      select: { id: true },
    });
    const d = new Date(dto.date + 'T00:00:00.000Z');
    const results = await Promise.all(
      students.map((s) =>
        this.prisma.attendance.upsert({
          where: { studentId_date: { studentId: s.id, date: d } },
          update: { status: dto.status },
          create: { studentId: s.id, date: d, status: dto.status, recordedBy: schoolId },
        }),
      ),
    );

    // Only notify if bulk-marking as ABSENT or LATE (rare but possible)
    if (dto.status === 'ABSENT' || dto.status === 'LATE') {
      for (const s of students) {
        this.notifyAttendance(schoolId, s.id, dto.status, dto.date).catch(() => {});
      }
    }

    return { count: results.length, status: dto.status, date: dto.date };
  }

  async summary(schoolId: string, date: string) {
    const d = new Date(date + 'T00:00:00.000Z');
    const next = new Date(d);
    next.setUTCDate(next.getUTCDate() + 1);
    const records = await this.prisma.attendance.groupBy({
      by: ['status'],
      where: { date: { gte: d, lt: next }, student: { schoolId } },
      _count: { _all: true },
    });
    const result: Record<string, number> = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 };
    for (const r of records) result[r.status] = r._count._all;
    return result;
  }
}

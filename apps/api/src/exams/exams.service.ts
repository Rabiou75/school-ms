import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateExamDto, MarkEntryDto } from '@school/shared';

@Injectable()
export class ExamsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  list(schoolId: string) {
    return this.prisma.exam.findMany({
      where: { schoolId },
      include: {
        class: { select: { id: true, name: true } },
        term: { select: { id: true, name: true } },
        _count: { select: { marks: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(id: string) {
    const e = await this.prisma.exam.findUnique({
      where: { id },
      include: { class: true, term: true },
    });
    if (!e) throw new NotFoundException('exam_not_found');
    return e;
  }

  async create(schoolId: string, dto: CreateExamDto) {
    const year = await this.prisma.academicYear.findFirst({
      where: { schoolId, isCurrent: true },
    });
    if (!year) throw new BadRequestException('no_current_academic_year');
    return this.prisma.exam.create({
      data: {
        schoolId,
        academicYearId: year.id,
        termId: dto.termId ?? null,
        classId: dto.classId ?? null,
        name: dto.name,
        type: dto.type,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
      },
    });
  }

  async grid(examId: string, classId: string) {
    const exam = await this.prisma.exam.findUnique({ where: { id: examId } });
    if (!exam) throw new NotFoundException('exam_not_found');
    const klass = await this.prisma.class.findUnique({ where: { id: classId } });
    if (!klass) throw new NotFoundException('class_not_found');

    const students = await this.prisma.student.findMany({
      where: { classId, isActive: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
    const subjects = await this.prisma.subject.findMany({
      where: { schoolId: exam.schoolId },
      orderBy: { name: 'asc' },
    });
    const marks = await this.prisma.mark.findMany({
      where: { examId, studentId: { in: students.map((s) => s.id) } },
    });

    const byKey = new Map(marks.map((m) => [m.studentId + ':' + m.subjectId, m]));

    return {
      exam,
      klass,
      subjects: subjects.map((s) => ({ id: s.id, name: s.name, code: s.code })),
      students: students.map((s) => ({
        student: {
          id: s.id,
          admissionNo: s.admissionNo,
          firstName: s.firstName,
          lastName: s.lastName,
        },
        marks: subjects.reduce((acc, sub) => {
          const m = byKey.get(s.id + ':' + sub.id);
          if (m) acc[sub.id] = { score: m.score, maxScore: m.maxScore, coefficient: m.coefficient };
          return acc;
        }, {} as Record<string, { score: number; maxScore: number; coefficient: number }>),
      })),
    };
  }

  async saveMarks(userId: string, examId: string, entries: MarkEntryDto[]) {
    const exam = await this.prisma.exam.findUnique({ where: { id: examId } });
    if (!exam) throw new NotFoundException('exam_not_found');

    const results = await Promise.all(
      entries.map((e) =>
        this.prisma.mark.upsert({
          where: {
            examId_studentId_subjectId: {
              examId,
              studentId: e.studentId,
              subjectId: e.subjectId,
            },
          },
          update: { score: e.score, maxScore: e.maxScore, coefficient: e.coefficient, recordedBy: userId },
          create: {
            examId,
            studentId: e.studentId,
            subjectId: e.subjectId,
            score: e.score,
            maxScore: e.maxScore,
            coefficient: e.coefficient,
            recordedBy: userId,
          },
        }),
      ),
    );
    // Fire-and-forget: notify each affected student's guardian
    this.notifyMarksSaved(examId, entries.map((e) => e.studentId)).catch(() => {});

    return { count: results.length };
  }

  private async notifyMarksSaved(examId: string, studentIds: string[]) {
    const exam = await this.prisma.exam.findUnique({ where: { id: examId } });
    if (!exam) return;
    const unique = Array.from(new Set(studentIds));
    for (const sid of unique) {
      const student = await this.prisma.student.findUnique({ where: { id: sid } });
      if (!student) continue;
      await this.notifications.notifyGuardianOfStudent(sid, {
        type: 'MARKS_PUBLISHED',
        title: 'Nouvelles notes — ' + exam.name,
        body:
          'Des notes ont ete enregistrees pour ' + student.firstName + ' ' + student.lastName +
          ' dans l\'examen "' + exam.name + '". Consultez le portail parent pour les details.',
        link: '/fr/parent/children/' + sid + '?tab=grades',
        channels: ['IN_APP', 'EMAIL'],
      });
    }
  }

  async results(examId: string, classId: string) {
    const students = await this.prisma.student.findMany({
      where: { classId, isActive: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
    const marks = await this.prisma.mark.findMany({
      where: { examId, studentId: { in: students.map((s) => s.id) } },
      include: { subject: true },
    });
    const byStudent = new Map<string, typeof marks>();
    for (const m of marks) {
      if (!byStudent.has(m.studentId)) byStudent.set(m.studentId, []);
      byStudent.get(m.studentId)!.push(m);
    }

    const rows = students.map((s) => {
      const ms = byStudent.get(s.id) ?? [];
      let weighted = 0, coef = 0;
      for (const m of ms) {
        const pct20 = (m.score / m.maxScore) * 20;
        weighted += pct20 * m.coefficient;
        coef += m.coefficient;
      }
      const average = coef > 0 ? Number((weighted / coef).toFixed(2)) : null;
      return {
        student: {
          id: s.id,
          admissionNo: s.admissionNo,
          firstName: s.firstName,
          lastName: s.lastName,
        },
        subjectCount: ms.length,
        average,
        marks: ms.map((m) => ({
          subject: m.subject.name,
          code: m.subject.code,
          score: m.score,
          maxScore: m.maxScore,
          coefficient: m.coefficient,
        })),
      };
    });

    const ranked = rows
      .filter((r) => r.average !== null)
      .sort((a, b) => (b.average ?? 0) - (a.average ?? 0));
    const rankMap = new Map(ranked.map((r, i) => [r.student.id, i + 1]));

    return {
      examId,
      classId,
      rows: rows.map((r) => ({ ...r, rank: rankMap.get(r.student.id) ?? null })),
    };
  }
}

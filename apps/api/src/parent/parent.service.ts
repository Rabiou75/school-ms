import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ParentService {
  constructor(private prisma: PrismaService) {}

  private async guardianOf(userId: string) {
    const g = await this.prisma.guardian.findUnique({ where: { userId } });
    if (!g) throw new NotFoundException('guardian_not_found');
    return g;
  }

  private async assertOwnChild(guardianId: string, studentId: string) {
    const child = await this.prisma.student.findFirst({
      where: { id: studentId, guardianId, isActive: true },
    });
    if (!child) throw new ForbiddenException('not_your_child');
    return child;
  }

  async me(userId: string) {
    const guardian = await this.prisma.guardian.findUnique({
      where: { userId },
      include: {
        user: { select: { email: true, firstName: true, lastName: true, locale: true } },
        students: {
          where: { isActive: true },
          include: { class: true },
          orderBy: { firstName: 'asc' },
        },
      },
    });
    if (!guardian) throw new NotFoundException('guardian_not_found');

    return {
      id: guardian.id,
      firstName: guardian.firstName,
      lastName: guardian.lastName,
      relation: guardian.relation,
      phone: guardian.phone,
      email: guardian.user?.email ?? guardian.email,
      children: guardian.students.map((s) => ({
        id: s.id,
        admissionNo: s.admissionNo,
        firstName: s.firstName,
        lastName: s.lastName,
        gender: s.gender,
        dateOfBirth: s.dateOfBirth,
        className: s.class?.name ?? null,
        classId: s.classId,
      })),
    };
  }

  async grades(userId: string, studentId: string) {
    const guardian = await this.guardianOf(userId);
    const child = await this.assertOwnChild(guardian.id, studentId);

    const marks = await this.prisma.mark.findMany({
      where: { studentId: child.id },
      include: {
        exam: { select: { id: true, name: true, type: true, startDate: true } },
        subject: { select: { code: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const byExam = new Map<string, any>();
    for (const m of marks) {
      if (!byExam.has(m.examId)) {
        byExam.set(m.examId, {
          exam: m.exam,
          marks: [],
          weighted: 0,
          coefSum: 0,
        });
      }
      const e = byExam.get(m.examId)!;
      const p20 = (m.score / m.maxScore) * 20;
      e.marks.push({
        subject: m.subject.name,
        code: m.subject.code,
        score: m.score,
        maxScore: m.maxScore,
        coefficient: m.coefficient,
      });
      e.weighted += p20 * m.coefficient;
      e.coefSum += m.coefficient;
    }

    return {
      student: { id: child.id, firstName: child.firstName, lastName: child.lastName, admissionNo: child.admissionNo },
      exams: Array.from(byExam.values()).map((e) => ({
        exam: e.exam,
        marks: e.marks,
        average: e.coefSum > 0 ? Number((e.weighted / e.coefSum).toFixed(2)) : null,
      })),
    };
  }

  async invoices(userId: string, studentId: string) {
    const guardian = await this.guardianOf(userId);
    const child = await this.assertOwnChild(guardian.id, studentId);

    const invoices = await this.prisma.invoice.findMany({
      where: { studentId: child.id },
      orderBy: { issuedDate: 'desc' },
    });

    const payments = await this.prisma.payment.findMany({
      where: { studentId: child.id },
      orderBy: { paidAt: 'desc' },
    });

    const totalBilled = invoices.reduce((s, i) => s + i.total, 0);
    const totalPaid = invoices.reduce((s, i) => s + i.amountPaid, 0);

    return {
      student: { id: child.id, firstName: child.firstName, lastName: child.lastName, admissionNo: child.admissionNo },
      currency: 'XAF',
      summary: { totalBilled, totalPaid, balance: totalBilled - totalPaid, invoiceCount: invoices.length },
      invoices,
      payments,
    };
  }

  async attendance(userId: string, studentId: string) {
    const guardian = await this.guardianOf(userId);
    const child = await this.assertOwnChild(guardian.id, studentId);

    const since = new Date();
    since.setDate(since.getDate() - 60);

    const records = await this.prisma.attendance.findMany({
      where: { studentId: child.id, date: { gte: since } },
      orderBy: { date: 'desc' },
      take: 200,
    });

    const counts = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 };
    for (const r of records) counts[r.status as keyof typeof counts]++;

    const total = records.length;
    const rate = total > 0 ? Math.round(((counts.PRESENT + counts.LATE) / total) * 100) : 0;

    return {
      student: { id: child.id, firstName: child.firstName, lastName: child.lastName, admissionNo: child.admissionNo },
      summary: { ...counts, total, rate },
      recent: records.slice(0, 60).map((r) => ({
        date: r.date,
        status: r.status,
        remarks: r.remarks,
      })),
    };
  }

  async announcements(userId: string) {
    const guardian = await this.guardianOf(userId);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.schoolId) return [];
    return this.prisma.announcement.findMany({
      where: { schoolId: user.schoolId, publishedAt: { not: null } },
      orderBy: { publishedAt: 'desc' },
      take: 50,
    });
  }
}

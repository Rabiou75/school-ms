import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StudentPortalService {
  constructor(private prisma: PrismaService) {}

  private async me(userId: string) {
    const s = await this.prisma.student.findUnique({
      where: { userId },
      include: { class: true },
    });
    if (!s) throw new NotFoundException('student_profile_not_found');
    return s;
  }

  async profile(userId: string) {
    const s = await this.me(userId);
    const school = s.schoolId
      ? await this.prisma.school.findUnique({ where: { id: s.schoolId }, select: { name: true, email: true, logoUrl: true } })
      : null;
    return {
      id: s.id, admissionNo: s.admissionNo,
      firstName: s.firstName, lastName: s.lastName,
      gender: s.gender, dateOfBirth: s.dateOfBirth,
      className: s.class?.name ?? null, classId: s.classId, school,
    };
  }

  async grades(userId: string) {
    const s = await this.me(userId);
    const marks = await this.prisma.mark.findMany({
      where: { studentId: s.id },
      include: {
        exam: { select: { id: true, name: true, type: true, startDate: true } },
        subject: { select: { code: true, name: true, nameFr: true, nameAr: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    const byExam = new Map<string, any>();
    for (const m of marks) {
      if (!byExam.has(m.examId)) byExam.set(m.examId, { exam: m.exam, marks: [], weighted: 0, coefSum: 0 });
      const e = byExam.get(m.examId)!;
      const p20 = (m.score / m.maxScore) * 20;
      e.marks.push({ subject: m.subject.name, code: m.subject.code, score: m.score, maxScore: m.maxScore, coefficient: m.coefficient });
      e.weighted += p20 * m.coefficient;
      e.coefSum += m.coefficient;
    }
    const classmates = await this.prisma.student.findMany({
      where: { classId: s.classId ?? undefined, isActive: true },
      select: { id: true },
    });
    const allMarks = await this.prisma.mark.findMany({
      where: { studentId: { in: classmates.map((c) => c.id) } },
    });
    const stats = new Map<string, { w: number; c: number }>();
    for (const m of allMarks) {
      const key = m.examId + ':' + m.studentId;
      const cur = stats.get(key) ?? { w: 0, c: 0 };
      cur.w += (m.score / m.maxScore) * 20 * m.coefficient;
      cur.c += m.coefficient;
      stats.set(key, cur);
    }
    const exams = Array.from(byExam.values()).map((e) => {
      const rankings = classmates
        .map((c) => {
          const st = stats.get(e.exam.id + ':' + c.id);
          return { id: c.id, avg: st && st.c > 0 ? st.w / st.c : 0 };
        })
        .filter((r) => r.avg > 0)
        .sort((a, b) => b.avg - a.avg);
      const rank = rankings.findIndex((r) => r.id === s.id) + 1;
      return { exam: e.exam, marks: e.marks, average: e.coefSum > 0 ? Number((e.weighted / e.coefSum).toFixed(2)) : null, rank: rank > 0 ? rank : null, classSize: rankings.length };
    });
    return { student: { id: s.id, firstName: s.firstName, lastName: s.lastName, admissionNo: s.admissionNo }, exams };
  }

  async invoices(userId: string) {
    const s = await this.me(userId);
    const invoices = await this.prisma.invoice.findMany({ where: { studentId: s.id }, orderBy: { issuedDate: 'desc' } });
    const payments = await this.prisma.payment.findMany({ where: { studentId: s.id }, orderBy: { paidAt: 'desc' } });
    const totalBilled = invoices.reduce((a, i) => a + i.total, 0);
    const totalPaid = invoices.reduce((a, i) => a + i.amountPaid, 0);
    return {
      student: { id: s.id, firstName: s.firstName, lastName: s.lastName, admissionNo: s.admissionNo },
      currency: 'XAF',
      summary: { totalBilled, totalPaid, balance: totalBilled - totalPaid, invoiceCount: invoices.length },
      invoices, payments,
    };
  }

  async attendance(userId: string) {
    const s = await this.me(userId);
    const since = new Date();
    since.setDate(since.getDate() - 90);
    const records = await this.prisma.attendance.findMany({
      where: { studentId: s.id, date: { gte: since } },
      orderBy: { date: 'desc' },
      take: 200,
    });
    const counts = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 };
    for (const r of records) counts[r.status as keyof typeof counts]++;
    const total = records.length;
    const rate = total > 0 ? Math.round(((counts.PRESENT + counts.LATE) / total) * 100) : 0;
    return {
      student: { id: s.id, firstName: s.firstName, lastName: s.lastName, admissionNo: s.admissionNo },
      summary: { ...counts, total, rate },
      recent: records.slice(0, 90).map((r) => ({ date: r.date, status: r.status, remarks: r.remarks })),
    };
  }

  async announcements(userId: string) {
    const s = await this.me(userId);
    return this.prisma.announcement.findMany({
      where: {
        schoolId: s.schoolId,
        publishedAt: { not: null },
        OR: [
          { audience: 'ALL' },
          { audience: 'STUDENTS' },
          { audience: 'CLASS', classId: s.classId ?? undefined },
        ],
      },
      orderBy: { publishedAt: 'desc' },
      take: 50,
    });
  }
}

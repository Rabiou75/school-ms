import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async stats(schoolId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      students, staff, classes, subjects,
      billed, collected, outstanding, invoices,
      todayAttendance, upcomingExams, announcements,
    ] = await Promise.all([
      this.prisma.student.count({ where: { schoolId, isActive: true } }),
      this.prisma.staff.count({ where: { schoolId, isActive: true } }),
      this.prisma.class.count({ where: { schoolId } }),
      this.prisma.subject.count({ where: { schoolId } }),
      this.prisma.invoice.aggregate({ where: { schoolId }, _sum: { total: true } }),
      this.prisma.payment.aggregate({ where: { schoolId }, _sum: { amount: true } }),
      this.prisma.invoice.aggregate({ where: { schoolId, status: { not: 'PAID' } }, _sum: { balance: true } }),
      this.prisma.invoice.count({ where: { schoolId } }),
      this.prisma.attendance.groupBy({
        by: ['status'],
        where: { date: { gte: today, lt: tomorrow }, student: { schoolId } },
        _count: { _all: true },
      }),
      this.prisma.exam.count({ where: { schoolId, startDate: { gte: today } } }),
      this.prisma.announcement.count({ where: { schoolId, publishedAt: { not: null } } }),
    ]);

    const attMap: Record<string, number> = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 };
    for (const r of todayAttendance) attMap[r.status] = r._count._all;
    const attTotal = Object.values(attMap).reduce((s, n) => s + n, 0);
    const attRate = attTotal > 0 ? Math.round(((attMap.PRESENT + attMap.LATE) / attTotal) * 100) : 0;

    return {
      currency: 'XAF',
      students, staff, classes, subjects,
      finance: {
        totalBilled: billed._sum.total ?? 0,
        totalCollected: collected._sum.amount ?? 0,
        totalOutstanding: outstanding._sum.balance ?? 0,
        invoiceCount: invoices,
      },
      attendance: {
        date: today.toISOString().slice(0, 10),
        present: attMap.PRESENT,
        absent: attMap.ABSENT,
        late: attMap.LATE,
        excused: attMap.EXCUSED,
        rate: attRate,
      },
      upcomingExams,
      announcements,
    };
  }
}
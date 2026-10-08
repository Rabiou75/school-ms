import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PayrollService {
  constructor(private prisma: PrismaService) {}

  list(schoolId: string, year: number, month: number) {
    return this.prisma.payrollItem.findMany({
      where: { schoolId, year, month },
      include: { staff: { select: { id: true, firstName: true, lastName: true, position: true, employeeNo: true } } },
      orderBy: { staff: { lastName: 'asc' } },
    });
  }

  async generate(schoolId: string, year: number, month: number, extraDeductions: Record<string, number> = {}) {
    if (month < 1 || month > 12) throw new BadRequestException('invalid_month');
    const existing = await this.prisma.payrollItem.count({ where: { schoolId, year, month } });
    if (existing > 0) throw new BadRequestException('payroll_already_generated');
    const staff = await this.prisma.staff.findMany({ where: { schoolId, isActive: true } });
    if (staff.length === 0) throw new BadRequestException('no_active_staff');
    const items = staff.map((s) => {
      const gross = s.baseSalary;
      const ded = Number(extraDeductions[s.id]) || 0;
      return { schoolId, staffId: s.id, month, year, grossPay: gross, deductions: ded, netPay: Math.max(0, gross - ded) };
    });
    await this.prisma.$transaction(items.map((it) => this.prisma.payrollItem.create({ data: it })));
    return { created: items.length, total: items.reduce((a, i) => a + i.netPay, 0) };
  }

  async markPaid(id: string) {
    return this.prisma.payrollItem.update({ where: { id }, data: { paidAt: new Date() } });
  }

  async markAllPaid(schoolId: string, year: number, month: number) {
    const r = await this.prisma.payrollItem.updateMany({
      where: { schoolId, year, month, paidAt: null },
      data: { paidAt: new Date() },
    });
    return { updated: r.count };
  }

  async updateItem(id: string, dto: { deductions?: number; notes?: string }) {
    const item = await this.prisma.payrollItem.findUnique({ where: { id } });
    if (!item) throw new BadRequestException('item_not_found');
    const data: any = {};
    if (dto.deductions !== undefined) {
      data.deductions = Number(dto.deductions);
      data.netPay = Math.max(0, item.grossPay - Number(dto.deductions));
    }
    if (dto.notes !== undefined) data.notes = dto.notes || null;
    return this.prisma.payrollItem.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.prisma.payrollItem.delete({ where: { id } });
    return { ok: true };
  }
}

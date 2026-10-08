import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateInvoiceDto, RecordPaymentDto, CreateFeeDto } from '@school/shared';

function formatXAF(n: number) {
  return new Intl.NumberFormat('fr-CM', { style: 'currency', currency: 'XAF', maximumFractionDigits: 0 }).format(n);
}

@Injectable()
export class FinanceService {
  private readonly logger = new Logger(FinanceService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  listFees(schoolId: string) {
    return this.prisma.fee.findMany({ where: { schoolId }, orderBy: { name: 'asc' } });
  }

  createFee(schoolId: string, dto: CreateFeeDto) {
    return this.prisma.fee.create({
      data: { schoolId, name: dto.name, amount: dto.amount, classId: dto.classId ?? null, isActive: dto.isActive ?? true },
    });
  }

  listInvoices(schoolId: string) {
    return this.prisma.invoice.findMany({
      where: { schoolId },
      include: { student: { select: { id: true, firstName: true, lastName: true, admissionNo: true } } },
      orderBy: { issuedDate: 'desc' },
      take: 200,
    });
  }

  async getInvoice(id: string) {
    const inv = await this.prisma.invoice.findUnique({
      where: { id },
      include: { student: true },
    });
    if (!inv) throw new NotFoundException('invoice_not_found');
    const payments = await this.prisma.payment.findMany({
      where: { invoiceId: id },
      orderBy: { paidAt: 'desc' },
    });
    return { ...inv, payments };
  }

  async createInvoice(schoolId: string, dto: CreateInvoiceDto) {
    const year = new Date().getFullYear();
    const prefix = 'INV-' + year + '-';
    const last = await this.prisma.invoice.findFirst({
      where: { schoolId, invoiceNo: { startsWith: prefix } },
      orderBy: { invoiceNo: 'desc' },
    });
    const n = last ? parseInt(last.invoiceNo.slice(prefix.length), 10) + 1 : 1;
    const invoiceNo = prefix + String(n).padStart(5, '0');

    const invoice = await this.prisma.invoice.create({
      data: {
        schoolId,
        studentId: dto.studentId,
        invoiceNo,
        dueDate: new Date(dto.dueDate),
        total: dto.total,
        amountPaid: 0,
        balance: dto.total,
        status: 'UNPAID',
      },
    });

    // Fire-and-forget: notify the parent
    this.notifyInvoiceCreated(schoolId, invoice.id).catch((e) =>
      this.logger.warn('Invoice notification failed: ' + e.message),
    );

    return invoice;
  }

  private async notifyInvoiceCreated(schoolId: string, invoiceId: string) {
    const inv = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { student: true },
    });
    if (!inv) return;

    const title = 'Nouvelle facture : ' + inv.invoiceNo;
    const body =
      'Une nouvelle facture a ete emise pour ' +
      inv.student.firstName + ' ' + inv.student.lastName +
      '.\n' +
      'Montant : ' + formatXAF(inv.total) + '\n' +
      'Echeance : ' + new Date(inv.dueDate).toLocaleDateString('fr-FR') + '\n' +
      'Statut : ' + inv.status;

    await this.notifications.notifyGuardianOfStudent(inv.studentId, {
      type: 'INVOICE_CREATED',
      title,
      body,
      link: '/fr/parent/children/' + inv.studentId + '?tab=invoices',
      channels: ['IN_APP', 'EMAIL'],
    });
  }

  async recordPayment(schoolId: string, invoiceId: string, dto: RecordPaymentDto) {
    const inv = await this.prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!inv) throw new NotFoundException('invoice_not_found');
    if (dto.amount > inv.balance) throw new BadRequestException('amount_exceeds_balance');

    const newPaid = inv.amountPaid + dto.amount;
    const newBalance = inv.total - newPaid;
    const newStatus = newBalance <= 0 ? 'PAID' : newPaid > 0 ? 'PARTIAL' : 'UNPAID';

    const results = await this.prisma.$transaction([
      this.prisma.payment.create({
        data: {
          schoolId, invoiceId, studentId: inv.studentId,
          amount: dto.amount, method: dto.method,
          reference: dto.reference ?? null, status: 'SUCCESS',
        },
      }),
      this.prisma.invoice.update({
        where: { id: invoiceId },
        data: { amountPaid: newPaid, balance: newBalance, status: newStatus },
      }),
    ]);

    // Fire-and-forget: notify parent + admins
    this.notifyPaymentRecorded(schoolId, invoiceId, dto.amount, newStatus).catch((e) =>
      this.logger.warn('Payment notification failed: ' + e.message),
    );

    return results[0];
  }

  private async notifyPaymentRecorded(schoolId: string, invoiceId: string, amount: number, newStatus: string) {
    const inv = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { student: true },
    });
    if (!inv) return;

    const title = 'Paiement recu : ' + inv.invoiceNo;
    const body =
      'Un paiement a ete enregistre pour ' +
      inv.student.firstName + ' ' + inv.student.lastName + '.\n' +
      'Montant : ' + formatXAF(amount) + '\n' +
      'Solde restant : ' + formatXAF(inv.balance) + '\n' +
      'Statut : ' + newStatus;

    await this.notifications.notifyGuardianOfStudent(inv.studentId, {
      type: 'PAYMENT_RECEIVED',
      title,
      body,
      link: '/fr/parent/children/' + inv.studentId + '?tab=invoices',
      channels: ['IN_APP'],
    });

    // Also alert admins in-app
    await this.notifications.notifySchoolAdmins(schoolId, {
      type: 'PAYMENT_RECEIVED',
      title,
      body,
      link: '/fr/dashboard/finance',
      channels: ['IN_APP'],
    });
  }

  async getSummary(schoolId: string) {
    const billed = await this.prisma.invoice.aggregate({ where: { schoolId }, _sum: { total: true } });
    const collected = await this.prisma.payment.aggregate({ where: { schoolId }, _sum: { amount: true } });
    const outstanding = await this.prisma.invoice.aggregate({
      where: { schoolId, status: { not: 'PAID' } },
      _sum: { balance: true },
    });
    const count = await this.prisma.invoice.count({ where: { schoolId } });
    return {
      currency: 'XAF',
      totalBilled: billed._sum.total ?? 0,
      totalCollected: collected._sum.amount ?? 0,
      totalOutstanding: outstanding._sum.balance ?? 0,
      invoiceCount: count,
    };
  }
}

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

// ============================================================
// 1. Add helper methods to NotificationsService
// ============================================================
const svcPath = join(root, 'apps/api/src/notifications/notifications.service.ts');
let svc = readFileSync(svcPath, 'utf8');

const anchor = '  // ---------- Test endpoint (send a test notification to self) ----------';

const helpers = `  // ---------- Helpers for event hooks ----------

  /** Notify the guardian (parent) of a student. */
  async notifyGuardianOfStudent(
    studentId: string,
    opts: {
      type: string;
      title: string;
      body: string;
      link?: string;
      channels?: Array<'IN_APP' | 'EMAIL' | 'SMS'>;
    },
  ) {
    try {
      const student = await this.prisma.student.findUnique({
        where: { id: studentId },
        include: {
          guardian: {
            include: {
              user: {
                select: { id: true, email: true, phone: true, schoolId: true, isActive: true },
              },
            },
          },
        },
      });
      if (!student) return { ok: false, reason: 'student_not_found' };
      if (!student.guardian?.userId || !student.guardian.user) {
        return { ok: false, reason: 'no_guardian_account' };
      }
      if (!student.guardian.user.isActive) return { ok: false, reason: 'guardian_inactive' };

      return await this.dispatch({
        userId: student.guardian.user.id,
        schoolId: student.guardian.user.schoolId ?? student.schoolId,
        type: opts.type,
        title: opts.title,
        body: opts.body,
        link: opts.link,
        channels: opts.channels,
      });
    } catch (e: any) {
      this.logger.warn('notifyGuardianOfStudent failed: ' + e.message);
      return { ok: false, reason: 'error' };
    }
  }

  /** Notify every active user in a school with a given role. */
  async notifyRole(
    schoolId: string,
    role: string,
    opts: {
      type: string;
      title: string;
      body: string;
      link?: string;
      channels?: Array<'IN_APP' | 'EMAIL' | 'SMS'>;
    },
  ) {
    try {
      const users = await this.prisma.user.findMany({
        where: { schoolId, role: role as any, isActive: true },
        select: { id: true, schoolId: true },
      });
      const results = await Promise.all(
        users.map((u) =>
          this.dispatch({
            userId: u.id,
            schoolId: u.schoolId,
            type: opts.type,
            title: opts.title,
            body: opts.body,
            link: opts.link,
            channels: opts.channels,
          }).catch(() => null),
        ),
      );
      return { ok: true, notified: results.filter((r) => r?.ok).length };
    } catch (e: any) {
      this.logger.warn('notifyRole failed: ' + e.message);
      return { ok: false, reason: 'error' };
    }
  }

  /** Convenience: notify admins of a school. */
  notifySchoolAdmins(schoolId: string, opts: { type: string; title: string; body: string; link?: string; channels?: Array<'IN_APP' | 'EMAIL' | 'SMS'> }) {
    return this.notifyRole(schoolId, 'SUPER_ADMIN', opts).then(() =>
      this.notifyRole(schoolId, 'ADMIN', opts),
    );
  }

`;

if (!svc.includes('notifyGuardianOfStudent')) {
  svc = svc.replace(anchor, helpers + anchor);
  writeFileSync(svcPath, svc, 'utf8');
  console.log('  + notifications.service.ts — helper methods added');
} else {
  console.log('  = helper methods already present');
}

// ============================================================
// 2. Rewrite FinanceService with hooks
// ============================================================
const financePath = join(root, 'apps/api/src/finance/finance.service.ts');

const financeSvc = `import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
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
      '.\\n' +
      'Montant : ' + formatXAF(inv.total) + '\\n' +
      'Echeance : ' + new Date(inv.dueDate).toLocaleDateString('fr-FR') + '\\n' +
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
      inv.student.firstName + ' ' + inv.student.lastName + '.\\n' +
      'Montant : ' + formatXAF(amount) + '\\n' +
      'Solde restant : ' + formatXAF(inv.balance) + '\\n' +
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
`;

writeFileSync(financePath, financeSvc, 'utf8');
console.log('  + finance.service.ts rewritten with hooks');

// ============================================================
// 3. Rewrite AttendanceService with hooks
// ============================================================
const attendancePath = join(root, 'apps/api/src/attendance/attendance.service.ts');

const attendanceSvc = `import { Injectable, Logger } from '@nestjs/common';
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
`;

writeFileSync(attendancePath, attendanceSvc, 'utf8');
console.log('  + attendance.service.ts rewritten with hooks');

// ============================================================
// 4. Patch ExamsService — add NotificationsService injection + notify after saveMarks
// ============================================================
const examsPath = join(root, 'apps/api/src/exams/exams.service.ts');
let exams = readFileSync(examsPath, 'utf8');

// 4a. Import + inject
if (!exams.includes('NotificationsService')) {
  exams = exams.replace(
    "import { PrismaService } from '../prisma/prisma.service';",
    "import { PrismaService } from '../prisma/prisma.service';\nimport { NotificationsService } from '../notifications/notifications.service';"
  );
  exams = exams.replace(
    'export class ExamsService {\n  constructor(private prisma: PrismaService) {}',
    'export class ExamsService {\n  constructor(\n    private prisma: PrismaService,\n    private notifications: NotificationsService,\n  ) {}'
  );
  console.log('  + exams.service.ts — NotificationsService injected');
} else {
  console.log('  = exams.service.ts already has NotificationsService');
}

// 4b. After saveMarks succeeds, notify affected students' guardians
// Find the return statement inside saveMarks
const saveMarksReturn = '    return { count: results.length };\n  }';
const saveMarksNew = `    // Fire-and-forget: notify each affected student's guardian
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
          ' dans l\\'examen "' + exam.name + '". Consultez le portail parent pour les details.',
        link: '/fr/parent/children/' + sid + '?tab=grades',
        channels: ['IN_APP', 'EMAIL'],
      });
    }
  }`;

if (exams.includes(saveMarksReturn) && !exams.includes('notifyMarksSaved')) {
  exams = exams.replace(saveMarksReturn, saveMarksNew);
  console.log('  + exams.service.ts — marks notification hook');
} else {
  console.log('  = exams notification already present or anchor not found');
}

writeFileSync(examsPath, exams, 'utf8');

// ============================================================
// 5. Patch the three modules to import NotificationsModule
// ============================================================
function patchModule(path, label) {
  let src = readFileSync(path, 'utf8');

  if (src.includes('NotificationsModule')) {
    console.log('  = ' + label + ' already imports NotificationsModule');
    return;
  }

  // Add import
  src = src.replace(
    /^(import \{ Module \} from '@nestjs\/common';)/m,
    "$1\nimport { NotificationsModule } from '../notifications/notifications.module';"
  );

  // Add to imports array (before providers or controllers)
  src = src.replace(
    /@Module\(\{\n  providers:/,
    '@Module({\n  imports: [NotificationsModule],\n  providers:'
  );

  writeFileSync(path, src, 'utf8');
  console.log('  + ' + label + ' — NotificationsModule imported');
}

patchModule(join(root, 'apps/api/src/finance/finance.module.ts'), 'finance.module.ts');
patchModule(join(root, 'apps/api/src/attendance/attendance.module.ts'), 'attendance.module.ts');
patchModule(join(root, 'apps/api/src/exams/exams.module.ts'), 'exams.module.ts');

console.log('\n✅ Notification hooks wired into finance, attendance, exams');
console.log('');
console.log('Next:');
console.log('  Get-Process node | Stop-Process -Force');
console.log('  cd apps\\api ; npx nest build ; cd ..\\..');
console.log('  pnpm dev');
console.log('');
console.log('Test:');
console.log('  1. Create an invoice in the admin UI → parent gets an in-app notification');
console.log('  2. Mark a student ABSENT → parent gets an in-app + SMS notification (SMS only if configured)');
console.log('  3. Save some marks on an exam → parent gets an in-app + email notification');
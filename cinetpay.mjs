import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const root = process.cwd();
const put = (p, c) => {
  const full = join(root, p);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, c, 'utf8');
  console.log('  + ' + p);
};

// ============================================================
// CinetPay service
// ============================================================
put('apps/api/src/payments/cinetpay.service.ts', `import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const INIT_URL  = 'https://api-checkout.cinetpay.com/v2/payment';
const CHECK_URL = 'https://api-checkout.cinetpay.com/v2/payment/check';

@Injectable()
export class CinetPayService {
  private readonly logger = new Logger(CinetPayService.name);

  constructor(private prisma: PrismaService) {}

  private get apiKey() {
    return process.env.CINETPAY_API_KEY || '';
  }
  private get siteId() {
    return process.env.CINETPAY_SITE_ID || '';
  }
  private get notifyUrl() {
    return process.env.CINETPAY_NOTIFY_URL || '';
  }
  private get returnUrl() {
    return process.env.CINETPAY_RETURN_URL || '';
  }

  private assertConfigured() {
    if (!this.apiKey || !this.siteId) {
      throw new BadRequestException('cinetpay_not_configured');
    }
  }

  /** Start a payment for an invoice. Returns the CinetPay checkout URL. */
  async initializeForInvoice(invoiceId: string) {
    this.assertConfigured();

    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { student: true },
    });
    if (!invoice) throw new BadRequestException('invoice_not_found');
    if (invoice.balance <= 0) throw new BadRequestException('nothing_to_pay');

    const transactionId = invoice.invoiceNo + '-' + Date.now();

    const body = {
      apikey: this.apiKey,
      site_id: this.siteId,
      transaction_id: transactionId,
      amount: invoice.balance,
      currency: 'XAF',
      description: 'Scolarite ' + invoice.invoiceNo,
      notify_url: this.notifyUrl,
      return_url: this.returnUrl,
      channels: 'MOBILE_MONEY',
      lang: 'fr',
      customer_name: invoice.student.firstName,
      customer_surname: invoice.student.lastName,
      customer_email: invoice.student.email || 'noreply@school.cm',
      customer_phone_number: invoice.student.phone || '',
      metadata: JSON.stringify({ invoiceId: invoice.id }),
    };

    const res = await fetch(INIT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json: any = await res.json();

    this.logger.log('CinetPay init response: ' + JSON.stringify(json));

    if (json.code !== '201' || !json.data?.payment_url) {
      throw new BadRequestException('cinetpay_init_failed: ' + (json.message || 'unknown'));
    }

    // Record a pending payment attempt
    await this.prisma.payment.create({
      data: {
        schoolId: invoice.schoolId,
        invoiceId: invoice.id,
        studentId: invoice.studentId,
        amount: invoice.balance,
        method: 'MOBILE_MONEY_MTN',       // refined by webhook
        status: 'PENDING',
        reference: transactionId,
        metadata: { paymentToken: json.data.payment_token },
      },
    });

    return {
      checkoutUrl: json.data.payment_url,
      transactionId,
      amount: invoice.balance,
    };
  }

  /** Verify a transaction with CinetPay (source of truth). */
  async verifyTransaction(transactionId: string) {
    this.assertConfigured();
    const res = await fetch(CHECK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apikey: this.apiKey,
        site_id: this.siteId,
        transaction_id: transactionId,
      }),
    });
    const json: any = await res.json();
    return json?.data ?? null;
  }

  /**
   * Handle CinetPay webhook. Body has cpm_trans_id, cpm_result, payment_method, etc.
   * Always re-verify with CinetPay before marking the invoice paid.
   */
  async handleWebhook(payload: any) {
    const txId = payload.cpm_trans_id || payload.transaction_id;
    this.logger.log('Webhook tx=' + txId + ' body=' + JSON.stringify(payload));

    if (!txId) return { ok: false, reason: 'missing_transaction_id' };

    // 1. Look up our local pending payment
    const payment = await this.prisma.payment.findFirst({ where: { reference: txId } });
    if (!payment) return { ok: false, reason: 'unknown_transaction' };

    // 2. Re-verify with CinetPay
    const check = await this.verifyTransaction(txId);
    this.logger.log('Verify response: ' + JSON.stringify(check));

    const verifiedStatus = check?.status;  // "ACCEPTED" | "REFUSED" | "PENDING"

    if (verifiedStatus !== 'ACCEPTED') {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: verifiedStatus === 'REFUSED' ? 'FAILED' : 'PENDING' },
      });
      return { ok: true, status: verifiedStatus };
    }

    // 3. Apply the payment atomically
    const invoice = await this.prisma.invoice.findUnique({ where: { id: payment.invoiceId } });
    if (!invoice) return { ok: false, reason: 'invoice_missing' };

    // Idempotency: skip if already applied
    if (payment.status === 'SUCCESS') return { ok: true, already: true };

    const newPaid = invoice.amountPaid + payment.amount;
    const newBalance = Math.max(0, invoice.total - newPaid);
    const newStatus = newBalance <= 0 ? 'PAID' : 'PARTIAL';

    const methodRaw = (payload.payment_method || '').toUpperCase();
    const method = methodRaw.includes('ORANGE') ? 'MOBILE_MONEY_ORANGE' : 'MOBILE_MONEY_MTN';

    await this.prisma.$transaction([
      this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'SUCCESS',
          method,
          metadata: { verify: check, webhook: payload },
        },
      }),
      this.prisma.invoice.update({
        where: { id: invoice.id },
        data: { amountPaid: newPaid, balance: newBalance, status: newStatus },
      }),
    ]);

    this.logger.log('Invoice ' + invoice.invoiceNo + ' paid ' + payment.amount + ' XAF via ' + method);
    return { ok: true, status: 'APPLIED' };
  }
}
`);

// ============================================================
// Payments controller
// ============================================================
put('apps/api/src/payments/payments.controller.ts', `import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { CinetPayService } from './cinetpay.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('payments')
export class PaymentsController {
  constructor(private cinetpay: CinetPayService) {}

  /** Parent initiates a Mobile Money payment for an invoice */
  @UseGuards(JwtAuthGuard)
  @Post('cinetpay/init/:invoiceId')
  init(@Param('invoiceId') invoiceId: string) {
    return this.cinetpay.initializeForInvoice(invoiceId);
  }

  /** Manual verify endpoint (for debugging / a "Check status" button) */
  @UseGuards(JwtAuthGuard)
  @Get('cinetpay/verify/:txId')
  verify(@Param('txId') txId: string) {
    return this.cinetpay.verifyTransaction(txId);
  }

  /** CinetPay calls this — no auth. Body is verified by re-querying CinetPay. */
  @Post('cinetpay/webhook')
  webhook(@Body() body: any) {
    return this.cinetpay.handleWebhook(body);
  }
}
`);

put('apps/api/src/payments/payments.module.ts', `import { Module } from '@nestjs/common';
import { CinetPayService } from './cinetpay.service';
import { PaymentsController } from './payments.controller';

@Module({
  providers: [CinetPayService],
  controllers: [PaymentsController],
})
export class PaymentsModule {}
`);

put('apps/api/src/app.module.ts', `import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { StudentsModule } from './students/students.module';
import { FinanceModule } from './finance/finance.module';
import { AttendanceModule } from './attendance/attendance.module';
import { ClassesModule } from './classes/classes.module';
import { ExamsModule } from './exams/exams.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { StaffModule } from './staff/staff.module';
import { SubjectsModule } from './subjects/subjects.module';
import { ParentModule } from './parent/parent.module';
import { GuardiansModule } from './guardians/guardians.module';
import { PaymentsModule } from './payments/payments.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
    PrismaModule,
    AuthModule,
    StudentsModule,
    FinanceModule,
    AttendanceModule,
    ClassesModule,
    ExamsModule,
    DashboardModule,
    StaffModule,
    SubjectsModule,
    ParentModule,
    GuardiansModule,
    PaymentsModule,
  ],
})
export class AppModule {}
`);

// ============================================================
// .env additions
// ============================================================
import { readFileSync, existsSync } from 'node:fs';

const envPath = join(root, '.env');
const additions = [
  '',
  '# ============================================================',
  '# CinetPay (Mobile Money - MTN / Orange)',
  '# ============================================================',
  '# Sandbox keys start with sk_test_  |  Production keys start with sk_live_',
  'CINETPAY_API_KEY=',
  'CINETPAY_SITE_ID=',
  '# Webhook + return URLs must be publicly reachable (use ngrok locally)',
  'CINETPAY_NOTIFY_URL=https://YOUR_DOMAIN/api/v1/payments/cinetpay/webhook',
  'CINETPAY_RETURN_URL=https://YOUR_DOMAIN/fr/parent',
  '',
].join('\n');

if (existsSync(envPath)) {
  const current = readFileSync(envPath, 'utf8');
  if (!current.includes('CINETPAY_API_KEY')) {
    writeFileSync(envPath, current + additions, 'utf8');
    console.log('  ~ .env (CinetPay keys appended)');
  } else {
    console.log('  = .env already has CinetPay keys');
  }
}

console.log('\n✅ CinetPay integration written');
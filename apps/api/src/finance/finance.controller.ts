import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../common/pipes/zod.pipe';
import {
  createFeeSchema, createInvoiceSchema, recordPaymentSchema,
  CreateFeeDto, CreateInvoiceDto, RecordPaymentDto,
} from '@school/shared';

@UseGuards(JwtAuthGuard)
@Controller('finance')
export class FinanceController {
  constructor(private svc: FinanceService) {}

  @Get('summary')
  summary(@Req() req: any) { return this.svc.getSummary(req.user.schoolId); }

  @Get('fees')
  listFees(@Req() req: any) { return this.svc.listFees(req.user.schoolId); }

  @Post('fees')
  createFee(@Req() req: any, @Body(new ZodValidationPipe(createFeeSchema)) dto: CreateFeeDto) {
    return this.svc.createFee(req.user.schoolId, dto);
  }

  @Get('invoices')
  listInvoices(@Req() req: any) { return this.svc.listInvoices(req.user.schoolId); }

  @Get('invoices/:id')
  getInvoice(@Param('id') id: string) { return this.svc.getInvoice(id); }

  @Post('invoices')
  createInvoice(@Req() req: any, @Body(new ZodValidationPipe(createInvoiceSchema)) dto: CreateInvoiceDto) {
    return this.svc.createInvoice(req.user.schoolId, dto);
  }

  @Post('invoices/:id/payments')
  recordPayment(
    @Req() req: any,
    @Param('id') invoiceId: string,
    @Body(new ZodValidationPipe(recordPaymentSchema)) dto: RecordPaymentDto,
  ) {
    return this.svc.recordPayment(req.user.schoolId, invoiceId, dto);
  }
}

import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { PayrollService } from './payroll.service';
import { PayslipService } from './payslip.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('payroll')
export class PayrollController {
  constructor(private svc: PayrollService, private payslip: PayslipService) {}

  @Get()
  list(@Req() req: any, @Query('year') year: string, @Query('month') month: string) {
    const y = Number(year) || new Date().getFullYear();
    const m = Number(month) || new Date().getMonth() + 1;
    return this.svc.list(req.user.schoolId, y, m);
  }

  @Post('generate')
  generate(@Req() req: any, @Body() body: { year: number; month: number; deductions?: Record<string, number> }) {
    return this.svc.generate(req.user.schoolId, Number(body.year), Number(body.month), body.deductions || {});
  }

  @Post('pay-all')
  markAllPaid(@Req() req: any, @Body() body: { year: number; month: number }) {
    return this.svc.markAllPaid(req.user.schoolId, Number(body.year), Number(body.month));
  }

  @Get(':id/payslip')
  async payslipPdf(
    @Param('id') id: string,
    @Query('locale') locale: string,
    @Res() res: Response,
  ) {
    const buffer = await this.payslip.render(id, locale || 'fr');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', String(buffer.length));
    res.setHeader('Content-Disposition', 'attachment; filename="payslip-' + id + '.pdf"');
    res.end(buffer);
  }

  @Post(':id/pay')
  markPaid(@Param('id') id: string) { return this.svc.markPaid(id); }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: any) { return this.svc.updateItem(id, dto); }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.svc.remove(id); }
}

import { Body, Controller, Get, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { CinetPayService } from './cinetpay.service';
import { ReceiptService } from './receipt.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('payments')
export class PaymentsController {
  constructor(
    private cinetpay: CinetPayService,
    private receipts: ReceiptService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post('cinetpay/init/:invoiceId')
  init(@Param('invoiceId') invoiceId: string) {
    return this.cinetpay.initializeForInvoice(invoiceId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('cinetpay/verify/:txId')
  verify(@Param('txId') txId: string) {
    return this.cinetpay.verifyTransaction(txId);
  }

  @Post('cinetpay/webhook')
  webhook(@Body() body: any) {
    return this.cinetpay.handleWebhook(body);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/receipt')
  async receipt(
    @Param('id') id: string,
    @Query('locale') locale: string,
    @Res() res: Response,
  ) {
    const buffer = await this.receipts.render(id, locale || 'fr');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', String(buffer.length));
    res.setHeader('Content-Disposition', 'attachment; filename="receipt-' + id + '.pdf"');
    res.end(buffer);
  }
}

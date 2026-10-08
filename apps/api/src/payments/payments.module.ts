import { Module } from '@nestjs/common';
import { CinetPayService } from './cinetpay.service';
import { PaymentsController } from './payments.controller';
import { ReceiptService } from './receipt.service';

@Module({
  providers: [CinetPayService, ReceiptService],
  controllers: [PaymentsController],
})
export class PaymentsModule {}

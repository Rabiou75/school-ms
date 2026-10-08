import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { FinanceService } from './finance.service';
import { FinanceController } from './finance.controller';

@Module({
  imports: [NotificationsModule],
  providers: [FinanceService],
  controllers: [FinanceController],
})
export class FinanceModule {}

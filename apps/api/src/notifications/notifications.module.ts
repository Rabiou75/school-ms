import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { EmailProvider } from './providers/email.provider';
import { SmsProvider } from './providers/sms.provider';

@Module({
  providers: [NotificationsService, EmailProvider, SmsProvider],
  controllers: [NotificationsController],
  exports: [NotificationsService],
})
export class NotificationsModule {}

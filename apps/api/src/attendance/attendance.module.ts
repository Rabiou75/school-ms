import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { AttendanceService } from './attendance.service';
import { AttendanceController } from './attendance.controller';

@Module({
  imports: [NotificationsModule],
  providers: [AttendanceService],
  controllers: [AttendanceController],
})
export class AttendanceModule {}

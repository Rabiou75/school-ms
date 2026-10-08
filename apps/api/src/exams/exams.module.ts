import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { ExamsService } from './exams.service';
import { ExamsController } from './exams.controller';
import { ReportCardService } from './report-card.service';

@Module({
  imports: [NotificationsModule],
  providers: [ExamsService, ReportCardService],
  controllers: [ExamsController],
})
export class ExamsModule {}

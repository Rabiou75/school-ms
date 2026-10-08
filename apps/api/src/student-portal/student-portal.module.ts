import { Module } from '@nestjs/common';
import { StudentPortalService } from './student-portal.service';
import { StudentPortalController } from './student-portal.controller';

@Module({
  providers: [StudentPortalService],
  controllers: [StudentPortalController],
})
export class StudentPortalModule {}

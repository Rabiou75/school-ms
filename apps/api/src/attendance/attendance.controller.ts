import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../common/pipes/zod.pipe';
import {
  markAttendanceSchema, bulkAttendanceSchema,
  MarkAttendanceDto, BulkAttendanceDto,
} from '@school/shared';

@UseGuards(JwtAuthGuard)
@Controller('attendance')
export class AttendanceController {
  constructor(private svc: AttendanceService) {}

  @Get()
  sheet(
    @Req() req: any,
    @Query('date') date: string,
    @Query('classId') classId?: string,
  ) {
    const d = date || new Date().toISOString().slice(0, 10);
    return this.svc.sheet(req.user.schoolId, d, classId);
  }

  @Get('summary')
  summary(@Req() req: any, @Query('date') date: string) {
    const d = date || new Date().toISOString().slice(0, 10);
    return this.svc.summary(req.user.schoolId, d);
  }

  @Post()
  mark(@Req() req: any, @Body(new ZodValidationPipe(markAttendanceSchema)) dto: MarkAttendanceDto) {
    return this.svc.mark(req.user.schoolId, dto);
  }

  @Post('bulk')
  bulk(@Req() req: any, @Body(new ZodValidationPipe(bulkAttendanceSchema)) dto: BulkAttendanceDto) {
    return this.svc.bulk(req.user.schoolId, dto);
  }
}

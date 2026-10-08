import { Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { TimetableService } from './timetable.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('timetable')
export class TimetableController {
  constructor(private svc: TimetableService) {}

  @Get('class/:classId')
  byClass(@Param('classId') classId: string) { return this.svc.listByClass(classId); }

  @Get('teacher/:teacherId')
  byTeacher(@Param('teacherId') teacherId: string) { return this.svc.listByTeacher(teacherId); }

  @Post()
  create(@Req() req: any, @Body() dto: any) { return this.svc.create(req.user.schoolId, dto); }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: any) { return this.svc.update(id, dto); }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.svc.remove(id); }
}

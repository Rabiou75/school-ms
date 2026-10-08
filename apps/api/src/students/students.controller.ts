import { Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { StudentsService } from './students.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { createStudentSchema, updateStudentSchema } from '@school/shared';
import { ZodValidationPipe } from '../common/pipes/zod.pipe';

@UseGuards(JwtAuthGuard)
@Controller('students')
export class StudentsController {
  constructor(private svc: StudentsService) {}

  @Get()
  list(@Req() req: any) { return this.svc.list(req.user.schoolId); }

  @Get(':id')
  get(@Param('id') id: string) { return this.svc.get(id); }

  @Post()
  create(@Req() req: any, @Body(new ZodValidationPipe(createStudentSchema)) dto: any) {
    return this.svc.create(req.user.schoolId, dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body(new ZodValidationPipe(updateStudentSchema)) dto: any) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.svc.remove(id); }
}

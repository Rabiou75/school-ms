import { Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { SubjectsService } from './subjects.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../common/pipes/zod.pipe';
import { createSubjectSchema, updateSubjectSchema, CreateSubjectDto, UpdateSubjectDto } from '@school/shared';

@UseGuards(JwtAuthGuard)
@Controller('subjects')
export class SubjectsController {
  constructor(private svc: SubjectsService) {}

  @Get()
  list(@Req() req: any) { return this.svc.list(req.user.schoolId); }

  @Post()
  create(@Req() req: any, @Body(new ZodValidationPipe(createSubjectSchema)) dto: CreateSubjectDto) {
    return this.svc.create(req.user.schoolId, dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body(new ZodValidationPipe(updateSubjectSchema)) dto: UpdateSubjectDto) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}

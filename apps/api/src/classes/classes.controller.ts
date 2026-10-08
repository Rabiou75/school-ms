import { Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { ClassesService } from './classes.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../common/pipes/zod.pipe';
import { createClassSchema, updateClassSchema, CreateClassDto, UpdateClassDto } from '@school/shared';

@UseGuards(JwtAuthGuard)
@Controller('classes')
export class ClassesController {
  constructor(private svc: ClassesService) {}

  @Get()
  list(@Req() req: any) { return this.svc.list(req.user.schoolId); }

  @Post()
  create(@Req() req: any, @Body(new ZodValidationPipe(createClassSchema)) dto: CreateClassDto) {
    return this.svc.create(req.user.schoolId, dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body(new ZodValidationPipe(updateClassSchema)) dto: UpdateClassDto) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}

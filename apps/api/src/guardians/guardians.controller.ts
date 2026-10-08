import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { GuardiansService } from './guardians.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../common/pipes/zod.pipe';
import {
  createGuardianSchema, updateGuardianSchema,
  CreateGuardianDto, UpdateGuardianDto,
} from '@school/shared';

@UseGuards(JwtAuthGuard)
@Controller('guardians')
export class GuardiansController {
  constructor(private svc: GuardiansService) {}

  @Get()
  list(@Req() req: any, @Query('q') q?: string) {
    return this.svc.list(req.user.schoolId, q);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.svc.get(id);
  }

  @Post()
  create(@Req() req: any, @Body(new ZodValidationPipe(createGuardianSchema)) dto: CreateGuardianDto) {
    return this.svc.create(req.user.schoolId, dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body(new ZodValidationPipe(updateGuardianSchema)) dto: UpdateGuardianDto) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}

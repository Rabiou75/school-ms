import { Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { StaffService } from './staff.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../common/pipes/zod.pipe';
import { createStaffSchema, updateStaffSchema, CreateStaffDto, UpdateStaffDto } from '@school/shared';

@UseGuards(JwtAuthGuard)
@Controller('staff')
export class StaffController {
  constructor(private svc: StaffService) {}

  @Get()
  list(@Req() req: any) { return this.svc.list(req.user.schoolId); }

  @Post()
  create(@Req() req: any, @Body(new ZodValidationPipe(createStaffSchema)) dto: CreateStaffDto) {
    return this.svc.create(req.user.schoolId, dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body(new ZodValidationPipe(updateStaffSchema)) dto: UpdateStaffDto) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}

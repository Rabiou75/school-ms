import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { SystemService } from './system.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('system')
export class SystemController {
  constructor(private svc: SystemService) {}

  @Get('about')
  about(@Req() req: any) {
    return this.svc.about(req.user.schoolId);
  }
}

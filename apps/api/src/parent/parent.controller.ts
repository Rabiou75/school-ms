import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { ParentService } from './parent.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('parent')
export class ParentController {
  constructor(private svc: ParentService) {}

  @Get('me')
  me(@Req() req: any) { return this.svc.me(req.user.sub); }

  @Get('children/:id/grades')
  grades(@Req() req: any, @Param('id') id: string) {
    return this.svc.grades(req.user.sub, id);
  }

  @Get('children/:id/invoices')
  invoices(@Req() req: any, @Param('id') id: string) {
    return this.svc.invoices(req.user.sub, id);
  }

  @Get('children/:id/attendance')
  attendance(@Req() req: any, @Param('id') id: string) {
    return this.svc.attendance(req.user.sub, id);
  }

  @Get('announcements')
  announcements(@Req() req: any) {
    return this.svc.announcements(req.user.sub);
  }
}

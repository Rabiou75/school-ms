import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { StudentPortalService } from './student-portal.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('student')
export class StudentPortalController {
  constructor(private svc: StudentPortalService) {}

  @Get('me')            profile(@Req() req: any)       { return this.svc.profile(req.user.sub); }
  @Get('grades')        grades(@Req() req: any)        { return this.svc.grades(req.user.sub); }
  @Get('invoices')      invoices(@Req() req: any)      { return this.svc.invoices(req.user.sub); }
  @Get('attendance')    attendance(@Req() req: any)    { return this.svc.attendance(req.user.sub); }
  @Get('announcements') announcements(@Req() req: any) { return this.svc.announcements(req.user.sub); }
}

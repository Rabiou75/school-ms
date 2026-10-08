import { Body, Controller, Get, Param, Post, Put, Req, UseGuards, Delete } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('settings')
export class SettingsController {
  constructor(private svc: SettingsService) {}

  // --- School profile ---
  @Get('school')
  getSchool(@Req() req: any) { return this.svc.getSchool(req.user.schoolId); }

  @Put('school')
  updateSchool(@Req() req: any, @Body() dto: any) { return this.svc.updateSchool(req.user.schoolId, dto); }

  // --- Integrations ---
  @Get('integrations')
  getIntegrations(@Req() req: any) { return this.svc.getIntegrations(req.user.schoolId); }

  @Put('integrations')
  saveIntegrations(@Req() req: any, @Body() dto: any) { return this.svc.saveIntegrations(req.user.schoolId, dto); }

  // --- Users & roles ---
  @Get('users')
  listUsers(@Req() req: any) { return this.svc.listUsers(req.user.schoolId); }

  @Post('users')
  createUser(@Req() req: any, @Body() dto: any) {
    return this.svc.createUser(req.user.schoolId, dto);
  }

  @Put('users/:id')
  updateUser(@Req() req: any, @Param('id') id: string, @Body() dto: any) {
    return this.svc.updateUser(id, dto, req.user.sub);
  }

  @Delete('users/:id')
  deleteUser(@Req() req: any, @Param('id') id: string) {
    return this.svc.deleteUser(id, req.user.sub);
  }

  @Post('users/:id/reset-password')
  resetPassword(@Param('id') id: string, @Body() body: { newPassword: string }) {
    return this.svc.resetUserPassword(id, body.newPassword);
  }

  // --- My account ---
  @Post('account/password')
  changeOwnPassword(@Req() req: any, @Body() body: { currentPassword: string; newPassword: string }) {
    return this.svc.changeOwnPassword(req.user.sub, body.currentPassword, body.newPassword);
  }

  @Put('account/profile')
  updateOwnProfile(@Req() req: any, @Body() dto: any) {
    return this.svc.updateOwnProfile(req.user.sub, dto);
  }

  // --- Academic years ---
  @Get('academic-years')
  listYears(@Req() req: any) { return this.svc.listAcademicYears(req.user.schoolId); }

  @Post('academic-years')
  createYear(@Req() req: any, @Body() dto: any) { return this.svc.createAcademicYear(req.user.schoolId, dto); }

  @Post('academic-years/:id/set-current')
  setCurrent(@Req() req: any, @Param('id') id: string) { return this.svc.setCurrentYear(req.user.schoolId, id); }
}

import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { SystemService } from './system.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('system')
export class SystemController {
  constructor(private svc: SystemService) {}

  /** Public — no auth. Desktop and web both call this on load. */
  @Get('setup-status')
  async setupStatus() {
    return { needsSetup: await this.svc.needsSetup() };
  }

  /** Public — no auth. Creates the first school + admin. Fails if already done. */
  @Post('setup')
  setup(@Body() body: any) {
    return this.svc.setup(body);
  }

  /** Public — creates a demo school quickly. */
  @Post('setup-demo')
  setupDemo() {
    return this.svc.setupDemo();
  }

  /** Auth required. */
  @UseGuards(JwtAuthGuard)
  @Get('about')
  about(@Req() req: any) {
    return this.svc.about(req.user.schoolId);
  }
}

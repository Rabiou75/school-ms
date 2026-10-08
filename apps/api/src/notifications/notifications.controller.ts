import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private svc: NotificationsService) {}

  @Get()
  list(@Req() req: any, @Query('unread') unread?: string) {
    return this.svc.list(req.user.sub, { unreadOnly: unread === '1' });
  }

  @Get('unread-count')
  unread(@Req() req: any) {
    return this.svc.unreadCount(req.user.sub);
  }

  @Post(':id/read')
  markRead(@Req() req: any, @Param('id') id: string) {
    return this.svc.markRead(req.user.sub, id);
  }

  @Post('read-all')
  markAllRead(@Req() req: any) {
    return this.svc.markAllRead(req.user.sub);
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.svc.remove(req.user.sub, id);
  }

  @Delete()
  clearAll(@Req() req: any) {
    return this.svc.clearAll(req.user.sub);
  }

  /** Send a test notification to yourself — verifies SMTP/SMS config end to end */
  @Post('test')
  sendTest(@Req() req: any) {
    return this.svc.sendTest(req.user.sub);
  }

  /** Send a manual notification to any user (admin action) */
  @Post('send')
  send(@Req() req: any, @Body() body: {
    userId: string;
    title: string;
    body: string;
    link?: string;
    channels?: Array<'IN_APP' | 'EMAIL' | 'SMS'>;
  }) {
    return this.svc.dispatch({
      userId: body.userId,
      schoolId: req.user.schoolId,
      type: 'MANUAL',
      title: body.title,
      body: body.body,
      link: body.link,
      channels: body.channels,
    });
  }

  /** Notification log (admin) */
  @Get('logs')
  logs(@Req() req: any) {
    return this.svc.listLogs(req.user.schoolId);
  }
  @Post('test-email')
  testEmail(@Req() req: any, @Body() body: { to: string }) {
    return this.svc.testEmail(req.user.sub, body.to);
  }

}

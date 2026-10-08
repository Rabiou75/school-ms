import { Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { AnnouncementsService } from './announcements.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('announcements')
export class AnnouncementsController {
  constructor(private svc: AnnouncementsService) {}

  @Get()
  list(@Req() req: any) { return this.svc.list(req.user.schoolId); }

  @Get(':id')
  get(@Param('id') id: string) { return this.svc.get(id); }

  @Post()
  create(@Req() req: any, @Body() dto: any) { return this.svc.create(req.user.schoolId, dto, req.user.sub); }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: any) { return this.svc.update(id, dto); }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.svc.remove(id); }

  @Post(':id/rebroadcast')
  rebroadcast(@Param('id') id: string, @Body() body: { channels?: string[] }) {
    return this.svc.rebroadcast(id, body.channels ?? ['IN_APP']);
  }
}

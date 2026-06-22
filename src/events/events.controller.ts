import { Controller, Post, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EventsService } from './events.service';
import { ReportEventDto } from './dto/report-event.dto';

@ApiBearerAuth()
@ApiTags('Events')
@Controller('player/:playerId/events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  @ApiOperation({ summary: '上报事件，触发小满主动消息' })
  async reportEvent(
    @Param('playerId') playerId: string,
    @Body() dto: ReportEventDto,
  ) {
    return this.eventsService.reportEvent(playerId, dto);
  }
}

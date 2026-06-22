import { Controller, Get, Post, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { MessagesService } from './messages.service';
import { ListMessagesQueryDto } from './dto/list-messages.dto';

@ApiTags('Messages')
@Controller('player/:playerId/messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get()
  @ApiOperation({
    summary: '获取小满的全部主动消息（分页，可按已读/未读筛选）',
  })
  async list(
    @Param('playerId') playerId: string,
    @Query() query: ListMessagesQueryDto,
  ) {
    return this.messagesService.list(
      playerId,
      query.page ?? 1,
      query.pageSize ?? 20,
      query.status ?? 'all',
    );
  }

  @Get('pending')
  @ApiOperation({ summary: '获取小满的未读主动消息' })
  async getPending(@Param('playerId') playerId: string) {
    return this.messagesService.getPending(playerId);
  }

  @Post(':id/read')
  @ApiOperation({ summary: '标记主动消息为已读' })
  async markRead(
    @Param('playerId') playerId: string,
    @Param('id') id: string,
  ) {
    return this.messagesService.markRead(playerId, id);
  }
}

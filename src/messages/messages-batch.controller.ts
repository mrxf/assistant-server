import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { MessagesService } from './messages.service';
import { UnreadCountsDto } from './dto/unread-counts.dto';

@ApiTags('Messages')
@Controller('messages')
export class MessagesBatchController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post('unread-counts')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '批量获取多个玩家的未读主动消息数（用于玩家列表的未读角标）',
  })
  async getUnreadCounts(@Body() dto: UnreadCountsDto) {
    return this.messagesService.getUnreadCounts(dto.playerIds);
  }
}

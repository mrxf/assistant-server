import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { NpcService } from './npc.service';

@ApiTags('NPC')
@Controller('player/:playerId/npc')
export class NpcController {
  constructor(private readonly npcService: NpcService) {}

  @Get('status')
  @ApiOperation({ summary: '获取小满当前情绪和关系状态' })
  async getStatus(@Param('playerId') playerId: string) {
    return this.npcService.getStatus(playerId);
  }
}

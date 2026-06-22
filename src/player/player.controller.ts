import { Controller, Get, Put, Delete, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PlayerService } from './player.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { AdminOnly } from '../auth/decorators';

@ApiBearerAuth()
@ApiTags('Players')
@Controller()
export class PlayerController {
  constructor(private readonly playerService: PlayerService) {}

  @AdminOnly()
  @Get('players')
  @ApiOperation({ summary: '列出所有 Player（管理员）' })
  async list() {
    return this.playerService.list();
  }

  @AdminOnly()
  @Delete('players/:playerId')
  @ApiOperation({ summary: '删除 Player 及其所有数据（管理员）' })
  async delete(@Param('playerId') playerId: string) {
    return this.playerService.delete(playerId);
  }

  @Get('player/:playerId/profile')
  @ApiOperation({ summary: '获取玩家档案' })
  async getProfile(@Param('playerId') playerId: string) {
    return this.playerService.getProfile(playerId);
  }

  @Put('player/:playerId/profile')
  @ApiOperation({ summary: '更新玩家档案' })
  async updateProfile(
    @Param('playerId') playerId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.playerService.updateProfile(playerId, dto);
  }
}

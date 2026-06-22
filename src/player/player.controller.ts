import { Controller, Get, Put, Post, Delete, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PlayerService } from './player.service';
import { CreatePlayerDto } from './dto/create-player.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@ApiTags('Players')
@Controller()
export class PlayerController {
  constructor(private readonly playerService: PlayerService) {}

  @Post('players')
  @ApiOperation({ summary: '创建新 Player' })
  async create(@Body() dto: CreatePlayerDto) {
    return this.playerService.create(dto.id, dto.nickname);
  }

  @Get('players')
  @ApiOperation({ summary: '列出所有 Player' })
  async list() {
    return this.playerService.list();
  }

  @Delete('players/:playerId')
  @ApiOperation({ summary: '删除 Player 及其所有数据' })
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

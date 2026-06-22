import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AgentPoolService } from '../agent/agent-pool.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

export interface PlayerProfileResponse {
  nickname: string;
  birthday: string | null;
  customFields: Record<string, unknown>;
}

export interface PlayerListItem {
  id: string;
  nickname: string;
  createdAt: string;
}

@Injectable()
export class PlayerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly agentPool: AgentPoolService,
  ) {}

  async list(): Promise<{ data: PlayerListItem[] }> {
    const players = await this.prisma.player.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return {
      data: players.map((p) => ({
        id: p.id,
        nickname: p.nickname,
        createdAt: p.createdAt.toISOString(),
      })),
    };
  }

  async delete(playerId: string): Promise<{ success: boolean; message: string }> {
    const existing = await this.prisma.player.findUnique({ where: { id: playerId } });
    if (!existing) {
      throw new NotFoundException(`Player "${playerId}" not found`);
    }

    await this.agentPool.destroyAgent(playerId);
    await this.prisma.player.delete({ where: { id: playerId } });

    return { success: true, message: `Player ${playerId} and all associated data deleted` };
  }

  async getProfile(playerId: string): Promise<PlayerProfileResponse> {
    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
    });

    if (!player) {
      throw new NotFoundException(`Player "${playerId}" not found`);
    }

    return {
      nickname: player.nickname,
      birthday: player.birthday,
      customFields: JSON.parse(player.customFields),
    };
  }

  async updateProfile(playerId: string, dto: UpdateProfileDto): Promise<PlayerProfileResponse> {
    const existing = await this.prisma.player.findUnique({ where: { id: playerId } });
    if (!existing) {
      throw new NotFoundException(`Player "${playerId}" not found`);
    }

    const data: Record<string, unknown> = {};
    if (dto.nickname !== undefined) data.nickname = dto.nickname;
    if (dto.birthday !== undefined) data.birthday = dto.birthday;
    if (dto.customFields !== undefined) data.customFields = JSON.stringify(dto.customFields);

    const player = await this.prisma.player.update({
      where: { id: playerId },
      data,
    });

    return {
      nickname: player.nickname,
      birthday: player.birthday,
      customFields: JSON.parse(player.customFields),
    };
  }

  async ensureExists(playerId: string): Promise<void> {
    const player = await this.prisma.player.findUnique({ where: { id: playerId } });
    if (!player) {
      throw new NotFoundException(`Player "${playerId}" not found`);
    }
  }
}

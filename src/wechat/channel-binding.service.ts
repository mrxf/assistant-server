import { Injectable, NotFoundException } from '@nestjs/common';
import type { ChannelAddress } from '@innerlife/channel';
import { PrismaService } from '../prisma/prisma.service';

export interface ResolvedBinding {
  playerId: string;
  accountId: string;
}

/**
 * Maps a channel identity (e.g. WeChat peerId) ↔ an assistant playerId.
 * The authority `resolveAgent` and proactive sends consult. Pure domain logic;
 * channel-agnostic except that callers pass the channelId.
 */
@Injectable()
export class ChannelBindingService {
  constructor(private readonly prisma: PrismaService) {}

  /** Who is this channel peer? Null if not bound. */
  async resolve(channelId: string, peerId: string): Promise<ResolvedBinding | null> {
    return this.prisma.channelBinding.findUnique({
      where: { channelId_peerId: { channelId, peerId } },
      select: { playerId: true, accountId: true },
    });
  }

  /**
   * Bind (or re-bind) a channel identity to a player. Re-binding the same peer
   * moves it to the new player. Throws if the player does not exist.
   */
  async bind(input: { channelId: string; peerId: string; playerId: string; accountId: string }): Promise<void> {
    const { channelId, peerId, playerId, accountId } = input;
    const player = await this.prisma.player.findUnique({ where: { id: playerId }, select: { id: true } });
    if (!player) throw new NotFoundException(`Player "${playerId}" not found`);

    await this.prisma.channelBinding.upsert({
      where: { channelId_peerId: { channelId, peerId } },
      create: { channelId, peerId, playerId, accountId, lastActiveAt: new Date() },
      update: { playerId, accountId },
    });
  }

  /** Mark a binding active (called on each inbound) to drive proactive targeting. */
  async touch(channelId: string, peerId: string): Promise<void> {
    await this.prisma.channelBinding.updateMany({
      where: { channelId, peerId },
      data: { lastActiveAt: new Date() },
    });
  }

  /** Reverse lookup for proactive sends: the player's most-recently-active binding. */
  async addressForPlayer(playerId: string): Promise<ChannelAddress | null> {
    const binding = await this.prisma.channelBinding.findFirst({
      where: { playerId },
      // SQLite sorts NULLs first; DESC therefore puts active bindings ahead of never-active ones.
      orderBy: [{ lastActiveAt: 'desc' }, { createdAt: 'desc' }],
    });
    if (!binding) return null;
    return {
      channelId: binding.channelId,
      accountId: binding.accountId,
      peerId: binding.peerId,
      chatType: 'direct',
    };
  }

  async unbind(channelId: string, peerId: string): Promise<void> {
    await this.prisma.channelBinding.deleteMany({ where: { channelId, peerId } });
  }
}

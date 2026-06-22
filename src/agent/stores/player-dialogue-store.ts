import type { PrismaService } from '../../prisma/prisma.service';
import type { DialogueStore, DialogueEntry, DialogueQuery } from '@innerlife/agent';
import { AGENT_ID, GAME_SYSTEM_SOURCE } from '../agent.constants';

/**
 * Per-player DialogueStore backed by Prisma.
 * Each instance is scoped to a specific playerId — all reads/writes
 * are filtered by that player, achieving hard isolation.
 */
export class PlayerDialogueStore implements DialogueStore {
  constructor(
    private readonly prisma: PrismaService,
    private readonly playerId: string,
  ) {}

  async append(entries: DialogueEntry[]): Promise<void> {
    for (const entry of entries) {
      if (!this.shouldPersist(entry)) {
        continue;
      }
      await this.prisma.dialogueEntry.create({
        data: {
          id: entry.id,
          playerId: this.playerId,
          role: entry.role,
          content: entry.content,
          turnIndex: entry.turnIndex ?? 0,
        },
      });
    }
  }

  /**
   * Decide whether a dialogue entry should land in the player-facing history.
   *
   * The framework's `Runner` always records both sides of a turn (incoming +
   * outgoing) via a single `DialogueHistory.record` call. For system-reported
   * events we want the *trigger text* kept out of the chat transcript:
   * it still feeds emotion and long-term memory (those are written by
   * `MemoryCore` independently of this store), but it must not surface as a
   * chat bubble. 小满's reply is `outgoing`/`source === AGENT_ID`, so it is
   * always retained and delivered as a ProactiveMessage.
   */
  private shouldPersist(entry: DialogueEntry): boolean {
    // 系统上报的事件原文(incoming + system-event)不进对话历史。
    if (entry.role === 'incoming' && entry.source === GAME_SYSTEM_SOURCE) {
      return false;
    }
    // 静默轮产生的空回复不写入，避免历史里出现空气泡。
    if (entry.role === 'outgoing' && !entry.content.trim()) {
      return false;
    }
    return true;
  }

  async query(q: DialogueQuery): Promise<DialogueEntry[]> {
    const rows = await this.prisma.dialogueEntry.findMany({
      where: { playerId: this.playerId },
      orderBy: { createdAt: 'desc' },
      take: q.limit ?? 40,
    });

    return rows.map((r) => ({
      id: r.id,
      role: r.role as DialogueEntry['role'],
      source: r.role === 'incoming' ? this.playerId : AGENT_ID,
      sourceName: r.role === 'incoming' ? '用户' : '小满',
      content: r.content,
      timestamp: r.createdAt.getTime(),
      turnIndex: r.turnIndex,
    }));
  }

  async getByTickId(_tickId: string): Promise<DialogueEntry[]> {
    return [];
  }

  async getByIds(ids: string[]): Promise<DialogueEntry[]> {
    const rows = await this.prisma.dialogueEntry.findMany({
      where: { id: { in: ids }, playerId: this.playerId },
    });

    return rows.map((r) => ({
      id: r.id,
      role: r.role as DialogueEntry['role'],
      source: r.role === 'incoming' ? this.playerId : AGENT_ID,
      sourceName: r.role === 'incoming' ? '用户' : '小满',
      content: r.content,
      timestamp: r.createdAt.getTime(),
      turnIndex: r.turnIndex,
    }));
  }

  async count(): Promise<number> {
    return this.prisma.dialogueEntry.count({
      where: { playerId: this.playerId },
    });
  }

  async getLatestTurnIndex(): Promise<number> {
    const latest = await this.prisma.dialogueEntry.findFirst({
      where: { playerId: this.playerId },
      orderBy: { turnIndex: 'desc' },
      select: { turnIndex: true },
    });
    return latest?.turnIndex ?? 0;
  }
}

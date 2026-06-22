import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AgentRunnerService, type TurnCallbacks } from '../agent/agent-runner.service';
import { PlayerService } from '../player/player.service';
import type { TurnResult } from '@innerlife/agent';

export interface ChatHistoryItem {
  id: string;
  role: 'player' | 'npc';
  content: string;
  expression?: { face?: string; action?: string; posture?: string } | null;
  emotion?: Record<string, number> | null;
  timestamp: string;
}

export interface ChatHistoryResponse {
  data: ChatHistoryItem[];
  /** 是否还有更早的历史可继续向上加载。 */
  hasMore: boolean;
}

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly agentRunner: AgentRunnerService,
    private readonly playerService: PlayerService,
  ) {}

  async sendMessage(playerId: string, content: string, callbacks?: TurnCallbacks): Promise<TurnResult> {
    const profile = await this.playerService.getProfile(playerId);

    return this.agentRunner.runChatTurn(
      {
        playerId,
        content,
        playerNickname: profile?.nickname || undefined,
      },
      callbacks,
    );
  }

  /**
   * 游标分页的对话历史，服务于「向上滚动加载更早消息」的交互。
   *
   * @param before 游标：上一批最旧一条的 timestamp（ISO 8601）。不传则取最新一批。
   * @param limit  本次返回条数（1–100）。
   *
   * 返回的 `data` 按时间正序（旧 → 新），便于前端整块 prepend 到列表顶部。
   * 多取一条用于判断 `hasMore`，避免额外的 count 查询。
   */
  async getHistory(playerId: string, before: string | undefined, limit: number): Promise<ChatHistoryResponse> {
    const entries = await this.prisma.dialogueEntry.findMany({
      where: {
        playerId,
        // 严格小于游标，保证游标那一条不会被重复返回。
        ...(before ? { createdAt: { lt: new Date(before) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
    });

    const hasMore = entries.length > limit;
    // 丢弃多取的探测条，再翻成正序（旧 → 新）。
    const page = (hasMore ? entries.slice(0, limit) : entries).reverse();

    const data: ChatHistoryItem[] = page.map((e) => ({
      id: e.id,
      role: e.role === 'incoming' ? 'player' : 'npc',
      content: e.content,
      expression: e.expression ? JSON.parse(e.expression) : null,
      emotion: e.emotion ? JSON.parse(e.emotion) : null,
      timestamp: e.createdAt.toISOString(),
    }));

    return { data, hasMore };
  }
}

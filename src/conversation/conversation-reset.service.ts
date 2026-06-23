import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** 触发「开启新对话」的指令。#new 不区分大小写。 */
const TRIGGERS = ['#新对话', '#new'];

const RESET_REPLY =
  '已开启新对话。之前的聊天内容不会再带入后续对话，不过我对你的长期记忆、印象和心情都还在。';

export interface InterceptResult {
  handled: boolean;
  reply?: string;
}

/**
 * `#新对话` / `#new` 指令拦截。
 *
 * 把当前玩家最新的 turnIndex 记为「对话边界」，写入 `Player.dialogueResetTurnIndex`。
 * 之后 `PlayerDialogueStore.query()` 只会向模型 prompt 注入 turnIndex 严格大于该边界的历史，
 * 从而实现「之前的对话历史不再带上」。
 *
 * 注意：这只屏蔽喂给模型的逐字对话历史。长期记忆（SemanticFact / EpisodeRecord）、
 * 情绪、关系状态均保留；前端历史列表（GET /history）也不受影响，照常全量滚动展示。
 */
@Injectable()
export class ConversationResetService {
  private readonly logger = new Logger(ConversationResetService.name);

  constructor(private readonly prisma: PrismaService) {}

  async intercept(playerId: string, text: string): Promise<InterceptResult> {
    const trimmed = text.trim().toLowerCase();
    if (!TRIGGERS.includes(trimmed)) {
      return { handled: false };
    }

    // 边界取当前最新 turnIndex；turnIndex 单调递增，之后产生的对话必然 > 边界。
    const latest = await this.prisma.dialogueEntry.findFirst({
      where: { playerId },
      orderBy: { turnIndex: 'desc' },
      select: { turnIndex: true },
    });
    const boundary = latest?.turnIndex ?? 0;

    await this.prisma.player.update({
      where: { id: playerId },
      data: { dialogueResetTurnIndex: boundary },
    });

    this.logger.log(`New conversation started for player ${playerId} at turnIndex ${boundary}`);
    return { handled: true, reply: RESET_REPLY };
  }
}

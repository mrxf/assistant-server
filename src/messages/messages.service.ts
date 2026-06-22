import { Injectable } from '@nestjs/common';
import { Prisma, ProactiveMessage } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MessageStatusFilter } from './dto/list-messages.dto';

export interface PendingMessage {
  id: string;
  content: string;
  expression?: { face?: string; action?: string; posture?: string } | null;
  emotion?: Record<string, number> | null;
  triggeredBy: string;
  /** 触发该消息的事件描述文本（事件上报时的 text）。 */
  triggerText?: string | null;
  /** 触发该消息的事件元数据（事件上报时的 metadata）。 */
  triggerMetadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface MessageItem extends PendingMessage {
  isRead: boolean;
}

export interface ListMessagesResponse {
  data: MessageItem[];
  total: number;
  unreadCount: number;
  page: number;
  pageSize: number;
}

export interface PlayerUnreadCount {
  playerId: string;
  unreadCount: number;
}

export interface UnreadCountsResponse {
  data: PlayerUnreadCount[];
}

@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService) {}

  /** 将 Prisma 记录映射为对外的消息对象，统一 JSON 字段解析与时间格式化。 */
  private toMessageItem(m: ProactiveMessage): MessageItem {
    return {
      id: m.id,
      content: m.content,
      expression: m.expression ? JSON.parse(m.expression) : null,
      emotion: m.emotion ? JSON.parse(m.emotion) : null,
      triggeredBy: m.triggeredBy,
      triggerText: m.triggerText,
      triggerMetadata: m.triggerMetadata ? JSON.parse(m.triggerMetadata) : null,
      createdAt: m.createdAt.toISOString(),
      isRead: m.isRead,
    };
  }

  async getPending(playerId: string): Promise<{ data: MessageItem[] }> {
    const messages = await this.prisma.proactiveMessage.findMany({
      where: { playerId, isRead: false },
      orderBy: { createdAt: 'desc' },
    });

    return { data: messages.map((m) => this.toMessageItem(m)) };
  }

  async list(
    playerId: string,
    page: number,
    pageSize: number,
    status: MessageStatusFilter,
  ): Promise<ListMessagesResponse> {
    const where: Prisma.ProactiveMessageWhereInput = { playerId };
    if (status === 'read') where.isRead = true;
    else if (status === 'unread') where.isRead = false;

    const skip = (page - 1) * pageSize;

    const [messages, total, unreadCount] = await this.prisma.$transaction([
      this.prisma.proactiveMessage.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: pageSize,
        skip,
      }),
      this.prisma.proactiveMessage.count({ where }),
      this.prisma.proactiveMessage.count({ where: { playerId, isRead: false } }),
    ]);

    return {
      data: messages.map((m) => this.toMessageItem(m)),
      total,
      unreadCount,
      page,
      pageSize,
    };
  }

  /**
   * 批量查询多个玩家的未读消息数。
   * 单次 groupBy 聚合，未命中（无未读消息）的玩家补 0；
   * 返回结果按请求顺序去重排列，便于客户端直接渲染玩家列表的未读角标。
   */
  async getUnreadCounts(playerIds: string[]): Promise<UnreadCountsResponse> {
    const uniqueIds = [...new Set(playerIds)];

    const grouped = await this.prisma.proactiveMessage.groupBy({
      by: ['playerId'],
      where: { playerId: { in: uniqueIds }, isRead: false },
      _count: { _all: true },
    });

    const countByPlayer = new Map(
      grouped.map((g) => [g.playerId, g._count._all]),
    );

    return {
      data: uniqueIds.map((playerId) => ({
        playerId,
        unreadCount: countByPlayer.get(playerId) ?? 0,
      })),
    };
  }

  async markRead(playerId: string, id: string): Promise<{ success: boolean }> {
    await this.prisma.proactiveMessage.updateMany({
      where: { id, playerId },
      data: { isRead: true },
    });
    return { success: true };
  }
}

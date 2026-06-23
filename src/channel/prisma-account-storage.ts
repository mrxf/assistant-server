import { Injectable } from '@nestjs/common';
import type { AccountRecord, AccountStorage } from '@innerlife/channel';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Prisma-backed {@link AccountStorage} for @innerlife/channel. Channel-agnostic:
 * the credential `data` blob is opaque (stored as a JSON string, consistent with
 * this DB's SQLite String-JSON convention). Reusable for any future channel.
 */
@Injectable()
export class PrismaAccountStorage implements AccountStorage {
  constructor(private readonly prisma: PrismaService) {}

  async list(channelId: string): Promise<string[]> {
    // 跳过被标记 disabled 的账户：会话过期(needs-login)后不再加载，下次启动也不再轮询/校验。
    const rows = await this.prisma.channelAccount.findMany({
      where: { channelId, disabled: false },
      select: { accountId: true },
    });
    return rows.map((r) => r.accountId);
  }

  async load(channelId: string, accountId: string): Promise<AccountRecord | null> {
    const row = await this.prisma.channelAccount.findUnique({
      where: { channelId_accountId: { channelId, accountId } },
    });
    if (!row) return null;
    return {
      channelId: row.channelId,
      accountId: row.accountId,
      data: parseData(row.data),
      updatedAt: row.updatedAt.getTime(),
    };
  }

  async save(channelId: string, accountId: string, data: unknown): Promise<void> {
    const json = JSON.stringify(data ?? {});
    // 重新登录会再次 save 新凭据：顺带复位 disabled，让此前过期被禁用的账户自动恢复。
    await this.prisma.channelAccount.upsert({
      where: { channelId_accountId: { channelId, accountId } },
      create: { channelId, accountId, data: json },
      update: { data: json, disabled: false },
    });
  }

  async delete(channelId: string, accountId: string): Promise<void> {
    await this.prisma.channelAccount.deleteMany({ where: { channelId, accountId } });
  }

  /**
   * 标记账户为禁用（会话过期 / needs-login）。下次 `list()` 不再返回它，
   * 因此服务端重启后不会再为该账户启动轮询。重新登录（save）会复位。
   */
  async markDisabled(channelId: string, accountId: string): Promise<void> {
    await this.prisma.channelAccount.updateMany({
      where: { channelId, accountId },
      data: { disabled: true },
    });
  }
}

function parseData(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

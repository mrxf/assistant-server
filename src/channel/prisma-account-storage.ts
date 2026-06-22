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
    const rows = await this.prisma.channelAccount.findMany({
      where: { channelId },
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
    await this.prisma.channelAccount.upsert({
      where: { channelId_accountId: { channelId, accountId } },
      create: { channelId, accountId, data: json },
      update: { data: json },
    });
  }

  async delete(channelId: string, accountId: string): Promise<void> {
    await this.prisma.channelAccount.deleteMany({ where: { channelId, accountId } });
  }
}

function parseData(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

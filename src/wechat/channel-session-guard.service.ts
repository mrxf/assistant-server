import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ChannelHost } from '@innerlife/channel-nestjs';
import { PrismaAccountStorage } from '../channel/prisma-account-storage';

/**
 * 监听 ChannelHost 的 `account:status` 事件。当某账户会话过期（status === 'needs-login'，
 * 由 plugin 抛出 NeedsReauthError 触发）时，把它标记为 disabled。
 *
 * 这样服务端下次启动时 `PrismaAccountStorage.list()` 不再返回该账户，也就不会再为它
 * 启动轮询、重复打出 "Session expired — please re-login" 的告警——等同于把它当作
 * 用户已主动取消绑定。用户重新扫码登录会经由 storage.save() 复位 disabled，自动恢复。
 */
@Injectable()
export class ChannelSessionGuard implements OnModuleInit {
  private readonly logger = new Logger(ChannelSessionGuard.name);

  constructor(
    private readonly host: ChannelHost,
    private readonly storage: PrismaAccountStorage,
  ) {}

  onModuleInit(): void {
    // 在 ChannelModule.onApplicationBootstrap()（host.start()）之前注册，避免漏掉早期事件。
    this.host.on('account:status', ({ channelId, accountId, status }) => {
      if (status !== 'needs-login') return;
      void this.storage
        .markDisabled(channelId, accountId)
        .then(() =>
          this.logger.warn(
            `账户会话已过期，已标记禁用，下次启动不再校验：${channelId}:${accountId}`,
          ),
        )
        .catch((err) =>
          this.logger.error(
            `标记禁用失败 ${channelId}:${accountId}: ${err instanceof Error ? err.message : String(err)}`,
          ),
        );
    });
  }
}

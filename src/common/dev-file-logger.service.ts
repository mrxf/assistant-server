import { Injectable, Logger } from '@nestjs/common';
import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * 统一的「开发期文件日志」服务。
 *
 * 任何需要把调试用的大块内容（如 LLM 请求/返回原文）落盘的地方，都注入本服务，
 * 调用 `write(channel, title, body)`：内容会被追加到 `logs/<channel>.log`。
 *
 * - 仅在非 production 环境生效（`NODE_ENV !== 'production'`），生产环境为 no-op。
 * - fire-and-forget：写盘失败只告警，绝不抛回业务调用方。
 */
@Injectable()
export class DevFileLoggerService {
  private readonly logger = new Logger(DevFileLoggerService.name);
  private readonly enabled = process.env.NODE_ENV !== 'production';
  private readonly dir = join(process.cwd(), 'logs');
  private dirReady = false;

  /** 当前是否启用文件日志（调用方可据此跳过昂贵的字符串拼接）。 */
  get isEnabled(): boolean {
    return this.enabled;
  }

  /** 追加一段带时间戳的可读日志块到 `logs/<channel>.log`。 */
  write(channel: string, title: string, body: string): void {
    if (!this.enabled) return;

    const stamp = new Date().toISOString();
    const block = `\n━━━━━━ ${title} · ${stamp} ━━━━━━\n${body}\n`;
    void this.append(channel, block);
  }

  private async append(channel: string, content: string): Promise<void> {
    try {
      if (!this.dirReady) {
        await mkdir(this.dir, { recursive: true });
        this.dirReady = true;
      }
      await appendFile(join(this.dir, `${channel}.log`), content, 'utf-8');
    } catch (err) {
      this.logger.warn(`写入开发日志 "${channel}" 失败：${(err as Error).message}`);
    }
  }
}

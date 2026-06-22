import { Controller, Delete, Param, Post, Res } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import type { Response } from 'express';
import { ChannelHost } from '@innerlife/channel';
import { CHANNEL_ID } from '@innerlife/channel-weixin';
import { ChannelBindingService } from './channel-binding.service';

@ApiBearerAuth()
@ApiTags('WeChat')
@Controller('player/:playerId/wechat')
export class WechatBindController {
  constructor(
    private readonly host: ChannelHost,
    private readonly binding: ChannelBindingService,
  ) {}

  @Post('bind')
  @ApiOperation({ summary: '扫码绑定微信（SSE：qr → bound/error）' })
  async bind(@Param('playerId') playerId: string, @Res() res: Response): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const emit = (event: string, data: unknown): void => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
      const { qr, done, cancel } = await this.host.login(CHANNEL_ID);
      emit('qr', qr);
      // If the client disconnects (closed the QR), cancel the pending login.
      res.on('close', () => cancel());

      const { accountId, userId } = await done;
      if (!userId) {
        emit('error', { message: '扫码未返回用户标识，无法绑定' });
        return;
      }

      await this.binding.bind({ channelId: CHANNEL_ID, peerId: userId, playerId, accountId });
      await this.host.startAccount(CHANNEL_ID, accountId);
      emit('bound', { accountId, peerId: userId });
    } catch (err) {
      emit('error', { message: err instanceof Error ? err.message : String(err) });
    } finally {
      res.end();
    }
  }

  @Delete(':peerId')
  @ApiOperation({ summary: '解绑某个微信身份' })
  async unbind(@Param('peerId') peerId: string): Promise<{ ok: true }> {
    await this.binding.unbind(CHANNEL_ID, peerId);
    return { ok: true };
  }
}

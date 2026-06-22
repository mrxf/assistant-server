import { Controller, Post, Get, Body, Query, Param, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import type { Response } from 'express';
import { ChatService } from './chat.service';
import { MemoryImportService } from '../memory-import/memory-import.service';
import { SendMessageDto } from './dto/send-message.dto';
import { ChatHistoryQueryDto } from './dto/chat-history.dto';

@ApiBearerAuth()
@ApiTags('Chat')
@Controller('player/:playerId/chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly memoryImport: MemoryImportService,
  ) {}

  @Post('send')
  @ApiOperation({ summary: '发送消息（SSE 流式响应）' })
  @ApiResponse({ status: 200, description: 'SSE stream with delta/emotion/expression/done events' })
  async send(
    @Param('playerId') playerId: string,
    @Body() dto: SendMessageDto,
    @Res() res: Response,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const commandResult = await this.memoryImport.intercept(playerId, dto.content);
    if (commandResult.handled) {
      if (commandResult.reply) {
        const chunks = this.splitDialogue(commandResult.reply);
        for (const chunk of chunks) {
          this.emitSSE(res, 'delta', { content: chunk });
        }
      }
      this.emitSSE(res, 'done', {
        messageId: `cmd-${Date.now()}`,
        fullContent: commandResult.reply ?? '',
      });
      res.end();
      return;
    }

    this.emitSSE(res, 'thinking', { status: 'processing' });

    try {
      const result = await this.chatService.sendMessage(playerId, dto.content, {
        onHormone: (event) => {
          this.emitSSE(res, 'emotion', event.deltas);
        },
      });

      const hormoneAlreadyEmitted = (result as any).hormoneAlreadyEmitted;
      if (!hormoneAlreadyEmitted && result.hormoneDeltas && Object.keys(result.hormoneDeltas).length > 0) {
        this.emitSSE(res, 'emotion', result.hormoneDeltas);
      }

      if (result.expression) {
        this.emitSSE(res, 'expression', result.expression);
      }

      if (result.dialogue) {
        const chunks = this.splitDialogue(result.dialogue);
        for (const chunk of chunks) {
          this.emitSSE(res, 'delta', { content: chunk });
        }
      }

      this.emitSSE(res, 'done', {
        messageId: `msg-${Date.now()}`,
        fullContent: result.dialogue || '',
      });
    } catch (error) {
      this.emitSSE(res, 'error', {
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    res.end();
  }

  @Get('history')
  @ApiOperation({ summary: '获取对话历史' })
  async getHistory(
    @Param('playerId') playerId: string,
    @Query() query: ChatHistoryQueryDto,
  ) {
    return this.chatService.getHistory(playerId, query.before, query.limit ?? 20);
  }

  private emitSSE(res: Response, event: string, data: unknown): void {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  private splitDialogue(text: string): string[] {
    const maxChunkSize = 8;
    const chars = [...text];
    const chunks: string[] = [];
    let current = '';

    for (const char of chars) {
      current += char;
      const isPunctuation = '，。！？、；：…'.includes(char);
      if (current.length >= maxChunkSize || isPunctuation) {
        chunks.push(current);
        current = '';
      }
    }

    if (current) {
      chunks.push(current);
    }

    return chunks;
  }
}

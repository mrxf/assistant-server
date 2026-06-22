import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { DebugService } from './debug.service';
import { ConfigService } from '@nestjs/config';
import {
  thinkingExtraBody,
  DEFAULT_THINKING_MODE,
  type ThinkingMode,
} from '../common/llm-thinking';

@ApiTags('Debug')
@Controller()
export class DebugController {
  constructor(
    private readonly debugService: DebugService,
    private readonly configService: ConfigService,
  ) {}

  @Get('player/:playerId/debug/memory')
  @ApiOperation({ summary: '查看指定 Player 的记忆' })
  async getMemory(@Param('playerId') playerId: string) {
    return this.debugService.getMemory(playerId);
  }

  @Get('player/:playerId/debug/emotion')
  @ApiOperation({ summary: '查看指定 Player 的情绪状态' })
  async getEmotion(@Param('playerId') playerId: string) {
    return this.debugService.getEmotion(playerId);
  }

  @Get('player/:playerId/debug/relationship')
  @ApiOperation({ summary: '查看指定 Player 的关系详情' })
  async getRelationship(@Param('playerId') playerId: string) {
    return this.debugService.getRelationship(playerId);
  }

  @Get('player/:playerId/debug/worldbook')
  @ApiOperation({ summary: '查看已加载的世界知识' })
  async getWorldBook() {
    return this.debugService.getWorldBook();
  }

  @Post('player/:playerId/debug/reset')
  @ApiOperation({ summary: '重置指定 Player 的所有数据' })
  async reset(@Param('playerId') playerId: string) {
    return this.debugService.reset(playerId);
  }

  @Post('debug/reset-all')
  @ApiOperation({ summary: '重置所有 Player 的数据' })
  async resetAll() {
    return this.debugService.resetAll();
  }

  @Post('debug/test-llm')
  @ApiOperation({ summary: '直接测试 LLM 连接' })
  async testLlm(@Body() body: { message?: string }) {
    const config = this.configService.get('agent.main');
    const mode = this.configService.get<ThinkingMode>('agent.thinking') ?? DEFAULT_THINKING_MODE;
    const { OpenAIProvider } = await import('@innerlife/agent');

    const provider = new OpenAIProvider({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
      model: config.model,
      extraBody: thinkingExtraBody(mode),
    });

    try {
      const result = await provider.chat(
        [
          { role: 'system', content: '你是小满，简短回复。' },
          { role: 'user', content: body?.message || '你好' },
        ],
        { maxTokens: 100 },
      );
      return { success: true, response: result.data, usage: result.usage, model: config.model };
    } catch (err: any) {
      return {
        success: false,
        error: err.message,
        status: err.status,
        errorBody: err.error,
        model: config.model,
        baseUrl: config.baseUrl,
      };
    }
  }
}

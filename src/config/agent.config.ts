import { registerAs } from '@nestjs/config';
import { resolveThinkingMode } from '../common/llm-thinking';

export default registerAs('agent', () => ({
  main: {
    apiKey: process.env.AGENT_LLM_API_KEY || process.env.OPENAI_API_KEY || '',
    baseUrl: process.env.AGENT_LLM_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    model: process.env.AGENT_LLM_MODEL || 'gpt-5.5',
  },
  hormone: {
    apiKey: process.env.AGENT_HORMONE_LLM_API_KEY || process.env.AGENT_LLM_API_KEY || '',
    baseUrl: process.env.AGENT_HORMONE_LLM_BASE_URL || process.env.AGENT_LLM_BASE_URL || 'https://api.openai.com/v1',
    model: process.env.AGENT_HORMONE_LLM_MODEL || 'gpt-5.5-mini',
  },
  hormoneMode: (process.env.AGENT_HORMONE_MODE as 'sync' | 'parallel') || 'parallel',
  /**
   * DeepSeek 思考模式开关，作用于所有 LLM（主对话 / 情绪 / 调试）。
   * 默认 disabled（更快、更省）；设 AGENT_THINKING=enabled 可整体打开思维链。
   */
  thinking: resolveThinkingMode(process.env.AGENT_THINKING),
}));

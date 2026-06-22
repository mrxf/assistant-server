import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

const COMMAND_TRIGGER = '#记忆导入';
const CANCEL_TRIGGER = '#取消导入';
const PENDING_TTL_MS = 10 * 60 * 1000;

export interface InterceptResult {
  handled: boolean;
  reply?: string;
}

interface ParsedFact {
  category: string;
  key: string;
  value: string;
  importance: number;
}

interface ParsedEpisode {
  summary: string;
  importance: number;
}

interface ParsedMemoryData {
  facts: ParsedFact[];
  episodes: ParsedEpisode[];
}

interface ImportStats {
  factsWritten: number;
  episodesWritten: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  actor_profile: '用户档案',
  demographics: '人口统计',
  interests: '兴趣偏好',
  relationships: '人际关系',
  instructions: '行为指令',
};

const IMPORT_PROMPT = `请将以下提示词发送给你想要导出记忆的 AI 助手（如 ChatGPT、Claude 等），然后将它的回复完整粘贴发送给我，我会自动解析并导入。

━━━━━━ 请复制以下内容 ━━━━━━

帮我把一个 AI 助理中的上下文导入到另一个 AI 助理。你的任务是回顾我们过去的对话，总结你对我的了解。

在输出中，请避免使用第一人称代词（我、我的）和第二人称代词（你、你的）。请改用"用户"或使用中性词语来指代。

尽可能保留用户的原话，尤其是指令和偏好方面的内容。

类别（按此顺序输出）：
1. 人口统计信息：常用名字、职业、教育程度和常住地。
2. 兴趣和偏好：持续积极的投入（不只是拥有某个物品或单次购买）。
3. 关系：已确认的长期关系。
4. 重要事件与计划：近期重要活动、项目和计划的记录，标注日期。
5. 行为指令：用户明确要求今后遵循的规则，包括"必须做到的事项""绝对禁止的事项"以及行为纠正。仅包含存储的记忆中的规则。

格式：
根据上述类别将内容分为带编号的部分。尽量引用用户在提示中输入过的原话作为证据。每个条目格式：

用户的名字是<name>。
  - 证据：用户说"叫我<name>"。日期：[YYYY-MM-DD]。

输出要求：
  - 直接输出文本内容，不需要包裹在代码块中。
  - 如果某个类别没有信息，注明"暂无记录"。

━━━━━━ 复制到此结束 ━━━━━━

收到对方 AI 的回复后，将完整内容粘贴发送给我即可。

如需取消，发送 #取消导入`;

const PARSE_SYSTEM_PROMPT = `你是一个结构化数据提取器。将用户提供的"记忆导出文本"解析为严格的 JSON 格式。

重要：输出中的 playerId 占位符 {PLAYER_ID} 将由系统替换，你直接使用 {PLAYER_ID} 即可。

输出格式（只输出合法 JSON，不要代码块标记或其他内容）：
{
  "facts": [
    {
      "category": "actor_profile",
      "key": "actor:{PLAYER_ID}:english_snake_case_attribute",
      "value": "完整描述文本（保持原文语言和细节，包含证据和日期信息）",
      "importance": 0.5
    }
  ],
  "episodes": [
    {
      "summary": "事件/计划的完整摘要，包含日期",
      "importance": 0.5
    }
  ]
}

所有 facts 的 category 统一为 "actor_profile"。
key 格式统一为 "actor:{PLAYER_ID}:属性名"，属性名使用 snake_case 英文。

属性名示例（按原文类别）：
- 人口统计信息 → name, occupation, education, location
- 兴趣和偏好 → hobby_photography, interest_ai_engineering, preference_tools
- 关系 → family_wife, friend_zhangsan, colleague_team
- 行为指令 → instruction_language, instruction_response_style, instruction_no_emoji
- 重要事件与计划 → 存入 episodes（不是 facts）

规则：
- 所有 facts 的 category 必须是 "actor_profile"
- key 中的属性名必须唯一且具有描述性
- value 保持原文语言，合并原文中的证据和日期
- importance：人口统计 0.9，指令 0.85，兴趣和关系 0.7，事件 0.6
- "暂无记录"的类别不要输出任何条目
- 只输出 JSON，不要任何其他内容`;

@Injectable()
export class MemoryImportService {
  private readonly logger = new Logger(MemoryImportService.name);
  private readonly pending = new Map<string, number>();
  private readonly llmApiKey: string;
  private readonly llmBaseUrl: string;
  private readonly llmModel: string;

  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const config = configService.get('agent.hormone');
    this.llmApiKey = config.apiKey;
    this.llmBaseUrl = config.baseUrl;
    this.llmModel = config.model;
  }

  /** 检查指定玩家是否正处于"等待粘贴记忆数据"的状态。 */
  isPending(playerId: string): boolean {
    const expiresAt = this.pending.get(playerId);
    if (!expiresAt) return false;
    if (Date.now() > expiresAt) {
      this.pending.delete(playerId);
      return false;
    }
    return true;
  }

  /**
   * 对用户消息进行命令拦截。
   * - `#记忆导入` → 返回提示词模板，进入等待状态
   * - `#取消导入` → 取消等待状态
   * - 等待状态下的任意消息 → 解析为记忆数据并写入
   * - 其他消息 → `{ handled: false }`，交由正常对话流程处理
   */
  async intercept(playerId: string, text: string): Promise<InterceptResult> {
    const trimmed = text.trim();

    if (trimmed === CANCEL_TRIGGER) {
      const wasPending = this.pending.delete(playerId);
      if (wasPending) {
        return { handled: true, reply: '已取消记忆导入。' };
      }
      return { handled: false };
    }

    if (trimmed === COMMAND_TRIGGER) {
      this.pending.set(playerId, Date.now() + PENDING_TTL_MS);
      this.logger.log(`Memory import initiated for player ${playerId}`);
      return { handled: true, reply: IMPORT_PROMPT };
    }

    if (trimmed.startsWith(COMMAND_TRIGGER) && trimmed.length > COMMAND_TRIGGER.length) {
      const data = trimmed.slice(COMMAND_TRIGGER.length).trim();
      if (data) return this.processImport(playerId, data);
    }

    if (this.isPending(playerId)) {
      this.pending.delete(playerId);
      return this.processImport(playerId, trimmed);
    }

    return { handled: false };
  }

  // ── Private ──────────────────────────────────────────────────────────

  private async processImport(playerId: string, rawText: string): Promise<InterceptResult> {
    try {
      const parsed = await this.parseMemoryText(playerId, rawText);

      if (parsed.facts.length === 0 && parsed.episodes.length === 0) {
        return {
          handled: true,
          reply:
            '未能从文本中提取到有效的记忆条目。请确认发送的内容是按照提示词格式生成的记忆摘要。\n\n' +
            `如需重试，请再次发送 ${COMMAND_TRIGGER}`,
        };
      }

      const stats = await this.writeToDatabase(playerId, parsed);
      this.logger.log(
        `Memory imported for ${playerId}: ${stats.factsWritten} facts, ${stats.episodesWritten} episodes`,
      );
      return { handled: true, reply: this.formatSuccess(stats, parsed) };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Memory import failed for ${playerId}: ${msg}`);
      return {
        handled: true,
        reply: `记忆导入过程中出现错误：${msg}\n\n请检查内容后重试，发送 ${COMMAND_TRIGGER} 重新开始。`,
      };
    }
  }

  private async parseMemoryText(playerId: string, text: string): Promise<ParsedMemoryData> {
    const prompt = PARSE_SYSTEM_PROMPT.replace(/\{PLAYER_ID\}/g, playerId);
    const raw = await this.callLLM(prompt, text);
    const parsed = this.extractJSON(raw);

    // 确保所有 key 都包含正确的 playerId 前缀
    for (const fact of parsed.facts) {
      if (!fact.key.startsWith(`actor:${playerId}:`)) {
        const attr = fact.key.replace(/^actor:[^:]*:/, '');
        fact.key = `actor:${playerId}:${attr || fact.key}`;
      }
      fact.category = 'actor_profile';
    }

    return parsed;
  }

  private async callLLM(systemPrompt: string, userContent: string): Promise<string> {
    const url = `${this.llmBaseUrl}/chat/completions`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.llmApiKey}`,
      },
      body: JSON.stringify({
        model: this.llmModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        temperature: 0.1,
        max_tokens: 4096,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`LLM API ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = (await res.json()) as any;
    const content: string | undefined = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error('LLM 返回了空内容');

    return content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  }

  private extractJSON(text: string): ParsedMemoryData {
    const attempts = [
      () => JSON.parse(text),
      () => {
        const m = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
        if (!m) throw new Error('no code block');
        return JSON.parse(m[1]);
      },
      () => {
        const m = text.match(/\{[\s\S]*\}/);
        if (!m) throw new Error('no JSON object');
        return JSON.parse(m[0]);
      },
    ];

    for (const attempt of attempts) {
      try {
        return this.validateParsed(attempt());
      } catch {
        /* try next */
      }
    }

    throw new Error('无法从 LLM 返回中解析出有效的 JSON 结构');
  }

  private validateParsed(data: unknown): ParsedMemoryData {
    const obj = data as Record<string, unknown>;
    const rawFacts = Array.isArray(obj?.facts) ? obj.facts : [];
    const rawEpisodes = Array.isArray(obj?.episodes) ? obj.episodes : [];

    return {
      facts: rawFacts
        .filter((f: any) => f?.category && f?.key && f?.value)
        .map((f: any) => ({
          category: String(f.category),
          key: String(f.key),
          value: String(f.value),
          importance: clamp(Number(f.importance) || 0.5, 0, 1),
        })),
      episodes: rawEpisodes
        .filter((e: any) => e?.summary)
        .map((e: any) => ({
          summary: String(e.summary),
          importance: clamp(Number(e.importance) || 0.5, 0, 1),
        })),
    };
  }

  private async writeToDatabase(
    playerId: string,
    data: ParsedMemoryData,
  ): Promise<ImportStats> {
    let factsWritten = 0;
    let episodesWritten = 0;

    for (const fact of data.facts) {
      try {
        await this.prisma.semanticFact.upsert({
          where: {
            playerId_category_key: {
              playerId,
              category: fact.category,
              key: fact.key,
            },
          },
          create: {
            playerId,
            category: fact.category,
            key: fact.key,
            value: fact.value,
            importance: fact.importance,
          },
          update: {
            value: fact.value,
            importance: fact.importance,
          },
        });
        factsWritten++;
      } catch (err) {
        this.logger.warn(
          `Failed to write fact ${fact.category}/${fact.key}: ${(err as Error).message}`,
        );
      }
    }

    for (const episode of data.episodes) {
      try {
        await this.prisma.episodeRecord.create({
          data: {
            playerId,
            summary: episode.summary,
            importance: episode.importance,
          },
        });
        episodesWritten++;
      } catch (err) {
        this.logger.warn(
          `Failed to write episode: ${(err as Error).message}`,
        );
      }
    }

    return { factsWritten, episodesWritten };
  }

  private formatSuccess(stats: ImportStats, data: ParsedMemoryData): string {
    const lines: string[] = ['记忆导入完成！\n'];

    if (stats.factsWritten > 0) {
      lines.push(`语义记忆：${stats.factsWritten} 条`);
      const attrs = data.facts.slice(0, 5).map((f) => {
        const attr = f.key.replace(/^actor:[^:]*:/, '');
        return attr;
      });
      lines.push(`  包含：${attrs.join('、')}${data.facts.length > 5 ? ' 等' : ''}`);
    }

    if (stats.episodesWritten > 0) {
      lines.push(`情景记忆：${stats.episodesWritten} 条`);
    }

    lines.push('\n这些记忆将在后续对话中被自动召回和使用。');
    return lines.join('\n');
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

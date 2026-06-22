import { Injectable, Logger, OnModuleInit, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AgentFactory,
  OpenAIProvider,
  RelationshipOverlay,
  type Agent,
  type AgentFactoryOptions,
  type LoreEntry,
  type LLMProvider,
  type ModelCapabilities,
  type RelationshipData,
  type PersonaConfig,
} from '@innerlife/agent';
import { PrismaService } from '../prisma/prisma.service';
import { DevFileLoggerService } from '../common/dev-file-logger.service';
import { createLoggingProvider } from '../common/logging-provider';
import {
  thinkingExtraBody,
  DEFAULT_THINKING_MODE,
  type ThinkingMode,
} from '../common/llm-thinking';
import { PersonaLoaderService } from './persona/persona-loader.service';
import { WorldBookLoaderService } from './worldbook/worldbook-loader.service';
import { EmotionPersistenceService } from './emotion/emotion-persistence.service';
import { RelationshipPersistenceService } from './relationship/relationship-persistence.service';
import { PlayerDialogueStore } from './stores/player-dialogue-store';
import { PlayerMemoryStore } from './stores/player-memory-store';
import { AGENT_ID, INITIAL_RELATIONSHIP } from './agent.constants';

/** 开发期主 NPC 对话 LLM 的日志通道（req/resp → logs/agent-llm.log）。 */
const MAIN_LLM_LOG_CHANNEL = 'agent-llm';

/**
 * deepseek 系列的真实上下文能力。innerlife 的 `OpenAIProvider` 只内置了 GPT / o 系列的
 * 能力表，遇到 `deepseek-*` 这类未知模型会回退到 8192 上下文窗口；`TokenBudget.fromCapabilities`
 * 据此只分到约 2K 的总预算，于是 persona / 对话历史 / 约束等槽位被
 * `(部分内容因预算限制被省略)` 大量裁掉。这里按 DeepSeek 实际的大窗口显式声明，
 * 让预算自动放大到接近模型上限，避免送检上下文被截断。
 */
const DEEPSEEK_CAPS: ModelCapabilities = {
  contextWindow: 128_000,
  maxOutputTokens: 8_192,
  supportedInputs: ['text'],
};

/**
 * 主对话模型（gpt-5.5）的能力。与 DEEPSEEK_CAPS 的唯一区别是显式放开 `image`
 * 输入模态——否则 `OpenAIProvider.validateModalitySupport` 会因 supportedInputs
 * 仅含 'text' 而拒绝微信图片（多模态消息）。上下文窗口沿用既有设置，不改预算行为。
 */
const MAIN_CAPS: ModelCapabilities = {
  contextWindow: 128_000,
  maxOutputTokens: 8_192,
  supportedInputs: ['text', 'image'],
};

/**
 * 注入 prompt 的逐字对话历史上限（DialogueHistory 自身的预算，独立于 Composer 槽位预算）。
 * 默认仅 2000 tokens / 50 条，多轮长对话会被提前截断；放大以保留更完整的上下文。
 */
const DIALOGUE_HISTORY_TOKEN_BUDGET = 16_000;
const DIALOGUE_HISTORY_MAX_PROMPT_ENTRIES = 200;

@Injectable()
export class AgentPoolService implements OnModuleInit {
  private readonly logger = new Logger(AgentPoolService.name);
  private readonly agents = new Map<string, Agent>();
  private readonly turnLocks = new Map<string, Promise<void>>();

  private personaConfig: PersonaConfig | null = null;
  private worldBookEntries: LoreEntry[] = [];

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly personaLoader: PersonaLoaderService,
    private readonly worldbookLoader: WorldBookLoaderService,
    private readonly emotionPersistence: EmotionPersistenceService,
    private readonly relationshipPersistence: RelationshipPersistenceService,
    private readonly fileLogger: DevFileLoggerService,
  ) {}

  async onModuleInit() {
    this.personaConfig = await this.personaLoader.load();
    this.worldBookEntries = (await this.worldbookLoader.loadAll()) as LoreEntry[];
    this.logger.log(`Shared resources loaded: persona + ${this.worldBookEntries.length} worldbook entries`);

    await this.restoreAllAgents();
  }

  getAgent(playerId: string): Agent {
    const agent = this.agents.get(playerId);
    if (!agent) {
      throw new NotFoundException(`Player "${playerId}" not found or agent not initialized`);
    }
    return agent;
  }

  hasAgent(playerId: string): boolean {
    return this.agents.has(playerId);
  }

  async createAgent(playerId: string): Promise<Agent> {
    if (this.agents.has(playerId)) {
      return this.agents.get(playerId)!;
    }

    this.logger.log(`Creating agent for player: ${playerId}`);

    const dialogueStore = new PlayerDialogueStore(this.prisma, playerId);
    const memoryStore = new PlayerMemoryStore(this.prisma, playerId);

    const mainProvider = this.createMainProvider();
    const hormoneProvider = this.createHormoneProvider();

    const options: AgentFactoryOptions = {
      provider: mainProvider,
      hormoneProvider,
      compressorProvider: hormoneProvider,
      store: memoryStore,
      enableDialogueHistory: {
        tokenBudget: DIALOGUE_HISTORY_TOKEN_BUDGET,
        maxPromptEntries: DIALOGUE_HISTORY_MAX_PROMPT_ENTRIES,
      },
      dialogueStore,
      expressHistorySize: 0,
      innerMonologueHistorySize: 3,
      enableCognitionSkill: false,
      enableActiveMemory: false,
      enableEventBroker: false,
      worldBookTopK: 8,
      worldBookRetentionTurns: 5,
      tickOptions: { maxTurnsPerTick: 6 },
    };

    const factory = new AgentFactory(options);
    const agent = await factory.create({
      id: AGENT_ID,
      personaRaw: this.personaConfig ?? undefined,
    });

    for (const entry of this.worldBookEntries) {
      agent.worldBook.addEntry(entry);
    }
    // 检索器在 factory.create() 时已基于「当时为空」的 worldBook 建好 termIndex，
    // 而 addEntry 不会触发重建——必须在补完条目后手动重建一次，否则关键词索引为空、
    // 所有 worldbook 条目永远召回不到。
    agent.worldBookRetriever.rebuildIndex();

    await this.restoreAgentState(agent, playerId);

    this.agents.set(playerId, agent);
    this.logger.log(`Agent created for player: ${playerId}`);

    return agent;
  }

  async destroyAgent(playerId: string): Promise<void> {
    this.agents.delete(playerId);
    this.turnLocks.delete(playerId);

    await this.prisma.dialogueEntry.deleteMany({ where: { playerId } });
    await this.prisma.semanticFact.deleteMany({ where: { playerId } });
    await this.prisma.episodeRecord.deleteMany({ where: { playerId } });
    await this.prisma.proactiveMessage.deleteMany({ where: { playerId } });
    await this.prisma.emotionState.deleteMany({ where: { id: playerId } });
    await this.prisma.relationshipState.deleteMany({ where: { id: playerId } });
    await this.prisma.memoryFlushCursor.deleteMany({ where: { id: playerId } });

    this.logger.log(`Agent destroyed for player: ${playerId}`);
  }

  async resetAgent(playerId: string): Promise<void> {
    await this.destroyAgent(playerId);
    await this.createAgent(playerId);
  }

  async resetAll(): Promise<void> {
    const playerIds = [...this.agents.keys()];

    this.agents.clear();
    this.turnLocks.clear();

    await this.prisma.dialogueEntry.deleteMany({});
    await this.prisma.semanticFact.deleteMany({});
    await this.prisma.episodeRecord.deleteMany({});
    await this.prisma.proactiveMessage.deleteMany({});
    await this.prisma.emotionState.deleteMany({});
    await this.prisma.relationshipState.deleteMany({});
    await this.prisma.memoryFlushCursor.deleteMany({});

    for (const playerId of playerIds) {
      await this.createAgent(playerId);
    }

    this.logger.log('All agents reset');
  }

  async persistState(playerId: string): Promise<void> {
    const agent = this.agents.get(playerId);
    if (!agent) return;
    await this.emotionPersistence.save(agent, playerId);
    await this.relationshipPersistence.save(agent, playerId);
  }

  /**
   * Chain-based per-player turn lock.
   * Ensures only one Runner.run() executes per player at a time.
   * Messages arriving while locked accumulate in Inbox and get merged via mergeKey.
   */
  async withTurnLock<T>(playerId: string, fn: () => Promise<T>): Promise<T> {
    const previous = this.turnLocks.get(playerId) ?? Promise.resolve();
    let resolve!: () => void;
    const current = new Promise<void>((r) => {
      resolve = r;
    });
    this.turnLocks.set(playerId, current);

    await previous;
    try {
      return await fn();
    } finally {
      resolve();
    }
  }

  private async restoreAllAgents(): Promise<void> {
    const players = await this.prisma.player.findMany();
    this.logger.log(`Restoring ${players.length} agent(s) from DB...`);

    for (const player of players) {
      await this.createAgent(player.id);
    }
  }

  private async restoreAgentState(agent: Agent, playerId: string): Promise<void> {
    await this.restoreEmotion(agent, playerId);
    await this.restoreRelationship(agent, playerId);
  }

  private async restoreEmotion(agent: Agent, playerId: string): Promise<void> {
    const snapshot = await this.emotionPersistence.restore(playerId);
    if (snapshot) {
      const keys = Object.keys(snapshot.state);
      for (const key of keys) {
        const delta = snapshot.state[key] - agent.baseMood.get(key);
        if (Math.abs(delta) > 0.001) {
          agent.baseMood.applyWithConstraints({ [key]: delta });
        }
      }
      this.logger.debug(`Emotion restored for player: ${playerId}`);
    }
  }

  private async restoreRelationship(agent: Agent, playerId: string): Promise<void> {
    const snapshot = await this.relationshipPersistence.restore(playerId);

    if (snapshot) {
      const overlay = RelationshipOverlay.deserialize(snapshot.overlayData);
      agent.setRelationship(playerId, overlay);
      this.logger.debug(`Relationship restored for player: ${playerId}`);
    } else {
      const initialData: RelationshipData = {
        targetId: playerId,
        speakingStyle: INITIAL_RELATIONSHIP.speakingStyle,
        secretWillingness: 20,
        cooperationLevel: INITIAL_RELATIONSHIP.cooperationLevel,
        trustLevel: INITIAL_RELATIONSHIP.trustLevel,
        subjectivePerception: 50,
      };
      const overlay = new RelationshipOverlay(initialData);
      agent.setRelationship(playerId, overlay);
      this.logger.debug(`Relationship initialized for player: ${playerId}`);
    }
  }

  /** 读取思考模式配置，生成注入 provider 的 extraBody（默认关闭，配置方可开）。 */
  private resolveThinkingExtraBody(): Record<string, unknown> {
    const mode = this.configService.get<ThinkingMode>('agent.thinking') ?? DEFAULT_THINKING_MODE;
    return thinkingExtraBody(mode);
  }

  /**
   * 主 NPC 对话 LLM provider。开发期包一层日志装饰器，把每次（含原生工具循环
   * `chatWithTools` 与 schema 循环 `chatWithSchema`）的完整送检 prompt 与返回写入
   * `logs/agent-llm.log`，便于排查「上下文拼装是否正确」。
   */
  private createMainProvider(): LLMProvider {
    const config = this.configService.get('agent.main');
    const base = new OpenAIProvider({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
      model: config.model,
      capabilities: MAIN_CAPS,
      extraBody: this.resolveThinkingExtraBody(),
      defaultHeaders: { 'User-Agent': 'assistant-server/0.1.0' },
    });

    return this.fileLogger.isEnabled
      ? createLoggingProvider(base, this.fileLogger, MAIN_LLM_LOG_CHANNEL)
      : base;
  }

  private createHormoneProvider(): OpenAIProvider {
    const config = this.configService.get('agent.hormone');
    return new OpenAIProvider({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
      model: config.model,
      capabilities: DEEPSEEK_CAPS,
      extraBody: this.resolveThinkingExtraBody(),
      defaultHeaders: { 'User-Agent': 'assistant-server/0.1.0' },
    });
  }
}

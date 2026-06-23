import { Module } from '@nestjs/common';
import { ChannelModule } from '@innerlife/channel-nestjs';
import { weixin } from '@innerlife/channel-weixin';
import { AgentModule } from '../agent/agent.module';
import { AgentPoolService } from '../agent/agent-pool.service';
import { AgentRunnerService } from '../agent/agent-runner.service';
import { PrismaAccountStorage } from '../channel/prisma-account-storage';
import { MemoryImportModule } from '../memory-import/memory-import.module';
import { MemoryImportService } from '../memory-import/memory-import.service';
import { ConversationModule } from '../conversation/conversation.module';
import { ConversationResetService } from '../conversation/conversation-reset.service';
import { ChannelBindingService } from './channel-binding.service';
import { ChannelOutboxService } from './channel-outbox.service';
import { ChannelSessionGuard } from './channel-session-guard.service';
import { WechatBindController } from './wechat-bind.controller';
import { buildWeixinEngine } from './wechat-engine';

/**
 * Providers the ChannelModule async factory injects. Split into its own module
 * so the dynamic module's `inject` can resolve them (PrismaService is global).
 */
@Module({
  imports: [AgentModule],
  providers: [PrismaAccountStorage, ChannelBindingService],
  exports: [PrismaAccountStorage, ChannelBindingService],
})
export class WechatProvidersModule {}

/**
 * Wires the WeChat channel into the assistant: assembles the ChannelHost (Prisma-backed
 * storage + the NPC engine), exposes binding (SSE) and proactive send.
 * The host stays framework-neutral; identity/persistence/lock are injected here.
 */
@Module({
  imports: [
    AgentModule,
    WechatProvidersModule,
    MemoryImportModule,
    ConversationModule,
    ChannelModule.forRootAsync({
      imports: [WechatProvidersModule, AgentModule, MemoryImportModule, ConversationModule],
      inject: [
        PrismaAccountStorage,
        AgentPoolService,
        AgentRunnerService,
        ChannelBindingService,
        MemoryImportService,
        ConversationResetService,
      ],
      useFactory: (
        storage: PrismaAccountStorage,
        pool: AgentPoolService,
        runner: AgentRunnerService,
        binding: ChannelBindingService,
        memoryImport: MemoryImportService,
        conversationReset: ConversationResetService,
      ) => ({
        channels: [weixin()],
        storage,
        engine: buildWeixinEngine({ pool, runner, binding, memoryImport, conversationReset }),
      }),
    }),
  ],
  controllers: [WechatBindController],
  providers: [ChannelOutboxService, ChannelSessionGuard],
  exports: [ChannelOutboxService],
})
export class WechatModule {}

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CommonModule } from './common/common.module';
import { PrismaModule } from './prisma/prisma.module';
import { AgentModule } from './agent/agent.module';
import { ChatModule } from './chat/chat.module';
import { EventsModule } from './events/events.module';
import { MessagesModule } from './messages/messages.module';
import { PlayerModule } from './player/player.module';
import { NpcModule } from './npc/npc.module';
import { DebugModule } from './debug/debug.module';
import { WechatModule } from './wechat/wechat.module';
import appConfig from './config/app.config';
import agentConfig from './config/agent.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      load: [appConfig, agentConfig],
    }),
    CommonModule,
    PrismaModule,
    AgentModule,
    ChatModule,
    EventsModule,
    MessagesModule,
    PlayerModule,
    NpcModule,
    DebugModule,
    WechatModule,
  ],
})
export class AppModule {}

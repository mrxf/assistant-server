import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { AgentModule } from '../agent/agent.module';
import { PlayerModule } from '../player/player.module';

@Module({
  imports: [AgentModule, PlayerModule],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}

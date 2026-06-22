import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { AgentModule } from '../agent/agent.module';
import { PlayerModule } from '../player/player.module';
import { MemoryImportModule } from '../memory-import/memory-import.module';

@Module({
  imports: [AgentModule, PlayerModule, MemoryImportModule],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}

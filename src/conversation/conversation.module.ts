import { Module } from '@nestjs/common';
import { ConversationResetService } from './conversation-reset.service';

@Module({
  providers: [ConversationResetService],
  exports: [ConversationResetService],
})
export class ConversationModule {}

import { Module } from '@nestjs/common';
import { MessagesController } from './messages.controller';
import { MessagesBatchController } from './messages-batch.controller';
import { MessagesService } from './messages.service';

@Module({
  controllers: [MessagesController, MessagesBatchController],
  providers: [MessagesService],
})
export class MessagesModule {}

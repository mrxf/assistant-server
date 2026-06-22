import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AgentRunnerService } from '../agent/agent-runner.service';
import { ReportEventDto } from './dto/report-event.dto';

export interface EventResult {
  success: boolean;
  messageGenerated: boolean;
  messageId?: string;
}

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly agentRunner: AgentRunnerService,
  ) {}

  async reportEvent(playerId: string, dto: ReportEventDto): Promise<EventResult> {
    this.logger.log(`Event received for player ${playerId}: ${dto.type} - ${dto.text}`);

    const result = await this.agentRunner.runEventTurn({
      playerId,
      type: dto.type,
      text: dto.text,
      metadata: dto.metadata,
    });

    if (result.dialogue) {
      const messageId = `proactive-${Date.now()}`;

      await this.prisma.proactiveMessage.create({
        data: {
          id: messageId,
          playerId,
          content: result.dialogue,
          expression: result.expression ? JSON.stringify(result.expression) : null,
          emotion: result.hormoneDeltas ? JSON.stringify(result.hormoneDeltas) : null,
          triggeredBy: dto.type,
          triggerText: dto.text,
          triggerMetadata: dto.metadata ? JSON.stringify(dto.metadata) : null,
        },
      });

      return { success: true, messageGenerated: true, messageId };
    }

    return { success: true, messageGenerated: false };
  }
}

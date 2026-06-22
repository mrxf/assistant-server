import { Module } from '@nestjs/common';
import { AgentPoolService } from './agent-pool.service';
import { AgentRunnerService } from './agent-runner.service';
import { PersonaLoaderService } from './persona/persona-loader.service';
import { WorldBookLoaderService } from './worldbook/worldbook-loader.service';
import { EmotionPersistenceService } from './emotion/emotion-persistence.service';
import { RelationshipPersistenceService } from './relationship/relationship-persistence.service';

@Module({
  providers: [
    AgentPoolService,
    AgentRunnerService,
    PersonaLoaderService,
    WorldBookLoaderService,
    EmotionPersistenceService,
    RelationshipPersistenceService,
  ],
  exports: [
    AgentPoolService,
    AgentRunnerService,
    EmotionPersistenceService,
    RelationshipPersistenceService,
    WorldBookLoaderService,
  ],
})
export class AgentModule {}

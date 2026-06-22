import { Injectable, Logger } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { PersonaConfig } from '@innerlife/agent';

@Injectable()
export class PersonaLoaderService {
  private readonly logger = new Logger(PersonaLoaderService.name);
  private cachedPersona: PersonaConfig | null = null;

  async load(): Promise<PersonaConfig> {
    if (this.cachedPersona) return this.cachedPersona;

    const personaPath = join(process.cwd(), 'data', 'persona', 'xiaoman.yaml');
    this.logger.log(`Loading persona from ${personaPath}`);

    const content = await readFile(personaPath, 'utf-8');
    const yaml = await import('js-yaml');
    // identityAnchors 既可写成纯字符串，也可写成 { fact, importance, category } 富对象；
    // 由 @innerlife/agent 的 IdentityAnchor 统一规范化、按 importance 排序后注入 prompt。
    const persona = yaml.load(content) as PersonaConfig;

    this.cachedPersona = persona;
    this.logger.log(`Persona loaded: ${persona.name}`);
    return persona;
  }

  invalidateCache(): void {
    this.cachedPersona = null;
  }
}

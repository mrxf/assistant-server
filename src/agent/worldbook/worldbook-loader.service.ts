import { Injectable, Logger } from '@nestjs/common';
import { readFile, readdir } from 'node:fs/promises';
import { join, extname } from 'node:path';
import type { LoreEntry } from '@innerlife/agent';

interface WorldBookFile {
  entries: LoreEntry[];
}

@Injectable()
export class WorldBookLoaderService {
  private readonly logger = new Logger(WorldBookLoaderService.name);
  private cachedEntries: LoreEntry[] | null = null;

  async loadAll(): Promise<LoreEntry[]> {
    if (this.cachedEntries) return this.cachedEntries;

    const worldbookDir = join(process.cwd(), 'data', 'worldbook');
    this.logger.log(`Loading worldbook from ${worldbookDir}`);

    const files = await readdir(worldbookDir);
    const yamlFiles = files.filter(
      (f) => extname(f) === '.yaml' || extname(f) === '.yml',
    );

    const allEntries: LoreEntry[] = [];

    for (const file of yamlFiles) {
      const filePath = join(worldbookDir, file);
      const content = await readFile(filePath, 'utf-8');
      const yaml = await import('js-yaml');
      const parsed = yaml.load(content) as WorldBookFile;

      if (parsed?.entries && Array.isArray(parsed.entries)) {
        allEntries.push(...parsed.entries);
        this.logger.debug(`Loaded ${parsed.entries.length} entries from ${file}`);
      }
    }

    this.cachedEntries = allEntries;
    this.logger.log(`WorldBook loaded: ${allEntries.length} total entries`);
    return allEntries;
  }

  invalidateCache(): void {
    this.cachedEntries = null;
  }
}

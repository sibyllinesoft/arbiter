import path from 'path';
import fs from 'fs-extra';
import { Hono } from 'hono';
import yaml from 'yaml';

type Dependencies = Record<string, unknown>;

type ConfigFormat = 'json' | 'yaml';

type ProjectStructureSettings = {
  appsDirectory: string;
  packagesDirectory: string;
  servicesDirectory: string;
  testsDirectory: string;
  infraDirectory: string;
  endpointDirectory: string;
};

const PROJECT_ROOT = path.resolve(__dirname, '../../../..');
const CONFIG_SEARCH_PATHS = [
  '.arbiter/config.json',
  '.arbiter/config.yaml',
  '.arbiter/config.yml',
  '.arbiter.json',
  '.arbiter.yaml',
  '.arbiter.yml',
  'arbiter.json',
  'arbiter.yaml',
  'arbiter.yml',
] as const;

const DEFAULT_PROJECT_STRUCTURE: ProjectStructureSettings = {
  appsDirectory: 'apps',
  packagesDirectory: 'packages',
  servicesDirectory: 'services',
  testsDirectory: 'tests',
  infraDirectory: 'infra',
  endpointDirectory: 'apps/api/src/endpoints',
};

interface LoadedConfig {
  config: Record<string, unknown>;
  filePath: string;
  format: ConfigFormat;
}

function resolveDefaultConfigPath(): string {
  return path.join(PROJECT_ROOT, '.arbiter', 'config.json');
}

async function findExistingConfig(): Promise<LoadedConfig | null> {
  for (const relativePath of CONFIG_SEARCH_PATHS) {
    const filePath = path.join(PROJECT_ROOT, relativePath);
    if (await fs.pathExists(filePath)) {
      const ext = path.extname(filePath).toLowerCase();
      const format: ConfigFormat = ext === '.json' ? 'json' : 'yaml';
      const content = await fs.readFile(filePath, 'utf-8');
      const parsed = format === 'json' ? JSON.parse(content) : (yaml.parse(content) ?? {});
      return { config: parsed as Record<string, unknown>, filePath, format };
    }
  }
  return null;
}

function sanitizeStructureCandidate(value: unknown): Partial<ProjectStructureSettings> {
  if (!value || typeof value !== 'object') return {};

  const result: Partial<ProjectStructureSettings> = {};
  const record = value as Record<string, unknown>;

  (Object.keys(DEFAULT_PROJECT_STRUCTURE) as Array<keyof ProjectStructureSettings>).forEach(key => {
    const candidate = record[key];
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      result[key] = candidate;
    }
  });

  return result;
}

async function loadProjectStructureConfig(): Promise<
  LoadedConfig & { structure: ProjectStructureSettings }
> {
  const existing = await findExistingConfig();

  if (existing) {
    const existingStructure = sanitizeStructureCandidate(
      (existing.config as Record<string, unknown>)['projectStructure']
    );

    return {
      ...existing,
      structure: {
        ...DEFAULT_PROJECT_STRUCTURE,
        ...existingStructure,
      },
    };
  }

  return {
    config: {},
    filePath: resolveDefaultConfigPath(),
    format: 'json',
    structure: { ...DEFAULT_PROJECT_STRUCTURE },
  };
}

async function persistProjectStructure(
  updates: Partial<ProjectStructureSettings>
): Promise<ProjectStructureSettings> {
  const loaded = await loadProjectStructureConfig();
  const sanitizedUpdates = sanitizeStructureCandidate(updates);
  const existingStructure = sanitizeStructureCandidate(
    (loaded.config as Record<string, unknown>)['projectStructure']
  );

  const updatedStructure: ProjectStructureSettings = {
    ...DEFAULT_PROJECT_STRUCTURE,
    ...existingStructure,
    ...sanitizedUpdates,
  };

  const configToWrite: Record<string, unknown> = {
    ...loaded.config,
    projectStructure: updatedStructure,
  };

  await fs.ensureDir(path.dirname(loaded.filePath));
  if (loaded.format === 'json') {
    await fs.writeFile(loaded.filePath, JSON.stringify(configToWrite, null, 2), 'utf-8');
  } else {
    await fs.writeFile(loaded.filePath, yaml.stringify(configToWrite), 'utf-8');
  }

  return updatedStructure;
}

export function createConfigRouter(_: Dependencies) {
  const router = new Hono();

  router.get('/config/project-structure', async c => {
    try {
      const loaded = await loadProjectStructureConfig();
      return c.json({
        success: true,
        projectStructure: loaded.structure,
      });
    } catch (error) {
      console.error('Failed to load project structure config:', error);
      return c.json(
        {
          success: false,
          error: 'Failed to load project structure configuration',
        },
        500
      );
    }
  });

  router.put('/config/project-structure', async c => {
    try {
      const body = await c.req.json();
      if (!body || typeof body !== 'object') {
        return c.json(
          {
            success: false,
            error: 'Request body must be an object',
          },
          400
        );
      }

      const updated = await persistProjectStructure(body as Partial<ProjectStructureSettings>);
      return c.json({ success: true, projectStructure: updated });
    } catch (error) {
      console.error('Failed to update project structure config:', error);
      return c.json(
        {
          success: false,
          error: 'Failed to update project structure configuration',
        },
        500
      );
    }
  });

  return router;
}

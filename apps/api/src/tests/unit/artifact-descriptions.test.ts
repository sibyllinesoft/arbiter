import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { SpecWorkbenchDB } from '../../db.ts';
import type { ServerConfig } from '../../types.ts';
import { generateId } from '../../utils.ts';

describe('Artifact description persistence', () => {
  let db: SpecWorkbenchDB;
  let projectId: string;

  beforeEach(async () => {
    const config: ServerConfig = {
      port: 0,
      host: 'localhost',
      database_path: ':memory:',
      spec_workdir: `/tmp/artifact-description-test-${Date.now()}`,
      cue_binary_path: 'cue',
      jq_binary_path: 'jq',
      auth_required: false,
      rate_limit: {
        max_tokens: 10,
        refill_rate: 1,
        window_ms: 1000,
      },
      external_tool_timeout_ms: 5000,
      websocket: {
        max_connections: 10,
        ping_interval_ms: 30000,
      },
    };

    db = new SpecWorkbenchDB(config);
    projectId = generateId();
    await db.createProject(projectId, 'Description Project');
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
  });

  it('stores and retrieves artifact descriptions', async () => {
    const artifactId = generateId();
    const description = 'Example module imported from package.json';

    await db.createArtifact(
      artifactId,
      projectId,
      'example-module',
      description,
      'module',
      'typescript',
      null,
      {
        package: {
          name: 'example-module',
          description,
        },
      },
      'packages/example-module/package.json'
    );

    const artifacts = await db.getArtifacts(projectId);
    const stored = artifacts.find(artifact => artifact.id === artifactId);

    expect(stored).toBeDefined();
    expect(stored?.description).toBe(description);
  });

  it('backfills missing descriptions from stored metadata', async () => {
    const artifactId = generateId();
    const legacyDescription = 'Legacy module description sourced from metadata';

    await db.createArtifact(
      artifactId,
      projectId,
      'legacy-module',
      null,
      'module',
      'typescript',
      null,
      {
        package: {
          name: 'legacy-module',
          description: legacyDescription,
        },
      },
      'packages/legacy-module/package.json'
    );

    const internalDb = db as unknown as { backfillArtifactDescriptions: () => void };
    internalDb.backfillArtifactDescriptions();

    const artifacts = await db.getArtifacts(projectId);
    const stored = artifacts.find(artifact => artifact.id === artifactId);

    expect(stored?.description).toBe(legacyDescription);
  });
});

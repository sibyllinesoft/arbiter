import { describe, expect, it } from 'bun:test';
import { Hono } from 'hono';
import { SpecWorkbenchDB } from '../db.ts';
import type { ServerConfig } from '../types.ts';
import { createSpecsRouter } from './specs.ts';

describe('Specs routes', () => {
  const baseConfig: ServerConfig = {
    port: 0,
    host: 'localhost',
    database_path: ':memory:',
    spec_workdir: `/tmp/specs-route-test-${Date.now()}`,
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

  it('surfaces framework metadata when artifact column is empty', async () => {
    const db = new SpecWorkbenchDB(baseConfig);

    try {
      const projectId = 'project-manual-service';
      await db.createProject(projectId, 'Manual Service Project');

      await db.createArtifact(
        'artifact-missing-framework',
        projectId,
        'billing-service',
        'Handles billing requests',
        'service',
        'TypeScript',
        null,
        {
          framework: 'Fastify',
          language: 'TypeScript',
        },
        'services/billing/index.ts',
        0.9
      );

      const router = createSpecsRouter({ db });
      const app = new Hono();
      app.route('/api', router);

      const response = await app.request(`/api/resolved?projectId=${projectId}`);
      expect(response.status).toBe(200);

      const payload: any = await response.json();
      const service = payload?.resolved?.spec?.services?.['billing-service'];
      expect(service).toBeDefined();
      expect(service.metadata?.framework).toBe('Fastify');
      expect(service.metadata?.language).toBe('TypeScript');
      // Default port logic should respect the normalized framework value
      expect(service.ports?.[0]?.port).toBe(3000);
    } finally {
      db.close();
    }
  });
});

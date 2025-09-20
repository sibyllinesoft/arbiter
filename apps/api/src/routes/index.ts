import { Hono } from 'hono';
export type Dependencies = Record<string, unknown>;

export function createApiRouter(_: Dependencies) {
  const app = new Hono();
  app.get('/health', c =>
    c.json({ status: 'healthy', timestamp: new Date().toISOString(), database: true })
  );
  app.post('/api/validate', async c => {
    return c.json({ success: true, spec_hash: 'stubbed', resolved: {} });
  });

  return app;
}

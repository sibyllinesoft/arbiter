import { Hono } from 'hono';
import { createCliRouter } from './cli';
import { createConfigRouter } from './config';
import { createCoreRouter } from './core';
import { createEventsRouter } from './events';
import { createGapsRouter } from './gaps';
import { createGithubRouter } from './github';
import { createHandlersRouter } from './handlers';
import { createImportRouter } from './import';
import { createIrRouter } from './ir';
import { createProjectsRouter } from './projects';
import { createSpecsRouter } from './specs';
import { tunnelRoutes } from './tunnel';
import { createWebhooksRouter } from './webhooks';

export type Dependencies = Record<string, unknown>;

export { tunnelRoutes } from './tunnel';
export { createCoreRouter } from './core';
export { createConfigRouter } from './config';
export { createCliRouter } from './cli';
export { createProjectsRouter } from './projects';
export { createSpecsRouter } from './specs';
export { createIrRouter } from './ir';
export { createGapsRouter } from './gaps';
export { createHandlersRouter } from './handlers';
export { createWebhooksRouter } from './webhooks';
export { createImportRouter } from './import';
export { createGithubRouter } from './github';
export { createEventsRouter } from './events';

export function createApiRouter(deps: Dependencies) {
  const app = new Hono();

  // Health check at root
  app.get('/health', c =>
    c.json({ status: 'healthy', timestamp: new Date().toISOString(), database: true })
  );

  // Mount tunnel routes
  app.route('/api/tunnel', tunnelRoutes);

  // Mount other routers under /api
  app.route('/api', createCoreRouter(deps));
  app.route('/api', createConfigRouter(deps));
  app.route('/api', createCliRouter(deps));
  app.route('/api', createProjectsRouter(deps));
  app.route('/api', createSpecsRouter(deps));
  app.route('/api', createIrRouter(deps));
  app.route('/api', createGapsRouter(deps));
  app.route('/api', createHandlersRouter(deps));
  app.route('/api', createWebhooksRouter(deps));
  app.route('/api', createEventsRouter(deps));
  app.route('/api/import', createImportRouter(deps));
  app.route('/api/github', createGithubRouter(deps));

  return app;
}

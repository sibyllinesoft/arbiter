import { Hono } from 'hono';

type Dependencies = Record<string, unknown>;

export function createHandlersRouter(deps: Dependencies) {
  const router = new Hono();

  // Handler management endpoints (non-parameterized routes first)
  router.get('/executions', async c => {
    const query = c.req.query();
    const request = {
      handlerId: query.handlerId,
      projectId: query.projectId,
      provider: query.provider as 'github' | 'gitlab' | undefined,
      event: query.event,
      limit: query.limit ? parseInt(query.limit) : undefined,
      offset: query.offset ? parseInt(query.offset) : undefined,
    };
    const response = await (deps.handlersApi as any).getExecutionHistory(request);
    return c.json(response);
  });

  router.get('/stats', async c => {
    const response = await (deps.handlersApi as any).getHandlerStats();
    return c.json(response);
  });

  router.post('/validate', async c => {
    const { filePath } = await c.req.json();
    const response = await (deps.handlersApi as any).validateHandler({ filePath });
    return c.json(response);
  });

  router.post('/init', async c => {
    const response = await (deps.handlersApi as any).initializeHandlerStructure();
    return c.json(response);
  });

  // Generic handlers list and CRUD operations
  router.get('/', async c => {
    const query = c.req.query();
    const request = {
      provider: query.provider as 'github' | 'gitlab' | undefined,
      event: query.event,
      enabled: query.enabled ? query.enabled === 'true' : undefined,
    };
    const response = await (deps.handlersApi as any).listHandlers(request);
    return c.json(response);
  });

  router.post('/', async c => {
    const request = await c.req.json();
    const response = await (deps.handlersApi as any).createHandler(request);
    return c.json(response);
  });

  // Parameterized routes (must come after non-parameterized routes)
  router.get('/:id', async c => {
    const id = c.req.param('id');
    const response = await (deps.handlersApi as any).getHandler({ id });
    return c.json(response);
  });

  router.put('/:id', async c => {
    const id = c.req.param('id');
    const updates = await c.req.json();
    const response = await (deps.handlersApi as any).updateHandler({ id, updates });
    return c.json(response);
  });

  router.delete('/:id', async c => {
    const id = c.req.param('id');
    const response = await (deps.handlersApi as any).removeHandler({ id });
    return c.json(response);
  });

  router.post('/:id/toggle', async c => {
    const id = c.req.param('id');
    const { enabled } = await c.req.json();
    const response = await (deps.handlersApi as any).toggleHandler({ id, enabled });
    return c.json(response);
  });

  router.post('/:id/reload', async c => {
    const id = c.req.param('id');
    const response = await (deps.handlersApi as any).reloadHandler({ id });
    return c.json(response);
  });

  return router;
}

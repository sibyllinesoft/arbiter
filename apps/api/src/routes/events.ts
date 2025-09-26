import { Hono } from 'hono';
import type { Dependencies } from './index';

export function createEventsRouter(deps: Dependencies) {
  const router = new Hono();

  router.get('/projects/:projectId/events', async c => {
    const projectId = c.req.param('projectId');
    const limitParam = c.req.query('limit');
    const since = c.req.query('since') ?? undefined;
    const includeDanglingParam = c.req.query('includeDangling') ?? c.req.query('include_dangling');

    const limit = limitParam ? Number.parseInt(limitParam, 10) : 100;
    if (Number.isNaN(limit) || limit <= 0) {
      return c.json({ success: false, error: 'limit must be a positive integer' }, 400);
    }

    const includeDangling =
      includeDanglingParam === undefined ? true : includeDanglingParam !== 'false';

    try {
      const db = deps.db as any;
      const events = await db.getEvents(projectId, limit, since, includeDangling);
      const headEvent = db.getProjectEventHead(projectId);
      const danglingEventIds = events
        .filter((event: any) => !event.is_active)
        .map((event: any) => event.id);

      return c.json({
        success: true,
        events,
        head_event: headEvent,
        head_event_id: headEvent?.id ?? null,
        dangling_event_ids: danglingEventIds,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch events';
      const status = message.includes('not found') ? 404 : 500;
      return c.json({ success: false, error: message }, status);
    }
  });

  router.post('/projects/:projectId/events/head', async c => {
    const projectId = c.req.param('projectId');

    try {
      const body = await c.req.json();
      const headEventId = body?.head_event_id ?? body?.headEventId ?? null;

      const db = deps.db as any;
      const result = db.setEventHead(projectId, headEventId ?? null);

      const eventsService = deps.events as any;
      if (eventsService?.broadcastToProject) {
        await eventsService.broadcastToProject(projectId, {
          project_id: projectId,
          event_type: 'event_head_updated',
          data: {
            head_event_id: result.head?.id ?? null,
            head_event: result.head,
            reactivated_event_ids: result.reactivatedEventIds,
            deactivated_event_ids: result.deactivatedEventIds,
          },
        });
      }

      return c.json({
        success: true,
        head_event: result.head,
        head_event_id: result.head?.id ?? null,
        reactivated_event_ids: result.reactivatedEventIds,
        deactivated_event_ids: result.deactivatedEventIds,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to set head event';
      const status = message.includes('not found') ? 404 : 400;
      return c.json({ success: false, error: message }, status);
    }
  });

  router.post('/projects/:projectId/events/revert', async c => {
    const projectId = c.req.param('projectId');

    try {
      const body = await c.req.json();
      const eventIds = body?.event_ids ?? body?.eventIds;

      if (!Array.isArray(eventIds)) {
        return c.json({ success: false, error: 'event_ids must be an array' }, 400);
      }

      const db = deps.db as any;
      const result = db.revertEvents(projectId, eventIds);

      const eventsService = deps.events as any;
      if (eventsService?.broadcastToProject && result.revertedEventIds.length > 0) {
        await eventsService.broadcastToProject(projectId, {
          project_id: projectId,
          event_type: 'events_reverted',
          data: {
            reverted_event_ids: result.revertedEventIds,
            head_event_id: result.head?.id ?? null,
          },
        });
      }

      return c.json({
        success: true,
        head_event: result.head,
        head_event_id: result.head?.id ?? null,
        reverted_event_ids: result.revertedEventIds,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to revert events';
      const status = message.includes('not found') ? 404 : 400;
      return c.json({ success: false, error: message }, status);
    }
  });

  return router;
}

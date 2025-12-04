import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { EventsController } from "../controllers/EventsController";
import { revertEventsSchema, setHeadSchema } from "../schemas/events";
import type { Dependencies } from "./index";

export function createEventsRouter(deps: Dependencies) {
  const router = new Hono();
  const controller = new EventsController(deps);

  router.get("/projects/:projectId/events", async (c) => {
    const projectId = c.req.param("projectId");
    const limitParam = c.req.query("limit");
    const since = c.req.query("since") ?? undefined;
    const includeDanglingParam = c.req.query("includeDangling") ?? c.req.query("include_dangling");

    const limit = limitParam ? Number.parseInt(limitParam, 10) : 100;
    if (Number.isNaN(limit) || limit <= 0) {
      return c.json({ success: false, error: "limit must be a positive integer" }, 400);
    }

    const includeDangling =
      includeDanglingParam === undefined ? true : includeDanglingParam !== "false";

    try {
      const result = await controller.list(projectId, limit, since, includeDangling);
      return c.json({ success: true, ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch events";
      const status = message.includes("not found") ? 404 : 500;
      return c.json({ success: false, error: message }, status);
    }
  });

  router.post("/projects/:projectId/events/head", zValidator("json", setHeadSchema), async (c) => {
    const projectId = c.req.param("projectId");

    try {
      const body = c.req.valid("json");
      const headEventId = body?.head_event_id ?? body?.headEventId ?? null;
      const result = await controller.setHead(projectId, headEventId);
      return c.json({ success: true, ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to set head event";
      const status = message.includes("not found") ? 404 : 400;
      return c.json({ success: false, error: message }, status);
    }
  });

  router.post(
    "/projects/:projectId/events/revert",
    zValidator("json", revertEventsSchema),
    async (c) => {
      const projectId = c.req.param("projectId");

      try {
        const body = c.req.valid("json");
        const eventIds = body.event_ids;
        const result = await controller.revert(projectId, eventIds);
        return c.json({ success: true, ...result });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to revert events";
        const status = message.includes("not found") ? 404 : 400;
        return c.json({ success: false, error: message }, status);
      }
    },
  );

  return router;
}

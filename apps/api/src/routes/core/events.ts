/**
 * Events router for project event management.
 * Provides endpoints for listing, reverting, and managing event heads.
 */
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { z } from "zod";
import { EventsController } from "../../controllers/EventsController";
import { revertEventsSchema, setHeadSchema } from "../../schemas/events";
import type { Dependencies } from "../index";

type SetHeadBody = z.infer<typeof setHeadSchema>;
type RevertEventsBody = z.infer<typeof revertEventsSchema>;
type RouteHandler = (c: Context) => Promise<Response>;

/** Parse limit query parameter with default of 100 */
function parseLimit(limitParam: string | undefined): number | null {
  if (!limitParam) return 100;
  const limit = Number.parseInt(limitParam, 10);
  return Number.isNaN(limit) || limit <= 0 ? null : limit;
}

/** Get error status based on error message content */
function getErrorStatus(message: string, defaultStatus = 500): number {
  return message.includes("not found") ? 404 : defaultStatus;
}

/** Extract error message from unknown error */
function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

/** Wrap route handler with error handling */
function withErrorHandling(
  handler: RouteHandler,
  fallbackMessage: string,
  defaultStatus = 500,
): RouteHandler {
  return async (c: Context) => {
    try {
      return await handler(c);
    } catch (error) {
      const message = getErrorMessage(error, fallbackMessage);
      return c.json(
        { success: false, error: message },
        getErrorStatus(message, defaultStatus) as ContentfulStatusCode,
      );
    }
  };
}

/** Parse includeDangling query parameter */
function parseIncludeDangling(c: Context): boolean {
  const param = c.req.query("includeDangling") ?? c.req.query("include_dangling");
  return param === undefined || param !== "false";
}

/**
 * Create the events router with project event management endpoints.
 */
export function createEventsRouter(deps: Dependencies) {
  const router = new Hono();
  const controller = new EventsController(deps);

  router.get(
    "/projects/:projectId/events",
    withErrorHandling(async (c) => {
      const projectId = c.req.param("projectId");
      const limit = parseLimit(c.req.query("limit"));
      if (limit === null) {
        return c.json({ success: false, error: "limit must be a positive integer" }, 400);
      }
      const result = await controller.list(
        projectId,
        limit,
        c.req.query("since"),
        parseIncludeDangling(c),
      );
      return c.json({ success: true, ...result });
    }, "Failed to fetch events"),
  );

  router.post(
    "/projects/:projectId/events/head",
    zValidator("json", setHeadSchema),
    withErrorHandling(
      async (c) => {
        const projectId = c.req.param("projectId");
        const body = (c.req as any).valid("json") as SetHeadBody;
        const result = await controller.setHead(
          projectId,
          body?.head_event_id ?? body?.headEventId ?? null,
        );
        return c.json({ success: true, ...result });
      },
      "Failed to set head event",
      400,
    ),
  );

  router.post(
    "/projects/:projectId/events/revert",
    zValidator("json", revertEventsSchema),
    withErrorHandling(
      async (c) => {
        const projectId = c.req.param("projectId");
        const body = (c.req as any).valid("json") as RevertEventsBody;
        const result = await controller.revert(projectId, body.event_ids);
        return c.json({ success: true, ...result });
      },
      "Failed to revert events",
      400,
    ),
  );

  return router;
}

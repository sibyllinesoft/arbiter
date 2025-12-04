import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { FragmentsController } from "../controllers/FragmentsController";
import { createFragmentSchema } from "../schemas/fragment";
import { logger } from "../utils";

type Dependencies = Record<string, unknown>;

function coerceServiceDependencies(input: unknown): string[] {
  if (!input) return [];
  if (Array.isArray(input)) return input.map((value) => String(value));
  if (typeof input === "object") {
    return Object.entries(input as Record<string, { service?: string; version?: string }>).map(
      ([alias, spec]) => {
        if (spec && typeof spec === "object" && typeof spec.service === "string") {
          const version = spec.version ? ` (${spec.version})` : "";
          return `${alias}: ${spec.service}${version}`;
        }
        return alias;
      },
    );
  }
  return [];
}

export function createFragmentsRouter(deps: Dependencies) {
  const router = new Hono();
  const controller = deps.db ? new FragmentsController(deps) : null;

  router.get("/fragments", async (c) => {
    try {
      if (!controller) {
        return c.json({ success: false, error: "Database service unavailable" }, 500);
      }

      const projectId =
        c.req.query("projectId") ?? c.req.query("project_id") ?? c.req.query("project");
      if (!projectId || projectId.trim().length === 0) {
        return c.json({ success: false, error: "projectId query parameter is required" }, 400);
      }

      const fragments = await controller.list(projectId);
      return c.json({ success: true, fragments });
    } catch (error) {
      logger.error("Failed to list fragments", error instanceof Error ? error : undefined);
      return c.json({ success: false, error: "Failed to list fragments" }, 500);
    }
  });

  router.post("/fragments", zValidator("json", createFragmentSchema), async (c) => {
    const startedAt = Date.now();
    try {
      if (!controller) {
        return c.json({ success: false, error: "Database service unavailable" }, 500);
      }

      const payload = c.req.valid("json");
      const projectId = payload.projectId ?? payload.project_id ?? "";
      if (!projectId.trim()) {
        return c.json({ success: false, error: "projectId is required" }, 400);
      }

      const result = await controller.create({
        projectId,
        path: payload.path,
        content: payload.content,
        author: payload.author,
        message: payload.message,
      });

      return c.json({
        success: true,
        fragment: result.fragment,
        validation: result.validation,
        processing_time_ms: Date.now() - startedAt,
      });
    } catch (error) {
      logger.error("Failed to create fragment", error instanceof Error ? error : undefined);
      return c.json(
        {
          success: false,
          error: "Failed to create fragment",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        500,
      );
    }
  });

  // Utility endpoint preserved for compatibility
  router.get("/services/dependencies", (c) => {
    const servicesParam = c.req.query("services");
    const dependencies = coerceServiceDependencies(servicesParam ? JSON.parse(servicesParam) : {});
    return c.json({ dependencies });
  });

  return router;
}

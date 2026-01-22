import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { z } from "zod";
import { CoreController } from "../../controllers/CoreController";
import { fetchSchema, searchSchema } from "../../schemas/core";

type Dependencies = Record<string, unknown>;

/** Create error response with appropriate status code */
function createErrorResponse(c: Context, error: unknown, defaultMessage: string) {
  const err = error as { message?: string; status?: number; code?: string };
  const isNotFound = err.code === "ENOENT";
  const status = err.status ?? (isNotFound ? 404 : 500);
  const message = err.message ?? (isNotFound ? "File not found" : defaultMessage);

  return c.json({ success: false, error: message }, status as ContentfulStatusCode);
}

export function createCoreRouter(deps: Dependencies) {
  const router = new Hono();
  const controller = new CoreController(deps);

  type SearchBody = z.infer<typeof searchSchema>;
  router.post(
    "/search",
    zValidator(
      "json",
      searchSchema.transform((data) => ({ ...data, limit: data.limit ?? 10 })),
    ),
    async (c) => {
      try {
        const body = (c.req as any).valid("json") as SearchBody;
        const { query, type, limit } = body;
        const results = await controller.search(query, type, limit);
        return c.json({ success: true, query, type, total: results.length, results });
      } catch (error) {
        return createErrorResponse(c, error, "Search failed");
      }
    },
  );

  router.get("/environment", (c) => c.json(controller.runtime()));

  type FetchBody = z.infer<typeof fetchSchema>;
  router.post("/fetch", zValidator("json", fetchSchema), async (c) => {
    try {
      const body = (c.req as any).valid("json") as FetchBody;
      const result = await controller.fetchFile(body.path, body.encoding as BufferEncoding);
      return c.json({ success: true, ...result });
    } catch (error) {
      return createErrorResponse(c, error, "Failed to fetch file");
    }
  });

  router.post("/validate", async (c) =>
    c.json({ success: true, spec_hash: "stubbed", resolved: {} }),
  );

  return router;
}

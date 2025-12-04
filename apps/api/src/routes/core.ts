import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { CoreController } from "../controllers/CoreController";
import { fetchSchema, searchSchema } from "../schemas/core";

type Dependencies = Record<string, unknown>;

export function createCoreRouter(deps: Dependencies) {
  const router = new Hono();
  const controller = new CoreController(deps);

  router.post(
    "/search",
    zValidator(
      "json",
      searchSchema.transform((data) => ({ ...data, limit: data.limit ?? 10 })),
    ),
    async (c) => {
      try {
        const body = c.req.valid("json");
        const { query, type, limit } = body;
        const results = await controller.search(query, type, limit);
        return c.json({
          success: true,
          query,
          type,
          total: results.length,
          results,
        });
      } catch (error) {
        return c.json(
          {
            success: false,
            error: "Search failed",
            message: error instanceof Error ? error.message : "Unknown error",
          },
          500,
        );
      }
    },
  );

  router.get("/environment", (c) => c.json(controller.runtime()));

  router.post("/fetch", zValidator("json", fetchSchema), async (c) => {
    try {
      const body = c.req.valid("json");
      const result = await controller.fetchFile(body.path, body.encoding as BufferEncoding);
      return c.json({ success: true, ...result });
    } catch (error) {
      const status = (error as any)?.status ?? ((error as any).code === "ENOENT" ? 404 : 500);
      return c.json(
        {
          success: false,
          error:
            (error as any)?.message ??
            ((error as any).code === "ENOENT" ? "File not found" : "Failed to fetch file"),
        },
        status,
      );
    }
  });

  // Existing validate stub
  router.post("/validate", async (c) =>
    c.json({ success: true, spec_hash: "stubbed", resolved: {} }),
  );

  return router;
}

import { describe, expect, it } from "bun:test";
import { Hono } from "hono";
import { SpecWorkbenchDB } from "../../util/db";
import type { ServerConfig } from "../../util/types";
import { createSpecsRouter } from "../io/specs";

/** Create test server config */
const createTestConfig = (): ServerConfig => ({
  port: 0,
  host: "localhost",
  database_path: ":memory:",
  spec_workdir: `/tmp/specs-route-test-${Date.now()}`,
  jq_binary_path: "jq",
  auth_required: false,
  external_tool_timeout_ms: 5000,
  websocket: { max_connections: 10, ping_interval_ms: 30000 },
});

/** Create test app with specs router */
const createTestApp = (db: SpecWorkbenchDB) => {
  const router = createSpecsRouter({ db });
  const app = new Hono();
  app.route("/api", router);
  return app;
};

/** Execute a test with automatic DB cleanup */
async function withTestDb<T>(fn: (db: SpecWorkbenchDB) => Promise<T>): Promise<T> {
  const db = await SpecWorkbenchDB.create(createTestConfig());
  try {
    return await fn(db);
  } finally {
    await db.close();
  }
}

describe("Specs routes", () => {
  it("surfaces framework metadata when artifact column is empty", async () => {
    await withTestDb(async (db) => {
      const projectId = "project-manual-service";
      await db.createProject(projectId, "Manual Service Project");

      await db.createArtifact(
        "artifact-missing-framework",
        projectId,
        "billing-service",
        "Handles billing requests",
        "service",
        "TypeScript",
        null,
        { framework: "Fastify", language: "TypeScript" },
        "services/billing/index.ts",
        0.9,
      );

      const app = createTestApp(db);
      const response = await app.request(`/api/resolved?projectId=${projectId}`);
      expect(response.status).toBe(200);

      const payload: any = await response.json();
      const service = payload?.resolved?.spec?.services?.["billing-service"];
      expect(service).toBeDefined();
      expect(service.metadata?.framework).toBe("Fastify");
      expect(service.metadata?.language).toBe("TypeScript");
      expect(service.ports?.[0]?.port).toBe(3000);
    });
  });
});

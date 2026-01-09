import { describe, expect, it } from "bun:test";
import { Hono } from "hono";
import { generateId } from "../../io/utils";
import { SpecWorkbenchDB } from "../../util/db";
import type { ServerConfig } from "../../util/types";
import { createProjectsRouter } from "../io/projects";

/** Create base server config for testing */
const createTestConfig = (): ServerConfig => ({
  port: 0,
  host: "localhost",
  database_path: ":memory:",
  spec_workdir: `/tmp/projects-route-test-${Date.now()}`,
  jq_binary_path: "jq",
  auth_required: false,
  external_tool_timeout_ms: 5000,
  websocket: {
    max_connections: 10,
    ping_interval_ms: 30000,
  },
});

/** Create test app with projects router */
const createTestApp = (db: SpecWorkbenchDB) => {
  const router = createProjectsRouter({ db });
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

describe("Projects routes", () => {
  it("includes artifact descriptions in resolved project payloads", async () => {
    await withTestDb(async (db) => {
      const projectId = generateId();
      const artifactId = generateId();
      const description = "Module description pulled from package manifest";

      await db.createProject(projectId, "Module Project");
      await db.createArtifact(
        artifactId,
        projectId,
        "module-core",
        description,
        "module",
        "typescript",
        null,
        { package: { name: "module-core", description } },
        "packages/module-core/package.json",
      );

      const app = createTestApp(db);
      const response = await app.request(`/api/projects/${projectId}`);
      expect(response.status).toBe(200);

      const payload: any = await response.json();
      const component = payload?.resolved?.components?.["module-core"];
      expect(component).toBeDefined();
      expect(component.description).toBe(description);

      const artifact = Array.isArray(payload?.resolved?.artifacts)
        ? payload.resolved.artifacts.find((item: any) => item.id === artifactId)
        : null;
      expect(artifact?.description).toBe(description);
    });
  });

  it("allows service environment variables to be created and updated", async () => {
    await withTestDb(async (db) => {
      const projectId = generateId();
      await db.createProject(projectId, "Env Project");

      const app = createTestApp(db);

      const createResponse = await app.request(`/api/projects/${projectId}/entities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "service",
          values: {
            name: "env-service",
            language: "TypeScript",
            environment: { DATABASE_URL: "postgres://db.example/app", NODE_ENV: "production" },
          },
        }),
      });
      expect(createResponse.status).toBe(200);
      const createdPayload: any = await createResponse.json();
      const artifactId = createdPayload?.artifact?.id;
      expect(artifactId).toBeDefined();

      const projectResponse = await app.request(`/api/projects/${projectId}`);
      expect(projectResponse.status).toBe(200);
      const projectData: any = await projectResponse.json();
      expect(
        projectData?.resolved?.services?.["env-service"]?.metadata?.environment?.DATABASE_URL,
      ).toBe("postgres://db.example/app");
      expect(
        projectData?.resolved?.services?.["env-service"]?.metadata?.environment?.NODE_ENV,
      ).toBe("production");

      const updateResponse = await app.request(
        `/api/projects/${projectId}/entities/${artifactId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "service",
            values: { name: "env-service", language: "TypeScript", environment: null },
          }),
        },
      );
      expect(updateResponse.status).toBe(200);

      const refreshedResponse = await app.request(`/api/projects/${projectId}`);
      expect(refreshedResponse.status).toBe(200);
      const refreshedData: any = await refreshedResponse.json();
      expect(
        refreshedData?.resolved?.services?.["env-service"]?.metadata?.environment,
      ).toBeUndefined();
    });
  });
});

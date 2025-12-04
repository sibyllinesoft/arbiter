import { describe, expect, it } from "bun:test";
import { Hono } from "hono";
import { SpecWorkbenchDB } from "../db.ts";
import type { ServerConfig } from "../types.ts";
import { generateId } from "../utils.ts";
import { createProjectsRouter } from "./projects.ts";

describe("Projects routes", () => {
  const baseConfig: ServerConfig = {
    port: 0,
    host: "localhost",
    database_path: ":memory:",
    spec_workdir: `/tmp/projects-route-test-${Date.now()}`,
    jq_binary_path: "jq",
    auth_required: false,
    rate_limit: {
      max_tokens: 10,
      refill_rate: 1,
      window_ms: 1000,
    },
    external_tool_timeout_ms: 5000,
    websocket: {
      max_connections: 10,
      ping_interval_ms: 30000,
    },
  };

  it("includes artifact descriptions in resolved project payloads", async () => {
    const db = await SpecWorkbenchDB.create(baseConfig);

    try {
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
        {
          package: {
            name: "module-core",
            description,
          },
        },
        "packages/module-core/package.json",
      );

      const router = createProjectsRouter({ db });
      const app = new Hono();
      app.route("/api", router);

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
    } finally {
      await db.close();
    }
  });

  it("allows service environment variables to be created and updated", async () => {
    const db = await SpecWorkbenchDB.create(baseConfig);

    try {
      const projectId = generateId();
      await db.createProject(projectId, "Env Project");

      const router = createProjectsRouter({ db });
      const app = new Hono();
      app.route("/api", router);

      const createResponse = await app.request(`/api/projects/${projectId}/entities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "service",
          values: {
            name: "env-service",
            language: "TypeScript",
            environment: {
              DATABASE_URL: "postgres://db.example/app",
              NODE_ENV: "production",
            },
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
            values: {
              name: "env-service",
              language: "TypeScript",
              environment: null,
            },
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
    } finally {
      await db.close();
    }
  });
});

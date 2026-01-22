/**
 * Specs router for specification management.
 * Provides CRUD operations for specifications and resolved data.
 */
import path from "path";
import fs from "fs-extra";
import { Hono } from "hono";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { buildGroupIssueSpec } from "../../io/utils";
import {
  buildBackendRoutes,
  buildComponentsFromArtifacts,
  buildDatabasesFromArtifacts,
  buildFrontendRoutes,
  buildServicesFromArtifacts,
  extractFrontendPackages,
} from "../helpers/artifact-builders";

type Dependencies = Record<string, unknown>;

function generateRequestId(): string {
  return Math.random().toString(36).substr(2, 9);
}

function errorResponse(c: Context, message: string, details?: string, status = 500) {
  return c.json(
    { success: false, error: message, ...(details && { message: details }) },
    status as ContentfulStatusCode,
  );
}

function successResponse(c: Context, data: Record<string, unknown>) {
  return c.json({ success: true, ...data });
}

/**
 * Build the resolved specification structure from project artifacts.
 */
function buildResolvedSpec(
  project: any,
  artifacts: any[],
  services: any,
  databases: any,
  components: any,
  routes: any[],
  groups: any[],
  tasks: any[],
) {
  const flows =
    Object.keys(services).length > 0
      ? [
          {
            id: "service-flow",
            name: "Service Integration Flow",
            steps: [{ visit: "/" }, { expect_api: { method: "GET", path: "/health" } }],
          },
        ]
      : [];

  return {
    apiVersion: "v2",
    kind: "Application",
    metadata: {
      name: project.name,
      version: project.version || "1.0.0",
      brownfield: true,
      detectedServices: Object.keys(services).length,
      detectedDatabases: Object.keys(databases).length,
      totalArtifacts: artifacts.length,
    },
    groups,
    tasks,
    spec: {
      services,
      databases,
      components,
      frontend: { packages: extractFrontendPackages(artifacts) },
      ui: { routes },
      flows,
      capabilities: {
        "read-data": { name: "Read Data", description: "Capability to read application data" },
      },
      groups,
      tasks,
    },
  };
}

/**
 * Handle GET /specifications endpoint.
 */
async function handleGetSpecification(c: Context) {
  const startTime = Date.now();
  const requestId = generateRequestId();

  console.log(`[SPECS-GET] ${requestId} - Request started`);

  const { type, path: specPath } = c.req.query();

  if (!specPath || !(await fs.pathExists(specPath))) {
    console.log(`[SPECS-GET] ${requestId} - File not found after ${Date.now() - startTime}ms`);
    return errorResponse(c, "Specification not found", undefined, 404);
  }

  const content = await fs.readFile(specPath, "utf-8");
  const stat = await fs.stat(specPath);
  console.log(`[SPECS-GET] ${requestId} - Success after ${Date.now() - startTime}ms`);

  return successResponse(c, {
    type,
    path: specPath,
    content,
    lastModified: stat.mtime.toISOString(),
  });
}

/**
 * Handle POST /specifications endpoint.
 */
async function handlePostSpecification(c: Context) {
  const startTime = Date.now();
  const requestId = generateRequestId();

  console.log(`[SPECS-POST] ${requestId} - Request started`);

  const { type, path: specPath, content } = await c.req.json();

  if (!specPath || !content) {
    return errorResponse(c, "path and content are required", undefined, 400);
  }

  await fs.ensureDir(path.dirname(specPath));
  await fs.writeFile(specPath, content, "utf-8");

  console.log(`[SPECS-POST] ${requestId} - Success after ${Date.now() - startTime}ms`);

  return successResponse(c, {
    type,
    path: specPath,
    message: "Specification created successfully",
    lastModified: new Date().toISOString(),
  });
}

/**
 * Handle GET /resolved endpoint.
 */
async function handleGetResolved(c: Context, deps: Dependencies) {
  const projectId = c.req.query("projectId");

  if (!projectId) {
    return c.json({ error: "projectId parameter is required" }, 400);
  }

  const db = deps.db as any;
  const projects = await db.listProjects();
  const project = projects.find((p: any) => p.id === projectId);

  if (!project) {
    return c.json({ error: "Project not found" }, 404);
  }

  const artifacts = await db.getArtifacts(projectId);

  const services = buildServicesFromArtifacts(artifacts);
  const databases = buildDatabasesFromArtifacts(artifacts);
  const components = buildComponentsFromArtifacts(artifacts, services);
  const frontendPackages = extractFrontendPackages(artifacts);
  const derivedRoutes = buildFrontendRoutes(frontendPackages);
  const backendRoutes = await buildBackendRoutes(artifacts, services);

  const routeMap = new Map<string, any>();
  derivedRoutes.forEach((route: any) => routeMap.set(route.id, route));
  backendRoutes.forEach((route: any) => routeMap.set(route.id, route));
  const routes = Array.from(routeMap.values());

  const { groups, tasks } = buildGroupIssueSpec(artifacts);

  const resolved = buildResolvedSpec(
    project,
    artifacts,
    services,
    databases,
    components,
    routes,
    groups,
    tasks,
  );

  return c.json({ success: true, projectId, resolved });
}

/**
 * Create the specs router.
 */
export function createSpecsRouter(deps: Dependencies) {
  const router = new Hono();

  router.get("/specifications", async (c) => {
    try {
      return await handleGetSpecification(c);
    } catch (error) {
      console.error("[SPECS-GET] Error:", error);
      return errorResponse(
        c,
        "Failed to retrieve specification",
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  });

  router.post("/specifications", async (c) => {
    try {
      return await handlePostSpecification(c);
    } catch (error) {
      console.error("[SPECS-POST] Error:", error);
      return errorResponse(
        c,
        "Failed to create specification",
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  });

  router.get("/resolved", async (c) => {
    try {
      return await handleGetResolved(c, deps);
    } catch (error) {
      console.error("Error fetching resolved spec:", error);
      return c.json({ error: "Failed to fetch project specification" }, 500);
    }
  });

  return router;
}

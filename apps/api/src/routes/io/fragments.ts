/**
 * Fragments router for specification fragment management.
 * Provides CRUD operations for CUE specification fragments.
 */
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { Context } from "hono";
import type { z } from "zod";
import { FragmentsController } from "../../controllers/FragmentsController";
import { logger } from "../../io/utils";
import { createFragmentSchema } from "../../schemas/fragment";

type Dependencies = Record<string, unknown>;
type CreateFragmentBody = z.infer<typeof createFragmentSchema>;

/**
 * Extract service framework from various possible locations.
 */
function extractFramework(svc: Record<string, unknown>): string | null {
  const runtimeFramework = (svc as any)?.runtime?.framework;
  if (typeof runtimeFramework === "string") {
    return runtimeFramework;
  }

  const metadataFramework = (svc as any)?.metadata?.framework;
  if (typeof metadataFramework === "string") {
    return metadataFramework;
  }

  const capabilities = (svc as any)?.capabilities;
  if (Array.isArray(capabilities)) {
    const adapterName = capabilities
      .map((cap: any) => cap?.adapter?.name)
      .find((name: unknown) => typeof name === "string");
    if (typeof adapterName === "string") {
      return adapterName;
    }
  }

  return null;
}

/**
 * Extract artifacts from resolved specification data packages.
 */
export function extractArtifactsFromResolved(resolved: Record<string, unknown>) {
  const services: Array<Record<string, unknown>> = [];

  const packagesSource = (resolved as any)?.packages ?? {};
  const entries: Array<[string, any]> = Array.isArray(packagesSource)
    ? packagesSource.map((pkg, idx) => [`package-${idx + 1}`, pkg])
    : packagesSource && typeof packagesSource === "object"
      ? Object.entries(packagesSource as Record<string, unknown>)
      : [];

  for (const [key, value] of entries) {
    const pkg = (value as Record<string, unknown>) ?? {};
    const framework = extractFramework(pkg);

    services.push({
      id: pkg.id ?? key,
      name: (pkg as any).name ?? key,
      framework,
      ...pkg,
      metadata: (pkg as any).metadata ?? (framework ? { framework } : undefined),
    });
  }

  return { services };
}

/**
 * Coerce service dependencies to string array.
 */
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

/**
 * Handle GET /fragments endpoint.
 */
async function handleListFragments(c: Context, controller: FragmentsController | null) {
  if (!controller) {
    return c.json({ success: false, error: "Database service unavailable" }, { status: 500 });
  }

  const projectId = c.req.query("projectId") ?? c.req.query("project_id") ?? c.req.query("project");
  if (!projectId || projectId.trim().length === 0) {
    return c.json(
      { success: false, error: "projectId query parameter is required" },
      { status: 400 },
    );
  }

  const fragments = await controller.list(projectId);
  return c.json({ success: true, fragments });
}

/**
 * Handle POST /fragments endpoint.
 */
async function handleCreateFragment(c: Context, controller: FragmentsController | null) {
  const startedAt = Date.now();

  if (!controller) {
    return c.json({ success: false, error: "Database service unavailable" }, { status: 500 });
  }

  const payload = (c.req as any).valid("json") as CreateFragmentBody;
  const projectId = payload.projectId ?? payload.project_id ?? "";
  if (!projectId.trim()) {
    return c.json({ success: false, error: "projectId is required" }, { status: 400 });
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
}

/**
 * Create the fragments router.
 */
export function createFragmentsRouter(deps: Dependencies) {
  const router = new Hono();
  const controller = deps.db ? new FragmentsController(deps) : null;

  router.get("/fragments", async (c) => {
    try {
      return await handleListFragments(c, controller);
    } catch (error) {
      logger.error("Failed to list fragments", error instanceof Error ? error : undefined);
      return c.json({ success: false, error: "Failed to list fragments" }, { status: 500 });
    }
  });

  router.post("/fragments", zValidator("json", createFragmentSchema), async (c) => {
    try {
      return await handleCreateFragment(c, controller);
    } catch (error) {
      logger.error("Failed to create fragment", error instanceof Error ? error : undefined);
      return c.json(
        {
          success: false,
          error: "Failed to create fragment",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 500 },
      );
    }
  });

  router.get("/services/dependencies", (c) => {
    const servicesParam = c.req.query("services");
    const dependencies = coerceServiceDependencies(servicesParam ? JSON.parse(servicesParam) : {});
    return c.json({ dependencies });
  });

  return router;
}

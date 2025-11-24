import { randomUUID } from "node:crypto";
import path from "node:path";
import { Hono } from "hono";
import type { SpecWorkbenchDB } from "../db";
import type { SpecEngine } from "../specEngine";
import { logger } from "../utils";

type Dependencies = Record<string, unknown>;

interface FragmentPayload {
  projectId?: string;
  project_id?: string;
  path?: string;
  content?: string;
  author?: string;
  message?: string;
}

function normalizePath(fragmentPath: string): string {
  const normalized = path
    .normalize(fragmentPath)
    .replace(/\\/g, "/")
    .replace(/^(\.\/)+/, "")
    .replace(/^\//, "");

  return normalized.length > 0 ? normalized : "assembly.cue";
}

function coerceServiceDependencies(input: unknown): string[] {
  if (!input) {
    return [];
  }

  if (Array.isArray(input)) {
    return input.map((value) => String(value));
  }

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

  router.get("/fragments", async (c) => {
    try {
      const db = deps.db as SpecWorkbenchDB | undefined;
      if (!db) {
        return c.json(
          {
            success: false,
            error: "Database service unavailable",
          },
          500,
        );
      }

      const projectId =
        c.req.query("projectId") ?? c.req.query("project_id") ?? c.req.query("project");
      if (!projectId || projectId.trim().length === 0) {
        return c.json(
          {
            success: false,
            error: "projectId query parameter is required",
          },
          400,
        );
      }

      const fragments = await db.listFragments(projectId);
      return c.json({
        success: true,
        fragments,
      });
    } catch (error) {
      logger.error("Failed to list fragments", error instanceof Error ? error : undefined);
      return c.json(
        {
          success: false,
          error: "Failed to list fragments",
        },
        500,
      );
    }
  });

  router.post("/fragments", async (c) => {
    const startedAt = Date.now();
    try {
      const db = deps.db as SpecWorkbenchDB | undefined;
      const specEngine = deps.specEngine as SpecEngine | undefined;

      if (!db) {
        return c.json(
          {
            success: false,
            error: "Database service unavailable",
          },
          500,
        );
      }

      const payload = (await c.req.json()) as FragmentPayload;

      const projectIdRaw = payload.projectId ?? payload.project_id;
      const fragmentPathRaw = payload.path;
      const content = payload.content;

      if (!projectIdRaw || projectIdRaw.trim().length === 0) {
        return c.json(
          {
            success: false,
            error: "projectId is required",
          },
          400,
        );
      }

      if (!fragmentPathRaw || fragmentPathRaw.trim().length === 0) {
        return c.json(
          {
            success: false,
            error: "path is required",
          },
          400,
        );
      }

      if (typeof content !== "string" || content.trim().length === 0) {
        return c.json(
          {
            success: false,
            error: "content is required",
          },
          400,
        );
      }

      const projectId = projectIdRaw.trim();
      const fragmentPath = normalizePath(fragmentPathRaw);

      // Ensure project row exists
      const existingProject = await db.getProject(projectId);
      if (!existingProject) {
        await db.createProject(projectId, projectId);
      }

      const existingFragment = await db.getFragment(projectId, fragmentPath);
      let fragment =
        existingFragment !== null
          ? await db.updateFragment(
              projectId,
              fragmentPath,
              content,
              payload.author,
              payload.message,
            )
          : await db.createFragment(
              randomUUID(),
              projectId,
              fragmentPath,
              content,
              payload.author,
              payload.message ?? "Initial fragment import",
            );

      let validation:
        | {
            success: boolean;
            specHash: string;
            errors: unknown[];
            warnings: unknown[];
          }
        | undefined;

      if (specEngine) {
        try {
          const projectFragments = await db.listFragments(projectId);
          const validationResult = await specEngine.validateProject(projectId, projectFragments);
          validation = {
            success: validationResult.success,
            specHash: validationResult.specHash,
            errors: validationResult.errors,
            warnings: validationResult.warnings,
          };

          if (validationResult.success && validationResult.resolved) {
            await persistResolvedSpec(
              db,
              projectId,
              fragmentPath,
              validationResult.specHash,
              validationResult.resolved as Record<string, unknown>,
            );
          }

          // When validation succeeds, refresh file system fragments to keep /api/specifications working
          fragment = (await db.getFragment(projectId, fragmentPath)) ?? fragment;
        } catch (validationError) {
          logger.error(
            "Fragment validation failed",
            validationError instanceof Error ? validationError : undefined,
            {
              projectId,
              fragmentPath,
            },
          );
        }
      }

      logger.info("Fragment imported", {
        projectId,
        fragmentPath,
        durationMs: Date.now() - startedAt,
      });

      return c.json({
        success: true,
        fragment,
        validation,
      });
    } catch (error) {
      logger.error("Failed to import fragment", error instanceof Error ? error : undefined);
      return c.json(
        {
          success: false,
          error: "Failed to import fragment",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        500,
      );
    }
  });

  return router;
}

const SPEC_ARTIFACT_SOURCE = "spec-import";

type DerivedArtifact = {
  name: string;
  type: "service" | "database" | "frontend" | "view" | "package" | "tool" | "infrastructure";
  description?: string | null;
  language?: string | null;
  framework?: string | null;
  metadata?: Record<string, unknown> | null;
  filePath?: string | null;
};

type ExtractedArtifacts = {
  services: DerivedArtifact[];
  databases: DerivedArtifact[];
  frontends: DerivedArtifact[];
  views: DerivedArtifact[];
  modules: DerivedArtifact[];
  tools: DerivedArtifact[];
  infrastructure: DerivedArtifact[];
};

function withSpecSource(metadata?: Record<string, unknown> | null): Record<string, unknown> | null {
  const base =
    metadata && typeof metadata === "object" ? { ...metadata } : ({} as Record<string, unknown>);
  base.source = SPEC_ARTIFACT_SOURCE;
  return base;
}

const RESERVED_WORKLOAD_HINTS = new Set([
  "deployment",
  "statefulset",
  "daemonset",
  "job",
  "cronjob",
  "serverless",
]);

function normalizeFrameworkCandidate(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const lowered = trimmed.toLowerCase();
  if (lowered === "unknown" || RESERVED_WORKLOAD_HINTS.has(lowered)) return undefined;
  return trimmed;
}

function collectAdapterNames(adapterLike: unknown): string[] {
  if (!adapterLike) return [];
  if (typeof adapterLike === "string") {
    return [adapterLike];
  }
  if (typeof adapterLike === "object") {
    const adapter = adapterLike as Record<string, unknown>;
    const values: string[] = [];
    if (typeof adapter.name === "string") values.push(adapter.name);
    if (typeof adapter.type === "string") values.push(adapter.type);
    if (typeof adapter.framework === "string") values.push(adapter.framework);
    return values;
  }
  return [];
}

function extractCapabilityAdapters(rawCapabilities: unknown): string[] {
  if (!rawCapabilities) return [];

  const candidates: unknown[] = Array.isArray(rawCapabilities)
    ? rawCapabilities
    : typeof rawCapabilities === "object"
      ? Object.values(rawCapabilities as Record<string, unknown>)
      : [];

  const adapterNames: string[] = [];
  for (const capability of candidates) {
    if (!capability || typeof capability !== "object") continue;
    const adapter = (capability as Record<string, unknown>).adapter;
    adapterNames.push(...collectAdapterNames(adapter));
  }

  return adapterNames;
}

function resolveFrameworkFromService(service: Record<string, any>): string | undefined {
  const runtime =
    service.runtime && typeof service.runtime === "object"
      ? (service.runtime as Record<string, any>)
      : undefined;
  const metadataSection =
    service.metadata && typeof service.metadata === "object"
      ? (service.metadata as Record<string, any>)
      : undefined;

  const directCandidates: unknown[] = [
    service.framework,
    runtime?.framework,
    metadataSection?.framework,
    service.technology,
    metadataSection?.technology,
  ];

  const adapterCandidates: string[] = [
    ...collectAdapterNames(runtime?.adapter),
    ...collectAdapterNames(metadataSection?.adapter),
    ...extractCapabilityAdapters(service.capabilities),
  ];

  for (const candidate of [...directCandidates, ...adapterCandidates]) {
    const normalized = normalizeFrameworkCandidate(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return undefined;
}

export function extractArtifactsFromResolved(
  resolved: Record<string, unknown> | undefined | null,
): ExtractedArtifacts {
  if (!resolved || typeof resolved !== "object") {
    return {
      services: [],
      databases: [],
      frontends: [],
      views: [],
      modules: [],
      tools: [],
      infrastructure: [],
    };
  }

  const servicesSection = (resolved as any).services ?? {};
  const services: DerivedArtifact[] = [];
  const databases: DerivedArtifact[] = [];

  if (servicesSection && typeof servicesSection === "object") {
    for (const [serviceName, rawValue] of Object.entries(servicesSection as Record<string, any>)) {
      const service = rawValue || {};
      const artifactType =
        service.type === "internal" || service.type === "external" ? service.type : undefined;
      const workloadType =
        typeof service.workload === "string"
          ? service.workload
          : typeof service.type === "string" &&
              ["deployment", "statefulset", "daemonset", "job", "cronjob"].includes(service.type)
            ? (service.type as "deployment" | "statefulset" | "daemonset" | "job" | "cronjob")
            : undefined;
      const image =
        typeof service.image === "string" && service.image.length > 0 ? service.image : undefined;
      const description =
        typeof service.description === "string" && service.description.trim().length > 0
          ? service.description.trim()
          : null;
      const language =
        typeof service.language === "string" && service.language.trim().length > 0
          ? service.language.trim()
          : null;
      const framework = resolveFrameworkFromService(service as Record<string, any>) ?? null;

      const isDatabase =
        workloadType === "statefulset" ||
        (typeof serviceName === "string" && serviceName.toLowerCase().includes("db")) ||
        (service.resource as any)?.kind === "database";

      const metadata: Record<string, unknown> = {
        artifactType,
        workloadType,
        image,
      };

      if (framework) {
        metadata.framework = framework;
      }
      const dependencyList = coerceServiceDependencies(service.dependencies);
      if (dependencyList.length > 0) {
        metadata.dependencies = dependencyList;
      }
      if (service.ports) {
        metadata.ports = service.ports;
      }
      if (service.config?.environment) {
        metadata.environment = service.config.environment;
      }
      if (service.env) {
        metadata.env = service.env;
      }

      const artifact: DerivedArtifact = {
        name: serviceName,
        description,
        type: isDatabase ? "database" : "service",
        language,
        framework,
        metadata: withSpecSource(metadata),
      };

      if (isDatabase) {
        databases.push(artifact);
      } else {
        services.push(artifact);
      }
    }
  }

  const frontends: DerivedArtifact[] = [];
  const views: DerivedArtifact[] = [];
  const modules: DerivedArtifact[] = [];
  const tools: DerivedArtifact[] = [];
  const infrastructure: DerivedArtifact[] = [];

  const ui = (resolved as any).ui;
  if (ui && typeof ui === "object" && Array.isArray(ui.routes)) {
    const productName =
      typeof (resolved as any).product?.name === "string"
        ? ((resolved as any).product.name as string)
        : "frontend";

    frontends.push({
      name: productName,
      type: "frontend",
      description: Array.isArray((resolved as any).product?.goals)
        ? ((resolved as any).product.goals as string[]).join(" ")
        : null,
      metadata: withSpecSource({
        routes: ui.routes.map((route: any) => route.path ?? route.id).filter(Boolean),
        components: ui.routes.flatMap((route: any) => route.components ?? []),
      }),
    });

    for (const route of ui.routes) {
      if (!route || typeof route !== "object") continue;
      const viewName =
        typeof route.id === "string" && route.id.length > 0 ? (route.id as string) : route.path;
      if (!viewName) continue;

      views.push({
        name: viewName,
        type: "view",
        description:
          typeof route.description === "string" && route.description.trim().length > 0
            ? route.description.trim()
            : null,
        metadata: withSpecSource({
          path: route.path,
          capabilities: route.capabilities ?? [],
          components: route.components ?? [],
          layout: route.layout,
        }),
      });
    }
  }

  const flows = (resolved as any).flows;
  if (Array.isArray(flows)) {
    for (const flow of flows) {
      if (!flow || typeof flow !== "object") continue;
      const flowId = typeof flow.id === "string" ? flow.id : "flow";
      modules.push({
        name: flowId,
        type: "package",
        metadata: withSpecSource({
          moduleType: "flow",
          steps: flow.steps ?? [],
        }),
      });
    }
  }

  const capabilities = (resolved as any).capabilities;
  if (capabilities && typeof capabilities === "object") {
    for (const [capabilityName, capabilityValue] of Object.entries(capabilities)) {
      const capability = capabilityValue as Record<string, unknown>;
      modules.push({
        name: capabilityName,
        type: "package",
        description:
          typeof capability.description === "string" ? (capability.description as string) : null,
        metadata: withSpecSource({
          moduleType: "capability",
          owner: capability.owner,
          kind: capability.kind,
        }),
      });
    }
  }

  const tests = (resolved as any).tests;
  if (Array.isArray(tests)) {
    for (const testSuite of tests) {
      if (!testSuite || typeof testSuite !== "object") continue;
      const name = typeof testSuite.name === "string" ? testSuite.name : "test-suite";
      tools.push({
        name,
        type: "tool",
        metadata: withSpecSource({
          toolType: "test-suite",
          testType: testSuite.type,
          framework: testSuite.framework,
          targets: testSuite.targets,
          cases: testSuite.cases,
        }),
      });
    }
  }

  const docs = (resolved as any).docs;
  if (docs && typeof docs === "object") {
    if (docs.api) {
      modules.push({
        name: "API Documentation",
        type: "package",
        metadata: withSpecSource({
          moduleType: "documentation",
          api: docs.api,
        }),
      });
    }
    if (Array.isArray(docs.runbooks)) {
      for (const runbook of docs.runbooks) {
        if (!runbook) continue;
        const runbookName = typeof runbook.name === "string" ? runbook.name : "Operational Runbook";
        modules.push({
          name: runbookName,
          type: "package",
          metadata: withSpecSource({
            moduleType: "runbook",
            runbook,
          }),
        });
      }
    }
  }

  const data = (resolved as any).data;
  if (data && typeof data === "object" && data.schemas && typeof data.schemas === "object") {
    for (const [schemaName, schemaDef] of Object.entries(data.schemas as Record<string, any>)) {
      modules.push({
        name: `${schemaName}-schema`,
        type: "package",
        metadata: withSpecSource({
          moduleType: "data-schema",
          schema: schemaDef,
        }),
      });
    }
  }

  if (data && typeof data === "object" && data.migrations) {
    infrastructure.push({
      name: "data-migrations",
      type: "infrastructure",
      metadata: withSpecSource({
        category: "database-migration",
        config: data.migrations,
      }),
    });
  }

  const security = (resolved as any).security;
  if (security && typeof security === "object") {
    modules.push({
      name: "security",
      type: "package",
      metadata: withSpecSource({
        moduleType: "security",
        config: security,
      }),
    });
  }

  const performance = (resolved as any).performance;
  if (performance && typeof performance === "object") {
    modules.push({
      name: "performance",
      type: "package",
      metadata: withSpecSource({
        moduleType: "performance",
        config: performance,
      }),
    });
  }

  const observability = (resolved as any).observability;
  if (observability && typeof observability === "object") {
    infrastructure.push({
      name: "observability",
      type: "infrastructure",
      metadata: withSpecSource({
        category: "observability",
        config: observability,
      }),
    });
  }

  const environments = (resolved as any).environments;
  if (environments && typeof environments === "object") {
    for (const [environmentName, environmentConfig] of Object.entries(
      environments as Record<string, any>,
    )) {
      infrastructure.push({
        name: `${environmentName}-environment`,
        type: "infrastructure",
        metadata: withSpecSource({
          category: "environment",
          environment: environmentConfig,
        }),
      });
    }
  }

  return {
    services,
    databases,
    frontends,
    views,
    modules,
    tools,
    infrastructure,
  };
}

async function persistResolvedSpec(
  db: SpecWorkbenchDB,
  projectId: string,
  fragmentPath: string,
  specHash: string,
  resolved: Record<string, unknown>,
): Promise<void> {
  const resolvedJson = JSON.stringify(resolved, null, 2);

  if (specHash) {
    const existingVersion = await db.getVersionByHash(projectId, specHash);
    if (!existingVersion) {
      await db.createVersion(`version-${Date.now()}`, projectId, specHash, resolvedJson);
    }
  }

  const extracted = extractArtifactsFromResolved(resolved);

  await db.deleteArtifacts(projectId);

  const specArtifacts: DerivedArtifact[] = [
    ...extracted.services,
    ...extracted.databases,
    ...extracted.frontends,
    ...extracted.views,
    ...extracted.modules,
    ...extracted.tools,
    ...extracted.infrastructure,
  ];

  for (const artifact of specArtifacts) {
    await db.createArtifact(
      randomUUID(),
      projectId,
      artifact.name,
      artifact.description ?? null,
      artifact.type,
      artifact.language ?? null,
      artifact.framework ?? null,
      withSpecSource(artifact.metadata),
      artifact.filePath ?? null,
    );
  }

  await db.updateProjectCounts(projectId, extracted.services.length, extracted.databases.length);

  logger.info("Persisted resolved specification snapshot", {
    projectId,
    fragmentPath,
    services: extracted.services.length,
    databases: extracted.databases.length,
    frontends: extracted.frontends.length,
    views: extracted.views.length,
    modules: extracted.modules.length,
    tools: extracted.tools.length,
    infrastructure: extracted.infrastructure.length,
  });
}

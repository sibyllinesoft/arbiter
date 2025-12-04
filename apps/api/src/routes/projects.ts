import { randomUUID } from "node:crypto";
import path from "node:path";
import { ProjectEntities } from "@arbiter/shared/types/entities";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { SpecWorkbenchDB } from "../db";
import type { EventService } from "../events";
import { createProjectSchema } from "../schemas/project";
import { presetService } from "../services/PresetService";
import { ProjectService } from "../services/ProjectService";
import { buildEpicTaskSpec, coerceStringArray } from "../utils";
type Dependencies = Record<string, unknown>;

const TECHNOLOGY_LANGUAGE_MAP: Record<string, string> = {
  "node.js": "javascript",
  node: "javascript",
  express: "javascript",
  fastify: "javascript",
  nestjs: "javascript",
  "next.js": "javascript",
  go: "go",
  golang: "go",
  python: "python",
  django: "python",
  flask: "python",
  fastapi: "python",
  rust: "rust",
  java: "java",
  spring: "java",
  ".net": "c#",
  dotnet: "c#",
};

function slugify(value: string | undefined, fallback: string): string {
  if (!value || value.trim().length === 0) {
    return fallback;
  }

  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");

  return normalized.length > 0 ? normalized : fallback;
}

function guessLanguage(technology: string | undefined): string | undefined {
  if (!technology) return undefined;
  const key = technology.toLowerCase();
  return TECHNOLOGY_LANGUAGE_MAP[key] || TECHNOLOGY_LANGUAGE_MAP[key.replace(/\s+/g, "")];
}

const hasOwn = (obj: Record<string, unknown>, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(obj, key);

function coerceOptionalTrimmedString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function coerceEnvironmentMap(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const map: Record<string, string> = {};

  const assignEntry = (key: unknown, raw: unknown) => {
    if (typeof key !== "string") return;
    const normalizedKey = key.trim();
    if (!normalizedKey) return;
    let normalizedValue: string;
    if (raw === null || raw === undefined) {
      normalizedValue = "";
    } else if (typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean") {
      normalizedValue = String(raw);
    } else if (typeof raw === "object" && raw && "value" in raw) {
      normalizedValue = String((raw as Record<string, unknown>).value ?? "");
    } else {
      normalizedValue = "";
    }
    map[normalizedKey] = normalizedValue;
  };

  if (Array.isArray(value)) {
    value.forEach((entry) => {
      if (!entry) return;
      if (typeof entry === "string") {
        const [key, ...rest] = entry.split(/[:=]/);
        assignEntry(key, rest.join("=").trim());
      } else if (typeof entry === "object") {
        const record = entry as Record<string, unknown>;
        const key = (record.key ?? record.name ?? record.id ?? record.label) as string | undefined;
        assignEntry(key ?? "", record.value ?? record.val ?? record.default ?? "");
      }
    });
  } else {
    Object.entries(value as Record<string, unknown>).forEach(([key, raw]) => {
      assignEntry(key, raw);
    });
  }

  return Object.keys(map).length > 0 ? map : undefined;
}

function buildFrontendArtifactMetadata(values: Record<string, any>, slug: string) {
  const framework =
    typeof values.framework === "string" && values.framework.trim().length > 0
      ? values.framework.trim()
      : undefined;
  const frameworks = framework ? [framework] : [];
  const rawEntryPoint =
    typeof values.entryPoint === "string" && values.entryPoint.trim().length > 0
      ? values.entryPoint.trim()
      : undefined;
  const packageRoot =
    typeof values.packageRoot === "string" && values.packageRoot.trim().length > 0
      ? values.packageRoot.trim()
      : rawEntryPoint && rawEntryPoint.includes("/")
        ? rawEntryPoint.split("/").slice(0, -1).join("/") || `clients/${slug}`
        : `clients/${slug}`;

  const entryPoint = rawEntryPoint
    ? rawEntryPoint.startsWith(`${packageRoot}/`)
      ? rawEntryPoint.slice(packageRoot.length + 1)
      : rawEntryPoint
    : undefined;

  const routerRoutes = entryPoint
    ? [
        {
          path: "/",
          filePath: entryPoint,
          routerType: "frontend",
        },
      ]
    : [];

  return {
    packageRoot,
    frameworks,
    entryPoint,
    frontendAnalysis: {
      frameworks,
      components: [],
      routers: routerRoutes.length
        ? [
            {
              type: "frontend",
              routerType: "frontend",
              routes: routerRoutes,
            },
          ]
        : [],
    },
  };
}

function buildManualArtifactPayload(
  type: string,
  values: Record<string, any>,
  slug: string,
): {
  name: string;
  description: string | null;
  artifactType: string;
  language?: string;
  framework?: string;
  metadata?: Record<string, unknown>;
  filePath?: string;
} | null {
  const name =
    typeof values.name === "string" && values.name.trim().length > 0
      ? values.name.trim()
      : `${type}-${slug}`;
  const description =
    typeof values.description === "string" && values.description.trim().length > 0
      ? values.description.trim()
      : null;

  switch (type) {
    case "frontend": {
      const metadata = buildFrontendArtifactMetadata(values, slug);
      const framework = metadata.frameworks?.[0];
      const entryPoint = metadata.entryPoint;

      return {
        name,
        description,
        artifactType: "frontend",
        language: "typescript",
        framework,
        metadata: {
          description,
          root: metadata.packageRoot,
          sourceFile: entryPoint ? `${metadata.packageRoot}/${entryPoint}` : undefined,
          frontendAnalysis: metadata.frontendAnalysis,
          classification: {
            detectedType: "frontend",
            reason: "manual-entry",
            source: "user",
          },
        },
        filePath: entryPoint ? `${metadata.packageRoot}/${entryPoint}` : undefined,
      };
    }
    case "service": {
      const rawLanguage = typeof values.language === "string" ? values.language.trim() : "";
      const rawFramework = typeof values.framework === "string" ? values.framework.trim() : "";
      const legacyTechnology =
        typeof values.technology === "string" ? values.technology.trim() : "";
      const language = rawLanguage || guessLanguage(legacyTechnology) || "javascript";
      const framework = rawFramework || legacyTechnology || undefined;
      const defaultPortContext = `${framework ?? language}`.toLowerCase();
      const defaultPort = defaultPortContext.includes("python") ? 5000 : 3000;
      const portValue = Number.parseInt(values.port || "", 10);
      const port = Number.isFinite(portValue) ? portValue : defaultPort;
      const environmentProvided = hasOwn(values, "environment");
      const environmentMap = coerceEnvironmentMap(values.environment);
      const shouldClearEnvironment = environmentProvided && !environmentMap;

      return {
        name,
        description,
        artifactType: "service",
        language,
        framework,
        metadata: {
          description,
          port,
          containerImage: `manual/${slug}:latest`,
          language,
          framework,
          ...(environmentMap
            ? { environment: environmentMap }
            : shouldClearEnvironment
              ? { environment: null }
              : {}),
          classification: {
            detectedType: "service",
            reason: "manual-entry",
            source: "user",
          },
        },
        filePath: typeof values.sourcePath === "string" ? values.sourcePath : undefined,
      };
    }
    case "package": {
      const moduleType = coerceOptionalTrimmedString(values.moduleType);
      const owner = coerceOptionalTrimmedString(values.owner);
      const kind = coerceOptionalTrimmedString(values.kind);
      const deliverables = hasOwn(values, "deliverables")
        ? coerceStringArray(values.deliverables)
        : undefined;
      const flowSteps = hasOwn(values, "flowSteps")
        ? coerceStringArray(values.flowSteps)
        : undefined;
      const schemaEngine = coerceOptionalTrimmedString(values.schemaEngine);
      const schemaVersion = coerceOptionalTrimmedString(values.schemaVersion);
      const schemaOwner = coerceOptionalTrimmedString(values.schemaOwner);
      const schemaTables = hasOwn(values, "schemaTables")
        ? coerceStringArray(values.schemaTables)
        : undefined;
      const docFormat = coerceOptionalTrimmedString(values.docFormat);
      const docVersion = coerceOptionalTrimmedString(values.docVersion);
      const docSource = coerceOptionalTrimmedString(values.docSource);
      const runbookName = coerceOptionalTrimmedString(values.runbookName);
      const runbookPath = coerceOptionalTrimmedString(values.runbookPath);
      const slaUptime = coerceOptionalTrimmedString(values.slaUptime);
      const slaP95 = coerceOptionalTrimmedString(values.slaP95);
      const slaP99 = coerceOptionalTrimmedString(values.slaP99);

      const metadata: Record<string, unknown> = {
        description,
        classification: {
          detectedType: "package",
          reason: "manual-entry",
          source: "user",
        },
      };

      if (moduleType) {
        metadata.moduleType = moduleType;
      }
      if (owner) {
        metadata.owner = owner;
      }
      if (kind) {
        metadata.kind = kind;
      }
      if (hasOwn(values, "deliverables")) {
        metadata.deliverables = deliverables ?? [];
      } else if (deliverables && deliverables.length > 0) {
        metadata.deliverables = deliverables;
      }
      if (moduleType === "flow" && hasOwn(values, "flowSteps")) {
        metadata.steps = flowSteps ?? [];
      }
      if (moduleType === "data-schema") {
        const schemaProvided =
          hasOwn(values, "schemaEngine") ||
          hasOwn(values, "schemaVersion") ||
          hasOwn(values, "schemaOwner") ||
          hasOwn(values, "schemaTables");
        if (schemaProvided || schemaEngine || schemaVersion || schemaOwner || schemaTables) {
          const schema: Record<string, unknown> = {};
          if (schemaEngine) schema.engine = schemaEngine;
          if (schemaVersion) schema.version = schemaVersion;
          if (schemaOwner) schema.owner = schemaOwner;
          if (schemaTables && schemaTables.length > 0) {
            schema.tables = schemaTables;
          } else if (hasOwn(values, "schemaTables")) {
            schema.tables = [];
          }
          if (Object.keys(schema).length > 0) {
            metadata.schema = schema;
          }
        }
      }
      if (moduleType === "documentation" && (docFormat || docVersion || docSource)) {
        const api: Record<string, unknown> = {};
        if (docFormat) api.format = docFormat;
        if (docVersion) api.version = docVersion;
        if (docSource) api.source = docSource;
        metadata.api = api;
      }
      if (moduleType === "runbook" && (runbookName || runbookPath)) {
        const runbook: Record<string, unknown> = {};
        if (runbookName) runbook.name = runbookName;
        if (runbookPath) runbook.path = runbookPath;
        metadata.runbook = runbook;
      }
      if (moduleType === "performance" && (slaUptime || slaP95 || slaP99)) {
        metadata.config = {
          ...(metadata.config as Record<string, unknown> | undefined),
          sla: {
            ...(slaUptime ? { uptime: slaUptime } : {}),
            ...(slaP95
              ? {
                  p95ResponseMs: Number.isNaN(Number(slaP95)) ? slaP95 : Number(slaP95),
                }
              : {}),
            ...(slaP99
              ? {
                  p99ResponseMs: Number.isNaN(Number(slaP99)) ? slaP99 : Number(slaP99),
                }
              : {}),
          },
        };
      }

      return {
        name,
        description,
        artifactType: "package",
        metadata,
      };
    }
    case "tool": {
      return {
        name,
        description,
        artifactType: "tool",
        metadata: {
          description,
          command: typeof values.command === "string" ? values.command.trim() : undefined,
          classification: {
            detectedType: "tool",
            reason: "manual-entry",
            source: "user",
          },
        },
      };
    }
    case "database": {
      const engine =
        typeof values.engine === "string" ? values.engine.trim().toLowerCase() : "postgresql";
      const version = typeof values.version === "string" ? values.version.trim() : undefined;
      return {
        name,
        description,
        artifactType: "database",
        framework: engine,
        metadata: {
          description,
          engine,
          version,
          classification: {
            detectedType: "database",
            reason: "manual-entry",
            source: "user",
          },
        },
      };
    }
    case "infrastructure": {
      const scope =
        typeof values.scope === "string" && values.scope.trim().length > 0
          ? values.scope.trim()
          : "infrastructure";
      const category =
        typeof values.category === "string" && values.category.trim().length > 0
          ? values.category.trim()
          : undefined;
      const environmentDomain =
        typeof values.environmentDomain === "string" ? values.environmentDomain.trim() : undefined;
      const environmentReleaseGate =
        typeof values.environmentReleaseGate === "string"
          ? values.environmentReleaseGate.trim()
          : undefined;
      const environmentChangeManagement =
        typeof values.environmentChangeManagement === "string"
          ? values.environmentChangeManagement.trim()
          : undefined;
      const environmentSecrets = hasOwn(values, "environmentSecrets")
        ? coerceStringArray(values.environmentSecrets)
        : undefined;
      const loggingLevel =
        typeof values.observabilityLoggingLevel === "string"
          ? values.observabilityLoggingLevel.trim()
          : undefined;
      const metricsProvider =
        typeof values.observabilityMetricsProvider === "string"
          ? values.observabilityMetricsProvider.trim()
          : undefined;
      const observabilityAlerts = hasOwn(values, "observabilityAlerts")
        ? coerceStringArray(values.observabilityAlerts)
        : undefined;
      const migrationTool =
        typeof values.migrationTool === "string" ? values.migrationTool.trim() : undefined;
      const migrationStrategy =
        typeof values.migrationStrategy === "string" ? values.migrationStrategy.trim() : undefined;
      const migrationSchedule =
        typeof values.migrationSchedule === "string" ? values.migrationSchedule.trim() : undefined;

      return {
        name,
        description,
        artifactType: "infrastructure",
        metadata: {
          description,
          scope,
          ...(category ? { category } : {}),
          ...(environmentDomain ||
          environmentReleaseGate ||
          environmentChangeManagement ||
          environmentSecrets
            ? {
                environment: {
                  ...(environmentDomain ? { domain: environmentDomain } : {}),
                  ...(environmentReleaseGate ? { releaseGate: environmentReleaseGate } : {}),
                  ...(environmentChangeManagement
                    ? { changeManagement: environmentChangeManagement }
                    : {}),
                  ...(environmentSecrets
                    ? { secrets: environmentSecrets }
                    : environmentSecrets === undefined && hasOwn(values, "environmentSecrets")
                      ? { secrets: [] }
                      : {}),
                },
              }
            : {}),
          ...(loggingLevel ||
          metricsProvider ||
          observabilityAlerts ||
          migrationTool ||
          migrationStrategy ||
          migrationSchedule
            ? {
                config: {
                  ...(loggingLevel
                    ? {
                        logging: {
                          level: loggingLevel,
                        },
                      }
                    : {}),
                  ...(metricsProvider || observabilityAlerts
                    ? {
                        monitoring: {
                          ...(metricsProvider ? { metricsProvider } : {}),
                          ...(observabilityAlerts
                            ? { alerts: observabilityAlerts }
                            : observabilityAlerts === undefined &&
                                hasOwn(values, "observabilityAlerts")
                              ? { alerts: [] }
                              : {}),
                        },
                      }
                    : {}),
                  ...(migrationTool || migrationStrategy || migrationSchedule
                    ? {
                        tool: migrationTool,
                        strategy: migrationStrategy,
                        schedule: migrationSchedule,
                      }
                    : {}),
                },
              }
            : {}),
          classification: {
            detectedType: "infrastructure",
            reason: "manual-entry",
            source: "user",
          },
        },
      };
    }

    case "route": {
      const pathValue = typeof values.path === "string" ? values.path.trim() : "/";
      const inferredMethod =
        typeof values.method === "string" && values.method.trim().length > 0
          ? values.method.trim().toUpperCase()
          : undefined;
      const methods = coerceStringArray(values.methods).map((method) => method.toUpperCase());
      if (inferredMethod && !methods.includes(inferredMethod)) {
        methods.push(inferredMethod);
      }
      const normalizedMethods = methods.length > 0 ? methods : ["GET"];

      const rawOperations = values.operations;
      let operations: Record<string, unknown> | undefined;
      if (rawOperations && typeof rawOperations === "object") {
        operations = rawOperations as Record<string, unknown>;
      } else if (inferredMethod) {
        const methodKey = inferredMethod.toLowerCase();
        const tags = coerceStringArray(values.tags);
        operations = {
          [methodKey]: {
            summary: typeof values.summary === "string" ? values.summary.trim() : undefined,
            description:
              typeof values.description === "string" ? values.description.trim() : undefined,
            tags: tags.length > 0 ? tags : undefined,
            responses: values.responses,
            requestBody: values.requestBody,
          },
        } as Record<string, unknown>;
      }

      return {
        name,
        description,
        artifactType: "route",
        metadata: {
          description,
          path: pathValue || "/",
          methods: normalizedMethods,
          ...(operations ? { operations } : {}),
          classification: {
            detectedType: "route",
            reason: "manual-entry",
            source: "user",
          },
        },
      };
    }
    case "view": {
      const pathValue = typeof values.path === "string" ? values.path.trim() : undefined;
      const componentName =
        typeof values.component === "string" && values.component.trim().length > 0
          ? values.component.trim()
          : undefined;
      const filePathValue =
        typeof values.filePath === "string" && values.filePath.trim().length > 0
          ? values.filePath.trim()
          : undefined;
      const routerTypeValue =
        typeof values.routerType === "string" && values.routerType.trim().length > 0
          ? values.routerType.trim()
          : undefined;
      const clientId =
        typeof values.clientId === "string" && values.clientId.trim().length > 0
          ? values.clientId.trim()
          : undefined;
      const clientIdentifier =
        typeof values.clientIdentifier === "string" && values.clientIdentifier.trim().length > 0
          ? values.clientIdentifier.trim()
          : clientId;
      const clientSlug =
        typeof values.clientSlug === "string" && values.clientSlug.trim().length > 0
          ? values.clientSlug.trim()
          : undefined;
      const clientName =
        typeof values.clientName === "string" && values.clientName.trim().length > 0
          ? values.clientName.trim()
          : undefined;

      const metadata: Record<string, unknown> = {
        description,
        path: pathValue,
        classification: {
          detectedType: "view",
          reason: "manual-entry",
          source: "user",
        },
      };

      if (componentName) {
        metadata.component = componentName;
      }
      if (filePathValue) {
        metadata.filePath = filePathValue;
        metadata.sourceFile = filePathValue;
      }
      if (routerTypeValue) {
        metadata.routerType = routerTypeValue;
      }
      if (clientId || clientIdentifier || clientSlug || clientName) {
        if (clientId) {
          metadata.clientId = clientId;
        }
        if (clientIdentifier) {
          metadata.clientIdentifier = clientIdentifier;
        }
        if (clientSlug) {
          metadata.clientSlug = clientSlug;
        }
        if (clientName) {
          metadata.clientName = clientName;
        }
        metadata.client = {
          ...(clientId ? { id: clientId } : {}),
          ...(clientIdentifier ? { identifier: clientIdentifier } : {}),
          ...(clientSlug ? { slug: clientSlug } : {}),
          ...(clientName ? { name: clientName } : {}),
        };
      }

      return {
        name,
        description,
        artifactType: "view",
        metadata,
      };
    }
    case "flow": {
      return {
        name,
        description,
        artifactType: "flow",
        metadata: {
          description,
          classification: {
            detectedType: "flow",
            reason: "manual-entry",
            source: "user",
          },
        },
      };
    }
    case "capability": {
      const owner =
        typeof values.owner === "string" && values.owner.trim().length > 0
          ? values.owner.trim()
          : undefined;
      const gherkinSpec =
        typeof values.gherkin === "string" && values.gherkin.trim().length > 0
          ? values.gherkin.trim()
          : undefined;
      return {
        name,
        description,
        artifactType: "capability",
        metadata: {
          description,
          ...(owner ? { owner } : {}),
          ...(gherkinSpec ? { gherkinSpec } : {}),
          classification: {
            detectedType: "capability",
            reason: "manual-entry",
            source: "user",
          },
        },
      };
    }
    case "epic": {
      const tasks = coerceStringArray(values.tasks);
      const status =
        typeof values.status === "string" && values.status.trim().length > 0
          ? values.status.trim()
          : undefined;
      const priority =
        typeof values.priority === "string" && values.priority.trim().length > 0
          ? values.priority.trim()
          : undefined;
      const owner =
        typeof values.owner === "string" && values.owner.trim().length > 0
          ? values.owner.trim()
          : undefined;
      return {
        name,
        description,
        artifactType: "epic",
        metadata: {
          description,
          id: slug,
          slug,
          tasks: tasks.length > 0 ? tasks : undefined,
          ...(status ? { status } : {}),
          ...(priority ? { priority } : {}),
          ...(owner ? { owner } : {}),
          classification: {
            detectedType: "epic",
            reason: "manual-entry",
            source: "user",
          },
        },
      };
    }
    case "task": {
      const status =
        typeof values.status === "string" && values.status.trim().length > 0
          ? values.status.trim()
          : undefined;
      const assignee =
        typeof values.assignee === "string" && values.assignee.trim().length > 0
          ? values.assignee.trim()
          : undefined;
      const owner =
        typeof values.owner === "string" && values.owner.trim().length > 0
          ? values.owner.trim()
          : undefined;
      const priority =
        typeof values.priority === "string" && values.priority.trim().length > 0
          ? values.priority.trim()
          : undefined;
      const epicId =
        typeof values.epicId === "string" && values.epicId.trim().length > 0
          ? values.epicId.trim()
          : undefined;
      const epicName =
        typeof values.epicName === "string" && values.epicName.trim().length > 0
          ? values.epicName.trim()
          : undefined;
      const epicRef =
        typeof values.epic === "string" && values.epic.trim().length > 0
          ? values.epic.trim()
          : undefined;

      const dependencyValues = [
        values.dependsOn,
        values.depends_on,
        values.dependencies,
        values.blockedBy,
        values.blocked_by,
      ];
      const dependsOn = Array.from(
        new Set(
          dependencyValues
            .flatMap((entry) => coerceStringArray(entry))
            .filter((item) => item.length > 0),
        ),
      );

      const completedFlag = (() => {
        if (values.completed === true || values.done === true) {
          return true;
        }
        if (typeof values.completed === "string") {
          const normalized = values.completed.trim().toLowerCase();
          if (["true", "yes", "y", "1", "done", "completed"].includes(normalized)) {
            return true;
          }
        }
        if (typeof values.status === "string") {
          const normalizedStatus = values.status.trim().toLowerCase();
          if (["done", "completed", "complete", "closed", "resolved"].includes(normalizedStatus)) {
            return true;
          }
        }
        return undefined;
      })();

      return {
        name,
        description,
        artifactType: "task",
        metadata: {
          description,
          id: slug,
          slug,
          status,
          ...(assignee ? { assignee } : {}),
          ...(owner ? { owner } : {}),
          ...(priority ? { priority } : {}),
          ...(dependsOn.length ? { dependsOn } : {}),
          ...(epicId ? { epicId } : {}),
          ...(epicName ? { epicName } : {}),
          ...(epicRef ? { epic: epicRef } : {}),
          ...(completedFlag !== undefined ? { completed: completedFlag } : {}),
          classification: {
            detectedType: "task",
            reason: "manual-entry",
            source: "user",
          },
        },
      };
    }
    default:
      return null;
  }
}

function normalizeMetadata(
  metadata?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!metadata) return undefined;
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (value === undefined) continue;
    cleaned[key] = value;
  }
  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
}

export function createProjectsRouter(deps: Dependencies) {
  const router = new Hono();
  const db = deps.db as SpecWorkbenchDB | undefined;
  const controller = db ? new ProjectsController(deps) : null;

  // GET single project with full resolved spec and artifacts
  router.get("/projects/:id", async (c) => {
    const projectId = c.req.param("id");

    if (!projectId) {
      return c.json({ error: "Project ID is required" }, 400);
    }

    try {
      if (!controller) {
        return c.json({ error: "Database unavailable" }, 503);
      }

      const data = await controller.getProjectWithArtifacts(projectId);
      const {
        project,
        artifacts,
        services,
        databases,
        components,
        routes,
        infrastructureCount,
        externalCount,
      } = data;

      const frontendViewSet = new Set<string>();
      artifacts
        .filter((artifact: any) => artifact.metadata?.frontendAnalysis)
        .forEach((artifact: any) => {
          const analysis = artifact.metadata?.frontendAnalysis;
          if (!analysis) return;
          (analysis.routers || []).forEach((router: any) => {
            (router.routes || []).forEach((route: any) => {
              const rawPath = String(route.path || "").trim();
              if (!rawPath) return;
              const normalized = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
              frontendViewSet.add(normalized.replace(/\/+/g, "/"));
            });
          });
        });

      const flows =
        Object.keys(services).length > 0
          ? [{ id: "main-flow", name: "Main Application Flow" }]
          : [];

      const capabilities =
        Object.keys(services).length > 0 ? [{ id: "api-capability", name: "API Services" }] : [];

      const { epics, tasks } = buildEpicTaskSpec(artifacts);

      const specBlock = {
        services,
        databases,
        components,
        frontend: {
          packages: [] as any[],
        },
        ui: {
          routes,
        },
        flows,
        capabilities,
        epics,
        tasks,
      };

      const resolvedSpec = {
        version: "1.0",
        services,
        databases,
        components,
        routes,
        flows,
        capabilities,
        epics,
        tasks,
        spec: specBlock,
        // Include raw artifacts for detailed rendering
        artifacts,
        project: {
          id: project.id,
          name: project.name,
          entities: {
            services: Object.keys(services).length,
            databases: Object.keys(databases).length,
            packages: Object.keys(components).filter((k) => {
              const componentType = components[k].type;
              return componentType === "package";
            }).length,
            tools: Object.keys(components).filter(
              (k) => components[k].type === "tool" || components[k].type === "binary",
            ).length,
            frontends: Object.keys(components).filter((k) => components[k].type === "frontend")
              .length,
            infrastructure: infrastructureCount,
            external: externalCount,
            views: frontendViewSet.size,
            routes: routes.length,
            flows: Object.keys(services).length > 0 ? 1 : 0,
            capabilities: Object.keys(services).length > 0 ? 1 : 0,
          },
        },
      };

      return c.json({ resolved: resolvedSpec });
    } catch (error) {
      console.error("Error fetching project details:", error);
      return c.json({ error: "Failed to fetch project details" }, 500);
    }
  });

  router.put("/projects/:projectId/entities/:artifactId", async (c) => {
    const projectId = c.req.param("projectId");
    const artifactId = c.req.param("artifactId");

    if (!artifactId) {
      return c.json({ success: false, error: "Artifact ID is required" }, 400);
    }

    const db = deps.db as any;
    if (!db || typeof db.getArtifact !== "function" || typeof db.updateArtifact !== "function") {
      return c.json({ success: false, error: "Database unavailable" }, 500);
    }

    let body: any;
    try {
      body = await c.req.json();
    } catch (error) {
      return c.json({ success: false, error: "Invalid JSON payload" }, 400);
    }

    const type = typeof body?.type === "string" ? body.type.toLowerCase() : "";
    const values = body?.values as Record<string, any> | undefined;

    if (!type || !values || typeof values !== "object") {
      return c.json(
        {
          success: false,
          error: 'Payload must include "type" and "values" fields',
        },
        400,
      );
    }

    const supportedTypes = new Set([
      "frontend",
      "service",
      "package",
      "tool",
      "database",
      "infrastructure",
      "route",
      "view",
      "flow",
      "capability",
      "epic",
      "task",
    ]);
    if (!supportedTypes.has(type)) {
      return c.json(
        {
          success: false,
          error: `Unsupported entity type: ${type}`,
        },
        400,
      );
    }

    const existingArtifact = await db.getArtifact(projectId, artifactId);
    if (!existingArtifact) {
      return c.json({ success: false, error: "Artifact not found" }, 404);
    }

    const existingMetadata =
      existingArtifact.metadata && typeof existingArtifact.metadata === "object"
        ? ({ ...existingArtifact.metadata } as Record<string, unknown>)
        : {};

    const slugFallbackCandidates = [
      typeof values?.slug === "string" ? values.slug : "",
      typeof values?.id === "string" ? values.id : "",
      typeof existingMetadata?.slug === "string" ? (existingMetadata.slug as string) : "",
      typeof existingMetadata?.id === "string" ? (existingMetadata.id as string) : "",
      existingArtifact.name,
    ]
      .map((candidate) => (typeof candidate === "string" ? candidate.trim() : ""))
      .filter((candidate) => candidate.length > 0);

    const slugFallback = slugFallbackCandidates[0] ?? `${type}-${Date.now()}`;
    const slug = slugify(values?.name, slugFallback);

    const payload = buildManualArtifactPayload(type, values, slug);
    if (!payload) {
      return c.json(
        {
          success: false,
          error: `Unable to construct artifact payload for type: ${type}`,
        },
        400,
      );
    }

    if (existingArtifact.type !== payload.artifactType) {
      return c.json(
        {
          success: false,
          error: `Artifact type mismatch: existing ${existingArtifact.type}, received ${payload.artifactType}`,
        },
        400,
      );
    }

    const nextMetadataInput = normalizeMetadata(payload.metadata);
    const mergedMetadata: Record<string, unknown> | undefined =
      nextMetadataInput || Object.keys(existingMetadata).length > 0
        ? {
            ...existingMetadata,
            ...(nextMetadataInput ?? {}),
          }
        : undefined;

    const epicKeysProvided =
      typeof values.epicId === "string" ||
      typeof values.epic === "string" ||
      typeof values.epicName === "string";

    if (mergedMetadata) {
      if (!epicKeysProvided) {
        delete mergedMetadata.epicId;
        delete mergedMetadata.epic;
        delete mergedMetadata.epicName;
      }
      delete mergedMetadata.artifactId;
      delete mergedMetadata.artifact_id;
      delete mergedMetadata.entityId;
      delete mergedMetadata.entity_id;
    }

    if (
      mergedMetadata &&
      nextMetadataInput &&
      Object.prototype.hasOwnProperty.call(nextMetadataInput, "environment")
    ) {
      const envValue = nextMetadataInput.environment;
      if (
        !envValue ||
        (typeof envValue === "object" &&
          Object.keys(envValue as Record<string, unknown>).length === 0)
      ) {
        delete mergedMetadata.environment;
      } else {
        mergedMetadata.environment = envValue as Record<string, unknown>;
      }
    }

    const sanitizedMetadata = mergedMetadata ? normalizeMetadata(mergedMetadata) : undefined;

    try {
      const updatedArtifact = await db.updateArtifact(projectId, artifactId, {
        name: payload.name,
        description: payload.description ?? null,
        type: payload.artifactType,
        language: payload.language ?? existingArtifact.language ?? null,
        framework: payload.framework ?? existingArtifact.framework ?? null,
        metadata: sanitizedMetadata,
        filePath:
          payload.filePath ?? existingArtifact.file_path ?? existingArtifact.filePath ?? null,
        confidence: existingArtifact.confidence ?? 0.95,
      });

      const eventPayload = {
        action: "entity_updated",
        source: "manual",
        entity_type: type,
        artifact_type: payload.artifactType,
        artifact_id: artifactId,
        entity_id: artifactId,
        name: payload.name,
        description: payload.description,
        values,
        metadata: sanitizedMetadata,
      };

      const eventsService = deps.events as EventService | undefined;
      if (eventsService?.broadcastToProject) {
        await eventsService.broadcastToProject(projectId, {
          project_id: projectId,
          event_type: "entity_updated",
          data: eventPayload,
        });
      } else if (typeof db.createEvent === "function") {
        await db.createEvent(randomUUID(), projectId, "entity_updated", eventPayload);
      }

      return c.json({ success: true, artifact: updatedArtifact });
    } catch (error) {
      console.error("Failed to update manual artifact", error);
      return c.json(
        {
          success: false,
          error: "Failed to update entity",
        },
        500,
      );
    }
  });

  // Projects endpoint - using real database with entity counts
  router.get("/projects", async (c) => {
    console.log(
      "🔄 GET /api/projects - Request received from:",
      c.req.header("origin") || "unknown",
    );
    try {
      const db = deps.db as any;
      const projects = await db.listProjects();
      console.log("📊 GET /api/projects - Raw projects from DB:", projects.length, "projects");

      // Transform database projects and calculate entity counts from specs
      const formattedProjects = await Promise.all(
        projects.map(async (project: any) => {
          let entities: ProjectEntities = {
            services: 0,
            databases: 0,
            packages: 0,
            tools: 0,
            frontends: 0,
            views: 0,
            infrastructure: 0,
            external: 0,
            // CUE spec entities
            routes: 0,
            flows: 0,
            capabilities: 0,
          };

          try {
            // Get real artifacts from database for entity calculation
            const artifacts = await db.getArtifacts(project.id);

            // Build services from real artifacts
            const services: Record<string, any> = {};
            const serviceArtifacts = artifacts.filter((a: any) => a.type === "service");
            const routeSet = new Set<string>();

            const toSlug = (value: string) =>
              String(value || "")
                .replace(/[^a-z0-9]+/gi, "-")
                .replace(/^-+|-+$/g, "")
                .toLowerCase();

            for (const artifact of serviceArtifacts) {
              const serviceName = artifact.name.replace(/_/g, "-");
              services[serviceName] = {
                name: artifact.name,
                type: "service",
                metadata: { detected: true },
              };

              const analysis = artifact.metadata?.tsoaAnalysis;
              if (analysis) {
                const rawServiceName = artifact.name.replace(/^@[^/]+\//, "") || artifact.name;
                const slugRoot = toSlug(artifact.name) || "service";
                const serviceSlug = toSlug(rawServiceName) || slugRoot;
                const baseRoutePath = `/${serviceSlug}`.replace(/\/+/g, "/");
                if (baseRoutePath) {
                  routeSet.add(baseRoutePath);
                }

                const controllerCandidates = Array.isArray(analysis.controllerCandidates)
                  ? analysis.controllerCandidates
                  : [];

                controllerCandidates.forEach((candidate: string) => {
                  const normalized = candidate.split("\\").join("/");
                  const fileName = normalized.split("/").pop() || normalized;
                  const baseSegment = toSlug(
                    fileName
                      .replace(/\.[tj]sx?$/i, "")
                      .replace(/controller$/i, "")
                      .replace(/route$/i, ""),
                  );
                  const routePath = baseSegment
                    ? `${baseRoutePath}/${baseSegment}`.replace(/\/+/g, "/")
                    : baseRoutePath;
                  routeSet.add(routePath);
                });
              }
            }

            // Build databases from real artifacts
            const databases: Record<string, any> = {};
            const databaseArtifacts = artifacts.filter((a: any) => a.type === "database");

            for (const artifact of databaseArtifacts) {
              const dbName = artifact.name.replace(/_/g, "-");

              // Determine database type from artifact
              const getDatabaseType = (framework?: string, name?: string) => {
                if (framework) return framework.toLowerCase();
                if (name?.includes("postgres") || name?.includes("pg")) return "postgresql";
                if (name?.includes("mysql") || name?.includes("maria")) return "mysql";
                if (name?.includes("mongo")) return "mongodb";
                if (name?.includes("redis")) return "redis";
                if (name?.includes("sqlite")) return "sqlite";
                return "unknown";
              };

              databases[dbName] = {
                name: artifact.name,
                type: getDatabaseType(artifact.framework, artifact.name),
                metadata: {
                  detected: true,
                  language: artifact.language || "sql",
                  framework: artifact.framework || "unknown",
                },
              };
            }

            // Count other artifact types properly
            const otherArtifacts = artifacts.filter(
              (a: any) => !["service", "database"].includes(a.type),
            );

            // Group artifacts by type for debugging
            const typeGroups: Record<string, number> = {};
            const infraArtifacts: string[] = [];
            for (const artifact of otherArtifacts) {
              const type = artifact.type;
              typeGroups[type] = (typeGroups[type] || 0) + 1;
              if (type === "infrastructure") {
                infraArtifacts.push(artifact.name);
              }
            }
            console.log(`[DEBUG] Artifact types for project ${project.name}:`, typeGroups);
            console.log(`[DEBUG] Infrastructure artifacts:`, infraArtifacts);

            let packageCount = 0;
            let toolCount = 0;
            let frontendCount = 0;
            let infrastructureCount = 0;
            let externalCount = 0;
            let viewCount = 0;
            let flowCount = 0;
            let capabilityCount = 0;

            for (const artifact of otherArtifacts) {
              // Normalize types
              let type = artifact.type;
              if (type === "binary") type = "tool";

              switch (type) {
                case "package":
                  packageCount++;
                  break;
                case "tool":
                  toolCount++;
                  break;
                case "frontend":
                  frontendCount++;
                  break;
                case "infrastructure":
                  infrastructureCount++;
                  break;
                case "route":
                  {
                    const pathValue = String(
                      artifact.metadata?.path || artifact.name || "/",
                    ).trim();
                    const normalizedPath = pathValue.startsWith("/") ? pathValue : `/${pathValue}`;
                    routeSet.add(normalizedPath.replace(/\/+/g, "/"));
                    const methods = Array.isArray(artifact.metadata?.methods)
                      ? artifact.metadata.methods
                      : coerceStringArray(artifact.metadata?.methods);
                    if (methods.length > 0) {
                      flowCount += 1;
                    }
                  }
                  break;
                case "view":
                  viewCount++;
                  break;
                case "flow":
                  flowCount++;
                  break;
                case "capability":
                  capabilityCount++;
                  break;
                default:
                  {
                    const detectedType = String(
                      artifact.metadata?.detectedType || artifact.metadata?.type || "",
                    ).toLowerCase();
                    switch (detectedType) {
                      case "tool":
                      case "build_tool":
                        toolCount++;
                        break;
                      case "frontend":
                        frontendCount++;
                        break;
                      case "infrastructure":
                        infrastructureCount++;
                        break;
                      case "route":
                        {
                          const pathValue = String(
                            artifact.metadata?.path || artifact.name || "/",
                          ).trim();
                          const normalizedPath = pathValue.startsWith("/")
                            ? pathValue
                            : `/${pathValue}`;
                          routeSet.add(normalizedPath.replace(/\/+/g, "/"));
                          const methods = Array.isArray(artifact.metadata?.methods)
                            ? artifact.metadata.methods
                            : coerceStringArray(artifact.metadata?.methods);
                          if (methods.length > 0) {
                            flowCount += 1;
                          }
                        }
                        break;
                      case "view":
                        viewCount++;
                        break;
                      case "flow":
                        flowCount++;
                        break;
                      case "capability":
                        capabilityCount++;
                        break;
                      default:
                        externalCount++;
                        break;
                    }
                  }
                  break;
              }
            }

            // Include frontend-detected routes
            const frontendRouteSet = new Set<string>();
            const frontendRoutes: string[] = artifacts
              .filter((artifact: any) => artifact.metadata?.frontendAnalysis)
              .flatMap((artifact: any) => {
                const analysis = artifact.metadata?.frontendAnalysis;
                if (!analysis) return [] as string[];
                const packageRoutes = (analysis.routers || []).flatMap((router: any) =>
                  (router.routes || []).map((route: any) => String(route.path || "")),
                );
                return packageRoutes;
              });

            frontendRoutes
              .map((path: string) => String(path || "").trim())
              .filter(Boolean)
              .forEach((path: string) => {
                const normalized = path.startsWith("/") ? path : `/${path}`;
                const cleaned = normalized.replace(/\/+/g, "/");
                routeSet.add(cleaned);
                frontendRouteSet.add(cleaned);
              });

            const routes = Array.from(routeSet);
            const frontendViews = Array.from(frontendRouteSet);

            const totalViews = viewCount + frontendViews.length;
            const totalFlows = Math.max(flowCount, routes.length > 0 ? 1 : 0);
            const totalCapabilities = Math.max(capabilityCount, routes.length > 0 ? 1 : 0);

            // Calculate entity counts
            entities = {
              services: Object.keys(services).length,
              databases: Object.keys(databases).length,
              packages: packageCount,
              tools: toolCount,
              frontends: frontendCount,
              infrastructure: infrastructureCount,
              external: externalCount,
              views: totalViews,
              routes: routes.length,
              flows: totalFlows,
              capabilities: totalCapabilities,
            } as ProjectEntities;
          } catch (error) {
            console.warn(`Failed to calculate entities for project ${project.id}:`, error);
            // Fall back to basic database counts
            entities = {
              services: project.service_count || 0,
              databases: project.database_count || 0,
              packages: 0,
              tools: 0,
              frontends: 0,
              infrastructure: 0,
              external: 0,
              views: 0,
              routes: 0,
              flows: 0,
              capabilities: 0,
            } as ProjectEntities;
          }

          return {
            id: project.id,
            name: project.name,
            status: "active",
            entities,
            lastActivity: project.updated_at,
          };
        }),
      );

      return c.json({ projects: formattedProjects });
    } catch (error) {
      console.error("Error fetching projects:", error);
      return c.json({ projects: [] });
    }
  });

  // Create project endpoint
  router.post("/projects/:projectId/entities", async (c) => {
    const projectId = c.req.param("projectId");
    const db = deps.db as any;
    if (!db || typeof db.createArtifact !== "function") {
      return c.json({ success: false, error: "Database unavailable" }, 500);
    }

    let body: any;
    try {
      body = await c.req.json();
    } catch (error) {
      return c.json({ success: false, error: "Invalid JSON payload" }, 400);
    }

    const type = typeof body?.type === "string" ? body.type.toLowerCase() : "";
    const values = body?.values as Record<string, any> | undefined;

    if (!type || !values || typeof values !== "object") {
      return c.json(
        {
          success: false,
          error: 'Payload must include "type" and "values" fields',
        },
        400,
      );
    }

    const supportedTypes = new Set([
      "frontend",
      "service",
      "package",
      "tool",
      "database",
      "infrastructure",
      "route",
      "view",
      "flow",
      "capability",
      "epic",
      "task",
    ]);
    if (!supportedTypes.has(type)) {
      return c.json(
        {
          success: false,
          error: `Unsupported entity type: ${type}`,
        },
        400,
      );
    }

    const slug = slugify(values.name, `${type}-${Date.now()}`);
    const payload = buildManualArtifactPayload(type, values, slug);
    if (!payload) {
      return c.json(
        {
          success: false,
          error: `Unable to construct artifact payload for type: ${type}`,
        },
        400,
      );
    }

    try {
      const artifactId = randomUUID();
      const metadata = normalizeMetadata(payload.metadata);
      if (
        metadata &&
        Object.prototype.hasOwnProperty.call(metadata, "environment") &&
        metadata.environment === null
      ) {
        delete metadata.environment;
      }
      const artifact = await db.createArtifact(
        artifactId,
        projectId,
        payload.name,
        payload.description,
        payload.artifactType,
        payload.language,
        payload.framework,
        metadata,
        payload.filePath,
        0.95,
      );

      const eventPayload = {
        action: "entity_created",
        source: "manual",
        entity_type: type,
        artifact_type: payload.artifactType,
        artifact_id: artifactId,
        entity_id: artifactId,
        name: payload.name,
        description: payload.description,
        values,
        metadata,
      };

      const eventsService = deps.events as EventService | undefined;
      if (eventsService?.broadcastToProject) {
        await eventsService.broadcastToProject(projectId, {
          project_id: projectId,
          event_type: "entity_created",
          data: eventPayload,
        });
      } else if (typeof db.createEvent === "function") {
        await db.createEvent(randomUUID(), projectId, "entity_created", eventPayload);
      }

      return c.json({ success: true, artifact });
    } catch (error) {
      console.error("Failed to create manual artifact", error);
      return c.json(
        {
          success: false,
          error: "Failed to create entity",
        },
        500,
      );
    }
  });

  router.delete("/projects/:projectId/entities/:artifactId", async (c) => {
    const projectId = c.req.param("projectId");
    const artifactId = c.req.param("artifactId");

    if (!projectId) {
      return c.json({ success: false, error: "Project ID is required" }, 400);
    }

    if (!artifactId) {
      return c.json({ success: false, error: "Artifact ID is required" }, 400);
    }

    const db = deps.db as any;
    if (!db || typeof db.deleteArtifact !== "function" || typeof db.getArtifact !== "function") {
      return c.json({ success: false, error: "Database unavailable" }, 500);
    }

    try {
      const existingArtifact = await db.getArtifact(projectId, artifactId);
      if (!existingArtifact) {
        return c.json({ success: false, error: "Artifact not found" }, 404);
      }

      const deleted = await db.deleteArtifact(projectId, artifactId);
      if (!deleted) {
        return c.json({ success: false, error: "Artifact not found" }, 404);
      }

      const eventsService = deps.events as EventService | undefined;
      const entityType =
        existingArtifact.metadata?.classification?.detectedType ||
        existingArtifact.metadata?.detectedType ||
        existingArtifact.type;

      const snapshot: Record<string, unknown> = {
        id: existingArtifact.id,
        project_id: existingArtifact.project_id,
        name: existingArtifact.name,
        description: existingArtifact.description,
        type: existingArtifact.type,
        language: existingArtifact.language,
        framework: existingArtifact.framework,
        metadata: existingArtifact.metadata ?? {},
        file_path: existingArtifact.file_path ?? existingArtifact.filePath ?? null,
        confidence: existingArtifact.confidence ?? 0.95,
        created_at: existingArtifact.created_at ?? null,
        updated_at: existingArtifact.updated_at ?? null,
      };

      const eventPayload = {
        action: "entity_deleted",
        source: "manual",
        entity_type: entityType,
        artifact_type: existingArtifact.type,
        artifact_id: artifactId,
        entity_id: artifactId,
        name: existingArtifact.name,
        description: existingArtifact.description,
        metadata: existingArtifact.metadata ?? {},
        values: existingArtifact.metadata?.values ?? undefined,
        snapshot,
        deleted_at: new Date().toISOString(),
      };

      if (eventsService?.broadcastToProject) {
        await eventsService.broadcastToProject(projectId, {
          project_id: projectId,
          event_type: "entity_deleted",
          data: eventPayload,
        });
      } else if (typeof db.createEvent === "function") {
        await db.createEvent(randomUUID(), projectId, "entity_deleted", eventPayload);
      }

      return c.json({ success: true, artifactId });
    } catch (error) {
      console.error("Failed to delete artifact", error);
      return c.json({ success: false, error: "Failed to delete entity" }, 500);
    }
  });

  router.post("/projects/:projectId/entities/:artifactId/restore", async (c) => {
    const projectId = c.req.param("projectId");
    const artifactId = c.req.param("artifactId");

    if (!projectId) {
      return c.json({ success: false, error: "Project ID is required" }, 400);
    }

    if (!artifactId) {
      return c.json({ success: false, error: "Artifact ID is required" }, 400);
    }

    const db = deps.db as any;
    if (!db || typeof db.createArtifact !== "function" || typeof db.getArtifact !== "function") {
      return c.json({ success: false, error: "Database unavailable" }, 500);
    }

    let body: any;
    try {
      body = await c.req.json();
    } catch (error) {
      return c.json({ success: false, error: "Invalid JSON payload" }, 400);
    }

    const snapshot = body?.snapshot;
    if (!snapshot || typeof snapshot !== "object") {
      return c.json({ success: false, error: "Payload must include a snapshot object" }, 400);
    }

    const sourceEventId = typeof body?.eventId === "string" ? body.eventId : undefined;

    try {
      const existingArtifact = await db.getArtifact(projectId, artifactId);
      if (existingArtifact) {
        return c.json({ success: false, error: "Artifact already exists" }, 409);
      }

      const normalizedSnapshot = snapshot as Record<string, unknown>;
      const snapshotMetadataValue =
        normalizedSnapshot["metadata"] && typeof normalizedSnapshot["metadata"] === "object"
          ? (normalizedSnapshot["metadata"] as Record<string, unknown>)
          : undefined;
      const rawName = normalizedSnapshot["name"];
      const displayLabelValue =
        snapshotMetadataValue && typeof snapshotMetadataValue["displayLabel"] === "string"
          ? (snapshotMetadataValue["displayLabel"] as string)
          : undefined;
      const name =
        typeof rawName === "string" && rawName.trim()
          ? rawName.trim()
          : (displayLabelValue ?? "Restored artifact");
      const rawDescription = normalizedSnapshot["description"];
      const description = typeof rawDescription === "string" ? rawDescription : null;
      const rawType = normalizedSnapshot["type"];
      const artifactType =
        typeof rawType === "string"
          ? rawType
          : typeof normalizedSnapshot["artifact_type"] === "string"
            ? (normalizedSnapshot["artifact_type"] as string)
            : "component";
      const languageValue =
        typeof normalizedSnapshot["language"] === "string"
          ? (normalizedSnapshot["language"] as string)
          : snapshotMetadataValue && typeof snapshotMetadataValue["language"] === "string"
            ? (snapshotMetadataValue["language"] as string)
            : undefined;
      const frameworkValue =
        typeof normalizedSnapshot["framework"] === "string"
          ? (normalizedSnapshot["framework"] as string)
          : snapshotMetadataValue && typeof snapshotMetadataValue["framework"] === "string"
            ? (snapshotMetadataValue["framework"] as string)
            : undefined;
      const metadata = normalizeMetadata(snapshotMetadataValue);
      const values =
        snapshotMetadataValue && "values" in snapshotMetadataValue
          ? snapshotMetadataValue["values"]
          : undefined;
      const filePathCandidate =
        typeof normalizedSnapshot["file_path"] === "string"
          ? (normalizedSnapshot["file_path"] as string)
          : typeof normalizedSnapshot["filePath"] === "string"
            ? (normalizedSnapshot["filePath"] as string)
            : undefined;
      const confidence =
        typeof normalizedSnapshot["confidence"] === "number"
          ? (normalizedSnapshot["confidence"] as number)
          : 0.95;
      const language = languageValue;
      const framework = frameworkValue;

      const artifact = await db.createArtifact(
        artifactId,
        projectId,
        name,
        description,
        artifactType,
        language,
        framework,
        metadata,
        filePathCandidate ?? null,
        confidence,
      );

      const eventsService = deps.events as EventService | undefined;
      const classification = (() => {
        if (!metadata) return undefined;
        const value = metadata["classification"];
        return value && typeof value === "object" ? (value as Record<string, unknown>) : undefined;
      })();
      const classificationDetected =
        classification && typeof classification["detectedType"] === "string"
          ? (classification["detectedType"] as string)
          : undefined;
      const metadataDetected = (() => {
        if (!metadata) return undefined;
        const candidate = metadata["detectedType"];
        return typeof candidate === "string" ? (candidate as string) : undefined;
      })();
      const entityType = classificationDetected ?? metadataDetected ?? artifactType;

      const eventPayload = {
        action: "entity_restored",
        source: "manual",
        entity_type: entityType,
        artifact_type: artifactType,
        artifact_id: artifactId,
        entity_id: artifactId,
        name,
        description,
        metadata,
        values,
        snapshot: normalizedSnapshot,
        restored_from_event_id: sourceEventId,
        restored_at: new Date().toISOString(),
      };

      if (eventsService?.broadcastToProject) {
        await eventsService.broadcastToProject(projectId, {
          project_id: projectId,
          event_type: "entity_restored",
          data: eventPayload,
        });
      } else if (typeof db.createEvent === "function") {
        await db.createEvent(randomUUID(), projectId, "entity_restored", eventPayload);
      }

      return c.json({ success: true, artifact });
    } catch (error) {
      console.error("Failed to restore artifact", error);
      return c.json({ success: false, error: "Failed to restore entity" }, 500);
    }
  });
  router.post("/projects", zValidator("json", createProjectSchema), async (c) => {
    try {
      if (!controller) {
        return c.json({ error: "Project service unavailable" }, 503);
      }
      const dto = c.req.valid("json");
      const result = await controller.createProject(dto);

      return c.json({
        id: result.id,
        name: result.name,
        status: "active",
        services: result.services,
        databases: result.databases,
        artifacts: result.artifacts,
        structure: result.structure,
      });
    } catch (error) {
      const status = (error as any).status ?? 500;
      const message =
        status === 409
          ? "Project already exists"
          : ((error as Error).message ?? "Failed to create project");
      return c.json({ error: message }, status);
    }
  });

  // Delete project endpoint
  router.delete("/projects/:id", async (c) => {
    const projectId = c.req.param("id");

    if (!projectId) {
      return c.json({ error: "Project ID is required" }, 400);
    }

    try {
      const db = deps.db as any;

      // Check if project exists
      const projects = await db.listProjects();
      const project = projects.find((p: any) => p.id === projectId);

      if (!project) {
        return c.json({ error: "Project not found" }, 404);
      }

      // Delete all related artifacts first
      await db.deleteArtifacts(projectId);

      // Delete the project
      await db.deleteProject(projectId);

      // Broadcast project_deleted event to all connected clients
      const eventsService = deps.events as EventService | undefined;
      if (eventsService?.broadcastToAll) {
        await eventsService.broadcastToAll({
          type: "event",
          data: {
            event_type: "project_deleted",
            project_id: projectId,
            project_name: project.name,
            timestamp: new Date().toISOString(),
          },
        });
      }

      return c.json({
        success: true,
        message: `Project "${project.name}" deleted successfully`,
        projectId,
      });
    } catch (error) {
      console.error("Error deleting project:", error);
      return c.json({ error: "Failed to delete project" }, 500);
    }
  });

  // Action log endpoint for service activities
  router.get("/activities", (c) => {
    return c.json({
      activities: [
        {
          id: "act-1",
          type: "service",
          message: "Service added: user-auth-service",
          timestamp: "2025-09-20T10:30:00Z",
          projectId: "project-1",
        },
        {
          id: "act-2",
          type: "database",
          message: "Database configured: postgres-main",
          timestamp: "2025-09-20T10:15:00Z",
          projectId: "project-1",
        },
        {
          id: "act-3",
          type: "service",
          message: "Service deployed to staging environment",
          timestamp: "2025-09-20T09:45:00Z",
          projectId: "project-2",
        },
      ],
    });
  });

  return router;
}

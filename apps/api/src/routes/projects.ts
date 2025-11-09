import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { ProjectEntities } from "@arbiter/shared/types/entities";
import { Hono } from "hono";
import type { ContentFetcher } from "../content-fetcher";
import { createGithubContentFetcher, createLocalContentFetcher } from "../content-fetcher";
import type { EventService } from "../events";
import { gitScanner } from "../git-scanner";
import { parseGitUrl } from "../git-url";
import { analyzeProjectFiles } from "../project-analysis";
import { buildEpicTaskSpec, coerceStringArray } from "../utils";
type Dependencies = Record<string, unknown>;

const DEFAULT_STRUCTURE = {
  servicesDirectory: "services",
  clientsDirectory: "clients",
  modulesDirectory: "modules",
  toolsDirectory: "tools",
  docsDirectory: "docs",
  testsDirectory: "tests",
  infraDirectory: "infra",
};

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
          classification: {
            detectedType: "service",
            reason: "manual-entry",
            source: "user",
          },
        },
        filePath: typeof values.sourcePath === "string" ? values.sourcePath : undefined,
      };
    }
    case "module": {
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
          detectedType: "module",
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
        artifactType: "module",
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

interface PresetArtifactInput {
  name: string;
  type: string;
  description?: string | null;
  language?: string | null;
  framework?: string | null;
  metadata?: Record<string, unknown>;
  filePath?: string | null;
}

interface PresetProjectData {
  resolvedSpec: Record<string, unknown>;
  artifacts: PresetArtifactInput[];
  structure?: Record<string, unknown>;
}

const PRESET_BUILDERS: Record<
  string,
  (projectId: string, projectName: string) => PresetProjectData
> = {
  "web-app": (_projectId, projectName) => {
    const timestamp = new Date().toISOString();
    const composeYaml = `version: '3.9'
services:
  frontend:
    build: ./clients/web
    environment:
      NODE_ENV: development
      API_HTTP_URL: http://rest:3000
    ports:
      - '5173:5173'
    depends_on:
      - rest
  rest:
    build: ./services/rest
    environment:
      NODE_ENV: development
      DATABASE_URL: postgres://postgres:postgres@postgres:5432/app
    ports:
      - '3000:3000'
    depends_on:
      - postgres
  postgres:
    image: postgres:15
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: app
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data
volumes:
  postgres_data: {}
`;
    const resolvedSpec = {
      spec: {
        product: {
          name: projectName,
          description:
            "Full-stack web application preset with a React frontend, Node.js API tier, and PostgreSQL database.",
          goals: [
            "Deliver a responsive user experience",
            "Expose a well-documented REST API",
            "Support secure authentication and account management",
          ],
        },
        ui: {
          routes: [{ id: "root", path: "/" }],
          views: [
            {
              id: "root-view",
              name: "RootView",
              filePath: "clients/web/src/routes/root.tsx",
              description: "Entry view rendered at the application root.",
            },
          ],
        },
        services: {
          rest: {
            name: "rest-service",
            description: "Fastify REST API providing backend capabilities for the web application.",
            technology: "Node.js 20 + Fastify",
            language: "TypeScript",
            endpoints: [
              { method: "GET", path: "/api/rest", description: "List resources." },
              { method: "POST", path: "/api/rest", description: "Create a resource." },
            ],
            metadata: {
              presetId: "web-app",
              type: "service",
              packagePath: "services/rest",
            },
          },
        },
        databases: {
          primary: {
            name: "app-db",
            engine: "postgresql",
            description: "Primary relational database storing transactional data.",
            schemas: ["public", "audit"],
          },
        },
        modules: {
          frontend: {
            name: "frontend-app",
            description: "React frontend package served via Vite.",
            language: "TypeScript",
            metadata: {
              presetId: "web-app",
              type: "frontend",
              packagePath: "clients/web",
            },
          },
          shared: {
            name: "shared-library",
            description: "Reusable TypeScript utilities shared across services.",
            language: "TypeScript",
          },
        },
        frontend: {
          packages: [
            {
              packageName: "frontend-app",
              packageRoot: "clients/web",
              frameworks: ["react"],
              components: [
                {
                  name: "RootView",
                  filePath: "clients/web/src/routes/root.tsx",
                  framework: "React",
                  description: "Entry view rendered at the application root.",
                },
              ],
              routes: [
                {
                  path: "/",
                  filePath: "clients/web/src/routes/root.tsx",
                  displayLabel: "/",
                  routerType: "react-router",
                  isBaseRoute: true,
                },
              ],
            },
          ],
        },
        tools: {
          cli: {
            name: "project-cli",
            description: "Developer experience CLI with build and test helpers.",
            commands: ["dev", "lint", "test"],
          },
        },
        infrastructure: {
          containers: [
            {
              name: "frontend",
              image: "node:20-alpine",
              scope: "frontend",
              ports: [{ containerPort: 5173 }],
            },
            {
              name: "rest",
              image: "node:20-alpine",
              scope: "service",
              ports: [{ containerPort: 3000 }],
            },
            {
              name: "postgres",
              image: "postgres:15",
              scope: "database",
              ports: [{ containerPort: 5432 }],
            },
          ],
          compose: {
            file: "docker-compose.yml",
            services: ["frontend", "rest", "postgres"],
          },
        },
      },
      meta: {
        presetId: "web-app",
        generatedAt: timestamp,
      },
    } as Record<string, unknown>;

    const artifacts: PresetArtifactInput[] = [
      {
        name: "frontend-app",
        type: "frontend",
        description: "React SPA delivered with Vite dev server.",
        language: "typescript",
        framework: "react",
        filePath: "clients/web",
        metadata: {
          presetId: "web-app",
          detectedType: "frontend",
          technology: "React 18 + Vite",
          role: "frontend",
        },
      },
      {
        name: "rest-service",
        type: "service",
        description: "Fastify REST API serving the web application.",
        language: "typescript",
        framework: "fastify",
        filePath: "services/rest",
        metadata: {
          presetId: "web-app",
          endpoints: ["/api/rest"],
        },
      },
      {
        name: "app-db",
        type: "database",
        description: "PostgreSQL database for transactional data.",
        language: null,
        framework: null,
        filePath: "infra/database",
        metadata: {
          presetId: "web-app",
          engine: "postgresql",
          version: "15",
        },
      },
      {
        name: "project-cli",
        type: "tool",
        description: "Developer productivity CLI.",
        language: "typescript",
        framework: null,
        filePath: "tools/cli",
        metadata: {
          presetId: "web-app",
          commands: ["dev", "lint", "test"],
        },
      },
      {
        name: "docker-compose",
        type: "infrastructure",
        description:
          "Docker Compose definition for the frontend, REST API, and PostgreSQL database.",
        language: null,
        framework: null,
        filePath: "infra/docker-compose.yml",
        metadata: {
          presetId: "web-app",
          compose: true,
          composeYaml,
        },
      },
    ];

    return {
      resolvedSpec,
      artifacts,
      structure: { ...DEFAULT_STRUCTURE },
    };
  },
  "mobile-app": (_projectId, projectName) => {
    const timestamp = new Date().toISOString();
    const frontendPackage = {
      packageName: "mobile-app",
      packageRoot: "clients/mobile",
      frameworks: ["react-native"],
      components: [
        {
          name: "HomeScreen",
          filePath: "clients/mobile/src/screens/Home.tsx",
          framework: "React Native",
          description: "Landing experience with personalized content.",
        },
        {
          name: "ProfileScreen",
          filePath: "clients/mobile/src/screens/Profile.tsx",
          framework: "React Native",
          description: "Profile management and account preferences.",
        },
      ],
      routes: [
        {
          path: "/home",
          filePath: "clients/mobile/src/screens/Home.tsx",
          displayLabel: "/home",
          routerType: "react-native-stack",
        },
        {
          path: "/profile",
          filePath: "clients/mobile/src/screens/Profile.tsx",
          displayLabel: "/profile",
          routerType: "react-native-stack",
        },
        {
          path: "/settings",
          filePath: "clients/mobile/src/screens/Settings.tsx",
          displayLabel: "/settings",
          routerType: "react-native-stack",
        },
      ],
    };

    const resolvedSpec = {
      spec: {
        product: {
          name: projectName,
          description:
            "Cross-platform mobile application preset with React Native UI and supporting API.",
          goals: [
            "Provide native-feeling mobile experience",
            "Sync data when online and offline",
            "Deliver push notification capabilities",
          ],
        },
        ui: {
          routes:
            frontendPackage.routes?.map((route) => ({
              id: route.path.replace("/", "") || "home",
              path: route.path,
              name: `${route.displayLabel} Screen`.trim(),
            })) ?? [],
          views:
            frontendPackage.components?.map((component) => ({
              id: component.name.toLowerCase(),
              name: component.name,
              filePath: component.filePath,
              description: component.description,
            })) ?? [],
        },
        services: {
          api: {
            name: "mobile-api",
            description: "Node.js API optimized for mobile use-cases.",
            technology: "Node.js 20 + Fastify",
            language: "TypeScript",
            endpoints: [
              { method: "GET", path: "/api/feed", description: "Fetch personalized feed." },
              { method: "POST", path: "/api/profile", description: "Update profile information." },
            ],
            metadata: {
              presetId: "mobile-app",
              type: "service",
            },
          },
          notifications: {
            name: "notifications-worker",
            description: "Background worker dispatching push notifications.",
            technology: "Node.js 20 + BullMQ",
            language: "TypeScript",
            metadata: {
              presetId: "mobile-app",
              type: "job",
            },
          },
        },
        frontend: {
          packages: [frontendPackage],
        },
        databases: {
          cache: {
            name: "mobile-cache",
            engine: "redis",
            description: "Caching layer for offline synchronization.",
          },
        },
        tools: {
          pipeline: {
            name: "mobile-pipeline",
            description: "CI pipeline for building and distributing mobile binaries.",
            commands: ["build:ios", "build:android", "publish"],
          },
        },
        infrastructure: {
          containers: [
            {
              name: "mobile-api",
              image: "node:20-alpine",
              scope: "service",
              ports: [{ containerPort: 3001 }],
            },
            { name: "notifications-worker", image: "node:20-alpine", scope: "job", ports: [] },
            {
              name: "redis",
              image: "redis:7-alpine",
              scope: "cache",
              ports: [{ containerPort: 6379 }],
            },
          ],
        },
      },
      meta: {
        presetId: "mobile-app",
        generatedAt: timestamp,
      },
    } as Record<string, unknown>;

    const artifacts: PresetArtifactInput[] = [
      {
        name: "mobile-app",
        type: "frontend",
        description: "React Native application delivered through Expo.",
        language: "typescript",
        framework: "react-native",
        filePath: frontendPackage.packageRoot,
        metadata: {
          presetId: "mobile-app",
          detectedType: "frontend",
          packageRoot: frontendPackage.packageRoot,
          frameworks: frontendPackage.frameworks,
        },
      },
      {
        name: "mobile-api",
        type: "service",
        description: "API optimized for mobile workloads.",
        language: "typescript",
        framework: "fastify",
        filePath: "services/mobile-api",
        metadata: {
          presetId: "mobile-app",
          endpoints: ["/api/feed", "/api/profile"],
        },
      },
      {
        name: "notifications-worker",
        type: "service",
        description: "Background worker delivering push notifications.",
        language: "typescript",
        framework: "bullmq",
        filePath: "services/notifications-worker",
        metadata: {
          presetId: "mobile-app",
          type: "job",
        },
      },
      {
        name: "mobile-cache",
        type: "database",
        description: "Redis cache supporting offline sync.",
        language: null,
        framework: null,
        filePath: "infra/cache",
        metadata: {
          presetId: "mobile-app",
          engine: "redis",
        },
      },
    ];

    return {
      resolvedSpec,
      artifacts,
      structure: { ...DEFAULT_STRUCTURE },
    };
  },
  "api-service": (_projectId, projectName) => {
    const timestamp = new Date().toISOString();
    const resolvedSpec = {
      spec: {
        product: {
          name: projectName,
          description:
            "Preset for a production-ready REST API with documentation and observability.",
          goals: [
            "Expose versioned REST endpoints",
            "Provide comprehensive API documentation",
            "Instrument metrics for monitoring",
          ],
        },
        services: {
          api: {
            name: "core-api",
            description: "REST API built with Fastify.",
            technology: "Node.js 20 + Fastify",
            language: "TypeScript",
            endpoints: [
              { method: "GET", path: "/v1/resources", description: "List resources." },
              { method: "POST", path: "/v1/resources", description: "Create a resource." },
            ],
            metadata: {
              presetId: "api-service",
              type: "service",
            },
          },
          worker: {
            name: "background-worker",
            description: "Queue processing worker for async jobs.",
            technology: "Node.js 20 + BullMQ",
            language: "TypeScript",
            metadata: {
              presetId: "api-service",
              type: "job",
            },
          },
        },
        databases: {
          primary: {
            name: "api-db",
            engine: "postgresql",
            description: "Transactional database backing the API.",
          },
        },
        tools: {
          docs: {
            name: "api-docs",
            description: "OpenAPI documentation bundle.",
            commands: ["docs:generate"],
          },
          tests: {
            name: "contract-tests",
            description: "Postman collection runner for contract testing.",
          },
        },
        infrastructure: {
          containers: [
            {
              name: "core-api",
              image: "node:20-alpine",
              scope: "service",
              ports: [{ containerPort: 3000 }],
            },
            { name: "worker", image: "node:20-alpine", scope: "job", ports: [] },
            {
              name: "postgres",
              image: "postgres:15",
              scope: "database",
              ports: [{ containerPort: 5432 }],
            },
          ],
        },
      },
      meta: {
        presetId: "api-service",
        generatedAt: timestamp,
      },
    } as Record<string, unknown>;

    const artifacts: PresetArtifactInput[] = [
      {
        name: "core-api",
        type: "service",
        description: "Fastify REST API exposing versioned endpoints.",
        language: "typescript",
        framework: "fastify",
        filePath: "services/core-api",
        metadata: {
          presetId: "api-service",
          endpoints: ["/v1/resources"],
        },
      },
      {
        name: "background-worker",
        type: "service",
        description: "Queue processing worker handling asynchronous tasks.",
        language: "typescript",
        framework: "bullmq",
        filePath: "services/background-worker",
        metadata: {
          presetId: "api-service",
          type: "job",
        },
      },
      {
        name: "api-db",
        type: "database",
        description: "Primary PostgreSQL database for the API.",
        language: null,
        framework: null,
        filePath: "infra/database",
        metadata: {
          presetId: "api-service",
          engine: "postgresql",
        },
      },
      {
        name: "api-docs",
        type: "tool",
        description: "OpenAPI documentation package.",
        language: "typescript",
        framework: null,
        filePath: "tools/docs",
        metadata: {
          presetId: "api-service",
          commands: ["docs:generate"],
        },
      },
    ];

    return {
      resolvedSpec,
      artifacts,
      structure: { ...DEFAULT_STRUCTURE },
    };
  },
  microservice: (_projectId, projectName) => {
    const timestamp = new Date().toISOString();
    const resolvedSpec = {
      spec: {
        product: {
          name: projectName,
          description:
            "Containerized microservice preset with observability and asynchronous messaging.",
          goals: [
            "Deploy as an independent container",
            "Expose health checks for orchestration",
            "Publish domain events to a message broker",
          ],
        },
        services: {
          microservice: {
            name: "inventory-service",
            description: "Go microservice managing inventory levels.",
            technology: "Go 1.22 + Echo",
            language: "Go",
            endpoints: [
              { method: "GET", path: "/inventory", description: "List inventory items." },
              { method: "POST", path: "/inventory/reserve", description: "Reserve inventory." },
            ],
            metadata: {
              presetId: "microservice",
              type: "service",
            },
          },
          metrics: {
            name: "metrics-collector",
            description: "Prometheus metrics exporter for the service.",
            technology: "Go 1.22",
            language: "Go",
            metadata: {
              presetId: "microservice",
              type: "service",
            },
          },
        },
        infrastructure: {
          containers: [
            {
              name: "inventory-service",
              image: "golang:1.22-alpine",
              scope: "service",
              ports: [{ containerPort: 8080 }],
            },
            {
              name: "metrics",
              image: "prom/prometheus",
              scope: "observability",
              ports: [{ containerPort: 9090 }],
            },
            {
              name: "nats",
              image: "nats:2-alpine",
              scope: "messaging",
              ports: [{ containerPort: 4222 }],
            },
          ],
        },
        tools: {
          ci: {
            name: "service-pipeline",
            description: "CI pipeline with build, test, and deploy stages.",
            commands: ["build", "test", "docker:publish"],
          },
        },
      },
      meta: {
        presetId: "microservice",
        generatedAt: timestamp,
      },
    } as Record<string, unknown>;

    const artifacts: PresetArtifactInput[] = [
      {
        name: "inventory-service",
        type: "service",
        description: "Go microservice exposing inventory APIs.",
        language: "go",
        framework: "echo",
        filePath: "services/inventory",
        metadata: {
          presetId: "microservice",
          technology: "Go 1.22 + Echo",
        },
      },
      {
        name: "metrics-collector",
        type: "service",
        description: "Prometheus metrics sidecar.",
        language: "go",
        framework: null,
        filePath: "services/metrics",
        metadata: {
          presetId: "microservice",
          role: "observability",
        },
      },
      {
        name: "event-bus",
        type: "infrastructure",
        description: "NATS message broker for asynchronous communication.",
        language: null,
        framework: null,
        filePath: "infra/messaging",
        metadata: {
          presetId: "microservice",
          technology: "nats",
        },
      },
    ];

    return {
      resolvedSpec,
      artifacts,
      structure: { ...DEFAULT_STRUCTURE },
    };
  },
};

export function createProjectsRouter(deps: Dependencies) {
  const router = new Hono();

  // GET single project with full resolved spec and artifacts
  router.get("/projects/:id", async (c) => {
    const projectId = c.req.param("id");

    if (!projectId) {
      return c.json({ error: "Project ID is required" }, 400);
    }

    try {
      const db = deps.db as any;

      // Fetch project details
      const projects = await db.listProjects();
      const project = projects.find((p: any) => p.id === projectId);

      if (!project) {
        return c.json({ error: "Project not found" }, 404);
      }

      // Fetch all artifacts for this project
      const artifacts = await db.getArtifacts(projectId);

      // Map artifacts to the expected spec structure for frontend rendering
      const services: Record<string, any> = {};
      const databases: Record<string, any> = {};
      const components: Record<string, any> = {};

      artifacts.forEach((artifact: any) => {
        const cleanName = artifact.name.replace(/_/g, "-");
        const baseData = {
          id: artifact.id,
          artifactId: artifact.id,
          name: artifact.name,
          type: artifact.type,
          description: artifact.description || artifact.metadata?.description || "",
          metadata: {
            ...(artifact.metadata ?? {}),
            detected: true,
            language: artifact.language,
            framework: artifact.framework,
            artifactId: artifact.id,
          },
        };

        switch (artifact.type) {
          case "service":
            services[cleanName] = baseData;
            break;
          case "database":
            databases[cleanName] = baseData;
            break;
          case "module":
          case "tool":
          case "binary":
          case "frontend":
          case "job":
          case "infrastructure":
          case "deployment":
            components[cleanName] = baseData;
            break;
          default:
            // Handle other types as components
            components[cleanName] = baseData;
        }
      });

      // Calculate infrastructure and external counts for consistency
      let infrastructureCount = 0;
      let externalCount = 0;
      for (const [key, comp] of Object.entries(components)) {
        if (comp.type === "infrastructure") {
          infrastructureCount++;
        } else if (!["module", "tool", "binary", "frontend"].includes(comp.type)) {
          externalCount++;
        }
      }

      // Generate routes from services (for UI consistency)
      const routes = Object.keys(services).map((serviceName) => ({
        id: serviceName,
        path: `/${serviceName}`,
        name: services[serviceName].name,
      }));

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
            modules: Object.keys(components).filter((k) => components[k].type === "module").length,
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
      "module",
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
            modules: 0,
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
            for (const artifact of otherArtifacts) {
              const type = artifact.type;
              typeGroups[type] = (typeGroups[type] || 0) + 1;
            }
            console.log(`[DEBUG] Artifact types for project ${project.name}:`, typeGroups);

            let moduleCount = 0;
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
                case "module":
                  moduleCount++;
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
              modules: moduleCount,
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
              modules: 0,
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
      "module",
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
  router.post("/projects", async (c) => {
    try {
      const db = deps.db as any;
      const body = await c.req.json();
      const { id: requestedId, name, path: projectPath, presetId } = body;

      if (!name) {
        return c.json({ error: "Project name is required" }, 400);
      }

      const trimmedRequestedId =
        typeof requestedId === "string" && requestedId.trim().length > 0
          ? requestedId.trim()
          : undefined;
      const projectId = trimmedRequestedId ?? `project-${Date.now()}`;

      if (trimmedRequestedId) {
        const existingProject = await db.getProject(trimmedRequestedId);
        if (existingProject) {
          return c.json({ error: "Project already exists", projectId: trimmedRequestedId }, 409);
        }
      }

      // Determine project ID (allow caller to provide a stable identifier)
      // Use the provided name (which should be extracted from git URL on frontend)
      let actualProjectName = name;

      let services = 0;
      let databases = 0;
      let artifacts: any[] = [];
      let detectedStructure: any;
      let presetData: PresetProjectData | null = null;

      if (presetId) {
        const builder = PRESET_BUILDERS[presetId];
        if (!builder) {
          return c.json({ error: `Unknown preset: ${presetId}` }, 400);
        }

        presetData = builder(projectId, actualProjectName);
        const generatedArtifacts = presetData.artifacts.map((artifact, index) => ({
          id: `${projectId}-preset-artifact-${index + 1}`,
          ...artifact,
        }));

        artifacts = generatedArtifacts;
        services = Object.keys(
          ((presetData.resolvedSpec as Record<string, any>)?.spec?.services as Record<
            string,
            unknown
          >) ?? {},
        ).length;
        databases = Object.keys(
          ((presetData.resolvedSpec as Record<string, any>)?.spec?.databases as Record<
            string,
            unknown
          >) ?? {},
        ).length;
        detectedStructure = presetData.structure
          ? { ...presetData.structure }
          : { ...DEFAULT_STRUCTURE };
      } else if (projectPath) {
        let files: string[] = [];
        let structure = undefined;
        let gitUrl: string | undefined;
        let branch: string | undefined;
        let contentFetcher: ContentFetcher | undefined;

        const resolved = gitScanner.resolveTempPath
          ? await gitScanner.resolveTempPath(projectPath)
          : null;

        if (resolved?.success) {
          files = resolved.files ?? [];
          structure = resolved.projectStructure;
          gitUrl = resolved.gitUrl;
          branch = resolved.branch;

          if (gitUrl) {
            const parsedGit = parseGitUrl(gitUrl);
            if (parsedGit) {
              const ref = branch ?? parsedGit.ref ?? "main";
              const token = typeof process !== "undefined" ? process.env.GITHUB_TOKEN : undefined;
              contentFetcher = createGithubContentFetcher({
                owner: parsedGit.owner,
                repo: parsedGit.repo,
                ref,
                token,
              });
            }
          }
        }

        if (!files.length) {
          const scanResult = await gitScanner.scanLocalPath(projectPath);
          if (scanResult.success) {
            files = scanResult.files ?? [];
            structure = scanResult.projectStructure;
            contentFetcher = createLocalContentFetcher(projectPath);
            branch = scanResult.branch;
          }
        }

        if (files.length > 0) {
          const absoluteProjectRoot = projectPath ? path.resolve(projectPath) : undefined;
          const analysis = await analyzeProjectFiles(projectId, actualProjectName, files, {
            gitUrl,
            structure,
            branch,
            fetcher: contentFetcher,
            projectRoot: absoluteProjectRoot,
          });

          artifacts = analysis.artifacts;
          services = analysis.serviceCount;
          databases = analysis.databaseCount;
          detectedStructure = analysis.structure;
        }
      }

      if (!detectedStructure) {
        detectedStructure = { ...DEFAULT_STRUCTURE };
      }

      // Create project with detected counts
      const project = await db.createProject(projectId, actualProjectName, services, databases);

      // Now create all the artifacts for the project
      for (const artifact of artifacts) {
        try {
          console.debug("[projects.create] storing artifact", {
            projectId,
            name: artifact.name,
            type: artifact.type,
            language: artifact.language,
            classification: artifact.metadata?.classification,
          });
          await db.createArtifact(
            artifact.id,
            projectId,
            artifact.name,
            typeof artifact.description === "string" ? artifact.description?.trim() || null : null,
            artifact.type,
            artifact.language,
            artifact.framework,
            artifact.metadata,
            artifact.filePath,
          );
        } catch (error) {
          console.warn(`Failed to create artifact ${artifact.name}:`, error);
        }
      }

      if (presetData?.resolvedSpec) {
        const resolvedJson = JSON.stringify(presetData.resolvedSpec, null, 2);
        const specHash = createHash("sha1").update(resolvedJson).digest("hex");
        await db.createVersion(`version-${Date.now()}`, project.id, specHash, resolvedJson);
      }

      return c.json({
        id: project.id,
        name: project.name,
        status: "active",
        services,
        databases,
        artifacts: artifacts.length,
        lastActivity: project.created_at,
        structure: detectedStructure,
      });
    } catch (error) {
      console.error("Error creating project:", error);
      return c.json({ error: "Failed to create project" }, 500);
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

      console.log(`🗑️ Project deleted: ${projectId} (${project.name})`);

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

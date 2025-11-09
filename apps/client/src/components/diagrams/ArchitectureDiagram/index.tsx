import {
  AddEntityModal,
  DEFAULT_UI_OPTION_CATALOG,
  type EpicTaskOption,
  type FieldValue,
  type TaskEpicOption,
  type UiOptionCatalog,
} from "@/components/modals/AddEntityModal";
import { useProjectEntityPersistence } from "@/hooks/useProjectEntityPersistence";
import { apiService } from "@/services/api";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import {
  Component,
  Database,
  Eye,
  Flag,
  GitBranch,
  Layout,
  ListChecks,
  Navigation,
  Server,
  Shield,
  Sparkles,
  Terminal,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { EmptyState } from "./components/EmptyState";
import { ErrorState } from "./components/ErrorState";
import { LoadingState } from "./components/LoadingState";
import { SourceGroup } from "./components/SourceGroup";
import type { ArchitectureDiagramProps, ArchitectureEntityModalRequest } from "./types";

type TreeMode = "components" | "routes";

interface GroupedComponentItem {
  name: string;
  data: any;
}

interface GroupedComponentGroup {
  key: string;
  label: string;
  type: string;
  layout: "grid" | "tree";
  treeMode?: TreeMode;
  items: GroupedComponentItem[];
}

interface RouteEndpointParameter {
  name: string;
  type?: string;
  optional: boolean;
  description?: string;
  decorators?: string[];
}

interface RouteEndpointResponse {
  decorator: "SuccessResponse" | "Response";
  status?: string;
  description?: string;
}

interface RouteEndpointDocumentation {
  summary?: string;
  description?: string;
  returns?: string;
  remarks?: string[];
  examples?: string[];
  deprecated?: boolean | string;
}

interface RouteEndpoint {
  method: string;
  path?: string;
  fullPath?: string;
  controller?: string;
  handler?: string;
  returnType?: string;
  signature: string;
  documentation?: RouteEndpointDocumentation;
  parameters: RouteEndpointParameter[];
  responses: RouteEndpointResponse[];
  tags?: string[];
  source?: { line: number };
}

interface FrontendPackage {
  packageName: string;
  packageRoot: string;
  frameworks: string[];
  components?: Array<{
    name: string;
    filePath: string;
    framework: string;
    description?: string;
    props?: any;
  }>;
  routes?: Array<{
    path: string;
    filePath?: string;
    treePath?: string;
    routerType?: string;
    displayLabel: string;
    httpMethods: string[];
    endpoints: RouteEndpoint[];
    metadata: any;
    isBaseRoute: boolean;
  }>;
}

const stringifyListEntry = (entry: unknown): string => {
  if (typeof entry === "string") {
    return entry;
  }
  if (entry === null || entry === undefined) {
    return "";
  }
  try {
    return JSON.stringify(entry);
  } catch {
    return String(entry);
  }
};

const buildInitialValuesFromMetadata = (
  entityType: string,
  metadataInput: Record<string, unknown> | undefined,
): Record<string, FieldValue> => {
  if (!metadataInput || typeof metadataInput !== "object") {
    return {};
  }

  const metadata = metadataInput as Record<string, unknown>;
  const initial: Record<string, FieldValue> = {};

  if (typeof metadata.description === "string") {
    initial.description = metadata.description;
  }

  if (entityType === "module") {
    if (typeof metadata.moduleType === "string") {
      initial.moduleType = metadata.moduleType;
    }
    if (typeof metadata.owner === "string") {
      initial.owner = metadata.owner;
    }
    if (typeof metadata.kind === "string") {
      initial.kind = metadata.kind;
    }
    if (Array.isArray(metadata.deliverables)) {
      initial.deliverables = metadata.deliverables.map(stringifyListEntry).join("\n");
    }
    if (Array.isArray(metadata.steps)) {
      initial.flowSteps = metadata.steps.map(stringifyListEntry).join("\n");
    }
    const schema = metadata.schema as Record<string, unknown> | undefined;
    if (schema) {
      if (typeof schema.engine === "string") initial.schemaEngine = schema.engine;
      if (typeof schema.version === "string") initial.schemaVersion = schema.version;
      if (typeof schema.owner === "string") initial.schemaOwner = schema.owner;
      if (Array.isArray(schema.tables)) {
        initial.schemaTables = schema.tables.map(stringifyListEntry).join("\n");
      }
    }
    const api = metadata.api as Record<string, unknown> | undefined;
    if (api) {
      if (typeof api.format === "string") initial.docFormat = api.format;
      if (typeof api.version === "string") initial.docVersion = api.version;
      if (typeof api.source === "string") initial.docSource = api.source;
    }
    const runbook = metadata.runbook as Record<string, unknown> | undefined;
    if (runbook) {
      if (typeof runbook.name === "string") initial.runbookName = runbook.name;
      if (typeof runbook.path === "string") initial.runbookPath = runbook.path;
    }
    const config = metadata.config as Record<string, unknown> | undefined;
    const sla = config?.sla as Record<string, unknown> | undefined;
    if (sla) {
      if (typeof sla.uptime === "string") initial.slaUptime = sla.uptime;
      if (sla.p95ResponseMs !== undefined) initial.slaP95 = String(sla.p95ResponseMs);
      if (sla.p99ResponseMs !== undefined) initial.slaP99 = String(sla.p99ResponseMs);
    }
  } else if (entityType === "infrastructure") {
    if (typeof metadata.scope === "string") {
      initial.scope = metadata.scope;
    }
    if (typeof metadata.category === "string") {
      initial.category = metadata.category;
    }
    const environment = metadata.environment as Record<string, unknown> | undefined;
    if (environment) {
      if (typeof environment.domain === "string") initial.environmentDomain = environment.domain;
      if (typeof environment.releaseGate === "string") {
        initial.environmentReleaseGate = environment.releaseGate;
      }
      if (typeof environment.changeManagement === "string") {
        initial.environmentChangeManagement = environment.changeManagement;
      }
      if (Array.isArray(environment.secrets)) {
        initial.environmentSecrets = environment.secrets.map(stringifyListEntry).join("\n");
      }
    }
    const config = metadata.config as Record<string, unknown> | undefined;
    const logging = config?.logging as Record<string, unknown> | undefined;
    if (logging && typeof logging.level === "string") {
      initial.observabilityLoggingLevel = logging.level;
    }
    const monitoring = config?.monitoring as Record<string, unknown> | undefined;
    if (monitoring && typeof monitoring.metricsProvider === "string") {
      initial.observabilityMetricsProvider = monitoring.metricsProvider;
    }
    if (monitoring && Array.isArray(monitoring.alerts)) {
      initial.observabilityAlerts = monitoring.alerts.map(stringifyListEntry).join("\n");
    }
    if (config) {
      if (typeof config.tool === "string") initial.migrationTool = config.tool;
      if (typeof config.strategy === "string") initial.migrationStrategy = config.strategy;
      if (typeof config.schedule === "string") initial.migrationSchedule = config.schedule;
    }
  }

  return initial;
};

const normalizeRelativePath = (filePath: string | undefined, packageRoot: string): string => {
  if (!filePath) return "";
  const normalizedFile = filePath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!packageRoot) return normalizedFile;

  const normalizedRoot = packageRoot.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  if (!normalizedRoot) return normalizedFile;

  if (normalizedFile.startsWith(normalizedRoot)) {
    const trimmed = normalizedFile.slice(normalizedRoot.length);
    return trimmed.replace(/^\/+/, "");
  }

  return normalizedFile;
};

const getComponentType = (data: any, name: string): string => {
  const toLowerString = (value: unknown): string => String(value || "").toLowerCase();
  const rawType = toLowerString(data.type || data.metadata?.type);
  const language = toLowerString(data.metadata?.language);
  const framework = toLowerString(data.metadata?.framework);
  const detectedType = toLowerString(data.metadata?.detectedType);

  if (detectedType === "tool" || detectedType === "build_tool") return "tool";
  if (detectedType === "frontend" || detectedType === "mobile") return "frontend";
  if (detectedType === "web_service") return "service";

  if (rawType.includes("service")) return "service";
  if (["module", "library"].includes(rawType)) return "module";
  if (["tool", "cli", "binary"].includes(rawType)) return "tool";
  if (["deployment", "infrastructure"].includes(rawType)) return "infrastructure";
  if (rawType === "database") return "database";
  if (rawType === "frontend" || rawType === "mobile") return "frontend";
  if (rawType === "route") {
    const routerType = toLowerString(data.metadata?.routerType);
    if (routerType && routerType !== "tsoa") {
      return "view";
    }
    return "route";
  }
  if (rawType === "component") return "component";

  if (language && ["javascript", "typescript", "tsx", "jsx"].includes(language)) {
    if (data.metadata?.routerType) return "view";
    if (framework.includes("react") || framework.includes("next")) return "view";
  }

  if (data.metadata?.containerImage || data.metadata?.compose) return "service";
  if (data.metadata?.kubernetes || data.metadata?.terraform) return "infrastructure";

  if (name.includes("@")) return "module";

  return "component";
};

const computeGroupedComponents = (
  projectData: any,
  removedArtifactIds: Set<string> = new Set(),
): GroupedComponentGroup[] => {
  const CUE_FILE_REGEX = /\.cue$/i;
  const TYPE_CONFIG: Record<
    string,
    { label: string; layout: "grid" | "tree"; treeMode?: TreeMode }
  > = {
    service: { label: "Services", layout: "grid" },
    frontend: { label: "Frontends", layout: "grid" },
    module: { label: "Modules", layout: "grid" },
    tool: { label: "Tools", layout: "grid" },
    route: { label: "Routes", layout: "grid" },
    view: { label: "Views", layout: "grid" },
    component: { label: "Components", layout: "grid" },
    infrastructure: { label: "Infrastructure", layout: "grid" },
    database: { label: "Databases", layout: "grid" },
    flow: { label: "Flows", layout: "grid" },
    capability: { label: "Capabilities", layout: "grid" },
    epic: { label: "Epics", layout: "grid" },
    task: { label: "Tasks", layout: "grid" },
    other: { label: "Other", layout: "grid" },
  };

  const getTypeConfig = (type: string) => TYPE_CONFIG[type] ?? TYPE_CONFIG.other;

  const shouldExcludeFromDiagram = (item: any): boolean => {
    if (isRemovedItem(item)) {
      return true;
    }
    const candidates = [
      item?.metadata?.filePath,
      item?.metadata?.sourceFile,
      item?.filePath,
      item?.sourceFile,
    ]
      .filter(Boolean)
      .map((path) => String(path));

    return candidates.some((path) => CUE_FILE_REGEX.test(path));
  };

  const enrichDataForGrouping = (data: any, enforcedType: string) => ({
    ...data,
    type: data.type || enforcedType,
    metadata: {
      ...(data.metadata || {}),
    },
  });

  const groups = new Map<string, GroupedComponentGroup>();
  const recordedTaskKeys = new Set<string>();

  const resolveArtifactId = (item: unknown): string | undefined => {
    if (!item || typeof item !== "object") {
      return undefined;
    }
    const candidateSources: unknown[] = [
      (item as Record<string, unknown>).artifactId,
      (item as Record<string, unknown>).artifact_id,
      (item as Record<string, unknown>).id,
    ];
    const metadata = (item as Record<string, unknown>).metadata;
    if (metadata && typeof metadata === "object") {
      candidateSources.push(
        (metadata as Record<string, unknown>).artifactId,
        (metadata as Record<string, unknown>).artifact_id,
        (metadata as Record<string, unknown>).id,
      );
    }
    for (const candidate of candidateSources) {
      if (typeof candidate === "string") {
        const trimmed = candidate.trim();
        if (trimmed) {
          return trimmed;
        }
      }
    }
    return undefined;
  };

  const isRemovedItem = (item: unknown): boolean => {
    if (!removedArtifactIds || removedArtifactIds.size === 0) {
      return false;
    }
    const candidateId = resolveArtifactId(item);
    return candidateId ? removedArtifactIds.has(candidateId) : false;
  };

  const ensureGroup = (type: string): GroupedComponentGroup => {
    const config = getTypeConfig(type)!;
    if (!groups.has(config.label)) {
      const baseGroup: GroupedComponentGroup = {
        key: type,
        label: config.label,
        type,
        layout: config.layout,
        items: [],
      };
      if (config.treeMode !== undefined) {
        baseGroup.treeMode = config.treeMode;
      }
      groups.set(config.label, baseGroup);
    }
    return groups.get(config.label)!;
  };

  const registerTask = (
    rawTask: any,
    fallbackName: string,
    context?: { epicId?: string; epicName?: string },
  ) => {
    if (!rawTask && typeof rawTask !== "string") {
      return;
    }

    const taskData = typeof rawTask === "string" ? { name: rawTask } : { ...rawTask };
    if (shouldExcludeFromDiagram(taskData)) {
      return;
    }
    const metadata = (taskData.metadata ?? {}) as Record<string, unknown>;

    const identifierCandidates = [
      taskData.id,
      metadata.id,
      taskData.artifactId,
      metadata.artifactId,
      metadata.artifact_id,
    ]
      .map((value) => (typeof value === "string" ? value.trim() : ""))
      .filter(Boolean);

    const dedupeKey = identifierCandidates[0] || fallbackName;
    if (dedupeKey && recordedTaskKeys.has(dedupeKey)) {
      return;
    }

    const taskName =
      (typeof taskData.name === "string" && taskData.name.trim().length > 0
        ? taskData.name.trim()
        : undefined) ??
      dedupeKey ??
      fallbackName ??
      `Task ${recordedTaskKeys.size + 1}`;

    const statusCandidates = [taskData.status, taskData.state, metadata.status, metadata.state]
      .map((value) => (typeof value === "string" ? value.toLowerCase() : ""))
      .filter(Boolean);

    const completedFlag =
      taskData.completed === true ||
      taskData.done === true ||
      taskData.isCompleted === true ||
      metadata.completed === true ||
      statusCandidates.includes("completed");

    if (completedFlag) {
      return;
    }

    const enrichedTask = enrichDataForGrouping(
      {
        ...taskData,
        name: taskName,
        metadata: {
          ...(metadata || {}),
          ...(context?.epicId ? { epicId: context.epicId } : {}),
          ...(context?.epicName ? { epicName: context.epicName } : {}),
        },
      },
      "task",
    );

    addToGroup("task", taskName, enrichedTask);

    if (dedupeKey) {
      recordedTaskKeys.add(dedupeKey);
    }
  };

  const addToGroup = (type: string, name: string, data: any) => {
    if (!type) return;
    if (isRemovedItem(data)) return;
    const group = ensureGroup(type);
    group.items.push({ name, data });
  };

  if (projectData) {
    const services = projectData.spec?.services || projectData.services || {};
    const databases = projectData.spec?.databases || projectData.databases || {};
    const components = projectData.spec?.components || projectData.components || {};
    const routes = projectData.spec?.ui?.routes || projectData.ui?.routes || [];
    const frontendPackages = projectData.spec?.frontend?.packages || [];

    const processEntry = (name: string, originalData: any) => {
      if (!originalData) return;
      if (shouldExcludeFromDiagram(originalData)) return;
      const type = getComponentType(originalData, name);
      const data = enrichDataForGrouping(originalData, type);
      addToGroup(type, name, data);
    };

    Object.entries(services).forEach(([name, data]) => {
      processEntry(name, data);
    });

    Object.entries(databases).forEach(([name, data]) => {
      if (!data) return;
      const databaseData = enrichDataForGrouping(data, "database");
      if (shouldExcludeFromDiagram(databaseData)) return;
      addToGroup("database", name, databaseData);
    });

    Object.entries(components).forEach(([name, data]) => {
      processEntry(name, data);
    });

    (routes as any[]).forEach((route) => {
      if (!route) return;
      const name = route.id || route.name || route.path || "route";
      const baseMetadata = route.metadata || {};
      const routerType = baseMetadata.routerType;
      const derivedType = routerType && routerType !== "tsoa" ? "view" : "route";
      const routeData = {
        ...route,
        name: route.name || route.path || name,
        metadata: baseMetadata,
        type: derivedType,
      };
      if (shouldExcludeFromDiagram(routeData)) return;
      const type = getComponentType(routeData, name);
      addToGroup(type, name, routeData);
    });

    frontendPackages.forEach((pkg: any) => {
      const packageName = pkg.packageName || pkg.name || "frontend";
      const packageRoot = pkg.packageRoot || pkg.root || ".";

      const frontendSummary = enrichDataForGrouping(
        {
          name: packageName,
          description:
            pkg.description ||
            pkg.summary ||
            `Frontend package located at ${packageRoot || "project root"}`,
          metadata: {
            ...(pkg.metadata || {}),
            packageName,
            packageRoot,
            frameworks: pkg.frameworks,
            framework: Array.isArray(pkg.frameworks) ? pkg.frameworks[0] : undefined,
            detectedType: "frontend",
            type: "frontend",
          },
        },
        "frontend",
      );

      addToGroup("frontend", packageName, frontendSummary);

      (pkg.components || []).forEach((component: any) => {
        const name = `${packageName}:${component.name}`;
        const relativeFilePath = normalizeRelativePath(component.filePath, packageRoot);
        const data = enrichDataForGrouping(
          {
            ...component,
            metadata: {
              ...component.metadata,
              packageName,
              packageRoot,
              filePath: relativeFilePath,
              displayLabel: component.name,
            },
          },
          "component",
        );
        if (shouldExcludeFromDiagram(data)) return;
        addToGroup("component", name, data);
      });

      (pkg.routes || []).forEach((route: any) => {
        const name = `${packageName}:${route.path || route.filePath || "view"}`;
        const relativeFilePath = normalizeRelativePath(route.filePath, packageRoot);
        const displayLabel = route.path || route.filePath || route.name || name;
        const data = enrichDataForGrouping(
          {
            ...route,
            name: displayLabel,
            metadata: {
              ...route.metadata,
              packageName,
              packageRoot,
              routerType: route.routerType || "frontend",
              filePath: relativeFilePath,
              displayLabel,
            },
          },
          "view",
        );
        if (shouldExcludeFromDiagram(data)) return;
        addToGroup("view", name, data);
      });
    });
  }

  const capabilitySource = projectData?.spec?.capabilities ?? projectData?.capabilities ?? [];
  const recordCapability = (raw: any, fallbackName: string, idx: number) => {
    if (!raw && typeof raw !== "string") return;
    const capabilityData = typeof raw === "string" ? { name: raw } : { ...raw };
    const capabilityName = String(capabilityData.name || fallbackName || `Capability ${idx + 1}`);

    if (!capabilityData.description && capabilityData.metadata?.description) {
      capabilityData.description = capabilityData.metadata.description;
    }

    if (!capabilityData.gherkin) {
      const fromMetadata = capabilityData.metadata?.gherkinSpec || capabilityData.metadata?.gherkin;
      if (typeof fromMetadata === "string" && fromMetadata.trim().length > 0) {
        capabilityData.gherkin = fromMetadata;
      }
    }

    const enriched = enrichDataForGrouping(
      {
        ...capabilityData,
        name: capabilityName,
      },
      "capability",
    );
    addToGroup("capability", capabilityName, enriched);
  };

  if (Array.isArray(capabilitySource)) {
    capabilitySource.forEach((capability, index) => {
      recordCapability(capability, `Capability ${index + 1}`, index);
    });
  } else if (capabilitySource && typeof capabilitySource === "object") {
    Object.entries(capabilitySource as Record<string, any>).forEach(([key, capability], index) => {
      recordCapability(capability, key || `Capability ${index + 1}`, index);
    });
  }

  const flowsSource = projectData?.spec?.flows ?? projectData?.flows ?? [];
  const flowsArray = Array.isArray(flowsSource)
    ? flowsSource
    : flowsSource && typeof flowsSource === "object"
      ? Object.values(flowsSource as Record<string, any>)
      : [];
  flowsArray.forEach((flow, index) => {
    if (!flow && typeof flow !== "string") return;
    const flowData = typeof flow === "string" ? { name: flow } : { ...flow };
    const flowName = String(flowData.name || flowData.id || `Flow ${index + 1}`);
    const enriched = enrichDataForGrouping(
      {
        ...flowData,
        name: flowName,
      },
      "flow",
    );
    addToGroup("flow", flowName, enriched);
  });

  const epicSource = projectData?.spec?.epics ?? projectData?.epics ?? [];
  const epicEntries: Array<{ key: string; value: any; index: number }> = [];
  if (Array.isArray(epicSource)) {
    epicSource.forEach((value, index) => {
      const key =
        (value && typeof value === "object" && (value.id || value.name)) || `epic-${index + 1}`;
      epicEntries.push({ key: String(key), value, index });
    });
  } else if (epicSource && typeof epicSource === "object") {
    Object.entries(epicSource as Record<string, any>).forEach(([key, value], index) => {
      epicEntries.push({ key, value, index });
    });
  }

  epicEntries.forEach(({ key, value, index }) => {
    if (!value && typeof value !== "string") return;
    const epicData = typeof value === "string" ? { id: key, name: value } : { ...value };
    const epicId = String(epicData.id || key || `epic-${index + 1}`);
    const epicName = String(epicData.name || epicId || `Epic ${index + 1}`);
    const enrichedEpic = enrichDataForGrouping(
      {
        ...epicData,
        id: epicId,
        name: epicName,
        metadata: {
          ...(epicData.metadata || {}),
          epicId,
        },
      },
      "epic",
    );
    addToGroup("epic", epicName, enrichedEpic);

    const tasksSource = epicData.tasks ?? [];
    const tasksArray = Array.isArray(tasksSource)
      ? tasksSource
      : tasksSource && typeof tasksSource === "object"
        ? Object.values(tasksSource as Record<string, any>)
        : [];

    tasksArray.forEach((task, taskIndex) => {
      registerTask(task, `${epicName} Task ${taskIndex + 1}`, { epicId, epicName });
    });
  });

  const normalizeTaskCollection = (source: unknown): any[] => {
    if (Array.isArray(source)) {
      return source;
    }
    if (source && typeof source === "object") {
      return Object.values(source as Record<string, any>);
    }
    return [];
  };

  const standaloneSpecTasks = normalizeTaskCollection(projectData?.spec?.tasks);
  standaloneSpecTasks.forEach((task, index) => {
    registerTask(task, `Task ${index + 1}`);
  });

  const projectLevelTasks = normalizeTaskCollection(projectData?.tasks);
  projectLevelTasks.forEach((task, index) => {
    registerTask(task, `Task ${standaloneSpecTasks.length + index + 1}`);
  });

  Object.keys(TYPE_CONFIG)
    .filter((type) => type !== "component")
    .forEach((type) => {
      ensureGroup(type);
    });

  const dedupedGroups = Array.from(groups.values())
    .map((group) => {
      const seenDisplayNames = new Set<string>();
      const uniqueItems = group.items.filter(({ name, data }) => {
        const displayName = data.name || name;
        if (!displayName) return false;
        if (seenDisplayNames.has(displayName)) return false;
        seenDisplayNames.add(displayName);
        return true;
      });

      return { ...group, items: uniqueItems };
    })
    .filter((group) => group.type !== "component");

  return dedupedGroups.sort((a, b) => {
    const diff = b.items.length - a.items.length;
    if (diff !== 0) {
      return diff;
    }
    return a.label.localeCompare(b.label);
  });
};

const ArchitectureDiagram: React.FC<ArchitectureDiagramProps> = ({
  projectId,
  className = "",
  onOpenEntityModal,
}) => {
  const [projectData, setProjectData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});
  const [addDialogConfig, setAddDialogConfig] = useState<{ type: string; label: string } | null>(
    null,
  );
  const [uiOptionCatalog, setUiOptionCatalog] =
    useState<UiOptionCatalog>(DEFAULT_UI_OPTION_CATALOG);
  const [optimisticRemovals, setOptimisticRemovals] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();
  const [groupListRef] = useAutoAnimate<HTMLDivElement>({
    duration: 220,
    easing: "ease-in-out",
  });

  const toggleOptimisticRemoval = useCallback((artifactId: string, shouldAdd: boolean) => {
    setOptimisticRemovals((prev) => {
      const next = new Set(prev);
      if (shouldAdd) {
        next.add(artifactId);
      } else {
        next.delete(artifactId);
      }
      return next;
    });
  }, []);

  const refreshProjectData = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = options?.silent ?? false;
      if (!projectId) {
        setProjectData(null);
        setError(null);
        if (!silent) {
          setLoading(false);
        }
        return;
      }

      try {
        if (!silent) {
          setLoading(true);
        }
        setError(null);
        const result = await apiService.getResolvedSpec(projectId);
        setProjectData(result.resolved);
      } catch (err: any) {
        if (err.status === 404 || err.message?.includes("404")) {
          setProjectData(null);
          setError("Project not found or has been deleted");
          console.warn(`Project ${projectId} not found - likely deleted`);
        } else {
          setError(err instanceof Error ? err.message : "Failed to fetch project data");
          console.error("Failed to fetch project data:", err);
        }
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [projectId],
  );

  const { persistEntity } = useProjectEntityPersistence({
    projectId,
    refresh: refreshProjectData,
    setError,
  });

  // Fetch real project data
  useEffect(() => {
    refreshProjectData();
  }, [refreshProjectData]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const options = await apiService.getUiOptionCatalog();
        if (!mounted || !options) return;

        setUiOptionCatalog((_prev) => {
          const nextCatalog: UiOptionCatalog = { ...options } as UiOptionCatalog;
          if (!nextCatalog.serviceFrameworks) {
            nextCatalog.serviceFrameworks = {};
          }
          return nextCatalog;
        });
      } catch (error) {
        console.warn("[ArchitectureDiagram] failed to load UI option catalog", error);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // Group components by type for rendering

  const groupedComponents: GroupedComponentGroup[] = useMemo(
    () => computeGroupedComponents(projectData, optimisticRemovals),
    [projectData, optimisticRemovals],
  );

  const { openTaskOptions, epicSelectionOptions } = useMemo(() => {
    if (!projectData) {
      return {
        openTaskOptions: [] as EpicTaskOption[],
        epicSelectionOptions: [] as TaskEpicOption[],
      };
    }

    const epicSource = projectData?.spec?.epics ?? projectData?.epics ?? [];
    const epicEntries: Array<{ key: string; value: any; index: number }> = [];

    if (Array.isArray(epicSource)) {
      epicSource.forEach((value, index) => {
        const key =
          (value && typeof value === "object" && (value.id || value.name)) || `epic-${index + 1}`;
        epicEntries.push({ key: String(key), value, index });
      });
    } else if (epicSource && typeof epicSource === "object") {
      Object.entries(epicSource as Record<string, any>).forEach(([key, value], index) => {
        epicEntries.push({ key, value, index });
      });
    }

    const options: EpicTaskOption[] = [];
    const selection: TaskEpicOption[] = [];
    const seenEpics = new Set<string>();
    const seenTasks = new Set<string>();

    epicEntries.forEach(({ key, value, index }) => {
      if (!value && typeof value !== "string") return;

      const epicData = typeof value === "string" ? { id: key, name: value } : { ...value };
      const epicIdRaw = epicData.id ?? key ?? `epic-${index + 1}`;
      const epicId = String(epicIdRaw ?? "").trim() || `epic-${index + 1}`;
      const epicName =
        String(epicData.name ?? epicId ?? `Epic ${index + 1}`).trim() || `Epic ${index + 1}`;

      if (!seenEpics.has(epicId)) {
        selection.push({ id: epicId, name: epicName });
        seenEpics.add(epicId);
      }

      const tasksSource = epicData.tasks ?? [];
      const tasksArray = Array.isArray(tasksSource)
        ? tasksSource
        : tasksSource && typeof tasksSource === "object"
          ? Object.values(tasksSource as Record<string, any>)
          : [];

      tasksArray.forEach((task, taskIndex) => {
        if (!task && typeof task !== "string") return;
        const taskData = typeof task === "string" ? { name: task } : { ...task };
        const taskIdRaw = taskData.id ?? `${epicId}-${taskIndex + 1}`;
        const taskId = String(taskIdRaw ?? "").trim();
        if (!taskId) return;

        const dedupeKey = `${epicId}-${taskId}`;
        if (seenTasks.has(dedupeKey)) {
          return;
        }
        seenTasks.add(dedupeKey);

        const taskName =
          String(taskData.name ?? taskId ?? `Task ${taskIndex + 1}`).trim() || taskId;
        const metadata = (taskData.metadata ?? {}) as Record<string, unknown>;
        const statusCandidates = [taskData.status, taskData.state, metadata.status, metadata.state]
          .map((value) => (typeof value === "string" ? value.toLowerCase() : ""))
          .filter(Boolean);

        const completedFlag =
          taskData.completed === true ||
          taskData.done === true ||
          taskData.isCompleted === true ||
          metadata.completed === true ||
          statusCandidates.includes("completed");

        if (completedFlag) {
          return;
        }

        options.push({
          id: taskId,
          name: taskName,
          epicId,
          epicName,
          status:
            statusCandidates[0] ||
            (typeof taskData.status === "string" ? taskData.status : undefined),
          completed: completedFlag,
        });
      });
    });

    return { openTaskOptions: options, epicSelectionOptions: selection };
  }, [projectData]);

  const optionCatalogWithTasks = useMemo<UiOptionCatalog>(
    () => ({
      ...uiOptionCatalog,
      epicTaskOptions: openTaskOptions,
      taskEpicOptions: epicSelectionOptions,
    }),
    [uiOptionCatalog, openTaskOptions, epicSelectionOptions],
  );

  useEffect(() => {
    if (!projectData || optimisticRemovals.size === 0) {
      return;
    }
    const artifactArray = Array.isArray(projectData?.artifacts)
      ? (projectData.artifacts as Array<unknown>)
      : [];
    const existingIds = new Set<string>();
    artifactArray.forEach((artifactValue) => {
      if (!artifactValue || typeof artifactValue !== "object") {
        return;
      }
      const artifact = artifactValue as Record<string, unknown>;
      const metadataValue = artifact["metadata"];
      const metadata =
        metadataValue && typeof metadataValue === "object"
          ? (metadataValue as Record<string, unknown>)
          : undefined;
      const candidates = [
        artifact["id"],
        artifact["artifactId"],
        artifact["artifact_id"],
        metadata?.["artifactId"],
        metadata?.["artifact_id"],
      ];
      for (const candidate of candidates) {
        if (typeof candidate === "string") {
          const trimmed = candidate.trim();
          if (trimmed) {
            existingIds.add(trimmed);
            break;
          }
        }
      }
    });

    setOptimisticRemovals((prev) => {
      if (prev.size === 0) {
        return prev;
      }
      let shouldUpdate = false;
      const next = new Set<string>();
      prev.forEach((id) => {
        if (existingIds.has(id)) {
          next.add(id);
        } else {
          shouldUpdate = true;
        }
      });
      if (!shouldUpdate) {
        return prev;
      }
      return next;
    });
  }, [projectData, optimisticRemovals]);

  const groupIconMap: Record<string, LucideIcon> = {
    service: Server,
    module: Component,
    tool: Terminal,
    route: Navigation,
    view: Eye,
    database: Database,
    infrastructure: Shield,
    frontend: Layout,
    flow: GitBranch,
    capability: Sparkles,
    epic: Flag,
    task: ListChecks,
  };

  const handleAddEntity = useCallback(
    async (payload: { entityType: string; values: Record<string, FieldValue> }) => {
      const success = await persistEntity({
        entityType: payload.entityType,
        values: payload.values,
      });
      if (success) {
        setAddDialogConfig(null);
      }
    },
    [persistEntity],
  );

  const openAddDialog = useCallback(
    (group: GroupedComponentGroup) => {
      if (onOpenEntityModal) {
        const request: ArchitectureEntityModalRequest = {
          type: group.type,
          label: group.label,
          optionCatalog: optionCatalogWithTasks,
          mode: "create",
          onSubmit: handleAddEntity,
        };

        onOpenEntityModal(request);
        return;
      }

      setAddDialogConfig({ type: group.type, label: group.label });
    },
    [onOpenEntityModal, optionCatalogWithTasks, handleAddEntity],
  );

  const handleEditComponent = useCallback(
    ({ group, item }: { group: GroupedComponentGroup; item: GroupedComponentItem }) => {
      const metadata = (item.data?.metadata ?? {}) as Record<string, unknown>;
      const artifactIdCandidates = [
        item.data?.artifactId,
        item.data?.id,
        metadata?.artifactId,
        metadata?.artifact_id,
        metadata?.entityId,
        metadata?.entity_id,
      ];
      const artifactId =
        artifactIdCandidates
          .find((candidate) => typeof candidate === "string" && candidate.trim().length > 0)
          ?.trim() ?? null;

      const identifierCandidates = [
        metadata?.id,
        metadata?.slug,
        item.data?.slug,
        item.data?.id,
        item.name,
      ];
      const draftIdentifier =
        identifierCandidates
          .map((candidate) => (typeof candidate === "string" ? candidate.trim() : ""))
          .find((candidate) => candidate.length > 0) ?? null;

      const metadataInitialValues = buildInitialValuesFromMetadata(group.type, metadata);
      const initialValues: Record<string, FieldValue> = {
        ...metadataInitialValues,
        name: (item.data?.name as string | undefined)?.trim() || item.name,
      };
      const descriptionValue =
        (typeof item.data?.description === "string" ? item.data.description : undefined) ??
        (typeof metadata?.description === "string" ? (metadata.description as string) : undefined);
      if (descriptionValue && descriptionValue.trim().length > 0) {
        initialValues.description = descriptionValue.trim();
      }

      if (group.type === "epic") {
        const tasksValue = (metadata?.tasks as unknown) ?? item.data?.tasks;
        if (Array.isArray(tasksValue)) {
          const normalizedTasks = tasksValue
            .map((task) => {
              if (typeof task === "string") {
                return task.trim();
              }
              if (task && typeof task === "object") {
                const taskRecord = task as Record<string, unknown>;
                const candidate = taskRecord.id ?? taskRecord.name ?? taskRecord.slug;
                return typeof candidate === "string" ? candidate.trim() : "";
              }
              return "";
            })
            .filter((value) => value.length > 0);
          if (normalizedTasks.length > 0) {
            initialValues.tasks = normalizedTasks;
          }
        }
      }

      const titleOverride =
        initialValues.name && typeof initialValues.name === "string"
          ? `Update ${initialValues.name}`
          : undefined;
      const descriptionOverride = `Modify the ${group.label.toLowerCase()} details and save your changes.`;

      if (onOpenEntityModal) {
        const request: ArchitectureEntityModalRequest = {
          type: group.type,
          label: group.label,
          optionCatalog: optionCatalogWithTasks,
          mode: "edit",
          initialValues,
          ...(titleOverride ? { titleOverride } : {}),
          ...(descriptionOverride ? { descriptionOverride } : {}),
          onSubmit: async ({ entityType, values }) => {
            await persistEntity({
              entityType,
              values,
              artifactId,
              draftIdentifier,
            });
          },
        };
        onOpenEntityModal(request);
      } else {
        console.warn(
          "[ArchitectureDiagram] Edit modal requested but onOpenEntityModal was not provided.",
        );
      }
    },
    [onOpenEntityModal, optionCatalogWithTasks, persistEntity],
  );

  const handleDeleteEntity = useCallback(
    async (artifactId: string, label?: string) => {
      if (!projectId) {
        return;
      }
      if (!artifactId) {
        setError("Unable to delete artifact: missing identifier");
        return;
      }

      const labelPreview = label ? `"${label}"` : "";
      const confirmationMessage = labelPreview
        ? `Delete ${labelPreview} from the architecture?`
        : "Delete this artifact from the architecture?";
      if (typeof window !== "undefined" && !window.confirm(confirmationMessage)) {
        return;
      }

      toggleOptimisticRemoval(artifactId, true);

      try {
        await apiService.deleteProjectEntity(projectId, artifactId);
        queryClient.invalidateQueries({ queryKey: ["projects"] });
        refreshProjectData({ silent: true })
          .then(() => toggleOptimisticRemoval(artifactId, false))
          .catch((refreshError) => {
            console.error(
              "[ArchitectureDiagram] failed to refresh project data after deletion",
              refreshError,
            );
            toggleOptimisticRemoval(artifactId, false);
          });
      } catch (err: any) {
        toggleOptimisticRemoval(artifactId, false);
        console.error("[ArchitectureDiagram] failed to delete entity", err);
        setError(err?.message || "Failed to delete entity");
      }
    },
    [projectId, queryClient, refreshProjectData, toggleOptimisticRemoval],
  );

  // Handle loading state
  if (loading) {
    return <LoadingState className={className} />;
  }

  // Handle error state
  if (error) {
    return (
      <ErrorState error={error} className={className} onRefresh={() => window.location.reload()} />
    );
  }

  const buildPackagesFromGroup = (group: GroupedComponentGroup): FrontendPackage[] => {
    const packages = new Map<string, FrontendPackage>();

    const normalizeEndpoint = (value: unknown): RouteEndpoint => {
      const base = (value ?? {}) as Partial<RouteEndpoint> & {
        method?: string;
        path?: string;
        controller?: string;
        fullPath?: string;
        handler?: string;
        returnType?: string;
        signature?: string;
        documentation?: Partial<RouteEndpoint["documentation"]>;
        parameters?: unknown;
        responses?: unknown;
        tags?: unknown;
        source?: unknown;
      };

      const normalizeParameters = (): RouteEndpoint["parameters"] => {
        if (!Array.isArray(base.parameters)) {
          return [];
        }
        return (base.parameters || []).map((parameter: any) => {
          const param = parameter as Partial<RouteEndpointParameter> & { name?: string };
          const normalized: RouteEndpointParameter = {
            name: String(param.name ?? "").trim() || "param",
            optional: Boolean(param.optional),
          };
          if (param.type !== undefined && param.type !== null) {
            normalized.type = String(param.type);
          }
          if (param.description !== undefined && param.description !== null) {
            normalized.description = String(param.description);
          }
          if (Array.isArray(param.decorators) && param.decorators.length > 0) {
            normalized.decorators = (param.decorators || []).map((dec: any) => String(dec));
          }
          return normalized;
        });
      };

      const normalizeResponses = (): RouteEndpoint["responses"] => {
        if (!Array.isArray(base.responses)) {
          return [];
        }
        return (base.responses || []).map((response: any) => {
          const res = response as Partial<RouteEndpointResponse>;
          const decorator: RouteEndpointResponse["decorator"] =
            res.decorator === "SuccessResponse" ? "SuccessResponse" : "Response";
          const normalized: RouteEndpointResponse = { decorator };
          if (res.status !== undefined && res.status !== null) {
            normalized.status = String(res.status);
          }
          if (res.description !== undefined && res.description !== null) {
            normalized.description = String(res.description);
          }
          return normalized;
        });
      };

      const documentation = (() => {
        const raw = base.documentation;
        if (!raw || typeof raw !== "object") {
          return undefined;
        }
        const payload: RouteEndpointDocumentation = {};
        if ((raw as any).summary !== undefined) {
          payload.summary = String((raw as any).summary);
        }
        if ((raw as any).description !== undefined) {
          payload.description = String((raw as any).description);
        }
        if ((raw as any).returns !== undefined) {
          payload.returns = String((raw as any).returns);
        }
        const remarks = Array.isArray((raw as any).remarks)
          ? (raw as any).remarks.map((entry: unknown) => String(entry))
          : [];
        if (remarks.length > 0) {
          payload.remarks = remarks;
        }
        const examples = Array.isArray((raw as any).examples)
          ? (raw as any).examples.map((entry: unknown) => String(entry))
          : [];
        if (examples.length > 0) {
          payload.examples = examples;
        }
        const deprecatedRaw = (raw as any).deprecated;
        if (typeof deprecatedRaw === "string") {
          payload.deprecated = deprecatedRaw;
        } else if (deprecatedRaw === true) {
          payload.deprecated = true;
        }
        return Object.keys(payload).length > 0 ? payload : undefined;
      })();

      const handler = base.handler ? String(base.handler) : undefined;
      const returnType = base.returnType ? String(base.returnType) : undefined;
      const defaultSignature = `${handler ?? "handler"}()${returnType ? `: ${returnType}` : ""}`;

      const tags = Array.isArray(base.tags) ? base.tags.map((tag: any) => String(tag)) : [];

      const source = (() => {
        const raw = base.source as { line?: unknown } | undefined;
        if (raw && typeof raw.line === "number") {
          return { line: raw.line };
        }
        if (raw && typeof raw.line === "string" && raw.line.trim().length > 0) {
          const parsed = Number.parseInt(raw.line, 10);
          if (!Number.isNaN(parsed)) {
            return { line: parsed };
          }
        }
        return undefined;
      })();

      const endpoint: RouteEndpoint = {
        method: String(base.method ?? "GET").toUpperCase(),
        signature: base.signature ? String(base.signature) : defaultSignature,
        parameters: normalizeParameters(),
        responses: normalizeResponses(),
      };

      if (base.path !== undefined && base.path !== null) {
        endpoint.path = String(base.path);
      }
      if (base.fullPath !== undefined && base.fullPath !== null) {
        endpoint.fullPath = String(base.fullPath);
      }
      if (base.controller !== undefined && base.controller !== null) {
        endpoint.controller = String(base.controller);
      }
      if (handler) {
        endpoint.handler = handler;
      }
      if (returnType) {
        endpoint.returnType = returnType;
      }
      if (documentation) {
        endpoint.documentation = documentation;
      }
      if (tags.length > 0) {
        endpoint.tags = tags;
      }
      if (source) {
        endpoint.source = source;
      }

      return endpoint;
    };

    const formatLabel = (value: string): string => value;

    const splitSegments = (value: string): string[] =>
      value.replace(/^\/+/, "").split("/").filter(Boolean);

    const normalizeRoutePath = (value: unknown): string => {
      if (value === undefined || value === null) return "";
      const trimmed = String(value).trim();
      if (trimmed === "") return "";
      const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
      const collapsed = withLeadingSlash.replace(/\/+/g, "/");
      if (collapsed.length > 1 && /\/+$/.test(collapsed)) {
        return collapsed.replace(/\/+$/, "");
      }
      return collapsed;
    };

    type RouteInfo = {
      routerType: string;
      controllerRelativePath: string;
      fullRoutePath: string;
      baseRoutePath: string;
      routeSegments: string[];
      baseSegments: string[];
      displayLabel: string;
      isBaseRoute: boolean;
    };

    const getRouteIdentifier = (item: GroupedComponentItem): string | undefined => {
      const metadata = item.data.metadata || {};
      const candidate =
        item.data.path ||
        metadata.routePath ||
        metadata.displayLabel ||
        item.data.displayLabel ||
        item.data.name ||
        item.name;
      if (!candidate) {
        return undefined;
      }
      const trimmed = String(candidate).trim();
      return trimmed === "" ? undefined : trimmed;
    };

    const deriveRouteInfo = (item: GroupedComponentItem): RouteInfo => {
      const metadata = item.data.metadata || {};
      const routerType = String(metadata.routerType || item.data.routerType || "").toLowerCase();
      const packageRoot = metadata.packageRoot || metadata.root || "";
      const rawFilePath = metadata.controllerPath || metadata.filePath || item.data.filePath || "";
      const controllerRelativePath = normalizeRelativePath(rawFilePath, packageRoot || "");
      const routeBasePath = normalizeRoutePath(metadata.routeBasePath);
      const routePathCandidate =
        metadata.routePath || metadata.path || item.data.path || getRouteIdentifier(item) || "";
      const normalizedRoutePath = normalizeRoutePath(routePathCandidate);
      const fullRoutePath = normalizedRoutePath || routeBasePath || "/";
      const routeSegments = splitSegments(fullRoutePath);
      const baseSegments = routeBasePath ? splitSegments(routeBasePath) : [];
      const isBaseRoute =
        Boolean(metadata.isBaseRoute) ||
        (baseSegments.length > 0 &&
          routeSegments.length === baseSegments.length &&
          baseSegments.every((segment, index) => routeSegments[index] === segment));
      const metadataDisplayLabel =
        typeof metadata.displayLabel === "string" ? metadata.displayLabel : null;
      const displayLabel =
        metadataDisplayLabel && metadataDisplayLabel.trim().length > 0
          ? metadataDisplayLabel
          : isBaseRoute
            ? "/"
            : fullRoutePath || "/";
      return {
        routerType,
        controllerRelativePath,
        fullRoutePath,
        baseRoutePath: routeBasePath,
        routeSegments,
        baseSegments,
        displayLabel,
        isBaseRoute,
      };
    };

    const ensurePackage = (item: GroupedComponentItem, routeInfo?: RouteInfo): FrontendPackage => {
      const metadata = item.data.metadata || {};
      const filePath = String(metadata.filePath || item.data.filePath || "");
      const packageRoot = metadata.packageRoot || metadata.root || "";
      const rawServiceName = String(
        metadata.serviceDisplayName || metadata.serviceName || metadata.packageName || "",
      ).replace(/^@[^/]+\//, "");
      const routeIdentifier = getRouteIdentifier(item);
      const normalizedServiceName = rawServiceName.trim();

      const metadataPackageName = String(
        metadata.packageName || metadata.serviceDisplayName || metadata.serviceName || "",
      ).trim();

      let packageKey: string | undefined;

      if (group.treeMode === "routes") {
        if (metadataPackageName) {
          packageKey = metadataPackageName;
        } else if (normalizedServiceName) {
          packageKey = normalizedServiceName;
        } else if (routeInfo?.baseRoutePath && routeInfo.baseRoutePath !== "/") {
          packageKey = routeInfo.baseRoutePath;
        } else if (metadata.packageRoot) {
          packageKey = String(metadata.packageRoot);
        } else if (routeInfo?.routeSegments.length) {
          packageKey = routeInfo.routeSegments[0];
        } else if (routeIdentifier) {
          packageKey = routeIdentifier;
        } else {
          packageKey = "/";
        }
      } else {
        packageKey =
          metadataPackageName ||
          normalizedServiceName ||
          metadata.packageName ||
          metadata.root ||
          (filePath.includes("/") ? filePath.split("/")[0] : filePath);
      }

      if (!packageKey) {
        packageKey =
          group.treeMode === "routes" ? routeIdentifier || item.name || "/routes" : group.label;
      }

      const normalizeRoutesPackageKey = (value: string): string => {
        const trimmed = value.trim();
        if (!trimmed) {
          return "/";
        }
        if (trimmed === "/") {
          return "/";
        }
        return trimmed.replace(/^\/+/, "").replace(/\/+$/, "") || trimmed;
      };

      let normalizedPackageKey = String(packageKey || "Routes").trim();
      if (group.treeMode === "routes") {
        normalizedPackageKey = normalizeRoutesPackageKey(normalizedPackageKey);
      }
      if (!normalizedPackageKey) {
        normalizedPackageKey =
          group.treeMode === "routes" ? "/" : formatLabel(group.label || "Group");
      }

      const packageDisplayName =
        group.treeMode === "routes" ? normalizedPackageKey : formatLabel(normalizedPackageKey);

      if (!packages.has(normalizedPackageKey)) {
        const frameworks = new Set<string>();
        if (metadata.framework) {
          frameworks.add(metadata.framework);
        }

        packages.set(normalizedPackageKey, {
          packageName: packageDisplayName,
          packageRoot,
          frameworks: Array.from(frameworks),
          components: [],
          routes: [],
        });
      }

      const pkg = packages.get(normalizedPackageKey)!;
      if (metadata.framework && !pkg.frameworks.includes(metadata.framework)) {
        pkg.frameworks.push(metadata.framework);
      }
      return pkg;
    };

    group.items.forEach((item: GroupedComponentItem) => {
      const metadata = item.data.metadata || {};
      const routeInfo = group.treeMode === "routes" ? deriveRouteInfo(item) : null;
      const pkg = ensurePackage(item, routeInfo ?? undefined);

      if (group.treeMode === "routes" && routeInfo) {
        const info = routeInfo;
        const treeSegments = (() => {
          if (info.isBaseRoute) {
            return [] as string[];
          }
          if (info.routerType === "tsoa" && info.baseSegments.length > 0) {
            const matchesBase = info.baseSegments.every(
              (segment, index) => info.routeSegments[index] === segment,
            );
            if (matchesBase) {
              return info.routeSegments.slice(info.baseSegments.length);
            }
          }
          return info.routeSegments;
        })();
        const treePath = treeSegments.join("/");

        pkg.routes = pkg.routes || [];
        const displayLabel =
          info.routerType === "tsoa" && treeSegments.length > 0
            ? `/${treeSegments.join("/")}`
            : info.displayLabel;
        const routePathForDisplay = info.isBaseRoute ? "/" : info.fullRoutePath;
        const httpMethods = Array.isArray(metadata.httpMethods)
          ? metadata.httpMethods.map((method: unknown) => String(method).toUpperCase())
          : Array.isArray((item.data as any)?.httpMethods)
            ? (item.data as any).httpMethods.map((method: unknown) => String(method).toUpperCase())
            : [];
        const rawEndpoints = Array.isArray(metadata.endpoints) ? metadata.endpoints : [];
        const endpoints = rawEndpoints.map(normalizeEndpoint);
        const routerTypeNormalized = ((metadata.routerType as string) || info.routerType || "")
          .toString()
          .toLowerCase();
        const noiseKeywords = [
          "dockerfile-container",
          "nats-compose",
          "spec-workbench-compose",
          "api-types",
        ];
        const lowerPackageName = pkg.packageName.toLowerCase();
        const lowerDisplayLabel = (displayLabel || "").toLowerCase();
        const lowerRoutePath = (info.fullRoutePath || "").toLowerCase();
        const isNoise =
          !info.isBaseRoute &&
          noiseKeywords.some((keyword) => {
            const lower = keyword.toLowerCase();
            return (
              lowerPackageName.includes(lower) ||
              lowerDisplayLabel.includes(lower) ||
              lowerRoutePath.includes(lower)
            );
          });

        if (isNoise) {
          return;
        }

        const routeMetadata = {
          ...metadata,
          httpMethods,
          endpoints,
        };
        pkg.routes.push({
          path: routePathForDisplay,
          filePath: info.controllerRelativePath,
          treePath,
          routerType: (metadata.routerType as string | undefined) || info.routerType,
          displayLabel: displayLabel || routePathForDisplay,
          httpMethods,
          endpoints,
          metadata: routeMetadata,
          isBaseRoute: info.isBaseRoute,
        });
      } else {
        const filePath = normalizeRelativePath(
          metadata.filePath || item.data.filePath || "",
          pkg.packageRoot || "",
        );
        pkg.components = pkg.components || [];
        pkg.components.push({
          name: item.data.name || item.name,
          filePath,
          framework: metadata.framework || "",
          description: item.data.description || metadata.description,
          props: item.data.props,
        });
      }
    });

    return Array.from(packages.values()).map((pkg) => {
      if (!pkg.components || pkg.components.length === 0) {
        delete pkg.components;
      }
      if (!pkg.routes || pkg.routes.length === 0) {
        delete pkg.routes;
      }
      return pkg;
    });
  };

  return (
    <div
      className={clsx(
        "h-full overflow-auto px-6 py-6 bg-gray-50 dark:bg-graphite-950 scrollbar-transparent",
        className,
      )}
    >
      {groupedComponents.length === 0 ? (
        <EmptyState />
      ) : (
        <div ref={groupListRef} className="space-y-6">
          {groupedComponents.map((group: GroupedComponentGroup) => {
            const icon = groupIconMap[group.type];
            return (
              <SourceGroup
                key={group.label}
                groupLabel={group.label}
                components={group.items}
                groupType={group.type}
                expandedSources={expandedSources}
                setExpandedSources={setExpandedSources}
                onComponentClick={({ name, data }) => {
                  handleEditComponent({ group, item: { name, data } });
                }}
                onAddClick={() => openAddDialog(group)}
                onDeleteComponent={({ artifactId, label }) => handleDeleteEntity(artifactId, label)}
                {...(icon ? { icon } : {})}
              />
            );
          })}
        </div>
      )}

      {addDialogConfig && !onOpenEntityModal && (
        <AddEntityModal
          open
          entityType={addDialogConfig.type}
          groupLabel={addDialogConfig.label}
          optionCatalog={optionCatalogWithTasks}
          onClose={() => setAddDialogConfig(null)}
          mode="create"
          onSubmit={handleAddEntity}
        />
      )}
    </div>
  );
};

export default ArchitectureDiagram;

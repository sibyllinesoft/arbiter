/**
 * @module ArchitectureDiagram/grouping/helpers
 * Helper functions for component grouping, including metadata extraction
 * and path normalization utilities.
 */

import type { FieldValue } from "@/components/modals/entityTypes";
import type { GroupedComponentGroup, TreeMode } from "./types";

/**
 * Configuration for component type display behavior.
 */
interface TypeDisplayConfig {
  label: string;
  layout: "grid" | "tree";
  treeMode?: TreeMode;
}

/**
 * Maps component types to their display configuration.
 */
export const TYPE_CONFIG: Record<string, TypeDisplayConfig> = {
  service: { label: "Services", layout: "grid" },
  frontend: { label: "Frontends", layout: "grid" },
  package: { label: "Packages", layout: "grid" },
  tool: { label: "Tools", layout: "grid" },
  route: { label: "Routes", layout: "grid" },
  view: { label: "Views", layout: "grid" },
  component: { label: "Components", layout: "grid" },
  infrastructure: { label: "Infrastructure", layout: "grid" },
  database: { label: "Databases", layout: "grid" },
  flow: { label: "Flows", layout: "grid" },
  capability: { label: "Capabilities", layout: "grid" },
  group: { label: "Groups", layout: "grid" },
  task: { label: "Tasks", layout: "grid" },
  other: { label: "Other", layout: "grid" },
};

/**
 * Regex pattern to identify CUE files for exclusion.
 */
export const CUE_FILE_REGEX = /\.cue$/i;

/**
 * Gets the display configuration for a component type.
 */
export const getTypeConfig = (type: string): TypeDisplayConfig =>
  TYPE_CONFIG[type] ?? TYPE_CONFIG.other;

/**
 * Converts unknown value to lowercase string.
 */
export const toLowerString = (value: unknown): string => String(value || "").toLowerCase();

/**
 * Stringifies a list entry for metadata display.
 */
export const stringifyListEntry = (entry: unknown): string => {
  if (typeof entry === "string") return entry;
  if (entry === null || entry === undefined) return "";
  try {
    return JSON.stringify(entry);
  } catch {
    return String(entry);
  }
};

/**
 * Normalizes file paths relative to a package root directory.
 * @param filePath - The file path to normalize
 * @param packageRoot - The root directory to make paths relative to
 * @returns Normalized relative path
 */
export const normalizeRelativePath = (
  filePath: string | undefined,
  packageRoot: string,
): string => {
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

/**
 * Builds initial form values from entity metadata for editing.
 * @param entityType - The type of entity being edited
 * @param metadataInput - Raw metadata from the entity
 * @returns Record of field values for the edit form
 */
export const buildInitialValuesFromMetadata = (
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

  if (entityType === "package") {
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

/**
 * Determines the component type based on metadata analysis.
 * @param data - Component data to analyze
 * @param name - Component name for fallback detection
 * @returns Detected component type string
 */
export const getComponentType = (data: any, name: string): string => {
  const rawType = toLowerString(data.type || data.metadata?.type);
  const language = toLowerString(data.metadata?.language);
  const framework = toLowerString(data.metadata?.framework);
  const detectedType = toLowerString(data.metadata?.detectedType);

  if (detectedType === "tool" || detectedType === "build_tool") return "tool";
  if (detectedType === "frontend" || detectedType === "mobile") return "frontend";
  if (detectedType === "web_service") return "service";

  if (rawType.includes("service")) return "service";
  if (["package", "module", "library"].includes(rawType)) return "package";
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

  if (name.includes("@")) return "package";

  return "component";
};

/**
 * Checks if an item should be excluded from diagram display.
 * @param item - Item to check for exclusion
 * @param isRemovedFn - Optional function to check if item was removed
 * @returns True if item should be excluded
 */
export const shouldExcludeFromDiagram = (
  item: any,
  isRemovedFn?: (item: any) => boolean,
): boolean => {
  if (isRemovedFn && isRemovedFn(item)) {
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

/**
 * Enriches data with type information for grouping.
 * @param data - Original data to enrich
 * @param enforcedType - Type to assign if none exists
 * @returns Enriched data object
 */
export const enrichDataForGrouping = (data: any, enforcedType: string) => ({
  ...data,
  type: data.type || enforcedType,
  metadata: {
    ...(data.metadata || {}),
  },
});

/**
 * Resolves artifact ID from various metadata sources.
 * @param item - Item to extract artifact ID from
 * @returns Artifact ID string or undefined
 */
export const resolveArtifactId = (item: unknown): string | undefined => {
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

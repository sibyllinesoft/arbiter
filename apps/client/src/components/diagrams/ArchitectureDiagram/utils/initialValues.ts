import type { FieldValue } from "@/components/modals/entityTypes";

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

import { coerceOptionalTrimmedString, coerceStringArray, hasOwn } from "./shared";
/**
 * Package artifact payload builder
 */
import type { ManualArtifactPayload } from "./types";

/**
 * Build data-schema metadata fields.
 */
function buildDataSchemaMetadata(
  values: Record<string, any>,
  metadata: Record<string, unknown>,
): void {
  const schemaEngine = coerceOptionalTrimmedString(values.schemaEngine);
  const schemaVersion = coerceOptionalTrimmedString(values.schemaVersion);
  const schemaOwner = coerceOptionalTrimmedString(values.schemaOwner);
  const schemaTables = hasOwn(values, "schemaTables")
    ? coerceStringArray(values.schemaTables)
    : undefined;

  if (schemaEngine || schemaVersion || schemaOwner || schemaTables) {
    const schema: Record<string, unknown> = {};
    if (schemaEngine) schema.engine = schemaEngine;
    if (schemaVersion) schema.version = schemaVersion;
    if (schemaOwner) schema.owner = schemaOwner;
    if (schemaTables?.length) schema.tables = schemaTables;
    else if (hasOwn(values, "schemaTables")) schema.tables = [];
    if (Object.keys(schema).length > 0) metadata.schema = schema;
  }
}

/**
 * Build documentation metadata fields.
 */
function buildDocumentationMetadata(
  values: Record<string, any>,
  metadata: Record<string, unknown>,
): void {
  const docFormat = coerceOptionalTrimmedString(values.docFormat);
  const docVersion = coerceOptionalTrimmedString(values.docVersion);
  const docSource = coerceOptionalTrimmedString(values.docSource);
  if (docFormat || docVersion || docSource) {
    const api: Record<string, unknown> = {};
    if (docFormat) api.format = docFormat;
    if (docVersion) api.version = docVersion;
    if (docSource) api.source = docSource;
    metadata.api = api;
  }
}

/**
 * Build runbook metadata fields.
 */
function buildRunbookMetadata(
  values: Record<string, any>,
  metadata: Record<string, unknown>,
): void {
  const runbookName = coerceOptionalTrimmedString(values.runbookName);
  const runbookPath = coerceOptionalTrimmedString(values.runbookPath);
  if (runbookName || runbookPath) {
    const runbook: Record<string, unknown> = {};
    if (runbookName) runbook.name = runbookName;
    if (runbookPath) runbook.path = runbookPath;
    metadata.runbook = runbook;
  }
}

/**
 * Build performance metadata fields.
 */
function buildPerformanceMetadata(
  values: Record<string, any>,
  metadata: Record<string, unknown>,
): void {
  const slaUptime = coerceOptionalTrimmedString(values.slaUptime);
  const slaP95 = coerceOptionalTrimmedString(values.slaP95);
  const slaP99 = coerceOptionalTrimmedString(values.slaP99);
  if (slaUptime || slaP95 || slaP99) {
    metadata.config = {
      sla: {
        ...(slaUptime ? { uptime: slaUptime } : {}),
        ...(slaP95
          ? { p95ResponseMs: Number.isNaN(Number(slaP95)) ? slaP95 : Number(slaP95) }
          : {}),
        ...(slaP99
          ? { p99ResponseMs: Number.isNaN(Number(slaP99)) ? slaP99 : Number(slaP99) }
          : {}),
      },
    };
  }
}

/**
 * Build package artifact payload with module type and deliverables.
 */
export function buildPackagePayload(
  values: Record<string, any>,
  _slug: string,
  name: string,
  description: string | null,
): ManualArtifactPayload {
  const moduleType = coerceOptionalTrimmedString(values.moduleType);
  const owner = coerceOptionalTrimmedString(values.owner);
  const kind = coerceOptionalTrimmedString(values.kind);
  const deliverables = hasOwn(values, "deliverables")
    ? coerceStringArray(values.deliverables)
    : undefined;
  const flowSteps = hasOwn(values, "flowSteps") ? coerceStringArray(values.flowSteps) : undefined;

  const metadata: Record<string, unknown> = {
    description,
    classification: { detectedType: "package", reason: "manual-entry", source: "user" },
  };

  if (moduleType) metadata.moduleType = moduleType;
  if (owner) metadata.owner = owner;
  if (kind) metadata.kind = kind;
  if (hasOwn(values, "deliverables")) metadata.deliverables = deliverables ?? [];
  else if (deliverables && deliverables.length > 0) metadata.deliverables = deliverables;
  if (moduleType === "flow" && hasOwn(values, "flowSteps")) metadata.steps = flowSteps ?? [];

  // Handle type-specific metadata
  if (moduleType === "data-schema") buildDataSchemaMetadata(values, metadata);
  if (moduleType === "documentation") buildDocumentationMetadata(values, metadata);
  if (moduleType === "runbook") buildRunbookMetadata(values, metadata);
  if (moduleType === "performance") buildPerformanceMetadata(values, metadata);

  return { name, description, artifactType: "package", metadata };
}

/**
 * @packageDocumentation
 * Service metadata resolution utilities.
 *
 * Provides functions for resolving service workload types and
 * artifact types from service configuration.
 */

import type { PackageConfig } from "@arbiter/specification";

/** Service artifact type indicating internal or external origin. */
type ArtifactType = "internal" | "external";
/** Generic service record type. */
type ServiceRecord = Record<string, unknown>;

/** Valid workload type values. */
const WORKLOAD_VALUES = new Set(["deployment", "statefulset", "daemonset", "job", "cronjob"]);
/** Field names to check for workload type. */
const WORKLOAD_FIELD_CANDIDATES = [
  "workload",
  "mode",
  "runtime",
  "execution",
  "deploymentKind",
  "type",
] as const;

/**
 * Check if a value is a valid workload type.
 * @param value - Value to check
 * @returns True if value is a valid workload string
 */
function isWorkload(value: unknown): value is string {
  return typeof value === "string" && WORKLOAD_VALUES.has(value);
}

/**
 * Get a field value from a service record.
 * @param service - Service record
 * @param field - Field name to retrieve
 * @returns Field value or undefined
 */
function getFieldValue(service: ServiceRecord, field: string): unknown {
  return service[field];
}

/**
 * Find workload type from candidate field names.
 * @param service - Service record to check
 * @returns Workload type or undefined
 */
function findWorkloadFromCandidates(service: ServiceRecord): string | undefined {
  for (const field of WORKLOAD_FIELD_CANDIDATES) {
    const value = getFieldValue(service, field);
    if (isWorkload(value)) return value;
  }
  return undefined;
}

/**
 * Resolve the workload type for a service.
 * @param service - Service configuration
 * @returns Workload type or undefined
 */
export function resolveServiceWorkload(
  service: Partial<PackageConfig> | undefined,
): string | undefined {
  if (!service) return undefined;
  return findWorkloadFromCandidates(service as ServiceRecord);
}

/**
 * Get explicit artifact type from service fields.
 * @param service - Service record
 * @returns Explicit type or undefined
 */
function getExplicitType(service: ServiceRecord): string | undefined {
  if (typeof service.external === "boolean") {
    return service.external ? "external" : "internal";
  }
  // Check explicit type/artifactType fields
  if (service.type === "external" || service.type === "internal") {
    return service.type;
  }
  if (service.artifactType === "external" || service.artifactType === "internal") {
    return service.artifactType as string;
  }
  return undefined;
}

/**
 * Resolve artifact type from source kind field.
 * @param source - Source record with kind field
 * @returns Artifact type or undefined
 */
function resolveFromSourceKind(source: ServiceRecord): ArtifactType | undefined {
  const kind = String(source.kind || "").toLowerCase();
  if (kind === "monorepo") return "internal";
  if (kind) return "external";
  return undefined;
}

/**
 * Resolve artifact type from service source object.
 * @param service - Service record with potential source
 * @returns Artifact type or undefined
 */
function resolveFromSourceObject(service: ServiceRecord): ArtifactType | undefined {
  const source = service.source as ServiceRecord | undefined;
  if (!source || typeof source !== "object") return undefined;
  return resolveFromSourceKind(source);
}

/**
 * Resolve artifact type from service fields.
 * @param service - Service record
 * @returns Artifact type (defaults to internal)
 */
function resolveFromFields(service: ServiceRecord): ArtifactType {
  if (service.sourceDirectory) return "internal";
  if (service.image && !service.source) return "external";
  return "internal";
}

/**
 * Resolve the artifact type for a service.
 * @param service - Service configuration
 * @returns Artifact type (internal or external)
 */
export function resolveServiceArtifactType(
  service: Partial<PackageConfig> | undefined,
): ArtifactType {
  if (!service) return "internal";

  const explicit = getExplicitType(service as ServiceRecord);
  if (explicit === "internal" || explicit === "external") return explicit;

  const fromSource = resolveFromSourceObject(service as ServiceRecord);
  if (fromSource) return fromSource;

  return resolveFromFields(service as ServiceRecord);
}

/**
 * Check if a service is internal.
 * @param service - Service configuration
 * @returns True if service is internal
 */
export function isInternalService(service: Partial<PackageConfig> | undefined): boolean {
  if (!service) return true;
  if (typeof (service as any).external === "boolean") {
    return !(service as any).external;
  }
  // Check explicit type field
  if ((service as any).type === "external") return false;
  if ((service as any).type === "internal") return true;
  return resolveServiceArtifactType(service) === "internal";
}

/**
 * Ensure a workload type is resolved with a fallback.
 * @param service - Service configuration
 * @param fallback - Fallback workload type
 * @returns Resolved or fallback workload type
 */
export function ensureWorkload(service: Partial<PackageConfig>, fallback: string): string {
  return resolveServiceWorkload(service) ?? fallback;
}

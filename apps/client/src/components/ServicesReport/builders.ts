/**
 * Builder functions for constructing form initial values from service data.
 * These helpers transform normalized service and endpoint data into form-ready structures.
 */
import type { FieldValue } from "@/components/modals/entityTypes";
import { buildEnvironmentMap } from "@/features/spec/transformers/services";
import type { KeyValueEntry } from "@amalto/key-value-editor";
import type { ExternalArtifactCard, NormalizedEndpointCard, NormalizedService } from "./types";

/** Get a string value from a candidate if valid */
function getStringValue(candidate: unknown): string | undefined {
  return typeof candidate === "string" && candidate.trim().length > 0
    ? candidate.trim()
    : undefined;
}

/** Get the first truthy string value from multiple candidates */
function getFirstString(...candidates: unknown[]): string | undefined {
  for (const candidate of candidates) {
    const value = getStringValue(candidate);
    if (value) return value;
  }
  return undefined;
}

/** Get the first truthy string with a fallback */
function getStringWithFallback(fallback: string, ...candidates: unknown[]): string {
  return getFirstString(...candidates) ?? fallback;
}

/** Extract HTTP method from data */
function extractHttpMethod(
  data: Record<string, unknown>,
  metadata: Record<string, unknown>,
): string {
  const httpMethods = Array.isArray(data.httpMethods)
    ? data.httpMethods
    : Array.isArray(metadata?.httpMethods)
      ? metadata.httpMethods
      : [];
  const methodCandidate = httpMethods.find((v) => typeof v === "string") as string | undefined;
  return methodCandidate ? methodCandidate.toUpperCase() : "GET";
}

/** Extract tags from metadata */
function extractTags(metadata: Record<string, unknown>): string[] {
  const rawTags = metadata.tags;
  if (Array.isArray(rawTags)) {
    return rawTags.filter((tag): tag is string => typeof tag === "string");
  }
  if (typeof rawTags === "string") {
    return rawTags
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
  }
  return [];
}

/** Extract metadata object from service raw data */
function extractServiceMetadata(service: NormalizedService): Record<string, unknown> {
  if (
    service.raw &&
    typeof service.raw === "object" &&
    service.raw.metadata &&
    typeof service.raw.metadata === "object"
  ) {
    return service.raw.metadata as Record<string, unknown>;
  }
  return {};
}

/** Build initial form values from an endpoint card */
export function buildEndpointInitialValues(
  endpoint: NormalizedEndpointCard,
): Record<string, FieldValue> {
  const data = (endpoint.data ?? {}) as Record<string, unknown>;
  const metadata = (data.metadata ?? {}) as Record<string, unknown>;

  const method = extractHttpMethod(data, metadata);
  const path = getStringWithFallback("/", data.path, metadata.routePath, metadata.path);
  const summary = getFirstString(metadata.summary, data.name) ?? "";
  const description = getFirstString(data.description, metadata.description) ?? "";
  const operationId = getFirstString(metadata.operationId) ?? "";
  const tags = extractTags(metadata);
  const artifactId = getFirstString(metadata.artifactId, metadata.artifact_id, data.artifactId);

  const initialValues: Record<string, FieldValue> = {
    method,
    path,
    summary,
    description,
    operationId,
    tags,
  };

  if (artifactId) {
    initialValues.artifactId = artifactId;
  }

  return initialValues;
}

/** Build initial form values from a normalized service */
export function buildServiceInitialValues(service: NormalizedService): Record<string, FieldValue> {
  const metadata = extractServiceMetadata(service);
  const languageFromItems = service.metadataItems.find((item) => item.label === "Language")?.value;
  const frameworkFromItems = service.metadataItems.find(
    (item) => item.label === "Technology",
  )?.value;

  const values: Record<string, FieldValue> = {
    name: service.displayName || service.identifier,
  };

  const description = getFirstString(service.description, metadata.description);
  if (description) {
    values.description = description;
  }

  const language = getFirstString(service.raw?.language, metadata.language, languageFromItems);
  if (language) {
    values.language = language;
  }

  const framework = getFirstString(
    service.raw?.framework,
    service.raw?.technology,
    metadata.framework,
    frameworkFromItems,
  );
  if (framework) {
    values.framework = framework;
  }

  const environmentMap =
    service.environment && Object.keys(service.environment).length > 0
      ? service.environment
      : buildEnvironmentMap(service.raw);
  const environmentPairs: KeyValueEntry[] = Object.entries(environmentMap).map(([key, value]) => ({
    key,
    value: typeof value === "string" ? value : value != null ? String(value) : "",
  }));
  if (environmentPairs.length > 0) {
    values.environmentVariables = environmentPairs;
  }

  return values;
}

/** Build initial form values from an external artifact card */
export function buildExternalServiceInitialValues(
  card: ExternalArtifactCard,
): Record<string, FieldValue> {
  const metadata =
    card.data?.metadata && typeof card.data.metadata === "object"
      ? (card.data.metadata as Record<string, unknown>)
      : {};

  const values: Record<string, FieldValue> = {
    name: card.name,
  };

  const description = getFirstString(card.data?.description);
  if (description) {
    values.description = description;
  }

  const language = getFirstString(card.data?.language, metadata.language);
  if (language) {
    values.language = language;
  }

  const framework = getFirstString(card.data?.framework, metadata.framework);
  if (framework) {
    values.framework = framework;
  }

  return values;
}

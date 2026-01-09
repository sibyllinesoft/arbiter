/**
 * Endpoint normalization utilities for service transformers.
 * Extracted from services.ts for better modularity and reduced complexity.
 */

import type { NormalizedEndpointCard } from "@/components/ServicesReport/types";

type RawData = Record<string, unknown>;

interface EndpointInput {
  method?: string;
  path?: string;
  description?: string;
}

interface EndpointRegistry {
  endpoints: NormalizedEndpointCard[];
  seen: Set<string>;
  serviceKey: string;
}

/** Get trimmed string or undefined */
function getTrimmedString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** Extract artifact ID from endpoint data */
function extractArtifactIdFromEndpoint(endpoint: RawData): string | undefined {
  const candidates = [
    endpoint?.artifactId,
    endpoint?.artifact_id,
    endpoint?.id,
    endpoint?.entityId,
    endpoint?.entity_id,
    (endpoint?.metadata as RawData)?.artifactId,
    (endpoint?.metadata as RawData)?.artifact_id,
  ];
  return candidates.find((v): v is string => typeof v === "string");
}

/** Register a single endpoint in the registry */
function registerEndpoint(
  registry: EndpointRegistry,
  input: EndpointInput,
  sourceEndpoint?: RawData,
): void {
  const method = getTrimmedString(input.method)?.toUpperCase();
  const path = getTrimmedString(input.path);
  const description = getTrimmedString(input.description);
  const label = method && path ? `${method} ${path}` : (path ?? method ?? "Endpoint");
  const key = `${method ?? "any"}|${path ?? label}`.toLowerCase();

  if (registry.seen.has(key)) return;
  registry.seen.add(key);

  const cardData: RawData = {
    name: label,
    description,
    metadata: {
      type: "route",
      httpMethods: method ? [method] : undefined,
      routePath: path,
      description,
    },
    path,
    httpMethods: method ? [method] : undefined,
  };

  const artifactId = sourceEndpoint ? extractArtifactIdFromEndpoint(sourceEndpoint) : undefined;
  if (artifactId) {
    cardData.artifactId = artifactId;
    (cardData.metadata as RawData).artifactId = artifactId;
  }

  registry.endpoints.push({
    key: `${registry.serviceKey}-endpoint-${registry.endpoints.length + 1}`,
    name: label,
    data: cardData,
  });
}

/** Parse and register a single endpoint entry */
function parseEndpointEntry(registry: EndpointRegistry, entry: unknown): void {
  if (!entry) return;

  if (typeof entry === "string") {
    const trimmed = entry.trim();
    if (trimmed) registerEndpoint(registry, { path: trimmed });
    return;
  }

  if (typeof entry === "object") {
    const obj = entry as RawData;
    registerEndpoint(
      registry,
      {
        method: getTrimmedString(obj.method ?? obj.httpMethod ?? obj.verb ?? obj.type),
        path: getTrimmedString(obj.path ?? obj.route ?? obj.url ?? obj.pattern),
        description: getTrimmedString(obj.description ?? obj.summary ?? obj.docs),
      },
      obj,
    );
  }
}

/** Process array or object endpoint sources */
function processEndpointSources(registry: EndpointRegistry, raw: RawData): void {
  const sources = [raw?.endpoints, raw?.routes, raw?.metadata?.endpoints, raw?.metadata?.routes];

  for (const source of sources) {
    if (!source) continue;
    const entries = Array.isArray(source) ? source : Object.values(source);
    entries.forEach((entry) => parseEndpointEntry(registry, entry));
  }
}

/** Process OpenAPI paths format */
function processOpenApiPaths(registry: EndpointRegistry, raw: RawData): void {
  const paths = raw?.openapi?.paths ?? raw?.openApi?.paths ?? raw?.metadata?.openapi?.paths;
  if (!paths || typeof paths !== "object") return;

  for (const [pathKey, methods] of Object.entries(paths)) {
    if (!methods || typeof methods !== "object") continue;

    for (const [methodKey, config] of Object.entries(methods as RawData)) {
      if (!methodKey) continue;
      registerEndpoint(registry, {
        method: getTrimmedString(methodKey),
        path: getTrimmedString(pathKey),
        description: getTrimmedString(
          (config as RawData)?.summary ?? (config as RawData)?.description,
        ),
      });
    }
  }
}

/** Process fallback metadata format */
function processFallbackMetadata(registry: EndpointRegistry, raw: RawData): void {
  if (registry.endpoints.length > 0) return;

  const metadata = raw?.metadata as RawData | undefined;
  if (!metadata?.httpMethods || !metadata?.routePath) return;

  const methods = Array.isArray(metadata.httpMethods)
    ? metadata.httpMethods
    : [metadata.httpMethods];
  const routePath = getTrimmedString(metadata.routePath);

  for (const method of methods) {
    const trimmedMethod = getTrimmedString(method);
    if (trimmedMethod) {
      registerEndpoint(registry, { method: trimmedMethod, path: routePath });
    }
  }
}

/** Normalize endpoints from raw service data */
export function normalizeEndpoints(
  raw: RawData | undefined,
  serviceKey: string,
): NormalizedEndpointCard[] {
  if (!raw) return [];

  const registry: EndpointRegistry = {
    endpoints: [],
    seen: new Set<string>(),
    serviceKey,
  };

  processEndpointSources(registry, raw);
  processOpenApiPaths(registry, raw);
  processFallbackMetadata(registry, raw);

  return registry.endpoints;
}

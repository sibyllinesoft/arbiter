import type {
  ExternalArtifactCard,
  NormalizedService,
  ServiceMetadataItem,
} from "@/components/ServicesReport/types";
import {
  collectPorts,
  deriveArtifactIdFromRaw,
  resolveSourcePath,
} from "@/features/spec/utils/services";
import { type EnvironmentMap, mergeEnvironmentSources } from "@/utils/environment";
import { Boxes, Folder, Languages, Network, Workflow } from "lucide-react";
import { normalizeEndpoints } from "./endpoint-normalizer";

type RawData = Record<string, unknown>;

function getTrimmedString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function getFirstTrimmed(...values: unknown[]): string | undefined {
  for (const value of values) {
    const result = getTrimmedString(value);
    if (result) return result;
  }
  return undefined;
}

function extractFromRawOrMetadata(
  raw: RawData | undefined,
  key: string,
  metadataKey?: string,
): string | undefined {
  const metadata = raw?.metadata as RawData | undefined;
  return getFirstTrimmed(raw?.[key], metadata?.[metadataKey ?? key]);
}

export const buildEnvironmentMap = (raw: any): EnvironmentMap => {
  if (!raw || typeof raw !== "object") return {};

  return mergeEnvironmentSources(
    raw.environment,
    raw.env,
    raw.config?.environment,
    raw.metadata?.environment,
    raw.metadata?.config?.environment,
  );
};

export const extractTypeLabel = (raw: any): string | undefined => {
  const metadataType = getTrimmedString(raw?.metadata?.type);
  if (metadataType) return metadataType.replace(/_/g, " ");

  const type = getTrimmedString(raw?.type);
  if (type) return type.replace(/_/g, " ");

  return undefined;
};

// Re-export normalizeEndpoints from the extracted module
export { normalizeEndpoints } from "./endpoint-normalizer";

export const normalizeService = (key: string, raw: any): NormalizedService => {
  const metadata =
    raw?.metadata && typeof raw.metadata === "object" ? (raw.metadata as RawData) : {};
  const identifier = key.trim() || raw?.id || raw?.slug || raw?.name || "service";
  const displayName = getFirstTrimmed(raw?.name, raw?.title) ?? identifier;
  const description = getFirstTrimmed(raw?.description, metadata.description);

  const language = extractFromRawOrMetadata(raw, "language");
  const framework = getFirstTrimmed(raw?.technology, raw?.framework, metadata.framework);

  const { path: sourcePath, hasSource } = resolveSourcePath(raw);
  const ports = collectPorts(raw);
  const environmentMap = buildEnvironmentMap(raw);
  const envCount = Object.keys(environmentMap).length;

  /** Build metadata items from available service properties */
  const metadataItems: ServiceMetadataItem[] = [
    { label: "Language", value: language, icon: Languages },
    { label: "Technology", value: framework, icon: Workflow },
    { label: "Source", value: sourcePath, icon: Folder },
    { label: "Ports", value: ports, icon: Network },
    { label: "Env Vars", value: envCount > 0 ? String(envCount) : undefined, icon: Boxes },
  ].filter((item): item is ServiceMetadataItem => item.value !== undefined);

  const endpoints = normalizeEndpoints(raw, identifier);
  const typeLabel = extractTypeLabel(raw);
  const artifactId = deriveArtifactIdFromRaw(raw);
  const environment = envCount > 0 ? environmentMap : undefined;

  return {
    key: identifier,
    identifier,
    displayName,
    description,
    metadataItems,
    endpoints,
    hasSource,
    ...(typeLabel && { typeLabel }),
    raw: raw ?? null,
    artifactId: artifactId ?? null,
    ...(sourcePath && { sourcePath }),
    ...(environment && { environment }),
  };
};

export const createExternalArtifactCard = (key: string, raw: any): ExternalArtifactCard => {
  const displayName = getFirstTrimmed(raw?.name, raw?.metadata?.displayName) ?? key;
  const description = getFirstTrimmed(raw?.description, raw?.metadata?.description);
  const language = extractFromRawOrMetadata(raw, "language");
  const framework = getFirstTrimmed(
    raw?.technology,
    raw?.framework,
    raw?.metadata?.framework,
    raw?.image,
  );
  const routePath = collectPorts(raw) || raw?.metadata?.routePath || raw?.path;

  const data: RawData = {
    name: displayName,
    description,
    language,
    metadata: {
      ...(raw?.metadata ?? {}),
      type: raw?.metadata?.type ?? raw?.type ?? "external-service",
      language,
      framework: raw?.image ? (framework ?? raw.image) : framework,
      routePath,
    },
    path: routePath,
    framework,
  };

  return { key, name: displayName, data };
};

/** Valid container scope types that should be treated as external cards */
const CONTAINER_SERVICE_SCOPES = new Set(["service", "job", "worker", "external"]);

/** Check if container scope qualifies as a service */
const isServiceScope = (container: RawData): boolean => {
  const scope = getTrimmedString(container.scope)?.toLowerCase() ?? "";
  return CONTAINER_SERVICE_SCOPES.has(scope);
};

/** Create external card data from container */
const createContainerCardData = (container: RawData, name: string): RawData => ({
  name,
  description:
    getTrimmedString(container.description) ?? `Container image ${container.image ?? "unknown"}`,
  metadata: {
    type: "external-service",
    framework: getTrimmedString(container.image),
    routePath: collectPorts(container),
  },
  path: collectPorts(container),
  framework: container.image,
});

export const normalizeContainersAsExternalCards = (
  containers: any[] | undefined,
  knownIdentifiers: Set<string>,
): ExternalArtifactCard[] => {
  if (!Array.isArray(containers)) return [];

  return containers
    .map((container, index) => {
      if (!container || !isServiceScope(container)) return null;

      const name = getFirstTrimmed(container.name, container.id) ?? `container-${index + 1}`;
      if (knownIdentifiers.has(name)) return null;

      return { key: `container-${name}`, name, data: createContainerCardData(container, name) };
    })
    .filter((card): card is ExternalArtifactCard => card !== null);
};

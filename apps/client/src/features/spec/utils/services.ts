/**
 * Service utility functions for path resolution, port collection, and artifact identification.
 * These helpers are used when processing service specifications from CUE assemblies.
 */
import { PATH_PRIORITY_CANDIDATES } from "./serviceConstants";

/** Convert a string to a URL-safe slug */
export const slugify = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** Build a unique identifier for an endpoint draft */
export const buildEndpointDraftIdentifier = (
  serviceId: string,
  method: string,
  path: string,
): string => slugify(`${serviceId}-${method || "any"}-${path || "endpoint"}`);

/** Code file extensions for TypeScript/JavaScript */
const TS_JS_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"];

/** Code file extensions for other languages */
const OTHER_CODE_EXTENSIONS = [".py", ".go", ".rs", ".java"];

/** Directory patterns indicating source code */
const SOURCE_DIRECTORIES = ["src/", "services/", "apps/", "packages/"];

/** Service-related path patterns */
const SERVICE_PATTERNS = ["/service", "-service"];

/** Check if a path has a code file extension */
const hasCodeExtension = (lower: string): boolean =>
  TS_JS_EXTENSIONS.some((ext) => lower.endsWith(ext)) ||
  OTHER_CODE_EXTENSIONS.some((ext) => lower.endsWith(ext));

/** Check if a path contains source directory patterns */
const hasSourceDirectory = (lower: string): boolean =>
  SOURCE_DIRECTORIES.some((dir) => lower.includes(dir));

/** Check if a path contains service patterns */
const hasServicePattern = (lower: string): boolean =>
  SERVICE_PATTERNS.some((pattern) => lower.includes(pattern));

/** Check if a path likely points to source code based on extension or directory patterns */
export const isLikelyCodePath = (value: string): boolean => {
  const lower = value.toLowerCase();
  if (!lower) return false;
  return hasCodeExtension(lower) || hasSourceDirectory(lower) || hasServicePattern(lower);
};

/** Check if a path is absolute (Unix or Windows format) */
export const isAbsolutePath = (value: string): boolean => {
  if (!value) return false;
  return value.startsWith("/") || /^[a-z]:[\\/]/i.test(value);
};

/** Check if a path potentially points to source code (code file or relative path) */
export const isPotentialSourcePath = (value: string): boolean => {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (isLikelyCodePath(trimmed)) {
    return true;
  }
  if (trimmed.startsWith("./") || trimmed.startsWith("../") || trimmed.startsWith(".\\")) {
    return true;
  }
  return false;
};

/** Docker file patterns */
const DOCKER_FILE_PATTERNS = ["dockerfile", "docker-compose", "compose.yml", "compose.yaml"];

/** Docker directory patterns */
const DOCKER_DIR_PATTERNS = ["/docker/", "/compose/"];
const DOCKER_DIR_STARTS = ["docker/", "compose/"];
const DOCKER_DIR_ENDS = ["/compose"];

/** Helm/chart patterns */
const HELM_PATTERNS = ["/helm/", "/charts/", "/chart/"];
const HELM_ENDS = ["/chart"];

/** Check if path matches Docker file patterns */
const matchesDockerFile = (normalized: string): boolean =>
  DOCKER_FILE_PATTERNS.some((p) => normalized.includes(p)) ||
  normalized.endsWith(".yaml") ||
  normalized.endsWith(".yml");

/** Check if path matches Docker directory patterns */
const matchesDockerDir = (normalized: string): boolean =>
  DOCKER_DIR_PATTERNS.some((p) => normalized.includes(p)) ||
  DOCKER_DIR_STARTS.some((p) => normalized.startsWith(p)) ||
  DOCKER_DIR_ENDS.some((p) => normalized.endsWith(p));

/** Check if path matches Helm patterns */
const matchesHelmDir = (normalized: string): boolean =>
  HELM_PATTERNS.some((p) => normalized.includes(p)) ||
  HELM_ENDS.some((p) => normalized.endsWith(p));

/** Check if a path points to infrastructure configuration (Docker, Helm, etc.) */
export const isInfrastructurePath = (value: string): boolean => {
  const normalized = value.toLowerCase().replace(/\\/g, "/");
  if (!normalized) return false;
  return (
    matchesDockerFile(normalized) || matchesDockerDir(normalized) || matchesHelmDir(normalized)
  );
};

/** Extract artifact ID from raw service data, checking multiple field locations */
export const deriveArtifactIdFromRaw = (raw: any): string | null => {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const metadata =
    raw.metadata && typeof raw.metadata === "object"
      ? (raw.metadata as Record<string, unknown>)
      : {};
  const candidates = [
    raw.artifactId,
    raw.artifact_id,
    raw.entityId,
    raw.entity_id,
    metadata.artifactId,
    metadata.artifact_id,
    metadata.entityId,
    metadata.entity_id,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }
  return null;
};

/** Check if a key looks like a path-related field */
const isPathLikeKey = (key: string): boolean => {
  const normalizedKey = key.toLowerCase();
  return (
    normalizedKey.includes("path") ||
    normalizedKey.includes("root") ||
    normalizedKey.includes("file") ||
    normalizedKey.includes("directory")
  );
};

/** Add trimmed string value to set if valid */
const addIfValidString = (paths: Set<string>, value: unknown): void => {
  if (typeof value === "string" && value.trim()) {
    paths.add(value.trim());
  }
};

/** Extract paths from an object using priority candidate keys */
const extractPriorityPaths = (
  obj: Record<string, unknown> | undefined,
  paths: Set<string>,
): void => {
  if (!obj) return;
  PATH_PRIORITY_CANDIDATES.forEach((key) => addIfValidString(paths, obj[key]));
};

/** Extract paths from metadata object based on path-like key names */
const extractMetadataPaths = (metadata: Record<string, unknown>, paths: Set<string>): void => {
  Object.entries(metadata).forEach(([key, value]) => {
    if (isPathLikeKey(key)) {
      addIfValidString(paths, value);
    }
  });
};

/** Collect all potential path candidates from raw service data */
export const collectPathCandidates = (raw: any): string[] => {
  const paths = new Set<string>();

  extractPriorityPaths(raw, paths);

  const metadata = raw?.metadata;
  if (metadata && typeof metadata === "object") {
    extractPriorityPaths(metadata, paths);
    extractMetadataPaths(metadata as Record<string, unknown>, paths);
  }

  return Array.from(paths);
};

/** Resolve the most likely source path from raw service data */
export const resolveSourcePath = (raw: any): { path: string | undefined; hasSource: boolean } => {
  // Services with Docker images are almost always external (postgres, redis, etc.)
  // Check all the places where an image might be specified
  const hasDockerImage =
    (typeof raw?.image === "string" && raw.image.trim().length > 0) ||
    (typeof raw?.metadata?.image === "string" && raw.metadata.image.trim().length > 0) ||
    (typeof raw?.metadata?.containerImage === "string" &&
      raw.metadata.containerImage.trim().length > 0) ||
    (typeof raw?.metadata?.docker?.composeService?.image === "string" &&
      raw.metadata.docker.composeService.image.trim().length > 0);

  const candidates = collectPathCandidates(raw);
  if (candidates.length === 0) {
    return { path: undefined, hasSource: false };
  }

  const sourceCandidate = candidates.find((candidate) => isPotentialSourcePath(candidate));
  if (sourceCandidate) {
    // Even if we found a source-like path, if there's a Docker image, it's likely external
    // (e.g., postgres with "path: db/migrations" is still external)
    if (hasDockerImage) {
      return { path: sourceCandidate, hasSource: false };
    }
    return { path: sourceCandidate, hasSource: true };
  }

  const nonInfrastructureCandidate = candidates.find(
    (candidate) => !isInfrastructurePath(candidate),
  );
  if (nonInfrastructureCandidate) {
    return { path: nonInfrastructureCandidate, hasSource: false };
  }

  return { path: candidates[0], hasSource: false };
};

/** Extract port from a primitive value */
const extractPrimitivePort = (entry: number | string): string | null => {
  const value = String(entry).trim();
  return value || null;
};

/** Extract port from an object port entry */
const extractObjectPort = (entry: Record<string, any>): string | null => {
  const host = entry.hostPort ?? entry.host ?? entry.external;
  const container = entry.containerPort ?? entry.port ?? entry.internal;
  if (host && container) {
    return `${host}:${container}`;
  }
  if (container) {
    return String(container);
  }
  return null;
};

/** Process an array of port entries */
const processPortArray = (source: unknown[], ports: string[]): void => {
  source.forEach((entry) => {
    if (entry == null) return;
    if (typeof entry === "number" || typeof entry === "string") {
      const port = extractPrimitivePort(entry);
      if (port) ports.push(port);
    } else if (typeof entry === "object") {
      const port = extractObjectPort(entry as Record<string, any>);
      if (port) ports.push(port);
    }
  });
};

/** Process an object of port entries */
const processPortObject = (source: Record<string, unknown>, ports: string[]): void => {
  Object.entries(source).forEach(([key, value]) => {
    const trimmedKey = String(key).trim();
    if (trimmedKey) ports.push(trimmedKey);
    if (value && typeof value === "string") {
      const trimmedValue = value.trim();
      if (trimmedValue) ports.push(trimmedValue);
    }
  });
};

/** Collect and format port mappings from raw service data */
export const collectPorts = (raw: any): string => {
  const ports: string[] = [];
  const candidateSources = [
    raw?.ports,
    raw?.metadata?.ports,
    raw?.metadata?.exposedPorts,
    raw?.metadata?.containerPorts,
  ];

  candidateSources.forEach((source) => {
    if (!source) return;
    if (Array.isArray(source)) {
      processPortArray(source, ports);
    } else if (typeof source === "object") {
      processPortObject(source, ports);
    }
  });

  return Array.from(new Set(ports)).join(", ");
};

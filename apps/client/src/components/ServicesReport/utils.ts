import { PATH_PRIORITY_CANDIDATES } from "./constants";

export const slugify = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const buildEndpointDraftIdentifier = (
  serviceId: string,
  method: string,
  path: string,
): string => slugify(`${serviceId}-${method || "any"}-${path || "endpoint"}`);

export const isLikelyCodePath = (value: string): boolean => {
  const lower = value.toLowerCase();
  if (!lower) return false;
  if (
    lower.endsWith(".ts") ||
    lower.endsWith(".tsx") ||
    lower.endsWith(".js") ||
    lower.endsWith(".jsx")
  ) {
    return true;
  }
  if (
    lower.endsWith(".py") ||
    lower.endsWith(".go") ||
    lower.endsWith(".rs") ||
    lower.endsWith(".java")
  ) {
    return true;
  }
  if (
    lower.includes("src/") ||
    lower.includes("services/") ||
    lower.includes("apps/") ||
    lower.includes("packages/")
  ) {
    return true;
  }
  if (lower.includes("/service") || lower.includes("-service")) {
    return true;
  }
  return false;
};

export const isAbsolutePath = (value: string): boolean => {
  if (!value) return false;
  return value.startsWith("/") || /^[a-z]:[\\/]/i.test(value);
};

export const isPotentialSourcePath = (value: string): boolean => {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (isLikelyCodePath(trimmed)) {
    return true;
  }
  if (trimmed.startsWith("./") || trimmed.startsWith("../") || trimmed.startsWith(".\\")) {
    return true;
  }
  // Removed overly permissive check that matched any relative path with slashes
  // This was causing external services (like postgres with paths like "db/migrations")
  // to be incorrectly classified as internal services
  return false;
};

export const isInfrastructurePath = (value: string): boolean => {
  const normalized = value.toLowerCase().replace(/\\/g, "/");
  if (!normalized) {
    return false;
  }

  if (
    normalized.includes("dockerfile") ||
    normalized.includes("docker-compose") ||
    normalized.endsWith(".yaml") ||
    normalized.endsWith(".yml") ||
    normalized.includes("compose.yml") ||
    normalized.includes("compose.yaml")
  ) {
    return true;
  }

  if (
    normalized.includes("/docker/") ||
    normalized.startsWith("docker/") ||
    normalized.includes("/compose/") ||
    normalized.startsWith("compose/") ||
    normalized.endsWith("/compose")
  ) {
    return true;
  }

  if (
    normalized.includes("/helm/") ||
    normalized.includes("/charts/") ||
    normalized.includes("/chart/") ||
    normalized.endsWith("/chart")
  ) {
    return true;
  }

  return false;
};

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

export const collectPathCandidates = (raw: any): string[] => {
  const paths = new Set<string>();

  PATH_PRIORITY_CANDIDATES.forEach((key) => {
    const directValue = raw?.[key];
    if (typeof directValue === "string" && directValue.trim()) {
      paths.add(directValue.trim());
    }
  });

  const metadata = raw?.metadata;
  if (metadata && typeof metadata === "object") {
    PATH_PRIORITY_CANDIDATES.forEach((key) => {
      const metaValue = metadata[key];
      if (typeof metaValue === "string" && metaValue.trim()) {
        paths.add(metaValue.trim());
      }
    });

    Object.entries(metadata as Record<string, unknown>).forEach(([key, value]) => {
      if (typeof value === "string" && value.trim()) {
        const normalizedKey = key.toLowerCase();
        if (
          normalizedKey.includes("path") ||
          normalizedKey.includes("root") ||
          normalizedKey.includes("file") ||
          normalizedKey.includes("directory")
        ) {
          paths.add(value.trim());
        }
      }
    });
  }

  return Array.from(paths);
};

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
      source.forEach((entry) => {
        if (entry == null) return;
        if (typeof entry === "number" || typeof entry === "string") {
          const value = String(entry).trim();
          if (value) ports.push(value);
          return;
        }
        if (typeof entry === "object") {
          const host = entry.hostPort ?? entry.host ?? entry.external;
          const container = entry.containerPort ?? entry.port ?? entry.internal;
          if (host && container) {
            ports.push(`${host}:${container}`);
          } else if (container) {
            ports.push(String(container));
          }
        }
      });
    } else if (typeof source === "object") {
      Object.entries(source).forEach(([key, value]) => {
        const trimmedKey = String(key).trim();
        if (trimmedKey) {
          ports.push(trimmedKey);
        }
        if (value && typeof value === "string") {
          const trimmedValue = value.trim();
          if (trimmedValue) {
            ports.push(trimmedValue);
          }
        }
      });
    }
  });

  return Array.from(new Set(ports)).join(", ");
};

export interface InternalServiceCandidate {
  raw: Record<string, unknown> | null;
  typeLabel?: string;
  endpoints: Array<unknown>;
  hasSource: boolean;
  sourcePath?: string;
}

const toRecord = (value: unknown): Record<string, unknown> | undefined => {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  return value as Record<string, unknown>;
};

const normalizeString = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.toLowerCase() : undefined;
};

export const getPackageJson = (raw: unknown): Record<string, unknown> | null => {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const rawRecord = raw as Record<string, unknown>;
  const metadata = rawRecord.metadata;
  if (metadata && typeof metadata === "object") {
    const packageJson = (metadata as Record<string, unknown>).packageJson;
    if (packageJson && typeof packageJson === "object") {
      return packageJson as Record<string, unknown>;
    }
  }
  const direct = rawRecord.packageJson;
  if (direct && typeof direct === "object") {
    return direct as Record<string, unknown>;
  }
  return null;
};

export const hasPackageBin = (raw: unknown): boolean => {
  const packageJson = getPackageJson(raw);
  if (!packageJson) {
    return false;
  }

  const rawRecord = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const metadata =
    rawRecord.metadata && typeof rawRecord.metadata === "object"
      ? (rawRecord.metadata as Record<string, unknown>)
      : undefined;

  const candidateSources = [
    (packageJson as Record<string, unknown>).bin,
    metadata?.bin,
    rawRecord.bin,
  ];
  for (const candidate of candidateSources) {
    if (!candidate) continue;
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return true;
    }
    if (typeof candidate === "object") {
      const keys = Object.keys(candidate as Record<string, unknown>);
      if (keys.length > 0) {
        return true;
      }
    }
  }
  return false;
};

export const isServiceDetected = (service: InternalServiceCandidate): boolean => {
  const raw = service.raw;
  if (raw && typeof raw === "object") {
    const rawRecord = raw as Record<string, unknown>;
    const metadata =
      rawRecord.metadata && typeof rawRecord.metadata === "object"
        ? (rawRecord.metadata as Record<string, unknown>)
        : undefined;

    const candidates: Array<unknown> = [
      rawRecord.type,
      rawRecord.category,
      metadata?.detectedType,
      metadata?.type,
      metadata?.category,
      service.typeLabel,
    ];

    return candidates.some((candidate) => {
      if (typeof candidate !== "string") {
        return false;
      }
      const value = candidate.toLowerCase();
      return value.includes("service");
    });
  }

  if (typeof service.typeLabel === "string") {
    return service.typeLabel.toLowerCase().includes("service");
  }

  return false;
};

/**
 * Checks if a service has a buildable package file.
 *
 * Package files indicate code that can be built/compiled:
 * - package.json (Node.js/JavaScript/TypeScript)
 * - Cargo.toml (Rust)
 * - pyproject.toml, setup.py (Python)
 * - go.mod (Go)
 * - pom.xml, build.gradle (Java)
 */
export const hasBuildablePackageFile = (raw: unknown, serviceName?: string): boolean => {
  if (!raw || typeof raw !== "object") {
    return false;
  }

  const rawRecord = raw as Record<string, unknown>;
  const metadata =
    rawRecord.metadata && typeof rawRecord.metadata === "object"
      ? (rawRecord.metadata as Record<string, unknown>)
      : undefined;

  // PRIMARY CHECK: Check for explicit manifest field in metadata
  const manifest = normalizeString(metadata?.manifest) || normalizeString(rawRecord.manifest);
  if (manifest) {
    const buildableManifests = [
      "package.json",
      "cargo.toml",
      "pyproject.toml",
      "setup.py",
      "go.mod",
      "pom.xml",
      "build.gradle",
      "pipfile",
      "requirements.txt",
    ];

    if (buildableManifests.includes(manifest)) {
      return true;
    }
  }

  // FALLBACK: Check for explicit package.json object
  const hasPackageJson = getPackageJson(raw);
  if (hasPackageJson) {
    return true;
  }

  // FALLBACK: Check sourceFile path for buildable package files
  const sourceFile = normalizeString(metadata?.sourceFile) || normalizeString(rawRecord.sourceFile);
  if (sourceFile) {
    const packageFiles = [
      "package.json",
      "cargo.toml",
      "pyproject.toml",
      "setup.py",
      "go.mod",
      "pom.xml",
      "build.gradle",
      "build.gradle.kts",
    ];

    const matchedPackageFile = packageFiles.find((pkg) => sourceFile.includes(pkg));
    if (matchedPackageFile) {
      return true;
    }
  }

  // FALLBACK: Check tags for language indicators (nodejs, rust, python, go, java)
  const tags = Array.isArray(rawRecord.tags)
    ? rawRecord.tags
    : Array.isArray(metadata?.tags)
      ? metadata.tags
      : [];

  const languageTags = ["nodejs", "rust", "python", "go", "java", "typescript", "javascript"];
  const hasLanguageTag = tags.some((tag: unknown) => {
    if (typeof tag !== "string") return false;
    const tagLower = tag.toLowerCase();
    return languageTags.some((lang) => tagLower === lang || tagLower.includes(lang));
  });

  if (hasLanguageTag) {
    // But exclude if it's ONLY docker-tagged
    const isDockerOnly =
      tags.length === 1 && typeof tags[0] === "string" && tags[0].toLowerCase() === "docker";
    if (!isDockerOnly) {
      return true;
    }
  }

  return false;
};

/**
 * Determines if a service should be classified as internal or external.
 *
 * Radically simplified rule:
 * - Internal: Has a buildable package file (package.json, Cargo.toml, pyproject.toml, etc.)
 * - External: Everything else (Docker Compose only, infrastructure services, etc.)
 */
export const shouldTreatAsInternalService = (service: InternalServiceCandidate): boolean => {
  const serviceName = (service.raw as any)?.name || "unknown";
  return hasBuildablePackageFile(service.raw, serviceName);
};

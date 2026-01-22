export interface InternalServiceCandidate {
  raw: Record<string, unknown> | null;
  typeLabel?: string | undefined;
  endpoints: Array<unknown>;
  hasSource: boolean;
  sourcePath?: string | undefined;
}

type RawRecord = Record<string, unknown>;

const normalizeString = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.toLowerCase() : undefined;
};

const getMetadata = (raw: unknown): RawRecord | undefined => {
  if (!raw || typeof raw !== "object") return undefined;
  const metadata = (raw as RawRecord).metadata;
  return metadata && typeof metadata === "object" ? (metadata as RawRecord) : undefined;
};

export const getPackageJson = (raw: unknown): RawRecord | null => {
  if (!raw || typeof raw !== "object") return null;
  const rawRecord = raw as RawRecord;
  const metadata = getMetadata(raw);

  const pkgJson = metadata?.packageJson ?? rawRecord.packageJson;
  return pkgJson && typeof pkgJson === "object" ? (pkgJson as RawRecord) : null;
};

const hasBinField = (candidate: unknown): boolean => {
  if (!candidate) return false;
  if (typeof candidate === "string") return candidate.trim().length > 0;
  if (typeof candidate === "object") return Object.keys(candidate as RawRecord).length > 0;
  return false;
};

export const hasPackageBin = (raw: unknown): boolean => {
  const packageJson = getPackageJson(raw);
  if (!packageJson) return false;

  const rawRecord = (raw && typeof raw === "object" ? raw : {}) as RawRecord;
  const metadata = getMetadata(raw);

  return [packageJson.bin, metadata?.bin, rawRecord.bin].some(hasBinField);
};

const includesService = (value: unknown): boolean =>
  typeof value === "string" && value.toLowerCase().includes("service");

export const isServiceDetected = (service: InternalServiceCandidate): boolean => {
  const raw = service.raw;
  if (!raw || typeof raw !== "object") {
    return includesService(service.typeLabel);
  }

  const rawRecord = raw as RawRecord;
  const metadata = getMetadata(raw);

  const candidates = [
    rawRecord.type,
    rawRecord.category,
    metadata?.detectedType,
    metadata?.type,
    metadata?.category,
    service.typeLabel,
  ];

  return candidates.some(includesService);
};

/** Known buildable manifest files */
const BUILDABLE_MANIFESTS = new Set([
  "package.json",
  "cargo.toml",
  "pyproject.toml",
  "setup.py",
  "go.mod",
  "pom.xml",
  "build.gradle",
  "pipfile",
  "requirements.txt",
  "build.gradle.kts",
]);

/** Language tags that indicate buildable code */
const LANGUAGE_TAGS = new Set([
  "nodejs",
  "rust",
  "python",
  "go",
  "java",
  "typescript",
  "javascript",
]);

const isLanguageTag = (tag: unknown): boolean => {
  if (typeof tag !== "string") return false;
  const tagLower = tag.toLowerCase();
  return Array.from(LANGUAGE_TAGS).some((lang) => tagLower === lang || tagLower.includes(lang));
};

/** Check for explicit manifest field in metadata or raw record */
const hasManifestField = (rawRecord: RawRecord, metadata: RawRecord | undefined): boolean => {
  const manifest = normalizeString(metadata?.manifest) ?? normalizeString(rawRecord.manifest);
  return Boolean(manifest && BUILDABLE_MANIFESTS.has(manifest));
};

/** Check sourceFile path for buildable manifest files */
const hasMatchingSourceFile = (rawRecord: RawRecord, metadata: RawRecord | undefined): boolean => {
  const sourceFile = normalizeString(metadata?.sourceFile) ?? normalizeString(rawRecord.sourceFile);
  if (!sourceFile) return false;
  return Array.from(BUILDABLE_MANIFESTS).some((pkg) => sourceFile.includes(pkg));
};

/** Get tags array from raw record or metadata */
const getTags = (rawRecord: RawRecord, metadata: RawRecord | undefined): unknown[] => {
  if (Array.isArray(rawRecord.tags)) return rawRecord.tags;
  if (Array.isArray(metadata?.tags)) return metadata.tags;
  return [];
};

/** Check if tags contain language indicators (excluding docker-only) */
const hasBuildableLanguageTags = (
  rawRecord: RawRecord,
  metadata: RawRecord | undefined,
): boolean => {
  const tags = getTags(rawRecord, metadata);
  if (!tags.some(isLanguageTag)) return false;
  const isDockerOnly =
    tags.length === 1 && typeof tags[0] === "string" && tags[0].toLowerCase() === "docker";
  return !isDockerOnly;
};

/** Checks if a service has a buildable package file */
export const hasBuildablePackageFile = (raw: unknown): boolean => {
  if (!raw || typeof raw !== "object") return false;

  const rawRecord = raw as RawRecord;
  const metadata = getMetadata(raw);

  return (
    hasManifestField(rawRecord, metadata) ||
    getPackageJson(raw) !== null ||
    hasMatchingSourceFile(rawRecord, metadata) ||
    hasBuildableLanguageTags(rawRecord, metadata)
  );
};

const getDockerComposeService = (metadata: RawRecord | undefined): RawRecord | undefined => {
  const docker = metadata?.docker as RawRecord | undefined;
  return (docker?.composeService ?? metadata?.composeService) as RawRecord | undefined;
};

/** Checks if a service has a Docker build context defined */
const hasDockerBuild = (raw: unknown): boolean => {
  if (!raw || typeof raw !== "object") return false;
  const rawRecord = raw as RawRecord;
  const metadata = getMetadata(raw);
  const composeService = getDockerComposeService(metadata);

  const buildLocations = [
    rawRecord.build,
    metadata?.build,
    metadata?.dockerBuild,
    metadata?.buildContext,
    composeService?.build,
  ];

  return buildLocations.some((build) => build != null);
};

/** Checks if a service is container-only (has an image but no build context) */
const isContainerOnlyService = (raw: unknown): boolean => {
  if (!raw || typeof raw !== "object") return false;
  if (hasDockerBuild(raw)) return false;

  const metadata = getMetadata(raw);
  const composeService = getDockerComposeService(metadata);

  const imageLocations = [
    metadata?.image,
    metadata?.containerImage,
    metadata?.originalImage,
    composeService?.image,
  ];

  return imageLocations.some((img) => typeof img === "string" && img.trim().length > 0);
};

/** Determines if a service should be classified as internal or external */
export const shouldTreatAsInternalService = (service: InternalServiceCandidate): boolean => {
  if (service.hasSource || service.sourcePath) return true;
  if (hasDockerBuild(service.raw)) return true;
  if (isContainerOnlyService(service.raw)) return false;

  const rawType = normalizeString((service.raw as RawRecord)?.type);
  if (rawType === "internal") return true;

  return hasBuildablePackageFile(service.raw);
};

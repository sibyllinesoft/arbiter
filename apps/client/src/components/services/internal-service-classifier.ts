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

const INFRA_TYPE_HINTS = new Set([
  "external",
  "prebuilt",
  "database",
  "datastore",
  "cache",
  "message-queue",
  "queue",
  "broker",
  "storage",
]);

const INFRA_LANGUAGE_HINTS = new Set(["container", "database", "cache", "message-queue", "queue"]);

export const shouldTreatAsInternalService = (service: InternalServiceCandidate): boolean => {
  const hasSource = Boolean(service.hasSource || service.sourcePath);
  if (hasSource) {
    return true;
  }

  const rawRecord = toRecord(service.raw);
  const metadata = toRecord(rawRecord?.metadata);

  const artifactHint =
    normalizeString(rawRecord?.type) ??
    normalizeString(metadata?.type) ??
    normalizeString(rawRecord?.artifactType) ??
    normalizeString(metadata?.artifactType) ??
    normalizeString(rawRecord?.serviceType) ??
    normalizeString(metadata?.serviceType);
  const categoryHint =
    normalizeString(rawRecord?.category) ??
    normalizeString(metadata?.category) ??
    normalizeString(metadata?.type);
  const typeLabelHint = normalizeString(service.typeLabel);
  const languageHint = normalizeString(rawRecord?.language) ?? normalizeString(metadata?.language);

  const declaredInfra =
    (artifactHint && INFRA_TYPE_HINTS.has(artifactHint)) ||
    (categoryHint && INFRA_TYPE_HINTS.has(categoryHint)) ||
    (typeLabelHint && INFRA_TYPE_HINTS.has(typeLabelHint)) ||
    (languageHint && INFRA_LANGUAGE_HINTS.has(languageHint));

  if (artifactHint === "internal" || artifactHint === "bespoke") {
    return true;
  }

  if (declaredInfra) {
    return false;
  }

  const packageJson = getPackageJson(service.raw);
  const hasPackage = Boolean(packageJson);
  const detectedAsService = isServiceDetected(service);
  const hasBin = hasPackageBin(service.raw);
  const hasEndpoints = Array.isArray(service.endpoints) && service.endpoints.length > 0;

  const qualifiesByDetection = hasPackage && detectedAsService;
  const qualifiesByBin = hasPackage && hasBin;
  const qualifiesByEndpoints = hasPackage && hasEndpoints;

  return qualifiesByDetection || qualifiesByBin || qualifiesByEndpoints;
};

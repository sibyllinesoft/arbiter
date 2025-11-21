import { PATH_PRIORITY_CANDIDATES } from "./constants";

export const coerceDisplayValue = (raw: unknown): string | null => {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed.toLowerCase() === "unknown" ? null : trimmed;
};

export const isLikelyCodePath = (value: string): boolean => {
  const lower = value.toLowerCase();
  if (!lower) return false;
  if (/(\.(ts|tsx|js|jsx|mjs|cjs|vue|svelte))$/.test(lower)) return true;
  if (
    lower.endsWith(".py") ||
    lower.endsWith(".go") ||
    lower.endsWith(".rs") ||
    lower.endsWith(".java")
  )
    return true;
  if (
    lower.includes("src/") ||
    lower.includes("apps/") ||
    lower.includes("packages/") ||
    lower.includes("frontend")
  )
    return true;
  return false;
};

export const isInfrastructurePath = (value: string): boolean => {
  const lower = value.toLowerCase();
  return (
    lower.includes("dockerfile") ||
    lower.includes("docker-compose") ||
    lower.endsWith(".yaml") ||
    lower.endsWith(".yml") ||
    lower.includes("compose.yml") ||
    lower.includes("compose.yaml")
  );
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
          normalizedKey.includes(" directory")
        ) {
          paths.add(value.trim());
        }
      }
    });
  }

  return Array.from(paths);
};

export const resolveSourcePath = (raw: any): { path: string | undefined; hasSource: boolean } => {
  const candidates = collectPathCandidates(raw);
  if (candidates.length === 0) {
    return { path: undefined, hasSource: false };
  }

  const codeCandidate = candidates.find((candidate) => isLikelyCodePath(candidate));
  if (codeCandidate) {
    return { path: codeCandidate, hasSource: true };
  }

  const nonInfrastructureCandidate = candidates.find(
    (candidate) => !isInfrastructurePath(candidate),
  );
  if (nonInfrastructureCandidate) {
    return { path: nonInfrastructureCandidate, hasSource: true };
  }

  return { path: candidates[0], hasSource: false };
};

export const extractTypeLabel = (raw: any): string | undefined => {
  const normalize = (value: unknown): string | null => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  };

  // Prefer detailed framework information from frontend analysis if present
  const analysisFrameworks = raw?.metadata?.frontendAnalysis?.frameworks;
  if (Array.isArray(analysisFrameworks)) {
    const framework = analysisFrameworks.map(normalize).find(Boolean);
    if (framework) return framework;
  }

  const classification = raw?.metadata?.classification;
  if (classification && typeof classification === "object") {
    const classificationFields = [
      "detail",
      "label",
      "platform",
      "detectedType",
      "type",
      "category",
    ];
    for (const field of classificationFields) {
      const value = normalize((classification as Record<string, unknown>)[field]);
      if (value && value.toLowerCase() !== "frontend") {
        return value;
      }
    }
  }

  const clientMeta = raw?.metadata?.client;
  if (clientMeta && typeof clientMeta === "object") {
    const clientFields = ["platform", "type", "variant", "category"];
    for (const field of clientFields) {
      const value = normalize((clientMeta as Record<string, unknown>)[field]);
      if (value) return value;
    }
  }

  const explicitCandidates = [
    raw?.metadata?.clientType,
    raw?.metadata?.client_type,
    raw?.metadata?.frontendType,
    raw?.metadata?.frontend_type,
    raw?.metadata?.platform,
  ];
  for (const candidate of explicitCandidates) {
    const value = normalize(candidate);
    if (value && value.toLowerCase() !== "frontend") {
      return value;
    }
  }

  const metadataType = normalize(raw?.metadata?.type);
  if (metadataType) {
    return metadataType.replace(/_/g, " ");
  }

  const type = normalize(raw?.type);
  if (type) {
    return type.replace(/_/g, " ");
  }

  return undefined;
};

export const slugify = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

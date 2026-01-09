/**
 * Client utility functions for path resolution and type extraction.
 * These helpers are used when processing client specifications from CUE assemblies.
 */
import { PATH_PRIORITY_CANDIDATES } from "./clientConstants";

/** Code file extensions regex */
const CODE_EXTENSION_REGEX = /\.(ts|tsx|js|jsx|mjs|cjs|vue|svelte|py|go|rs|java)$/i;

/** Source directory patterns */
const SOURCE_DIR_PATTERNS = ["src/", "apps/", "packages/", "frontend"];

/** Infrastructure file patterns */
const INFRA_PATTERNS = [
  "dockerfile",
  "docker-compose",
  ".yaml",
  ".yml",
  "compose.yml",
  "compose.yaml",
];

/** Coerce a raw value to a display string, returning null for empty or "unknown" values */
export const coerceDisplayValue = (raw: unknown): string | null => {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.toLowerCase() === "unknown") return null;
  return trimmed;
};

/** Check if a path likely points to source code based on extension or directory patterns */
export const isLikelyCodePath = (value: string): boolean => {
  const lower = value.toLowerCase();
  if (!lower) return false;
  if (CODE_EXTENSION_REGEX.test(lower)) return true;
  return SOURCE_DIR_PATTERNS.some((p) => lower.includes(p));
};

/** Check if a path points to infrastructure configuration (Docker, Compose, etc.) */
export const isInfrastructurePath = (value: string): boolean => {
  const lower = value.toLowerCase();
  return INFRA_PATTERNS.some((p) => lower.includes(p));
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

/** Collect all potential path candidates from raw client data */
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

/** Resolve the most likely source path from raw client data */
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

const normalizeString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const findFieldValue = (
  obj: Record<string, unknown> | undefined,
  fields: string[],
  excludeFrontend = false,
): string | undefined => {
  if (!obj) return undefined;
  for (const field of fields) {
    const value = normalizeString(obj[field]);
    if (value && (!excludeFrontend || value.toLowerCase() !== "frontend")) {
      return value;
    }
  }
  return undefined;
};

/** Extract a type label from raw client data, checking multiple classification sources */
export const extractTypeLabel = (raw: any): string | undefined => {
  const metadata = raw?.metadata;

  // Check frontend analysis frameworks
  const frameworks = metadata?.frontendAnalysis?.frameworks;
  if (Array.isArray(frameworks)) {
    const framework = frameworks.map(normalizeString).find(Boolean);
    if (framework) return framework;
  }

  // Check classification fields
  const classificationFields = ["detail", "label", "platform", "detectedType", "type", "category"];
  const classValue = findFieldValue(metadata?.classification, classificationFields, true);
  if (classValue) return classValue;

  // Check client metadata
  const clientFields = ["platform", "type", "variant", "category"];
  const clientValue = findFieldValue(metadata?.client, clientFields);
  if (clientValue) return clientValue;

  // Check explicit type fields
  const explicitFields = ["clientType", "client_type", "frontendType", "frontend_type", "platform"];
  const explicitValue = findFieldValue(metadata, explicitFields, true);
  if (explicitValue) return explicitValue;

  // Fall back to type fields
  const metaType = normalizeString(metadata?.type);
  if (metaType) return metaType.replace(/_/g, " ");

  const rawType = normalizeString(raw?.type);
  return rawType ? rawType.replace(/_/g, " ") : undefined;
};

/** Convert a string to a URL-safe slug */
export const slugify = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

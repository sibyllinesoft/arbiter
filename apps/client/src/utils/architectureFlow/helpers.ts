/**
 * Helper utilities for architecture flow graph building
 */

/** Convert to a safe node ID with prefix */
export const toSafeId = (prefix: string, raw: string): string => `${prefix}:${raw.trim()}`;

/** Normalize values into a string array for dependency handling */
export const normalizeStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .map((v) => {
          if (typeof v === "string") return v;
          if (v && typeof v === "object" && "id" in v)
            return String((v as Record<string, unknown>).id);
          return String(v);
        })
        .filter(Boolean)
    : [];

/** Pick a record from source by trying multiple keys */
export const pickRecord = (source: unknown, keys: string[]): Record<string, unknown> => {
  for (const key of keys) {
    const candidate = (source as Record<string, unknown>)?.[key];
    if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
      return candidate as Record<string, unknown>;
    }
  }
  return {};
};

/** Pick an array from source by trying multiple keys */
export const pickArray = (source: unknown, keys: string[]): unknown[] => {
  for (const key of keys) {
    const candidate = (source as Record<string, unknown>)?.[key];
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }
  return [];
};

/** Resolve artifact type from raw type string */
export const resolveArtifactType = (rawType: string): string => {
  const type = String(rawType || "").toLowerCase();
  if (type.includes("frontend") || type === "ui" || type === "client") return "frontend";
  if (type.includes("service") || type === "api" || type === "job") return "service";
  if (type.includes("db") || type.includes("database") || type.includes("datastore"))
    return "database";
  if (type.includes("infra") || type.includes("infrastructure")) return "infrastructure";
  if (type.includes("package") || type === "module") return "package";
  return "external";
};

/** Extract raw type from component or artifact */
export const extractRawType = (item: Record<string, unknown>): string => {
  const metadata = item?.metadata as Record<string, unknown> | undefined;
  return String(item?.type || item?.artifactType || metadata?.type || item?.category || "");
};

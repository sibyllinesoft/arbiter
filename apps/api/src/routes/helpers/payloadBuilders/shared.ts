/**
 * Shared utilities for payload builders
 */
import { coerceStringArray } from "../../../io/utils";

/** Maps technology names to their base programming language */
const TECHNOLOGY_LANGUAGE_MAP: Record<string, string> = {
  "node.js": "javascript",
  node: "javascript",
  express: "javascript",
  fastify: "javascript",
  nestjs: "javascript",
  "next.js": "javascript",
  go: "go",
  golang: "go",
  python: "python",
  django: "python",
  flask: "python",
  fastapi: "python",
  rust: "rust",
  java: "java",
  spring: "java",
  ".net": "c#",
  dotnet: "c#",
};

/** Converts a string to a URL-friendly slug */
export function slugify(value: string | undefined, fallback: string): string {
  if (!value || value.trim().length === 0) return fallback;

  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");

  return normalized.length > 0 ? normalized : fallback;
}

/** Maps a technology/framework name to its base language */
export function guessLanguage(technology: string | undefined): string | undefined {
  if (!technology) return undefined;
  const key = technology.toLowerCase();
  return TECHNOLOGY_LANGUAGE_MAP[key] || TECHNOLOGY_LANGUAGE_MAP[key.replace(/\s+/g, "")];
}

/** Type-safe Object.hasOwn polyfill */
export function hasOwn(obj: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

/** Coerces a value to a trimmed non-empty string or undefined */
export function coerceOptionalTrimmedString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** Normalizes environment variable definitions from various input formats */
export function coerceEnvironmentMap(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== "object") return undefined;

  const map: Record<string, string> = {};

  const assignEntry = (key: unknown, raw: unknown) => {
    if (typeof key !== "string") return;
    const normalizedKey = key.trim();
    if (!normalizedKey) return;

    let normalizedValue: string;
    if (raw === null || raw === undefined) {
      normalizedValue = "";
    } else if (typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean") {
      normalizedValue = String(raw);
    } else if (typeof raw === "object" && raw && "value" in raw) {
      normalizedValue = String((raw as Record<string, unknown>).value ?? "");
    } else {
      normalizedValue = "";
    }
    map[normalizedKey] = normalizedValue;
  };

  if (Array.isArray(value)) {
    value.forEach((entry) => {
      if (!entry) return;
      if (typeof entry === "string") {
        const [key, ...rest] = entry.split(/[:=]/);
        assignEntry(key, rest.join("=").trim());
      } else if (typeof entry === "object") {
        const record = entry as Record<string, unknown>;
        const key = (record.key ?? record.name ?? record.id ?? record.label) as string | undefined;
        assignEntry(key ?? "", record.value ?? record.val ?? record.default ?? "");
      }
    });
  } else {
    Object.entries(value as Record<string, unknown>).forEach(([key, raw]) => {
      assignEntry(key, raw);
    });
  }

  return Object.keys(map).length > 0 ? map : undefined;
}

/** Removes undefined values from a metadata object */
export function normalizeMetadata(
  metadata?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!metadata) return undefined;
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (value === undefined) continue;
    cleaned[key] = value;
  }
  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
}

/** Converts a string to a lowercase hyphenated slug */
export function toSlug(value: string): string {
  return String(value || "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

/** Infers database type from framework or name hints */
export function getDatabaseType(framework?: string, name?: string): string {
  if (framework) return framework.toLowerCase();
  if (name?.includes("postgres") || name?.includes("pg")) return "postgresql";
  if (name?.includes("mysql") || name?.includes("maria")) return "mysql";
  if (name?.includes("mongo")) return "mongodb";
  if (name?.includes("redis")) return "redis";
  if (name?.includes("sqlite")) return "sqlite";
  return "unknown";
}

// Re-export coerceStringArray from io/utils
export { coerceStringArray };

/**
 * Helper functions for group/issue spec building
 */

export const COMPLETED_STATUS_TOKENS = new Set([
  "done",
  "complete",
  "completed",
  "closed",
  "resolved",
  "shipped",
]);

export const AFFIRMATIVE_TOKENS = new Set([
  "true",
  "yes",
  "y",
  "1",
  "complete",
  "completed",
  "done",
]);
export const NEGATIVE_TOKENS = new Set(["false", "no", "n", "0"]);

export const slugifyValue = (value: string | undefined | null, fallback: string): string => {
  const base = value ?? "";
  const source = base.trim().length > 0 ? base : fallback;
  const sanitized = source
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");

  if (sanitized.length > 0) {
    return sanitized;
  }

  const fallbackSanitized = fallback
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");

  return fallbackSanitized.length > 0 ? fallbackSanitized : "item";
};

export const normalizeCandidate = (value?: string | null): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = slugifyValue(trimmed, trimmed);
  return normalized || null;
};

export const toOptionalString = (value: unknown): string | undefined => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  return undefined;
};

export const toOptionalNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const parsed = Number.parseFloat(trimmed);
    if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
};

export const toOptionalBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (AFFIRMATIVE_TOKENS.has(normalized)) {
      return true;
    }
    if (NEGATIVE_TOKENS.has(normalized)) {
      return false;
    }
  }
  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  return undefined;
};

export const coerceStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter((item): item is string => item.length > 0);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter((item): item is string => item.length > 0);
  }

  return [];
};

export const collectAliasKeys = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
      .filter((entry): entry is string => entry.length > 0);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry): entry is string => entry.length > 0);
  }
  return [];
};

export const sortTasks = (a: Record<string, unknown>, b: Record<string, unknown>): number => {
  const nameA = toOptionalString(a.name) ?? "";
  const nameB = toOptionalString(b.name) ?? "";
  return nameA.localeCompare(nameB);
};

export const registerKeys = (
  map: Map<string, unknown>,
  keys: Array<string | undefined | null>,
  target: unknown,
): void => {
  keys.forEach((key) => {
    const normalized = normalizeCandidate(key ?? undefined);
    if (normalized && !map.has(normalized)) {
      map.set(normalized, target);
    }
  });
};

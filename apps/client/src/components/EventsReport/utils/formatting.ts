import type { Event } from "@/types/api";

export const sortEventsDesc = (entries: Event[]): Event[] =>
  [...entries].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

export const toShortId = (value: unknown, length = 8): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.length <= length ? trimmed : `${trimmed.slice(0, length)}…`;
};

export const humanizeKey = (key: string) =>
  key
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

/** Format string values with truncation */
const formatString = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return "n/a";
  return trimmed.length > 80 ? `${trimmed.slice(0, 77)}…` : trimmed;
};

/** Format array values with preview */
const formatArray = (value: unknown[]): string => {
  if (value.length === 0) return "none";
  const formatted = value.map((item) => formatValue(item));
  const preview = formatted.slice(0, 3).join(", ");
  return formatted.length > 3 ? `${preview} +${formatted.length - 3} more` : preview;
};

/** Format object values with preview */
const formatObject = (value: Record<string, unknown>): string => {
  const entries = Object.entries(value).filter(([, v]) => v != null);
  if (entries.length === 0) return "—";
  const preview = entries
    .slice(0, 3)
    .map(([key, val]) => `${humanizeKey(key)}=${formatValue(val)}`)
    .join(", ");
  return entries.length > 3 ? `${preview} +${entries.length - 3} more` : preview;
};

export const formatValue = (value: unknown): string => {
  if (value == null) return "n/a";
  if (typeof value === "string") return formatString(value);
  if (typeof value === "number" || typeof value === "bigint") return Number(value).toLocaleString();
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (Array.isArray(value)) return formatArray(value);
  if (typeof value === "object") return formatObject(value as Record<string, unknown>);
  return String(value);
};

export const formatDuration = (ms?: number): string | undefined => {
  if (ms === undefined || Number.isNaN(ms)) return undefined;
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds < 10 ? seconds.toFixed(1) : Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.round(seconds % 60);
  return `${minutes}m${remaining ? ` ${remaining}s` : ""}`;
};

export const emphasizeLabel = (value: string): string => humanizeKey(value);

export const summarizeGeneric = (data: Record<string, unknown>): string => {
  const entries = Object.entries(data ?? {}).filter(
    ([, value]) => value !== undefined && value !== null && value !== "",
  );
  if (entries.length === 0) {
    return "No additional details provided.";
  }
  const preview = entries
    .slice(0, 3)
    .map(([key, value]) => `${humanizeKey(key)}: ${formatValue(value)}`)
    .join(" · ");
  const remaining = entries.length - 3;
  return remaining > 0 ? `${preview} · +${remaining} more` : preview;
};

export const coerceToString = (value: unknown): string | undefined => {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  return undefined;
};

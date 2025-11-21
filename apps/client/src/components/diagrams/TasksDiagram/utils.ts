import {
  DEFAULT_TASK_LAYER_KEY,
  FALLBACK_STATUS_CLASS,
  STATUS_STYLES,
  TASK_STATUS_LAYER_KEY,
} from "./constants";
import type { UnknownRecord } from "./types";

export const normalizeString = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  return str.length ? str : null;
};

export const slugify = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const toArray = (value: unknown): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => normalizeString(item)).filter((v): v is string => Boolean(v));
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => normalizeString(item))
      .filter((v): v is string => Boolean(v));
  }
  return [];
};

export const deriveStatusClass = (status?: string | null): string => {
  if (!status) {
    return FALLBACK_STATUS_CLASS;
  }

  const normalized = slugify(status);
  if (STATUS_STYLES[normalized]) {
    return normalized;
  }

  return FALLBACK_STATUS_CLASS;
};

export const escapeMermaidLabel = (value: string): string =>
  value.replace(/"/g, '\\"').replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const toRecord = (value: unknown): UnknownRecord =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as UnknownRecord) : {};

export const getString = (record: UnknownRecord, key: string): string | null =>
  normalizeString(record[key]);

export const getNestedRecord = (record: UnknownRecord, key: string): UnknownRecord =>
  toRecord(record[key]);

export const getBooleanFlag = (value: unknown): boolean => value === true;

export const ensureArray = (
  value: unknown,
): Array<{ key: string; value: unknown; index: number }> => {
  if (Array.isArray(value)) {
    return value.map((item, index) => ({
      key: `index-${index}`,
      value: item,
      index,
    }));
  }

  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).map(([key, entry], index) => ({
      key,
      value: entry,
      index,
    }));
  }

  return [];
};

export const getTaskLayerKey = (statusClass: string): string => {
  const candidate = TASK_STATUS_LAYER_KEY[statusClass];
  return typeof candidate === "string" && candidate.length > 0 ? candidate : DEFAULT_TASK_LAYER_KEY;
};

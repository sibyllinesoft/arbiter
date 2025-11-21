/* eslint-disable react-refresh/only-export-components */
import { buildFieldConfig } from "@/config/entity-definitions";
import type { FieldConfig, FieldValue, UiOptionCatalog } from "@/types/forms";
import { parseEnvironmentText } from "@/utils/environment";
import type { KeyValueEntry } from "@amalto/key-value-editor";

import { FIELD_RECORD_KEYS } from "./constants";

const extractRecordString = (record: Record<string, unknown> | undefined | null): string => {
  if (!record) return "";
  for (const key of FIELD_RECORD_KEYS) {
    const candidate = record[key];
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate;
    }
  }
  return "";
};

export const coerceFieldValueToString = (input: FieldValue | undefined): string => {
  if (input === null || input === undefined) {
    return "";
  }

  if (typeof input === "string") {
    return input;
  }

  if (typeof input === "number" || typeof input === "boolean") {
    return String(input);
  }

  if (Array.isArray(input)) {
    for (const entry of input as unknown[]) {
      const normalized = coerceFieldValueToString(entry as FieldValue);
      if (normalized.trim().length > 0) {
        return normalized;
      }
    }
    return "";
  }

  if (typeof input === "object") {
    return extractRecordString(input as Record<string, unknown>);
  }

  return "";
};

const coerceFieldValueToArrayInternal = (input: FieldValue | undefined): string[] => {
  if (input === null || input === undefined) {
    return [];
  }

  if (Array.isArray(input)) {
    return input
      .map((entry) => coerceFieldValueToString(entry as FieldValue).trim())
      .filter((value): value is string => value.length > 0);
  }

  const normalized = coerceFieldValueToString(input).trim();
  return normalized.length > 0 ? [normalized] : [];
};

export const coerceFieldValueToArray = (input: FieldValue | undefined): string[] =>
  coerceFieldValueToArrayInternal(input);

export const extractListFromValue = (input: FieldValue | undefined): string[] => {
  if (input === null || input === undefined) {
    return [];
  }

  if (Array.isArray(input)) {
    return input
      .map((entry) =>
        typeof entry === "string" ? entry : coerceFieldValueToString(entry as FieldValue),
      )
      .flatMap((entry) => entry.split(/\r?\n/))
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }

  return coerceFieldValueToString(input)
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
};

export const cloneFieldValue = (value: FieldValue): FieldValue => {
  if (Array.isArray(value)) {
    return value.map((entry) =>
      typeof entry === "object" && entry !== null
        ? { ...(entry as Record<string, unknown>) }
        : entry,
    ) as FieldValue;
  }
  if (value && typeof value === "object") {
    return { ...(value as Record<string, unknown>) };
  }
  return value;
};

export const getDefaultValue = (field?: FieldConfig): FieldValue => {
  if (!field) {
    return "";
  }
  if (field.defaultValue !== undefined) {
    return cloneFieldValue(field.defaultValue);
  }
  return field.multiple ? [] : "";
};

export const toKeyValuePairs = (input: FieldValue | undefined): KeyValueEntry[] => {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input.map((entry) => ({
      key: typeof (entry as any)?.key === "string" ? (entry as any).key : "",
      value: typeof (entry as any)?.value === "string" ? (entry as any).value : "",
    }));
  }
  if (typeof input === "object") {
    return Object.entries(input as Record<string, unknown>).map(([key, value]) => ({
      key,
      value:
        typeof value === "string"
          ? value
          : value === undefined || value === null
            ? ""
            : String(value),
    }));
  }
  if (typeof input === "string" && input.trim().length > 0) {
    const parsed = parseEnvironmentText(input);
    return Object.entries(parsed).map(([key, value]) => ({ key, value }));
  }
  return [];
};

export const keyValuePairsToMap = (pairs: KeyValueEntry[]): Record<string, string> => {
  const map: Record<string, string> = {};
  pairs.forEach((pair) => {
    const key = typeof pair?.key === "string" ? pair.key.trim() : "";
    if (!key) return;
    map[key] = typeof pair?.value === "string" ? pair.value : "";
  });
  return map;
};

export function getFieldConfig(entityType: string, catalog: UiOptionCatalog): FieldConfig[] {
  return buildFieldConfig(entityType, catalog);
}

export function toSingularLabel(label: string, fallback: string): string {
  if (!label && !fallback) return "item";
  const base = (label || fallback).trim();
  if (base.toLowerCase() === "infrastructure") return "infrastructure component";
  if (base.toLowerCase() === "tools") return "tool";
  if (base.toLowerCase() === "services") return "service";
  if (base.toLowerCase() === "databases") return "database";
  if (base.toLowerCase().endsWith("ies")) {
    return base.slice(0, -3) + "y";
  }
  if (base.toLowerCase().endsWith("s")) {
    return base.slice(0, -1);
  }
  return base;
}

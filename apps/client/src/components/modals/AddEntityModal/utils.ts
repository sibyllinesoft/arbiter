/* eslint-disable react-refresh/only-export-components */
import { buildFieldConfig } from "@/config/entity-definitions";
import type { FieldConfig, FieldValue, UiOptionCatalog } from "@/types/forms";
import type { KeyValueEntry } from "@amalto/key-value-editor";

import { FIELD_RECORD_KEYS } from "./constants";

/** Parse environment variable text (KEY=value format) into a record */
function parseEnvironmentText(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex > 0) {
      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed.slice(eqIndex + 1).trim();
      if (key) result[key] = value;
    }
  }
  return result;
}

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

/** Compare two string arrays for equality */
export const arraysEqual = (a: string[], b: string[]): boolean => {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
};

/** Normalize a field value for comparison */
export const normalizeForComparison = (
  targetField: FieldConfig | undefined,
  value: FieldValue | undefined,
): string => {
  if (targetField?.component === "key-value") {
    return JSON.stringify(toKeyValuePairs(value));
  }
  if (Array.isArray(value) && !targetField?.multiple) {
    return JSON.stringify(value);
  }
  return coerceFieldValueToString(value);
};

/** Prepare a value for storage based on field type */
export const prepareValueForStorage = (
  field: FieldConfig | undefined,
  value: FieldValue,
): FieldValue => {
  if (field?.component === "key-value") {
    return toKeyValuePairs(value);
  }
  return value;
};

/** Check if a value has changed compared to another */
export const hasValueChanged = (
  field: FieldConfig | undefined,
  prevValue: FieldValue | undefined,
  nextValue: FieldValue | undefined,
): boolean => {
  if (field?.multiple === true) {
    return !arraysEqual(coerceFieldValueToArray(prevValue), coerceFieldValueToArray(nextValue));
  }
  return normalizeForComparison(field, prevValue) !== normalizeForComparison(field, nextValue);
};

/** Validation result type */
type ValidationResult = { error: string | null; payload: FieldValue | null };

/** Validate key-value field type */
const validateKeyValueField = (field: FieldConfig, rawValue: FieldValue): ValidationResult => {
  const pairs = toKeyValuePairs(rawValue);
  if (field.required && pairs.length === 0) {
    return { error: `${field.label} is required`, payload: null };
  }
  return { error: null, payload: pairs };
};

/** Validate multiple-value field type */
const validateMultipleField = (field: FieldConfig, rawValue: FieldValue): ValidationResult => {
  const normalizedValues = coerceFieldValueToArray(rawValue)
    .map((item) => item.trim())
    .filter(Boolean);

  if (field.required && normalizedValues.length === 0) {
    return { error: `${field.label} is required`, payload: null };
  }

  const shouldInclude = normalizedValues.length > 0 || field.required;
  return { error: null, payload: shouldInclude ? normalizedValues : null };
};

/** Validate single-value field type */
const validateSingleField = (field: FieldConfig, rawValue: FieldValue): ValidationResult => {
  const stringValue = coerceFieldValueToString(rawValue);
  const trimmedValue = stringValue.trim();
  const useRawValue = field.markdown === true;

  if (field.required && trimmedValue.length === 0) {
    return { error: `${field.label} is required`, payload: null };
  }

  const hasValue = useRawValue ? stringValue.length > 0 : trimmedValue.length > 0;
  const shouldInclude = hasValue || field.required;
  const finalValue = useRawValue ? stringValue : trimmedValue;
  return { error: null, payload: shouldInclude ? finalValue : null };
};

/** Validate a single field and return error message if invalid */
export const validateField = (field: FieldConfig, rawValue: FieldValue): ValidationResult => {
  if (field.component === "key-value") {
    return validateKeyValueField(field, rawValue);
  }
  if (field.multiple) {
    return validateMultipleField(field, rawValue);
  }
  return validateSingleField(field, rawValue);
};

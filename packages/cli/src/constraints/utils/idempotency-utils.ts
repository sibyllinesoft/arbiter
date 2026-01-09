/**
 * Idempotency utility functions
 *
 * Hashing, normalization, and helper utilities for idempotency validation.
 */

import { createHash } from "node:crypto";

/**
 * Timestamp field names that should be normalized for consistent hashing
 */
export const TIMESTAMP_FIELD_NAMES = new Set([
  "timestamp",
  "createdat",
  "updatedat",
  "modifiedat",
  "date",
  "time",
  "created_at",
  "updated_at",
  "modified_at",
  "processed_at",
]);

/**
 * Check if a field name represents a timestamp
 */
export function isTimestampField(fieldName: string): boolean {
  return TIMESTAMP_FIELD_NAMES.has(fieldName.toLowerCase());
}

/**
 * Normalize Date value for hashing
 */
function normalizeDateValue(value: Date, ignoreTimestamps: boolean): string {
  return ignoreTimestamps ? "[TIMESTAMP]" : value.toISOString();
}

/**
 * Normalize object value for hashing with sorted keys
 */
function normalizeObjectValue(
  obj: Record<string, unknown>,
  ignoreTimestamps: boolean,
): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  const sortedKeys = Object.keys(obj).sort();

  for (const key of sortedKeys) {
    if (ignoreTimestamps && isTimestampField(key)) {
      normalized[key] = "[TIMESTAMP]";
    } else {
      normalized[key] = normalizeForHashing(obj[key], ignoreTimestamps);
    }
  }

  return normalized;
}

/**
 * Normalize value for consistent hashing (sort keys, handle timestamps)
 */
export function normalizeForHashing(value: unknown, ignoreTimestamps: boolean): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value.map((item) => normalizeForHashing(item, ignoreTimestamps));
  }
  if (value instanceof Date) {
    return normalizeDateValue(value, ignoreTimestamps);
  }
  return normalizeObjectValue(value as Record<string, unknown>, ignoreTimestamps);
}

/**
 * Hash any value for consistent comparison
 */
export function hashValue(value: unknown, ignoreTimestamps: boolean): string {
  let serialized: string;

  if (typeof value === "string") {
    serialized = value;
  } else if (Buffer.isBuffer(value)) {
    serialized = value.toString("base64");
  } else {
    // Normalize object for consistent hashing
    serialized = JSON.stringify(normalizeForHashing(value, ignoreTimestamps));
  }

  return createHash("sha256").update(serialized, "utf8").digest("hex");
}

/**
 * Generate cache key for operation and inputs
 */
export function generateCacheKey<T>(
  operation: string,
  inputs: T,
  ignoreTimestamps: boolean,
): string {
  const inputHash = hashValue(inputs, ignoreTimestamps);
  return `${operation}:${inputHash}`;
}

/**
 * Build cache key from an existing record
 */
export function buildCacheKeyFromRecord(record: { operation: string; inputHash: string }): string {
  return `${record.operation}:${record.inputHash}`;
}

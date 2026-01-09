/**
 * @module util/db/description-extractor
 * Artifact description extraction utilities.
 */

import { eq, isNull } from "drizzle-orm";
import type { DatabaseDriver, SpecWorkbenchDrizzle } from "../../db/client";
import { artifacts } from "../../db/schema";
import { logger } from "../../io/utils";

/**
 * Normalizes a description value to a trimmed string or null.
 */
function tryNormalizeDescription(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return null;
    }
    return trimmed.length > 512 ? `${trimmed.slice(0, 509)}...` : trimmed;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if ("description" in record) {
      return tryNormalizeDescription(record.description);
    }
    if ("summary" in record) {
      return tryNormalizeDescription(record.summary);
    }
  }

  return null;
}

/**
 * Extracts a description from artifact metadata.
 */
export function extractDescriptionFromMetadata(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const meta = metadata as Record<string, unknown>;
  const prioritizedKeys = [
    "description",
    "summary",
    "details",
    "info",
    "package",
    "documentation",
    "doc",
    "metadata",
  ];

  for (const key of Object.keys(meta)) {
    const value = meta[key];
    const normalizedKey = key.toLowerCase();

    if (normalizedKey.includes("description") || normalizedKey === "summary") {
      const normalized = tryNormalizeDescription(value);
      if (normalized) {
        return normalized;
      }
    }

    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      prioritizedKeys.includes(normalizedKey)
    ) {
      const nested = extractDescriptionFromMetadata(value);
      if (nested) {
        return nested;
      }
    }
  }

  for (const key of Object.keys(meta)) {
    const value = meta[key];
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      continue;
    }

    const nested = extractDescriptionFromMetadata(value);
    if (nested) {
      return nested;
    }
  }

  return null;
}

/**
 * Backfills artifact descriptions from metadata.
 */
export async function backfillArtifactDescriptions(
  drizzle: SpecWorkbenchDrizzle,
  driver: DatabaseDriver,
  withTransaction: <T>(fn: (tx: SpecWorkbenchDrizzle) => Promise<T>) => Promise<T>,
): Promise<void> {
  const orm = drizzle as any;
  const rows = await orm
    .select({
      id: artifacts.id,
      description: artifacts.description,
      metadata: artifacts.metadata,
    })
    .from(artifacts)
    .where(isNull(artifacts.description));

  if (rows.length === 0) {
    return;
  }

  const updates: Array<{ id: string; description: string }> = [];

  for (const row of rows) {
    if (!row.metadata) {
      continue;
    }

    try {
      const parsed = JSON.parse(row.metadata) as unknown;
      const description = extractDescriptionFromMetadata(parsed);
      if (description) {
        updates.push({ id: row.id, description });
      }
    } catch (error) {
      logger.debug("Failed to parse artifact metadata during backfill", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (updates.length === 0) {
    return;
  }

  if (driver === "bun-sqlite") {
    await withTransaction(async (tx) => {
      for (const update of updates) {
        await tx
          .update(artifacts)
          .set({ description: update.description })
          .where(eq(artifacts.id, update.id));
      }
    });
    return;
  }

  for (const update of updates) {
    await drizzle
      .update(artifacts)
      .set({ description: update.description })
      .where(eq(artifacts.id, update.id));
  }
}

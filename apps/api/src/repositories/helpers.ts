import type { SQL } from "drizzle-orm";
import { eq, gte } from "drizzle-orm";
import { events, type ArtifactRow, type EventRow, type ProjectRow } from "../db/schema";
import { logger } from "../io/utils";
import type { Event, EventType } from "../util/types";
import type { DbProject, WithMetadata } from "./types";

/** Safely parse JSON string, returning fallback on error */
function safeJsonParse<T>(
  json: string | null | undefined,
  fallback: T,
  context: { id: string; type: string },
): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch (error) {
    logger.warn(`Failed to parse ${context.type}`, {
      id: context.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return fallback;
  }
}

export function mapProjectRow(row: ProjectRow): DbProject {
  return {
    id: row.id,
    name: row.name,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
    service_count: row.serviceCount ?? 0,
    database_count: row.databaseCount ?? 0,
    event_head_id: row.eventHeadId ?? null,
  };
}

export function parseEventData(row: EventRow): Record<string, unknown> {
  if (!row.data) return {};
  if (typeof row.data !== "string") return row.data as Record<string, unknown>;
  return safeJsonParse(row.data, {}, { id: row.id, type: "event data" });
}

export function mapEventRow(row: EventRow): Event {
  return {
    id: row.id,
    project_id: row.projectId,
    event_type: row.eventType as EventType,
    data: parseEventData(row),
    is_active: Boolean(row.isActive),
    reverted_at: row.revertedAt ?? null,
    created_at: row.createdAt,
  };
}

export function mapArtifactRow(row: ArtifactRow): WithMetadata<any> {
  const metadata = safeJsonParse<Record<string, unknown> | null>(row.metadata, null, {
    id: row.id,
    type: "artifact metadata",
  });

  if (metadata) {
    metadata.artifactId = row.id;
  }

  return { ...row, metadata };
}

/** Extract rows affected count from database result */
export function getRowsAffected(result: unknown): number {
  if (!result || typeof result !== "object") return 0;
  const r = result as Record<string, unknown>;
  if (typeof r.rowsAffected === "number") return r.rowsAffected;
  if (typeof r.changes === "number") return r.changes;
  return 0;
}

export function toSqliteTimestamp(iso: string): string {
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return date.toISOString().replace("T", " ").replace("Z", "").split(".")[0]!;
  } catch {
    return iso;
  }
}

export function buildEventFilters(
  projectId: string,
  since?: string,
  includeDangling = true,
): SQL[] {
  const conditions: SQL[] = [eq(events.projectId, projectId)];
  if (since) conditions.push(gte(events.createdAt, toSqliteTimestamp(since)));
  if (!includeDangling) conditions.push(eq(events.isActive, 1));
  return conditions;
}

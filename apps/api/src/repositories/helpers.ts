import type { SQL } from "drizzle-orm";
import { and, eq, gte } from "drizzle-orm";
import { events, type ArtifactRow, type EventRow, type ProjectRow, projects } from "../db/schema";
import type { Event, EventType } from "../types";
import { logger } from "../utils";
import type { DbProject, WithMetadata } from "./types";

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
  if (typeof row.data === "string") {
    try {
      return JSON.parse(row.data) as Record<string, unknown>;
    } catch (error) {
      logger.warn("Failed to parse event data", {
        eventId: row.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return {};
    }
  }

  return row.data as Record<string, unknown>;
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
  let metadata: Record<string, unknown> | null = null;
  if (row.metadata) {
    try {
      metadata = JSON.parse(row.metadata) as Record<string, unknown>;
      if (metadata && typeof metadata === "object") {
        (metadata as Record<string, unknown>).artifactId = row.id;
      }
    } catch (error) {
      logger.warn("Failed to parse artifact metadata", {
        artifactId: row.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    ...row,
    metadata,
  };
}

export function getRowsAffected(result: unknown): number {
  if (!result || typeof result !== "object") return 0;

  if ("rowsAffected" in result && typeof (result as any).rowsAffected === "number") {
    return (result as { rowsAffected: number }).rowsAffected;
  }

  if ("changes" in result && typeof (result as any).changes === "number") {
    return (result as { changes: number }).changes;
  }

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

  if (since) {
    conditions.push(gte(events.createdAt, toSqliteTimestamp(isoFallback(since))));
  }

  if (!includeDangling) {
    conditions.push(eq(events.isActive, 1));
  }

  return conditions;
}

function isoFallback(value: string): string {
  // Be forgiving for invalid ISO strings by passing through unchanged
  return value;
}

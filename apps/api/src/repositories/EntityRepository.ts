import { createHash, randomUUID } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import type { SpecWorkbenchDrizzle } from "../db/client";
import { type EntityRevisionRow, type EntityRow, entities, entityRevisions } from "../db/schema";
import { getRowsAffected } from "./helpers";

/** Types of changes tracked in entity revisions */
export type ChangeType = "created" | "updated" | "renamed" | "moved";

/** Input data for creating or updating an entity */
export interface EntityData {
  /** UUID identifier (auto-generated if not provided) */
  id?: string;
  /** Entity type (service, client, schema, flow, etc.) */
  type: string;
  /** Key/slug in the spec */
  slug: string;
  /** Location in spec (e.g., "services.invoiceService") */
  path?: string | null;
  /** Human-readable name */
  name: string;
  /** Entity description */
  description?: string | null;
  /** Full entity data as JSON-serializable object */
  data: Record<string, unknown>;
  /** Optional link to source CUE fragment */
  fragmentId?: string | null;
}

/** Entity with optional revision history */
export interface EntityWithRevisions extends EntityRow {
  revisions?: EntityRevisionRow[];
}

/** Mapped entity for API responses */
export interface MappedEntity {
  id: string;
  projectId: string;
  type: string;
  slug: string;
  path: string | null;
  name: string;
  description: string | null;
  contentHash: string;
  data: Record<string, unknown>;
  headRevisionId: string | null;
  fragmentId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Compute SHA-256 hash of entity data */
function computeContentHash(data: Record<string, unknown>): string {
  // Sort keys for deterministic hashing
  const sorted = JSON.stringify(data, Object.keys(data).sort());
  return createHash("sha256").update(sorted).digest("hex");
}

/** Parse JSON data from database row */
function parseEntityData(row: EntityRow): Record<string, unknown> {
  if (!row.data) return {};
  try {
    return JSON.parse(row.data) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** Map database row to API response format */
function mapEntityRow(row: EntityRow): MappedEntity {
  return {
    id: row.id,
    projectId: row.projectId,
    type: row.type,
    slug: row.slug,
    path: row.path,
    name: row.name,
    description: row.description,
    contentHash: row.contentHash,
    data: parseEntityData(row),
    headRevisionId: row.headRevisionId,
    fragmentId: row.fragmentId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class EntityRepository {
  constructor(private readonly drizzle: SpecWorkbenchDrizzle) {}

  /**
   * Create a new entity with initial revision
   */
  async createEntity(
    projectId: string,
    entity: EntityData,
    author?: string,
    message?: string,
  ): Promise<MappedEntity> {
    const entityId = entity.id || randomUUID();
    const contentHash = computeContentHash(entity.data);
    const revisionId = randomUUID();
    const dataJson = JSON.stringify(entity.data);

    // Insert entity
    const [created] = await this.drizzle
      .insert(entities)
      .values({
        id: entityId,
        projectId,
        type: entity.type,
        slug: entity.slug,
        path: entity.path ?? null,
        name: entity.name,
        description: entity.description ?? null,
        contentHash,
        data: dataJson,
        fragmentId: entity.fragmentId ?? null,
        headRevisionId: revisionId,
      })
      .returning();

    if (!created) throw new Error("Failed to create entity");

    // Create initial revision
    await this.drizzle.insert(entityRevisions).values({
      id: revisionId,
      entityId,
      revisionNumber: 1,
      contentHash,
      data: dataJson,
      changeType: "created",
      author: author ?? null,
      message: message ?? "Initial entity creation",
    });

    return mapEntityRow(created);
  }

  /**
   * Update an entity, creating a new revision
   * Detects renames (same ID, different slug) and moves (different path)
   */
  async updateEntity(
    projectId: string,
    entityId: string,
    updates: Partial<EntityData>,
    author?: string,
    message?: string,
  ): Promise<MappedEntity> {
    const [existing] = await this.drizzle
      .select()
      .from(entities)
      .where(and(eq(entities.projectId, projectId), eq(entities.id, entityId)))
      .limit(1);

    if (!existing) throw new Error("Entity not found");

    const existingData = parseEntityData(existing);
    const newData = updates.data ? { ...existingData, ...updates.data } : existingData;
    const newContentHash = computeContentHash(newData);
    const dataJson = JSON.stringify(newData);

    // Detect change type
    let changeType: ChangeType = "updated";
    let previousSlug: string | null = null;
    let previousPath: string | null = null;

    if (updates.slug && updates.slug !== existing.slug) {
      changeType = "renamed";
      previousSlug = existing.slug;
    }
    if (updates.path !== undefined && updates.path !== existing.path) {
      if (changeType === "updated") changeType = "moved";
      previousPath = existing.path;
    }

    // Skip if no actual changes to content
    if (newContentHash === existing.contentHash && changeType === "updated") {
      // Check if metadata fields changed (slug, path, name)
      const slugChanged = updates.slug && updates.slug !== existing.slug;
      const pathChanged = updates.path !== undefined && updates.path !== existing.path;
      const nameChanged = updates.name && updates.name !== existing.name;

      if (!slugChanged && !pathChanged && !nameChanged) {
        return mapEntityRow(existing);
      }
    }

    // Get next revision number
    const revResults = await this.drizzle
      .select()
      .from(entityRevisions)
      .where(eq(entityRevisions.entityId, entityId));
    const maxRevision = revResults.reduce((max, r) => Math.max(max, r.revisionNumber ?? 0), 0);
    const nextRevision = maxRevision + 1;

    const revisionId = randomUUID();

    // Create new revision
    await this.drizzle.insert(entityRevisions).values({
      id: revisionId,
      entityId,
      revisionNumber: nextRevision,
      contentHash: newContentHash,
      data: dataJson,
      changeType,
      previousSlug,
      previousPath,
      author: author ?? null,
      message: message ?? null,
    });

    // Update entity
    const result = await this.drizzle
      .update(entities)
      .set({
        slug: updates.slug ?? existing.slug,
        path: updates.path !== undefined ? updates.path : existing.path,
        name: updates.name ?? existing.name,
        description: updates.description !== undefined ? updates.description : existing.description,
        contentHash: newContentHash,
        data: dataJson,
        headRevisionId: revisionId,
        fragmentId: updates.fragmentId !== undefined ? updates.fragmentId : existing.fragmentId,
        updatedAt: sql`(strftime('%Y-%m-%d %H:%M:%f', 'now'))`,
      })
      .where(eq(entities.id, entityId))
      .returning();

    const updated = result[0];
    if (!updated) throw new Error("Failed to update entity");

    return mapEntityRow(updated);
  }

  /**
   * Get a single entity by ID
   */
  async getEntity(projectId: string, entityId: string): Promise<MappedEntity | null> {
    const [entity] = await this.drizzle
      .select()
      .from(entities)
      .where(and(eq(entities.projectId, projectId), eq(entities.id, entityId)))
      .limit(1);
    return entity ? mapEntityRow(entity) : null;
  }

  /**
   * Get entity by type and slug
   */
  async getEntityBySlug(
    projectId: string,
    type: string,
    slug: string,
  ): Promise<MappedEntity | null> {
    const [entity] = await this.drizzle
      .select()
      .from(entities)
      .where(
        and(eq(entities.projectId, projectId), eq(entities.type, type), eq(entities.slug, slug)),
      )
      .limit(1);
    return entity ? mapEntityRow(entity) : null;
  }

  /**
   * List entities for a project, optionally filtered by type
   */
  async listEntities(projectId: string, type?: string): Promise<MappedEntity[]> {
    const conditions = [eq(entities.projectId, projectId)];
    if (type) conditions.push(eq(entities.type, type));

    const rows = await this.drizzle
      .select()
      .from(entities)
      .where(and(...conditions))
      .orderBy(entities.type, entities.slug);

    return rows.map(mapEntityRow);
  }

  /**
   * Get all revisions for an entity
   */
  async getEntityRevisions(entityId: string): Promise<EntityRevisionRow[]> {
    return this.drizzle
      .select()
      .from(entityRevisions)
      .where(eq(entityRevisions.entityId, entityId))
      .orderBy(desc(entityRevisions.revisionNumber));
  }

  /**
   * Get entity at a specific revision
   */
  async getEntityAtRevision(
    entityId: string,
    revisionNumber: number,
  ): Promise<EntityRevisionRow | null> {
    const [revision] = await this.drizzle
      .select()
      .from(entityRevisions)
      .where(
        and(
          eq(entityRevisions.entityId, entityId),
          eq(entityRevisions.revisionNumber, revisionNumber),
        ),
      )
      .limit(1);
    return revision ?? null;
  }

  /**
   * Delete an entity and all its revisions
   */
  async deleteEntity(projectId: string, entityId: string): Promise<boolean> {
    const result = await this.drizzle
      .delete(entities)
      .where(and(eq(entities.projectId, projectId), eq(entities.id, entityId)));
    return getRowsAffected(result) > 0;
  }

  /**
   * Delete all entities for a project
   */
  async deleteEntities(projectId: string): Promise<void> {
    await this.drizzle.delete(entities).where(eq(entities.projectId, projectId));
  }

  /**
   * Check if entity exists by ID
   */
  async entityExists(projectId: string, entityId: string): Promise<boolean> {
    const [result] = await this.drizzle
      .select()
      .from(entities)
      .where(and(eq(entities.projectId, projectId), eq(entities.id, entityId)))
      .limit(1);
    return !!result;
  }
}

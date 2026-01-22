import { logger } from "../io/utils";
import { EntityRepository, type MappedEntity } from "../repositories/EntityRepository";
import { type ExtractedEntity, extractEntitiesFromSpec } from "./EntityExtractor";

/**
 * Result of a sync operation
 */
export interface SyncResult {
  /** IDs of newly created entities */
  created: string[];
  /** IDs of updated entities (includes renames - slug changes with same ID) */
  updated: string[];
  /** IDs of deleted entities */
  deleted: string[];
  /** IDs of unchanged entities */
  unchanged: string[];
  /** Errors encountered during sync */
  errors: Array<{ entityId?: string; slug?: string; error: string }>;
}

/**
 * Service for synchronizing entities extracted from CUE specs to the database
 */
export class EntitySyncService {
  constructor(private readonly entityRepo: EntityRepository) {}

  /**
   * Sync entities from a resolved CUE spec to the database
   *
   * Algorithm:
   * 1. Extract entities from resolved spec (only those with entityId)
   * 2. Get existing entities from database
   * 3. For each extracted entity:
   *    - If entity with this ID exists: update it (handles renames naturally)
   *    - If no entity with this ID: create it
   * 4. For existing entities whose ID is not in spec: delete
   *
   * Note: Clients must provide entityId in CUE specs. Entities without
   * entityId are not tracked.
   */
  async syncEntities(
    projectId: string,
    resolved: Record<string, unknown>,
    author?: string,
    message?: string,
  ): Promise<SyncResult> {
    const result: SyncResult = {
      created: [],
      updated: [],
      deleted: [],
      unchanged: [],
      errors: [],
    };

    // Extract entities from resolved spec (only those with entityId)
    const extracted = extractEntitiesFromSpec(resolved);

    // Get existing entities from database
    const existing = await this.entityRepo.listEntities(projectId);

    // Build lookup maps by ID
    const existingById = new Map<string, MappedEntity>();
    for (const entity of existing) {
      existingById.set(entity.id, entity);
    }

    const extractedById = new Map<string, ExtractedEntity>();
    for (const entity of extracted) {
      extractedById.set(entity.id, entity);
    }

    // Process each extracted entity
    for (const entity of extracted) {
      try {
        const existingEntity = existingById.get(entity.id);

        if (existingEntity) {
          // Entity exists - check for updates
          const wasUpdated = await this.updateIfChanged(
            projectId,
            existingEntity,
            entity,
            author,
            message,
          );
          if (wasUpdated) {
            result.updated.push(entity.id);
          } else {
            result.unchanged.push(entity.id);
          }
        } else {
          // New entity - create it
          const created = await this.entityRepo.createEntity(
            projectId,
            {
              id: entity.id,
              type: entity.type,
              slug: entity.slug,
              path: entity.path,
              name: entity.name,
              description: entity.description,
              data: entity.data,
            },
            author,
            message || "Created from spec sync",
          );
          result.created.push(created.id);
        }
      } catch (error) {
        logger.error("Entity sync error", undefined, {
          projectId,
          entityId: entity.id,
          slug: entity.slug,
          error: error instanceof Error ? error.message : String(error),
        });
        result.errors.push({
          entityId: entity.id,
          slug: entity.slug,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    // Delete entities that exist in DB but not in spec
    for (const existingEntity of existing) {
      if (!extractedById.has(existingEntity.id)) {
        try {
          await this.entityRepo.deleteEntity(projectId, existingEntity.id);
          result.deleted.push(existingEntity.id);
        } catch (error) {
          logger.error("Entity delete error", undefined, {
            projectId,
            entityId: existingEntity.id,
            error: error instanceof Error ? error.message : String(error),
          });
          result.errors.push({
            entityId: existingEntity.id,
            slug: existingEntity.slug,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }
    }

    logger.info("Entity sync completed", {
      projectId,
      created: result.created.length,
      updated: result.updated.length,
      deleted: result.deleted.length,
      unchanged: result.unchanged.length,
      errors: result.errors.length,
    });

    return result;
  }

  /**
   * Update entity if content has changed
   * Returns true if entity was updated, false if unchanged
   */
  private async updateIfChanged(
    projectId: string,
    existing: MappedEntity,
    extracted: ExtractedEntity,
    author?: string,
    message?: string,
  ): Promise<boolean> {
    // Check if any tracked fields changed
    const contentChanged = this.hasContentChanged(existing, extracted);
    const metadataChanged =
      existing.path !== extracted.path ||
      existing.name !== extracted.name ||
      existing.description !== extracted.description;

    if (!contentChanged && !metadataChanged) {
      return false;
    }

    await this.entityRepo.updateEntity(
      projectId,
      existing.id,
      {
        path: extracted.path,
        name: extracted.name,
        description: extracted.description,
        data: extracted.data,
      },
      author,
      message || "Updated from spec sync",
    );

    return true;
  }

  /**
   * Check if entity content has changed
   * Compares data objects, ignoring entityId, createdAt, updatedAt
   */
  private hasContentChanged(existing: MappedEntity, extracted: ExtractedEntity): boolean {
    // Create normalized copies without metadata fields
    const normalizeData = (data: Record<string, unknown>) => {
      const { entityId, createdAt, updatedAt, ...rest } = data;
      return rest;
    };

    const existingNormalized = normalizeData(existing.data);
    const extractedNormalized = normalizeData(extracted.data);

    // Sort keys for consistent comparison
    const sortedExisting = JSON.stringify(
      existingNormalized,
      Object.keys(existingNormalized).sort(),
    );
    const sortedExtracted = JSON.stringify(
      extractedNormalized,
      Object.keys(extractedNormalized).sort(),
    );

    return sortedExisting !== sortedExtracted;
  }
}

/**
 * Entity router for entity-level tracking endpoints.
 * Provides access to entities with UUID tracking and revision history.
 */
import { Hono } from "hono";
import type { Context } from "hono";
import { logger } from "../../io/utils";
import type { EntityRepository } from "../../repositories/EntityRepository";
import type { SpecWorkbenchDB } from "../../util/db";

type Dependencies = Record<string, unknown>;

/**
 * Handle GET /entities endpoint.
 * Lists all entities for a project, optionally filtered by type.
 */
async function handleListEntities(c: Context, entityRepo: EntityRepository | null) {
  if (!entityRepo) {
    return c.json({ success: false, error: "Database service unavailable" }, { status: 500 });
  }

  const projectId = c.req.query("projectId") ?? c.req.query("project_id");
  if (!projectId || projectId.trim().length === 0) {
    return c.json(
      { success: false, error: "projectId query parameter is required" },
      { status: 400 },
    );
  }

  const type = c.req.query("type");
  const entities = await entityRepo.listEntities(projectId, type || undefined);

  return c.json({
    success: true,
    entities,
    count: entities.length,
  });
}

/**
 * Handle GET /entities/:entityId endpoint.
 * Get a single entity by ID.
 */
async function handleGetEntity(c: Context, entityRepo: EntityRepository | null) {
  if (!entityRepo) {
    return c.json({ success: false, error: "Database service unavailable" }, { status: 500 });
  }

  const projectId = c.req.query("projectId") ?? c.req.query("project_id");
  if (!projectId || projectId.trim().length === 0) {
    return c.json(
      { success: false, error: "projectId query parameter is required" },
      { status: 400 },
    );
  }

  const entityId = c.req.param("entityId");
  const entity = await entityRepo.getEntity(projectId, entityId);

  if (!entity) {
    return c.json({ success: false, error: "Entity not found" }, { status: 404 });
  }

  return c.json({ success: true, entity });
}

/**
 * Handle GET /entities/:entityId/revisions endpoint.
 * Get revision history for an entity.
 */
async function handleGetEntityRevisions(c: Context, entityRepo: EntityRepository | null) {
  if (!entityRepo) {
    return c.json({ success: false, error: "Database service unavailable" }, { status: 500 });
  }

  const projectId = c.req.query("projectId") ?? c.req.query("project_id");
  if (!projectId || projectId.trim().length === 0) {
    return c.json(
      { success: false, error: "projectId query parameter is required" },
      { status: 400 },
    );
  }

  const entityId = c.req.param("entityId");

  // Verify entity exists and belongs to project
  const entity = await entityRepo.getEntity(projectId, entityId);
  if (!entity) {
    return c.json({ success: false, error: "Entity not found" }, { status: 404 });
  }

  const revisions = await entityRepo.getEntityRevisions(entityId);

  return c.json({
    success: true,
    entity: {
      id: entity.id,
      type: entity.type,
      slug: entity.slug,
      name: entity.name,
    },
    revisions,
    count: revisions.length,
  });
}

/**
 * Handle GET /entities/:entityId/revisions/:revisionNumber endpoint.
 * Get entity at a specific revision.
 */
async function handleGetEntityAtRevision(c: Context, entityRepo: EntityRepository | null) {
  if (!entityRepo) {
    return c.json({ success: false, error: "Database service unavailable" }, { status: 500 });
  }

  const projectId = c.req.query("projectId") ?? c.req.query("project_id");
  if (!projectId || projectId.trim().length === 0) {
    return c.json(
      { success: false, error: "projectId query parameter is required" },
      { status: 400 },
    );
  }

  const entityId = c.req.param("entityId");
  const revisionNumber = parseInt(c.req.param("revisionNumber"), 10);

  if (isNaN(revisionNumber) || revisionNumber < 1) {
    return c.json({ success: false, error: "Invalid revision number" }, { status: 400 });
  }

  // Verify entity exists and belongs to project
  const entity = await entityRepo.getEntity(projectId, entityId);
  if (!entity) {
    return c.json({ success: false, error: "Entity not found" }, { status: 404 });
  }

  const revision = await entityRepo.getEntityAtRevision(entityId, revisionNumber);
  if (!revision) {
    return c.json({ success: false, error: "Revision not found" }, { status: 404 });
  }

  return c.json({
    success: true,
    entity: {
      id: entity.id,
      type: entity.type,
      slug: entity.slug,
      name: entity.name,
    },
    revision,
  });
}

/**
 * Create the entities router.
 */
export function createEntitiesRouter(deps: Dependencies) {
  const router = new Hono();
  const db = deps.db as SpecWorkbenchDB | undefined;
  const entityRepo = db?.entityRepository ?? null;

  router.get("/entities", async (c) => {
    try {
      return await handleListEntities(c, entityRepo);
    } catch (error) {
      logger.error("Failed to list entities", error instanceof Error ? error : undefined);
      return c.json({ success: false, error: "Failed to list entities" }, { status: 500 });
    }
  });

  router.get("/entities/:entityId", async (c) => {
    try {
      return await handleGetEntity(c, entityRepo);
    } catch (error) {
      logger.error("Failed to get entity", error instanceof Error ? error : undefined);
      return c.json({ success: false, error: "Failed to get entity" }, { status: 500 });
    }
  });

  router.get("/entities/:entityId/revisions", async (c) => {
    try {
      return await handleGetEntityRevisions(c, entityRepo);
    } catch (error) {
      logger.error("Failed to get entity revisions", error instanceof Error ? error : undefined);
      return c.json({ success: false, error: "Failed to get entity revisions" }, { status: 500 });
    }
  });

  router.get("/entities/:entityId/revisions/:revisionNumber", async (c) => {
    try {
      return await handleGetEntityAtRevision(c, entityRepo);
    } catch (error) {
      logger.error("Failed to get entity at revision", error instanceof Error ? error : undefined);
      return c.json({ success: false, error: "Failed to get entity at revision" }, { status: 500 });
    }
  });

  return router;
}

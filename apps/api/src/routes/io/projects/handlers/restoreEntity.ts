/**
 * POST /projects/:projectId/entities/:artifactId/restore handler
 */
import type { Context } from "hono";
import { broadcastEvent, restoreFromSnapshot } from "../helpers";
import type { Dependencies } from "../types";
import type { DbInstance } from "./types";

export async function handleRestoreEntity(c: Context, deps: Dependencies) {
  const projectId = c.req.param("projectId");
  const artifactId = c.req.param("artifactId");

  if (!projectId) {
    return c.json({ success: false, error: "Project ID is required" }, 400);
  }
  if (!artifactId) {
    return c.json({ success: false, error: "Artifact ID is required" }, 400);
  }

  const dbInstance = deps.db as DbInstance | undefined;
  if (!dbInstance?.createArtifact || !dbInstance?.getArtifact) {
    return c.json({ success: false, error: "Database unavailable" }, 500);
  }

  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: "Invalid JSON payload" }, 400);
  }

  const snapshot = body?.snapshot;
  if (!snapshot || typeof snapshot !== "object") {
    return c.json({ success: false, error: "Payload must include a snapshot object" }, 400);
  }

  try {
    const existing = await dbInstance.getArtifact(projectId, artifactId);
    if (existing) {
      return c.json({ success: false, error: "Artifact already exists" }, 409);
    }

    const restored = restoreFromSnapshot(snapshot as Record<string, unknown>);
    const artifact = await dbInstance.createArtifact(
      artifactId,
      projectId,
      restored.name,
      restored.description,
      restored.artifactType,
      restored.language,
      restored.framework,
      restored.metadata,
      restored.filePath,
      restored.confidence,
    );

    await broadcastEvent(deps, projectId, "entity_restored", {
      action: "entity_restored",
      source: "manual",
      entity_type: restored.entityType,
      artifact_type: restored.artifactType,
      artifact_id: artifactId,
      entity_id: artifactId,
      name: restored.name,
      description: restored.description,
      metadata: restored.metadata,
      snapshot,
      restored_from_event_id: body?.eventId,
      restored_at: new Date().toISOString(),
    });

    return c.json({ success: true, artifact });
  } catch (error) {
    console.error("Failed to restore artifact", error);
    return c.json({ success: false, error: "Failed to restore entity" }, 500);
  }
}

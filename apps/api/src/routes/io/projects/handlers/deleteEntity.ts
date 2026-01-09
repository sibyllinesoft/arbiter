/**
 * DELETE /projects/:projectId/entities/:artifactId handler
 */
import type { Context } from "hono";
import { broadcastEvent, buildArtifactSnapshot } from "../helpers";
import type { Dependencies } from "../types";
import type { ArtifactRecord, DbInstance } from "./types";

function extractEntityType(artifact: ArtifactRecord): string {
  const meta = artifact.metadata as Record<string, unknown> | undefined;
  const classification = meta?.classification as Record<string, unknown> | undefined;
  return (
    (classification?.detectedType as string) ??
    (meta?.detectedType as string) ??
    (artifact.type as string)
  );
}

export async function handleDeleteEntity(c: Context, deps: Dependencies) {
  const projectId = c.req.param("projectId");
  const artifactId = c.req.param("artifactId");

  if (!projectId) {
    return c.json({ success: false, error: "Project ID is required" }, 400);
  }
  if (!artifactId) {
    return c.json({ success: false, error: "Artifact ID is required" }, 400);
  }

  const dbInstance = deps.db as DbInstance | undefined;
  if (!dbInstance?.deleteArtifact || !dbInstance?.getArtifact) {
    return c.json({ success: false, error: "Database unavailable" }, 500);
  }

  try {
    const existing = (await dbInstance.getArtifact(projectId, artifactId)) as ArtifactRecord;
    if (!existing) {
      return c.json({ success: false, error: "Artifact not found" }, 404);
    }

    const deleted = await dbInstance.deleteArtifact(projectId, artifactId);
    if (!deleted) {
      return c.json({ success: false, error: "Artifact not found" }, 404);
    }

    const entityType = extractEntityType(existing);
    const snapshot = buildArtifactSnapshot(existing);

    await broadcastEvent(deps, projectId, "entity_deleted", {
      action: "entity_deleted",
      source: "manual",
      entity_type: entityType,
      artifact_type: existing.type,
      artifact_id: artifactId,
      entity_id: artifactId,
      name: existing.name,
      description: existing.description,
      metadata: existing.metadata ?? {},
      snapshot,
      deleted_at: new Date().toISOString(),
    });

    return c.json({ success: true, artifactId });
  } catch (error) {
    console.error("Failed to delete artifact", error);
    return c.json({ success: false, error: "Failed to delete entity" }, 500);
  }
}

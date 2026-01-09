/**
 * PUT /projects/:projectId/entities/:artifactId handler
 */
import type { Context } from "hono";
import {
  SUPPORTED_ENTITY_TYPES,
  buildManualArtifactPayload,
  normalizeMetadata,
  slugify,
} from "../../../helpers/projects-helpers";
import { broadcastEvent, cleanupMetadataKeys } from "../helpers";
import type { Dependencies } from "../types";
import type { ArtifactRecord, DbInstance } from "./types";

function computeSlugFallback(
  values: Record<string, unknown>,
  existingMeta: Record<string, unknown>,
  existingArtifact: ArtifactRecord,
  type: string,
): string {
  const candidates = [
    values?.slug,
    values?.id,
    existingMeta?.slug,
    existingMeta?.id,
    existingArtifact.name,
  ].filter((c): c is string => typeof c === "string" && c.trim().length > 0);

  return candidates[0] ?? `${type}-${Date.now()}`;
}

export async function handleUpdateEntity(c: Context, deps: Dependencies) {
  const projectId = c.req.param("projectId");
  const artifactId = c.req.param("artifactId");

  if (!artifactId) {
    return c.json({ success: false, error: "Artifact ID is required" }, 400);
  }

  const dbInstance = deps.db as DbInstance | undefined;
  if (!dbInstance?.getArtifact || !dbInstance?.updateArtifact) {
    return c.json({ success: false, error: "Database unavailable" }, 500);
  }

  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: "Invalid JSON payload" }, 400);
  }

  const type = typeof body?.type === "string" ? body.type.toLowerCase() : "";
  const values = body?.values as Record<string, unknown> | undefined;

  if (!type || !values || typeof values !== "object") {
    return c.json(
      { success: false, error: 'Payload must include "type" and "values" fields' },
      400,
    );
  }
  if (!SUPPORTED_ENTITY_TYPES.has(type)) {
    return c.json({ success: false, error: `Unsupported entity type: ${type}` }, 400);
  }

  const existingArtifact = (await dbInstance.getArtifact(projectId, artifactId)) as ArtifactRecord;
  if (!existingArtifact) {
    return c.json({ success: false, error: "Artifact not found" }, 404);
  }

  const existingMeta =
    existingArtifact.metadata && typeof existingArtifact.metadata === "object"
      ? { ...(existingArtifact.metadata as Record<string, unknown>) }
      : {};

  const slugFallback = computeSlugFallback(values, existingMeta, existingArtifact, type);
  const slug = slugify(values?.name as string | undefined, slugFallback);
  const payload = buildManualArtifactPayload(type, values, slug);

  if (!payload) {
    return c.json({ success: false, error: `Unable to construct payload for type: ${type}` }, 400);
  }
  if (existingArtifact.type !== payload.artifactType) {
    return c.json(
      {
        success: false,
        error: `Type mismatch: existing ${existingArtifact.type}, received ${payload.artifactType}`,
      },
      400,
    );
  }

  const mergedMeta = normalizeMetadata({
    ...existingMeta,
    ...(normalizeMetadata(payload.metadata) ?? {}),
  });
  cleanupMetadataKeys(mergedMeta, values);

  try {
    const updatedArtifact = await dbInstance.updateArtifact(projectId, artifactId, {
      name: payload.name,
      description: payload.description ?? null,
      type: payload.artifactType,
      language: payload.language ?? existingArtifact.language ?? null,
      framework: payload.framework ?? existingArtifact.framework ?? null,
      metadata: mergedMeta,
      filePath: payload.filePath ?? existingArtifact.file_path ?? existingArtifact.filePath ?? null,
      confidence: existingArtifact.confidence ?? 0.95,
    });

    await broadcastEvent(deps, projectId, "entity_updated", {
      action: "entity_updated",
      source: "manual",
      entity_type: type,
      artifact_type: payload.artifactType,
      artifact_id: artifactId,
      entity_id: artifactId,
      name: payload.name,
      description: payload.description,
      values,
      metadata: mergedMeta,
    });

    return c.json({ success: true, artifact: updatedArtifact });
  } catch (error) {
    console.error("Failed to update artifact", error);
    return c.json({ success: false, error: "Failed to update entity" }, 500);
  }
}

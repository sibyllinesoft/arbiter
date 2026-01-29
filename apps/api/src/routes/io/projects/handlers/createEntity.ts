/**
 * POST /projects/:projectId/entities handler
 */
import { randomUUID } from "node:crypto";
import type { Context } from "hono";
import {
  SUPPORTED_ENTITY_TYPES,
  buildManualArtifactPayload,
  normalizeMetadata,
  slugify,
} from "../../../helpers/projects-helpers";
import { broadcastEvent } from "../helpers";
import type { Dependencies } from "../types";
import type { DbInstance } from "./types";

export async function handleCreateEntity(c: Context, deps: Dependencies) {
  const projectId = c.req.param("projectId");
  const dbInstance = deps.db as DbInstance | undefined;

  if (!dbInstance?.createArtifact) {
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

  const slug = slugify(values.name as string | undefined, `${type}-${Date.now()}`);
  const payload = buildManualArtifactPayload(type, values, slug);
  if (!payload) {
    return c.json({ success: false, error: `Unable to construct payload for type: ${type}` }, 400);
  }

  try {
    const artifactId = randomUUID();
    const metadata = normalizeMetadata(payload.metadata);
    if (metadata?.environment === null) delete metadata.environment;

    console.log(
      `[createEntity] Creating artifact: type=${type}, name=${payload.name}, projectId=${projectId}`,
    );

    const artifact = await dbInstance.createArtifact(
      artifactId,
      projectId,
      payload.name,
      payload.description,
      payload.artifactType,
      payload.language,
      payload.framework,
      metadata,
      payload.filePath,
      0.95,
    );

    console.log(`[createEntity] Created artifact:`, artifact);

    await broadcastEvent(deps, projectId, "entity_created", {
      action: "entity_created",
      source: "manual",
      entity_type: type,
      artifact_type: payload.artifactType,
      artifact_id: artifactId,
      entity_id: artifactId,
      name: payload.name,
      description: payload.description,
      values,
      metadata,
    });

    return c.json({ success: true, artifact });
  } catch (error) {
    console.error("Failed to create artifact", error);
    return c.json({ success: false, error: "Failed to create entity" }, 500);
  }
}

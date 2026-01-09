/**
 * Simple artifact payload builders (tool, database, flow)
 */
import type { ManualArtifactPayload } from "./types";

/**
 * Build tool artifact payload with command metadata.
 */
export function buildToolPayload(
  values: Record<string, any>,
  _slug: string,
  name: string,
  description: string | null,
): ManualArtifactPayload {
  return {
    name,
    description,
    artifactType: "tool",
    metadata: {
      description,
      command: typeof values.command === "string" ? values.command.trim() : undefined,
      classification: { detectedType: "tool", reason: "manual-entry", source: "user" },
    },
  };
}

/**
 * Build database artifact payload with engine and version.
 */
export function buildDatabasePayload(
  values: Record<string, any>,
  _slug: string,
  name: string,
  description: string | null,
): ManualArtifactPayload {
  const engine =
    typeof values.engine === "string" ? values.engine.trim().toLowerCase() : "postgresql";
  const version = typeof values.version === "string" ? values.version.trim() : undefined;
  return {
    name,
    description,
    artifactType: "database",
    framework: engine,
    metadata: {
      description,
      engine,
      version,
      classification: { detectedType: "database", reason: "manual-entry", source: "user" },
    },
  };
}

/**
 * Build flow artifact payload.
 */
export function buildFlowPayload(
  _values: Record<string, any>,
  _slug: string,
  name: string,
  description: string | null,
): ManualArtifactPayload {
  return {
    name,
    description,
    artifactType: "flow",
    metadata: {
      description,
      classification: { detectedType: "flow", reason: "manual-entry", source: "user" },
    },
  };
}

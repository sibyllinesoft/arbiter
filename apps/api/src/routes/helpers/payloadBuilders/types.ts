/**
 * Shared types for payload builders
 */

/** Payload structure for manually created artifacts */
export interface ManualArtifactPayload {
  /** Display name for the artifact */
  name: string;
  /** Optional description text */
  description: string | null;
  /** Artifact type (service, frontend, database, etc.) */
  artifactType: string;
  /** Programming language */
  language?: string;
  /** Framework name */
  framework?: string;
  /** Additional metadata properties */
  metadata?: Record<string, unknown>;
  /** Source file path */
  filePath?: string;
}

/** Common payload builder function signature */
export type PayloadBuilder = (
  values: Record<string, any>,
  slug: string,
  name: string,
  description: string | null,
) => ManualArtifactPayload;

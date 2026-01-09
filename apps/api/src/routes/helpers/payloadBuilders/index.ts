import { buildFrontendPayload } from "./frontendBuilder";
import { buildInfrastructurePayload } from "./infrastructureBuilder";
import { buildPackagePayload } from "./packageBuilder";
import { buildRoutePayload, buildViewPayload } from "./routeViewBuilders";
import { buildServicePayload } from "./serviceBuilder";
import { coerceOptionalTrimmedString } from "./shared";
import { buildDatabasePayload, buildFlowPayload, buildToolPayload } from "./simpleBuilders";
/**
 * Payload builders index - exports all builders and utilities
 */
import type { ManualArtifactPayload, PayloadBuilder } from "./types";
import { buildCapabilityPayload, buildGroupPayload, buildTaskPayload } from "./workflowBuilders";

// Re-export types
export type { ManualArtifactPayload, PayloadBuilder } from "./types";

// Re-export shared utilities
export {
  slugify,
  guessLanguage,
  hasOwn,
  coerceOptionalTrimmedString,
  coerceEnvironmentMap,
  normalizeMetadata,
  toSlug,
  getDatabaseType,
} from "./shared";

/** Payload builder registry */
const PAYLOAD_BUILDERS: Record<string, PayloadBuilder> = {
  frontend: buildFrontendPayload,
  service: buildServicePayload,
  package: buildPackagePayload,
  tool: buildToolPayload,
  database: buildDatabasePayload,
  infrastructure: buildInfrastructurePayload,
  route: buildRoutePayload,
  view: buildViewPayload,
  flow: buildFlowPayload,
  capability: buildCapabilityPayload,
  group: buildGroupPayload,
  task: buildTaskPayload,
};

/** All supported manual entity types */
export const SUPPORTED_ENTITY_TYPES = new Set(Object.keys(PAYLOAD_BUILDERS));

/**
 * Builds artifact payload from manual entity input based on type.
 */
export function buildManualArtifactPayload(
  type: string,
  values: Record<string, any>,
  slug: string,
): ManualArtifactPayload | null {
  const builder = PAYLOAD_BUILDERS[type];
  if (!builder) return null;

  const name = coerceOptionalTrimmedString(values.name) ?? `${type}-${slug}`;
  const description = coerceOptionalTrimmedString(values.description) ?? null;

  return builder(values, slug, name, description);
}

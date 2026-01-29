/**
 * Payload builders index - exports all builders and utilities
 */
import {
  buildActorPayload,
  buildApiPayload,
  buildCachePayload,
  buildCliPayload,
  buildCloudPayload,
  buildComponentPayload,
  buildEndpointPayload,
  buildKubernetesPayload,
  buildMobilePayload,
  buildQueuePayload,
  buildStoragePayload,
  buildWorkerPayload,
} from "./c4Builders";
import { buildFrontendPayload } from "./frontendBuilder";
import { buildInfrastructurePayload } from "./infrastructureBuilder";
import { buildPackagePayload } from "./packageBuilder";
import { buildRoutePayload, buildViewPayload } from "./routeViewBuilders";
import { buildServicePayload } from "./serviceBuilder";
import { coerceOptionalTrimmedString } from "./shared";
import {
  buildDatabasePayload,
  buildFlowPayload,
  buildRelationshipPayload,
  buildToolPayload,
} from "./simpleBuilders";
import type { ManualArtifactPayload, PayloadBuilder } from "./types";
import {
  buildCapabilityPayload,
  buildGroupPayload,
  buildSystemPayload,
  buildTaskPayload,
} from "./workflowBuilders";

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
  // Core types
  service: buildServicePayload,
  database: buildDatabasePayload,
  frontend: buildFrontendPayload,
  package: buildPackagePayload,
  tool: buildToolPayload,
  infrastructure: buildInfrastructurePayload,
  // C4 System level
  actor: buildActorPayload,
  system: buildSystemPayload,
  cloud: buildCloudPayload,
  "cloud-aws": buildCloudPayload,
  "cloud-gcp": buildCloudPayload,
  "cloud-azure": buildCloudPayload,
  "cloud-cloudflare": buildCloudPayload,
  "cloud-vercel": buildCloudPayload,
  "cloud-custom": buildCloudPayload,
  // C4 Container level
  api: buildApiPayload,
  mobile: buildMobilePayload,
  cli: buildCliPayload,
  worker: buildWorkerPayload,
  kubernetes: buildKubernetesPayload,
  // Data stores
  cache: buildCachePayload,
  queue: buildQueuePayload,
  storage: buildStoragePayload,
  // Module level
  endpoint: buildEndpointPayload,
  route: buildRoutePayload,
  view: buildViewPayload,
  component: buildComponentPayload,
  // Workflow
  flow: buildFlowPayload,
  capability: buildCapabilityPayload,
  group: buildGroupPayload,
  task: buildTaskPayload,
  // Relationships/edges
  relationship: buildRelationshipPayload,
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

  const payload = builder(values, slug, name, description);

  // Add systemId to metadata if provided (for container-level entities inside a system)
  const systemId = coerceOptionalTrimmedString(values.systemId);
  if (systemId && payload.metadata) {
    payload.metadata.systemId = systemId;
  }

  return payload;
}

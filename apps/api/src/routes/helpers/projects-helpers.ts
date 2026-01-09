/**
 * Project helper utilities for data transformation and normalization
 * Re-exports from modular payload builders for backward compatibility
 */

// Re-export all utilities from payload builders
export {
  slugify,
  guessLanguage,
  hasOwn,
  coerceOptionalTrimmedString,
  coerceEnvironmentMap,
  normalizeMetadata,
  toSlug,
  getDatabaseType,
  SUPPORTED_ENTITY_TYPES,
  buildManualArtifactPayload,
} from "./payloadBuilders";

export type { ManualArtifactPayload } from "./payloadBuilders";

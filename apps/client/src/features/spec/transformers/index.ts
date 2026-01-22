/**
 * Spec transformers for normalizing CUE assembly data.
 * Provides functions to transform raw client and service data into structured formats.
 */
export {
  extractClientViews,
  isManualClient,
  createExternalArtifactCard as createClientExternalArtifactCard,
  normalizeClient,
} from "./clients";
export {
  buildEnvironmentMap,
  extractTypeLabel,
  normalizeEndpoints,
  normalizeService,
  createExternalArtifactCard as createServiceExternalArtifactCard,
  normalizeContainersAsExternalCards,
} from "./services";

/**
 * @module services/presets
 * Preset builders for project initialization.
 */
export {
  DEFAULT_STRUCTURE,
  type PresetArtifactInput,
  type PresetProjectData,
  type PresetBuilder,
} from "./types";
export { buildWebAppPreset } from "./web-app";
export { buildMobileAppPreset } from "./mobile-app";
export { buildApiServicePreset } from "./api-service";
export { buildMicroservicePreset } from "./microservice";

import { buildApiServicePreset } from "./api-service";
import { buildMicroservicePreset } from "./microservice";
import { buildMobileAppPreset } from "./mobile-app";
import type { PresetBuilder, PresetProjectData } from "./types";
import { buildWebAppPreset } from "./web-app";

const PRESET_BUILDERS: Record<string, PresetBuilder> = {
  "web-app": buildWebAppPreset,
  "mobile-app": buildMobileAppPreset,
  "api-service": buildApiServicePreset,
  microservice: buildMicroservicePreset,
};

export class PresetService {
  listPresetIds(): string[] {
    return Object.keys(PRESET_BUILDERS);
  }

  getPreset(id: string, projectId: string, projectName: string): PresetProjectData {
    const builder = PRESET_BUILDERS[id];
    if (!builder) {
      throw new Error(`Unknown preset: ${id}`);
    }
    return builder(projectId, projectName);
  }
}

export const presetService = new PresetService();

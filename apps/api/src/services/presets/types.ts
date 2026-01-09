/**
 * @module services/presets/types
 * Type definitions for preset builders.
 */

export interface PresetArtifactInput {
  name: string;
  type: string;
  description?: string | null;
  language?: string | null;
  framework?: string | null;
  metadata?: Record<string, unknown>;
  filePath?: string | null;
}

export interface PresetProjectData {
  resolvedSpec: Record<string, unknown>;
  artifacts: PresetArtifactInput[];
  structure?: Record<string, unknown>;
}

export type PresetBuilder = (projectId: string, projectName: string) => PresetProjectData;

export const DEFAULT_STRUCTURE = {
  servicesDirectory: "services",
  clientsDirectory: "clients",
  packagesDirectory: "packages",
  toolsDirectory: "tools",
  docsDirectory: "docs",
  testsDirectory: "tests",
  infraDirectory: "infra",
};

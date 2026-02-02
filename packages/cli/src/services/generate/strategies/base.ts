/**
 * @packageDocumentation
 * Base types and interfaces for artifact generation strategies.
 *
 * Defines the core abstractions for:
 * - Artifact generator context shared across strategies
 * - Artifact generator interface for strategy implementations
 */

import type {
  ClientGenerationTarget,
  ServiceGenerationTarget,
} from "@/services/generate/io/contexts.js";
import type { GenerateOptions } from "@/services/generate/util/types.js";
import type { CLIConfig, ProjectStructureConfig } from "@/types.js";
import type { PackageManagerCommandSet } from "@/utils/io/package-manager.js";
import type { AppSpec, ConfigWithVersion } from "@arbiter/specification";

export interface ArtifactGeneratorContext {
  appSpec: AppSpec;
  configWithVersion: ConfigWithVersion;
  outputDir: string;
  options: GenerateOptions;
  structure: ProjectStructureConfig;
  cliConfig: CLIConfig;
  packageManager: PackageManagerCommandSet;
  clientTargets: ClientGenerationTarget[];
  testsWorkspaceRelative?: string;
  services?: ServiceGenerationTarget[];
  reporter: import("@/services/generate/util/types.js").GenerationReporter;
}

export interface ArtifactGenerator {
  name: string;
  generate(context: ArtifactGeneratorContext): Promise<string[]>;
}

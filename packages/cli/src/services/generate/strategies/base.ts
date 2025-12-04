import type {
  ClientGenerationTarget,
  ServiceGenerationTarget,
} from "@/services/generate/contexts.js";
import type { GenerateOptions } from "@/services/generate/types.js";
import type { CLIConfig, ProjectStructureConfig } from "@/types.js";
import type { PackageManagerCommandSet } from "@/utils/package-manager.js";
import type { AppSpec, ConfigWithVersion } from "@arbiter/shared";

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
}

export interface ArtifactGenerator {
  name: string;
  generate(context: ArtifactGeneratorContext): Promise<string[]>;
}

import type { ClientGenerationTarget } from "@/services/generate/contexts.js";
import {
  ArtifactGenerator,
  type ArtifactGeneratorContext,
} from "@/services/generate/strategies/base.js";
import type { GenerateOptions } from "@/services/generate/types.js";
import type { CLIConfig, ProjectStructureConfig } from "@/types.js";
import type { PackageManagerCommandSet } from "@/utils/package-manager.js";
import type { AppSpec, ConfigWithVersion } from "@arbiter/shared";

type InfrastructureFn = (
  configWithVersion: ConfigWithVersion,
  outputDir: string,
  options: GenerateOptions,
  structure: ProjectStructureConfig,
  appSpec: AppSpec,
  clientTarget?: ClientGenerationTarget,
  cliConfig?: CLIConfig,
  packageManager?: PackageManagerCommandSet,
) => Promise<string[]>;

export class InfrastructureGenerator implements ArtifactGenerator {
  name = "infrastructure";
  constructor(private readonly impl: InfrastructureFn) {}

  async generate(context: ArtifactGeneratorContext): Promise<string[]> {
    const primaryClient = context.clientTargets[0];
    return await this.impl(
      context.configWithVersion,
      context.outputDir,
      context.options,
      context.structure,
      context.appSpec,
      primaryClient,
      context.cliConfig,
      context.packageManager,
    );
  }
}

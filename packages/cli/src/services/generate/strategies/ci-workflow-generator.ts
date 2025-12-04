import {
  ArtifactGenerator,
  type ArtifactGeneratorContext,
} from "@/services/generate/strategies/base.js";
import type { GenerateOptions } from "@/services/generate/types.js";
import type { ConfigWithVersion } from "@arbiter/shared";

type CIWorkflowFn = (
  configWithVersion: ConfigWithVersion,
  outputDir: string,
  options: GenerateOptions,
) => Promise<string[]>;

export class CIWorkflowGenerator implements ArtifactGenerator {
  name = "ci-workflow";
  constructor(private readonly impl: CIWorkflowFn) {}

  async generate(context: ArtifactGeneratorContext): Promise<string[]> {
    return await this.impl(context.configWithVersion, context.outputDir, context.options);
  }
}

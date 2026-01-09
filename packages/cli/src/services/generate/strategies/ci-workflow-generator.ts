/**
 * @packageDocumentation
 * CI workflow generator strategy for artifact generation.
 *
 * Provides functionality to:
 * - Generate GitHub Actions workflows from specifications
 * - Support custom workflow implementations via factory pattern
 */

import {
  ArtifactGenerator,
  type ArtifactGeneratorContext,
} from "@/services/generate/strategies/base.js";
import type { GenerateOptions } from "@/services/generate/util/types.js";
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

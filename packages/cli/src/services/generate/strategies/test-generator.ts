/**
 * @packageDocumentation
 * Test generator strategy for artifact generation.
 *
 * Provides functionality to:
 * - Generate endpoint test files from specifications
 * - Generate master test runners
 * - Generate client API tests
 */

import type { ClientGenerationTarget } from "@/services/generate/io/contexts.js";
import {
  ArtifactGenerator,
  type ArtifactGeneratorContext,
} from "@/services/generate/strategies/base.js";
import type { GenerateOptions } from "@/services/generate/util/types.js";
import type { CLIConfig, ProjectStructureConfig } from "@/types.js";
import type { PackageManagerCommandSet } from "@/utils/io/package-manager.js";
import type { AppSpec } from "@arbiter/specification";

type EndpointTestFn = (
  appSpec: AppSpec,
  outputDir: string,
  options: GenerateOptions,
  structure: ProjectStructureConfig,
  cliConfig: CLIConfig,
) => Promise<string[]>;

type MasterRunnerFn = (
  appSpec: AppSpec,
  outputDir: string,
  options: GenerateOptions,
  structure: ProjectStructureConfig,
  cliConfig: CLIConfig,
  testsWorkspaceRelative: string | undefined,
  clientTargets: ClientGenerationTarget[],
  packageManager: PackageManagerCommandSet,
) => Promise<string[]>;

export class TestGenerator implements ArtifactGenerator {
  name = "tests";

  constructor(
    private readonly endpointTests: EndpointTestFn,
    private readonly masterRunner: MasterRunnerFn,
  ) {}

  async generate(context: ArtifactGeneratorContext): Promise<string[]> {
    const files: string[] = [];

    const endpointFiles = await this.endpointTests(
      context.appSpec,
      context.outputDir,
      context.options,
      context.structure,
      context.cliConfig,
    );
    files.push(...endpointFiles);

    const runnerFiles = await this.masterRunner(
      context.appSpec,
      context.outputDir,
      context.options,
      context.structure,
      context.cliConfig,
      context.testsWorkspaceRelative,
      context.clientTargets,
      context.packageManager,
    );
    files.push(...runnerFiles);

    return files;
  }
}

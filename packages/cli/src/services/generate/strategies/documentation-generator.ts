/**
 * @packageDocumentation
 * Documentation generator strategy for artifact generation.
 *
 * Provides functionality to:
 * - Generate README files from specifications
 * - Generate API documentation from app specs
 * - Support custom documentation implementations
 */

import {
  ArtifactGenerator,
  type ArtifactGeneratorContext,
} from "@/services/generate/strategies/base.js";
import type { GenerateOptions } from "@/services/generate/util/types.js";
import type { ProjectStructureConfig } from "@/types.js";
import type { AppSpec } from "@arbiter/shared";

type DocumentationFn = (
  appSpec: AppSpec,
  outputDir: string,
  options: GenerateOptions,
  structure: ProjectStructureConfig,
) => Promise<string[]>;

export class DocumentationGenerator implements ArtifactGenerator {
  name = "documentation";
  constructor(private readonly impl: DocumentationFn) {}

  async generate(context: ArtifactGeneratorContext): Promise<string[]> {
    return await this.impl(context.appSpec, context.outputDir, context.options, context.structure);
  }
}

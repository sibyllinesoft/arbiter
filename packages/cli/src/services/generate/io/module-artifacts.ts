/**
 * @packageDocumentation
 * Module artifact generation for resources, processes, and state models.
 *
 * NOTE: Infrastructure resources (databases, caches, queues) are defined in
 * markdown specs (.arbiter/). This module previously generated JSON dumps
 * which had no consumer. Actual infrastructure code generation (Terraform,
 * Docker Compose, k8s manifests) should be implemented as a separate feature
 * when needed.
 */

import type { GenerateOptions } from "@/services/generate/util/types.js";
import type { ProjectStructureConfig } from "@/types.js";
import type { AppSpec } from "@arbiter/specification";

/**
 * Generate module artifacts from app spec resources and processes.
 *
 * Currently a no-op. Infrastructure resources are stored in markdown specs.
 * When infrastructure code generation is needed (Terraform, Docker Compose, etc.),
 * implement purpose-built generators rather than raw JSON dumps.
 */
export async function generateModuleArtifacts(
  _appSpec: AppSpec,
  _outputDir: string,
  _options: GenerateOptions,
  _structure: ProjectStructureConfig,
): Promise<string[]> {
  // Infrastructure resources are defined in markdown specs (.arbiter/).
  // No artifacts to generate here - IaC generation would be a separate feature.
  return [];
}

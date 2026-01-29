/**
 * @packageDocumentation
 * Module artifact generation for resources, processes, and state models.
 *
 * Generates module-level artifacts including:
 * - Resource definitions
 * - Process orchestration files
 * - State machine models
 */

import path from "node:path";
import { ensureDirectory, writeFileWithHooks } from "@/services/generate/util/hook-executor.js";
import { joinRelativePath } from "@/services/generate/util/shared.js";
import type { GenerateOptions } from "@/services/generate/util/types.js";
import type { ProjectStructureConfig } from "@/types.js";
import type { AppSpec } from "@arbiter/shared";

/**
 * Generate module artifacts from app spec resources and processes
 */
export async function generateModuleArtifacts(
  appSpec: AppSpec,
  outputDir: string,
  options: GenerateOptions,
  structure: ProjectStructureConfig,
): Promise<string[]> {
  const files: string[] = [];

  if (!appSpec.resources && !appSpec.processes) {
    return files;
  }

  const packagesRoot = path.join(outputDir, structure.packagesDirectory);
  await ensureDirectory(packagesRoot, options);

  if (appSpec.resources) {
    for (const [componentName, componentSpec] of Object.entries(appSpec.resources)) {
      const fileName = `${componentName}.json`;
      const filePath = path.join(packagesRoot, fileName);
      await writeFileWithHooks(filePath, JSON.stringify(componentSpec, null, 2), options);
      files.push(joinRelativePath(structure.packagesDirectory, fileName));
    }
  }

  const processes = appSpec.processes;
  if (processes) {
    const processesPath = path.join(packagesRoot, "processes.json");
    await writeFileWithHooks(processesPath, JSON.stringify(processes, null, 2), options);
    files.push(joinRelativePath(structure.packagesDirectory, "processes.json"));
  }

  return files;
}

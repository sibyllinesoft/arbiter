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
import { type AppSpec, getProcesses, getResources } from "@arbiter/specification";

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

  if (
    Object.keys(getResources(appSpec)).length === 0 &&
    Object.keys(getProcesses(appSpec)).length === 0
  ) {
    return files;
  }

  const packagesRoot = path.join(outputDir, structure.packagesDirectory);
  await ensureDirectory(packagesRoot, options);

  if (getResources(appSpec)) {
    for (const [componentName, componentSpec] of Object.entries(getResources(appSpec))) {
      const fileName = `${componentName}.json`;
      const filePath = path.join(packagesRoot, fileName);
      await writeFileWithHooks(filePath, JSON.stringify(componentSpec, null, 2), options);
      files.push(joinRelativePath(structure.packagesDirectory, fileName));
    }
  }

  const processes = getProcesses(appSpec);
  if (processes) {
    const processesPath = path.join(packagesRoot, "processes.json");
    await writeFileWithHooks(processesPath, JSON.stringify(processes, null, 2), options);
    files.push(joinRelativePath(structure.packagesDirectory, "processes.json"));
  }

  return files;
}

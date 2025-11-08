import fs from "fs-extra";
import { GenerationHookManager } from "../../utils/generation-hooks.js";
import type { GenerateOptions } from "./types.js";

let activeHookManager: GenerationHookManager | null = null;

export function setActiveHookManager(manager: GenerationHookManager | null): void {
  activeHookManager = manager;
}

export async function writeFileWithHooks(
  filePath: string,
  content: string,
  options: GenerateOptions,
  mode?: number,
): Promise<void> {
  let finalContent = content;
  if (activeHookManager) {
    finalContent = await activeHookManager.beforeFileWrite(filePath, finalContent);
  }

  if (!options.dryRun) {
    if (mode !== undefined) {
      await fs.writeFile(filePath, finalContent, { mode });
    } else {
      await fs.writeFile(filePath, finalContent);
    }
  }

  if (activeHookManager) {
    await activeHookManager.afterFileWrite(filePath, finalContent);
  }
}

export async function ensureDirectory(dir: string, options: GenerateOptions): Promise<void> {
  if (options.dryRun) {
    return;
  }
  await fs.ensureDir(dir);
}

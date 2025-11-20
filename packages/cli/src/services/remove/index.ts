// @ts-nocheck
import * as path from "node:path";
import chalk from "chalk";
import { diffLines } from "diff";
import fs from "fs-extra";
import { ApiClient } from "../../api-client.js";
import { getCueManipulator } from "../../constraints/cli-integration.js";
import { safeFileOperation } from "../../constraints/index.js";
import { validateCUE } from "../../cue/index.js";
import type { CLIConfig } from "../../types.js";

export interface RemoveOptions {
  verbose?: boolean;
  dryRun?: boolean;
  force?: boolean;
  method?: string;
  service?: string;
  id?: string;
}

export async function removeCommand(
  subcommand: string,
  target: string,
  options: RemoveOptions & Record<string, any>,
  config: CLIConfig,
): Promise<number> {
  const manipulator = getCueManipulator();

  try {
    console.log(chalk.blue(`🧹 Removing ${subcommand}${target ? `: ${target}` : ""}`));

    const assemblyDir = path.resolve(".arbiter");
    const assemblyPath = path.join(assemblyDir, "assembly.cue");
    const useLocalOnly = config.localMode === true;

    if (useLocalOnly && options.verbose) {
      console.log(chalk.dim("📁 Local mode enabled: applying changes to .arbiter CUE files only"));
    }

    let assemblyContent = "";

    // Try .arbiter path first in local mode, fallback to config
    const searchPaths = useLocalOnly
      ? [assemblyPath, config.specPath || "arbiter.assembly.cue"]
      : [config.specPath || "arbiter.assembly.cue"];

    let foundPath: string | null = null;
    for (const candidate of searchPaths) {
      if (await fs.pathExists(candidate)) {
        foundPath = candidate;
        assemblyContent = await fs.readFile(candidate, "utf-8");
        break;
      }
    }

    if (!foundPath) {
      console.error(
        chalk.red("❌ No assembly file found"),
        chalk.dim(
          `(searched: ${searchPaths.map((p) => path.relative(process.cwd(), p)).join(", ")})`,
        ),
      );
      return 1;
    }

    // Original version for diff
    const originalContent = assemblyContent;

    // Validate before modification if not forcing
    if (!options.force) {
      const validation = await validateCUE(assemblyContent);
      if (!validation.valid) {
        console.error(chalk.red("❌ Assembly validation failed before removal:"));
        for (const error of validation.errors) {
          console.error(chalk.red(`  • ${error}`));
        }
        console.error(chalk.dim("Use --force to bypass validation and attempt removal anyway."));
        return 1;
      }
    }

    // Perform removal using CUE manipulator
    const updatedContent = await manipulator.removeDeclaration(assemblyContent, {
      type: subcommand,
      identifier: target,
      method: options.method,
      service: options.service,
      id: options.id,
    });

    // Validate after modification
    const validation = await validateCUE(updatedContent);
    if (!validation.valid) {
      console.error(chalk.red("❌ Resulting assembly is invalid:"));
      for (const error of validation.errors) {
        console.error(chalk.red(`  • ${error}`));
      }
      return 1;
    }

    if (options.dryRun) {
      console.log(chalk.dim("\nDry run - showing diff only (no changes written):\n"));
      const diff = diffLines(originalContent, updatedContent);
      for (const part of diff) {
        const color = part.added ? "green" : part.removed ? "red" : "gray";
        const prefix = part.added ? "+" : part.removed ? "-" : " ";
        process.stdout.write(chalk[color](prefix + part.value));
      }
      console.log();
      return 0;
    }

    // Write changes safely
    await safeFileOperation("write", foundPath, async (validatedPath) => {
      await fs.writeFile(validatedPath, updatedContent, "utf-8");
    });

    console.log(chalk.green(`✅ Removed ${subcommand}${target ? `: ${target}` : ""}`));

    // Sync with remote if not local-only
    if (!useLocalOnly) {
      const apiClient = new ApiClient(config);
      const relativePath = path.relative(process.cwd(), foundPath);
      const syncResult = await apiClient.syncFile(relativePath, updatedContent);
      if (!syncResult.success) {
        console.error(
          chalk.yellow("⚠️  Local removal succeeded but remote sync failed:"),
          syncResult.error,
        );
        return syncResult.exitCode ?? 0;
      }
      if (options.verbose) {
        console.log(chalk.dim("🔄 Synced updated assembly to server."));
      }
    }

    return 0;
  } catch (error) {
    console.error(
      chalk.red("❌ Remove failed:"),
      error instanceof Error ? error.message : String(error),
    );
    return 1;
  }
}
// @ts-nocheck

import path from "node:path";
import chalk from "chalk";
import fs from "fs-extra";
import { ApiClient } from "../api-client.js";
import { validateCUE } from "../cue/index.js";
import type { CLIConfig } from "../types.js";
import { ensureProjectExists } from "../utils/project.js";

export interface SpecImportOptions {
  project?: string;
  remotePath?: string;
  skipValidate?: boolean;
  author?: string;
  message?: string;
}

export async function importSpecCommand(
  filePath: string | undefined,
  options: SpecImportOptions,
  config: CLIConfig,
): Promise<number> {
  try {
    if (config.localMode) {
      console.error(
        chalk.red(
          "❌ Spec import is not available in --local mode. Rerun without --local to persist fragments to the service.",
        ),
      );
      return 1;
    }

    const projectRoot = config.projectDir || process.cwd();
    const resolvedPath = path.resolve(
      projectRoot,
      filePath ?? path.join(".arbiter", "assembly.cue"),
    );

    if (!(await fs.pathExists(resolvedPath))) {
      console.error(
        chalk.red("❌ Spec file not found:"),
        chalk.dim(path.relative(projectRoot, resolvedPath) || resolvedPath),
      );
      return 1;
    }

    const content = await fs.readFile(resolvedPath, "utf-8");

    if (!options.skipValidate) {
      const validation = await validateCUE(content);
      if (!validation.valid) {
        console.error(chalk.red("❌ Spec validation failed:"));
        for (const error of validation.errors) {
          console.error(chalk.red(`  • ${error}`));
        }
        console.error(chalk.dim("Use --skip-validate to bypass local validation if necessary."));
        return 1;
      }
    }

    const client = new ApiClient(config);
    const effectiveConfig: CLIConfig = {
      ...config,
      projectId: options.project ?? config.projectId,
    };

    const projectId = await ensureProjectExists(
      client,
      effectiveConfig,
      options.project ?? config.projectId,
    );

    const remotePath = determineRemotePath(projectRoot, resolvedPath, options.remotePath);

    const result = await client.updateFragment(projectId, remotePath, content, {
      author: options.author,
      message: options.message,
    });

    if (!result.success) {
      console.error(chalk.red("❌ Failed to import specification:"), result.error);
      return result.exitCode ?? 1;
    }

    console.log(
      chalk.green("✅ Spec imported successfully"),
      chalk.dim(`(project: ${projectId}, path: ${remotePath})`),
    );
    return 0;
  } catch (error) {
    console.error(
      chalk.red("❌ Spec import failed:"),
      error instanceof Error ? error.message : String(error),
    );
    return 1;
  }
}

function determineRemotePath(projectRoot: string, specPath: string, override?: string): string {
  if (override && override.trim().length > 0) {
    return normalizeFragmentPath(override.trim());
  }

  const relative = path.relative(projectRoot, specPath);
  if (relative && !relative.startsWith("..")) {
    return normalizeFragmentPath(relative);
  }

  return normalizeFragmentPath(path.basename(specPath));
}

function normalizeFragmentPath(value: string): string {
  return value.replace(/\\/g, "/").replace(/^\.\/+/, "") || "assembly.cue";
}

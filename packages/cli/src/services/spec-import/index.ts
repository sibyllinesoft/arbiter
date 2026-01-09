/**
 * @packageDocumentation
 * Spec Import command - Import CUE specifications from files.
 *
 * Provides functionality to:
 * - Import local CUE files to remote storage
 * - Validate imported specifications
 * - Track authorship and revision history
 */

import path from "node:path";
import { validateCUE } from "@/cue/index.js";
import { ApiClient } from "@/io/api/api-client.js";
import type { CLIConfig } from "@/types.js";
import { ensureProjectExists } from "@/utils/api/project.js";
import chalk from "chalk";
import fs from "fs-extra";

export interface SpecImportOptions {
  project?: string;
  remotePath?: string;
  skipValidate?: boolean;
  author?: string;
  message?: string;
}

export interface SpecImportDependencies {
  createApiClient: (config: CLIConfig) => ApiClient;
  validateCue: typeof validateCUE;
  ensureProjectExists: typeof ensureProjectExists;
}

const defaultDeps: SpecImportDependencies = {
  createApiClient: (config) => new ApiClient(config),
  validateCue: validateCUE,
  ensureProjectExists,
};

/**
 * Check if local mode is enabled (spec import not available).
 */
function checkLocalModeRestriction(config: CLIConfig): boolean {
  if (config.localMode) {
    console.error(
      chalk.red(
        "❌ Spec import is not available in --local mode. Rerun without --local to persist fragments to the service.",
      ),
    );
    return true;
  }
  return false;
}

/**
 * Resolve and validate the spec file path.
 */
async function resolveSpecFile(
  projectRoot: string,
  filePath: string | undefined,
): Promise<{ path: string; error: boolean }> {
  const resolvedPath = path.resolve(projectRoot, filePath ?? path.join(".arbiter", "assembly.cue"));

  if (!(await fs.pathExists(resolvedPath))) {
    console.error(
      chalk.red("❌ Spec file not found:"),
      chalk.dim(path.relative(projectRoot, resolvedPath) || resolvedPath),
    );
    return { path: resolvedPath, error: true };
  }

  return { path: resolvedPath, error: false };
}

/**
 * Validate CUE content if validation is not skipped.
 */
async function validateSpecContent(
  content: string,
  skipValidate: boolean | undefined,
  validateCue: typeof validateCUE,
): Promise<boolean> {
  if (skipValidate) return true;

  const validation = await validateCue(content);
  if (!validation.valid) {
    console.error(chalk.red("❌ Spec validation failed:"));
    for (const error of validation.errors) {
      console.error(chalk.red(`  • ${error}`));
    }
    console.error(chalk.dim("Use --skip-validate to bypass local validation if necessary."));
    return false;
  }

  return true;
}

function buildEffectiveConfig(config: CLIConfig, options: SpecImportOptions): CLIConfig {
  return {
    ...config,
    projectId: options.project ?? config.projectId,
  };
}

async function uploadFragment(
  client: ApiClient,
  projectId: string,
  remotePath: string,
  content: string,
  options: SpecImportOptions,
): Promise<number> {
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
}

export async function importSpec(
  filePath: string | undefined,
  options: SpecImportOptions,
  config: CLIConfig,
  deps: SpecImportDependencies = defaultDeps,
): Promise<number> {
  try {
    if (checkLocalModeRestriction(config)) return 1;

    const projectRoot = config.projectDir || process.cwd();
    const spec = await resolveSpecFile(projectRoot, filePath);
    if (spec.error) return 1;

    const content = await fs.readFile(spec.path, "utf-8");
    if (!(await validateSpecContent(content, options.skipValidate, deps.validateCue))) return 1;

    const client = deps.createApiClient(config);
    const effectiveConfig = buildEffectiveConfig(config, options);
    const projectId = await deps.ensureProjectExists(
      client,
      effectiveConfig,
      effectiveConfig.projectId,
    );
    const remotePath = determineRemotePath(projectRoot, spec.path, options.remotePath);

    return uploadFragment(client, projectId, remotePath, content, options);
  } catch (error) {
    console.error(
      chalk.red("❌ Spec import failed:"),
      error instanceof Error ? error.message : String(error),
    );
    return 1;
  }
}

export function determineRemotePath(
  projectRoot: string,
  specPath: string,
  override?: string,
): string {
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

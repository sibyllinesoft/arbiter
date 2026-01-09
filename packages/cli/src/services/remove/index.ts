/**
 * @packageDocumentation
 * Remove command - Remove declarations from CUE specifications.
 *
 * Provides functionality to:
 * - Remove services, endpoints, routes, flows from specs
 * - Support dry-run mode for previewing changes
 * - Validate resulting specification after removal
 * - Handle local and remote specification storage
 */

import * as path from "node:path";
import { getCueManipulator } from "@/constraints/cli-integration.js";
import { safeFileOperation } from "@/constraints/index.js";
import { validateCUE } from "@/cue/index.js";
import type { CLIConfig } from "@/types.js";
import chalk from "chalk";
import { diffLines } from "diff";
import fs from "fs-extra";

export interface RemoveOptions {
  verbose?: boolean;
  dryRun?: boolean;
  force?: boolean;
  method?: string;
  service?: string;
  id?: string;
}

function formatTarget(subcommand: string, target: string): string {
  return `${subcommand}${target ? `: ${target}` : ""}`;
}

function getSearchPaths(projectDir: string, config: CLIConfig, useLocalOnly: boolean): string[] {
  const assemblyPath = path.join(path.resolve(projectDir, ".arbiter"), "assembly.cue");
  const configPath = config.specPath || "arbiter.assembly.cue";
  return useLocalOnly ? [assemblyPath, configPath] : [configPath];
}

async function findAssemblyFile(
  searchPaths: string[],
): Promise<{ foundPath: string; content: string } | null> {
  for (const candidate of searchPaths) {
    if (await fs.pathExists(candidate)) {
      const content = await fs.readFile(candidate, "utf-8");
      return { foundPath: candidate, content };
    }
  }
  return null;
}

function logSearchError(searchPaths: string[]): void {
  const searched = searchPaths.map((p) => path.relative(process.cwd(), p)).join(", ");
  console.error(chalk.red("❌ No assembly file found"), chalk.dim(`(searched: ${searched})`));
}

function logValidationErrors(errors: string[], prefix: string): void {
  console.error(chalk.red(prefix));
  for (const error of errors) {
    console.error(chalk.red(`  • ${error}`));
  }
}

async function validateContent(
  content: string,
  options: { force?: boolean },
  errorPrefix: string,
  showForceHint = false,
): Promise<boolean> {
  if (options.force && errorPrefix.includes("before")) return true;

  const validation = await validateCUE(content);
  if (!validation.valid) {
    logValidationErrors(validation.errors, errorPrefix);
    if (showForceHint) {
      console.error(chalk.dim("Use --force to bypass validation and attempt removal anyway."));
    }
    return false;
  }
  return true;
}

function showDiff(original: string, updated: string): void {
  console.log(chalk.dim("\nDry run - showing diff only (no changes written):\n"));
  const diff = diffLines(original, updated);
  for (const part of diff) {
    const color = part.added ? "green" : part.removed ? "red" : "gray";
    const prefix = part.added ? "+" : part.removed ? "-" : " ";
    process.stdout.write(chalk[color](prefix + part.value));
  }
  console.log();
}

function logLocalModeInfo(useLocalOnly: boolean, verbose?: boolean): void {
  if (useLocalOnly && verbose) {
    console.log(chalk.dim("📁 Local mode enabled: applying changes to .arbiter CUE files only"));
  }
}

interface RemovalDeclaration {
  type: string;
  identifier: string;
  method?: string;
  service?: string;
  id?: string;
}

function buildRemovalDeclaration(
  subcommand: string,
  target: string,
  options: RemoveOptions,
): RemovalDeclaration {
  return {
    type: subcommand,
    identifier: target,
    method: options.method,
    service: options.service,
    id: options.id,
  };
}

async function applyRemoval(
  foundPath: string,
  updatedContent: string,
  subcommand: string,
  target: string,
): Promise<number> {
  await safeFileOperation("write", foundPath, async (validatedPath) => {
    await fs.writeFile(validatedPath, updatedContent, "utf-8");
  });
  console.log(chalk.green(`✅ Removed ${formatTarget(subcommand, target)}`));
  return 0;
}

async function performRemoval(
  manipulator: ReturnType<typeof getCueManipulator>,
  assemblyFile: { foundPath: string; content: string },
  subcommand: string,
  target: string,
  options: RemoveOptions & Record<string, unknown>,
): Promise<number> {
  const { foundPath, content: originalContent } = assemblyFile;

  if (
    !(await validateContent(
      originalContent,
      options,
      "❌ Assembly validation failed before removal:",
      true,
    ))
  ) {
    return 1;
  }

  const declaration = buildRemovalDeclaration(subcommand, target, options);
  const updatedContent = await manipulator.removeDeclaration(originalContent, declaration);

  if (
    !(await validateContent(updatedContent, { force: false }, "❌ Resulting assembly is invalid:"))
  ) {
    return 1;
  }

  if (options.dryRun) {
    showDiff(originalContent, updatedContent);
    return 0;
  }

  return applyRemoval(foundPath, updatedContent, subcommand, target);
}

export async function removeCommand(
  subcommand: string,
  target: string,
  options: RemoveOptions & Record<string, unknown>,
  config: CLIConfig,
): Promise<number> {
  const manipulator = getCueManipulator();
  const projectDir = config.projectDir || process.cwd();
  const useLocalOnly = config.localMode === true;

  try {
    console.log(chalk.blue(`🧹 Removing ${formatTarget(subcommand, target)}`));
    logLocalModeInfo(useLocalOnly, options.verbose);

    const searchPaths = getSearchPaths(projectDir, config, useLocalOnly);
    const assemblyFile = await findAssemblyFile(searchPaths);
    if (!assemblyFile) {
      logSearchError(searchPaths);
      return 1;
    }

    return performRemoval(manipulator, assemblyFile, subcommand, target, options);
  } catch (error) {
    console.error(
      chalk.red("❌ Remove failed:"),
      error instanceof Error ? error.message : String(error),
    );
    return 1;
  }
}

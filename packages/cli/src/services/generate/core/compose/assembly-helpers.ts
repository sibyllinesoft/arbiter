/**
 * @packageDocumentation
 * Assembly and spec discovery helpers for code generation.
 *
 * Provides utility functions for working with assembly files,
 * spec discovery, and command execution during generation.
 */

import { spawn } from "node:child_process";
import path from "node:path";
import { ensureDirectory } from "@/services/generate/util/hook-executor.js";
import type { GenerateOptions } from "@/services/generate/util/types.js";
import type { ProjectStructureConfig } from "@/types.js";
import fs from "fs-extra";

/**
 * Ensure base project structure directories exist.
 */
export async function ensureBaseStructure(
  structure: ProjectStructureConfig,
  outputDir: string,
  options: GenerateOptions,
): Promise<void> {
  const baseDirs = [
    structure.clientsDirectory,
    structure.servicesDirectory,
    structure.packagesDirectory,
    structure.toolsDirectory,
    structure.docsDirectory,
    structure.testsDirectory,
    structure.infraDirectory,
  ].filter(Boolean);

  for (const dir of baseDirs) {
    await ensureDirectory(path.join(outputDir, dir), options);
  }
}

/**
 * Discover available specs in .arbiter/ directories.
 */
export function discoverSpecs(): Array<{ name: string; path: string }> {
  const specs: Array<{ name: string; path: string }> = [];

  if (fs.existsSync(".arbiter")) {
    const specDirs = fs
      .readdirSync(".arbiter", { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory)
      .map((dirent) => dirent.name);

    for (const specName of specDirs) {
      const assemblyPath = path.join(".arbiter", specName, "assembly.cue");
      if (fs.existsSync(assemblyPath)) {
        specs.push({ name: specName, path: assemblyPath });
      }
    }
  }

  return specs;
}

/**
 * Resolve the assembly path based on provided spec name or discovery.
 */
export function resolveAssemblyPath(
  specName: string | undefined,
  options: GenerateOptions,
): string | null {
  if (specName || options.spec) {
    const targetSpec = specName || options.spec!;
    const assemblyPath = path.join(".arbiter", targetSpec, "assembly.cue");
    return assemblyPath;
  }

  const availableSpecs = discoverSpecs();
  if (availableSpecs.length === 0) {
    const arbiterPath = path.resolve(".arbiter", "assembly.cue");
    return fs.existsSync(arbiterPath) ? arbiterPath : null;
  }
  if (availableSpecs.length === 1) {
    return availableSpecs[0].path;
  }
  return null; // ambiguous
}

/**
 * Decide whether to continue on validation warnings.
 */
export function shouldAbortOnWarnings(validationResult: any, options: GenerateOptions): boolean {
  if (!validationResult.hasWarnings) return false;
  return !options.force;
}

/**
 * Gate GitHub sync based on options.
 */
export function shouldSyncGithub(options: GenerateOptions): boolean {
  return Boolean(options.syncGithub || options.githubDryRun);
}

/**
 * Simple command execution for CUE evaluation.
 */
export async function executeCommand(
  command: string,
  args: string[],
  options: { cwd?: string; timeout?: number } = {},
): Promise<{ success: boolean; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const proc = spawn(command, args, {
      cwd: options.cwd || process.cwd(),
      stdio: "pipe",
    });

    let stdout = "";
    let stderr = "";

    if (proc.stdout) proc.stdout.on("data", (data) => (stdout += data.toString()));
    if (proc.stderr) proc.stderr.on("data", (data) => (stderr += data.toString()));

    const timeout = setTimeout(() => {
      proc.kill();
      resolve({ success: false, stdout, stderr: "Command timed out" });
    }, options.timeout || 10000);

    proc.on("close", (code) => {
      clearTimeout(timeout);
      resolve({
        success: code === 0,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      });
    });

    proc.on("error", (error) => {
      clearTimeout(timeout);
      resolve({ success: false, stdout, stderr: error.message });
    });
  });
}

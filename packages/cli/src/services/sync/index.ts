/**
 * @packageDocumentation
 * Sync command - Synchronize project manifest files with specifications.
 *
 * Provides functionality to:
 * - Detect and sync package.json, pyproject.toml, Cargo.toml, and Makefiles
 * - Manage script additions and dependency updates
 * - Support dry-run mode for previewing changes
 * - Validate idempotency of sync operations
 */

import fs from "node:fs/promises";
import path from "node:path";
import type { CLIConfig, SyncOptions } from "@/types.js";
import { detectPackageManager, getPackageManagerCommands } from "@/utils/io/package-manager.js";
import chalk from "chalk";
import {
  type ConflictResolution,
  type SyncResult,
  applyArbiterUpdates,
  applyPackageChanges,
  calculateChecksum,
  createBackup,
  deepMerge,
  generateChangeSet,
  getArbiterPackageUpdates,
  reportPotentialChanges,
  syncCargoToml,
  syncMakefile,
  syncPackageJson,
  syncPyprojectToml,
  validateIdempotency,
  writeFileSafely,
} from "./manifest-sync.js";

// Re-export for external consumers
export type { ConflictResolution, SyncResult } from "./manifest-sync.js";

interface ManifestFile {
  path: string;
  type: "package.json" | "pyproject.toml" | "Cargo.toml" | "Makefile";
  exists: boolean;
  language: string;
}

/**
 * Detect manifest files in the project
 */
async function detectManifestFiles(projectPath: string): Promise<ManifestFile[]> {
  const manifests: ManifestFile[] = [
    { path: "package.json", type: "package.json", exists: false, language: "typescript" },
    { path: "pyproject.toml", type: "pyproject.toml", exists: false, language: "python" },
    { path: "Cargo.toml", type: "Cargo.toml", exists: false, language: "rust" },
    { path: "Makefile", type: "Makefile", exists: false, language: "bash" },
  ];

  for (const manifest of manifests) {
    const fullPath = path.join(projectPath, manifest.path);
    try {
      await fs.access(fullPath);
      manifest.exists = true;
    } catch {
      manifest.exists = false;
    }
  }

  return manifests.filter((m) => m.exists);
}

/**
 * Sync command implementation
 */
export async function syncProject(options: SyncOptions, _config: CLIConfig): Promise<number> {
  try {
    const context = await initializeSyncContext(options);
    if (!context) return 1;

    const syncResults = await executeSynchronization(context);
    displaySynchronizationResults(context, syncResults);
    displayNextStepsGuidance(context, syncResults);

    return 0;
  } catch (error) {
    console.error(
      chalk.red("❌ Synchronization failed:"),
      error instanceof Error ? error.message : String(error),
    );
    return 1;
  }
}

interface SyncContext {
  projectPath: string;
  targetManifests: ManifestFile[];
  dryRun: boolean;
  backup: boolean;
  force: boolean;
}

async function initializeSyncContext(options: SyncOptions): Promise<SyncContext | null> {
  const projectPath = process.cwd();
  displaySyncHeader(projectPath);

  const manifests = await detectAndDisplayManifests(projectPath);
  if (!manifests) return null;

  const targetManifests = filterManifestsByLanguage(manifests, options.language);
  if (!targetManifests) return null;

  const syncOptions = extractSyncOptions(options);
  displaySyncMode(syncOptions.dryRun);

  return {
    projectPath,
    targetManifests,
    ...syncOptions,
  };
}

function displaySyncHeader(projectPath: string): void {
  console.log(chalk.blue("🔄 Arbiter manifest synchronization"));
  console.log(chalk.dim(`Project: ${projectPath}`));
}

async function detectAndDisplayManifests(projectPath: string): Promise<ManifestFile[] | null> {
  console.log(chalk.blue("🔍 Detecting manifest files..."));
  const manifests = await detectManifestFiles(projectPath);

  if (manifests.length === 0) {
    console.log(chalk.yellow("⚠️  No supported manifest files found"));
    console.log(chalk.dim("Supported: package.json, pyproject.toml, Cargo.toml, Makefile"));
    return null;
  }

  console.log(chalk.green(`✅ Found ${manifests.length} manifest file(s):`));
  for (const manifest of manifests) {
    console.log(chalk.dim(`  • ${manifest.path} (${manifest.language})`));
  }

  return manifests;
}

function filterManifestsByLanguage(
  manifests: ManifestFile[],
  language?: string,
): ManifestFile[] | null {
  if (!language || language === "all") {
    return manifests;
  }

  const filtered = manifests.filter((m) => m.language === language);
  if (filtered.length === 0) {
    console.log(chalk.yellow(`⚠️  No ${language} manifest files found`));
    return null;
  }

  return filtered;
}

function extractSyncOptions(options: SyncOptions): {
  dryRun: boolean;
  backup: boolean;
  force: boolean;
} {
  return {
    dryRun: options.dryRun || false,
    backup: options.backup || false,
    force: options.force || false,
  };
}

function displaySyncMode(dryRun: boolean): void {
  if (dryRun) {
    console.log(chalk.yellow("📋 Dry run mode - no files will be modified"));
  }
}

async function executeSynchronization(context: SyncContext): Promise<SyncResult[]> {
  console.log(chalk.blue("\n🔄 Synchronizing manifests..."));
  const syncResults: SyncResult[] = [];

  for (const manifest of context.targetManifests) {
    const result = await processSingleManifest(manifest, context);
    syncResults.push(result);
    displayManifestResult(manifest, result, context.dryRun);
  }

  return syncResults;
}

async function processSingleManifest(
  manifest: ManifestFile,
  context: SyncContext,
): Promise<SyncResult> {
  const filePath = path.join(context.projectPath, manifest.path);
  console.log(chalk.cyan(`\n📝 Processing ${manifest.path}...`));

  const manifestProcessors = {
    "package.json": syncPackageJson,
    "pyproject.toml": syncPyprojectToml,
    "Cargo.toml": syncCargoToml,
    Makefile: syncMakefile,
  };

  const processor = manifestProcessors[manifest.type];
  if (processor) {
    return await processor(filePath, context.dryRun, context.backup, context.force);
  }

  return { modified: false, conflicts: [], checksum: "" };
}

function displayManifestResult(manifest: ManifestFile, result: SyncResult, dryRun: boolean): void {
  if (result.modified) {
    const status = dryRun ? "Would modify" : "Modified";
    const conflictCount = result.conflicts.filter((c) => c.applied).length;
    if (conflictCount > 0) {
      console.log(
        chalk.green(`✅ ${status} ${manifest.path} (${conflictCount} conflict(s) resolved)`),
      );
    } else {
      console.log(chalk.green(`✅ ${status} ${manifest.path}`));
    }
  } else {
    console.log(chalk.dim(`⏭️  No changes needed for ${manifest.path}`));
  }
}

function displaySynchronizationResults(context: SyncContext, syncResults: SyncResult[]): void {
  const totalModified = syncResults.filter((r) => r.modified).length;

  console.log(chalk.green("\n🎉 Synchronization complete!"));
  console.log(
    chalk.cyan(
      `📊 Summary: ${totalModified}/${context.targetManifests.length} files ${context.dryRun ? "would be" : "were"} modified`,
    ),
  );
}

function displayNextStepsGuidance(context: SyncContext, syncResults: SyncResult[]): void {
  const totalModified = syncResults.filter((r) => r.modified).length;

  if (totalModified > 0 && !context.dryRun) {
    console.log(chalk.cyan("\nNext steps:"));
    displayLanguageSpecificGuidance(context.targetManifests, context.projectPath);
  }

  if (context.dryRun && totalModified > 0) {
    console.log(chalk.yellow("\n💡 Run without --dry-run to apply these changes"));
  }
}

function displayLanguageSpecificGuidance(manifests: ManifestFile[], projectPath: string): void {
  const packageManager = detectPackageManager(undefined, projectPath);
  const pm = getPackageManagerCommands(packageManager);
  const guidanceMap = {
    "package.json": [
      `  • Run "${pm.install}" to install new dev dependencies`,
      `  • Use "${pm.run("arbiter:check")}" to validate CUE files`,
    ],
    "pyproject.toml": ['  • Run "pip install -e ." to install in development mode'],
    "Cargo.toml": ['  • Run "cargo build" to update dependencies'],
    Makefile: ['  • Use "make arbiter-check" to validate CUE files'],
  };

  for (const [manifestType, guidance] of Object.entries(guidanceMap)) {
    if (manifests.some((m) => m.type === manifestType)) {
      guidance.forEach((line) => console.log(chalk.dim(line)));
    }
  }
}

// Export helpers for testing
export {
  detectManifestFiles,
  calculateChecksum,
  createBackup,
  writeFileSafely,
  deepMerge,
  generateChangeSet,
  validateIdempotency,
  getArbiterPackageUpdates,
  applyArbiterUpdates,
  reportPotentialChanges,
  applyPackageChanges,
  syncPackageJson,
  syncPyprojectToml,
  syncCargoToml,
  syncMakefile,
};

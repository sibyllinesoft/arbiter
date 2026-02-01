/**
 * @packageDocumentation
 * Manifest synchronization utilities.
 *
 * Provides functionality to:
 * - Sync package.json, pyproject.toml, Cargo.toml, Makefile
 * - Handle conflict resolution during sync
 * - Create backups before modifications
 * - Validate idempotency of sync operations
 */

import fs from "node:fs/promises";
import path from "node:path";
import { copyStandalone, safeFileOperation } from "@/constraints/index.js";
import chalk from "chalk";
import packageJson from "../../../package.json" with { type: "json" };

export interface SyncResult {
  modified: boolean;
  conflicts: ConflictResolution[];
  checksum: string;
  backupPath?: string;
}

export interface ConflictResolution {
  path: string;
  type: "value_conflict" | "section_exists" | "section_replaced" | "merge_required" | "error";
  resolution:
    | "merged"
    | "preserved_existing"
    | "replaced_with_template"
    | "replaced_with_source"
    | "failed";
  applied?: boolean;
  details: string;
}

/**
 * Calculate file checksum for idempotency validation
 */
export function calculateChecksum(content: string): string {
  const crypto = require("node:crypto");
  return crypto.createHash("sha256").update(content).digest("hex").substring(0, 16);
}

/**
 * Create backup of a file with timestamp
 */
export async function createBackup(filePath: string): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = `${filePath}.backup.${timestamp}`;
  await copyStandalone(filePath, backupPath);
  return backupPath;
}

export async function writeFileSafely(filePath: string, content: string): Promise<void> {
  await safeFileOperation("write", filePath, async (validatedPath) => {
    await fs.writeFile(validatedPath, content, "utf-8");
  });
}

/**
 * Validate that sync operation is idempotent
 */
export async function validateIdempotency(
  filePath: string,
  expectedChecksum: string,
): Promise<boolean> {
  try {
    const currentContent = await fs.readFile(filePath, "utf8");
    const currentChecksum = calculateChecksum(currentContent);
    return currentChecksum === expectedChecksum;
  } catch {
    return false;
  }
}

function isNestedObject(value: unknown): boolean {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function valuesAreDifferent(existing: unknown, incoming: unknown): boolean {
  return JSON.stringify(existing) !== JSON.stringify(incoming);
}

function recordForceConflict(
  conflicts: ConflictResolution[],
  path: string,
  existing: unknown,
  incoming: unknown,
): void {
  conflicts.push({
    path,
    type: "value_conflict",
    resolution: "replaced_with_source",
    applied: true,
    details: `Overwrote ${path}: ${JSON.stringify(existing)} → ${JSON.stringify(incoming)}`,
  });
}

function recordPreserveConflict(
  conflicts: ConflictResolution[],
  path: string,
  existing: unknown,
  incoming: unknown,
): void {
  conflicts.push({
    path,
    type: "value_conflict",
    resolution: "preserved_existing",
    applied: false,
    details: `Preserved existing ${path}: ${JSON.stringify(existing)} (would be ${JSON.stringify(incoming)})`,
  });
}

function handleValueConflict(
  result: Record<string, unknown>,
  key: string,
  sourceValue: unknown,
  conflicts: ConflictResolution[],
  currentPath: string,
  force: boolean,
): void {
  if (force) {
    recordForceConflict(conflicts, currentPath, result[key], sourceValue);
    result[key] = sourceValue;
  } else {
    recordPreserveConflict(conflicts, currentPath, result[key], sourceValue);
  }
}

/**
 * Deep merge objects, handling conflicts intelligently
 */
export function deepMerge(
  target: any,
  source: any,
  conflicts: ConflictResolution[],
  path = "",
  force = false,
): any {
  const result = { ...target };

  for (const key in source) {
    const currentPath = path ? `${path}.${key}` : key;

    if (!(key in result)) {
      result[key] = source[key];
    } else if (isNestedObject(source[key]) && isNestedObject(result[key])) {
      result[key] = deepMerge(result[key], source[key], conflicts, currentPath, force);
    } else if (valuesAreDifferent(result[key], source[key])) {
      handleValueConflict(result, key, source[key], conflicts, currentPath, force);
    }
  }

  return result;
}

/**
 * Get Arbiter configuration updates for package.json
 */
export function getArbiterPackageUpdates() {
  return {
    scripts: {
      "arbiter:status": "arbiter status",
      "arbiter:test:scaffold": "arbiter tests scaffold --language typescript",
      "arbiter:test:cover": "arbiter tests cover --threshold 0.8",
      "arbiter:version:plan": "arbiter version plan --strict",
      "arbiter:sync": "arbiter sync --language typescript",
    },
    devDependencies: {
      "@arbiter/cli": `^${packageJson.version}`,
    },
    arbiter: {
      profiles: ["library"],
      coverage: {
        threshold: 0.8,
      },
    },
  };
}

/**
 * Apply Arbiter updates to package object
 */
export function applyArbiterUpdates(
  pkg: any,
  arbiterUpdates: ReturnType<typeof getArbiterPackageUpdates>,
  force: boolean,
): ConflictResolution[] {
  const conflicts: ConflictResolution[] = [];

  if (!pkg.scripts) pkg.scripts = {};
  if (!pkg.devDependencies) pkg.devDependencies = {};

  pkg.scripts = deepMerge(pkg.scripts, arbiterUpdates.scripts, conflicts, "scripts", force);
  pkg.devDependencies = deepMerge(
    pkg.devDependencies,
    arbiterUpdates.devDependencies,
    conflicts,
    "devDependencies",
    force,
  );
  pkg.arbiter = deepMerge(pkg.arbiter || {}, arbiterUpdates.arbiter, conflicts, "arbiter", force);

  return conflicts;
}

/**
 * Report changes that would be made
 */
export function reportPotentialChanges(changeSet: any, conflicts: ConflictResolution[]): void {
  if (Object.keys(changeSet.added).length > 0) {
    console.log(chalk.green("  ✨ Would add:"));
    for (const [key, value] of Object.entries(changeSet.added)) {
      console.log(chalk.dim(`    ${key}: ${JSON.stringify(value, null, 2).split("\n")[0]}...`));
    }
  }

  if (Object.keys(changeSet.modified).length > 0) {
    console.log(chalk.yellow("  🔄 Would modify:"));
    for (const [key, change] of Object.entries(changeSet.modified) as Array<[string, any]>) {
      console.log(
        chalk.dim(`    ${key}: ${JSON.stringify(change.from)} → ${JSON.stringify(change.to)}`),
      );
    }
  }

  if (conflicts.length > 0) {
    console.log(chalk.yellow(`  ⚠️  ${conflicts.length} conflict(s) detected:`));
    for (const conflict of conflicts) {
      const status = conflict.applied ? chalk.green("RESOLVED") : chalk.red("PRESERVED");
      console.log(chalk.dim(`    ${status}: ${conflict.details}`));
    }
  }
}

/**
 * Apply changes to package.json file
 */
export async function applyPackageChanges(
  filePath: string,
  newContent: string,
  backup: boolean,
  newChecksum: string,
): Promise<string | undefined> {
  let backupPath: string | undefined;

  if (backup) {
    backupPath = await createBackup(filePath);
    console.log(chalk.dim(`  📦 Created backup: ${path.basename(backupPath)}`));
  }

  await writeFileSafely(filePath, newContent);

  const isIdempotent = await validateIdempotency(filePath, newChecksum);
  if (!isIdempotent) {
    console.log(chalk.yellow("  ⚠️  Warning: File was modified by external process during sync"));
  }

  return backupPath;
}

/**
 * Sync package.json with Arbiter configuration
 */
function createEmptySyncResult(): SyncResult {
  return {
    modified: false,
    conflicts: [],
    checksum: "",
    backupPath: undefined,
  };
}

async function processPackageSync(
  filePath: string,
  dryRun: boolean,
  backup: boolean,
  force: boolean,
): Promise<SyncResult> {
  const originalContent = await fs.readFile(filePath, "utf8");
  const originalPkg = JSON.parse(originalContent);
  const originalChecksum = calculateChecksum(originalContent);

  const pkg = JSON.parse(originalContent);
  const arbiterUpdates = getArbiterPackageUpdates();
  const conflicts = applyArbiterUpdates(pkg, arbiterUpdates, force);

  const newContent = `${JSON.stringify(pkg, null, 2)}\n`;
  const newChecksum = calculateChecksum(newContent);
  const modified = originalChecksum !== newChecksum;

  const changeSet = generateChangeSet(originalPkg, pkg);
  if (modified) {
    reportPotentialChanges(changeSet, conflicts);
  }

  let backupPath: string | undefined;
  if (modified && !dryRun) {
    backupPath = await applyPackageChanges(filePath, newContent, backup, newChecksum);
  }

  return { modified, conflicts, checksum: newChecksum, backupPath };
}

export async function syncPackageJson(
  filePath: string,
  dryRun: boolean,
  backup: boolean,
  force: boolean,
): Promise<SyncResult> {
  try {
    return await processPackageSync(filePath, dryRun, backup, force);
  } catch (error) {
    console.error(
      chalk.red(`  ❌ Failed to sync ${filePath}:`),
      error instanceof Error ? error.message : String(error),
    );
    return createEmptySyncResult();
  }
}

/**
 * Generate change set showing what would be modified
 */
export function generateChangeSet(original: any, modified: any) {
  const changeSet = {
    added: {} as Record<string, any>,
    modified: {} as Record<string, { from: any; to: any }>,
    removed: {} as Record<string, any>,
  };

  for (const key in modified) {
    if (!(key in original)) {
      changeSet.added[key] = modified[key];
    } else if (JSON.stringify(original[key]) !== JSON.stringify(modified[key])) {
      changeSet.modified[key] = {
        from: original[key],
        to: modified[key],
      };
    }
  }

  for (const key in original) {
    if (!(key in modified)) {
      changeSet.removed[key] = original[key];
    }
  }

  return changeSet;
}

/**
 * Default Arbiter config template for pyproject.toml
 */
const PYPROJECT_ARBITER_CONFIG = `
[tool.arbiter]
profiles = ["library"]

[tool.arbiter.coverage]
threshold = 0.8

[tool.arbiter.scripts]
check = "arbiter status"
test_scaffold = "arbiter tests scaffold --language python"
test_cover = "arbiter tests cover --threshold 0.8"
version_plan = "arbiter version plan --strict"
sync = "arbiter sync --language python"
`;

/**
 * Check if pyproject.toml has existing Arbiter section
 */
function hasExistingArbiterSection(content: string): boolean {
  return /\[tool\.arbiter\]/.test(content);
}

/**
 * Create result for when existing section should be preserved
 */
function createPreservedSectionResult(content: string): SyncResult {
  console.log(
    chalk.yellow("⚠️  pyproject.toml already has [tool.arbiter] section. Use --force to overwrite."),
  );
  return {
    modified: false,
    conflicts: [
      {
        path: "[tool.arbiter]",
        type: "section_exists",
        resolution: "preserved_existing",
        details: "Use --force to overwrite existing Arbiter section",
      },
    ],
    checksum: calculateChecksum(content),
  };
}

/**
 * Append Arbiter config to content
 */
function appendArbiterConfig(content: string): string {
  return `${content.trim()}\n${PYPROJECT_ARBITER_CONFIG}`;
}

/**
 * Replace existing Arbiter section with new config
 */
function replaceArbiterSection(content: string): string {
  const sectionStart = content.indexOf("[tool.arbiter]");
  const sectionEnd = content.indexOf("[", sectionStart + 1);

  const beforeSection = content.substring(0, sectionStart);
  const newConfig = PYPROJECT_ARBITER_CONFIG.trim();

  if (sectionEnd === -1) {
    return beforeSection + newConfig;
  }

  const afterSection = content.substring(sectionEnd);
  return `${beforeSection}${newConfig}\n\n${afterSection}`;
}

/**
 * Write modified content with optional backup
 */
async function writeWithBackup(
  filePath: string,
  content: string,
  shouldBackup: boolean,
): Promise<string | undefined> {
  let backupPath: string | undefined;

  if (shouldBackup) {
    backupPath = await createBackup(filePath);
    console.log(chalk.dim(`📦 Created backup: ${backupPath}`));
  }

  await writeFileSafely(filePath, content);
  return backupPath;
}

/**
 * Create error result for sync failures
 */
function createSyncErrorResult(filePath: string, error: unknown): SyncResult {
  console.error(
    chalk.red(`❌ Failed to sync ${filePath}:`),
    error instanceof Error ? error.message : String(error),
  );
  return {
    modified: false,
    conflicts: [
      {
        path: filePath,
        type: "error",
        resolution: "failed",
        details: error instanceof Error ? error.message : String(error),
      },
    ],
    checksum: "",
  };
}

/**
 * Configuration for a generic section sync operation
 */
interface SectionSyncConfig {
  hasSection: (content: string) => boolean;
  insertSection: (content: string) => string;
  replaceSection: (content: string) => string;
  createPreservedResult: (content: string) => SyncResult;
  sectionPath: string;
  sectionDescription: string;
}

/**
 * Build conflict for forced section replacement
 */
function buildForceReplaceConflict(
  sectionPath: string,
  sectionDescription: string,
): ConflictResolution {
  return {
    path: sectionPath,
    type: "section_replaced",
    resolution: "replaced_with_template",
    details: `Existing ${sectionDescription} replaced due to --force flag`,
  };
}

/**
 * Generic section sync implementation
 */
async function syncSectionContent(
  filePath: string,
  content: string,
  config: SectionSyncConfig,
  dryRun: boolean,
  backup: boolean,
  force: boolean,
): Promise<SyncResult> {
  const hasSection = config.hasSection(content);

  if (hasSection && !force) {
    return config.createPreservedResult(content);
  }

  const newContent = hasSection ? config.replaceSection(content) : config.insertSection(content);

  let backupPath: string | undefined;
  if (!dryRun) {
    backupPath = await writeWithBackup(filePath, newContent, backup);
  }

  const conflicts: ConflictResolution[] =
    hasSection && force
      ? [buildForceReplaceConflict(config.sectionPath, config.sectionDescription)]
      : [];

  return {
    modified: true,
    conflicts,
    checksum: calculateChecksum(newContent),
    backupPath,
  };
}

const PYPROJECT_SYNC_CONFIG: SectionSyncConfig = {
  hasSection: hasExistingArbiterSection,
  insertSection: appendArbiterConfig,
  replaceSection: replaceArbiterSection,
  createPreservedResult: createPreservedSectionResult,
  sectionPath: "[tool.arbiter]",
  sectionDescription: "section",
};

/**
 * Sync pyproject.toml with Arbiter configuration
 */
export async function syncPyprojectToml(
  filePath: string,
  dryRun: boolean,
  backup: boolean,
  force: boolean,
): Promise<SyncResult> {
  try {
    const content = await fs.readFile(filePath, "utf8");
    return syncSectionContent(filePath, content, PYPROJECT_SYNC_CONFIG, dryRun, backup, force);
  } catch (error) {
    return createSyncErrorResult(filePath, error);
  }
}

/**
 * Default Arbiter config template for Cargo.toml
 */
const CARGO_ARBITER_CONFIG = `
[package.metadata.arbiter]
profiles = ["library"]
coverage_threshold = 0.8

[package.metadata.arbiter.scripts]
check = "arbiter status"
test_scaffold = "arbiter tests scaffold --language rust"
test_cover = "arbiter tests cover --threshold 0.8"
version_plan = "arbiter version plan --strict"
sync = "arbiter sync --language rust"
`;

/**
 * Check if Cargo.toml has existing Arbiter section
 */
function hasExistingCargoArbiterSection(content: string): boolean {
  return /\[package\.metadata\.arbiter\]/.test(content);
}

/**
 * Insert Arbiter config after [package] section
 */
function insertCargoArbiterConfig(content: string): string {
  const packageSectionEnd = content.indexOf("\n[", content.indexOf("[package]") + 1);
  if (packageSectionEnd === -1) {
    return `${content.trim()}\n${CARGO_ARBITER_CONFIG}`;
  }
  return `${content.substring(0, packageSectionEnd)}\n${CARGO_ARBITER_CONFIG.trim()}${content.substring(packageSectionEnd)}`;
}

/**
 * Replace existing Arbiter section in Cargo.toml
 */
function replaceCargoArbiterSection(content: string): string {
  const sectionStart = content.indexOf("[package.metadata.arbiter]");
  const nextSection = content.indexOf("\n[", sectionStart + 1);

  if (nextSection === -1) {
    return content.substring(0, sectionStart) + CARGO_ARBITER_CONFIG.trim();
  }
  return `${content.substring(0, sectionStart)}${CARGO_ARBITER_CONFIG.trim()}\n${content.substring(nextSection)}`;
}

/**
 * Create result for when existing Cargo.toml section should be preserved
 */
function createPreservedCargoSectionResult(content: string): SyncResult {
  console.log(
    chalk.yellow(
      "⚠️  Cargo.toml already has [package.metadata.arbiter] section. Use --force to overwrite.",
    ),
  );
  return {
    modified: false,
    conflicts: [
      {
        path: "[package.metadata.arbiter]",
        type: "section_exists",
        resolution: "preserved_existing",
        details: "Use --force to overwrite existing Arbiter section",
      },
    ],
    checksum: calculateChecksum(content),
  };
}

const CARGO_SYNC_CONFIG: SectionSyncConfig = {
  hasSection: hasExistingCargoArbiterSection,
  insertSection: insertCargoArbiterConfig,
  replaceSection: replaceCargoArbiterSection,
  createPreservedResult: createPreservedCargoSectionResult,
  sectionPath: "[package.metadata.arbiter]",
  sectionDescription: "section",
};

/**
 * Sync Cargo.toml with Arbiter metadata
 */
export async function syncCargoToml(
  filePath: string,
  dryRun: boolean,
  backup: boolean,
  force: boolean,
): Promise<SyncResult> {
  try {
    const content = await fs.readFile(filePath, "utf8");
    return syncSectionContent(filePath, content, CARGO_SYNC_CONFIG, dryRun, backup, force);
  } catch (error) {
    return createSyncErrorResult(filePath, error);
  }
}

/**
 * Default Arbiter targets for Makefile
 */
const MAKEFILE_ARBITER_TARGETS = `
# Arbiter targets
.PHONY: arbiter-status arbiter-test-scaffold arbiter-test-cover arbiter-version-plan arbiter-sync

arbiter-status:
	arbiter status

arbiter-test-scaffold:
	arbiter tests scaffold --language bash

arbiter-test-cover:
	arbiter tests cover --threshold 0.8

arbiter-version-plan:
	arbiter version plan --strict

arbiter-sync:
	arbiter sync --language bash
`;

/**
 * Check if Makefile has existing Arbiter targets
 */
function hasExistingMakefileArbiterTargets(content: string): boolean {
  return content.includes("# Arbiter targets");
}

/**
 * Append Arbiter targets to Makefile
 */
function appendMakefileArbiterTargets(content: string): string {
  return `${content.trim()}\n${MAKEFILE_ARBITER_TARGETS}`;
}

/**
 * Replace existing Arbiter targets in Makefile
 */
function replaceMakefileArbiterTargets(content: string): string {
  const sectionStart = content.indexOf("# Arbiter targets");
  const nextSection = content.indexOf("\n# ", sectionStart + 1);

  if (nextSection === -1) {
    return content.substring(0, sectionStart) + MAKEFILE_ARBITER_TARGETS.trim();
  }
  return `${content.substring(0, sectionStart)}${MAKEFILE_ARBITER_TARGETS.trim()}\n\n${content.substring(nextSection)}`;
}

/**
 * Create result for when existing Makefile targets should be preserved
 */
function createPreservedMakefileTargetsResult(content: string): SyncResult {
  console.log(chalk.yellow("⚠️  Makefile already has Arbiter targets. Use --force to overwrite."));
  return {
    modified: false,
    conflicts: [
      {
        path: "# Arbiter targets",
        type: "section_exists",
        resolution: "preserved_existing",
        details: "Use --force to overwrite existing Arbiter targets",
      },
    ],
    checksum: calculateChecksum(content),
  };
}

const MAKEFILE_SYNC_CONFIG: SectionSyncConfig = {
  hasSection: hasExistingMakefileArbiterTargets,
  insertSection: appendMakefileArbiterTargets,
  replaceSection: replaceMakefileArbiterTargets,
  createPreservedResult: createPreservedMakefileTargetsResult,
  sectionPath: "# Arbiter targets",
  sectionDescription: "targets",
};

/**
 * Sync Makefile with Arbiter targets
 */
export async function syncMakefile(
  filePath: string,
  dryRun: boolean,
  backup: boolean,
  force: boolean,
): Promise<SyncResult> {
  try {
    const content = await fs.readFile(filePath, "utf8");
    return syncSectionContent(filePath, content, MAKEFILE_SYNC_CONFIG, dryRun, backup, force);
  } catch (error) {
    return createSyncErrorResult(filePath, error);
  }
}

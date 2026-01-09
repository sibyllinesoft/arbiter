/**
 * @packageDocumentation
 * Diff command - Compare CUE specification files and generate migration paths.
 *
 * Provides functionality to:
 * - Compare two CUE specification files
 * - Detect breaking changes vs compatible changes
 * - Generate migration hints for schema evolution
 * - Output diffs in text or JSON format
 */

import fs from "node:fs/promises";
import path from "node:path";
import { safeFileOperation } from "@/constraints/index.js";
import chalk from "chalk";
import {
  createAddedChange,
  createModifiedChange,
  createRemovedChange,
  formatDiffText,
  sortChangesByImpact,
} from "./change-analysis.js";
import { createParserState, parseCueLine } from "./cue-parser.js";

export interface DiffOptions {
  migration?: boolean;
  format?: "text" | "json";
  context?: number;
  summary?: boolean;
}

export interface SchemaChange {
  type: "added" | "removed" | "modified";
  category: "constraint" | "field" | "import" | "package" | "comment";
  location: string;
  old_value?: string;
  new_value?: string;
  impact: "breaking" | "compatible" | "neutral";
  description: string;
  line_number?: number;
  migration_hint?: string;
}

export interface SchemaDiff {
  summary: {
    total_changes: number;
    breaking_changes: number;
    added: number;
    removed: number;
    modified: number;
  };
  changes: SchemaChange[];
  migration_needed: boolean;
  compatibility_score: number;
}

/**
 * Parse CUE file and extract structural information.
 */
export async function parseCueStructure(filePath: string): Promise<Map<string, string>> {
  const content = await fs.readFile(filePath, "utf-8");
  const state = createParserState();

  for (const line of content.split("\n")) {
    parseCueLine(line, state);
  }

  return state.structure;
}

/**
 * Detect change for a single key between old and new structures.
 */
function detectKeyChange(
  key: string,
  oldValue: string | undefined,
  newValue: string | undefined,
): SchemaChange | null {
  if (oldValue && !newValue) {
    return createRemovedChange(key, oldValue);
  }
  if (!oldValue && newValue) {
    return createAddedChange(key, newValue);
  }
  if (oldValue && newValue && oldValue !== newValue) {
    return createModifiedChange(key, oldValue, newValue);
  }
  return null;
}

/**
 * Compare two schema structures and generate diff.
 */
export function compareSchemas(
  oldStructure: Map<string, string>,
  newStructure: Map<string, string>,
): SchemaChange[] {
  const changes: SchemaChange[] = [];
  const allKeys = new Set([...oldStructure.keys(), ...newStructure.keys()]);

  for (const key of allKeys) {
    const change = detectKeyChange(key, oldStructure.get(key), newStructure.get(key));
    if (change) {
      changes.push(change);
    }
  }

  return sortChangesByImpact(changes);
}

/**
 * Calculate compatibility score.
 */
export function calculateCompatibilityScore(changes: SchemaChange[]): number {
  if (changes.length === 0) return 100;

  let score = 100;
  for (const change of changes) {
    switch (change.impact) {
      case "breaking":
        score -= 20;
        break;
      case "compatible":
        score -= 5;
        break;
      case "neutral":
        score -= 1;
        break;
    }
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Generate diff summary.
 */
function generateSummary(changes: SchemaChange[]): SchemaDiff["summary"] {
  return {
    total_changes: changes.length,
    breaking_changes: changes.filter((c) => c.impact === "breaking").length,
    added: changes.filter((c) => c.type === "added").length,
    removed: changes.filter((c) => c.type === "removed").length,
    modified: changes.filter((c) => c.type === "modified").length,
  };
}

/**
 * Generate migration script.
 */
export function generateMigrationScript(diff: SchemaDiff): string {
  const breakingChanges = diff.changes.filter((c) => c.impact === "breaking");
  if (breakingChanges.length === 0) {
    return "# No migration needed - all changes are backward compatible\n";
  }

  let script = "# Schema Migration Script\n";
  script += `# Generated: ${new Date().toISOString()}\n\n`;
  script += "# Breaking changes require manual review and data migration\n\n";

  for (const change of breakingChanges) {
    script += `# ${change.description}\n`;
    script += `# Location: ${change.location}\n`;
    if (change.migration_hint) {
      script += `# Action required: ${change.migration_hint}\n`;
    }
    script += "\n";
  }

  return script;
}

/**
 * Diff command - Compare two schemas.
 */
export async function diffCommand(
  oldFile: string,
  newFile: string,
  options: DiffOptions = {},
): Promise<number> {
  const structuredOutput = options.format === "json";
  try {
    if (!(await verifyFilesExist(oldFile, newFile))) {
      return 1;
    }

    logComparisonHeader(oldFile, newFile, structuredOutput);

    const diff = await computeSchemaDiff(oldFile, newFile);
    outputDiffResults(diff, options, structuredOutput);
    await maybeGenerateMigration(diff, newFile, options, structuredOutput);

    return diff.migration_needed ? 1 : 0;
  } catch (error) {
    console.error(
      chalk.red("Error comparing schemas:"),
      error instanceof Error ? error.message : String(error),
    );
    return 1;
  }
}

async function verifyFilesExist(oldFile: string, newFile: string): Promise<boolean> {
  try {
    await fs.access(oldFile);
    await fs.access(newFile);
    return true;
  } catch (error) {
    console.error(
      chalk.red("File not found:"),
      error instanceof Error ? error.message : String(error),
    );
    return false;
  }
}

function logComparisonHeader(oldFile: string, newFile: string, structuredOutput: boolean): void {
  if (structuredOutput) return;
  console.log(chalk.dim(`Comparing ${oldFile} → ${newFile}`));
  console.log();
}

async function computeSchemaDiff(oldFile: string, newFile: string): Promise<SchemaDiff> {
  const oldStructure = await parseCueStructure(oldFile);
  const newStructure = await parseCueStructure(newFile);

  const changes = compareSchemas(oldStructure, newStructure);
  const summary = generateSummary(changes);
  const compatibilityScore = calculateCompatibilityScore(changes);
  const migrationNeeded = changes.some((c) => c.impact === "breaking");

  return {
    summary,
    changes,
    migration_needed: migrationNeeded,
    compatibility_score: compatibilityScore,
  };
}

function outputDiffResults(
  diff: SchemaDiff,
  options: DiffOptions,
  structuredOutput: boolean,
): void {
  if (structuredOutput) {
    console.log(JSON.stringify(diff, null, 2));
  } else {
    console.log(formatDiffText(diff, options));
  }
}

async function maybeGenerateMigration(
  diff: SchemaDiff,
  newFile: string,
  options: DiffOptions,
  structuredOutput: boolean,
): Promise<void> {
  if (!options.migration || !diff.migration_needed) return;

  const migrationScript = generateMigrationScript(diff);
  const migrationPath = `${path.basename(newFile, ".cue")}-migration.md`;
  await safeFileOperation("write", migrationPath, async (validatedPath) => {
    await fs.writeFile(validatedPath, migrationScript, "utf-8");
  });

  if (!structuredOutput) {
    console.log(chalk.green(`✓ Migration guide created: ${migrationPath}`));
  }
}

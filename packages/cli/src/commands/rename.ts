/**
 * Rename command - Migrate existing files to smart naming
 *
 * Helps users transition from generic file names (arbiter.assembly.cue, surface.json)
 * to project-specific names (myproject.assembly.cue, myproject-surface.json)
 */

import fs from "node:fs";
import chalk from "chalk";
import type { CLIConfig } from "../types.js";
import {
  detectNamingPreferences,
  FILE_PATTERNS,
  type FileType,
  migrateExistingFiles,
  resolveSmartNaming,
} from "../utils/smart-naming.js";

export interface RenameOptions {
  /** Show what would be renamed without doing it */
  dryRun?: boolean;
  /** Apply the renaming changes */
  apply?: boolean;
  /** Force overwrite existing files */
  force?: boolean;
  /** Show verbose output */
  verbose?: boolean;
  /** Specific file types to rename */
  types?: string[];
}

/**
 * Rename command implementation
 */
export async function renameCommand(options: RenameOptions, _config: CLIConfig): Promise<number> {
  try {
    console.log(chalk.blue("🔄 Analyzing files for smart naming migration..."));

    // Detect current naming preferences
    const preferences = await detectNamingPreferences();

    if (preferences.usesProjectNames) {
      console.log(chalk.green("✅ Project already uses project-specific naming"));
      console.log(chalk.dim("Current naming patterns:"));
      for (const pattern of preferences.existingPatterns) {
        console.log(chalk.dim(`  ${pattern.type}: ${pattern.filename}`));
      }

      if (!options.force) {
        console.log(
          chalk.dim("\nUse --force to rename anyway, or --dry-run to see what would happen"),
        );
        return 0;
      }
    }

    // Show current vs. proposed naming
    console.log(chalk.cyan("\nFile naming analysis:"));

    const fileTypes = options.types
      ? (options.types.filter((type) => type in FILE_PATTERNS) as FileType[])
      : (Object.keys(FILE_PATTERNS) as FileType[]);

    let hasChanges = false;
    const proposedChanges: Array<{ from: string; to: string; type: FileType }> = [];

    for (const fileType of fileTypes) {
      const currentDefault = FILE_PATTERNS[fileType].default;
      const smartNaming = await resolveSmartNaming(fileType, { useGenericNames: false });

      if (currentDefault !== smartNaming.filename) {
        hasChanges = true;
        proposedChanges.push({
          from: currentDefault,
          to: smartNaming.filename,
          type: fileType,
        });

        const exists = fs.existsSync(currentDefault);
        const status = exists ? chalk.yellow("EXISTS") : chalk.gray("N/A");

        console.log(chalk.dim(`  ${fileType}:`));
        console.log(chalk.dim(`    Current:  ${currentDefault} ${status}`));
        console.log(chalk.dim(`    Proposed: ${smartNaming.filename}`));

        if (smartNaming.context.name && options.verbose) {
          console.log(chalk.dim(`    Project:  ${smartNaming.context.name}`));
        }
      }
    }

    if (!hasChanges) {
      console.log(chalk.green("✅ No naming changes needed"));
      return 0;
    }

    // Perform migration
    const migrations = await migrateExistingFiles(process.cwd(), options.dryRun || !options.apply);

    if (options.dryRun || !options.apply) {
      console.log(chalk.yellow("\n🔍 Dry run - files that would be renamed:"));
      for (const migration of migrations) {
        console.log(chalk.dim(`  ${migration.from} → ${migration.to}`));
      }

      if (!options.dryRun) {
        console.log(chalk.dim("\nUse --apply to execute the renaming"));
      }
    } else {
      console.log(chalk.green(`\n✅ Migration complete:`));
      let renamedCount = 0;

      for (const migration of migrations) {
        if (migration.migrated) {
          console.log(chalk.green(`  ✓ ${migration.from} → ${migration.to}`));
          renamedCount++;
        } else {
          console.log(chalk.yellow(`  ⚠ ${migration.from} (not migrated - file may not exist)`));
        }
      }

      console.log(chalk.green(`\nRenamed ${renamedCount} files to use project-specific naming`));
    }

    return 0;
  } catch (error) {
    console.error(
      chalk.red("❌ Rename command failed:"),
      error instanceof Error ? error.message : String(error),
    );
    return 1;
  }
}

/**
 * Show naming help and examples
 */
export function showNamingHelp(): void {
  console.log(chalk.cyan("Smart Naming Examples:"));
  console.log(chalk.dim(""));
  console.log(chalk.dim("Generic naming (old):"));
  console.log(chalk.dim("  arbiter.assembly.cue"));
  console.log(chalk.dim("  surface.json"));
  console.log(chalk.dim("  version_plan.json"));
  console.log(chalk.dim(""));
  console.log(chalk.dim("Project-specific naming (new):"));
  console.log(chalk.dim("  myproject.assembly.cue"));
  console.log(chalk.dim("  myproject-surface.json"));
  console.log(chalk.dim("  myproject-version-plan.json"));
  console.log(chalk.dim(""));
  console.log(chalk.cyan("Project name detection:"));
  console.log(chalk.dim("  1. package.json 'name' field"));
  console.log(chalk.dim("  2. Assembly file 'name' field"));
  console.log(chalk.dim("  3. Directory name"));
  console.log(chalk.dim("  4. Manual override with --project-name"));
  console.log(chalk.dim(""));
  console.log(chalk.cyan("Backward compatibility:"));
  console.log(chalk.dim("  Use --generic-names flag to keep old naming"));
  console.log(chalk.dim("  Existing tools will find files automatically"));
}

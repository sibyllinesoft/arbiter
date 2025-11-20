// @ts-nocheck
/**
 * Rename command - Migrate existing files to smart naming
 *
 * Helps users transition from generic file names (arbiter.assembly.cue, surface.json)
 * to project-specific names (myproject.assembly.cue, myproject-surface.json)
 */

import fs from "node:fs";
import chalk from "chalk";
import type { CLIConfig } from "../../types.js";
import {
  FILE_PATTERNS,
  type FileType,
  detectNamingPreferences,
  migrateExistingFiles,
  resolveSmartNaming,
} from "../../utils/smart-naming.js";

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

    // Determine which files to rename
    const typesToRename = options.types?.length
      ? (options.types as FileType[])
      : (Object.keys(FILE_PATTERNS) as FileType[]);

    const naming = resolveSmartNaming(preferences.projectName);

    console.log(chalk.dim(`Project naming: ${naming.projectSlug}`));
    if (options.verbose) {
      console.log(chalk.dim(`Config prefix: ${naming.configPrefix}`));
      console.log(chalk.dim(`Surface prefix: ${naming.surfacePrefix}`));
    }

    // Get proposed changes
    const changes = await migrateExistingFiles(typesToRename, naming, { dryRun: true });

    if (changes.length === 0) {
      console.log(chalk.green("✅ All files already use smart naming"));
      return 0;
    }

    console.log(chalk.blue("📦 Proposed changes:"));
    for (const change of changes) {
      console.log(
        `${chalk.dim(change.from)} ${chalk.yellow("→")} ${chalk.green(change.to)}${
          change.exists && !options.force ? chalk.red(" (exists)") : ""
        }`,
      );
    }

    // If dry run, exit after showing changes
    if (options.dryRun) {
      console.log(chalk.dim("\nDry run complete. Use --apply to perform changes."));
      return 0;
    }

    // Confirm there are no conflicts unless force is used
    for (const change of changes) {
      if (change.exists && !options.force) {
        console.log(
          chalk.red(`❌ Destination file exists: ${change.to}. Use --force to overwrite.`),
        );
        return 1;
      }
    }

    // Apply changes
    const results = await migrateExistingFiles(typesToRename, naming, {
      dryRun: false,
      force: options.force,
    });

    for (const result of results) {
      if (result.success) {
        console.log(chalk.green(`✅ Renamed: ${result.from} → ${result.to}`));
      } else {
        console.log(
          chalk.red(`❌ Failed: ${result.from} → ${result.to} (${result.error ?? "unknown"})`),
        );
      }
    }

    console.log(chalk.green("\n🎉 Smart naming migration complete!"));

    // Show next steps
    console.log(chalk.blue("Next steps:"));
    console.log(
      chalk.dim(
        "  - Update references to new file names in your CI/CD and documentation if necessary",
      ),
    );
    console.log(
      chalk.dim("  - Run arbiter generate to regenerate any derived artifacts with new names"),
    );

    return 0;
  } catch (error) {
    console.error(
      chalk.red("❌ Rename failed:"),
      error instanceof Error ? error.message : String(error),
    );
    return 1;
  }
}

export function showNamingHelp(): void {
  console.log(chalk.blue("\n📘 Smart Naming Conventions\n"));
  console.log(chalk.dim("Arbiter uses smart naming to make project files self-descriptive.\n"));

  console.log(chalk.yellow("Core patterns:"));
  console.log(`  • Configuration: ${chalk.green("<project>.arbiter.cue")} (primary config)`);
  console.log(`  • Assembly:      ${chalk.green("<project>.assembly.cue")} (combined spec)`);
  console.log(`  • Surface:       ${chalk.green("<project>-surface.json")} (API surface)`);
  console.log(
    `  • Docs:          ${chalk.green("<project>-docs.md / <project>-docs.html")} (generated docs)`,
  );

  console.log(chalk.yellow("\nHow names are determined:"));
  console.log(`  • Project slug comes from current directory name or existing config files`);
  console.log(`  • Prefixes ensure multiple projects can coexist in monorepos without collisions`);
  console.log(`  • You can override defaults via --pattern and --force flags`);

  console.log(chalk.yellow("\nRecommended usage:"));
  console.log(`  • Preview changes: ${chalk.green("arbiter rename --dry-run")}`);
  console.log(`  • Apply changes:   ${chalk.green("arbiter rename --apply")}`);
  console.log(`  • Select types:    ${chalk.green("arbiter rename --types=config,surface,docs")}`);

  console.log(chalk.dim("\nRun with --verbose for detailed analysis and detection steps.\n"));
}

/**
 * Utility to safely check if a file exists without throwing
 */
export function existsSafe(filePath: string): boolean {
  try {
    fs.accessSync(filePath);
    return true;
  } catch {
    return false;
  }
}
// @ts-nocheck

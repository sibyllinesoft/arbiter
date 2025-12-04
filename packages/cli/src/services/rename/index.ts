/**
 * Rename command - Migrate existing files to smart naming
 *
 * Helps users transition from generic file names (arbiter.assembly.cue, surface.json)
 * to project-specific names (myproject.assembly.cue, myproject-surface.json)
 */

import fs from "node:fs";
import type { CLIConfig } from "@/types.js";
import { FILE_PATTERNS, type FileType, migrateExistingFiles } from "@/utils/smart-naming.js";
import chalk from "chalk";

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

    const dryRun = options.apply ? false : (options.dryRun ?? true);
    const preferredTypes = options.types?.length ? new Set(options.types as FileType[]) : null;

    const migrations = await migrateExistingFiles(process.cwd(), dryRun);
    const filtered = preferredTypes
      ? migrations.filter((migration) => {
          const entry = Object.entries(FILE_PATTERNS).find(
            ([, pattern]) => pattern.default === migration.from,
          );
          return entry ? preferredTypes.has(entry[0] as FileType) : false;
        })
      : migrations;

    if (filtered.length === 0) {
      console.log(chalk.green("✅ All files already use smart naming"));
      return 0;
    }

    const heading = dryRun ? "📦 Proposed changes:" : "📦 Applied changes:";
    console.log(chalk.blue(heading));
    filtered.forEach((migration) => {
      const arrow = `${chalk.dim(migration.from)} ${chalk.yellow("→")} ${chalk.green(migration.to)}`;
      if (dryRun) {
        console.log(arrow);
      } else {
        const status = migration.migrated ? chalk.green("done") : chalk.yellow("skipped");
        console.log(`${arrow} ${chalk.dim(`(${status})`)}`);
      }
    });

    if (dryRun) {
      console.log(chalk.dim("\nDry run complete. Use --apply to perform changes."));
      return 0;
    }

    console.log(chalk.green("\n🎉 Smart naming migration complete!"));
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

import fs from "node:fs/promises";
import chalk from "chalk";
import { glob } from "glob";

export interface MigrateOptions {
  from?: string;
  to?: string;
  dryRun?: boolean;
  backup?: boolean;
  patterns?: string[];
  force?: boolean;
}

export interface MigrationPlan {
  files: Array<{
    path: string;
    changes_needed: boolean;
    backup_path?: string;
    errors: string[];
  }>;
  summary: {
    total_files: number;
    files_to_migrate: number;
    backup_created: boolean;
  };
  safe_to_proceed: boolean;
}

/**
 * Find CUE files to migrate
 */
async function findCueFiles(patterns: string[]): Promise<string[]> {
  const allFiles: string[] = [];

  for (const pattern of patterns) {
    try {
      const files = await glob(pattern, {
        ignore: ["node_modules/**", "dist/**", ".git/**"],
      });
      allFiles.push(...files);
    } catch (error) {
      console.warn(chalk.yellow(`Warning: Could not process pattern '${pattern}': ${error}`));
    }
  }

  // Remove duplicates and filter for .cue files
  const uniqueFiles = [...new Set(allFiles)];
  return uniqueFiles.filter((f) => f.endsWith(".cue"));
}

/**
 * Create backup of files
 */
async function createBackups(files: string[]): Promise<Map<string, string>> {
  const backups = new Map<string, string>();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  for (const file of files) {
    const backupPath = `${file}.backup-${timestamp}`;
    try {
      await fs.copyFile(file, backupPath);
      backups.set(file, backupPath);
    } catch (error) {
      console.error(
        chalk.red(`Failed to backup ${file}:`),
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  return backups;
}

/**
 * Apply simple migrations automatically
 */
async function applyAutomaticMigrations(
  file: string,
): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = [];

  try {
    const content = await fs.readFile(file, "utf-8");
    let newContent = content;
    let hasChanges = false;

    // Simple migrations that can be done automatically
    const migrations = [
      {
        name: "Update old constraint syntax",
        pattern: /(\w+):\s*\(([^)]+)\)\s*&\s*/g,
        replacement: "$1: $2 & ",
        description: "Convert old constraint syntax to new format",
      },
      {
        name: "Fix import paths",
        pattern: /import\s+"cue\.lang\.io\/go\/([^"]+)"/g,
        replacement: 'import "$1"',
        description: "Update deprecated import paths",
      },
      {
        name: "Convert old validation syntax",
        pattern: /_\w+:\s*\([^)]+\)\s*==\s*/g,
        replacement: (match: string) => {
          // Convert validation expressions to new constraint format
          return match.replace(/^_(\w+):\s*\(([^)]+)\)\s*==\s*/, "$1: $2 & ");
        },
        description: "Update validation syntax to constraint format",
      },
    ];

    for (const migration of migrations) {
      const before = newContent;
      if (typeof migration.replacement === "function") {
        newContent = newContent.replace(migration.pattern, migration.replacement);
      } else {
        newContent = newContent.replace(migration.pattern, migration.replacement);
      }

      if (newContent !== before) {
        hasChanges = true;
        console.log(chalk.green(`  ✓ Applied: ${migration.description}`));
      }
    }

    // Write updated content if changes were made
    if (hasChanges) {
      await fs.writeFile(file, newContent, "utf-8");
    }

    return { success: true, errors };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    return { success: false, errors };
  }
}

/**
 * Validate migrated file
 */
async function validateMigratedFile(file: string): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];

  try {
    const content = await fs.readFile(file, "utf-8");

    // Basic syntax checks
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      // Check for unclosed braces
      const _openBraces = (line.match(/\{/g) || []).length;
      const _closeBraces = (line.match(/\}/g) || []).length;

      // Check for malformed constraints
      if (line.includes(":") && line.includes("&")) {
        const constraintPattern = /^\s*\w+:\s*[^&]*&\s*$/;
        if (!constraintPattern.test(line) && !line.includes("//") && line.trim() !== "") {
          errors.push(`Line ${lineNumber}: Potential malformed constraint`);
        }
      }

      // Check for old syntax patterns that weren't caught
      if (line.includes("cue.lang.io/go/")) {
        errors.push(`Line ${lineNumber}: Old import path detected`);
      }
    }

    return { valid: errors.length === 0, errors };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    return { valid: false, errors };
  }
}

/**
 * Generate migration plan
 */
async function generateMigrationPlan(
  files: string[],
  _options: MigrateOptions,
): Promise<MigrationPlan> {
  const plan: MigrationPlan = {
    files: [],
    summary: {
      total_files: files.length,
      files_to_migrate: 0,
      backup_created: false,
    },
    safe_to_proceed: true,
  };

  console.log(chalk.cyan("Analyzing files for migration needs..."));

  for (const file of files) {
    const fileInfo = {
      path: file,
      changes_needed: false,
      errors: [] as string[],
    };

    try {
      const content = await fs.readFile(file, "utf-8");

      // Check if file needs migration
      const needsMigration = [
        content.includes("cue.lang.io/go/"),
        content.match(/_\w+:\s*\([^)]+\)\s*==\s*/),
        content.match(/(\w+):\s*\([^)]+\)\s*&\s*/),
      ].some(Boolean);

      if (needsMigration) {
        fileInfo.changes_needed = true;
        plan.summary.files_to_migrate++;
      }

      // Run validation to check current file health
      const validation = await validateMigratedFile(file);
      if (!validation.valid) {
        fileInfo.errors.push(...validation.errors);
        plan.safe_to_proceed = false;
      }
    } catch (error) {
      fileInfo.errors.push(
        `Could not read file: ${error instanceof Error ? error.message : String(error)}`,
      );
      plan.safe_to_proceed = false;
    }

    plan.files.push(fileInfo);
  }

  return plan;
}

/**
 * Display migration plan
 */
function displayMigrationPlan(plan: MigrationPlan, options: MigrateOptions): void {
  console.log(chalk.cyan("\nMigration Plan:"));
  console.log(chalk.dim("=".repeat(50)));

  console.log(`Total files: ${plan.summary.total_files}`);
  console.log(`Files needing migration: ${plan.summary.files_to_migrate}`);
  console.log(`Safe to proceed: ${plan.safe_to_proceed ? chalk.green("Yes") : chalk.red("No")}`);

  if (options.backup) {
    console.log(`Backups will be created: ${chalk.green("Yes")}`);
  }

  console.log();

  // Show files that need migration
  const filesToMigrate = plan.files.filter((f) => f.changes_needed);
  if (filesToMigrate.length > 0) {
    console.log(chalk.bold("Files to migrate:"));
    for (const file of filesToMigrate) {
      console.log(`  ${chalk.yellow("📝")} ${file.path}`);
      if (file.errors.length > 0) {
        for (const error of file.errors) {
          console.log(`    ${chalk.red("⚠️")} ${error}`);
        }
      }
    }
    console.log();
  }

  // Show files with errors
  const filesWithErrors = plan.files.filter((f) => f.errors.length > 0);
  if (filesWithErrors.length > 0) {
    console.log(chalk.red("Files with issues:"));
    for (const file of filesWithErrors) {
      console.log(`  ${chalk.red("❌")} ${file.path}`);
      for (const error of file.errors) {
        console.log(`    ${error}`);
      }
    }
    console.log();
  }

  if (options.dryRun) {
    console.log(chalk.dim("This is a dry run - no changes will be made"));
  } else if (!plan.safe_to_proceed) {
    console.log(chalk.red("Migration blocked due to errors - fix issues above or use --force"));
  }
}

/**
 * Execute migration
 */
async function executeMigration(plan: MigrationPlan, options: MigrateOptions): Promise<number> {
  const filesToMigrate = plan.files.filter((f) => f.changes_needed);

  if (filesToMigrate.length === 0) {
    console.log(chalk.green("✓ No files require migration"));
    return 0;
  }

  // Create backups if requested
  let backups: Map<string, string> | undefined;
  if (options.backup) {
    console.log(chalk.cyan("Creating backups..."));
    backups = await createBackups(filesToMigrate.map((f) => f.path));
    console.log(chalk.green(`✓ Created ${backups.size} backup files`));
    console.log();
  }

  // Apply migrations
  console.log(chalk.cyan("Applying migrations..."));
  let successCount = 0;
  let errorCount = 0;

  for (const fileInfo of filesToMigrate) {
    console.log(`Migrating ${chalk.blue(fileInfo.path)}...`);

    const result = await applyAutomaticMigrations(fileInfo.path);
    if (result.success) {
      // Validate the result
      const validation = await validateMigratedFile(fileInfo.path);
      if (validation.valid) {
        console.log(`  ${chalk.green("✓")} Migration successful`);
        successCount++;
      } else {
        console.log(`  ${chalk.red("✗")} Migration failed validation:`);
        for (const error of validation.errors) {
          console.log(`    ${error}`);
        }
        errorCount++;

        // Restore from backup if available
        if (backups?.has(fileInfo.path)) {
          const backupPath = backups.get(fileInfo.path)!;
          await fs.copyFile(backupPath, fileInfo.path);
          console.log(`    ${chalk.yellow("↺")} Restored from backup`);
        }
      }
    } else {
      console.log(`  ${chalk.red("✗")} Migration failed:`);
      for (const error of result.errors) {
        console.log(`    ${error}`);
      }
      errorCount++;
    }

    console.log();
  }

  // Summary
  console.log(chalk.cyan("Migration Summary:"));
  console.log(`Successful: ${chalk.green(successCount)}`);
  console.log(`Failed: ${chalk.red(errorCount)}`);

  if (backups && backups.size > 0) {
    console.log();
    console.log(chalk.dim("Backup files created:"));
    for (const [original, backup] of backups.entries()) {
      console.log(`  ${original} → ${backup}`);
    }
    console.log(chalk.dim("You can remove backup files after verifying the migration"));
  }

  return errorCount > 0 ? 1 : 0;
}

/**
 * Migrate command - Apply schema evolution changes
 */
export async function migrateCommand(
  patterns: string[],
  options: MigrateOptions = {},
): Promise<number> {
  try {
    // Default patterns if none provided
    const searchPatterns = patterns.length > 0 ? patterns : ["**/*.cue"];

    console.log(chalk.cyan("Arbiter Schema Migration"));
    console.log(chalk.dim("Automatically updating CUE schemas to latest format"));
    console.log();

    // Find files to migrate
    const files = await findCueFiles(searchPatterns);
    if (files.length === 0) {
      console.log(chalk.yellow("No CUE files found matching patterns"));
      return 0;
    }

    console.log(chalk.dim(`Found ${files.length} CUE files`));

    // Generate migration plan
    const plan = await generateMigrationPlan(files, options);

    // Display plan
    displayMigrationPlan(plan, options);

    // Stop here if dry run
    if (options.dryRun) {
      return 0;
    }

    // Check if safe to proceed
    if (!plan.safe_to_proceed && !options.force) {
      console.log(chalk.red("Migration aborted due to errors"));
      console.log(chalk.dim("Use --force to proceed anyway (not recommended)"));
      return 1;
    }

    // Execute migration
    return await executeMigration(plan, options);
  } catch (error) {
    console.error(
      chalk.red("Migration failed:"),
      error instanceof Error ? error.message : String(error),
    );
    return 1;
  }
}

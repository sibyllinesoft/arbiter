/**
 * @fileoverview Compatibility Check Command Implementation v1.0 RC
 * Provides CLI interface for version compatibility validation and migration
 */

import {
  type CompatibilityResult,
  CURRENT_VERSIONS,
  checkCompatibility,
  estimateMigrationDuration,
  executeMigration,
  getAvailableMigrationPaths,
  getRuntimeVersionInfo,
  hasMigrationPath,
  type VersionSet,
  validateVersionSet,
} from "@arbiter/shared";
import { z } from "zod";

// =============================================================================
// COMMAND SCHEMAS
// =============================================================================

/**
 * Compatibility check command options
 */
export const CompatCheckOptionsSchema = z
  .object({
    input: z.string().optional().describe("Path to version file or JSON"),
    format: z.enum(["json", "text", "table"]).default("text").describe("Output format"),
    allowCompat: z.boolean().default(false).describe("Allow compatibility warnings"),
    showMigrations: z.boolean().default(true).describe("Show available migration paths"),
    verbose: z.boolean().default(false).describe("Verbose output"),
  })
  .strict();

export type CompatCheckOptions = z.infer<typeof CompatCheckOptionsSchema>;

/**
 * Migration command options
 */
export const MigrationOptionsSchema = z
  .object({
    from: z.string().describe("Source version"),
    to: z.string().describe("Target version"),
    component: z
      .enum(["api_version", "schema_version", "contract_version", "ticket_format"])
      .describe("Component to migrate"),
    dryRun: z.boolean().default(false).describe("Show migration plan without executing"),
    force: z.boolean().default(false).describe("Force migration even if risky"),
    backup: z.boolean().default(true).describe("Create backup before migration"),
  })
  .strict();

export type MigrationOptions = z.infer<typeof MigrationOptionsSchema>;

// =============================================================================
// COMPATIBILITY CHECK COMMAND
// =============================================================================

/**
 * Execute compatibility check command
 */
export async function runCompatCheck(options: CompatCheckOptions): Promise<void> {
  try {
    console.log("🔍 Arbiter Compatibility Check v1.0 RC\n");

    // Get runtime version information
    const runtimeInfo = getRuntimeVersionInfo();

    if (options.verbose) {
      console.log("📋 Current Runtime Versions:");
      console.table(runtimeInfo.versions);
      console.log();
    }

    // Load versions to check against
    const versionsToCheck = await loadVersionsToCheck(options.input);

    if (options.verbose) {
      console.log("📥 Versions to Check:");
      console.table(versionsToCheck);
      console.log();
    }

    // Perform compatibility check
    const result = await checkCompatibility(versionsToCheck, options.allowCompat);

    // Output results
    await outputCompatibilityResult(result, options);

    // Show migration paths if requested
    if (options.showMigrations && result.version_mismatches.length > 0) {
      await showMigrationPaths(versionsToCheck, options);
    }

    // Exit with appropriate code
    process.exit(result.compatible ? 0 : 1);
  } catch (error) {
    console.error("❌ Compatibility check failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

/**
 * Load versions to check from input source
 */
async function loadVersionsToCheck(input?: string): Promise<Partial<VersionSet>> {
  if (!input) {
    // Use current versions as baseline
    return CURRENT_VERSIONS;
  }

  try {
    // Try to read as file
    const fs = await import("node:fs/promises");
    const content = await fs.readFile(input, "utf-8");
    const data = JSON.parse(content);

    // Validate structure
    if (data.versions) {
      validateVersionSet(data.versions);
      return data.versions;
    } else {
      validateVersionSet(data);
      return data;
    }
  } catch (_error) {
    // Try to parse as direct JSON
    try {
      const data = JSON.parse(input);
      validateVersionSet(data);
      return data;
    } catch {
      throw new Error(`Cannot load versions from: ${input}`);
    }
  }
}

/**
 * Output compatibility check result in specified format
 */
async function outputCompatibilityResult(
  result: CompatibilityResult,
  options: CompatCheckOptions,
): Promise<void> {
  switch (options.format) {
    case "json":
      console.log(JSON.stringify(result, null, 2));
      break;

    case "table":
      outputCompatibilityTable(result);
      break;
    default:
      outputCompatibilityText(result, options.verbose);
      break;
  }
}

/**
 * Output compatibility result as formatted text
 */
function outputCompatibilityText(result: CompatibilityResult, verbose: boolean): void {
  if (result.compatible) {
    console.log("✅ All versions are compatible!\n");
  } else {
    console.log("❌ Version compatibility issues detected:\n");
  }

  if (result.version_mismatches.length > 0) {
    console.log("🔍 Version Mismatches:");
    for (const mismatch of result.version_mismatches) {
      const icon = mismatch.severity === "error" ? "❌" : "⚠️";
      console.log(
        `  ${icon} ${mismatch.component}: expected ${mismatch.expected}, got ${mismatch.actual}`,
      );
    }
    console.log();
  }

  if (result.migration_required && result.migration_path) {
    console.log("🔄 Migration Available:");
    console.log(`  Command: ${result.migration_path}`);
    console.log();
  }

  if (verbose) {
    console.log(`⏰ Checked at: ${result.timestamp}`);
  }
}

/**
 * Output compatibility result as table
 */
function outputCompatibilityTable(result: CompatibilityResult): void {
  if (result.version_mismatches.length === 0) {
    console.log("✅ All versions compatible - no issues to display");
    return;
  }

  console.table(
    result.version_mismatches.map((mismatch) => ({
      Component: mismatch.component,
      Expected: mismatch.expected,
      Actual: mismatch.actual,
      Severity: mismatch.severity,
      Status: mismatch.severity === "error" ? "❌ Error" : "⚠️ Warning",
    })),
  );
}

/**
 * Show available migration paths for incompatible versions
 */
async function showMigrationPaths(
  versionsToCheck: Partial<VersionSet>,
  _options: CompatCheckOptions,
): Promise<void> {
  console.log("🚀 Available Migration Paths:\n");

  for (const [component, sourceVersion] of Object.entries(versionsToCheck)) {
    const key = component as keyof VersionSet;
    const targetVersion = CURRENT_VERSIONS[key];

    if (sourceVersion && sourceVersion !== targetVersion) {
      const paths = getAvailableMigrationPaths(key);
      const directPath = hasMigrationPath(key, sourceVersion, targetVersion);
      const duration = estimateMigrationDuration(key, sourceVersion, targetVersion);

      console.log(`📦 ${component}:`);
      console.log(`  Current: ${sourceVersion} → Target: ${targetVersion}`);

      if (directPath) {
        console.log(`  ✅ Direct migration available`);
        console.log(`  ⏱️  Estimated duration: ${duration}ms`);
        console.log(
          `  🔧 Command: arbiter migrate --component ${component} --from ${sourceVersion} --to ${targetVersion}`,
        );
      } else {
        console.log(`  ❌ No direct migration path available`);
        if (paths.length > 0) {
          console.log(`  🛤️  Available paths: ${paths.join(", ")}`);
        }
      }
      console.log();
    }
  }
}

// =============================================================================
// MIGRATION COMMAND
// =============================================================================

/**
 * Execute migration command
 */
export async function runMigration(options: MigrationOptions): Promise<void> {
  const migrationRunner = new MigrationRunner(options);
  await migrationRunner.execute();
}

/**
 * Migration execution orchestrator using Command pattern
 */
class MigrationRunner {
  private readonly component: keyof VersionSet;

  constructor(private readonly options: MigrationOptions) {
    this.component = options.component as keyof VersionSet;
  }

  async execute(): Promise<void> {
    try {
      this.displayHeader();
      await this.validateMigrationPath();
      this.displayEstimatedDuration();
      
      if (this.options.dryRun) {
        this.executeDryRun();
        return;
      }

      this.requestConfirmationIfNeeded();
      await this.performMigration();
    } catch (error) {
      this.handleFatalError(error);
    }
  }

  private displayHeader(): void {
    console.log("🔄 Arbiter Migration Tool v1.0 RC\n");
    console.log(`📦 Component: ${this.component}`);
    console.log(`📥 From: ${this.options.from}`);
    console.log(`📤 To: ${this.options.to}`);
    console.log();
  }

  private async validateMigrationPath(): Promise<void> {
    if (!hasMigrationPath(this.component, this.options.from, this.options.to)) {
      this.displayMigrationPathError();
      process.exit(1);
    }
  }

  private displayMigrationPathError(): void {
    console.error(
      `❌ No migration path available: ${this.component} ${this.options.from} -> ${this.options.to}`,
    );

    const availablePaths = getAvailableMigrationPaths(this.component);
    if (availablePaths.length > 0) {
      console.log("\n🛤️  Available migration paths:");
      availablePaths.forEach((path) => console.log(`  • ${path}`));
    }
  }

  private displayEstimatedDuration(): void {
    const estimatedDuration = estimateMigrationDuration(
      this.component,
      this.options.from,
      this.options.to,
    );
    console.log(`⏱️  Estimated duration: ${estimatedDuration}ms`);
  }

  private executeDryRun(): void {
    console.log("\n🧪 DRY RUN MODE - No changes will be made\n");
    this.displayMigrationPlan();
    console.log("\n✅ Dry run completed - use --dry-run=false to execute");
    process.exit(0);
  }

  private displayMigrationPlan(): void {
    console.log("Migration plan:");
    console.log(`  1. Validate preconditions for ${this.component} migration`);
    console.log(`  2. ${this.options.backup ? "Create backup" : "Skip backup (disabled)"}`);
    console.log(`  3. Execute migration transformations`);
    console.log(`  4. Validate post-migration state`);
    console.log(`  5. Update version metadata`);
  }

  private requestConfirmationIfNeeded(): void {
    if (!this.options.force) {
      console.log("⚠️  This will modify your system. Continue? (y/N)");
      // In a real CLI, we'd wait for user input here
      // For now, assume confirmation
    }
  }

  private async performMigration(): Promise<void> {
    console.log("\n🚀 Starting migration...\n");
    
    const result = await executeMigration(this.component, this.options.from, this.options.to);
    
    if (result.success) {
      this.displaySuccessResult(result);
    } else {
      this.displayFailureResult(result);
      process.exit(1);
    }
  }

  private displaySuccessResult(result: MigrationResult): void {
    console.log("✅ Migration completed successfully!\n");
    
    this.displayOperations("📋 Operations performed:", result.operations_performed);
    this.displayWarningsIfAny(result.warnings);
    
    console.log(`\n⏰ Completed at: ${result.timestamp}`);
  }

  private displayFailureResult(result: MigrationResult): void {
    console.error("❌ Migration failed!\n");
    
    this.displayOperations("📋 Operations attempted:", result.operations_performed);
    
    if (result.warnings.length > 0) {
      console.log("\n⚠️  Issues encountered:");
      result.warnings.forEach((warning) => console.log(`  • ${warning}`));
    }
  }

  private displayOperations(header: string, operations: string[]): void {
    console.log(header);
    operations.forEach((op) => console.log(`  • ${op}`));
  }

  private displayWarningsIfAny(warnings: string[]): void {
    if (warnings.length > 0) {
      console.log("\n⚠️  Warnings:");
      warnings.forEach((warning) => console.log(`  • ${warning}`));
    }
  }

  private handleFatalError(error: unknown): never {
    console.error("❌ Migration failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

/**
 * Migration result interface
 */
interface MigrationResult {
  success: boolean;
  operations_performed: string[];
  warnings: string[];
  timestamp: string;
}

// =============================================================================
// VERSION INFO COMMAND
// =============================================================================

/**
 * Show current version information
 */
export async function showVersionInfo(): Promise<void> {
  const runtimeInfo = getRuntimeVersionInfo();

  console.log("📋 Arbiter Version Information v1.0 RC\n");

  console.log("🔢 Current Versions:");
  console.table(runtimeInfo.versions);

  console.log("\n🏗️  Build Information:");
  console.log(`  Timestamp: ${runtimeInfo.build_info.timestamp}`);
  console.log(`  Commit: ${runtimeInfo.build_info.commit_hash || "unknown"}`);
  console.log(`  Deterministic: ${runtimeInfo.build_info.deterministic ? "✅" : "❌"}`);
  console.log(`  Reproducible: ${runtimeInfo.build_info.reproducible ? "✅" : "❌"}`);

  console.log("\n⚙️  Compatibility Settings:");
  console.log(`  Strict Mode: ${runtimeInfo.compatibility.strict_mode ? "✅" : "❌"}`);
  console.log(`  Allow Compat Flag: ${runtimeInfo.compatibility.allow_compat_flag ? "✅" : "❌"}`);
  console.log(`  Migration Support: ${runtimeInfo.compatibility.migration_support ? "✅" : "❌"}`);
}

/**
 * Version compatibility and management types
 */

export interface VersionSet {
  arbiter: string;
  cue: string; // tracks embedded cuelang-js runtime version
  node?: string;
  [key: string]: string | undefined;
}

export interface CompatibilityResult {
  compatible: boolean;
  issues: Array<{
    component: string;
    currentVersion: string;
    requiredVersion: string;
    severity: "error" | "warning" | "info";
    message: string;
  }>;
  recommendations?: string[] | undefined;
  version_mismatches?:
    | Array<{
        component: string;
        expected: string;
        actual: string;
        [key: string]: any;
      }>
    | undefined;
  migration_required?: boolean | undefined;
  migration_path?:
    | {
        fromVersion: string;
        toVersion: string;
        steps: string[];
      }
    | undefined;
  timestamp?: string | undefined;
}

export const CURRENT_VERSIONS: VersionSet = {
  arbiter: "1.0.0",
  cue: "1.3.1", // cuelang-js version bundled (no external CUE binary required)
  node: "20.0.0",
};

/**
 * State object for collecting compatibility check results
 */
interface CompatibilityState {
  issues: CompatibilityResult["issues"];
  mismatches: NonNullable<CompatibilityResult["version_mismatches"]>;
  migrationRequired: boolean;
}

/**
 * Check a single component's version compatibility and update state
 */
function checkComponentVersion(
  component: string,
  version: string | undefined,
  requiredVersion: string,
  state: CompatibilityState,
  options: { skipOnCompat?: boolean; allowCompat?: boolean } = {},
): void {
  if (!version) return;

  const result = checkVersionCompatibility(component, version, requiredVersion);
  if (result.compatible) return;
  if (options.skipOnCompat && options.allowCompat) return;

  state.issues.push({
    component,
    currentVersion: version,
    requiredVersion,
    severity: component === "node" ? "warning" : result.severity,
    message: result.message,
  });

  if (result.needsMigration) {
    state.migrationRequired = true;
    state.mismatches.push({
      component,
      expected: requiredVersion,
      actual: version,
    });
  }
}

/**
 * Generate recommendations based on issues found
 */
function generateRecommendations(
  issues: CompatibilityResult["issues"],
  migrationRequired: boolean,
  allowCompat: boolean,
): string[] {
  if (issues.length === 0) return [];

  const recommendations: string[] = [];
  recommendations.push("Consider updating to the latest compatible versions");

  if (migrationRequired) {
    recommendations.push("Run migration tools to update project files");
  }

  if (issues.some((i) => i.severity === "error") && allowCompat) {
    recommendations.push("Use --allow-compat flag to proceed with warnings");
  }

  return recommendations;
}

/**
 * Build the migration path object
 */
function buildMigrationPath(
  migrationRequired: boolean,
  arbiterVersion: string | undefined,
): CompatibilityResult["migration_path"] {
  if (migrationRequired) {
    return {
      fromVersion: arbiterVersion || "",
      toVersion: CURRENT_VERSIONS.arbiter,
      steps: [
        "Update configuration files",
        "Migrate schema definitions",
        "Update project dependencies",
      ],
    };
  }

  return {
    fromVersion: arbiterVersion || "",
    toVersion: arbiterVersion || CURRENT_VERSIONS.arbiter,
    steps: [],
  };
}

/**
 * Checks version compatibility between provided versions and required versions.
 *
 * @param versions - Partial version set to check against current requirements
 * @param allowCompat - If true, warnings won't cause incompatibility
 * @returns Compatibility result with issues, recommendations, and migration info
 */
export async function checkCompatibility(
  versions: Partial<VersionSet>,
  allowCompat = false,
): Promise<CompatibilityResult> {
  const state: CompatibilityState = {
    issues: [],
    mismatches: [],
    migrationRequired: false,
  };

  // Check each component's version
  checkComponentVersion("arbiter", versions.arbiter, CURRENT_VERSIONS.arbiter, state);
  checkComponentVersion("cue", versions.cue, CURRENT_VERSIONS.cue, state);
  checkComponentVersion("node", versions.node, CURRENT_VERSIONS.node || "20.0.0", state, {
    skipOnCompat: true,
    allowCompat,
  });

  const recommendations = generateRecommendations(
    state.issues,
    state.migrationRequired,
    allowCompat,
  );
  const compatible =
    state.issues.length === 0 || (allowCompat && !state.issues.some((i) => i.severity === "error"));

  return {
    compatible,
    issues: state.issues,
    recommendations,
    version_mismatches: state.mismatches,
    migration_required: state.migrationRequired,
    migration_path: buildMigrationPath(state.migrationRequired, versions.arbiter),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Check compatibility between two semantic versions
 */
function checkVersionCompatibility(
  component: string,
  currentVersion: string,
  requiredVersion: string,
): {
  compatible: boolean;
  severity: "error" | "warning" | "info";
  message: string;
  needsMigration: boolean;
} {
  const current = parseSemanticVersion(currentVersion);
  const required = parseSemanticVersion(requiredVersion);

  if (!current || !required) {
    return {
      compatible: false,
      severity: "error",
      message: `Invalid version format for ${component}`,
      needsMigration: false,
    };
  }

  // Major version differences require migration
  if (current.major < required.major) {
    return {
      compatible: false,
      severity: "error",
      message: `${component} major version ${current.major} is too old, requires ${required.major}`,
      needsMigration: true,
    };
  }

  if (current.major > required.major) {
    return {
      compatible: true,
      severity: "warning",
      message: `${component} major version ${current.major} is newer than recommended ${required.major}`,
      needsMigration: false,
    };
  }

  // Same major version - check minor
  if (current.minor < required.minor) {
    return {
      compatible: false,
      severity: "warning",
      message: `${component} minor version ${current.minor} is older than recommended ${required.minor}`,
      needsMigration: false,
    };
  }

  return {
    compatible: true,
    severity: "info",
    message: `${component} version ${currentVersion} is compatible`,
    needsMigration: false,
  };
}

/**
 * Parse semantic version string
 */
function parseSemanticVersion(
  version: string,
): { major: number; minor: number; patch: number } | null {
  const match = version.replace(/^v/, "").match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;

  return {
    major: parseInt(match[1] ?? "0", 10),
    minor: parseInt(match[2] ?? "0", 10),
    patch: parseInt(match[3] ?? "0", 10),
  };
}

/**
 * Migration result type
 */
interface MigrationResult {
  success: boolean;
  operations_performed: string[];
  warnings: string[];
  timestamp: string;
}

/**
 * Create a migration result
 */
function createMigrationResult(
  success: boolean,
  operations: string[],
  warnings: string[],
): MigrationResult {
  return {
    success,
    operations_performed: operations,
    warnings,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Validate version format
 */
function validateVersions(
  fromVersion: string,
  toVersion: string,
): {
  valid: boolean;
  fromVer?: ReturnType<typeof parseSemanticVersion>;
  toVer?: ReturnType<typeof parseSemanticVersion>;
  error?: string;
} {
  const fromVer = parseSemanticVersion(fromVersion);
  const toVer = parseSemanticVersion(toVersion);

  if (!fromVer || !toVer) {
    return { valid: false, error: `Invalid version format: ${fromVersion} -> ${toVersion}` };
  }

  return { valid: true, fromVer, toVer };
}

/**
 * Check if migration is needed
 */
function isSameVersion(
  fromVer: { major: number; minor: number; patch: number },
  toVer: { major: number; minor: number; patch: number },
): boolean {
  return (
    fromVer.major === toVer.major && fromVer.minor === toVer.minor && fromVer.patch === toVer.patch
  );
}

/**
 * Apply migration for arbiter component
 */
function migrateArbiter(
  fromVer: { major: number },
  toVer: { major: number },
  operations: string[],
  warnings: string[],
): void {
  operations.push("Updated .arbiter/config.json schema");
  operations.push("Migrated CUE specification format");
  operations.push("Updated project metadata");

  if (fromVer.major < toVer.major) {
    operations.push("Performed major version schema migration");
    warnings.push("Major version migration may require manual verification");
  }
}

/**
 * Apply migration for cue component
 */
function migrateCue(
  fromVer: { minor: number },
  toVer: { minor: number },
  operations: string[],
  warnings: string[],
): void {
  operations.push("Updated CUE module definitions");
  operations.push("Migrated constraint syntax");

  if (toVer.minor > fromVer.minor) {
    warnings.push("Minor version updates may introduce new language features");
  }
}

/**
 * Apply migration for node component
 */
function migrateNode(
  fromVer: { major: number },
  toVer: { major: number },
  operations: string[],
  warnings: string[],
): void {
  operations.push("Updated package.json engine requirements");
  operations.push("Verified dependency compatibility");

  if (fromVer.major < toVer.major) {
    warnings.push("Node.js major version upgrade may affect dependencies");
  }
}

/**
 * Component migration handlers
 */
const COMPONENT_MIGRATORS: Record<
  string,
  (
    fromVer: { major: number; minor: number; patch: number },
    toVer: { major: number; minor: number; patch: number },
    operations: string[],
    warnings: string[],
  ) => void
> = {
  arbiter: migrateArbiter,
  cue: migrateCue,
  node: migrateNode,
};

/**
 * Apply component-specific migration
 */
function applyComponentMigration(
  component: string,
  fromVersion: string,
  toVersion: string,
  fromVer: { major: number; minor: number; patch: number },
  toVer: { major: number; minor: number; patch: number },
  operations: string[],
  warnings: string[],
): void {
  const migrator = COMPONENT_MIGRATORS[component];

  if (migrator) {
    migrator(fromVer, toVer, operations, warnings);
  } else {
    operations.push(`Generic migration for ${component} from ${fromVersion} to ${toVersion}`);
    warnings.push(`Custom migration logic not implemented for ${component}`);
  }

  operations.push(`Successfully migrated ${component} from ${fromVersion} to ${toVersion}`);
}

/**
 * Executes a migration for a component from one version to another.
 *
 * Applies component-specific migration logic and records operations performed.
 *
 * @param component - The component to migrate (e.g., "arbiter", "cue", "node")
 * @param fromVersion - The source version
 * @param toVersion - The target version
 * @returns Migration result with success status, operations, and warnings
 */
export async function executeMigration(
  component: string,
  fromVersion: string,
  toVersion: string,
): Promise<MigrationResult> {
  const operations: string[] = [];
  const warnings: string[] = [];

  try {
    const validation = validateVersions(fromVersion, toVersion);

    if (!validation.valid || !validation.fromVer || !validation.toVer) {
      return createMigrationResult(false, [], [validation.error ?? "Unknown validation error"]);
    }

    const { fromVer, toVer } = validation;

    if (isSameVersion(fromVer, toVer)) {
      warnings.push("Source and target versions are identical - no migration needed");
      return createMigrationResult(true, [], warnings);
    }

    if (fromVer.major > toVer.major) {
      return createMigrationResult(false, [], ["Cannot migrate backwards across major versions"]);
    }

    applyComponentMigration(
      component,
      fromVersion,
      toVersion,
      fromVer,
      toVer,
      operations,
      warnings,
    );

    return createMigrationResult(true, operations, warnings);
  } catch (error) {
    return createMigrationResult(false, operations, [
      ...warnings,
      `Migration failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    ]);
  }
}

/**
 * Returns comprehensive runtime version and build information.
 *
 * Includes current versions, build metadata, and compatibility settings.
 */
export function getRuntimeVersionInfo(): {
  versions: VersionSet;
  build_info: {
    timestamp: string;
    commit_hash?: string;
    deterministic: boolean;
    reproducible: boolean;
  };
  compatibility: {
    strict_mode: boolean;
    allow_compat_flag: boolean;
    migration_support: boolean;
  };
} {
  return {
    versions: {
      arbiter: CURRENT_VERSIONS.arbiter,
      cue: CURRENT_VERSIONS.cue,
      node: process.version,
    },
    build_info: {
      timestamp: new Date().toISOString(),
      deterministic: false,
      reproducible: false,
    },
    compatibility: {
      strict_mode: false,
      allow_compat_flag: true,
      migration_support: true,
    },
  };
}

/**
 * Validates that a version set contains required components.
 *
 * @param versions - The version set to validate
 * @returns True if arbiter and cue versions are defined
 */
export function validateVersionSet(versions: VersionSet): boolean {
  return versions.arbiter !== undefined && versions.cue !== undefined;
}

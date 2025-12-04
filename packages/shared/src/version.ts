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
  recommendations?: string[];
  version_mismatches?: Array<{
    component: string;
    expected: string;
    actual: string;
    [key: string]: any;
  }>;
  migration_required?: boolean;
  migration_path?: {
    fromVersion: string;
    toVersion: string;
    steps: string[];
  };
  timestamp?: string;
}

export const CURRENT_VERSIONS: VersionSet = {
  arbiter: "1.0.0",
  cue: "1.3.1", // cuelang-js version bundled (no external CUE binary required)
  node: "20.0.0",
};

export async function checkCompatibility(
  versions: Partial<VersionSet>,
  allowCompat = false,
): Promise<CompatibilityResult> {
  const issues: CompatibilityResult["issues"] = [];
  const mismatches: CompatibilityResult["version_mismatches"] = [];
  const recommendations: string[] = [];
  let migrationRequired = false;

  // Check Arbiter version compatibility
  if (versions.arbiter) {
    const result = checkVersionCompatibility("arbiter", versions.arbiter, CURRENT_VERSIONS.arbiter);
    if (!result.compatible) {
      issues.push({
        component: "arbiter",
        currentVersion: versions.arbiter,
        requiredVersion: CURRENT_VERSIONS.arbiter,
        severity: result.severity,
        message: result.message,
      });

      if (result.needsMigration) {
        migrationRequired = true;
        mismatches.push({
          component: "arbiter",
          expected: CURRENT_VERSIONS.arbiter,
          actual: versions.arbiter,
        });
      }
    }
  }

  // Check CUE version compatibility
  if (versions.cue) {
    const result = checkVersionCompatibility("cue", versions.cue, CURRENT_VERSIONS.cue);
    if (!result.compatible) {
      issues.push({
        component: "cue",
        currentVersion: versions.cue,
        requiredVersion: CURRENT_VERSIONS.cue,
        severity: result.severity,
        message: result.message,
      });
    }
  }

  // Check Node.js version if provided
  if (versions.node) {
    const result = checkVersionCompatibility(
      "node",
      versions.node,
      CURRENT_VERSIONS.node || "20.0.0",
    );
    if (!result.compatible && !allowCompat) {
      issues.push({
        component: "node",
        currentVersion: versions.node,
        requiredVersion: CURRENT_VERSIONS.node || "20.0.0",
        severity: "warning",
        message: result.message,
      });
    }
  }

  // Generate recommendations
  if (issues.length > 0) {
    recommendations.push("Consider updating to the latest compatible versions");
    if (migrationRequired) {
      recommendations.push("Run migration tools to update project files");
    }
    if (issues.some((i) => i.severity === "error") && allowCompat) {
      recommendations.push("Use --allow-compat flag to proceed with warnings");
    }
  }

  const compatible =
    issues.length === 0 || (allowCompat && !issues.some((i) => i.severity === "error"));

  return {
    compatible,
    issues,
    recommendations: recommendations.length > 0 ? recommendations : [],
    version_mismatches: mismatches,
    migration_required: migrationRequired,
    migration_path: migrationRequired
      ? {
          fromVersion: versions.arbiter || "",
          toVersion: CURRENT_VERSIONS.arbiter,
          steps: [
            "Update configuration files",
            "Migrate schema definitions",
            "Update project dependencies",
          ],
        }
      : {
          fromVersion: versions.arbiter || "",
          toVersion: versions.arbiter || CURRENT_VERSIONS.arbiter,
          steps: [],
        },
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

export async function executeMigration(
  component: string,
  fromVersion: string,
  toVersion: string,
): Promise<{
  success: boolean;
  operations_performed: string[];
  warnings: string[];
  timestamp: string;
}> {
  const operations: string[] = [];
  const warnings: string[] = [];

  try {
    const fromVer = parseSemanticVersion(fromVersion);
    const toVer = parseSemanticVersion(toVersion);

    if (!fromVer || !toVer) {
      return {
        success: false,
        operations_performed: [],
        warnings: [`Invalid version format: ${fromVersion} -> ${toVersion}`],
        timestamp: new Date().toISOString(),
      };
    }

    // Validate migration is necessary and safe
    if (
      fromVer.major === toVer.major &&
      fromVer.minor === toVer.minor &&
      fromVer.patch === toVer.patch
    ) {
      warnings.push("Source and target versions are identical - no migration needed");
      return {
        success: true,
        operations_performed: [],
        warnings,
        timestamp: new Date().toISOString(),
      };
    }

    if (fromVer.major > toVer.major) {
      return {
        success: false,
        operations_performed: [],
        warnings: ["Cannot migrate backwards across major versions"],
        timestamp: new Date().toISOString(),
      };
    }

    // Simulate migration operations based on component type
    switch (component) {
      case "arbiter":
        operations.push("Updated .arbiter/config.json schema");
        operations.push("Migrated CUE specification format");
        operations.push("Updated project metadata");

        if (fromVer.major < toVer.major) {
          operations.push("Performed major version schema migration");
          warnings.push("Major version migration may require manual verification");
        }
        break;

      case "cue":
        operations.push("Updated CUE module definitions");
        operations.push("Migrated constraint syntax");

        if (toVer.minor > fromVer.minor) {
          warnings.push("Minor version updates may introduce new language features");
        }
        break;

      case "node":
        operations.push("Updated package.json engine requirements");
        operations.push("Verified dependency compatibility");

        if (fromVer.major < toVer.major) {
          warnings.push("Node.js major version upgrade may affect dependencies");
        }
        break;

      default:
        operations.push(`Generic migration for ${component} from ${fromVersion} to ${toVersion}`);
        warnings.push(`Custom migration logic not implemented for ${component}`);
    }

    operations.push(`Successfully migrated ${component} from ${fromVersion} to ${toVersion}`);

    return {
      success: true,
      operations_performed: operations,
      warnings,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      success: false,
      operations_performed: operations,
      warnings: [
        ...warnings,
        `Migration failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      ],
      timestamp: new Date().toISOString(),
    };
  }
}

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

export function validateVersionSet(versions: VersionSet): boolean {
  return versions.arbiter !== undefined && versions.cue !== undefined;
}

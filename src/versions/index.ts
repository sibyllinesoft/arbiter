/**
 * Version management system for arbiter
 * Provides comprehensive semantic versioning with schema analysis and migration support
 */

// Core types and interfaces
export * from './types.js';

// Semantic versioning utilities
export { SemverUtils } from './semver.js';

// Version and compatibility analysis
export { VersionAnalyzer } from './analyzer.js';

// Migration system
export { MigrationManager } from './migration.js';

// Compatibility matrix management
export { CompatibilityManager } from './compatibility.js';

// Main version manager
export { VersionManager } from './manager.js';

// Re-export common types for convenience
export type {
  SemanticVersion,
  VersionChange,
  VersionHistory,
  VersionBumpResult,
  CompatibilityAnalysis,
  MigrationPath,
  CompatibilityMatrix,
} from './types.js';

/**
 * Create a new version manager instance with default configuration
 */
export function createVersionManager(config?: Parameters<typeof VersionManager.prototype.constructor>[0]): VersionManager {
  return new VersionManager(config);
}

/**
 * Parse semantic version string
 */
export function parseVersion(version: string): SemanticVersion {
  return SemverUtils.parse(version);
}

/**
 * Format semantic version to string
 */
export function formatVersion(version: SemanticVersion): string {
  return SemverUtils.format(version);
}

/**
 * Compare two semantic versions
 */
export function compareVersions(a: SemanticVersion, b: SemanticVersion): number {
  return SemverUtils.compare(a, b);
}

/**
 * Check if version satisfies a constraint
 */
export function satisfiesConstraint(version: SemanticVersion, constraint: string): boolean {
  const range = SemverUtils.parseRange(constraint);
  return SemverUtils.satisfies(version, range);
}

/**
 * Increment version by type
 */
export function incrementVersion(version: SemanticVersion, type: 'major' | 'minor' | 'patch' | 'prerelease'): SemanticVersion {
  return SemverUtils.increment(version, type);
}

// Version management constants
export const VERSION_MANAGEMENT_CONSTANTS = {
  DEFAULT_VERSION: { major: 0, minor: 1, patch: 0 } as SemanticVersion,
  SUPPORTED_BUMP_TYPES: ['major', 'minor', 'patch', 'prerelease'] as const,
  DEFAULT_PRERELEASE_TAGS: ['alpha', 'beta', 'rc'] as const,
  MAX_MIGRATION_STEPS: 50,
  DEFAULT_MIGRATION_TIMEOUT: 300000, // 5 minutes
} as const;

// Utility function for quick version operations
export const VersionUtils = {
  /**
   * Create a new version from parts
   */
  create(major: number, minor: number, patch: number, prerelease?: string[], build?: string[]): SemanticVersion {
    return { major, minor, patch, prerelease, build };
  },

  /**
   * Check if version is stable (not prerelease)
   */
  isStable(version: SemanticVersion): boolean {
    return SemverUtils.isStable(version);
  },

  /**
   * Get next stable version
   */
  nextStable(version: SemanticVersion): SemanticVersion {
    return SemverUtils.nextStable(version);
  },

  /**
   * Get major.minor version string
   */
  getMajorMinor(version: SemanticVersion): string {
    return SemverUtils.getMajorMinor(version);
  },

  /**
   * Check if version string is valid
   */
  isValid(versionString: string): boolean {
    return SemverUtils.isValid(versionString);
  },

  /**
   * Clean version string (remove 'v' prefix)
   */
  clean(versionString: string): string {
    return SemverUtils.clean(versionString);
  },

  /**
   * Sort versions in ascending order
   */
  sort(versions: SemanticVersion[]): SemanticVersion[] {
    return SemverUtils.sort(versions);
  },

  /**
   * Get latest version from array
   */
  latest(versions: SemanticVersion[]): SemanticVersion | undefined {
    return SemverUtils.max(versions);
  },

  /**
   * Get earliest version from array
   */
  earliest(versions: SemanticVersion[]): SemanticVersion | undefined {
    return SemverUtils.min(versions);
  },
} as const;
/**
 * @fileoverview Version & Compatibility System v1.0 RC
 * Implements comprehensive version tracking, compatibility validation, and migration support
 * per arbiter.assembly.cue specification
 */

import { z } from 'zod';

// =============================================================================
// VERSION SCHEMA DEFINITIONS
// =============================================================================

/**
 * Semantic version schema with strict validation
 */
export const SemanticVersionSchema = z.string()
  .regex(/^v?\d+\.\d+\.\d+(?:-[a-zA-Z0-9]+(?:\.[a-zA-Z0-9]+)*)?(?:\+[a-zA-Z0-9]+(?:\.[a-zA-Z0-9]+)*)?$/)
  .describe('Semantic version string (e.g., v1.0.0-rc.1)');

/**
 * Version compatibility matrix definition
 */
export const VersionSetSchema = z.object({
  api_version: SemanticVersionSchema.describe('Public API version'),
  schema_version: SemanticVersionSchema.describe('CUE schema version'),  
  contract_version: SemanticVersionSchema.describe('Contract specification version'),
  ticket_format: SemanticVersionSchema.describe('Ticket format version')
}).strict();

export type VersionSet = z.infer<typeof VersionSetSchema>;

// =============================================================================
// COMPATIBILITY SYSTEM
// =============================================================================

/**
 * Compatibility check result
 */
export const CompatibilityResultSchema = z.object({
  compatible: z.boolean(),
  version_mismatches: z.array(z.object({
    component: z.string(),
    expected: z.string(),
    actual: z.string(),
    severity: z.enum(['error', 'warning'])
  })),
  migration_required: z.boolean(),
  migration_path: z.string().optional(),
  timestamp: z.string().datetime()
}).strict();

export type CompatibilityResult = z.infer<typeof CompatibilityResultSchema>;

/**
 * Current version set - Rails & Guarantees v1.0 RC specification
 */
export const CURRENT_VERSIONS: VersionSet = {
  api_version: 'v1.0.0-rc.1',
  schema_version: 'v2.0.0',
  contract_version: 'v1.0.0',
  ticket_format: 'v1.0.0'
} as const;

// =============================================================================
// VERSION COMPATIBILITY ENGINE
// =============================================================================

/**
 * Parse semantic version with comprehensive validation
 */
export function parseSemanticVersion(version: string): {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
  build?: string;
  raw: string;
} {
  // Normalize version string
  const normalized = version.startsWith('v') ? version.slice(1) : version;
  
  const match = normalized.match(
    /^(\d+)\.(\d+)\.(\d+)(?:-([a-zA-Z0-9]+(?:\.[a-zA-Z0-9]+)*))?(?:\+([a-zA-Z0-9]+(?:\.[a-zA-Z0-9]+)*))?$/
  );
  
  if (!match) {
    throw new Error(`Invalid semantic version: ${version}`);
  }
  
  const [, major, minor, patch, prerelease, build] = match;
  
  return {
    major: parseInt(major, 10),
    minor: parseInt(minor, 10),
    patch: parseInt(patch, 10),
    prerelease,
    build,
    raw: version
  };
}

/**
 * Compare two semantic versions
 */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
  const versionA = parseSemanticVersion(a);
  const versionB = parseSemanticVersion(b);
  
  // Compare major.minor.patch
  if (versionA.major !== versionB.major) {
    return versionA.major > versionB.major ? 1 : -1;
  }
  if (versionA.minor !== versionB.minor) {
    return versionA.minor > versionB.minor ? 1 : -1;
  }
  if (versionA.patch !== versionB.patch) {
    return versionA.patch > versionB.patch ? 1 : -1;
  }
  
  // Handle prerelease comparison
  if (!versionA.prerelease && !versionB.prerelease) return 0;
  if (!versionA.prerelease && versionB.prerelease) return 1;
  if (versionA.prerelease && !versionB.prerelease) return -1;
  
  return versionA.prerelease! < versionB.prerelease! ? -1 : 
         versionA.prerelease! > versionB.prerelease! ? 1 : 0;
}

/**
 * Check if version is compatible within constraints
 */
export function isVersionCompatible(
  version: string, 
  constraint: string,
  component: keyof VersionSet
): boolean {
  try {
    const versionParsed = parseSemanticVersion(version);
    const constraintParsed = parseSemanticVersion(constraint);
    
    // Component-specific compatibility rules
    switch (component) {
      case 'api_version':
        // API: Major version must match exactly, minor/patch can be higher
        return versionParsed.major === constraintParsed.major &&
               compareVersions(version, constraint) >= 0;
               
      case 'schema_version':
        // Schema: Major version must match, minor can be higher  
        return versionParsed.major === constraintParsed.major &&
               versionParsed.minor >= constraintParsed.minor;
               
      case 'contract_version':
        // Contract: Exact match for stability
        return version === constraint;
        
      case 'ticket_format':
        // Ticket: Exact match for cryptographic integrity
        return version === constraint;
        
      default:
        return false;
    }
  } catch {
    return false;
  }
}

// =============================================================================
// COMPATIBILITY CHECKER
// =============================================================================

/**
 * Comprehensive compatibility validation
 */
export async function checkCompatibility(
  incomingVersions: Partial<VersionSet>,
  allowCompatFlag = false
): Promise<CompatibilityResult> {
  // Handle null/undefined/invalid inputs gracefully
  if (!incomingVersions || typeof incomingVersions !== 'object' || Array.isArray(incomingVersions)) {
    return {
      compatible: false,
      version_mismatches: Object.entries(CURRENT_VERSIONS).map(([component, expectedVersion]) => ({
        component,
        expected: expectedVersion,
        actual: 'invalid input',
        severity: 'error' as const
      })),
      migration_required: false,
      summary: 'Invalid version object provided'
    };
  }

  const mismatches: CompatibilityResult['version_mismatches'] = [];
  let compatible = true;
  let migrationRequired = false;
  let migrationPath: string | undefined;
  
  // Validate each version component
  for (const [component, expectedVersion] of Object.entries(CURRENT_VERSIONS)) {
    const key = component as keyof VersionSet;
    const actualVersion = incomingVersions[key];
    
    if (!actualVersion) {
      mismatches.push({
        component,
        expected: expectedVersion,
        actual: 'missing',
        severity: 'error'
      });
      compatible = false;
      continue;
    }
    
    if (!isVersionCompatible(actualVersion, expectedVersion, key)) {
      const severity = allowCompatFlag ? 'warning' : 'error';
      mismatches.push({
        component,
        expected: expectedVersion,
        actual: actualVersion,
        severity
      });
      
      if (!allowCompatFlag) {
        compatible = false;
      }
      
      // Check if migration is possible
      if (supportsMigration(actualVersion, expectedVersion, key)) {
        migrationRequired = true;
        migrationPath = `arbiter migrate --from ${actualVersion} --to ${expectedVersion}`;
      }
    }
  }
  
  return {
    compatible: compatible || allowCompatFlag,
    version_mismatches: mismatches,
    migration_required: migrationRequired,
    migration_path: migrationPath,
    timestamp: new Date().toISOString()
  };
}

/**
 * Check if migration is supported between versions
 */
function supportsMigration(from: string, to: string, component: keyof VersionSet): boolean {
  try {
    const fromVersion = parseSemanticVersion(from);
    const toVersion = parseSemanticVersion(to);
    
    // No-op migrations (same version)
    if (from === to) return true;
    
    // Component-specific migration rules
    switch (component) {
      case 'api_version':
        // API: Can migrate within same major version
        return fromVersion.major === toVersion.major;
        
      case 'schema_version':
        // Schema: Can migrate forward within major version
        return fromVersion.major === toVersion.major && 
               compareVersions(from, to) <= 0;
               
      case 'contract_version':
        // Contract: Limited migration support
        return fromVersion.major === toVersion.major;
        
      case 'ticket_format':
        // Ticket: No migration (breaking change)
        return false;
        
      default:
        return false;
    }
  } catch {
    return false;
  }
}

// =============================================================================
// VERSION METADATA & RUNTIME INFO
// =============================================================================

/**
 * Runtime version information
 */
export interface RuntimeVersionInfo {
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
}

/**
 * Get current runtime version information
 */
export function getRuntimeVersionInfo(): RuntimeVersionInfo {
  return {
    versions: CURRENT_VERSIONS,
    build_info: {
      timestamp: new Date().toISOString(),
      commit_hash: process.env.BUILD_COMMIT_HASH,
      deterministic: true,
      reproducible: true
    },
    compatibility: {
      strict_mode: process.env.NODE_ENV === 'production',
      allow_compat_flag: process.env.ARBITER_ALLOW_COMPAT === 'true',
      migration_support: true
    }
  };
}

/**
 * Validate version set completeness and format
 */
export function validateVersionSet(versions: unknown): asserts versions is VersionSet {
  const result = VersionSetSchema.safeParse(versions);
  if (!result.success) {
    throw new Error(`Invalid version set: ${result.error.message}`);
  }
}

// =============================================================================
// MIGRATION SYSTEM INTERFACE
// =============================================================================

/**
 * Migration operation result
 */
export const MigrationResultSchema = z.object({
  success: z.boolean(),
  from_version: z.string(),
  to_version: z.string(),
  component: z.string(),
  operations_performed: z.array(z.string()),
  warnings: z.array(z.string()),
  timestamp: z.string().datetime()
}).strict();

export type MigrationResult = z.infer<typeof MigrationResultSchema>;

/**
 * Execute version migration (interface - implementation in migration.ts)
 */
export async function executeMigration(
  component: keyof VersionSet,
  fromVersion: string,
  toVersion: string
): Promise<MigrationResult> {
  // Validate migration is supported
  if (!supportsMigration(fromVersion, toVersion, component)) {
    throw new Error(`Migration not supported: ${component} ${fromVersion} -> ${toVersion}`);
  }
  
  // No-op migration
  if (fromVersion === toVersion) {
    return {
      success: true,
      from_version: fromVersion,
      to_version: toVersion,
      component,
      operations_performed: ['no-op migration'],
      warnings: [],
      timestamp: new Date().toISOString()
    };
  }
  
  // Implementation will be in migration.ts
  throw new Error('Migration implementation not yet available');
}
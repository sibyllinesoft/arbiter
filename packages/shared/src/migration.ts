/**
 * Migration management types and utilities
 */

export interface MigrationPath {
  fromVersion: string;
  toVersion: string;
  steps: MigrationStep[];
  estimatedDuration: number;
}

export interface MigrationStep {
  id: string;
  description: string;
  type: "schema" | "data" | "config" | "file";
  required: boolean;
  risk: "low" | "medium" | "high";
}

export function getAvailableMigrationPaths(component: string): string[] {
  const paths: string[] = [];

  switch (component) {
    case "arbiter":
      paths.push("v0.9.0 -> v1.0.0", "v1.0.0 -> v1.1.0", "v1.0.0 -> v2.0.0");
      break;

    case "cue":
      paths.push("v0.5.0 -> v0.6.0", "v0.6.0 -> v0.7.0");
      break;

    case "node":
      paths.push("v18.0.0 -> v20.0.0", "v20.0.0 -> v22.0.0");
      break;

    default:
      // For unknown components, provide a generic migration path
      paths.push(`${component}: v1.0.0 -> v2.0.0`);
  }

  return paths;
}

export function hasMigrationPath(
  component: string,
  fromVersion: string,
  toVersion: string,
): boolean {
  const availablePaths = getAvailableMigrationPaths(component);
  const searchPath = `${fromVersion} -> ${toVersion}`;

  // Direct path check
  if (availablePaths.some((path) => path.includes(searchPath))) {
    return true;
  }

  // Check for valid semantic version progression
  const fromVer = parseVersion(fromVersion);
  const toVer = parseVersion(toVersion);

  if (!fromVer || !toVer) {
    return false;
  }

  // Can't migrate backwards across major versions
  if (fromVer.major > toVer.major) {
    return false;
  }

  // Can migrate forward within major versions or to next major version
  return fromVer.major <= toVer.major;
}

/**
 * Parse version string into components
 */
function parseVersion(version: string): { major: number; minor: number; patch: number } | null {
  const cleanVersion = version.replace(/^v/, "");
  const match = cleanVersion.match(/^(\d+)\.(\d+)\.(\d+)/);

  if (!match) return null;

  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
  };
}

export function estimateMigrationDuration(
  component: string,
  fromVersion: string,
  toVersion: string,
): number {
  const fromVer = parseVersion(fromVersion);
  const toVer = parseVersion(toVersion);

  if (!fromVer || !toVer) {
    return 30000; // 30 seconds for unknown versions
  }

  let baseDuration = 10000; // 10 seconds base

  // Major version migrations take longer
  if (toVer.major > fromVer.major) {
    baseDuration += (toVer.major - fromVer.major) * 120000; // 2 minutes per major version
  }

  // Minor version migrations
  if (toVer.minor > fromVer.minor) {
    baseDuration += (toVer.minor - fromVer.minor) * 30000; // 30 seconds per minor version
  }

  // Component-specific adjustments
  switch (component) {
    case "arbiter":
      // Arbiter migrations tend to be more complex
      baseDuration *= 2;
      break;

    case "cue":
      // CUE migrations are usually syntax changes
      baseDuration *= 1.5;
      break;

    case "node":
      // Node migrations are usually just dependency updates
      baseDuration *= 0.5;
      break;
  }

  // Minimum 10 seconds, maximum 10 minutes
  return Math.max(10000, Math.min(baseDuration, 600000));
}

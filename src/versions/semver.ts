/**
 * Semantic versioning utilities with comprehensive semver support
 * Implements semantic versioning parsing, comparison, and manipulation
 */

import { 
  SemanticVersion, 
  VersionRange, 
  VersionOperator, 
  VersionConstraint,
  SemanticVersionSchema,
  VersionParsingError
} from './types.js';
import { logger } from '../utils/logger.js';

export class SemverUtils {
  private static readonly SEMVER_REGEX = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
  
  private static readonly RANGE_REGEX = /^(>=|<=|>|<|~|\^|=)?(.+)$/;

  /**
   * Parse a semantic version string into a SemanticVersion object
   */
  static parse(versionString: string): SemanticVersion {
    const trimmed = versionString.trim();
    const match = this.SEMVER_REGEX.exec(trimmed);
    
    if (!match) {
      throw new VersionParsingError(
        `Invalid semantic version format: ${versionString}`,
        versionString,
        { format: 'semantic_version' }
      );
    }

    const [, major, minor, patch, prereleaseStr, buildStr] = match;
    
    const prerelease = prereleaseStr ? prereleaseStr.split('.') : undefined;
    const build = buildStr ? buildStr.split('.') : undefined;

    const version: SemanticVersion = {
      major: parseInt(major, 10),
      minor: parseInt(minor, 10),
      patch: parseInt(patch, 10),
      prerelease,
      build,
    };

    // Validate with Zod schema
    const result = SemanticVersionSchema.safeParse(version);
    if (!result.success) {
      throw new VersionParsingError(
        `Version validation failed: ${result.error.message}`,
        versionString,
        { zodError: result.error }
      );
    }

    logger.debug(`Parsed version: ${versionString} -> ${this.format(version)}`);
    return version;
  }

  /**
   * Format a SemanticVersion object back to string
   */
  static format(version: SemanticVersion): string {
    let versionStr = `${version.major}.${version.minor}.${version.patch}`;
    
    if (version.prerelease && version.prerelease.length > 0) {
      versionStr += `-${version.prerelease.join('.')}`;
    }
    
    if (version.build && version.build.length > 0) {
      versionStr += `+${version.build.join('.')}`;
    }
    
    return versionStr;
  }

  /**
   * Compare two semantic versions
   * Returns: -1 if a < b, 0 if a === b, 1 if a > b
   */
  static compare(a: SemanticVersion, b: SemanticVersion): number {
    // Compare major, minor, patch
    if (a.major !== b.major) return a.major - b.major;
    if (a.minor !== b.minor) return a.minor - b.minor;
    if (a.patch !== b.patch) return a.patch - b.patch;

    // Handle prerelease versions
    if (!a.prerelease && !b.prerelease) return 0;
    if (!a.prerelease && b.prerelease) return 1; // Normal version > prerelease
    if (a.prerelease && !b.prerelease) return -1; // Prerelease < normal version

    // Compare prerelease identifiers
    if (a.prerelease && b.prerelease) {
      const maxLength = Math.max(a.prerelease.length, b.prerelease.length);
      
      for (let i = 0; i < maxLength; i++) {
        const aId = a.prerelease[i];
        const bId = b.prerelease[i];
        
        if (aId === undefined) return -1; // Shorter prerelease < longer
        if (bId === undefined) return 1; // Longer prerelease > shorter
        
        // Numeric comparison
        const aNum = parseInt(aId, 10);
        const bNum = parseInt(bId, 10);
        
        if (!isNaN(aNum) && !isNaN(bNum)) {
          if (aNum !== bNum) return aNum - bNum;
        } else if (!isNaN(aNum)) {
          return -1; // Numeric identifiers < alphanumeric
        } else if (!isNaN(bNum)) {
          return 1; // Alphanumeric > numeric identifiers
        } else {
          // Lexical comparison
          if (aId !== bId) return aId.localeCompare(bId);
        }
      }
    }

    return 0;
  }

  /**
   * Check if version a is greater than version b
   */
  static gt(a: SemanticVersion, b: SemanticVersion): boolean {
    return this.compare(a, b) > 0;
  }

  /**
   * Check if version a is greater than or equal to version b
   */
  static gte(a: SemanticVersion, b: SemanticVersion): boolean {
    return this.compare(a, b) >= 0;
  }

  /**
   * Check if version a is less than version b
   */
  static lt(a: SemanticVersion, b: SemanticVersion): boolean {
    return this.compare(a, b) < 0;
  }

  /**
   * Check if version a is less than or equal to version b
   */
  static lte(a: SemanticVersion, b: SemanticVersion): boolean {
    return this.compare(a, b) <= 0;
  }

  /**
   * Check if two versions are equal
   */
  static eq(a: SemanticVersion, b: SemanticVersion): boolean {
    return this.compare(a, b) === 0;
  }

  /**
   * Check if two versions are not equal
   */
  static neq(a: SemanticVersion, b: SemanticVersion): boolean {
    return this.compare(a, b) !== 0;
  }

  /**
   * Increment a version by bump type
   */
  static increment(version: SemanticVersion, bumpType: 'major' | 'minor' | 'patch' | 'prerelease'): SemanticVersion {
    const newVersion = { ...version };
    
    switch (bumpType) {
      case 'major':
        newVersion.major += 1;
        newVersion.minor = 0;
        newVersion.patch = 0;
        newVersion.prerelease = undefined;
        break;
        
      case 'minor':
        newVersion.minor += 1;
        newVersion.patch = 0;
        newVersion.prerelease = undefined;
        break;
        
      case 'patch':
        newVersion.patch += 1;
        newVersion.prerelease = undefined;
        break;
        
      case 'prerelease':
        if (version.prerelease) {
          // Increment existing prerelease
          const lastIdentifier = version.prerelease[version.prerelease.length - 1];
          const numIdentifier = parseInt(lastIdentifier, 10);
          
          if (!isNaN(numIdentifier)) {
            const newPrerelease = [...version.prerelease];
            newPrerelease[newPrerelease.length - 1] = (numIdentifier + 1).toString();
            newVersion.prerelease = newPrerelease;
          } else {
            newVersion.prerelease = [...version.prerelease, '0'];
          }
        } else {
          // Create first prerelease
          newVersion.patch += 1;
          newVersion.prerelease = ['0'];
        }
        break;
        
      default:
        throw new VersionParsingError(
          `Invalid bump type: ${bumpType}`,
          this.format(version),
          { bumpType }
        );
    }

    // Clear build metadata on version increment
    newVersion.build = undefined;
    
    logger.debug(`Incremented version: ${this.format(version)} -> ${this.format(newVersion)} (${bumpType})`);
    return newVersion;
  }

  /**
   * Parse a version range string
   */
  static parseRange(rangeString: string): VersionRange {
    const trimmed = rangeString.trim();
    const match = this.RANGE_REGEX.exec(trimmed);
    
    if (!match) {
      throw new VersionParsingError(
        `Invalid version range format: ${rangeString}`,
        rangeString,
        { format: 'version_range' }
      );
    }

    const [, operatorStr = '=', versionStr] = match;
    const operator = operatorStr as VersionOperator;
    
    // Handle special cases for x, X, * wildcards
    let version: SemanticVersion;
    
    if (versionStr.includes('x') || versionStr.includes('X') || versionStr.includes('*')) {
      version = this.parseWildcardVersion(versionStr);
    } else {
      version = this.parse(versionStr);
    }

    return {
      raw: rangeString,
      operator,
      version,
    };
  }

  /**
   * Parse wildcard version (e.g., 1.x, 2.*, 1.2.x)
   */
  private static parseWildcardVersion(versionStr: string): SemanticVersion {
    const parts = versionStr.split('.');
    const major = parts[0] === 'x' || parts[0] === 'X' || parts[0] === '*' ? 0 : parseInt(parts[0], 10);
    const minor = !parts[1] || parts[1] === 'x' || parts[1] === 'X' || parts[1] === '*' ? 0 : parseInt(parts[1], 10);
    const patch = !parts[2] || parts[2] === 'x' || parts[2] === 'X' || parts[2] === '*' ? 0 : parseInt(parts[2], 10);

    return { major, minor, patch };
  }

  /**
   * Check if a version satisfies a range
   */
  static satisfies(version: SemanticVersion, range: VersionRange): boolean {
    switch (range.operator) {
      case '=':
      case '==':
        return this.eq(version, range.version);
        
      case '!=':
        return this.neq(version, range.version);
        
      case '>':
        return this.gt(version, range.version);
        
      case '>=':
        return this.gte(version, range.version);
        
      case '<':
        return this.lt(version, range.version);
        
      case '<=':
        return this.lte(version, range.version);
        
      case '~':
        // ~1.2.3 := >=1.2.3 <1.(2+1).0
        return this.gte(version, range.version) && 
               this.lt(version, { 
                 ...range.version, 
                 minor: range.version.minor + 1, 
                 patch: 0, 
                 prerelease: undefined 
               });
        
      case '^':
        // ^1.2.3 := >=1.2.3 <2.0.0
        return this.gte(version, range.version) && 
               this.lt(version, { 
                 major: range.version.major + 1, 
                 minor: 0, 
                 patch: 0, 
                 prerelease: undefined 
               });
        
      case 'x':
      case 'X':
      case '*':
        // Wildcard matching
        return this.matchesWildcard(version, range.version);
        
      default:
        throw new VersionParsingError(
          `Unsupported range operator: ${range.operator}`,
          range.raw,
          { operator: range.operator }
        );
    }
  }

  /**
   * Check if version matches wildcard pattern
   */
  private static matchesWildcard(version: SemanticVersion, pattern: SemanticVersion): boolean {
    // For wildcard matching, we need to check the original range string
    // This is a simplified implementation
    return version.major === pattern.major && 
           version.minor === pattern.minor && 
           version.patch >= pattern.patch;
  }

  /**
   * Create a version constraint from a range string
   */
  static createConstraint(rangeString: string): VersionConstraint {
    const range = this.parseRange(rangeString);
    
    return {
      range: rangeString,
      satisfies: (version: SemanticVersion) => this.satisfies(version, range),
      description: this.describeRange(range),
    };
  }

  /**
   * Generate human-readable description of a version range
   */
  private static describeRange(range: VersionRange): string {
    const versionStr = this.format(range.version);
    
    switch (range.operator) {
      case '=':
      case '==':
        return `exactly ${versionStr}`;
      case '!=':
        return `not ${versionStr}`;
      case '>':
        return `greater than ${versionStr}`;
      case '>=':
        return `greater than or equal to ${versionStr}`;
      case '<':
        return `less than ${versionStr}`;
      case '<=':
        return `less than or equal to ${versionStr}`;
      case '~':
        return `compatible with ${versionStr} (tilde range)`;
      case '^':
        return `compatible with ${versionStr} (caret range)`;
      case 'x':
      case 'X':
      case '*':
        return `matching wildcard ${range.raw}`;
      default:
        return `matching ${range.raw}`;
    }
  }

  /**
   * Sort versions in ascending order
   */
  static sort(versions: SemanticVersion[]): SemanticVersion[] {
    return [...versions].sort(this.compare);
  }

  /**
   * Sort versions in descending order
   */
  static sortDescending(versions: SemanticVersion[]): SemanticVersion[] {
    return [...versions].sort((a, b) => this.compare(b, a));
  }

  /**
   * Find the maximum version from an array
   */
  static max(versions: SemanticVersion[]): SemanticVersion | undefined {
    if (versions.length === 0) return undefined;
    return versions.reduce((max, current) => this.gt(current, max) ? current : max);
  }

  /**
   * Find the minimum version from an array
   */
  static min(versions: SemanticVersion[]): SemanticVersion | undefined {
    if (versions.length === 0) return undefined;
    return versions.reduce((min, current) => this.lt(current, min) ? current : min);
  }

  /**
   * Filter versions that satisfy a constraint
   */
  static filterByConstraint(versions: SemanticVersion[], constraint: VersionConstraint): SemanticVersion[] {
    return versions.filter(constraint.satisfies);
  }

  /**
   * Check if version is a prerelease
   */
  static isPrerelease(version: SemanticVersion): boolean {
    return Boolean(version.prerelease && version.prerelease.length > 0);
  }

  /**
   * Check if version is stable (not prerelease)
   */
  static isStable(version: SemanticVersion): boolean {
    return !this.isPrerelease(version);
  }

  /**
   * Get the next stable version
   */
  static nextStable(version: SemanticVersion): SemanticVersion {
    if (this.isStable(version)) {
      return this.increment(version, 'patch');
    }
    
    // If prerelease, remove prerelease identifiers
    return {
      major: version.major,
      minor: version.minor,
      patch: version.patch,
      prerelease: undefined,
      build: undefined,
    };
  }

  /**
   * Extract major.minor version
   */
  static getMajorMinor(version: SemanticVersion): string {
    return `${version.major}.${version.minor}`;
  }

  /**
   * Check if two versions have the same major.minor
   */
  static sameMajorMinor(a: SemanticVersion, b: SemanticVersion): boolean {
    return a.major === b.major && a.minor === b.minor;
  }

  /**
   * Validate version string without throwing
   */
  static isValid(versionString: string): boolean {
    try {
      this.parse(versionString);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clean version string by removing leading 'v' if present
   */
  static clean(versionString: string): string {
    const cleaned = versionString.trim();
    return cleaned.startsWith('v') ? cleaned.substring(1) : cleaned;
  }

  /**
   * Get difference between two versions
   */
  static diff(a: SemanticVersion, b: SemanticVersion): 'major' | 'minor' | 'patch' | 'prerelease' | 'build' | undefined {
    if (this.eq(a, b)) return undefined;
    
    if (a.major !== b.major) return 'major';
    if (a.minor !== b.minor) return 'minor';
    if (a.patch !== b.patch) return 'patch';
    
    const aPrerelease = a.prerelease?.join('.') || '';
    const bPrerelease = b.prerelease?.join('.') || '';
    if (aPrerelease !== bPrerelease) return 'prerelease';
    
    const aBuild = a.build?.join('.') || '';
    const bBuild = b.build?.join('.') || '';
    if (aBuild !== bBuild) return 'build';
    
    return undefined;
  }
}
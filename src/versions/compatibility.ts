/**
 * Compatibility matrix system for version management
 * Maintains compatibility matrices between versions with upgrade path recommendations
 */

import {
  SemanticVersion,
  CompatibilityMatrix,
  CompatibilityAnalysis,
  BreakingChange,
  CompatibilityWarning,
  MigrationPath,
  DeprecationWarning,
  SupportWindow,
  EOLVersion,
  VersionConstraint,
} from './types.js';
import { ContractDefinition } from '../contracts/types.js';
import { SemverUtils } from './semver.js';
import { VersionAnalyzer } from './analyzer.js';
import { MigrationManager } from './migration.js';
import { logger } from '../utils/logger.js';

export class CompatibilityManager {
  private compatibilityMatrices: Map<string, CompatibilityMatrix> = new Map();
  private deprecationWarnings: DeprecationWarning[] = [];
  private supportWindow: SupportWindow;

  constructor(supportWindow?: Partial<SupportWindow>) {
    this.supportWindow = {
      currentVersion: { major: 1, minor: 0, patch: 0 },
      minimumSupported: { major: 0, minor: 9, patch: 0 },
      recommendedMinimum: { major: 1, minor: 0, patch: 0 },
      endOfLife: [],
      ...supportWindow,
    };
  }

  /**
   * Build compatibility matrix for a version
   */
  buildCompatibilityMatrix(
    sourceVersion: SemanticVersion,
    allVersions: SemanticVersion[],
    versionContracts: Map<string, ContractDefinition[]>
  ): CompatibilityMatrix {
    logger.info(`Building compatibility matrix for ${SemverUtils.format(sourceVersion)}`);

    const compatibleVersions: SemanticVersion[] = [];
    const deprecatedVersions: SemanticVersion[] = [];
    const unsupportedVersions: SemanticVersion[] = [];
    const upgradePathMap = new Map<string, MigrationPath>();

    const sourceContracts = versionContracts.get(SemverUtils.format(sourceVersion)) || [];

    for (const targetVersion of allVersions) {
      if (SemverUtils.eq(sourceVersion, targetVersion)) {
        compatibleVersions.push(targetVersion);
        continue;
      }

      const targetContracts = versionContracts.get(SemverUtils.format(targetVersion)) || [];
      const analysis = VersionAnalyzer.analyzeCompatibility(
        sourceVersion,
        targetVersion,
        sourceContracts,
        targetContracts
      );

      // Classify version compatibility
      if (this.isVersionUnsupported(targetVersion)) {
        unsupportedVersions.push(targetVersion);
      } else if (this.isVersionDeprecated(targetVersion)) {
        deprecatedVersions.push(targetVersion);
      } else if (analysis.compatible || this.isBackwardCompatible(sourceVersion, targetVersion)) {
        compatibleVersions.push(targetVersion);
      }

      // Generate migration path if needed
      if (!analysis.compatible && analysis.breakingChanges.length > 0) {
        const migrationPath = MigrationManager.generateMigrationPath(
          sourceVersion,
          targetVersion,
          analysis.breakingChanges,
          sourceContracts,
          targetContracts
        );
        upgradePathMap.set(SemverUtils.format(targetVersion), migrationPath);
      }
    }

    const matrix: CompatibilityMatrix = {
      sourceVersion,
      compatibleVersions: SemverUtils.sort(compatibleVersions),
      deprecatedVersions: SemverUtils.sort(deprecatedVersions),
      unsupportedVersions: SemverUtils.sort(unsupportedVersions),
      upgradePathMap,
      lastUpdated: new Date(),
    };

    this.compatibilityMatrices.set(SemverUtils.format(sourceVersion), matrix);
    return matrix;
  }

  /**
   * Check if version upgrade is safe
   */
  isUpgradeSafe(
    fromVersion: SemanticVersion,
    toVersion: SemanticVersion,
    contracts: ContractDefinition[]
  ): {
    safe: boolean;
    warnings: CompatibilityWarning[];
    breakingChanges: BreakingChange[];
    migrationRequired: boolean;
  } {
    logger.debug(`Checking upgrade safety: ${SemverUtils.format(fromVersion)} -> ${SemverUtils.format(toVersion)}`);

    const warnings: CompatibilityWarning[] = [];
    const breakingChanges: BreakingChange[] = [];

    // Check version support status
    if (this.isVersionUnsupported(toVersion)) {
      warnings.push({
        id: 'unsupported_version',
        type: 'deprecation',
        path: 'version',
        message: `Target version ${SemverUtils.format(toVersion)} is unsupported`,
        recommendedAction: 'Upgrade to a supported version',
      });
    }

    if (this.isVersionDeprecated(toVersion)) {
      warnings.push({
        id: 'deprecated_version',
        type: 'deprecation',
        path: 'version',
        message: `Target version ${SemverUtils.format(toVersion)} is deprecated`,
        recommendedAction: 'Consider upgrading to the latest stable version',
      });
    }

    // Check for downgrade
    if (SemverUtils.lt(toVersion, fromVersion)) {
      warnings.push({
        id: 'version_downgrade',
        type: 'behavioral_change',
        path: 'version',
        message: 'Downgrading versions may cause compatibility issues',
        recommendedAction: 'Ensure all features used are available in the target version',
      });
    }

    // Check major version changes
    if (toVersion.major > fromVersion.major) {
      warnings.push({
        id: 'major_version_change',
        type: 'behavioral_change',
        path: 'version',
        message: 'Major version upgrade may contain breaking changes',
        recommendedAction: 'Review changelog and test thoroughly before upgrading',
      });
    }

    // Analyze contract compatibility
    const targetContracts = contracts; // Assuming contracts are for target version
    const sourceContracts = contracts; // Would need to get contracts for source version

    const analysis = VersionAnalyzer.analyzeCompatibility(
      fromVersion,
      toVersion,
      sourceContracts,
      targetContracts
    );

    warnings.push(...analysis.warnings);
    breakingChanges.push(...analysis.breakingChanges);

    const safe = breakingChanges.length === 0;
    const migrationRequired = !analysis.compatible;

    return {
      safe,
      warnings,
      breakingChanges,
      migrationRequired,
    };
  }

  /**
   * Get recommended upgrade path
   */
  getRecommendedUpgradePath(
    currentVersion: SemanticVersion,
    targetVersion: SemanticVersion
  ): {
    directUpgrade: boolean;
    intermediateVersions: SemanticVersion[];
    totalMigrations: number;
    estimatedDuration: string;
    recommendations: string[];
  } {
    const recommendations: string[] = [];
    
    // Check if direct upgrade is possible
    const matrix = this.compatibilityMatrices.get(SemverUtils.format(currentVersion));
    if (matrix?.compatibleVersions.some(v => SemverUtils.eq(v, targetVersion))) {
      return {
        directUpgrade: true,
        intermediateVersions: [],
        totalMigrations: 0,
        estimatedDuration: '0 minutes',
        recommendations: ['Direct upgrade is possible with no migration required'],
      };
    }

    // Find intermediate versions for step-by-step upgrade
    const intermediateVersions = this.findIntermediateVersions(currentVersion, targetVersion);
    
    if (intermediateVersions.length === 0 && !SemverUtils.eq(currentVersion, targetVersion)) {
      recommendations.push('Direct upgrade not recommended due to breaking changes');
      recommendations.push('Consider upgrading through intermediate stable versions');
    }

    let totalMigrations = intermediateVersions.length;
    if (totalMigrations === 0 && !SemverUtils.eq(currentVersion, targetVersion)) {
      totalMigrations = 1; // Direct migration required
    }

    const estimatedMinutes = totalMigrations * 30; // Rough estimate
    const estimatedDuration = estimatedMinutes < 60 
      ? `${estimatedMinutes} minutes`
      : `${Math.ceil(estimatedMinutes / 60)} hours`;

    if (totalMigrations > 3) {
      recommendations.push('Complex upgrade path detected - consider comprehensive testing');
    }

    if (this.isVersionDeprecated(currentVersion)) {
      recommendations.push('Current version is deprecated - upgrade recommended');
    }

    return {
      directUpgrade: totalMigrations <= 1,
      intermediateVersions,
      totalMigrations,
      estimatedDuration,
      recommendations,
    };
  }

  /**
   * Find intermediate versions for step-by-step upgrade
   */
  private findIntermediateVersions(
    currentVersion: SemanticVersion,
    targetVersion: SemanticVersion
  ): SemanticVersion[] {
    const intermediates: SemanticVersion[] = [];
    
    // Strategy: Find stable versions between current and target
    // that minimize breaking changes at each step
    
    if (targetVersion.major > currentVersion.major) {
      // For major version upgrades, find the latest minor of each major
      for (let major = currentVersion.major + 1; major < targetVersion.major; major++) {
        const latestMinor = this.findLatestMinorForMajor(major);
        if (latestMinor) {
          intermediates.push(latestMinor);
        }
      }
      
      // Add target major.0.0 if not the final target
      if (targetVersion.minor > 0 || targetVersion.patch > 0) {
        intermediates.push({
          major: targetVersion.major,
          minor: 0,
          patch: 0,
        });
      }
    }

    return intermediates;
  }

  /**
   * Add deprecation warning for a feature
   */
  addDeprecationWarning(warning: DeprecationWarning): void {
    this.deprecationWarnings.push(warning);
    logger.warn(`Deprecation warning added: ${warning.feature} (deprecated in ${SemverUtils.format(warning.deprecatedIn)})`);
  }

  /**
   * Get all deprecation warnings for a version
   */
  getDeprecationWarnings(version: SemanticVersion): DeprecationWarning[] {
    return this.deprecationWarnings.filter(warning => 
      SemverUtils.gte(version, warning.deprecatedIn) && 
      SemverUtils.lt(version, warning.removedIn)
    );
  }

  /**
   * Check if version is within support window
   */
  isVersionSupported(version: SemanticVersion): boolean {
    return SemverUtils.gte(version, this.supportWindow.minimumSupported);
  }

  /**
   * Check if version is deprecated but still supported
   */
  isVersionDeprecated(version: SemanticVersion): boolean {
    return SemverUtils.gte(version, this.supportWindow.minimumSupported) &&
           SemverUtils.lt(version, this.supportWindow.recommendedMinimum);
  }

  /**
   * Check if version is unsupported
   */
  isVersionUnsupported(version: SemanticVersion): boolean {
    return SemverUtils.lt(version, this.supportWindow.minimumSupported) ||
           this.supportWindow.endOfLife.some(eol => SemverUtils.eq(version, eol.version));
  }

  /**
   * Update support window
   */
  updateSupportWindow(newWindow: Partial<SupportWindow>): void {
    this.supportWindow = { ...this.supportWindow, ...newWindow };
    logger.info(`Support window updated: min=${SemverUtils.format(this.supportWindow.minimumSupported)}, recommended=${SemverUtils.format(this.supportWindow.recommendedMinimum)}`);
  }

  /**
   * Mark version as end-of-life
   */
  markVersionEndOfLife(version: SemanticVersion, endDate: Date, reason: string): void {
    const eolVersion: EOLVersion = { version, endDate, reason };
    this.supportWindow.endOfLife = [...this.supportWindow.endOfLife, eolVersion];
    logger.warn(`Version ${SemverUtils.format(version)} marked as end-of-life: ${reason}`);
  }

  /**
   * Get compatibility report between two versions
   */
  getCompatibilityReport(
    fromVersion: SemanticVersion,
    toVersion: SemanticVersion,
    contracts: ContractDefinition[]
  ): {
    compatible: boolean;
    summary: string;
    details: CompatibilityAnalysis;
    recommendations: string[];
    migration?: MigrationPath;
  } {
    const analysis = VersionAnalyzer.analyzeCompatibility(
      fromVersion,
      toVersion,
      contracts,
      contracts // Simplified - would need version-specific contracts
    );

    const recommendations: string[] = [...analysis.recommendations];
    const upgradeInfo = this.getRecommendedUpgradePath(fromVersion, toVersion);
    
    recommendations.push(...upgradeInfo.recommendations);

    let summary = `Upgrade from ${SemverUtils.format(fromVersion)} to ${SemverUtils.format(toVersion)}`;
    
    if (analysis.compatible) {
      summary += ' is compatible with no breaking changes.';
    } else if (analysis.breakingChanges.length === 1) {
      summary += ' has 1 breaking change that requires migration.';
    } else {
      summary += ` has ${analysis.breakingChanges.length} breaking changes that require migration.`;
    }

    let migration: MigrationPath | undefined;
    if (!analysis.compatible) {
      migration = MigrationManager.generateMigrationPath(
        fromVersion,
        toVersion,
        analysis.breakingChanges,
        contracts,
        contracts
      );
    }

    return {
      compatible: analysis.compatible,
      summary,
      details: analysis,
      recommendations,
      migration,
    };
  }

  /**
   * Create version constraint that ensures compatibility
   */
  createCompatibilityConstraint(
    baseVersion: SemanticVersion,
    allowBreaking: boolean = false
  ): VersionConstraint {
    const matrix = this.compatibilityMatrices.get(SemverUtils.format(baseVersion));
    
    if (!matrix) {
      // Fallback to semver rules
      const rangeString = allowBreaking 
        ? `>=${SemverUtils.format(baseVersion)}`
        : `^${SemverUtils.format(baseVersion)}`;
        
      return SemverUtils.createConstraint(rangeString);
    }

    // Create constraint based on compatibility matrix
    const compatibleVersions = matrix.compatibleVersions;
    const minVersion = SemverUtils.min(compatibleVersions);
    const maxVersion = SemverUtils.max(compatibleVersions);

    if (!minVersion || !maxVersion) {
      return SemverUtils.createConstraint(`=${SemverUtils.format(baseVersion)}`);
    }

    const rangeString = SemverUtils.eq(minVersion, maxVersion)
      ? `=${SemverUtils.format(minVersion)}`
      : `>=${SemverUtils.format(minVersion)} <=${SemverUtils.format(maxVersion)}`;

    return {
      range: rangeString,
      satisfies: (version: SemanticVersion) => {
        return compatibleVersions.some(cv => SemverUtils.eq(version, cv));
      },
      description: `Compatible versions based on compatibility matrix for ${SemverUtils.format(baseVersion)}`,
    };
  }

  /**
   * Export compatibility data for external tools
   */
  exportCompatibilityData(): {
    matrices: Record<string, CompatibilityMatrix>;
    deprecations: DeprecationWarning[];
    supportWindow: SupportWindow;
    exportedAt: Date;
  } {
    const matrices: Record<string, CompatibilityMatrix> = {};
    for (const [version, matrix] of this.compatibilityMatrices) {
      matrices[version] = matrix;
    }

    return {
      matrices,
      deprecations: this.deprecationWarnings,
      supportWindow: this.supportWindow,
      exportedAt: new Date(),
    };
  }

  /**
   * Import compatibility data from external source
   */
  importCompatibilityData(data: {
    matrices?: Record<string, CompatibilityMatrix>;
    deprecations?: DeprecationWarning[];
    supportWindow?: Partial<SupportWindow>;
  }): void {
    if (data.matrices) {
      this.compatibilityMatrices.clear();
      for (const [version, matrix] of Object.entries(data.matrices)) {
        this.compatibilityMatrices.set(version, matrix);
      }
    }

    if (data.deprecations) {
      this.deprecationWarnings = data.deprecations;
    }

    if (data.supportWindow) {
      this.updateSupportWindow(data.supportWindow);
    }

    logger.info('Compatibility data imported successfully');
  }

  /**
   * Helper methods
   */
  private isBackwardCompatible(
    sourceVersion: SemanticVersion,
    targetVersion: SemanticVersion
  ): boolean {
    // Backward compatibility rules based on semver
    if (targetVersion.major > sourceVersion.major) return false;
    if (targetVersion.major < sourceVersion.major) return true;
    
    // Same major version - check minor
    if (targetVersion.minor > sourceVersion.minor) return false;
    return true;
  }

  private findLatestMinorForMajor(major: number): SemanticVersion | undefined {
    // This would query actual version data
    // Simplified implementation
    return { major, minor: 0, patch: 0 };
  }

  /**
   * Get matrix for specific version
   */
  getCompatibilityMatrix(version: SemanticVersion): CompatibilityMatrix | undefined {
    return this.compatibilityMatrices.get(SemverUtils.format(version));
  }

  /**
   * Clear all compatibility data
   */
  clear(): void {
    this.compatibilityMatrices.clear();
    this.deprecationWarnings = [];
    logger.info('Compatibility data cleared');
  }

  /**
   * Get all tracked versions
   */
  getTrackedVersions(): SemanticVersion[] {
    return Array.from(this.compatibilityMatrices.keys()).map(v => SemverUtils.parse(v));
  }
}
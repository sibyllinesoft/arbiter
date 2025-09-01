/**
 * Main version manager for arbiter
 * Manages semantic versioning for CUE schemas and contracts with automated analysis
 */

import {
  SemanticVersion,
  VersionHistory,
  VersionChange,
  VersionBumpResult,
  VersionBumpType,
  VersionManagerConfig,
  CompatibilityImpact,
  MigrationPath,
  VersionError,
  VersionCompatibilityError,
} from './types.js';
import { ContractDefinition } from '../contracts/types.js';
import { SemverUtils } from './semver.js';
import { VersionAnalyzer } from './analyzer.js';
import { MigrationManager } from './migration.js';
import { CompatibilityManager } from './compatibility.js';
import { logger } from '../utils/logger.js';

export class VersionManager {
  private history: VersionHistory[] = [];
  private compatibilityManager: CompatibilityManager;
  private config: VersionManagerConfig;

  constructor(config?: Partial<VersionManagerConfig>) {
    this.config = {
      defaultBumpType: 'patch',
      prereleaseTags: ['alpha', 'beta', 'rc'],
      migrationTimeout: 300000, // 5 minutes
      maxSupportedVersions: 10,
      autoMigration: false,
      strictCompatibility: true,
      allowDowngrade: false,
      gitIntegration: {
        enabled: true,
        tagPrefix: 'v',
        createTags: true,
        pushTags: false,
      },
      ...config,
    };

    this.compatibilityManager = new CompatibilityManager();
    logger.info('Version manager initialized', this.config);
  }

  /**
   * Get current version
   */
  getCurrentVersion(): SemanticVersion {
    if (this.history.length === 0) {
      return { major: 0, minor: 1, patch: 0 };
    }
    
    const latest = this.history
      .sort((a, b) => SemverUtils.compare(b.version, a.version))[0];
    
    return latest.version;
  }

  /**
   * Analyze changes and determine required version bump
   */
  analyzeChanges(
    sourceContracts: ContractDefinition[],
    targetContracts: ContractDefinition[],
    customChanges?: VersionChange[]
  ): VersionBumpResult {
    const currentVersion = this.getCurrentVersion();
    logger.info(`Analyzing changes for version bump from ${SemverUtils.format(currentVersion)}`);

    const changes: VersionChange[] = [...(customChanges || [])];
    let highestImpact: 'breaking' | 'feature' | 'fix' | 'none' = 'none';

    // Compare contracts to detect changes
    const sourceContractMap = new Map(sourceContracts.map(c => [c.id, c]));
    const targetContractMap = new Map(targetContracts.map(c => [c.id, c]));

    // Analyze contract changes
    for (const [id, sourceContract] of sourceContractMap) {
      const targetContract = targetContractMap.get(id);
      
      if (!targetContract) {
        // Contract removed - breaking change
        changes.push({
          type: 'contract_removed',
          path: id,
          description: `Contract '${id}' removed`,
          impact: 'breaking',
          severity: 'critical',
          details: {
            before: sourceContract,
            after: undefined,
            migrationRequired: true,
            backwardCompatible: false,
          },
        });
        highestImpact = 'breaking';
        continue;
      }

      // Analyze contract differences
      const comparison = VersionAnalyzer.analyzeContractChanges(sourceContract, targetContract);
      
      for (const diff of comparison.differences) {
        const change: VersionChange = {
          type: this.mapDifferenceToChangeType(diff.type),
          path: `${id}.${diff.path}`,
          description: diff.description,
          impact: diff.impact,
          severity: this.inferSeverity(diff.impact, diff.type),
          details: {
            before: diff.details,
            after: diff.details,
            migrationRequired: comparison.migrationRequired,
            backwardCompatible: diff.impact !== 'breaking',
          },
        };
        
        changes.push(change);
        
        // Update highest impact
        if (diff.impact === 'breaking') highestImpact = 'breaking';
        else if (diff.impact === 'feature' && highestImpact !== 'breaking') highestImpact = 'feature';
        else if (diff.impact === 'fix' && highestImpact === 'none') highestImpact = 'fix';
      }
    }

    // Check for new contracts
    for (const [id, targetContract] of targetContractMap) {
      if (!sourceContractMap.has(id)) {
        changes.push({
          type: 'contract_added',
          path: id,
          description: `Contract '${id}' added`,
          impact: 'feature',
          severity: 'minor',
          details: {
            before: undefined,
            after: targetContract,
            migrationRequired: false,
            backwardCompatible: true,
          },
        });
        
        if (highestImpact === 'none') highestImpact = 'feature';
      }
    }

    // Determine version bump type
    const bumpType = this.determineBumpType(highestImpact, changes);
    const nextVersion = SemverUtils.increment(currentVersion, bumpType);
    
    const migrationRequired = changes.some(c => c.details.migrationRequired);
    
    const compatibilityImpact = this.assessCompatibilityImpact(
      currentVersion,
      nextVersion,
      changes
    );

    const reason = this.generateBumpReason(highestImpact, changes.length);

    return {
      currentVersion,
      nextVersion,
      bumpType,
      reason,
      changes,
      migrationRequired,
      compatibilityImpact,
    };
  }

  /**
   * Execute version bump
   */
  async bumpVersion(
    contracts: ContractDefinition[],
    author: string,
    message?: string,
    customBumpType?: VersionBumpType
  ): Promise<{
    version: SemanticVersion;
    changes: VersionChange[];
    migrationPath?: MigrationPath;
  }> {
    const currentVersion = this.getCurrentVersion();
    
    // Get previous contracts for comparison
    const previousContracts = this.getPreviousVersionContracts();
    
    // Analyze changes if not custom bump
    let changes: VersionChange[] = [];
    let nextVersion: SemanticVersion;
    let migrationRequired = false;

    if (customBumpType) {
      nextVersion = SemverUtils.increment(currentVersion, customBumpType);
      changes = [{
        type: 'schema_modified',
        path: 'manual',
        description: `Manual ${customBumpType} version bump`,
        impact: customBumpType === 'major' ? 'breaking' : customBumpType === 'minor' ? 'feature' : 'fix',
        severity: customBumpType === 'major' ? 'major' : customBumpType === 'minor' ? 'minor' : 'patch',
        details: {
          migrationRequired: customBumpType === 'major',
          backwardCompatible: customBumpType !== 'major',
        },
      }];
    } else {
      const analysis = this.analyzeChanges(previousContracts, contracts);
      nextVersion = analysis.nextVersion;
      changes = analysis.changes;
      migrationRequired = analysis.migrationRequired;
    }

    logger.info(`Bumping version: ${SemverUtils.format(currentVersion)} -> ${SemverUtils.format(nextVersion)}`);

    // Validate version bump if strict compatibility is enabled
    if (this.config.strictCompatibility) {
      const validationResult = this.validateVersionBump(currentVersion, nextVersion, changes);
      if (!validationResult.valid) {
        throw new VersionCompatibilityError(
          `Version bump validation failed: ${validationResult.reason}`,
          SemverUtils.format(nextVersion),
          { currentVersion: SemverUtils.format(currentVersion), changes }
        );
      }
    }

    // Generate migration path if needed
    let migrationPath: MigrationPath | undefined;
    if (migrationRequired) {
      const breakingChanges = changes
        .filter(c => c.impact === 'breaking')
        .map(c => ({
          id: `${c.type}_${c.path}`,
          type: c.type,
          path: c.path,
          description: c.description,
          impact: 'Contract or schema compatibility may be affected',
          severity: c.severity,
        }));

      migrationPath = MigrationManager.generateMigrationPath(
        currentVersion,
        nextVersion,
        breakingChanges,
        previousContracts,
        contracts
      );
    }

    // Create version history entry
    const historyEntry: VersionHistory = {
      id: `version_${SemverUtils.format(nextVersion)}_${Date.now()}`,
      version: nextVersion,
      timestamp: new Date(),
      author,
      message: message || `Version ${SemverUtils.format(nextVersion)}`,
      changes,
      contracts: contracts.map(c => c.id),
      buildMetadata: {
        migrationRequired,
        migrationPath: migrationPath?.id,
        contractCount: contracts.length,
        changeCount: changes.length,
      },
    };

    // Add to history
    this.history.push(historyEntry);

    // Update compatibility matrices
    await this.updateCompatibilityMatrices(nextVersion, contracts);

    // Handle git integration if enabled
    if (this.config.gitIntegration.enabled) {
      await this.handleGitIntegration(nextVersion, historyEntry);
    }

    logger.info(`Version bumped successfully to ${SemverUtils.format(nextVersion)}`);
    return { version: nextVersion, changes, migrationPath };
  }

  /**
   * Get version history
   */
  getVersionHistory(limit?: number): VersionHistory[] {
    const sorted = this.history
      .sort((a, b) => SemverUtils.compare(b.version, a.version));
    
    return limit ? sorted.slice(0, limit) : sorted;
  }

  /**
   * Get version by semantic version
   */
  getVersion(version: SemanticVersion): VersionHistory | undefined {
    return this.history.find(h => SemverUtils.eq(h.version, version));
  }

  /**
   * Check compatibility between versions
   */
  checkCompatibility(
    fromVersion: SemanticVersion,
    toVersion: SemanticVersion,
    contracts: ContractDefinition[]
  ): {
    compatible: boolean;
    warnings: string[];
    breakingChanges: string[];
    migrationRequired: boolean;
    migrationPath?: MigrationPath;
  } {
    logger.debug(`Checking compatibility: ${SemverUtils.format(fromVersion)} -> ${SemverUtils.format(toVersion)}`);

    const upgradeInfo = this.compatibilityManager.isUpgradeSafe(fromVersion, toVersion, contracts);
    const report = this.compatibilityManager.getCompatibilityReport(fromVersion, toVersion, contracts);

    return {
      compatible: report.compatible,
      warnings: upgradeInfo.warnings.map(w => w.message),
      breakingChanges: upgradeInfo.breakingChanges.map(bc => bc.description),
      migrationRequired: upgradeInfo.migrationRequired,
      migrationPath: report.migration,
    };
  }

  /**
   * Execute migration between versions
   */
  async migrate(
    fromVersion: SemanticVersion,
    toVersion: SemanticVersion,
    contracts: ContractDefinition[],
    dryRun: boolean = false
  ): Promise<{
    success: boolean;
    migrationId?: string;
    completedSteps?: string[];
    error?: string;
  }> {
    logger.info(`${dryRun ? 'Dry run: ' : ''}Executing migration: ${SemverUtils.format(fromVersion)} -> ${SemverUtils.format(toVersion)}`);

    const report = this.compatibilityManager.getCompatibilityReport(fromVersion, toVersion, contracts);
    
    if (!report.migration) {
      if (report.compatible) {
        return { success: true };
      } else {
        return { 
          success: false, 
          error: 'Migration required but no migration path available' 
        };
      }
    }

    try {
      const result = await MigrationManager.executeMigration(report.migration, dryRun);
      
      if (result.success) {
        logger.info(`Migration completed successfully: ${report.migration.id}`);
      } else if (result.rollbackRequired) {
        logger.warn(`Migration failed, initiating rollback: ${result.error}`);
        const rollbackResult = await MigrationManager.rollbackMigration(
          report.migration,
          result.completedSteps
        );
        if (!rollbackResult.success) {
          logger.error(`Migration rollback also failed: ${rollbackResult.error}`);
        }
      }

      return {
        success: result.success,
        migrationId: report.migration.id,
        completedSteps: result.completedSteps,
        error: result.error,
      };
    } catch (error) {
      logger.error('Migration execution failed', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Rollback to previous version
   */
  async rollback(
    targetVersion: SemanticVersion,
    reason: string
  ): Promise<{
    success: boolean;
    rolledBackFrom: SemanticVersion;
    error?: string;
  }> {
    const currentVersion = this.getCurrentVersion();
    
    if (!this.config.allowDowngrade) {
      throw new VersionError(
        'Version downgrade not allowed by configuration',
        SemverUtils.format(targetVersion),
        'rollback'
      );
    }

    logger.warn(`Rolling back version: ${SemverUtils.format(currentVersion)} -> ${SemverUtils.format(targetVersion)}, reason: ${reason}`);

    const targetHistory = this.getVersion(targetVersion);
    if (!targetHistory) {
      return {
        success: false,
        rolledBackFrom: currentVersion,
        error: `Target version ${SemverUtils.format(targetVersion)} not found in history`,
      };
    }

    // Create rollback history entry
    const rollbackEntry: VersionHistory = {
      id: `rollback_${SemverUtils.format(targetVersion)}_${Date.now()}`,
      version: targetVersion,
      timestamp: new Date(),
      author: 'system',
      message: `Rollback to ${SemverUtils.format(targetVersion)}: ${reason}`,
      changes: [{
        type: 'schema_modified',
        path: 'rollback',
        description: `Rollback from ${SemverUtils.format(currentVersion)} to ${SemverUtils.format(targetVersion)}`,
        impact: 'breaking',
        severity: 'major',
        details: {
          before: currentVersion,
          after: targetVersion,
          migrationRequired: true,
          backwardCompatible: false,
        },
      }],
      contracts: targetHistory.contracts,
      buildMetadata: {
        rollback: true,
        rollbackFrom: SemverUtils.format(currentVersion),
        rollbackReason: reason,
      },
    };

    this.history.push(rollbackEntry);

    logger.info(`Version rolled back successfully to ${SemverUtils.format(targetVersion)}`);
    return {
      success: true,
      rolledBackFrom: currentVersion,
    };
  }

  /**
   * Private helper methods
   */
  private mapDifferenceToChangeType(diffType: string): any {
    switch (diffType) {
      case 'added': return 'schema_added';
      case 'removed': return 'schema_removed';
      case 'modified': return 'schema_modified';
      case 'type_changed': return 'type_changed';
      default: return 'schema_modified';
    }
  }

  private inferSeverity(impact: string, diffType: string): any {
    if (impact === 'breaking') return diffType === 'removed' ? 'critical' : 'major';
    if (impact === 'feature') return 'minor';
    return 'patch';
  }

  private determineBumpType(impact: 'breaking' | 'feature' | 'fix' | 'none', changes: VersionChange[]): VersionBumpType {
    if (impact === 'breaking' || changes.some(c => c.severity === 'critical')) return 'major';
    if (impact === 'feature') return 'minor';
    if (impact === 'fix') return 'patch';
    return this.config.defaultBumpType;
  }

  private generateBumpReason(impact: string, changeCount: number): string {
    const descriptions = {
      breaking: 'Breaking changes detected',
      feature: 'New features added',
      fix: 'Bug fixes applied',
      none: 'No significant changes detected',
    };

    const baseReason = descriptions[impact as keyof typeof descriptions] || 'Changes detected';
    return `${baseReason} (${changeCount} change${changeCount !== 1 ? 's' : ''})`;
  }

  private assessCompatibilityImpact(
    currentVersion: SemanticVersion,
    nextVersion: SemanticVersion,
    changes: VersionChange[]
  ): CompatibilityImpact {
    const affectedVersions: SemanticVersion[] = [];
    const deprecationWarnings = this.compatibilityManager.getDeprecationWarnings(currentVersion);

    // For major version bumps, all previous versions may be affected
    if (nextVersion.major > currentVersion.major) {
      for (const history of this.history) {
        if (history.version.major < nextVersion.major) {
          affectedVersions.push(history.version);
        }
      }
    }

    return {
      affectedVersions,
      deprecationWarnings,
      supportWindow: {
        currentVersion: nextVersion,
        minimumSupported: {
          major: Math.max(0, nextVersion.major - 2),
          minor: 0,
          patch: 0,
        },
        recommendedMinimum: {
          major: Math.max(0, nextVersion.major - 1),
          minor: 0,
          patch: 0,
        },
        endOfLife: [],
      },
    };
  }

  private validateVersionBump(
    currentVersion: SemanticVersion,
    nextVersion: SemanticVersion,
    changes: VersionChange[]
  ): { valid: boolean; reason?: string } {
    const versionDiff = SemverUtils.diff(currentVersion, nextVersion);
    const hasBreakingChanges = changes.some(c => c.impact === 'breaking');
    const hasFeatures = changes.some(c => c.impact === 'feature');
    const hasFixes = changes.some(c => c.impact === 'fix');

    // Validate bump type matches changes
    if (versionDiff === 'major' && !hasBreakingChanges) {
      return { valid: false, reason: 'Major version bump requires breaking changes' };
    }
    
    if (hasBreakingChanges && versionDiff !== 'major') {
      return { valid: false, reason: 'Breaking changes require major version bump' };
    }

    if (versionDiff === 'minor' && !hasFeatures && !hasBreakingChanges) {
      return { valid: false, reason: 'Minor version bump requires new features' };
    }

    return { valid: true };
  }

  private getPreviousVersionContracts(): ContractDefinition[] {
    // This would retrieve contracts from previous version
    // Simplified implementation returns empty array
    return [];
  }

  private async updateCompatibilityMatrices(
    version: SemanticVersion,
    contracts: ContractDefinition[]
  ): Promise<void> {
    const allVersions = this.history.map(h => h.version);
    const versionContracts = new Map([[SemverUtils.format(version), contracts]]);
    
    this.compatibilityManager.buildCompatibilityMatrix(
      version,
      allVersions,
      versionContracts
    );
  }

  private async handleGitIntegration(
    version: SemanticVersion,
    historyEntry: VersionHistory
  ): Promise<void> {
    if (!this.config.gitIntegration.createTags) return;

    const tagName = `${this.config.gitIntegration.tagPrefix}${SemverUtils.format(version)}`;
    const tagMessage = historyEntry.message;

    try {
      // This would execute git commands
      logger.debug(`Creating git tag: ${tagName}`);
      
      if (this.config.gitIntegration.pushTags) {
        logger.debug(`Pushing git tag: ${tagName}`);
      }
    } catch (error) {
      logger.warn(`Git integration failed for version ${SemverUtils.format(version)}`, error);
    }
  }

  /**
   * Export version data
   */
  export(): {
    history: VersionHistory[];
    config: VersionManagerConfig;
    compatibility: any;
    exportedAt: Date;
  } {
    return {
      history: this.history,
      config: this.config,
      compatibility: this.compatibilityManager.exportCompatibilityData(),
      exportedAt: new Date(),
    };
  }

  /**
   * Import version data
   */
  import(data: {
    history?: VersionHistory[];
    config?: Partial<VersionManagerConfig>;
    compatibility?: any;
  }): void {
    if (data.history) {
      this.history = data.history;
    }
    
    if (data.config) {
      this.config = { ...this.config, ...data.config };
    }
    
    if (data.compatibility) {
      this.compatibilityManager.importCompatibilityData(data.compatibility);
    }

    logger.info('Version manager data imported successfully');
  }

  /**
   * Clear all version data
   */
  clear(): void {
    this.history = [];
    this.compatibilityManager.clear();
    logger.info('Version manager data cleared');
  }

  /**
   * Get configuration
   */
  getConfig(): VersionManagerConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<VersionManagerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('Version manager configuration updated', newConfig);
  }
}
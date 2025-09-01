/**
 * Version validation gate
 * Validates semantic versioning compliance and ensures proper version management
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile, access } from 'fs/promises';
import { join } from 'path';
import {
  GateExecutor,
  GateConfiguration,
  GateExecutionContext,
  GateResult,
  GateStatus,
  GateFinding,
  ValidationResult
} from './types.js';

const execAsync = promisify(exec);

export interface VersionGateSettings {
  /** Enforce semantic versioning compliance */
  enforceSemanticVersioning: boolean;
  /** Check backward compatibility requirements */
  checkBackwardCompatibility: boolean;
  /** Validate migration scripts for breaking changes */
  validateMigrations: boolean;
  /** Version bump validation */
  versionBumpValidation: VersionBumpValidation;
  /** Package files to check */
  packageFiles: string[];
  /** Migration directories */
  migrationDirectories: string[];
  /** Changelog requirements */
  changelogRequirements: ChangelogRequirements;
  /** API compatibility checking */
  apiCompatibility: ApiCompatibilitySettings;
  /** Version tag requirements */
  tagRequirements: TagRequirements;
}

export interface VersionBumpValidation {
  /** Require version bump for changes */
  requireVersionBump: boolean;
  /** Allowed version bump types */
  allowedBumpTypes: ('major' | 'minor' | 'patch' | 'prerelease')[];
  /** Auto-detect appropriate bump type */
  autoDetectBumpType: boolean;
  /** Version bump rules based on changes */
  bumpRules: VersionBumpRule[];
}

export interface VersionBumpRule {
  /** Pattern to match in changed files or commit messages */
  pattern: string | RegExp;
  /** Required version bump type */
  bumpType: 'major' | 'minor' | 'patch';
  /** Rule description */
  description: string;
}

export interface ChangelogRequirements {
  /** Require changelog updates */
  requireChangelog: boolean;
  /** Changelog file path */
  changelogPath: string;
  /** Changelog format */
  format: 'keepachangelog' | 'conventional' | 'custom';
  /** Require entry for current version */
  requireCurrentVersionEntry: boolean;
}

export interface ApiCompatibilitySettings {
  /** Enable API compatibility checking */
  enabled: boolean;
  /** API specification files */
  specFiles: string[];
  /** Allowed breaking change types */
  allowedBreakingChanges: BreakingChangeType[];
  /** Compatibility check tools */
  tools: ApiCompatibilityTool[];
}

export interface ApiCompatibilityTool {
  /** Tool name */
  name: 'openapi-diff' | 'swagger-diff' | 'json-schema-diff' | 'custom';
  /** Tool command */
  command: string;
  /** Configuration */
  config?: Record<string, any>;
}

export interface TagRequirements {
  /** Require git tags for versions */
  requireTags: boolean;
  /** Tag naming pattern */
  tagPattern: string;
  /** Require signed tags */
  requireSignedTags: boolean;
  /** Tag message requirements */
  tagMessageRequirements: string[];
}

export type BreakingChangeType = 
  | 'removed-endpoint' 
  | 'changed-response-format' 
  | 'removed-field' 
  | 'changed-field-type' 
  | 'added-required-field';

export interface VersionInfo {
  /** Current version */
  current: string;
  /** Previous version */
  previous?: string;
  /** Parsed version components */
  parsed: ParsedVersion;
  /** Version source (package.json, etc.) */
  source: string;
}

export interface ParsedVersion {
  /** Major version number */
  major: number;
  /** Minor version number */
  minor: number;
  /** Patch version number */
  patch: number;
  /** Prerelease identifier */
  prerelease?: string;
  /** Build metadata */
  build?: string;
  /** Is valid semantic version */
  isValid: boolean;
}

export interface VersionValidationResult {
  /** Version information */
  versionInfo: VersionInfo;
  /** Version bump analysis */
  versionBump: VersionBumpAnalysis;
  /** Backward compatibility analysis */
  compatibility: CompatibilityAnalysis;
  /** Changelog analysis */
  changelog: ChangelogAnalysis;
  /** Migration analysis */
  migrations: MigrationAnalysis;
  /** Tag analysis */
  tags: TagAnalysis;
}

export interface VersionBumpAnalysis {
  /** Whether version was bumped */
  wasBumped: boolean;
  /** Detected bump type */
  detectedBumpType?: 'major' | 'minor' | 'patch' | 'prerelease';
  /** Required bump type based on changes */
  requiredBumpType?: 'major' | 'minor' | 'patch';
  /** Version bump rules that triggered */
  triggeredRules: VersionBumpRule[];
  /** Is bump type appropriate */
  isAppropriate: boolean;
}

export interface CompatibilityAnalysis {
  /** Is backward compatible */
  isBackwardCompatible: boolean;
  /** Breaking changes found */
  breakingChanges: BreakingChange[];
  /** API compatibility results */
  apiCompatibility: ApiCompatibilityResult[];
}

export interface BreakingChange {
  /** Change type */
  type: BreakingChangeType;
  /** Description */
  description: string;
  /** File path */
  filePath?: string;
  /** Line number */
  line?: number;
  /** Change details */
  details: string;
  /** Impact assessment */
  impact: 'high' | 'medium' | 'low';
}

export interface ApiCompatibilityResult {
  /** Tool used */
  tool: string;
  /** Compatibility status */
  compatible: boolean;
  /** Breaking changes found */
  breakingChanges: BreakingChange[];
  /** Error message if tool failed */
  error?: string;
}

export interface ChangelogAnalysis {
  /** Changelog exists */
  exists: boolean;
  /** Current version has entry */
  hasCurrentVersionEntry: boolean;
  /** Changelog format compliance */
  formatCompliant: boolean;
  /** Changelog path */
  path?: string;
  /** Format issues */
  formatIssues: string[];
}

export interface MigrationAnalysis {
  /** Migration files found */
  migrations: MigrationFile[];
  /** Are migrations consistent with changes */
  consistent: boolean;
  /** Missing migrations */
  missingMigrations: string[];
  /** Migration validation errors */
  validationErrors: string[];
}

export interface MigrationFile {
  /** File path */
  path: string;
  /** Version */
  version: string;
  /** Migration type */
  type: 'up' | 'down' | 'both';
  /** Is valid */
  isValid: boolean;
  /** Validation errors */
  errors: string[];
}

export interface TagAnalysis {
  /** Current version has tag */
  hasTag: boolean;
  /** Tag name */
  tagName?: string;
  /** Tag is signed */
  isSigned?: boolean;
  /** Tag message */
  message?: string;
  /** Tag compliance issues */
  complianceIssues: string[];
}

/**
 * Version validation gate implementation
 */
export class VersionGate implements GateExecutor {
  /**
   * Execute the version gate
   */
  async executeGate(
    gate: GateConfiguration,
    context: GateExecutionContext
  ): Promise<GateResult> {
    const startTime = new Date();
    const settings = this.validateAndParseSettings(gate.settings);

    try {
      // Perform version validation
      const validation = await this.performVersionValidation(settings, context);

      // Generate findings
      const findings = this.generateFindings(validation, settings);

      // Determine gate status
      const status = this.determineGateStatus(findings, validation, settings);

      const endTime = new Date();

      return {
        gateId: gate.id,
        name: gate.name,
        status,
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        details: {
          summary: this.generateSummary(validation, status),
          findings,
          recommendations: this.generateRecommendations(validation, settings),
          reportUrls: this.generateReportUrls(context)
        },
        metrics: this.extractMetrics(validation)
      };

    } catch (error) {
      const endTime = new Date();
      return this.createErrorResult(gate, error as Error, startTime, endTime);
    }
  }

  /**
   * Validate gate configuration
   */
  validateConfiguration(config: GateConfiguration): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const settings = config.settings as VersionGateSettings;

      // Validate boolean settings
      if (typeof settings.enforceSemanticVersioning !== 'boolean') {
        errors.push('enforceSemanticVersioning must be a boolean');
      }

      if (typeof settings.checkBackwardCompatibility !== 'boolean') {
        errors.push('checkBackwardCompatibility must be a boolean');
      }

      if (typeof settings.validateMigrations !== 'boolean') {
        errors.push('validateMigrations must be a boolean');
      }

      // Validate package files
      if (!Array.isArray(settings.packageFiles)) {
        errors.push('packageFiles must be an array of file paths');
      }

      // Validate version bump validation
      if (settings.versionBumpValidation) {
        const vbv = settings.versionBumpValidation;
        if (!Array.isArray(vbv.allowedBumpTypes)) {
          errors.push('allowedBumpTypes must be an array');
        }
        if (!Array.isArray(vbv.bumpRules)) {
          warnings.push('bumpRules should be an array of version bump rules');
        }
      }

      // Validate changelog requirements
      if (settings.changelogRequirements) {
        const cr = settings.changelogRequirements;
        if (typeof cr.requireChangelog !== 'boolean') {
          errors.push('requireChangelog must be a boolean');
        }
        if (typeof cr.changelogPath !== 'string') {
          warnings.push('changelogPath should be a string');
        }
      }

    } catch (error) {
      errors.push(`Invalid settings object: ${error}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Check if gate should be skipped
   */
  shouldSkip(gate: GateConfiguration, context: GateExecutionContext): boolean {
    const settings = gate.settings as VersionGateSettings;

    // Skip if no version-related files changed
    const versionRelatedFiles = [
      ...settings.packageFiles,
      settings.changelogRequirements?.changelogPath || 'CHANGELOG.md',
      'VERSION',
      'version.txt'
    ];

    const hasVersionChanges = context.changedFiles.some(file =>
      versionRelatedFiles.some(versionFile => file.includes(versionFile))
    );

    return !hasVersionChanges;
  }

  /**
   * Perform version validation
   */
  private async performVersionValidation(
    settings: VersionGateSettings,
    context: GateExecutionContext
  ): Promise<VersionValidationResult> {
    // Get version information
    const versionInfo = await this.getVersionInfo(settings, context);

    // Analyze version bump
    const versionBump = await this.analyzeVersionBump(versionInfo, settings, context);

    // Check backward compatibility
    const compatibility = await this.checkBackwardCompatibility(versionInfo, settings, context);

    // Analyze changelog
    const changelog = await this.analyzeChangelog(versionInfo, settings, context);

    // Analyze migrations
    const migrations = await this.analyzeMigrations(versionInfo, settings, context);

    // Analyze tags
    const tags = await this.analyzeTags(versionInfo, settings, context);

    return {
      versionInfo,
      versionBump,
      compatibility,
      changelog,
      migrations,
      tags
    };
  }

  /**
   * Get version information from package files
   */
  private async getVersionInfo(
    settings: VersionGateSettings,
    context: GateExecutionContext
  ): Promise<VersionInfo> {
    // Try to find version in package files
    for (const packageFile of settings.packageFiles) {
      const filePath = join(context.workingDirectory, packageFile);
      
      try {
        await access(filePath);
        const content = await readFile(filePath, 'utf-8');
        const version = this.extractVersionFromFile(content, packageFile);
        
        if (version) {
          return {
            current: version,
            parsed: this.parseVersion(version),
            source: packageFile
          };
        }
      } catch (error) {
        // File doesn't exist or can't be read, continue
      }
    }

    // Try to get version from git tags
    try {
      const { stdout } = await execAsync('git describe --tags --abbrev=0', {
        cwd: context.workingDirectory
      });
      const version = stdout.trim();
      
      return {
        current: version,
        parsed: this.parseVersion(version),
        source: 'git-tag'
      };
    } catch (error) {
      // No git tags, use default
    }

    // Default version
    return {
      current: '0.0.0',
      parsed: this.parseVersion('0.0.0'),
      source: 'default'
    };
  }

  /**
   * Extract version from file content
   */
  private extractVersionFromFile(content: string, filePath: string): string | null {
    if (filePath.endsWith('package.json')) {
      try {
        const pkg = JSON.parse(content);
        return pkg.version;
      } catch (error) {
        return null;
      }
    }

    if (filePath.endsWith('pyproject.toml')) {
      const versionMatch = content.match(/version\s*=\s*["']([^"']+)["']/);
      return versionMatch ? versionMatch[1] : null;
    }

    if (filePath.endsWith('setup.py')) {
      const versionMatch = content.match(/version\s*=\s*["']([^"']+)["']/);
      return versionMatch ? versionMatch[1] : null;
    }

    if (filePath.endsWith('Cargo.toml')) {
      const versionMatch = content.match(/version\s*=\s*["']([^"']+)["']/);
      return versionMatch ? versionMatch[1] : null;
    }

    // Generic version pattern
    const versionMatch = content.match(/version["\s:=]*["']?([0-9]+\.[0-9]+\.[0-9]+[^"'\s]*)/i);
    return versionMatch ? versionMatch[1] : null;
  }

  /**
   * Parse version string into components
   */
  private parseVersion(version: string): ParsedVersion {
    // Remove 'v' prefix if present
    const cleanVersion = version.replace(/^v/, '');
    
    // Semantic version regex
    const semverRegex = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
    const match = cleanVersion.match(semverRegex);

    if (match) {
      return {
        major: parseInt(match[1]),
        minor: parseInt(match[2]),
        patch: parseInt(match[3]),
        prerelease: match[4],
        build: match[5],
        isValid: true
      };
    }

    // Try to parse partial versions
    const partialRegex = /^(\d+)(?:\.(\d+))?(?:\.(\d+))?/;
    const partialMatch = cleanVersion.match(partialRegex);

    if (partialMatch) {
      return {
        major: parseInt(partialMatch[1]) || 0,
        minor: parseInt(partialMatch[2]) || 0,
        patch: parseInt(partialMatch[3]) || 0,
        isValid: false
      };
    }

    // Invalid version
    return {
      major: 0,
      minor: 0,
      patch: 0,
      isValid: false
    };
  }

  /**
   * Analyze version bump
   */
  private async analyzeVersionBump(
    versionInfo: VersionInfo,
    settings: VersionGateSettings,
    context: GateExecutionContext
  ): Promise<VersionBumpAnalysis> {
    const versionBumpSettings = settings.versionBumpValidation;
    
    // Get previous version
    let previousVersion: string | undefined;
    try {
      // Try to get previous version from git
      const { stdout } = await execAsync(
        `git show HEAD~1:${versionInfo.source}`,
        { cwd: context.workingDirectory }
      );
      
      if (versionInfo.source.endsWith('.json')) {
        const prevPkg = JSON.parse(stdout);
        previousVersion = prevPkg.version;
      } else {
        previousVersion = this.extractVersionFromFile(stdout, versionInfo.source);
      }
    } catch (error) {
      // Can't get previous version
    }

    const wasBumped = previousVersion && previousVersion !== versionInfo.current;
    let detectedBumpType: 'major' | 'minor' | 'patch' | 'prerelease' | undefined;

    if (wasBumped && previousVersion) {
      const prevParsed = this.parseVersion(previousVersion);
      const currParsed = versionInfo.parsed;

      if (currParsed.major > prevParsed.major) {
        detectedBumpType = 'major';
      } else if (currParsed.minor > prevParsed.minor) {
        detectedBumpType = 'minor';
      } else if (currParsed.patch > prevParsed.patch) {
        detectedBumpType = 'patch';
      } else if (currParsed.prerelease && !prevParsed.prerelease) {
        detectedBumpType = 'prerelease';
      }
    }

    // Check bump rules
    const triggeredRules: VersionBumpRule[] = [];
    let requiredBumpType: 'major' | 'minor' | 'patch' | undefined;

    if (versionBumpSettings.autoDetectBumpType) {
      for (const rule of versionBumpSettings.bumpRules) {
        if (this.ruleMatches(rule, context)) {
          triggeredRules.push(rule);
          if (!requiredBumpType || this.compareBumpTypes(rule.bumpType, requiredBumpType) > 0) {
            requiredBumpType = rule.bumpType;
          }
        }
      }
    }

    const isAppropriate = !requiredBumpType || 
      !detectedBumpType || 
      this.compareBumpTypes(detectedBumpType, requiredBumpType) >= 0;

    return {
      wasBumped: wasBumped || false,
      detectedBumpType,
      requiredBumpType,
      triggeredRules,
      isAppropriate
    };
  }

  /**
   * Check if version bump rule matches
   */
  private ruleMatches(rule: VersionBumpRule, context: GateExecutionContext): boolean {
    const pattern = typeof rule.pattern === 'string' ? new RegExp(rule.pattern, 'i') : rule.pattern;
    
    // Check changed files
    if (context.changedFiles.some(file => pattern.test(file))) {
      return true;
    }

    // Check commit messages (if available)
    // This would require additional context about commits
    // For now, just check files
    return false;
  }

  /**
   * Compare bump types (returns 0 if equal, >0 if first is higher, <0 if second is higher)
   */
  private compareBumpTypes(
    type1: 'major' | 'minor' | 'patch' | 'prerelease',
    type2: 'major' | 'minor' | 'patch' | 'prerelease'
  ): number {
    const order = { major: 3, minor: 2, patch: 1, prerelease: 0 };
    return order[type1] - order[type2];
  }

  /**
   * Check backward compatibility
   */
  private async checkBackwardCompatibility(
    versionInfo: VersionInfo,
    settings: VersionGateSettings,
    context: GateExecutionContext
  ): Promise<CompatibilityAnalysis> {
    const breakingChanges: BreakingChange[] = [];
    const apiCompatibility: ApiCompatibilityResult[] = [];

    if (!settings.checkBackwardCompatibility) {
      return {
        isBackwardCompatible: true,
        breakingChanges: [],
        apiCompatibility: []
      };
    }

    // Check API compatibility if enabled
    if (settings.apiCompatibility.enabled) {
      for (const tool of settings.apiCompatibility.tools) {
        try {
          const result = await this.runApiCompatibilityTool(tool, context);
          apiCompatibility.push(result);
          breakingChanges.push(...result.breakingChanges);
        } catch (error) {
          apiCompatibility.push({
            tool: tool.name,
            compatible: false,
            breakingChanges: [],
            error: (error as Error).message
          });
        }
      }
    }

    // Basic breaking change detection based on file patterns
    const potentialBreakingChanges = this.detectPotentialBreakingChanges(context);
    breakingChanges.push(...potentialBreakingChanges);

    const isBackwardCompatible = breakingChanges.length === 0;

    return {
      isBackwardCompatible,
      breakingChanges,
      apiCompatibility
    };
  }

  /**
   * Run API compatibility tool
   */
  private async runApiCompatibilityTool(
    tool: ApiCompatibilityTool,
    context: GateExecutionContext
  ): Promise<ApiCompatibilityResult> {
    try {
      const { stdout } = await execAsync(tool.command, {
        cwd: context.workingDirectory,
        timeout: 60000
      });

      // Parse tool output (simplified)
      const breakingChanges: BreakingChange[] = [];
      if (stdout.toLowerCase().includes('breaking')) {
        breakingChanges.push({
          type: 'changed-response-format',
          description: 'API breaking change detected',
          details: stdout,
          impact: 'high'
        });
      }

      return {
        tool: tool.name,
        compatible: breakingChanges.length === 0,
        breakingChanges
      };
    } catch (error) {
      throw new Error(`API compatibility tool ${tool.name} failed: ${error}`);
    }
  }

  /**
   * Detect potential breaking changes from file patterns
   */
  private detectPotentialBreakingChanges(
    context: GateExecutionContext
  ): BreakingChange[] {
    const breakingChanges: BreakingChange[] = [];
    
    // Check for changes in API files
    const apiFiles = context.changedFiles.filter(file =>
      file.includes('api/') || 
      file.includes('routes/') || 
      file.endsWith('.api.ts') ||
      file.includes('swagger') ||
      file.includes('openapi')
    );

    for (const file of apiFiles) {
      breakingChanges.push({
        type: 'changed-response-format',
        description: `Potential API breaking change in ${file}`,
        filePath: file,
        details: 'API file modified - review for breaking changes',
        impact: 'medium'
      });
    }

    // Check for database migration files
    const migrationFiles = context.changedFiles.filter(file =>
      file.includes('migration') || 
      file.includes('migrate') ||
      file.includes('schema')
    );

    for (const file of migrationFiles) {
      breakingChanges.push({
        type: 'removed-field',
        description: `Potential database breaking change in ${file}`,
        filePath: file,
        details: 'Database migration file modified - review for breaking changes',
        impact: 'high'
      });
    }

    return breakingChanges;
  }

  /**
   * Analyze changelog
   */
  private async analyzeChangelog(
    versionInfo: VersionInfo,
    settings: VersionGateSettings,
    context: GateExecutionContext
  ): Promise<ChangelogAnalysis> {
    if (!settings.changelogRequirements.requireChangelog) {
      return {
        exists: false,
        hasCurrentVersionEntry: false,
        formatCompliant: true,
        formatIssues: []
      };
    }

    const changelogPath = join(context.workingDirectory, settings.changelogRequirements.changelogPath);
    
    try {
      await access(changelogPath);
      const content = await readFile(changelogPath, 'utf-8');
      
      const hasCurrentVersionEntry = content.includes(versionInfo.current);
      const formatIssues: string[] = [];
      
      // Check format compliance
      let formatCompliant = true;
      if (settings.changelogRequirements.format === 'keepachangelog') {
        if (!content.includes('## [Unreleased]')) {
          formatIssues.push('Missing [Unreleased] section');
          formatCompliant = false;
        }
        if (!content.includes('### Added') && !content.includes('### Changed') && !content.includes('### Fixed')) {
          formatIssues.push('Missing standard sections (Added, Changed, Fixed)');
          formatCompliant = false;
        }
      }
      
      return {
        exists: true,
        hasCurrentVersionEntry,
        formatCompliant,
        path: settings.changelogRequirements.changelogPath,
        formatIssues
      };
    } catch (error) {
      return {
        exists: false,
        hasCurrentVersionEntry: false,
        formatCompliant: false,
        formatIssues: ['Changelog file not found']
      };
    }
  }

  /**
   * Analyze migrations
   */
  private async analyzeMigrations(
    versionInfo: VersionInfo,
    settings: VersionGateSettings,
    context: GateExecutionContext
  ): Promise<MigrationAnalysis> {
    if (!settings.validateMigrations) {
      return {
        migrations: [],
        consistent: true,
        missingMigrations: [],
        validationErrors: []
      };
    }

    const migrations: MigrationFile[] = [];
    const missingMigrations: string[] = [];
    const validationErrors: string[] = [];

    // Check migration directories
    for (const migrationDir of settings.migrationDirectories) {
      try {
        const dirPath = join(context.workingDirectory, migrationDir);
        await access(dirPath);
        
        // This would scan for migration files
        // Simplified implementation
        migrations.push({
          path: migrationDir,
          version: versionInfo.current,
          type: 'both',
          isValid: true,
          errors: []
        });
      } catch (error) {
        missingMigrations.push(migrationDir);
      }
    }

    const consistent = missingMigrations.length === 0 && validationErrors.length === 0;

    return {
      migrations,
      consistent,
      missingMigrations,
      validationErrors
    };
  }

  /**
   * Analyze git tags
   */
  private async analyzeTags(
    versionInfo: VersionInfo,
    settings: VersionGateSettings,
    context: GateExecutionContext
  ): Promise<TagAnalysis> {
    if (!settings.tagRequirements.requireTags) {
      return {
        hasTag: false,
        complianceIssues: []
      };
    }

    const complianceIssues: string[] = [];
    
    try {
      // Check if current version has a tag
      const expectedTag = settings.tagRequirements.tagPattern
        .replace('{version}', versionInfo.current);
      
      const { stdout } = await execAsync(`git tag -l "${expectedTag}"`, {
        cwd: context.workingDirectory
      });
      
      const hasTag = stdout.trim().length > 0;
      
      if (!hasTag && settings.tagRequirements.requireTags) {
        complianceIssues.push(`Missing git tag for version ${versionInfo.current}`);
      }

      let isSigned: boolean | undefined;
      let message: string | undefined;

      if (hasTag) {
        // Check if tag is signed
        if (settings.tagRequirements.requireSignedTags) {
          try {
            await execAsync(`git tag -v "${expectedTag}"`, {
              cwd: context.workingDirectory
            });
            isSigned = true;
          } catch (error) {
            isSigned = false;
            complianceIssues.push('Tag is not signed');
          }
        }

        // Get tag message
        try {
          const { stdout: tagMessage } = await execAsync(`git tag -l --format="%(contents)" "${expectedTag}"`, {
            cwd: context.workingDirectory
          });
          message = tagMessage.trim();
        } catch (error) {
          // Couldn't get tag message
        }
      }

      return {
        hasTag,
        tagName: hasTag ? expectedTag : undefined,
        isSigned,
        message,
        complianceIssues
      };
    } catch (error) {
      complianceIssues.push(`Error checking git tags: ${error}`);
      return {
        hasTag: false,
        complianceIssues
      };
    }
  }

  /**
   * Generate findings from validation
   */
  private generateFindings(
    validation: VersionValidationResult,
    settings: VersionGateSettings
  ): GateFinding[] {
    const findings: GateFinding[] = [];

    // Check semantic versioning compliance
    if (settings.enforceSemanticVersioning && !validation.versionInfo.parsed.isValid) {
      findings.push({
        severity: 'error',
        category: 'version',
        message: `Invalid semantic version: ${validation.versionInfo.current}`,
        rule: 'semantic-versioning'
      });
    }

    // Check version bump appropriateness
    if (settings.versionBumpValidation.requireVersionBump && 
        !validation.versionBump.wasBumped) {
      findings.push({
        severity: 'error',
        category: 'version',
        message: 'Version bump required but not detected',
        rule: 'version-bump-required'
      });
    }

    if (!validation.versionBump.isAppropriate) {
      findings.push({
        severity: 'warning',
        category: 'version',
        message: `Version bump type (${validation.versionBump.detectedBumpType}) may not be appropriate for changes (suggested: ${validation.versionBump.requiredBumpType})`,
        rule: 'version-bump-appropriateness'
      });
    }

    // Check backward compatibility
    if (settings.checkBackwardCompatibility && !validation.compatibility.isBackwardCompatible) {
      for (const change of validation.compatibility.breakingChanges) {
        findings.push({
          severity: change.impact === 'high' ? 'error' : 'warning',
          category: 'compatibility',
          message: `Breaking change: ${change.description}`,
          file: change.filePath,
          line: change.line,
          rule: 'backward-compatibility'
        });
      }
    }

    // Check changelog requirements
    if (settings.changelogRequirements.requireChangelog) {
      if (!validation.changelog.exists) {
        findings.push({
          severity: 'error',
          category: 'documentation',
          message: 'Changelog file is required but not found',
          rule: 'changelog-required'
        });
      } else {
        if (settings.changelogRequirements.requireCurrentVersionEntry && 
            !validation.changelog.hasCurrentVersionEntry) {
          findings.push({
            severity: 'warning',
            category: 'documentation',
            message: `Changelog entry missing for version ${validation.versionInfo.current}`,
            rule: 'changelog-entry-required'
          });
        }

        for (const issue of validation.changelog.formatIssues) {
          findings.push({
            severity: 'warning',
            category: 'documentation',
            message: `Changelog format issue: ${issue}`,
            rule: 'changelog-format'
          });
        }
      }
    }

    // Check migration requirements
    if (settings.validateMigrations && !validation.migrations.consistent) {
      for (const missing of validation.migrations.missingMigrations) {
        findings.push({
          severity: 'warning',
          category: 'migration',
          message: `Missing migration directory: ${missing}`,
          rule: 'migration-consistency'
        });
      }

      for (const error of validation.migrations.validationErrors) {
        findings.push({
          severity: 'error',
          category: 'migration',
          message: `Migration validation error: ${error}`,
          rule: 'migration-validation'
        });
      }
    }

    // Check tag requirements
    for (const issue of validation.tags.complianceIssues) {
      findings.push({
        severity: 'warning',
        category: 'version',
        message: issue,
        rule: 'tag-compliance'
      });
    }

    return findings;
  }

  /**
   * Determine gate status
   */
  private determineGateStatus(
    findings: GateFinding[],
    validation: VersionValidationResult,
    settings: VersionGateSettings
  ): GateStatus {
    const errors = findings.filter(f => f.severity === 'error');
    return errors.length === 0 ? GateStatus.PASSED : GateStatus.FAILED;
  }

  /**
   * Generate summary message
   */
  private generateSummary(validation: VersionValidationResult, status: GateStatus): string {
    const version = validation.versionInfo.current;
    const isValid = validation.versionInfo.parsed.isValid;
    
    if (status === GateStatus.PASSED) {
      return `Version validation passed. Current version: ${version} (${isValid ? 'valid' : 'invalid'} semver). Backward compatible: ${validation.compatibility.isBackwardCompatible}.`;
    } else {
      const breakingChanges = validation.compatibility.breakingChanges.length;
      return `Version validation failed. Current version: ${version}. Found ${breakingChanges} potential breaking change(s).`;
    }
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(
    validation: VersionValidationResult,
    settings: VersionGateSettings
  ): string[] {
    const recommendations: string[] = [];

    if (!validation.versionInfo.parsed.isValid) {
      recommendations.push('Update version to follow semantic versioning format (MAJOR.MINOR.PATCH)');
    }

    if (!validation.versionBump.isAppropriate && validation.versionBump.requiredBumpType) {
      recommendations.push(`Consider bumping version to ${validation.versionBump.requiredBumpType} based on changes`);
    }

    if (!validation.compatibility.isBackwardCompatible) {
      recommendations.push('Review breaking changes and consider major version bump');
      recommendations.push('Add migration guides for breaking changes');
    }

    if (settings.changelogRequirements.requireChangelog && !validation.changelog.exists) {
      recommendations.push(`Create a changelog file at ${settings.changelogRequirements.changelogPath}`);
    }

    if (validation.changelog.exists && !validation.changelog.hasCurrentVersionEntry) {
      recommendations.push('Add entry for current version to changelog');
    }

    if (!validation.tags.hasTag && settings.tagRequirements.requireTags) {
      recommendations.push('Create git tag for current version');
    }

    if (validation.tags.hasTag && !validation.tags.isSigned && settings.tagRequirements.requireSignedTags) {
      recommendations.push('Sign git tags for better security');
    }

    return recommendations;
  }

  /**
   * Generate report URLs
   */
  private generateReportUrls(context: GateExecutionContext): string[] {
    const urls: string[] = [];

    // Add version report URL if available
    const reportPath = join(context.workingDirectory, '.arbiter', 'version-report.html');
    urls.push(`file://${reportPath}`);

    return urls;
  }

  /**
   * Extract metrics for reporting
   */
  private extractMetrics(validation: VersionValidationResult): Record<string, number> {
    return {
      'version.isValid': validation.versionInfo.parsed.isValid ? 1 : 0,
      'version.major': validation.versionInfo.parsed.major,
      'version.minor': validation.versionInfo.parsed.minor,
      'version.patch': validation.versionInfo.parsed.patch,
      'version.wasBumped': validation.versionBump.wasBumped ? 1 : 0,
      'version.isBackwardCompatible': validation.compatibility.isBackwardCompatible ? 1 : 0,
      'version.breakingChanges': validation.compatibility.breakingChanges.length,
      'version.hasChangelog': validation.changelog.exists ? 1 : 0,
      'version.changelogCompliant': validation.changelog.formatCompliant ? 1 : 0,
      'version.hasTag': validation.tags.hasTag ? 1 : 0,
      'version.tagSigned': validation.tags.isSigned ? 1 : 0,
      'version.migrationsConsistent': validation.migrations.consistent ? 1 : 0
    };
  }

  /**
   * Validate and parse gate settings
   */
  private validateAndParseSettings(settings: any): VersionGateSettings {
    const defaults: VersionGateSettings = {
      enforceSemanticVersioning: true,
      checkBackwardCompatibility: true,
      validateMigrations: false,
      versionBumpValidation: {
        requireVersionBump: false,
        allowedBumpTypes: ['major', 'minor', 'patch', 'prerelease'],
        autoDetectBumpType: true,
        bumpRules: [
          {
            pattern: /BREAKING\s+CHANGE/i,
            bumpType: 'major',
            description: 'Breaking change requires major version bump'
          },
          {
            pattern: /feat[(:]/i,
            bumpType: 'minor',
            description: 'New feature requires minor version bump'
          },
          {
            pattern: /fix[(:]/i,
            bumpType: 'patch',
            description: 'Bug fix requires patch version bump'
          }
        ]
      },
      packageFiles: ['package.json', 'pyproject.toml', 'setup.py', 'Cargo.toml'],
      migrationDirectories: ['migrations/', 'db/migrate/', 'src/migrations/'],
      changelogRequirements: {
        requireChangelog: false,
        changelogPath: 'CHANGELOG.md',
        format: 'keepachangelog',
        requireCurrentVersionEntry: false
      },
      apiCompatibility: {
        enabled: false,
        specFiles: ['openapi.yaml', 'swagger.json'],
        allowedBreakingChanges: [],
        tools: []
      },
      tagRequirements: {
        requireTags: false,
        tagPattern: 'v{version}',
        requireSignedTags: false,
        tagMessageRequirements: []
      }
    };

    return { ...defaults, ...settings };
  }

  /**
   * Create error result
   */
  private createErrorResult(
    gate: GateConfiguration,
    error: Error,
    startTime: Date,
    endTime: Date
  ): GateResult {
    return {
      gateId: gate.id,
      name: gate.name,
      status: GateStatus.ERROR,
      startTime,
      endTime,
      duration: endTime.getTime() - startTime.getTime(),
      details: {
        summary: `Version gate error: ${error.message}`,
        findings: [{
          severity: 'error',
          category: 'execution',
          message: error.message,
          rule: 'gate-execution'
        }],
        recommendations: ['Check version configuration and ensure package files are accessible'],
        reportUrls: []
      },
      error: {
        code: 'VERSION_ERROR',
        message: error.message,
        details: error.stack
      },
      metrics: {}
    };
  }
}
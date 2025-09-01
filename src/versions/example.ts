/**
 * Example usage of the version management system
 * Demonstrates key features and workflows
 */

import {
  VersionManager,
  SemverUtils,
  VersionAnalyzer,
  MigrationManager,
  CompatibilityManager,
  parseVersion,
  formatVersion,
  createVersionManager,
} from './index.js';
import { ContractDefinition } from '../contracts/types.js';
import { logger } from '../utils/logger.js';

/**
 * Example: Basic version management workflow
 */
export async function basicVersionManagement() {
  console.log('=== Basic Version Management Example ===\n');

  // Create version manager with custom config
  const versionManager = createVersionManager({
    defaultBumpType: 'minor',
    gitIntegration: {
      enabled: true,
      tagPrefix: 'v',
      createTags: true,
      pushTags: false,
    },
    strictCompatibility: true,
  });

  // Get current version (will be 0.1.0 initially)
  const currentVersion = versionManager.getCurrentVersion();
  console.log(`Current version: ${formatVersion(currentVersion)}`);

  // Example contracts for version 1.0.0
  const contractsV1: ContractDefinition[] = [
    {
      id: 'user_service',
      name: 'User Service Contract',
      description: 'Contract for user management operations',
      version: '1.0.0',
      target: 'UserService',
      inputSchema: {
        type: 'object',
        properties: {
          userId: { type: 'string' },
          email: { type: 'string', format: 'email' },
        },
        required: ['userId'],
      },
      outputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          email: { type: 'string' },
          name: { type: 'string' },
        },
        required: ['id'],
      },
      preConditions: [
        {
          name: 'valid_user_id',
          description: 'User ID must be non-empty',
          expression: 'userId != ""',
          severity: 'error',
        },
      ],
      postConditions: [
        {
          name: 'user_exists',
          description: 'User must exist after operation',
          expression: 'id != ""',
          severity: 'error',
        },
      ],
      metamorphicLaws: [],
      invariants: [],
      metadata: {},
      tags: ['user', 'service'],
    },
  ];

  // Execute version bump
  const bumpResult = await versionManager.bumpVersion(
    contractsV1,
    'system',
    'Initial release with user service contract'
  );

  console.log(`Bumped to version: ${formatVersion(bumpResult.version)}`);
  console.log(`Changes: ${bumpResult.changes.length}`);
  console.log(`Migration required: ${bumpResult.migrationPath ? 'Yes' : 'No'}\n`);

  return { versionManager, contractsV1 };
}

/**
 * Example: Breaking change analysis and migration
 */
export async function breakingChangeExample() {
  console.log('=== Breaking Change Analysis Example ===\n');

  const { versionManager, contractsV1 } = await basicVersionManagement();

  // Updated contracts with breaking changes
  const contractsV2: ContractDefinition[] = [
    {
      ...contractsV1[0],
      version: '2.0.0',
      // Breaking change: remove email from input, add required name field
      inputSchema: {
        type: 'object',
        properties: {
          userId: { type: 'string' },
          name: { type: 'string', minLength: 1 }, // New required field
        },
        required: ['userId', 'name'], // name is now required
      },
      // Breaking change: change output structure
      outputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          fullName: { type: 'string' }, // renamed from 'name'
          profile: { // new nested object
            type: 'object',
            properties: {
              email: { type: 'string' },
            },
          },
        },
        required: ['id', 'fullName'],
      },
    },
  ];

  // Analyze changes
  const analysis = versionManager.analyzeChanges(contractsV1, contractsV2);
  console.log(`Analysis results:`);
  console.log(`  Current version: ${formatVersion(analysis.currentVersion)}`);
  console.log(`  Next version: ${formatVersion(analysis.nextVersion)}`);
  console.log(`  Bump type: ${analysis.bumpType}`);
  console.log(`  Changes: ${analysis.changes.length}`);
  console.log(`  Migration required: ${analysis.migrationRequired}`);
  console.log(`  Reason: ${analysis.reason}\n`);

  // Show breaking changes
  const breakingChanges = analysis.changes.filter(c => c.impact === 'breaking');
  if (breakingChanges.length > 0) {
    console.log('Breaking changes detected:');
    for (const change of breakingChanges) {
      console.log(`  - ${change.description} (${change.path})`);
    }
    console.log();
  }

  // Execute the version bump with migration
  const bumpResult = await versionManager.bumpVersion(
    contractsV2,
    'developer',
    'Major update with breaking schema changes'
  );

  if (bumpResult.migrationPath) {
    console.log(`Migration path generated: ${bumpResult.migrationPath.id}`);
    console.log(`Migration complexity: ${bumpResult.migrationPath.complexity}`);
    console.log(`Estimated duration: ${bumpResult.migrationPath.estimatedDuration}`);
    console.log(`Steps: ${bumpResult.migrationPath.steps.length}`);
    
    if (bumpResult.migrationPath.risks.length > 0) {
      console.log('Migration risks:');
      for (const risk of bumpResult.migrationPath.risks) {
        console.log(`  - ${risk}`);
      }
    }
  }

  return { versionManager, contractsV2, analysis };
}

/**
 * Example: Compatibility checking and migration execution
 */
export async function compatibilityExample() {
  console.log('\n=== Compatibility Checking Example ===\n');

  const { versionManager, contractsV2 } = await breakingChangeExample();

  const v100 = parseVersion('1.0.0');
  const v200 = parseVersion('2.0.0');

  // Check compatibility between versions
  const compatibility = versionManager.checkCompatibility(v100, v200, contractsV2);
  
  console.log(`Compatibility check (${formatVersion(v100)} -> ${formatVersion(v200)}):`);
  console.log(`  Compatible: ${compatibility.compatible}`);
  console.log(`  Migration required: ${compatibility.migrationRequired}`);
  console.log(`  Warnings: ${compatibility.warnings.length}`);
  console.log(`  Breaking changes: ${compatibility.breakingChanges.length}\n`);

  if (compatibility.warnings.length > 0) {
    console.log('Compatibility warnings:');
    for (const warning of compatibility.warnings) {
      console.log(`  - ${warning}`);
    }
    console.log();
  }

  if (compatibility.breakingChanges.length > 0) {
    console.log('Breaking changes:');
    for (const change of compatibility.breakingChanges) {
      console.log(`  - ${change}`);
    }
    console.log();
  }

  // Execute migration (dry run)
  if (compatibility.migrationRequired && compatibility.migrationPath) {
    console.log('Executing migration (dry run)...');
    const migrationResult = await versionManager.migrate(v100, v200, contractsV2, true);
    
    console.log(`Migration dry run result:`);
    console.log(`  Success: ${migrationResult.success}`);
    if (migrationResult.error) {
      console.log(`  Error: ${migrationResult.error}`);
    }
    if (migrationResult.completedSteps) {
      console.log(`  Completed steps: ${migrationResult.completedSteps.length}`);
    }
  }
}

/**
 * Example: Version history and rollback
 */
export async function versionHistoryExample() {
  console.log('\n=== Version History and Rollback Example ===\n');

  const { versionManager } = await compatibilityExample();

  // Get version history
  const history = versionManager.getVersionHistory();
  console.log(`Version history (${history.length} versions):`);
  
  for (const entry of history) {
    console.log(`  ${formatVersion(entry.version)} - ${entry.message} (${entry.changes.length} changes)`);
  }
  console.log();

  // Update config to allow rollbacks
  versionManager.updateConfig({ allowDowngrade: true });

  // Rollback to v1.0.0 (example scenario)
  const v100 = parseVersion('1.0.0');
  try {
    const rollbackResult = await versionManager.rollback(v100, 'Testing rollback functionality');
    
    if (rollbackResult.success) {
      console.log(`Rollback successful:`);
      console.log(`  Rolled back from: ${formatVersion(rollbackResult.rolledBackFrom)}`);
      console.log(`  Rolled back to: ${formatVersion(v100)}`);
    }
  } catch (error) {
    console.log(`Rollback failed: ${error instanceof Error ? error.message : error}`);
  }
}

/**
 * Example: Advanced semver operations
 */
export function semverOperationsExample() {
  console.log('\n=== Semantic Version Operations Example ===\n');

  // Parse and format versions
  const v1 = parseVersion('1.2.3');
  const v2 = parseVersion('1.3.0-alpha.1');
  const v3 = parseVersion('2.0.0+build.123');

  console.log(`Parsed versions:`);
  console.log(`  v1: ${formatVersion(v1)} (stable: ${SemverUtils.isStable(v1)})`);
  console.log(`  v2: ${formatVersion(v2)} (stable: ${SemverUtils.isStable(v2)})`);
  console.log(`  v3: ${formatVersion(v3)} (stable: ${SemverUtils.isStable(v3)})`);
  console.log();

  // Version comparisons
  console.log('Version comparisons:');
  console.log(`  ${formatVersion(v1)} < ${formatVersion(v2)}: ${SemverUtils.lt(v1, v2)}`);
  console.log(`  ${formatVersion(v2)} < ${formatVersion(v3)}: ${SemverUtils.lt(v2, v3)}`);
  console.log(`  ${formatVersion(v1)} == ${formatVersion(v1)}: ${SemverUtils.eq(v1, v1)}`);
  console.log();

  // Version increments
  console.log('Version increments:');
  console.log(`  ${formatVersion(v1)} -> major: ${formatVersion(SemverUtils.increment(v1, 'major'))}`);
  console.log(`  ${formatVersion(v1)} -> minor: ${formatVersion(SemverUtils.increment(v1, 'minor'))}`);
  console.log(`  ${formatVersion(v1)} -> patch: ${formatVersion(SemverUtils.increment(v1, 'patch'))}`);
  console.log(`  ${formatVersion(v1)} -> prerelease: ${formatVersion(SemverUtils.increment(v1, 'prerelease'))}`);
  console.log();

  // Version ranges and constraints
  const versions = [v1, v2, v3, parseVersion('0.9.0'), parseVersion('1.2.4')];
  const sortedVersions = SemverUtils.sort(versions);
  
  console.log('Sorted versions:');
  for (const version of sortedVersions) {
    console.log(`  ${formatVersion(version)}`);
  }
  console.log();

  // Range satisfaction
  const constraint = SemverUtils.createConstraint('^1.2.0');
  console.log(`Constraint: ${constraint.range} (${constraint.description})`);
  console.log('Versions satisfying ^1.2.0:');
  
  for (const version of versions) {
    const satisfies = constraint.satisfies(version);
    console.log(`  ${formatVersion(version)}: ${satisfies ? 'YES' : 'NO'}`);
  }
}

/**
 * Example: Schema comparison and analysis
 */
export function schemaAnalysisExample() {
  console.log('\n=== Schema Analysis Example ===\n');

  const sourceSchema = {
    type: 'object',
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      email: { type: 'string', format: 'email' },
      age: { type: 'integer', minimum: 0 },
    },
    required: ['id', 'name'],
  };

  const targetSchema = {
    type: 'object',
    properties: {
      id: { type: 'string' },
      fullName: { type: 'string', minLength: 1 }, // renamed and added constraint
      email: { type: 'string', format: 'email' },
      age: { type: 'integer', minimum: 0, maximum: 150 }, // added maximum
      profile: { // new field
        type: 'object',
        properties: {
          bio: { type: 'string' },
        },
      },
    },
    required: ['id', 'fullName', 'email'], // email now required
  };

  const comparison = VersionAnalyzer.analyzeSchemaChanges(sourceSchema, targetSchema);
  
  console.log(`Schema comparison:`);
  console.log(`  Compatible: ${comparison.compatible}`);
  console.log(`  Differences: ${comparison.differences.length}`);
  console.log(`  Breaking changes: ${comparison.breakingChanges.length}`);
  console.log();

  if (comparison.differences.length > 0) {
    console.log('Schema differences:');
    for (const diff of comparison.differences) {
      console.log(`  ${diff.path}: ${diff.type} (${diff.impact}) - ${diff.description}`);
    }
    console.log();
  }

  if (comparison.breakingChanges.length > 0) {
    console.log('Breaking changes:');
    for (const change of comparison.breakingChanges) {
      console.log(`  ${change.path}: ${change.description} (${change.severity})`);
    }
  }
}

/**
 * Run all examples
 */
export async function runAllExamples() {
  try {
    await basicVersionManagement();
    await breakingChangeExample();
    await compatibilityExample();
    await versionHistoryExample();
    semverOperationsExample();
    schemaAnalysisExample();
    
    console.log('\n=== All Examples Completed Successfully ===');
  } catch (error) {
    logger.error('Example execution failed', error);
    console.error('Example execution failed:', error);
  }
}

// Run examples if this file is executed directly
if (import.meta.main) {
  runAllExamples().catch(console.error);
}
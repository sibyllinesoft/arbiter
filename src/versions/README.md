# Arbiter Version Management System

A comprehensive semantic versioning system for CUE schemas and contracts with automated breaking change detection, migration generation, and compatibility analysis.

## Features

- **Semantic Versioning (SemVer)**: Full semantic versioning support with parsing, comparison, and constraint handling
- **Automated Change Analysis**: Intelligent detection of breaking vs. non-breaking changes in CUE schemas
- **Migration Generation**: Automated generation of migration scripts for breaking changes
- **Compatibility Matrices**: Track version compatibility and support windows
- **Contract Integration**: Deep integration with arbiter's contract execution engine
- **Git Integration**: Automated git tagging and version tracking
- **CLI Support**: Integration with arbiter CLI for version management operations

## Components

### Core Classes

- **`VersionManager`**: Main orchestrator for all version management operations
- **`SemverUtils`**: Comprehensive semantic versioning utilities
- **`VersionAnalyzer`**: Change analysis and compatibility checking
- **`MigrationManager`**: Migration path generation and execution
- **`CompatibilityManager`**: Version compatibility matrix management

### Key Types

- **`SemanticVersion`**: Structured version representation
- **`VersionChange`**: Detailed change description with impact analysis
- **`MigrationPath`**: Step-by-step migration instructions
- **`CompatibilityMatrix`**: Version compatibility relationships

## Quick Start

```typescript
import { createVersionManager, parseVersion } from './versions/index.js';
import { ContractDefinition } from './contracts/types.js';

// Create version manager
const versionManager = createVersionManager({
  defaultBumpType: 'minor',
  strictCompatibility: true,
  gitIntegration: {
    enabled: true,
    createTags: true,
  },
});

// Analyze changes and bump version
const contracts: ContractDefinition[] = [/* your contracts */];
const result = await versionManager.bumpVersion(
  contracts,
  'developer',
  'Added new user validation contract'
);

console.log(`New version: ${result.version}`);
```

## Usage Examples

### Basic Version Management

```typescript
import { VersionManager } from './versions/manager.js';

const manager = new VersionManager();

// Get current version
const current = manager.getCurrentVersion(); // { major: 0, minor: 1, patch: 0 }

// Analyze changes
const analysis = manager.analyzeChanges(oldContracts, newContracts);
console.log(`Recommended bump: ${analysis.bumpType}`);

// Execute version bump
const result = await manager.bumpVersion(newContracts, 'author', 'Change description');
```

### Semantic Version Operations

```typescript
import { SemverUtils, parseVersion } from './versions/index.js';

const version1 = parseVersion('1.2.3');
const version2 = parseVersion('2.0.0-alpha.1');

// Comparisons
console.log(SemverUtils.gt(version2, version1)); // true
console.log(SemverUtils.isStable(version1)); // true
console.log(SemverUtils.isPrerelease(version2)); // true

// Increments
const major = SemverUtils.increment(version1, 'major'); // 2.0.0
const minor = SemverUtils.increment(version1, 'minor'); // 1.3.0
const patch = SemverUtils.increment(version1, 'patch'); // 1.2.4

// Constraints
const constraint = SemverUtils.createConstraint('^1.2.0');
console.log(constraint.satisfies(version1)); // true
```

### Change Analysis

```typescript
import { VersionAnalyzer } from './versions/analyzer.js';

// Analyze contract changes
const comparison = VersionAnalyzer.analyzeContractChanges(
  sourceContract,
  targetContract
);

console.log(`Compatible: ${comparison.compatible}`);
console.log(`Migration required: ${comparison.migrationRequired}`);

// Schema-level analysis
const schemaComparison = VersionAnalyzer.analyzeSchemaChanges(
  sourceSchema,
  targetSchema
);

console.log(`Breaking changes: ${schemaComparison.breakingChanges.length}`);
```

### Migration Management

```typescript
import { MigrationManager } from './versions/migration.js';

// Generate migration path
const migrationPath = MigrationManager.generateMigrationPath(
  fromVersion,
  toVersion,
  breakingChanges,
  sourceContracts,
  targetContracts
);

console.log(`Migration complexity: ${migrationPath.complexity}`);
console.log(`Estimated duration: ${migrationPath.estimatedDuration}`);

// Execute migration (dry run)
const result = await MigrationManager.executeMigration(migrationPath, true);
console.log(`Dry run success: ${result.success}`);

// Execute actual migration
if (result.success) {
  const actualResult = await MigrationManager.executeMigration(migrationPath, false);
  if (!actualResult.success && actualResult.rollbackRequired) {
    await MigrationManager.rollbackMigration(migrationPath, actualResult.completedSteps);
  }
}
```

### Compatibility Checking

```typescript
import { CompatibilityManager } from './versions/compatibility.js';

const compatManager = new CompatibilityManager();

// Build compatibility matrix
const matrix = compatManager.buildCompatibilityMatrix(
  sourceVersion,
  allVersions,
  versionContractsMap
);

// Check upgrade safety
const safety = compatManager.isUpgradeSafe(fromVersion, toVersion, contracts);
console.log(`Safe to upgrade: ${safety.safe}`);
console.log(`Warnings: ${safety.warnings.length}`);

// Get upgrade path recommendations
const path = compatManager.getRecommendedUpgradePath(currentVersion, targetVersion);
console.log(`Direct upgrade: ${path.directUpgrade}`);
console.log(`Intermediate versions: ${path.intermediateVersions.length}`);
```

## Breaking Change Detection

The system automatically detects various types of breaking changes:

### Schema Changes
- **Type Changes**: `string` → `number`
- **Required Fields**: Making optional field required
- **Field Removal**: Removing existing fields
- **Constraint Tightening**: More restrictive validation rules
- **Enum Value Removal**: Removing valid enum options

### Contract Changes
- **Input/Output Schema**: Breaking changes to contract interfaces
- **Preconditions**: New or modified preconditions
- **Postconditions**: Removal or modification of postconditions
- **Metamorphic Laws**: Changes to metamorphic properties
- **Invariants**: Addition or modification of invariants

### Impact Classification
- **Breaking**: Requires major version bump, may break existing implementations
- **Feature**: New functionality, minor version bump
- **Fix**: Bug fixes, patch version bump
- **None**: No functional impact

## Migration System

### Migration Path Generation

The system generates comprehensive migration paths with:

1. **Backup Step**: Full backup of contracts and data
2. **Schema Transform**: Transform schemas to new structure
3. **Contract Update**: Update contract definitions
4. **Data Migration**: Transform existing data
5. **Verification**: Validate migration success
6. **Cleanup**: Remove temporary files

### Migration Complexity

- **Simple**: Automated, low risk, < 30 minutes
- **Moderate**: Semi-automated, medium risk, < 2 hours
- **Complex**: Manual intervention required, high risk, < 8 hours
- **Critical**: Extensive planning required, critical risk, > 8 hours

### Rollback Support

Every migration step includes rollback capabilities:
- **Script-based rollback**: Automated rollback scripts
- **Data preservation**: Backup-based data restoration
- **Risk assessment**: Data loss risk evaluation
- **Dependency tracking**: Rollback order management

## Configuration

```typescript
interface VersionManagerConfig {
  defaultBumpType: 'major' | 'minor' | 'patch';
  prereleaseTags: string[];
  migrationTimeout: number;
  maxSupportedVersions: number;
  autoMigration: boolean;
  strictCompatibility: boolean;
  allowDowngrade: boolean;
  gitIntegration: {
    enabled: boolean;
    tagPrefix: string;
    createTags: boolean;
    pushTags: boolean;
    branch?: string;
  };
}
```

## CLI Integration

The version management system integrates with the arbiter CLI:

```bash
# Analyze current changes
arbiter version analyze

# Bump version automatically
arbiter version bump --type minor --message "Added new validation rules"

# Check compatibility
arbiter version check --from 1.0.0 --to 2.0.0

# Generate migration
arbiter version migrate --from 1.0.0 --to 2.0.0 --dry-run

# Execute migration
arbiter version migrate --from 1.0.0 --to 2.0.0

# Rollback version
arbiter version rollback --to 1.0.0 --reason "Critical bug found"

# Show version history
arbiter version history --limit 10

# Export version data
arbiter version export --output versions.json

# Import version data
arbiter version import --input versions.json
```

## Error Handling

The system provides comprehensive error handling:

- **`VersionError`**: General version-related errors
- **`VersionParsingError`**: Invalid version format
- **`VersionCompatibilityError`**: Compatibility violations
- **`MigrationError`**: Migration execution failures
- **`MigrationValidationError`**: Migration validation failures
- **`MigrationRollbackError`**: Rollback failures

## Integration with Arbiter Ecosystem

### Contract Engine Integration
- Validates version compatibility with contract execution
- Ensures contracts meet version requirements
- Provides version-aware contract loading

### Schema Validation
- Integrates with CUE schema validation
- Provides version-specific schema enforcement
- Supports schema evolution tracking

### Build System Integration
- Integrates with build pipelines for automated versioning
- Supports CI/CD version validation
- Provides quality gates for version bumps

## Best Practices

### Version Bumping
1. **Always analyze changes** before bumping versions
2. **Use semantic versioning** consistently
3. **Test migrations** in staging environments
4. **Document breaking changes** with migration guides
5. **Maintain compatibility matrices** for supported versions

### Migration Management
1. **Create comprehensive backups** before migrations
2. **Test rollback procedures** before production deployment
3. **Use step-by-step migrations** for complex changes
4. **Validate each migration step** before proceeding
5. **Monitor system health** during and after migrations

### Schema Evolution
1. **Make additive changes** when possible
2. **Deprecate before removing** features
3. **Provide migration paths** for breaking changes
4. **Use feature flags** for gradual rollouts
5. **Maintain backward compatibility** within major versions

## Performance Considerations

- **Lazy loading**: Version history loaded on demand
- **Caching**: Compatibility matrices cached for performance
- **Parallel analysis**: Contract analysis parallelized when possible
- **Memory management**: Large version datasets handled efficiently
- **Streaming**: Large migration operations use streaming

## Security Considerations

- **Input validation**: All version strings validated before parsing
- **Migration safety**: All migrations include safety checks
- **Backup verification**: Backups verified before migrations
- **Access control**: Version management operations logged
- **Rollback protection**: Critical rollbacks require confirmation

## Troubleshooting

### Common Issues

1. **Version parsing fails**: Check version string format
2. **Migration hangs**: Check migration timeout settings
3. **Compatibility errors**: Review breaking change analysis
4. **Rollback fails**: Check backup integrity and permissions
5. **Performance slow**: Review cache settings and data size

### Debug Options

```typescript
// Enable debug logging
const manager = new VersionManager({
  // ... config
});

// Set debug environment
process.env.DEBUG = 'arbiter:version*';

// Export debug data
const debugData = manager.export();
console.log(JSON.stringify(debugData, null, 2));
```

## Contributing

To contribute to the version management system:

1. Follow existing code patterns and TypeScript conventions
2. Add comprehensive tests for new functionality
3. Update documentation for API changes
4. Consider backward compatibility impact
5. Test with real-world contract scenarios

## Examples

See `example.ts` for comprehensive usage examples including:
- Basic version management workflows
- Breaking change analysis
- Migration execution
- Compatibility checking
- Schema comparison
- Error handling scenarios
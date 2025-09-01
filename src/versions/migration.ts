/**
 * Migration system for handling schema and contract version changes
 * Generates migration scripts for breaking changes with rollback capabilities
 */

import {
  SemanticVersion,
  MigrationPath,
  MigrationStep,
  MigrationStepType,
  MigrationComplexity,
  MigrationOperation,
  MigrationValidation,
  MigrationRollback,
  MigrationTestCase,
  BreakingChange,
  ContractComparison,
  ValidationRule,
  SchemaChange,
} from './types.js';
import { ContractDefinition, CueSchema } from '../contracts/types.js';
import { SemverUtils } from './semver.js';
import { VersionAnalyzer } from './analyzer.js';
import { logger } from '../utils/logger.js';

export class MigrationManager {
  /**
   * Generate migration path between two versions
   */
  static generateMigrationPath(
    fromVersion: SemanticVersion,
    toVersion: SemanticVersion,
    breakingChanges: BreakingChange[],
    sourceContracts: ContractDefinition[],
    targetContracts: ContractDefinition[]
  ): MigrationPath {
    logger.info(`Generating migration path: ${SemverUtils.format(fromVersion)} -> ${SemverUtils.format(toVersion)}`);

    const migrationId = `migration_${SemverUtils.format(fromVersion)}_to_${SemverUtils.format(toVersion)}`;
    const steps: MigrationStep[] = [];
    const risks: string[] = [];
    const prerequisites: string[] = [];

    // Analyze complexity
    const complexity = this.assessMigrationComplexity(breakingChanges);
    
    // Generate backup step
    steps.push(this.generateBackupStep());

    // Generate validation steps for contracts
    for (const contract of sourceContracts) {
      const targetContract = targetContracts.find(c => c.id === contract.id);
      if (targetContract) {
        const contractMigrationSteps = this.generateContractMigrationSteps(
          contract,
          targetContract,
          breakingChanges.filter(bc => bc.path.startsWith(contract.id))
        );
        steps.push(...contractMigrationSteps);
      }
    }

    // Generate verification step
    steps.push(this.generateVerificationStep(targetContracts));

    // Generate cleanup step
    steps.push(this.generateCleanupStep());

    // Assess risks
    if (breakingChanges.some(bc => bc.severity === 'critical')) {
      risks.push('Critical breaking changes may cause data loss or system failures');
    }
    if (breakingChanges.some(bc => bc.type === 'contract_removed')) {
      risks.push('Contract removal may break existing integrations');
    }

    // Determine prerequisites
    prerequisites.push('Full database backup');
    prerequisites.push('All tests passing');
    if (complexity === 'complex' || complexity === 'critical') {
      prerequisites.push('Maintenance window scheduled');
      prerequisites.push('Rollback plan tested');
    }

    const estimatedDuration = this.estimateMigrationDuration(complexity, steps.length);

    return {
      id: migrationId,
      fromVersion,
      toVersion,
      steps,
      automated: complexity === 'simple',
      complexity,
      estimatedDuration,
      prerequisites,
      risks,
    };
  }

  /**
   * Generate migration steps for a specific contract
   */
  private static generateContractMigrationSteps(
    sourceContract: ContractDefinition,
    targetContract: ContractDefinition,
    contractBreakingChanges: BreakingChange[]
  ): MigrationStep[] {
    const steps: MigrationStep[] = [];

    // Analyze contract changes
    const comparison = VersionAnalyzer.analyzeContractChanges(sourceContract, targetContract);

    if (!comparison.compatible) {
      // Schema migration step
      if (this.hasSchemaChanges(comparison)) {
        steps.push(this.generateSchemaMigrationStep(sourceContract, targetContract, comparison));
      }

      // Contract update step
      steps.push(this.generateContractUpdateStep(sourceContract, targetContract, comparison));

      // Data migration step (if needed)
      if (this.requiresDataMigration(comparison)) {
        steps.push(this.generateDataMigrationStep(sourceContract, targetContract, comparison));
      }
    }

    return steps;
  }

  /**
   * Generate schema transformation step
   */
  private static generateSchemaMigrationStep(
    sourceContract: ContractDefinition,
    targetContract: ContractDefinition,
    comparison: ContractComparison
  ): MigrationStep {
    const stepId = `schema_transform_${sourceContract.id}`;
    const schemaChanges: SchemaChange[] = [];

    // Generate schema changes from differences
    for (const diff of comparison.differences) {
      if (diff.section === 'input' || diff.section === 'output') {
        schemaChanges.push({
          path: diff.path,
          operation: diff.type === 'added' ? 'add' : diff.type === 'removed' ? 'remove' : 'modify',
          before: diff.type !== 'added' ? diff.details : undefined,
          after: diff.type !== 'removed' ? diff.details : undefined,
          preserveData: diff.impact !== 'breaking',
        });
      }
    }

    const validationRules: ValidationRule[] = [
      {
        name: 'schema_compatibility',
        expression: 'schema_validates_against_target',
        errorMessage: 'Schema transformation failed validation',
        severity: 'error',
      },
      {
        name: 'data_preservation',
        expression: 'no_data_loss_detected',
        errorMessage: 'Data loss detected during schema transformation',
        severity: 'error',
      },
    ];

    const testCases: MigrationTestCase[] = this.generateSchemaTestCases(
      sourceContract,
      targetContract,
      schemaChanges
    );

    return {
      id: stepId,
      name: `Transform schema for contract ${sourceContract.id}`,
      description: `Migrate schema from ${sourceContract.version} to ${targetContract.version}`,
      type: 'schema_transform',
      operation: {
        schemaChanges,
        contracts: [sourceContract.id],
        transform: this.generateSchemaTransformFunction(schemaChanges),
      },
      validation: {
        rules: validationRules,
        postconditions: [
          'schema_is_valid',
          'existing_data_migrated',
          'no_validation_errors',
        ],
        testCases,
      },
      rollback: {
        possible: true,
        script: this.generateSchemaRollbackScript(sourceContract, schemaChanges),
        warnings: schemaChanges.some(sc => !sc.preserveData) 
          ? ['Some schema changes may result in data loss on rollback']
          : [],
        dataLossRisk: schemaChanges.some(sc => sc.operation === 'remove' && !sc.preserveData),
      },
      dependencies: [],
    };
  }

  /**
   * Generate contract update step
   */
  private static generateContractUpdateStep(
    sourceContract: ContractDefinition,
    targetContract: ContractDefinition,
    comparison: ContractComparison
  ): MigrationStep {
    const stepId = `contract_update_${sourceContract.id}`;

    const validationRules: ValidationRule[] = [
      {
        name: 'contract_syntax_valid',
        expression: 'contract_parses_successfully',
        errorMessage: 'Contract syntax validation failed',
        severity: 'error',
      },
      {
        name: 'contract_conditions_valid',
        expression: 'all_conditions_validate',
        errorMessage: 'Contract condition validation failed',
        severity: 'error',
      },
    ];

    return {
      id: stepId,
      name: `Update contract ${sourceContract.id}`,
      description: `Update contract conditions, laws, and invariants`,
      type: 'contract_update',
      operation: {
        contracts: [sourceContract.id],
        script: this.generateContractUpdateScript(sourceContract, targetContract, comparison),
      },
      validation: {
        rules: validationRules,
        postconditions: [
          'contract_is_valid',
          'conditions_are_satisfiable',
          'laws_are_consistent',
          'invariants_are_maintained',
        ],
      },
      rollback: {
        possible: true,
        script: this.generateContractRollbackScript(sourceContract),
        warnings: ['Rolling back contract changes may affect dependent contracts'],
        dataLossRisk: false,
      },
      dependencies: [`schema_transform_${sourceContract.id}`],
    };
  }

  /**
   * Generate data migration step
   */
  private static generateDataMigrationStep(
    sourceContract: ContractDefinition,
    targetContract: ContractDefinition,
    comparison: ContractComparison
  ): MigrationStep {
    const stepId = `data_migration_${sourceContract.id}`;

    const validationRules: ValidationRule[] = [
      {
        name: 'data_integrity',
        expression: 'data_integrity_maintained',
        errorMessage: 'Data integrity check failed',
        severity: 'error',
      },
      {
        name: 'migration_completeness',
        expression: 'all_data_migrated',
        errorMessage: 'Data migration incomplete',
        severity: 'error',
      },
    ];

    return {
      id: stepId,
      name: `Migrate data for contract ${sourceContract.id}`,
      description: `Transform existing data to match new schema requirements`,
      type: 'data_migration',
      operation: {
        contracts: [sourceContract.id],
        script: this.generateDataMigrationScript(sourceContract, targetContract, comparison),
        transform: this.generateDataTransformFunction(comparison),
      },
      validation: {
        rules: validationRules,
        postconditions: [
          'data_transformed_successfully',
          'no_data_corruption',
          'referential_integrity_maintained',
        ],
      },
      rollback: {
        possible: true,
        script: this.generateDataRollbackScript(sourceContract),
        warnings: ['Data rollback may not be possible if destructive operations occurred'],
        dataLossRisk: true,
      },
      dependencies: [`contract_update_${sourceContract.id}`],
    };
  }

  /**
   * Generate backup step
   */
  private static generateBackupStep(): MigrationStep {
    return {
      id: 'backup',
      name: 'Create backup',
      description: 'Create full backup of contracts and data before migration',
      type: 'verification',
      operation: {
        script: `
          # Create timestamped backup
          BACKUP_DIR="./backups/migration_$(date +%Y%m%d_%H%M%S)"
          mkdir -p "$BACKUP_DIR"
          
          # Backup contracts
          cp -r ./contracts "$BACKUP_DIR/"
          
          # Backup data
          if [ -f "./data.db" ]; then
            cp "./data.db" "$BACKUP_DIR/"
          fi
          
          # Create backup manifest
          echo "Backup created: $(date)" > "$BACKUP_DIR/manifest.txt"
          echo "Migration: $FROM_VERSION -> $TO_VERSION" >> "$BACKUP_DIR/manifest.txt"
          
          echo "Backup created at: $BACKUP_DIR"
        `,
      },
      validation: {
        rules: [
          {
            name: 'backup_exists',
            expression: 'backup_directory_created',
            errorMessage: 'Backup creation failed',
            severity: 'error',
          },
        ],
        postconditions: ['backup_verified', 'backup_complete'],
      },
      rollback: {
        possible: false,
        warnings: [],
        dataLossRisk: false,
      },
      dependencies: [],
    };
  }

  /**
   * Generate verification step
   */
  private static generateVerificationStep(targetContracts: ContractDefinition[]): MigrationStep {
    return {
      id: 'verification',
      name: 'Verify migration',
      description: 'Verify all contracts and data after migration',
      type: 'verification',
      operation: {
        contracts: targetContracts.map(c => c.id),
        script: `
          # Verify all contracts
          echo "Verifying contracts..."
          arbiter validate --all
          
          # Run contract tests
          echo "Running contract tests..."
          arbiter test --all
          
          # Verify data integrity
          echo "Verifying data integrity..."
          arbiter verify --data
          
          echo "Migration verification complete"
        `,
      },
      validation: {
        rules: [
          {
            name: 'all_contracts_valid',
            expression: 'validation_passes_for_all_contracts',
            errorMessage: 'Contract validation failed after migration',
            severity: 'error',
          },
          {
            name: 'all_tests_pass',
            expression: 'test_suite_passes',
            errorMessage: 'Tests failed after migration',
            severity: 'error',
          },
        ],
        postconditions: [
          'contracts_validated',
          'tests_passed',
          'data_integrity_verified',
        ],
      },
      rollback: {
        possible: false,
        warnings: [],
        dataLossRisk: false,
      },
      dependencies: [], // Will be set based on other steps
    };
  }

  /**
   * Generate cleanup step
   */
  private static generateCleanupStep(): MigrationStep {
    return {
      id: 'cleanup',
      name: 'Cleanup',
      description: 'Remove temporary files and old schema versions',
      type: 'cleanup',
      operation: {
        script: `
          # Remove temporary migration files
          rm -rf ./temp/migration_*
          
          # Archive old schema versions
          mkdir -p ./archive
          mv ./schemas/old_* ./archive/ 2>/dev/null || true
          
          # Update version references
          echo "Migration cleanup complete"
        `,
      },
      validation: {
        rules: [
          {
            name: 'cleanup_complete',
            expression: 'temporary_files_removed',
            errorMessage: 'Cleanup failed',
            severity: 'warning',
          },
        ],
        postconditions: ['temporary_files_cleaned', 'archives_organized'],
      },
      rollback: {
        possible: true,
        script: '# Restore archived files if needed\ncp -r ./archive/* ./schemas/ 2>/dev/null || true',
        warnings: [],
        dataLossRisk: false,
      },
      dependencies: ['verification'],
    };
  }

  /**
   * Execute migration path
   */
  static async executeMigration(
    migrationPath: MigrationPath,
    dryRun: boolean = false
  ): Promise<{
    success: boolean;
    completedSteps: string[];
    failedStep?: string;
    error?: string;
    rollbackRequired?: boolean;
  }> {
    logger.info(`${dryRun ? 'Dry run: ' : ''}Executing migration: ${migrationPath.id}`);

    const completedSteps: string[] = [];
    
    try {
      for (const step of migrationPath.steps) {
        logger.debug(`Executing step: ${step.id} - ${step.name}`);
        
        if (dryRun) {
          // In dry run, just validate the step
          const valid = await this.validateStep(step);
          if (!valid) {
            throw new Error(`Step validation failed: ${step.id}`);
          }
        } else {
          // Execute the actual step
          await this.executeStep(step);
          
          // Validate postconditions
          const valid = await this.validateStepPostconditions(step);
          if (!valid) {
            throw new Error(`Step postcondition validation failed: ${step.id}`);
          }
        }
        
        completedSteps.push(step.id);
        logger.debug(`Step completed: ${step.id}`);
      }

      logger.info(`Migration ${dryRun ? 'dry run ' : ''}completed successfully: ${migrationPath.id}`);
      return { success: true, completedSteps };
      
    } catch (error) {
      const failedStep = migrationPath.steps.find(s => !completedSteps.includes(s.id))?.id;
      logger.error(`Migration failed at step: ${failedStep}`, error);
      
      return {
        success: false,
        completedSteps,
        failedStep,
        error: error instanceof Error ? error.message : String(error),
        rollbackRequired: !dryRun && completedSteps.length > 0,
      };
    }
  }

  /**
   * Rollback migration
   */
  static async rollbackMigration(
    migrationPath: MigrationPath,
    completedSteps: string[]
  ): Promise<{ success: boolean; error?: string }> {
    logger.info(`Rolling back migration: ${migrationPath.id}`);

    try {
      // Rollback in reverse order
      const stepsToRollback = migrationPath.steps
        .filter(step => completedSteps.includes(step.id))
        .reverse();

      for (const step of stepsToRollback) {
        if (step.rollback.possible) {
          logger.debug(`Rolling back step: ${step.id}`);
          await this.rollbackStep(step);
        } else {
          logger.warn(`Step ${step.id} cannot be rolled back`);
        }
      }

      logger.info(`Migration rollback completed: ${migrationPath.id}`);
      return { success: true };
      
    } catch (error) {
      logger.error('Migration rollback failed', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Helper methods
   */
  private static assessMigrationComplexity(breakingChanges: BreakingChange[]): MigrationComplexity {
    if (breakingChanges.length === 0) return 'simple';
    if (breakingChanges.some(bc => bc.severity === 'critical')) return 'critical';
    if (breakingChanges.length > 10 || breakingChanges.some(bc => bc.type === 'contract_removed')) return 'complex';
    if (breakingChanges.length > 3) return 'moderate';
    return 'simple';
  }

  private static estimateMigrationDuration(complexity: MigrationComplexity, stepCount: number): string {
    const baseMinutes = stepCount * 2;
    const multiplier = {
      simple: 1,
      moderate: 2,
      complex: 4,
      critical: 8,
    }[complexity];

    const totalMinutes = baseMinutes * multiplier;
    
    if (totalMinutes < 60) return `${totalMinutes} minutes`;
    const hours = Math.ceil(totalMinutes / 60);
    return `${hours} hour${hours > 1 ? 's' : ''}`;
  }

  private static hasSchemaChanges(comparison: ContractComparison): boolean {
    return comparison.differences.some(diff => 
      diff.section === 'input' || diff.section === 'output'
    );
  }

  private static requiresDataMigration(comparison: ContractComparison): boolean {
    return comparison.differences.some(diff => 
      diff.impact === 'breaking' && (diff.section === 'input' || diff.section === 'output')
    );
  }

  private static generateSchemaTestCases(
    sourceContract: ContractDefinition,
    targetContract: ContractDefinition,
    schemaChanges: SchemaChange[]
  ): MigrationTestCase[] {
    // Generate test cases based on schema changes
    return [
      {
        name: 'basic_transformation',
        input: { /* sample data matching source schema */ },
        expectedOutput: { /* expected transformed data */ },
        contracts: [sourceContract.id],
      },
    ];
  }

  private static generateSchemaTransformFunction(schemaChanges: SchemaChange[]): (data: any) => any {
    return (data: any) => {
      let transformed = { ...data };
      
      for (const change of schemaChanges) {
        switch (change.operation) {
          case 'add':
            // Add default value for new field
            if (change.after) {
              this.setNestedProperty(transformed, change.path, this.getDefaultValue(change.after));
            }
            break;
          case 'remove':
            // Remove field
            this.deleteNestedProperty(transformed, change.path);
            break;
          case 'modify':
            // Transform field value
            const currentValue = this.getNestedProperty(transformed, change.path);
            if (currentValue !== undefined) {
              this.setNestedProperty(transformed, change.path, this.transformValue(currentValue, change));
            }
            break;
        }
      }
      
      return transformed;
    };
  }

  private static generateContractUpdateScript(
    sourceContract: ContractDefinition,
    targetContract: ContractDefinition,
    comparison: ContractComparison
  ): string {
    return `
      # Update contract ${sourceContract.id}
      echo "Updating contract ${sourceContract.id}..."
      
      # Backup current contract
      cp "./contracts/${sourceContract.id}.cue" "./contracts/${sourceContract.id}.cue.backup"
      
      # Apply contract changes
      # (This would be generated based on the specific differences)
      
      # Validate updated contract
      arbiter validate "${sourceContract.id}"
      
      echo "Contract ${sourceContract.id} updated successfully"
    `;
  }

  private static generateDataMigrationScript(
    sourceContract: ContractDefinition,
    targetContract: ContractDefinition,
    comparison: ContractComparison
  ): string {
    return `
      # Migrate data for contract ${sourceContract.id}
      echo "Migrating data for contract ${sourceContract.id}..."
      
      # Create data backup
      cp "./data/${sourceContract.id}.json" "./data/${sourceContract.id}.json.backup"
      
      # Transform data
      arbiter migrate-data "${sourceContract.id}" \\
        --from-version "${sourceContract.version}" \\
        --to-version "${targetContract.version}"
      
      # Validate migrated data
      arbiter validate-data "${sourceContract.id}"
      
      echo "Data migration completed for ${sourceContract.id}"
    `;
  }

  private static generateSchemaRollbackScript(sourceContract: ContractDefinition, schemaChanges: SchemaChange[]): string {
    return `
      # Rollback schema changes for ${sourceContract.id}
      echo "Rolling back schema for ${sourceContract.id}..."
      
      # Restore schema from backup
      if [ -f "./schemas/${sourceContract.id}.cue.backup" ]; then
        cp "./schemas/${sourceContract.id}.cue.backup" "./schemas/${sourceContract.id}.cue"
      fi
      
      echo "Schema rollback completed"
    `;
  }

  private static generateContractRollbackScript(sourceContract: ContractDefinition): string {
    return `
      # Rollback contract ${sourceContract.id}
      echo "Rolling back contract ${sourceContract.id}..."
      
      # Restore from backup
      if [ -f "./contracts/${sourceContract.id}.cue.backup" ]; then
        cp "./contracts/${sourceContract.id}.cue.backup" "./contracts/${sourceContract.id}.cue"
      fi
      
      echo "Contract rollback completed"
    `;
  }

  private static generateDataRollbackScript(sourceContract: ContractDefinition): string {
    return `
      # Rollback data for ${sourceContract.id}
      echo "Rolling back data for ${sourceContract.id}..."
      
      # Restore data from backup
      if [ -f "./data/${sourceContract.id}.json.backup" ]; then
        cp "./data/${sourceContract.id}.json.backup" "./data/${sourceContract.id}.json"
      fi
      
      echo "Data rollback completed"
    `;
  }

  private static generateDataTransformFunction(comparison: ContractComparison): (data: any) => any {
    return (data: any) => {
      // Transform data based on contract differences
      let transformed = { ...data };
      
      // Apply transformations based on differences
      // This is a simplified implementation
      
      return transformed;
    };
  }

  // Utility methods for nested object manipulation
  private static setNestedProperty(obj: any, path: string, value: any): void {
    const parts = path.split('.');
    let current = obj;
    
    for (let i = 0; i < parts.length - 1; i++) {
      if (!(parts[i] in current) || typeof current[parts[i]] !== 'object') {
        current[parts[i]] = {};
      }
      current = current[parts[i]];
    }
    
    current[parts[parts.length - 1]] = value;
  }

  private static getNestedProperty(obj: any, path: string): any {
    return path.split('.').reduce((current, part) => current?.[part], obj);
  }

  private static deleteNestedProperty(obj: any, path: string): void {
    const parts = path.split('.');
    let current = obj;
    
    for (let i = 0; i < parts.length - 1; i++) {
      if (!(parts[i] in current)) return;
      current = current[parts[i]];
    }
    
    delete current[parts[parts.length - 1]];
  }

  private static getDefaultValue(schema: any): any {
    // Generate default value based on schema type
    switch (schema.type) {
      case 'string': return '';
      case 'number': return 0;
      case 'integer': return 0;
      case 'boolean': return false;
      case 'array': return [];
      case 'object': return {};
      default: return null;
    }
  }

  private static transformValue(value: any, change: SchemaChange): any {
    // Transform value based on schema change
    // This is a simplified implementation
    return value;
  }

  private static async validateStep(step: MigrationStep): Promise<boolean> {
    // Validate step configuration and dependencies
    logger.debug(`Validating step: ${step.id}`);
    return true; // Simplified implementation
  }

  private static async executeStep(step: MigrationStep): Promise<void> {
    // Execute migration step
    logger.debug(`Executing step: ${step.id}`);
    // Implementation would run the actual migration script or transformation
  }

  private static async validateStepPostconditions(step: MigrationStep): Promise<boolean> {
    // Validate step postconditions
    logger.debug(`Validating postconditions for step: ${step.id}`);
    return true; // Simplified implementation
  }

  private static async rollbackStep(step: MigrationStep): Promise<void> {
    // Rollback migration step
    logger.debug(`Rolling back step: ${step.id}`);
    // Implementation would run the rollback script
  }
}
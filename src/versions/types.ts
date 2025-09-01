/**
 * TypeScript interfaces and types for the version management system
 */

import { z } from 'zod';
import { ContractDefinition, CueSchema } from '../contracts/types.js';

export interface SemanticVersion {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
  readonly prerelease?: readonly string[];
  readonly build?: readonly string[];
}

export interface VersionRange {
  readonly raw: string;
  readonly operator: VersionOperator;
  readonly version: SemanticVersion;
  readonly loose?: boolean;
}

export type VersionOperator = 
  | '=' | '==' | '!=' 
  | '<' | '<=' | '>' | '>=' 
  | '~' | '^' | 'x' | 'X' | '*';

export interface VersionConstraint {
  readonly range: string;
  readonly satisfies: (version: SemanticVersion) => boolean;
  readonly description: string;
}

export interface VersionHistory {
  readonly id: string;
  readonly version: SemanticVersion;
  readonly timestamp: Date;
  readonly author: string;
  readonly message: string;
  readonly changes: readonly VersionChange[];
  readonly contracts: readonly string[]; // Contract IDs affected
  readonly gitRef?: string;
  readonly buildMetadata?: Record<string, any>;
}

export interface VersionChange {
  readonly type: ChangeType;
  readonly path: string;
  readonly description: string;
  readonly impact: ChangeImpact;
  readonly severity: ChangeSeverity;
  readonly details: ChangeDetails;
}

export type ChangeType = 
  | 'schema_added' | 'schema_removed' | 'schema_modified'
  | 'contract_added' | 'contract_removed' | 'contract_modified'
  | 'field_added' | 'field_removed' | 'field_modified'
  | 'constraint_added' | 'constraint_removed' | 'constraint_modified'
  | 'type_changed' | 'format_changed' | 'validation_changed';

export type ChangeImpact = 'breaking' | 'feature' | 'fix' | 'none';
export type ChangeSeverity = 'critical' | 'major' | 'minor' | 'patch';

export interface ChangeDetails {
  readonly before?: any;
  readonly after?: any;
  readonly diff?: string;
  readonly affectedContracts?: readonly string[];
  readonly migrationRequired?: boolean;
  readonly backwardCompatible?: boolean;
}

export interface CompatibilityAnalysis {
  readonly sourceVersion: SemanticVersion;
  readonly targetVersion: SemanticVersion;
  readonly compatible: boolean;
  readonly breakingChanges: readonly BreakingChange[];
  readonly warnings: readonly CompatibilityWarning[];
  readonly recommendations: readonly string[];
  readonly migrationPath?: MigrationPath;
}

export interface BreakingChange {
  readonly id: string;
  readonly type: ChangeType;
  readonly path: string;
  readonly description: string;
  readonly impact: string;
  readonly severity: ChangeSeverity;
  readonly workaround?: string;
  readonly automatedMigration?: boolean;
}

export interface CompatibilityWarning {
  readonly id: string;
  readonly type: 'deprecation' | 'behavioral_change' | 'performance_impact';
  readonly path: string;
  readonly message: string;
  readonly recommendedAction: string;
  readonly futureVersion?: SemanticVersion;
}

export interface CompatibilityMatrix {
  readonly sourceVersion: SemanticVersion;
  readonly compatibleVersions: readonly SemanticVersion[];
  readonly deprecatedVersions: readonly SemanticVersion[];
  readonly unsupportedVersions: readonly SemanticVersion[];
  readonly upgradePathMap: Map<string, MigrationPath>;
  readonly lastUpdated: Date;
}

export interface MigrationPath {
  readonly id: string;
  readonly fromVersion: SemanticVersion;
  readonly toVersion: SemanticVersion;
  readonly steps: readonly MigrationStep[];
  readonly automated: boolean;
  readonly complexity: MigrationComplexity;
  readonly estimatedDuration: string;
  readonly prerequisites: readonly string[];
  readonly risks: readonly string[];
}

export type MigrationComplexity = 'simple' | 'moderate' | 'complex' | 'critical';

export interface MigrationStep {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly type: MigrationStepType;
  readonly operation: MigrationOperation;
  readonly validation: MigrationValidation;
  readonly rollback: MigrationRollback;
  readonly dependencies: readonly string[];
}

export type MigrationStepType = 
  | 'schema_transform' | 'data_migration' | 'contract_update'
  | 'validation_change' | 'cleanup' | 'verification';

export interface MigrationOperation {
  readonly script?: string;
  readonly transform?: (data: any) => any;
  readonly contracts?: readonly string[];
  readonly schemaChanges?: readonly SchemaChange[];
}

export interface MigrationValidation {
  readonly rules: readonly ValidationRule[];
  readonly postconditions: readonly string[];
  readonly testCases?: readonly MigrationTestCase[];
}

export interface MigrationRollback {
  readonly possible: boolean;
  readonly script?: string;
  readonly warnings: readonly string[];
  readonly dataLossRisk: boolean;
}

export interface SchemaChange {
  readonly path: string;
  readonly operation: 'add' | 'remove' | 'modify' | 'rename';
  readonly before?: CueSchema;
  readonly after?: CueSchema;
  readonly preserveData: boolean;
}

export interface ValidationRule {
  readonly name: string;
  readonly expression: string;
  readonly errorMessage: string;
  readonly severity: 'error' | 'warning';
}

export interface MigrationTestCase {
  readonly name: string;
  readonly input: any;
  readonly expectedOutput: any;
  readonly contracts: readonly string[];
}

export interface VersionBumpResult {
  readonly currentVersion: SemanticVersion;
  readonly nextVersion: SemanticVersion;
  readonly bumpType: VersionBumpType;
  readonly reason: string;
  readonly changes: readonly VersionChange[];
  readonly migrationRequired: boolean;
  readonly compatibilityImpact: CompatibilityImpact;
}

export type VersionBumpType = 'major' | 'minor' | 'patch' | 'prerelease' | 'build';

export interface CompatibilityImpact {
  readonly affectedVersions: readonly SemanticVersion[];
  readonly deprecationWarnings: readonly DeprecationWarning[];
  readonly supportWindow: SupportWindow;
}

export interface DeprecationWarning {
  readonly feature: string;
  readonly deprecatedIn: SemanticVersion;
  readonly removedIn: SemanticVersion;
  readonly replacement?: string;
  readonly migrationGuide?: string;
}

export interface SupportWindow {
  readonly currentVersion: SemanticVersion;
  readonly minimumSupported: SemanticVersion;
  readonly recommendedMinimum: SemanticVersion;
  readonly endOfLife: readonly EOLVersion[];
}

export interface EOLVersion {
  readonly version: SemanticVersion;
  readonly endDate: Date;
  readonly reason: string;
}

export interface VersionManagerConfig {
  readonly defaultBumpType: VersionBumpType;
  readonly prereleaseTags: readonly string[];
  readonly migrationTimeout: number;
  readonly maxSupportedVersions: number;
  readonly autoMigration: boolean;
  readonly strictCompatibility: boolean;
  readonly allowDowngrade: boolean;
  readonly gitIntegration: GitIntegrationConfig;
}

export interface GitIntegrationConfig {
  readonly enabled: boolean;
  readonly tagPrefix: string;
  readonly createTags: boolean;
  readonly pushTags: boolean;
  readonly branch?: string;
}

export interface SchemaComparison {
  readonly sourceSchema: CueSchema;
  readonly targetSchema: CueSchema;
  readonly differences: readonly SchemaDifference[];
  readonly compatible: boolean;
  readonly breakingChanges: readonly BreakingChange[];
}

export interface SchemaDifference {
  readonly path: string;
  readonly type: 'added' | 'removed' | 'modified' | 'type_changed';
  readonly before?: any;
  readonly after?: any;
  readonly impact: ChangeImpact;
  readonly description: string;
}

export interface ContractComparison {
  readonly sourceContract: ContractDefinition;
  readonly targetContract: ContractDefinition;
  readonly differences: readonly ContractDifference[];
  readonly compatible: boolean;
  readonly migrationRequired: boolean;
}

export interface ContractDifference {
  readonly section: 'input' | 'output' | 'preconditions' | 'postconditions' | 'metamorphic' | 'invariants';
  readonly type: 'added' | 'removed' | 'modified';
  readonly path: string;
  readonly impact: ChangeImpact;
  readonly description: string;
  readonly details: any;
}

// Zod schemas for runtime validation
export const SemanticVersionSchema = z.object({
  major: z.number().int().min(0),
  minor: z.number().int().min(0),
  patch: z.number().int().min(0),
  prerelease: z.array(z.string()).optional(),
  build: z.array(z.string()).optional(),
});

export const VersionChangeSchema = z.object({
  type: z.enum([
    'schema_added', 'schema_removed', 'schema_modified',
    'contract_added', 'contract_removed', 'contract_modified',
    'field_added', 'field_removed', 'field_modified',
    'constraint_added', 'constraint_removed', 'constraint_modified',
    'type_changed', 'format_changed', 'validation_changed'
  ]),
  path: z.string(),
  description: z.string(),
  impact: z.enum(['breaking', 'feature', 'fix', 'none']),
  severity: z.enum(['critical', 'major', 'minor', 'patch']),
  details: z.object({
    before: z.any().optional(),
    after: z.any().optional(),
    diff: z.string().optional(),
    affectedContracts: z.array(z.string()).optional(),
    migrationRequired: z.boolean().optional(),
    backwardCompatible: z.boolean().optional(),
  }),
});

export const VersionHistorySchema = z.object({
  id: z.string(),
  version: SemanticVersionSchema,
  timestamp: z.date(),
  author: z.string(),
  message: z.string(),
  changes: z.array(VersionChangeSchema),
  contracts: z.array(z.string()),
  gitRef: z.string().optional(),
  buildMetadata: z.record(z.any()).optional(),
});

export const MigrationStepSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  type: z.enum(['schema_transform', 'data_migration', 'contract_update', 'validation_change', 'cleanup', 'verification']),
  operation: z.object({
    script: z.string().optional(),
    transform: z.any().optional(),
    contracts: z.array(z.string()).optional(),
    schemaChanges: z.array(z.any()).optional(),
  }),
  validation: z.object({
    rules: z.array(z.object({
      name: z.string(),
      expression: z.string(),
      errorMessage: z.string(),
      severity: z.enum(['error', 'warning']),
    })),
    postconditions: z.array(z.string()),
    testCases: z.array(z.object({
      name: z.string(),
      input: z.any(),
      expectedOutput: z.any(),
      contracts: z.array(z.string()),
    })).optional(),
  }),
  rollback: z.object({
    possible: z.boolean(),
    script: z.string().optional(),
    warnings: z.array(z.string()),
    dataLossRisk: z.boolean(),
  }),
  dependencies: z.array(z.string()),
});

export type SemanticVersionType = z.infer<typeof SemanticVersionSchema>;
export type VersionChangeType = z.infer<typeof VersionChangeSchema>;
export type VersionHistoryType = z.infer<typeof VersionHistorySchema>;
export type MigrationStepType = z.infer<typeof MigrationStepSchema>;

// Error types
export class VersionError extends Error {
  constructor(
    message: string,
    public readonly version: string,
    public readonly operation: string,
    public readonly context?: Record<string, any>
  ) {
    super(message);
    this.name = 'VersionError';
  }
}

export class VersionParsingError extends VersionError {
  constructor(message: string, version: string, context?: Record<string, any>) {
    super(message, version, 'parsing', context);
    this.name = 'VersionParsingError';
  }
}

export class VersionCompatibilityError extends VersionError {
  constructor(message: string, version: string, context?: Record<string, any>) {
    super(message, version, 'compatibility', context);
    this.name = 'VersionCompatibilityError';
  }
}

export class MigrationError extends Error {
  constructor(
    message: string,
    public readonly migrationId: string,
    public readonly step: string,
    public readonly context?: Record<string, any>
  ) {
    super(message);
    this.name = 'MigrationError';
  }
}

export class MigrationValidationError extends MigrationError {
  constructor(message: string, migrationId: string, step: string, context?: Record<string, any>) {
    super(message, migrationId, step, context);
    this.name = 'MigrationValidationError';
  }
}

export class MigrationRollbackError extends MigrationError {
  constructor(message: string, migrationId: string, step: string, context?: Record<string, any>) {
    super(message, migrationId, step, context);
    this.name = 'MigrationRollbackError';
  }
}
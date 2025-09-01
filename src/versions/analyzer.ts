/**
 * Change and compatibility analyzer for CUE schemas and contracts
 * Analyzes CUE schema changes for breaking vs non-breaking modifications
 */

import {
  SemanticVersion,
  VersionChange,
  ChangeType,
  ChangeImpact,
  ChangeSeverity,
  BreakingChange,
  CompatibilityAnalysis,
  CompatibilityWarning,
  SchemaComparison,
  SchemaDifference,
  ContractComparison,
  ContractDifference,
} from './types.js';
import { ContractDefinition, CueSchema } from '../contracts/types.js';
import { SemverUtils } from './semver.js';
import { logger } from '../utils/logger.js';

export class VersionAnalyzer {
  /**
   * Analyze changes between two contract definitions
   */
  static analyzeContractChanges(
    sourceContract: ContractDefinition,
    targetContract: ContractDefinition
  ): ContractComparison {
    logger.debug(`Analyzing contract changes: ${sourceContract.id} -> ${targetContract.id}`);

    const differences: ContractDifference[] = [];
    let compatible = true;
    let migrationRequired = false;

    // Analyze input schema changes
    const inputComparison = this.analyzeSchemaChanges(
      sourceContract.inputSchema,
      targetContract.inputSchema
    );
    
    if (!inputComparison.compatible) {
      compatible = false;
      migrationRequired = true;
    }

    differences.push(...inputComparison.differences.map(diff => ({
      section: 'input' as const,
      type: diff.type,
      path: `input.${diff.path}`,
      impact: diff.impact,
      description: `Input schema: ${diff.description}`,
      details: diff,
    })));

    // Analyze output schema changes
    const outputComparison = this.analyzeSchemaChanges(
      sourceContract.outputSchema,
      targetContract.outputSchema
    );

    if (!outputComparison.compatible) {
      compatible = false;
      migrationRequired = true;
    }

    differences.push(...outputComparison.differences.map(diff => ({
      section: 'output' as const,
      type: diff.type,
      path: `output.${diff.path}`,
      impact: diff.impact,
      description: `Output schema: ${diff.description}`,
      details: diff,
    })));

    // Analyze preconditions
    const preConditionDiffs = this.analyzeConditionChanges(
      sourceContract.preConditions,
      targetContract.preConditions,
      'preconditions'
    );
    
    differences.push(...preConditionDiffs);
    if (preConditionDiffs.some(diff => diff.impact === 'breaking')) {
      compatible = false;
      migrationRequired = true;
    }

    // Analyze postconditions
    const postConditionDiffs = this.analyzeConditionChanges(
      sourceContract.postConditions,
      targetContract.postConditions,
      'postconditions'
    );
    
    differences.push(...postConditionDiffs);
    if (postConditionDiffs.some(diff => diff.impact === 'breaking')) {
      compatible = false;
      migrationRequired = true;
    }

    // Analyze metamorphic laws
    const metamorphicDiffs = this.analyzeMetamorphicChanges(
      sourceContract.metamorphicLaws,
      targetContract.metamorphicLaws
    );
    
    differences.push(...metamorphicDiffs);
    if (metamorphicDiffs.some(diff => diff.impact === 'breaking')) {
      compatible = false;
      migrationRequired = true;
    }

    // Analyze invariants
    const invariantDiffs = this.analyzeInvariantChanges(
      sourceContract.invariants,
      targetContract.invariants
    );
    
    differences.push(...invariantDiffs);
    if (invariantDiffs.some(diff => diff.impact === 'breaking')) {
      compatible = false;
      migrationRequired = true;
    }

    return {
      sourceContract,
      targetContract,
      differences,
      compatible,
      migrationRequired,
    };
  }

  /**
   * Analyze changes between two CUE schemas
   */
  static analyzeSchemaChanges(
    sourceSchema: CueSchema,
    targetSchema: CueSchema
  ): SchemaComparison {
    const differences: SchemaDifference[] = [];
    const breakingChanges: BreakingChange[] = [];
    
    this.analyzeSchemaRecursive(sourceSchema, targetSchema, '', differences, breakingChanges);
    
    const compatible = breakingChanges.length === 0;
    
    return {
      sourceSchema,
      targetSchema,
      differences,
      compatible,
      breakingChanges,
    };
  }

  /**
   * Recursively analyze schema differences
   */
  private static analyzeSchemaRecursive(
    source: CueSchema,
    target: CueSchema,
    path: string,
    differences: SchemaDifference[],
    breakingChanges: BreakingChange[]
  ): void {
    // Type changes
    if (source.type !== target.type) {
      const diff: SchemaDifference = {
        path,
        type: 'type_changed',
        before: source.type,
        after: target.type,
        impact: this.isTypeChangeBreaking(source.type, target.type) ? 'breaking' : 'feature',
        description: `Type changed from ${source.type} to ${target.type}`,
      };
      differences.push(diff);
      
      if (diff.impact === 'breaking') {
        breakingChanges.push({
          id: `type_change_${path}`,
          type: 'type_changed',
          path,
          description: diff.description,
          impact: 'Type compatibility may be lost',
          severity: 'major',
        });
      }
    }

    // Required fields
    this.analyzeRequiredFields(source, target, path, differences, breakingChanges);

    // Constraints
    this.analyzeConstraints(source, target, path, differences, breakingChanges);

    // Properties (for object types)
    if (source.properties || target.properties) {
      this.analyzeProperties(source.properties || {}, target.properties || {}, path, differences, breakingChanges);
    }

    // Items (for array types)
    if (source.items && target.items) {
      this.analyzeSchemaRecursive(source.items, target.items, `${path}[]`, differences, breakingChanges);
    } else if (source.items && !target.items) {
      differences.push({
        path: `${path}[]`,
        type: 'removed',
        before: source.items,
        after: undefined,
        impact: 'breaking',
        description: 'Array item schema removed',
      });
      
      breakingChanges.push({
        id: `items_removed_${path}`,
        type: 'schema_removed',
        path: `${path}[]`,
        description: 'Array item schema removed',
        impact: 'Array validation will be lost',
        severity: 'major',
      });
    } else if (!source.items && target.items) {
      differences.push({
        path: `${path}[]`,
        type: 'added',
        before: undefined,
        after: target.items,
        impact: 'feature',
        description: 'Array item schema added',
      });
    }
  }

  /**
   * Analyze required field changes
   */
  private static analyzeRequiredFields(
    source: CueSchema,
    target: CueSchema,
    path: string,
    differences: SchemaDifference[],
    breakingChanges: BreakingChange[]
  ): void {
    const sourceRequired = new Set(source.required || []);
    const targetRequired = new Set(target.required || []);

    // Fields that became required (breaking)
    for (const field of targetRequired) {
      if (!sourceRequired.has(field)) {
        const diff: SchemaDifference = {
          path: `${path}.${field}`,
          type: 'added',
          before: false,
          after: true,
          impact: 'breaking',
          description: `Field '${field}' is now required`,
        };
        differences.push(diff);
        
        breakingChanges.push({
          id: `required_added_${path}_${field}`,
          type: 'constraint_added',
          path: `${path}.${field}`,
          description: diff.description,
          impact: 'Previously valid data may now fail validation',
          severity: 'major',
        });
      }
    }

    // Fields that became optional (non-breaking)
    for (const field of sourceRequired) {
      if (!targetRequired.has(field)) {
        differences.push({
          path: `${path}.${field}`,
          type: 'removed',
          before: true,
          after: false,
          impact: 'feature',
          description: `Field '${field}' is now optional`,
        });
      }
    }
  }

  /**
   * Analyze constraint changes
   */
  private static analyzeConstraints(
    source: CueSchema,
    target: CueSchema,
    path: string,
    differences: SchemaDifference[],
    breakingChanges: BreakingChange[]
  ): void {
    // Numeric constraints
    this.analyzeNumericConstraints(source, target, path, differences, breakingChanges);
    
    // String constraints
    this.analyzeStringConstraints(source, target, path, differences, breakingChanges);
    
    // Pattern constraints
    if (source.pattern !== target.pattern) {
      const impact = target.pattern && (!source.pattern || this.isPatternMoreRestrictive(source.pattern, target.pattern)) 
        ? 'breaking' : 'feature';
        
      differences.push({
        path,
        type: 'modified',
        before: source.pattern,
        after: target.pattern,
        impact,
        description: `Pattern constraint changed from ${source.pattern} to ${target.pattern}`,
      });
      
      if (impact === 'breaking') {
        breakingChanges.push({
          id: `pattern_change_${path}`,
          type: 'constraint_modified',
          path,
          description: `Pattern constraint became more restrictive`,
          impact: 'Previously valid data may now fail validation',
          severity: 'major',
        });
      }
    }

    // Enum constraints
    if (source.enum || target.enum) {
      this.analyzeEnumConstraints(source, target, path, differences, breakingChanges);
    }
  }

  /**
   * Analyze numeric constraint changes
   */
  private static analyzeNumericConstraints(
    source: CueSchema,
    target: CueSchema,
    path: string,
    differences: SchemaDifference[],
    breakingChanges: BreakingChange[]
  ): void {
    // Minimum value
    if (source.minimum !== target.minimum) {
      const impact = (target.minimum !== undefined && 
        (source.minimum === undefined || target.minimum > source.minimum)) ? 'breaking' : 'feature';
        
      differences.push({
        path,
        type: 'modified',
        before: source.minimum,
        after: target.minimum,
        impact,
        description: `Minimum value changed from ${source.minimum} to ${target.minimum}`,
      });
      
      if (impact === 'breaking') {
        breakingChanges.push({
          id: `minimum_change_${path}`,
          type: 'constraint_modified',
          path,
          description: 'Minimum value constraint became more restrictive',
          impact: 'Previously valid values may now be rejected',
          severity: 'major',
        });
      }
    }

    // Maximum value
    if (source.maximum !== target.maximum) {
      const impact = (target.maximum !== undefined && 
        (source.maximum === undefined || target.maximum < source.maximum)) ? 'breaking' : 'feature';
        
      differences.push({
        path,
        type: 'modified',
        before: source.maximum,
        after: target.maximum,
        impact,
        description: `Maximum value changed from ${source.maximum} to ${target.maximum}`,
      });
      
      if (impact === 'breaking') {
        breakingChanges.push({
          id: `maximum_change_${path}`,
          type: 'constraint_modified',
          path,
          description: 'Maximum value constraint became more restrictive',
          impact: 'Previously valid values may now be rejected',
          severity: 'major',
        });
      }
    }
  }

  /**
   * Analyze string constraint changes
   */
  private static analyzeStringConstraints(
    source: CueSchema,
    target: CueSchema,
    path: string,
    differences: SchemaDifference[],
    breakingChanges: BreakingChange[]
  ): void {
    // Minimum length
    if (source.minLength !== target.minLength) {
      const impact = (target.minLength !== undefined && 
        (source.minLength === undefined || target.minLength > source.minLength)) ? 'breaking' : 'feature';
        
      differences.push({
        path,
        type: 'modified',
        before: source.minLength,
        after: target.minLength,
        impact,
        description: `Minimum length changed from ${source.minLength} to ${target.minLength}`,
      });
      
      if (impact === 'breaking') {
        breakingChanges.push({
          id: `minlength_change_${path}`,
          type: 'constraint_modified',
          path,
          description: 'Minimum length constraint became more restrictive',
          impact: 'Previously valid strings may now be rejected',
          severity: 'major',
        });
      }
    }

    // Maximum length
    if (source.maxLength !== target.maxLength) {
      const impact = (target.maxLength !== undefined && 
        (source.maxLength === undefined || target.maxLength < source.maxLength)) ? 'breaking' : 'feature';
        
      differences.push({
        path,
        type: 'modified',
        before: source.maxLength,
        after: target.maxLength,
        impact,
        description: `Maximum length changed from ${source.maxLength} to ${target.maxLength}`,
      });
      
      if (impact === 'breaking') {
        breakingChanges.push({
          id: `maxlength_change_${path}`,
          type: 'constraint_modified',
          path,
          description: 'Maximum length constraint became more restrictive',
          impact: 'Previously valid strings may now be rejected',
          severity: 'major',
        });
      }
    }
  }

  /**
   * Analyze enum constraint changes
   */
  private static analyzeEnumConstraints(
    source: CueSchema,
    target: CueSchema,
    path: string,
    differences: SchemaDifference[],
    breakingChanges: BreakingChange[]
  ): void {
    const sourceEnum = new Set(source.enum || []);
    const targetEnum = new Set(target.enum || []);

    // Values removed from enum (breaking)
    for (const value of sourceEnum) {
      if (!targetEnum.has(value)) {
        differences.push({
          path,
          type: 'removed',
          before: value,
          after: undefined,
          impact: 'breaking',
          description: `Enum value '${value}' removed`,
        });
        
        breakingChanges.push({
          id: `enum_removed_${path}_${value}`,
          type: 'constraint_modified',
          path,
          description: `Enum value '${value}' removed`,
          impact: 'Data using this value will become invalid',
          severity: 'major',
        });
      }
    }

    // Values added to enum (non-breaking)
    for (const value of targetEnum) {
      if (!sourceEnum.has(value)) {
        differences.push({
          path,
          type: 'added',
          before: undefined,
          after: value,
          impact: 'feature',
          description: `Enum value '${value}' added`,
        });
      }
    }
  }

  /**
   * Analyze property changes in object schemas
   */
  private static analyzeProperties(
    sourceProps: Record<string, CueSchema>,
    targetProps: Record<string, CueSchema>,
    basePath: string,
    differences: SchemaDifference[],
    breakingChanges: BreakingChange[]
  ): void {
    const sourceKeys = new Set(Object.keys(sourceProps));
    const targetKeys = new Set(Object.keys(targetProps));

    // Properties removed (potentially breaking)
    for (const key of sourceKeys) {
      if (!targetKeys.has(key)) {
        const path = basePath ? `${basePath}.${key}` : key;
        differences.push({
          path,
          type: 'removed',
          before: sourceProps[key],
          after: undefined,
          impact: 'breaking',
          description: `Property '${key}' removed`,
        });
        
        breakingChanges.push({
          id: `property_removed_${path}`,
          type: 'schema_removed',
          path,
          description: `Property '${key}' removed`,
          impact: 'Data using this property will become invalid',
          severity: 'major',
        });
      }
    }

    // Properties added (non-breaking, unless required)
    for (const key of targetKeys) {
      if (!sourceKeys.has(key)) {
        const path = basePath ? `${basePath}.${key}` : key;
        differences.push({
          path,
          type: 'added',
          before: undefined,
          after: targetProps[key],
          impact: 'feature',
          description: `Property '${key}' added`,
        });
      }
    }

    // Properties modified
    for (const key of sourceKeys) {
      if (targetKeys.has(key)) {
        const path = basePath ? `${basePath}.${key}` : key;
        this.analyzeSchemaRecursive(
          sourceProps[key],
          targetProps[key],
          path,
          differences,
          breakingChanges
        );
      }
    }
  }

  /**
   * Analyze condition changes (preconditions/postconditions)
   */
  private static analyzeConditionChanges(
    sourceConditions: readonly any[],
    targetConditions: readonly any[],
    section: 'preconditions' | 'postconditions'
  ): ContractDifference[] {
    const differences: ContractDifference[] = [];
    
    const sourceMap = new Map(sourceConditions.map(c => [c.name, c]));
    const targetMap = new Map(targetConditions.map(c => [c.name, c]));

    // Conditions removed
    for (const [name, condition] of sourceMap) {
      if (!targetMap.has(name)) {
        differences.push({
          section,
          type: 'removed',
          path: name,
          impact: 'breaking',
          description: `${section} condition '${name}' removed`,
          details: { before: condition, after: undefined },
        });
      }
    }

    // Conditions added
    for (const [name, condition] of targetMap) {
      if (!sourceMap.has(name)) {
        const impact = section === 'preconditions' ? 'breaking' : 'feature';
        differences.push({
          section,
          type: 'added',
          path: name,
          impact,
          description: `${section} condition '${name}' added`,
          details: { before: undefined, after: condition },
        });
      }
    }

    // Conditions modified
    for (const [name, sourceCondition] of sourceMap) {
      const targetCondition = targetMap.get(name);
      if (targetCondition && sourceCondition.expression !== targetCondition.expression) {
        differences.push({
          section,
          type: 'modified',
          path: name,
          impact: 'breaking',
          description: `${section} condition '${name}' modified`,
          details: { 
            before: sourceCondition.expression, 
            after: targetCondition.expression 
          },
        });
      }
    }

    return differences;
  }

  /**
   * Analyze metamorphic law changes
   */
  private static analyzeMetamorphicChanges(
    sourceLaws: readonly any[],
    targetLaws: readonly any[]
  ): ContractDifference[] {
    const differences: ContractDifference[] = [];
    
    const sourceMap = new Map(sourceLaws.map(l => [l.name, l]));
    const targetMap = new Map(targetLaws.map(l => [l.name, l]));

    // Laws removed
    for (const [name, law] of sourceMap) {
      if (!targetMap.has(name)) {
        differences.push({
          section: 'metamorphic',
          type: 'removed',
          path: name,
          impact: 'breaking',
          description: `Metamorphic law '${name}' removed`,
          details: { before: law, after: undefined },
        });
      }
    }

    // Laws added
    for (const [name, law] of targetMap) {
      if (!sourceMap.has(name)) {
        differences.push({
          section: 'metamorphic',
          type: 'added',
          path: name,
          impact: 'feature',
          description: `Metamorphic law '${name}' added`,
          details: { before: undefined, after: law },
        });
      }
    }

    // Laws modified
    for (const [name, sourceLaw] of sourceMap) {
      const targetLaw = targetMap.get(name);
      if (targetLaw && 
          (sourceLaw.sourceExpression !== targetLaw.sourceExpression ||
           sourceLaw.targetExpression !== targetLaw.targetExpression ||
           sourceLaw.transformation !== targetLaw.transformation)) {
        differences.push({
          section: 'metamorphic',
          type: 'modified',
          path: name,
          impact: 'breaking',
          description: `Metamorphic law '${name}' modified`,
          details: { before: sourceLaw, after: targetLaw },
        });
      }
    }

    return differences;
  }

  /**
   * Analyze invariant changes
   */
  private static analyzeInvariantChanges(
    sourceInvariants: readonly any[],
    targetInvariants: readonly any[]
  ): ContractDifference[] {
    const differences: ContractDifference[] = [];
    
    const sourceMap = new Map(sourceInvariants.map(i => [i.name, i]));
    const targetMap = new Map(targetInvariants.map(i => [i.name, i]));

    // Invariants removed
    for (const [name, invariant] of sourceMap) {
      if (!targetMap.has(name)) {
        differences.push({
          section: 'invariants',
          type: 'removed',
          path: name,
          impact: 'breaking',
          description: `Invariant '${name}' removed`,
          details: { before: invariant, after: undefined },
        });
      }
    }

    // Invariants added
    for (const [name, invariant] of targetMap) {
      if (!sourceMap.has(name)) {
        differences.push({
          section: 'invariants',
          type: 'added',
          path: name,
          impact: 'breaking',
          description: `Invariant '${name}' added`,
          details: { before: undefined, after: invariant },
        });
      }
    }

    // Invariants modified
    for (const [name, sourceInvariant] of sourceMap) {
      const targetInvariant = targetMap.get(name);
      if (targetInvariant && sourceInvariant.expression !== targetInvariant.expression) {
        differences.push({
          section: 'invariants',
          type: 'modified',
          path: name,
          impact: 'breaking',
          description: `Invariant '${name}' modified`,
          details: { before: sourceInvariant, after: targetInvariant },
        });
      }
    }

    return differences;
  }

  /**
   * Perform compatibility analysis between two versions
   */
  static analyzeCompatibility(
    sourceVersion: SemanticVersion,
    targetVersion: SemanticVersion,
    sourceContracts: ContractDefinition[],
    targetContracts: ContractDefinition[]
  ): CompatibilityAnalysis {
    logger.debug(`Analyzing compatibility: ${SemverUtils.format(sourceVersion)} -> ${SemverUtils.format(targetVersion)}`);

    const breakingChanges: BreakingChange[] = [];
    const warnings: CompatibilityWarning[] = [];
    const recommendations: string[] = [];

    // Compare contracts by ID
    const sourceContractMap = new Map(sourceContracts.map(c => [c.id, c]));
    const targetContractMap = new Map(targetContracts.map(c => [c.id, c]));

    // Analyze each contract comparison
    for (const [id, sourceContract] of sourceContractMap) {
      const targetContract = targetContractMap.get(id);
      
      if (!targetContract) {
        // Contract removed
        breakingChanges.push({
          id: `contract_removed_${id}`,
          type: 'contract_removed',
          path: id,
          description: `Contract '${id}' removed`,
          impact: 'Applications depending on this contract will fail',
          severity: 'critical',
        });
        continue;
      }

      const comparison = this.analyzeContractChanges(sourceContract, targetContract);
      
      // Convert contract differences to breaking changes
      for (const diff of comparison.differences) {
        if (diff.impact === 'breaking') {
          breakingChanges.push({
            id: `${id}_${diff.section}_${diff.path}`,
            type: this.mapDifferenceToChangeType(diff.type),
            path: `${id}.${diff.path}`,
            description: diff.description,
            impact: typeof diff.details === 'object' && diff.details?.after 
              ? 'Behavior change may affect existing implementations'
              : 'Data or behavior compatibility may be lost',
            severity: this.inferSeverity(diff.type, diff.section),
          });
        }
      }
    }

    // Check for new contracts (non-breaking)
    for (const [id, targetContract] of targetContractMap) {
      if (!sourceContractMap.has(id)) {
        warnings.push({
          id: `contract_added_${id}`,
          type: 'behavioral_change',
          path: id,
          message: `New contract '${id}' added`,
          recommendedAction: 'Review new contract requirements and update implementations',
        });
      }
    }

    // Determine overall compatibility
    const compatible = breakingChanges.length === 0;

    // Generate recommendations
    if (breakingChanges.length > 0) {
      recommendations.push('This is a breaking change requiring a major version bump');
      recommendations.push('Consider providing migration guide for affected contracts');
      
      if (breakingChanges.some(bc => bc.severity === 'critical')) {
        recommendations.push('Critical breaking changes detected - thorough testing recommended');
      }
    }

    if (warnings.length > 0) {
      recommendations.push('Review warnings and update documentation accordingly');
    }

    const versionDiff = SemverUtils.diff(sourceVersion, targetVersion);
    if (versionDiff === 'major' && compatible) {
      warnings.push({
        id: 'unnecessary_major_bump',
        type: 'behavioral_change',
        path: 'version',
        message: 'Major version bump may not be necessary - no breaking changes detected',
        recommendedAction: 'Consider using minor or patch version bump instead',
      });
    } else if (versionDiff !== 'major' && !compatible) {
      recommendations.push('Breaking changes require a major version bump');
    }

    return {
      sourceVersion,
      targetVersion,
      compatible,
      breakingChanges,
      warnings,
      recommendations,
    };
  }

  /**
   * Helper methods
   */
  private static isTypeChangeBreaking(sourceType: string, targetType: string): boolean {
    // Some type changes are compatible
    const compatibleChanges = new Map([
      ['integer', new Set(['number'])],
      ['number', new Set(['integer'])],
    ]);

    return !compatibleChanges.get(sourceType)?.has(targetType);
  }

  private static isPatternMoreRestrictive(oldPattern: string, newPattern: string): boolean {
    // This is a simplified check - in reality, you'd need a proper regex analysis
    return newPattern.length > oldPattern.length || newPattern.includes(oldPattern);
  }

  private static mapDifferenceToChangeType(diffType: string): ChangeType {
    switch (diffType) {
      case 'added': return 'schema_added';
      case 'removed': return 'schema_removed';
      case 'modified': return 'schema_modified';
      case 'type_changed': return 'type_changed';
      default: return 'schema_modified';
    }
  }

  private static inferSeverity(diffType: string, section: string): ChangeSeverity {
    if (section === 'input' || section === 'output') return 'critical';
    if (diffType === 'removed') return 'major';
    if (diffType === 'type_changed') return 'major';
    return 'minor';
  }
}
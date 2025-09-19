import type { ConflictEntry, ConflictResolution } from '../types.js';

/**
 * Handles detection and resolution of conflicts between SRF fragments
 */
export class ConflictResolver {
  /**
   * Detect conflicts between two CUE specifications
   */
  async detectConflicts(
    newSpec: ParsedSpec,
    existingSpec: ParsedSpec,
    newFragmentId: string,
    existingFragmentId: string
  ): Promise<ConflictEntry[]> {
    const conflicts: ConflictEntry[] = [];

    // Schema conflicts - same path with different types
    const schemaConflicts = this.detectSchemaConflicts(
      newSpec,
      existingSpec,
      newFragmentId,
      existingFragmentId
    );
    conflicts.push(...schemaConflicts);

    // Field overlap conflicts - same field name with different constraints
    const fieldConflicts = this.detectFieldConflicts(
      newSpec,
      existingSpec,
      newFragmentId,
      existingFragmentId
    );
    conflicts.push(...fieldConflicts);

    // Constraint contradictions - conflicting validation rules
    const constraintConflicts = this.detectConstraintConflicts(
      newSpec,
      existingSpec,
      newFragmentId,
      existingFragmentId
    );
    conflicts.push(...constraintConflicts);

    return conflicts;
  }

  /**
   * Attempt to resolve conflicts automatically
   */
  async resolveConflicts(
    conflicts: ConflictEntry[],
    newFragmentContent: string,
    existingSpec: string
  ): Promise<{
    success: boolean;
    resolutions: ConflictResolution[];
    error?: string;
  }> {
    const resolutions: ConflictResolution[] = [];

    try {
      for (const conflict of conflicts) {
        const resolution = await this.resolveConflict(conflict, newFragmentContent, existingSpec);
        if (resolution) {
          resolutions.push(resolution);
        }
      }

      const success = resolutions.length === conflicts.length;

      return {
        success,
        resolutions,
        error: success ? undefined : 'Some conflicts could not be resolved automatically',
      };
    } catch (error) {
      return {
        success: false,
        resolutions,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Generate conflict resolution suggestions
   */
  generateResolutionSuggestions(conflicts: ConflictEntry[]): {
    automatic: ConflictEntry[];
    manual: ConflictEntry[];
    suggestions: Record<string, string>;
  } {
    const automatic: ConflictEntry[] = [];
    const manual: ConflictEntry[] = [];
    const suggestions: Record<string, string> = {};

    for (const conflict of conflicts) {
      const canAutoResolve = this.canAutoResolve(conflict);

      if (canAutoResolve) {
        automatic.push(conflict);
        suggestions[conflict.fragmentId] = this.getAutoResolutionSuggestion(conflict);
      } else {
        manual.push(conflict);
        suggestions[conflict.fragmentId] = this.getManualResolutionSuggestion(conflict);
      }
    }

    return { automatic, manual, suggestions };
  }

  /**
   * Detect schema conflicts between specifications
   */
  private detectSchemaConflicts(
    newSpec: ParsedSpec,
    existingSpec: ParsedSpec,
    newFragmentId: string,
    existingFragmentId: string
  ): ConflictEntry[] {
    const conflicts: ConflictEntry[] = [];

    // Compare type definitions
    for (const [path, newType] of Object.entries(newSpec.types)) {
      const existingType = existingSpec.types[path];

      if (existingType && !this.areTypesCompatible(newType, existingType)) {
        conflicts.push({
          fragmentId: newFragmentId,
          type: 'schema_mismatch',
          description: `Type definition conflict at path '${path}': ${newType.signature} vs ${existingType.signature}`,
          cuePath: path,
          severity: 'error',
        });
      }
    }

    return conflicts;
  }

  /**
   * Detect field overlap conflicts
   */
  private detectFieldConflicts(
    newSpec: ParsedSpec,
    existingSpec: ParsedSpec,
    newFragmentId: string,
    existingFragmentId: string
  ): ConflictEntry[] {
    const conflicts: ConflictEntry[] = [];

    // Compare field definitions
    for (const [path, newField] of Object.entries(newSpec.fields)) {
      const existingField = existingSpec.fields[path];

      if (existingField && !this.areFieldsCompatible(newField, existingField)) {
        const severity = this.determineFieldConflictSeverity(newField, existingField);

        conflicts.push({
          fragmentId: newFragmentId,
          type: 'field_overlap',
          description: `Field conflict at '${path}': different constraints or types`,
          cuePath: path,
          severity,
        });
      }
    }

    return conflicts;
  }

  /**
   * Detect constraint contradictions
   */
  private detectConstraintConflicts(
    newSpec: ParsedSpec,
    existingSpec: ParsedSpec,
    newFragmentId: string,
    existingFragmentId: string
  ): ConflictEntry[] {
    const conflicts: ConflictEntry[] = [];

    // Compare constraints
    for (const [path, newConstraints] of Object.entries(newSpec.constraints)) {
      const existingConstraints = existingSpec.constraints[path];

      if (existingConstraints) {
        const contradictions = this.findConstraintContradictions(
          newConstraints,
          existingConstraints
        );

        for (const contradiction of contradictions) {
          conflicts.push({
            fragmentId: newFragmentId,
            type: 'constraint_contradiction',
            description: `Constraint contradiction at '${path}': ${contradiction}`,
            cuePath: path,
            severity: 'error',
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Attempt to resolve a single conflict
   */
  private async resolveConflict(
    conflict: ConflictEntry,
    newFragmentContent: string,
    existingSpec: string
  ): Promise<ConflictResolution | null> {
    switch (conflict.type) {
      case 'schema_mismatch':
        return this.resolveSchemaConflict(conflict, newFragmentContent, existingSpec);

      case 'field_overlap':
        return this.resolveFieldConflict(conflict, newFragmentContent, existingSpec);

      case 'constraint_contradiction':
        return this.resolveConstraintConflict(conflict, newFragmentContent, existingSpec);

      default:
        return null;
    }
  }

  /**
   * Resolve schema mismatch conflicts
   */
  private resolveSchemaConflict(
    conflict: ConflictEntry,
    newFragmentContent: string,
    existingSpec: string
  ): ConflictResolution | null {
    // For schema mismatches, we can try to merge compatible types
    // or rename one of the conflicting types

    if (conflict.severity === 'warning') {
      // Try merge strategy for compatible types
      return {
        method: 'merge',
        resolved_at: new Date().toISOString(),
        resolver: 'auto',
      };
    }
    // For errors, suggest renaming
    return {
      method: 'rename',
      resolved_at: new Date().toISOString(),
      resolver: 'auto',
    };
  }

  /**
   * Resolve field overlap conflicts
   */
  private resolveFieldConflict(
    conflict: ConflictEntry,
    newFragmentContent: string,
    existingSpec: string
  ): ConflictResolution | null {
    if (conflict.severity === 'warning') {
      // Try to merge field constraints
      return {
        method: 'merge',
        resolved_at: new Date().toISOString(),
        resolver: 'auto',
      };
    }

    return null; // Manual resolution required for field errors
  }

  /**
   * Resolve constraint contradiction conflicts
   */
  private resolveConstraintConflict(
    conflict: ConflictEntry,
    newFragmentContent: string,
    existingSpec: string
  ): ConflictResolution | null {
    // Constraint contradictions typically require manual resolution
    return null;
  }

  /**
   * Check if a conflict can be automatically resolved
   */
  private canAutoResolve(conflict: ConflictEntry): boolean {
    switch (conflict.type) {
      case 'schema_mismatch':
        return conflict.severity === 'warning';
      case 'field_overlap':
        return conflict.severity === 'warning';
      case 'constraint_contradiction':
        return false; // Always requires manual resolution
      default:
        return false;
    }
  }

  /**
   * Get automatic resolution suggestion
   */
  private getAutoResolutionSuggestion(conflict: ConflictEntry): string {
    switch (conflict.type) {
      case 'schema_mismatch':
        return 'Merge compatible type definitions using union types';
      case 'field_overlap':
        return 'Combine field constraints using logical AND';
      default:
        return 'No automatic resolution available';
    }
  }

  /**
   * Get manual resolution suggestion
   */
  private getManualResolutionSuggestion(conflict: ConflictEntry): string {
    switch (conflict.type) {
      case 'schema_mismatch':
        return 'Review type definitions and choose one, or create a new merged type';
      case 'field_overlap':
        return 'Decide which field constraints should take precedence';
      case 'constraint_contradiction':
        return 'Resolve conflicting constraints by updating one or both fragments';
      default:
        return 'Manual review and resolution required';
    }
  }

  /**
   * Check if two types are compatible
   */
  private areTypesCompatible(type1: TypeDefinition, type2: TypeDefinition): boolean {
    // Basic compatibility check - could be enhanced with actual CUE type checking
    return type1.signature === type2.signature || this.canMergeTypes(type1, type2);
  }

  /**
   * Check if two types can be merged
   */
  private canMergeTypes(type1: TypeDefinition, type2: TypeDefinition): boolean {
    // Simple heuristic - both are object types
    return type1.kind === 'object' && type2.kind === 'object';
  }

  /**
   * Check if two fields are compatible
   */
  private areFieldsCompatible(field1: FieldDefinition, field2: FieldDefinition): boolean {
    // Fields are compatible if they have the same type and compatible constraints
    if (field1.type !== field2.type) {
      return false;
    }

    // Check constraint compatibility
    return this.areConstraintsCompatible(field1.constraints, field2.constraints);
  }

  /**
   * Check if constraints are compatible
   */
  private areConstraintsCompatible(constraints1: string[], constraints2: string[]): boolean {
    // Simple check - no directly contradicting constraints
    const contradictions = this.findConstraintContradictions(constraints1, constraints2);
    return contradictions.length === 0;
  }

  /**
   * Determine severity of field conflict
   */
  private determineFieldConflictSeverity(
    field1: FieldDefinition,
    field2: FieldDefinition
  ): 'error' | 'warning' {
    // Type mismatch is always an error
    if (field1.type !== field2.type) {
      return 'error';
    }

    // Constraint conflicts might be warnings if they're not contradictory
    const contradictions = this.findConstraintContradictions(
      field1.constraints,
      field2.constraints
    );
    return contradictions.length > 0 ? 'error' : 'warning';
  }

  /**
   * Find contradictions between constraint sets
   */
  private findConstraintContradictions(constraints1: string[], constraints2: string[]): string[] {
    const contradictions: string[] = [];

    // Simple contradiction detection
    const numericConstraints1 = constraints1.filter(c => c.match(/[<>=]/));
    const numericConstraints2 = constraints2.filter(c => c.match(/[<>=]/));

    for (const c1 of numericConstraints1) {
      for (const c2 of numericConstraints2) {
        if (this.areNumericConstraintsContradictory(c1, c2)) {
          contradictions.push(`${c1} contradicts ${c2}`);
        }
      }
    }

    return contradictions;
  }

  /**
   * Check if two numeric constraints are contradictory
   */
  private areNumericConstraintsContradictory(constraint1: string, constraint2: string): boolean {
    // Very basic check - would need more sophisticated parsing in production

    // Example: "> 10" and "< 5" are contradictory
    const gt1 = constraint1.match(/>\s*(\d+)/);
    const lt2 = constraint2.match(/<\s*(\d+)/);

    if (gt1 && lt2) {
      return Number.parseInt(gt1[1]) >= Number.parseInt(lt2[1]);
    }

    const lt1 = constraint1.match(/<\s*(\d+)/);
    const gt2 = constraint2.match(/>\s*(\d+)/);

    if (lt1 && gt2) {
      return Number.parseInt(lt1[1]) <= Number.parseInt(gt2[1]);
    }

    return false;
  }
}

// Helper types for parsed specifications
interface ParsedSpec {
  types: Record<string, TypeDefinition>;
  fields: Record<string, FieldDefinition>;
  constraints: Record<string, string[]>;
}

interface TypeDefinition {
  kind: 'primitive' | 'object' | 'array' | 'union';
  signature: string;
  properties?: Record<string, any>;
}

interface FieldDefinition {
  type: string;
  constraints: string[];
  optional: boolean;
}

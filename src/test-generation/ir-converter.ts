/**
 * CUE to IR Converter
 * 
 * Converts CUE JSON exports into normalized Intermediate Representation (IR)
 * that can be safely transformed into TypeScript test files.
 */

import {
  TestGenerationIR,
  ScenarioIR,
  SchemaIR,
  ConstraintIR,
  AssertionIR,
  CUEConstructs,
  IRProcessingError,
  IRMetadata,
} from './ir-types.js';
import { logger } from '../utils/logger.js';

export interface CUEExport {
  [key: string]: unknown;
}

export interface CUESchema {
  type?: string;
  properties?: Record<string, CUESchema>;
  items?: CUESchema;
  required?: string[];
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: string;
  anyOf?: CUESchema[];
  oneOf?: CUESchema[];
  allOf?: CUESchema[];
  default?: unknown;
  const?: unknown;
  // CUE-specific
  '...'?: boolean; // Open struct indicator
  '#ref'?: string; // CUE reference
}

export class IRConverter {
  private readonly timestamp: string;

  constructor() {
    this.timestamp = new Date().toISOString();
  }

  /**
   * Convert CUE export JSON to normalized IR
   */
  async convertCUEToIR(
    cueExport: CUEExport,
    sourceFile: string,
    options: IRConversionOptions = {}
  ): Promise<TestGenerationIR> {
    try {
      logger.info(`Converting CUE export to IR for ${sourceFile}`);

      const scenarios: ScenarioIR[] = [];
      
      // Extract scenarios from CUE export
      const rawScenarios = this.extractScenarios(cueExport);
      
      for (const rawScenario of rawScenarios) {
        try {
          const scenario = await this.convertScenario(rawScenario);
          scenarios.push(scenario);
        } catch (error) {
          logger.warn(`Failed to convert scenario ${rawScenario.name}: ${error}`);
          
          // Create a skipped scenario for visibility
          scenarios.push(this.createSkippedScenario(rawScenario, error));
        }
      }

      const metadata: IRMetadata = {
        generator: 'arbiter-ir-converter-v1',
        generatedAt: this.timestamp,
        sourceSchema: sourceFile,
        targetLanguage: 'typescript',
        testFramework: options.preferredFramework || 'bun',
        validationGates: [
          { name: 'prettier', status: 'pending' },
          { name: 'typescript', status: 'pending' },
          { name: 'framework', status: 'pending' },
          { name: 'syntax', status: 'pending' }
        ]
      };

      logger.info(`Converted ${scenarios.length} scenarios from ${sourceFile}`);

      return {
        version: '1.0.0',
        sourceFile,
        timestamp: this.timestamp,
        scenarios,
        metadata,
      };

    } catch (error) {
      throw new IRProcessingError(
        `Failed to convert CUE export to IR: ${error instanceof Error ? error.message : String(error)}`,
        'conversion_failed',
        { sourceFile, error }
      );
    }
  }

  /**
   * Convert CUE schema to normalized IR schema
   */
  convertSchema(cueSchema: CUESchema): SchemaIR {
    // Detect CUE constructs
    const constructs = this.analyzeCUEConstructs(cueSchema);
    
    // Normalize type
    const kind = this.determineSchemaKind(cueSchema);
    const type = this.normalizeType(cueSchema, kind);

    const schema: SchemaIR = {
      kind,
      type,
      required: true, // Will be overridden by parent context
      open: constructs.openStructs,
      nullable: this.isNullable(cueSchema),
      constraints: this.extractConstraints(cueSchema),
      metadata: {
        cueConstructs: constructs,
        originalType: cueSchema.type,
      }
    };

    // Handle composite types
    switch (kind) {
      case 'object':
        schema.fields = this.convertObjectFields(cueSchema);
        break;
      case 'array':
        if (cueSchema.items) {
          schema.items = this.convertSchema(cueSchema.items);
        }
        break;
      case 'union':
        schema.alternatives = this.convertUnionAlternatives(cueSchema);
        break;
      case 'intersection':
        schema.alternatives = this.convertIntersectionTypes(cueSchema);
        break;
    }

    return schema;
  }

  /**
   * Extract scenarios from CUE export
   */
  private extractScenarios(cueExport: CUEExport): RawScenario[] {
    const scenarios: RawScenario[] = [];

    // Look for scenario patterns in the export
    for (const [key, value] of Object.entries(cueExport)) {
      if (key.includes('scenario') || key.includes('test')) {
        if (typeof value === 'object' && value !== null) {
          scenarios.push({
            name: key,
            description: this.extractDescription(value),
            schema: value as CUESchema,
            priority: this.extractPriority(value),
            type: this.determineTestType(key, value),
          });
        }
      }
    }

    // If no explicit scenarios found, create one from the root schema
    if (scenarios.length === 0) {
      scenarios.push({
        name: 'root_schema_validation',
        description: 'Validate root schema properties',
        schema: cueExport as CUESchema,
        priority: 'p1',
        type: 'unit',
      });
    }

    return scenarios;
  }

  /**
   * Convert raw scenario to IR scenario
   */
  private async convertScenario(rawScenario: RawScenario): Promise<ScenarioIR> {
    const schema = this.convertSchema(rawScenario.schema);
    
    const scenario: ScenarioIR = {
      id: this.generateScenarioId(rawScenario.name),
      name: rawScenario.name,
      description: rawScenario.description,
      priority: rawScenario.priority,
      type: rawScenario.type,
      framework: this.selectFramework(rawScenario.type),
      schema,
      assertions: this.generateAssertions(schema),
    };

    return scenario;
  }

  /**
   * Generate appropriate assertions for schema
   */
  private generateAssertions(schema: SchemaIR): AssertionIR[] {
    const assertions: AssertionIR[] = [];

    // Always include schema validation
    assertions.push({
      type: 'schema-validation',
      description: 'Validates that sample data conforms to schema',
      predicate: 'validateSchema',
      params: { schema: schema.type }
    });

    // Add type-specific assertions
    switch (schema.kind) {
      case 'object':
        if (schema.open) {
          assertions.push({
            type: 'property-based',
            description: 'Accepts unknown properties (open struct)',
            predicate: 'acceptsUnknownKeys',
            params: {}
          });
        } else {
          assertions.push({
            type: 'property-based',
            description: 'Rejects unknown properties (closed struct)',
            predicate: 'rejectsUnknownKeys',
            params: {}
          });
        }
        break;

      case 'union':
        assertions.push({
          type: 'property-based',
          description: 'Validates union alternatives',
          predicate: 'validateUnion',
          params: { alternatives: schema.alternatives?.length || 0 }
        });
        break;

      case 'array':
        assertions.push({
          type: 'edge-case',
          description: 'Handles empty arrays',
          predicate: 'validateEmptyArray',
          params: {}
        });
        break;
    }

    // Add constraint-based assertions
    if (schema.constraints) {
      assertions.push(...this.generateConstraintAssertions(schema.constraints));
    }

    return assertions;
  }

  /**
   * Generate assertions for constraints
   */
  private generateConstraintAssertions(constraints: ConstraintIR): AssertionIR[] {
    const assertions: AssertionIR[] = [];

    if (constraints.minimum !== undefined || constraints.maximum !== undefined) {
      assertions.push({
        type: 'edge-case',
        description: 'Validates numeric bounds',
        predicate: 'validateNumericBounds',
        params: {
          min: constraints.minimum,
          max: constraints.maximum
        }
      });
    }

    if (constraints.minLength !== undefined || constraints.maxLength !== undefined) {
      assertions.push({
        type: 'edge-case',
        description: 'Validates length constraints',
        predicate: 'validateLengthConstraints',
        params: {
          minLength: constraints.minLength,
          maxLength: constraints.maxLength
        }
      });
    }

    if (constraints.pattern) {
      assertions.push({
        type: 'property-based',
        description: 'Validates pattern matching',
        predicate: 'validatePattern',
        params: { pattern: constraints.pattern }
      });
    }

    if (constraints.enum && constraints.enum.length > 0) {
      assertions.push({
        type: 'property-based',
        description: 'Validates enumeration values',
        predicate: 'validateEnum',
        params: { values: constraints.enum }
      });
    }

    return assertions;
  }

  /**
   * Create skipped scenario for failed conversions
   */
  private createSkippedScenario(rawScenario: RawScenario, error: unknown): ScenarioIR {
    return {
      id: this.generateScenarioId(rawScenario.name),
      name: `${rawScenario.name} (SKIPPED)`,
      description: `Skipped due to conversion error: ${error instanceof Error ? error.message : String(error)}`,
      priority: 'p2',
      type: 'unit',
      framework: 'bun',
      schema: {
        kind: 'primitive',
        type: 'unknown',
        required: false,
        open: false,
        nullable: true,
      },
      assertions: [{
        type: 'schema-validation',
        description: 'TODO: Fix conversion error',
        predicate: 'skip',
        params: { reason: String(error) }
      }],
    };
  }

  // Helper methods

  private analyzeCUEConstructs(schema: CUESchema): CUEConstructs {
    return {
      openStructs: Boolean(schema['...']),
      disjunctions: this.extractDisjunctions(schema),
      defaults: this.extractDefaults(schema),
      constraints: this.extractConstraints(schema) ? [this.extractConstraints(schema)!] : [],
      references: this.extractReferences(schema),
    };
  }

  private determineSchemaKind(schema: CUESchema): SchemaIR['kind'] {
    if (schema.anyOf || schema.oneOf || this.hasDisjunction(schema)) {
      return 'union';
    }
    if (schema.allOf) {
      return 'intersection';
    }
    if (schema.properties || schema.type === 'object') {
      return 'object';
    }
    if (schema.items || schema.type === 'array') {
      return 'array';
    }
    return 'primitive';
  }

  private normalizeType(schema: CUESchema, kind: SchemaIR['kind']): string {
    if (schema.type) {
      return schema.type;
    }
    
    switch (kind) {
      case 'object': return 'object';
      case 'array': return 'array';
      case 'union': return 'union';
      case 'intersection': return 'intersection';
      default: return 'unknown';
    }
  }

  private isNullable(schema: CUESchema): boolean {
    return schema.type === 'null' || 
           (Array.isArray(schema.anyOf) && schema.anyOf.some(s => s.type === 'null'));
  }

  private extractConstraints(schema: CUESchema): ConstraintIR | undefined {
    const constraints: ConstraintIR = {};
    let hasConstraints = false;

    if (schema.minimum !== undefined) {
      constraints.minimum = schema.minimum;
      hasConstraints = true;
    }
    if (schema.maximum !== undefined) {
      constraints.maximum = schema.maximum;
      hasConstraints = true;
    }
    if (schema.minLength !== undefined) {
      constraints.minLength = schema.minLength;
      hasConstraints = true;
    }
    if (schema.maxLength !== undefined) {
      constraints.maxLength = schema.maxLength;
      hasConstraints = true;
    }
    if (schema.pattern) {
      constraints.pattern = schema.pattern;
      hasConstraints = true;
    }
    if (schema.format) {
      constraints.format = schema.format;
      hasConstraints = true;
    }
    if (schema.enum) {
      constraints.enum = schema.enum;
      hasConstraints = true;
    }

    return hasConstraints ? constraints : undefined;
  }

  private convertObjectFields(schema: CUESchema): Record<string, SchemaIR> | undefined {
    if (!schema.properties) return undefined;

    const fields: Record<string, SchemaIR> = {};
    const required = new Set(schema.required || []);

    for (const [fieldName, fieldSchema] of Object.entries(schema.properties)) {
      const fieldIR = this.convertSchema(fieldSchema);
      fieldIR.required = required.has(fieldName);
      fields[fieldName] = fieldIR;
    }

    return fields;
  }

  private convertUnionAlternatives(schema: CUESchema): SchemaIR[] | undefined {
    const alternatives: SchemaIR[] = [];

    if (schema.anyOf) {
      alternatives.push(...schema.anyOf.map(s => this.convertSchema(s)));
    }
    if (schema.oneOf) {
      alternatives.push(...schema.oneOf.map(s => this.convertSchema(s)));
    }

    return alternatives.length > 0 ? alternatives : undefined;
  }

  private convertIntersectionTypes(schema: CUESchema): SchemaIR[] | undefined {
    if (!schema.allOf) return undefined;
    return schema.allOf.map(s => this.convertSchema(s));
  }

  private extractDisjunctions(schema: CUESchema): SchemaIR[] {
    const disjunctions: SchemaIR[] = [];
    if (schema.anyOf) {
      disjunctions.push(...schema.anyOf.map(s => this.convertSchema(s)));
    }
    if (schema.oneOf) {
      disjunctions.push(...schema.oneOf.map(s => this.convertSchema(s)));
    }
    return disjunctions;
  }

  private extractDefaults(schema: CUESchema): Record<string, unknown> {
    const defaults: Record<string, unknown> = {};
    if (schema.default !== undefined) {
      defaults._default = schema.default;
    }
    return defaults;
  }

  private extractReferences(schema: CUESchema): string[] {
    const references: string[] = [];
    if (schema['#ref']) {
      references.push(schema['#ref']);
    }
    return references;
  }

  private hasDisjunction(schema: CUESchema): boolean {
    return Boolean(schema.anyOf || schema.oneOf);
  }

  private extractDescription(value: unknown): string {
    if (typeof value === 'object' && value !== null) {
      const obj = value as Record<string, unknown>;
      if (typeof obj.description === 'string') {
        return obj.description;
      }
      if (typeof obj.title === 'string') {
        return obj.title;
      }
    }
    return 'Generated test scenario';
  }

  private extractPriority(value: unknown): 'p0' | 'p1' | 'p2' {
    if (typeof value === 'object' && value !== null) {
      const obj = value as Record<string, unknown>;
      const priority = obj.priority || obj.level;
      if (priority === 'critical' || priority === 'p0' || priority === 0) return 'p0';
      if (priority === 'high' || priority === 'p1' || priority === 1) return 'p1';
    }
    return 'p2';
  }

  private determineTestType(key: string, value: unknown): 'unit' | 'integration' | 'e2e' {
    if (key.includes('e2e') || key.includes('end-to-end')) return 'e2e';
    if (key.includes('integration') || key.includes('api')) return 'integration';
    return 'unit';
  }

  private selectFramework(testType: 'unit' | 'integration' | 'e2e'): 'bun' | 'playwright' | 'vitest' {
    switch (testType) {
      case 'e2e': return 'playwright';
      case 'integration': return 'bun';
      case 'unit': return 'bun';
      default: return 'bun';
    }
  }

  private generateScenarioId(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .substring(0, 50);
  }
}

// Supporting interfaces

interface IRConversionOptions {
  preferredFramework?: 'bun' | 'playwright' | 'vitest';
  strict?: boolean;
  skipInvalid?: boolean;
}

interface RawScenario {
  name: string;
  description: string;
  schema: CUESchema;
  priority: 'p0' | 'p1' | 'p2';
  type: 'unit' | 'integration' | 'e2e';
}

export { IRConverter, type IRConversionOptions, type CUESchema };
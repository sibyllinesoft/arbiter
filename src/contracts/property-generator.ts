/**
 * Property-based test generator using fast-check with CUE schema integration
 */

import * as fc from 'fast-check';
import { logger } from '../utils/logger.js';
import {
  ContractDefinition,
  ContractTestSuite,
  GeneratedProperty,
  PropertyTestConfig,
  CueSchema,
  MetamorphicLaw,
  ContractCondition,
  ContractInvariant,
  ContractError
} from './types.js';

export class PropertyGenerator {
  private readonly defaultConfig: PropertyTestConfig = {
    numRuns: 100,
    timeout: 5000,
    maxShrinks: 1000,
    skipAllAfterTimeLimit: 10000,
    interruptAfterTimeLimit: 15000,
    markInterruptAsFailure: false,
  };

  /**
   * Generate comprehensive property test suite from contract definition
   */
  async generateTestSuite(
    contract: ContractDefinition,
    config: Partial<PropertyTestConfig> = {}
  ): Promise<ContractTestSuite> {
    try {
      logger.info(`Generating property test suite for contract: ${contract.id}`);

      const properties: GeneratedProperty[] = [];
      const testConfig = { ...this.defaultConfig, ...config };

      // Generate properties for pre-conditions
      for (const preCondition of contract.preConditions) {
        const property = await this.generatePreConditionProperty(contract, preCondition);
        if (property) {
          properties.push(property);
        }
      }

      // Generate properties for post-conditions
      for (const postCondition of contract.postConditions) {
        const property = await this.generatePostConditionProperty(contract, postCondition);
        if (property) {
          properties.push(property);
        }
      }

      // Generate properties for metamorphic laws
      for (const law of contract.metamorphicLaws) {
        const property = await this.generateMetamorphicProperty(contract, law);
        if (property) {
          properties.push(property);
        }
      }

      // Generate properties for invariants
      for (const invariant of contract.invariants) {
        const property = await this.generateInvariantProperty(contract, invariant);
        if (property) {
          properties.push(property);
        }
      }

      logger.info(`Generated ${properties.length} properties for contract ${contract.id}`);

      return {
        contractId: contract.id,
        properties,
        config: testConfig,
      };

    } catch (error) {
      logger.error(`Failed to generate test suite for ${contract.id}: ${error}`);
      throw new ContractError(
        `Test suite generation failed: ${error instanceof Error ? error.message : String(error)}`,
        contract.id,
        'test-generation',
        { originalError: error }
      );
    }
  }

  /**
   * Generate fast-check arbitrary from CUE schema
   */
  generateArbitrary(schema: CueSchema): fc.Arbitrary<any> {
    switch (schema.type) {
      case 'string':
        return this.generateStringArbitrary(schema);
      case 'number':
      case 'integer':
        return this.generateNumberArbitrary(schema);
      case 'boolean':
        return fc.boolean();
      case 'array':
        return this.generateArrayArbitrary(schema);
      case 'object':
        return this.generateObjectArbitrary(schema);
      case 'null':
        return fc.constant(null);
      default:
        logger.warn(`Unknown schema type: ${schema.type}, using fc.anything()`);
        return fc.anything();
    }
  }

  /**
   * Generate string arbitrary with constraints
   */
  private generateStringArbitrary(schema: CueSchema): fc.Arbitrary<string> {
    let stringArb = fc.string();

    if (schema.minLength !== undefined || schema.maxLength !== undefined) {
      const minLength = schema.minLength ?? 0;
      const maxLength = schema.maxLength ?? 100;
      stringArb = fc.string({ minLength, maxLength });
    }

    if (schema.pattern) {
      // For complex patterns, we'll use a simplified approach
      // In production, you might want to use a library like randexp
      logger.debug(`Pattern constraint detected: ${schema.pattern}`);
      // For now, return basic string and let validation catch pattern issues
    }

    if (schema.format) {
      switch (schema.format) {
        case 'email':
          return fc.emailAddress();
        case 'uuid':
          return fc.uuid();
        case 'date':
          return fc.date().map(d => d.toISOString().split('T')[0]);
        case 'datetime':
          return fc.date().map(d => d.toISOString());
        case 'uri':
          return fc.webUrl();
        default:
          logger.warn(`Unknown string format: ${schema.format}`);
      }
    }

    if (schema.enum) {
      return fc.constantFrom(...schema.enum.filter(v => typeof v === 'string'));
    }

    return stringArb;
  }

  /**
   * Generate number arbitrary with constraints
   */
  private generateNumberArbitrary(schema: CueSchema): fc.Arbitrary<number> {
    const min = schema.minimum ?? (schema.type === 'integer' ? -1000 : -1000.0);
    const max = schema.maximum ?? (schema.type === 'integer' ? 1000 : 1000.0);

    if (schema.type === 'integer') {
      return fc.integer({ min: Math.floor(min), max: Math.floor(max) });
    } else {
      return fc.float({ min, max });
    }
  }

  /**
   * Generate array arbitrary with item schema
   */
  private generateArrayArbitrary(schema: CueSchema): fc.Arbitrary<any[]> {
    if (!schema.items) {
      return fc.array(fc.anything());
    }

    const itemArbitrary = this.generateArbitrary(schema.items);
    const minLength = schema.minLength ?? 0;
    const maxLength = schema.maxLength ?? 10;

    return fc.array(itemArbitrary, { minLength, maxLength });
  }

  /**
   * Generate object arbitrary with property schemas
   */
  private generateObjectArbitrary(schema: CueSchema): fc.Arbitrary<Record<string, any>> {
    if (!schema.properties) {
      return fc.record({});
    }

    const requiredFields = schema.required ?? [];
    const propertyArbitraries: Record<string, fc.Arbitrary<any>> = {};

    // Generate arbitraries for all properties
    for (const [propName, propSchema] of Object.entries(schema.properties)) {
      const propArbitrary = this.generateArbitrary(propSchema);
      
      if (requiredFields.includes(propName)) {
        propertyArbitraries[propName] = propArbitrary;
      } else {
        // Optional properties have a chance to be undefined
        propertyArbitraries[propName] = fc.option(propArbitrary);
      }
    }

    return fc.record(propertyArbitraries);
  }

  /**
   * Generate property for pre-condition validation
   */
  private async generatePreConditionProperty(
    contract: ContractDefinition,
    condition: ContractCondition
  ): Promise<GeneratedProperty | null> {
    try {
      const inputArbitrary = this.generateArbitrary(contract.inputSchema);

      return {
        name: `pre_condition_${condition.name}`,
        description: `Pre-condition: ${condition.description}`,
        type: 'pre-condition',
        arbitrary: inputArbitrary,
        predicate: (input: any) => {
          return this.evaluateConditionExpression(condition.expression, { input });
        },
        shrinkable: true,
      };
    } catch (error) {
      logger.error(`Failed to generate pre-condition property for ${condition.name}: ${error}`);
      return null;
    }
  }

  /**
   * Generate property for post-condition validation
   */
  private async generatePostConditionProperty(
    contract: ContractDefinition,
    condition: ContractCondition
  ): Promise<GeneratedProperty | null> {
    try {
      const inputArbitrary = this.generateArbitrary(contract.inputSchema);
      const outputArbitrary = this.generateArbitrary(contract.outputSchema);
      
      const combinedArbitrary = fc.tuple(inputArbitrary, outputArbitrary);

      return {
        name: `post_condition_${condition.name}`,
        description: `Post-condition: ${condition.description}`,
        type: 'post-condition',
        arbitrary: combinedArbitrary,
        predicate: ([input, output]: [any, any]) => {
          return this.evaluateConditionExpression(condition.expression, { input, output });
        },
        shrinkable: true,
      };
    } catch (error) {
      logger.error(`Failed to generate post-condition property for ${condition.name}: ${error}`);
      return null;
    }
  }

  /**
   * Generate property for metamorphic law validation
   */
  private async generateMetamorphicProperty(
    contract: ContractDefinition,
    law: MetamorphicLaw
  ): Promise<GeneratedProperty | null> {
    try {
      const inputArbitrary = this.generateArbitrary(contract.inputSchema);

      return {
        name: `metamorphic_law_${law.name}`,
        description: `Metamorphic law: ${law.description}`,
        type: 'metamorphic-law',
        arbitrary: inputArbitrary,
        predicate: (input: any) => {
          // Apply transformation to get second input
          const transformedInput = this.applyTransformation(input, law.transformation);
          
          // Evaluate source and target expressions
          const sourceResult = this.evaluateExpression(law.sourceExpression, { input });
          const targetResult = this.evaluateExpression(law.targetExpression, { input: transformedInput });
          
          // Check metamorphic relationship
          return this.checkMetamorphicRelation(sourceResult, targetResult, law);
        },
        shrinkable: true,
      };
    } catch (error) {
      logger.error(`Failed to generate metamorphic property for ${law.name}: ${error}`);
      return null;
    }
  }

  /**
   * Generate property for invariant validation
   */
  private async generateInvariantProperty(
    contract: ContractDefinition,
    invariant: ContractInvariant
  ): Promise<GeneratedProperty | null> {
    try {
      const inputArbitrary = this.generateArbitrary(contract.inputSchema);
      const outputArbitrary = this.generateArbitrary(contract.outputSchema);
      
      const combinedArbitrary = fc.tuple(inputArbitrary, outputArbitrary);

      return {
        name: `invariant_${invariant.name}`,
        description: `Invariant: ${invariant.description}`,
        type: 'invariant',
        arbitrary: combinedArbitrary,
        predicate: ([input, output]: [any, any]) => {
          return this.evaluateConditionExpression(invariant.expression, { input, output });
        },
        shrinkable: true,
      };
    } catch (error) {
      logger.error(`Failed to generate invariant property for ${invariant.name}: ${error}`);
      return null;
    }
  }

  /**
   * Generate edge case tests for boundary values
   */
  generateEdgeCaseTests(schema: CueSchema): fc.Arbitrary<any>[] {
    const edgeCases: fc.Arbitrary<any>[] = [];

    switch (schema.type) {
      case 'string':
        edgeCases.push(
          fc.constant(''),
          fc.constant(' '),
          fc.constant('\n\t\r'),
          fc.string({ minLength: 1, maxLength: 1 }),
          fc.string({ minLength: 1000, maxLength: 1000 })
        );
        break;
        
      case 'number':
      case 'integer':
        const isInteger = schema.type === 'integer';
        edgeCases.push(
          fc.constant(0),
          fc.constant(isInteger ? 1 : 1.0),
          fc.constant(isInteger ? -1 : -1.0),
          fc.constant(isInteger ? Number.MAX_SAFE_INTEGER : Number.MAX_VALUE),
          fc.constant(isInteger ? Number.MIN_SAFE_INTEGER : -Number.MAX_VALUE)
        );
        
        if (schema.minimum !== undefined) {
          edgeCases.push(fc.constant(schema.minimum));
        }
        if (schema.maximum !== undefined) {
          edgeCases.push(fc.constant(schema.maximum));
        }
        break;
        
      case 'array':
        edgeCases.push(
          fc.constant([]),
          fc.constant([null]),
          fc.constant([undefined])
        );
        break;
        
      case 'object':
        edgeCases.push(
          fc.constant({}),
          fc.constant({ [Symbol('test')]: 'symbol key' })
        );
        break;
    }

    return edgeCases;
  }

  /**
   * Evaluate condition expression with context
   */
  private evaluateConditionExpression(expression: string, context: Record<string, any>): boolean {
    try {
      // This is a simplified expression evaluator
      // In production, you'd want a more robust and secure expression parser
      const func = new Function(...Object.keys(context), `return ${expression}`);
      return Boolean(func(...Object.values(context)));
    } catch (error) {
      logger.warn(`Failed to evaluate expression: ${expression}`, error);
      return false;
    }
  }

  /**
   * Evaluate expression and return result
   */
  private evaluateExpression(expression: string, context: Record<string, any>): any {
    try {
      const func = new Function(...Object.keys(context), `return ${expression}`);
      return func(...Object.values(context));
    } catch (error) {
      logger.warn(`Failed to evaluate expression: ${expression}`, error);
      return null;
    }
  }

  /**
   * Apply transformation to input data
   */
  private applyTransformation(input: any, transformation: string): any {
    try {
      // Simple transformation evaluator
      const func = new Function('input', `return ${transformation}`);
      return func(input);
    } catch (error) {
      logger.warn(`Failed to apply transformation: ${transformation}`, error);
      return input;
    }
  }

  /**
   * Check metamorphic relationship between source and target results
   */
  private checkMetamorphicRelation(
    sourceResult: any,
    targetResult: any,
    law: MetamorphicLaw
  ): boolean {
    try {
      // Default relationship check - equality
      if (typeof sourceResult === 'number' && typeof targetResult === 'number') {
        // For numeric values, check approximate equality
        const tolerance = 1e-10;
        return Math.abs(sourceResult - targetResult) < tolerance;
      }
      
      // For other types, use deep equality
      return JSON.stringify(sourceResult) === JSON.stringify(targetResult);
    } catch (error) {
      logger.warn(`Failed to check metamorphic relation for ${law.name}`, error);
      return false;
    }
  }

  /**
   * Generate shrinking strategies for complex data types
   */
  generateShrinkingStrategies(schema: CueSchema): fc.Arbitrary<any> {
    const baseArbitrary = this.generateArbitrary(schema);
    
    // Add custom shrinking for specific types
    if (schema.type === 'object' && schema.properties) {
      // Shrink objects by removing optional properties first
      return baseArbitrary;
    }
    
    if (schema.type === 'array') {
      // Arrays already have good shrinking built into fast-check
      return baseArbitrary;
    }
    
    return baseArbitrary;
  }
}
/**
 * Contract validator for pre/post conditions and metamorphic laws
 */

import { logger } from '../utils/logger.js';
import {
  ContractDefinition,
  ContractCondition,
  ContractViolation,
  ContractExecutionContext,
  MetamorphicLaw,
  ContractInvariant,
  ContractValidationError
} from './types.js';

export class ContractValidator {
  private violationCounter = 0;

  /**
   * Validate pre-conditions before function execution
   */
  async validatePreConditions(
    contract: ContractDefinition,
    input: any,
    context: ContractExecutionContext
  ): Promise<ContractViolation[]> {
    const violations: ContractViolation[] = [];

    try {
      logger.debug(`Validating pre-conditions for contract: ${contract.id}`);

      for (const condition of contract.preConditions) {
        try {
          const isValid = await this.evaluateCondition(condition, { input }, context);
          
          if (!isValid) {
            violations.push(this.createViolation(
              contract.id,
              'pre-condition',
              condition,
              `Pre-condition '${condition.name}' failed`,
              { input },
              context
            ));
          }
        } catch (error) {
          violations.push(this.createViolation(
            contract.id,
            'pre-condition',
            condition,
            `Pre-condition '${condition.name}' evaluation error: ${error instanceof Error ? error.message : String(error)}`,
            { input, error: String(error) },
            context
          ));
        }
      }

      if (violations.length > 0) {
        logger.warn(`Pre-condition violations detected for ${contract.id}:`, {
          count: violations.length,
          conditions: violations.map(v => v.conditionName)
        });
      }

    } catch (error) {
      logger.error(`Pre-condition validation failed for ${contract.id}:`, error);
      violations.push(this.createViolation(
        contract.id,
        'pre-condition',
        { name: 'validation_error', description: 'System error', expression: '', severity: 'error' as const },
        `Pre-condition validation system error: ${error instanceof Error ? error.message : String(error)}`,
        { input, systemError: String(error) },
        context
      ));
    }

    return violations;
  }

  /**
   * Validate post-conditions after function execution
   */
  async validatePostConditions(
    contract: ContractDefinition,
    input: any,
    output: any,
    context: ContractExecutionContext
  ): Promise<ContractViolation[]> {
    const violations: ContractViolation[] = [];

    try {
      logger.debug(`Validating post-conditions for contract: ${contract.id}`);

      for (const condition of contract.postConditions) {
        try {
          const isValid = await this.evaluateCondition(condition, { input, output }, context);
          
          if (!isValid) {
            violations.push(this.createViolation(
              contract.id,
              'post-condition',
              condition,
              `Post-condition '${condition.name}' failed`,
              { input, output },
              context
            ));
          }
        } catch (error) {
          violations.push(this.createViolation(
            contract.id,
            'post-condition',
            condition,
            `Post-condition '${condition.name}' evaluation error: ${error instanceof Error ? error.message : String(error)}`,
            { input, output, error: String(error) },
            context
          ));
        }
      }

      if (violations.length > 0) {
        logger.warn(`Post-condition violations detected for ${contract.id}:`, {
          count: violations.length,
          conditions: violations.map(v => v.conditionName)
        });
      }

    } catch (error) {
      logger.error(`Post-condition validation failed for ${contract.id}:`, error);
      violations.push(this.createViolation(
        contract.id,
        'post-condition',
        { name: 'validation_error', description: 'System error', expression: '', severity: 'error' as const },
        `Post-condition validation system error: ${error instanceof Error ? error.message : String(error)}`,
        { input, output, systemError: String(error) },
        context
      ));
    }

    return violations;
  }

  /**
   * Validate metamorphic laws
   */
  async validateMetamorphicLaws(
    contract: ContractDefinition,
    input: any,
    output: any,
    context: ContractExecutionContext
  ): Promise<ContractViolation[]> {
    const violations: ContractViolation[] = [];

    try {
      logger.debug(`Validating metamorphic laws for contract: ${contract.id}`);

      for (const law of contract.metamorphicLaws) {
        try {
          const violation = await this.validateMetamorphicLaw(contract.id, law, input, output, context);
          if (violation) {
            violations.push(violation);
          }
        } catch (error) {
          violations.push(this.createViolation(
            contract.id,
            'metamorphic-law',
            { name: law.name, description: law.description, expression: law.sourceExpression, severity: 'error' as const },
            `Metamorphic law '${law.name}' evaluation error: ${error instanceof Error ? error.message : String(error)}`,
            { input, output, law: law.name, error: String(error) },
            context
          ));
        }
      }

      if (violations.length > 0) {
        logger.warn(`Metamorphic law violations detected for ${contract.id}:`, {
          count: violations.length,
          laws: violations.map(v => v.conditionName)
        });
      }

    } catch (error) {
      logger.error(`Metamorphic law validation failed for ${contract.id}:`, error);
      violations.push(this.createViolation(
        contract.id,
        'metamorphic-law',
        { name: 'validation_error', description: 'System error', expression: '', severity: 'error' as const },
        `Metamorphic law validation system error: ${error instanceof Error ? error.message : String(error)}`,
        { input, output, systemError: String(error) },
        context
      ));
    }

    return violations;
  }

  /**
   * Validate invariants
   */
  async validateInvariants(
    contract: ContractDefinition,
    context: ContractExecutionContext
  ): Promise<ContractViolation[]> {
    const violations: ContractViolation[] = [];

    try {
      logger.debug(`Validating invariants for contract: ${contract.id}`);

      for (const invariant of contract.invariants) {
        try {
          const isValid = await this.evaluateInvariant(invariant, context);
          
          if (!isValid) {
            violations.push(this.createViolation(
              contract.id,
              'invariant',
              { 
                name: invariant.name, 
                description: invariant.description, 
                expression: invariant.expression, 
                severity: 'error' as const 
              },
              `Invariant '${invariant.name}' violated`,
              { invariant: invariant.name, scope: invariant.scope },
              context
            ));
          }
        } catch (error) {
          violations.push(this.createViolation(
            contract.id,
            'invariant',
            { 
              name: invariant.name, 
              description: invariant.description, 
              expression: invariant.expression, 
              severity: 'error' as const 
            },
            `Invariant '${invariant.name}' evaluation error: ${error instanceof Error ? error.message : String(error)}`,
            { invariant: invariant.name, error: String(error) },
            context
          ));
        }
      }

      if (violations.length > 0) {
        logger.warn(`Invariant violations detected for ${contract.id}:`, {
          count: violations.length,
          invariants: violations.map(v => v.conditionName)
        });
      }

    } catch (error) {
      logger.error(`Invariant validation failed for ${contract.id}:`, error);
      violations.push(this.createViolation(
        contract.id,
        'invariant',
        { name: 'validation_error', description: 'System error', expression: '', severity: 'error' as const },
        `Invariant validation system error: ${error instanceof Error ? error.message : String(error)}`,
        { systemError: String(error) },
        context
      ));
    }

    return violations;
  }

  /**
   * Validate a single metamorphic law
   */
  private async validateMetamorphicLaw(
    contractId: string,
    law: MetamorphicLaw,
    input: any,
    output: any,
    context: ContractExecutionContext
  ): Promise<ContractViolation | null> {
    try {
      // Apply transformation to create second input
      const transformedInput = this.applyTransformation(input, law.transformation);
      
      // Get the function being tested (this would need to be passed in or resolved)
      const targetFunction = this.resolveTargetFunction(context.functionName);
      
      if (!targetFunction) {
        logger.warn(`Cannot resolve target function: ${context.functionName}`);
        return null;
      }

      // Execute function with transformed input
      const transformedOutput = await targetFunction(transformedInput);

      // Evaluate source expression with original input/output
      const sourceResult = this.evaluateExpression(law.sourceExpression, { input, output });
      
      // Evaluate target expression with transformed input/output
      const targetResult = this.evaluateExpression(law.targetExpression, { 
        input: transformedInput, 
        output: transformedOutput 
      });

      // Check if metamorphic relationship holds
      const relationHolds = this.checkMetamorphicRelation(sourceResult, targetResult, law);

      if (!relationHolds) {
        return this.createViolation(
          contractId,
          'metamorphic-law',
          { 
            name: law.name, 
            description: law.description, 
            expression: `${law.sourceExpression} ~ ${law.targetExpression}`, 
            severity: 'error' as const 
          },
          `Metamorphic law '${law.name}' violated: ${law.transformation}`,
          { 
            originalInput: input,
            transformedInput,
            originalOutput: output,
            transformedOutput,
            sourceResult,
            targetResult,
            expectedRelation: law.transformation
          },
          context
        );
      }

      return null;
    } catch (error) {
      throw new ContractValidationError(
        `Metamorphic law validation failed: ${error instanceof Error ? error.message : String(error)}`,
        contractId,
        { law: law.name, originalError: error }
      );
    }
  }

  /**
   * Evaluate a condition expression
   */
  private async evaluateCondition(
    condition: ContractCondition,
    variables: Record<string, any>,
    context: ContractExecutionContext
  ): Promise<boolean> {
    try {
      // Enhanced expression evaluation with additional context
      const evaluationContext = {
        ...variables,
        context: context.metadata,
        state: context.state || {},
      };

      // Use safe expression evaluator
      return this.safeEvaluateExpression(condition.expression, evaluationContext);
    } catch (error) {
      logger.error(`Condition evaluation failed for '${condition.name}':`, error);
      throw error;
    }
  }

  /**
   * Evaluate an invariant
   */
  private async evaluateInvariant(
    invariant: ContractInvariant,
    context: ContractExecutionContext
  ): Promise<boolean> {
    try {
      const evaluationContext = {
        input: context.input,
        output: context.output,
        state: context.state || {},
        context: context.metadata,
        scope: invariant.scope,
      };

      return this.safeEvaluateExpression(invariant.expression, evaluationContext);
    } catch (error) {
      logger.error(`Invariant evaluation failed for '${invariant.name}':`, error);
      throw error;
    }
  }

  /**
   * Safe expression evaluation with sandboxing
   */
  private safeEvaluateExpression(expression: string, context: Record<string, any>): boolean {
    try {
      // Create a safer evaluation environment
      const safeContext = this.createSafeContext(context);
      
      // Use Function constructor with restricted scope
      const func = new Function(...Object.keys(safeContext), `
        'use strict';
        return Boolean(${expression});
      `);
      
      return func(...Object.values(safeContext));
    } catch (error) {
      logger.warn(`Expression evaluation failed: ${expression}`, error);
      return false;
    }
  }

  /**
   * Evaluate expression and return raw result
   */
  private evaluateExpression(expression: string, context: Record<string, any>): any {
    try {
      const safeContext = this.createSafeContext(context);
      const func = new Function(...Object.keys(safeContext), `
        'use strict';
        return ${expression};
      `);
      
      return func(...Object.values(safeContext));
    } catch (error) {
      logger.warn(`Expression evaluation failed: ${expression}`, error);
      return null;
    }
  }

  /**
   * Create safe evaluation context by sanitizing input
   */
  private createSafeContext(context: Record<string, any>): Record<string, any> {
    const safeContext: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(context)) {
      // Exclude dangerous objects and functions
      if (typeof value === 'function' && !this.isAllowedFunction(key)) {
        continue;
      }
      
      if (this.isDangerousObject(value)) {
        continue;
      }
      
      safeContext[key] = value;
    }
    
    // Add safe utility functions
    safeContext.Math = Math;
    safeContext.JSON = { parse: JSON.parse, stringify: JSON.stringify };
    safeContext.Array = { isArray: Array.isArray };
    safeContext.Object = { 
      keys: Object.keys, 
      values: Object.values, 
      entries: Object.entries 
    };
    
    return safeContext;
  }

  /**
   * Check if a function is allowed in evaluation context
   */
  private isAllowedFunction(name: string): boolean {
    const allowedFunctions = [
      'isNaN', 'isFinite', 'parseInt', 'parseFloat',
      'encodeURIComponent', 'decodeURIComponent'
    ];
    return allowedFunctions.includes(name);
  }

  /**
   * Check if an object is dangerous for evaluation
   */
  private isDangerousObject(value: any): boolean {
    if (value === null || value === undefined) {
      return false;
    }
    
    // Check for dangerous global objects
    const dangerousNames = [
      'process', 'require', 'module', 'exports', 'global',
      'window', 'document', 'console', 'eval', 'Function'
    ];
    
    const objectName = value.constructor?.name;
    return dangerousNames.includes(objectName);
  }

  /**
   * Apply transformation to input data
   */
  private applyTransformation(input: any, transformation: string): any {
    try {
      const safeContext = this.createSafeContext({ input });
      const func = new Function('input', `
        'use strict';
        return ${transformation};
      `);
      
      return func(input);
    } catch (error) {
      logger.warn(`Transformation failed: ${transformation}`, error);
      return input; // Return original input if transformation fails
    }
  }

  /**
   * Check metamorphic relationship between results
   */
  private checkMetamorphicRelation(sourceResult: any, targetResult: any, law: MetamorphicLaw): boolean {
    try {
      // Handle different types of metamorphic relationships
      if (law.transformation.includes('sort') || law.transformation.includes('reverse')) {
        // For transformations like sort/reverse, results should be equal
        return this.deepEquals(sourceResult, targetResult);
      }
      
      if (law.transformation.includes('*') || law.transformation.includes('/')) {
        // For multiplicative transformations, check proportional relationships
        if (typeof sourceResult === 'number' && typeof targetResult === 'number') {
          // Extract factor from transformation if possible
          const factorMatch = law.transformation.match(/\* *(\d+\.?\d*)/);
          if (factorMatch) {
            const factor = parseFloat(factorMatch[1]);
            const tolerance = Math.max(Math.abs(sourceResult), Math.abs(targetResult)) * 1e-10;
            return Math.abs(targetResult - (sourceResult * factor)) < tolerance;
          }
        }
      }
      
      // Default: check for equality with tolerance for floating point
      if (typeof sourceResult === 'number' && typeof targetResult === 'number') {
        const tolerance = 1e-10;
        return Math.abs(sourceResult - targetResult) < tolerance;
      }
      
      return this.deepEquals(sourceResult, targetResult);
    } catch (error) {
      logger.warn(`Metamorphic relation check failed for ${law.name}:`, error);
      return false;
    }
  }

  /**
   * Deep equality check for complex objects
   */
  private deepEquals(a: any, b: any): boolean {
    if (a === b) return true;
    
    if (a === null || b === null) return false;
    if (a === undefined || b === undefined) return false;
    
    if (typeof a !== typeof b) return false;
    
    if (typeof a === 'object') {
      if (Array.isArray(a) !== Array.isArray(b)) return false;
      
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);
      
      if (keysA.length !== keysB.length) return false;
      
      for (const key of keysA) {
        if (!keysB.includes(key)) return false;
        if (!this.deepEquals(a[key], b[key])) return false;
      }
      
      return true;
    }
    
    return false;
  }

  /**
   * Resolve target function for metamorphic testing
   * This is a placeholder - in practice, you'd need a function registry
   */
  private resolveTargetFunction(functionName: string): ((input: any) => any) | null {
    // This would typically resolve functions from a registry or module system
    logger.debug(`Resolving target function: ${functionName}`);
    
    // Placeholder implementation
    return null;
  }

  /**
   * Create a contract violation record
   */
  private createViolation(
    contractId: string,
    violationType: ContractViolation['violationType'],
    condition: Pick<ContractCondition, 'name' | 'description' | 'expression' | 'severity'>,
    message: string,
    details: Record<string, any>,
    context: ContractExecutionContext
  ): ContractViolation {
    return {
      id: `violation-${++this.violationCounter}-${Date.now()}`,
      contractId,
      violationType,
      conditionName: condition.name,
      severity: condition.severity,
      message,
      input: details.input,
      output: details.output,
      expected: details.expected,
      actual: details.actual,
      context: {
        ...context.metadata,
        ...details,
        functionName: context.functionName,
        timestamp: context.startTime.toISOString(),
      },
      timestamp: new Date(),
      stackTrace: new Error().stack,
    };
  }
}
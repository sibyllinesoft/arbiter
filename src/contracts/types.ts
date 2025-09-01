/**
 * TypeScript interfaces and types for the contract execution engine
 */

import { z } from 'zod';

export interface CueValue {
  readonly [key: string]: any;
}

export interface CueSchema {
  readonly type: string;
  readonly constraints?: Record<string, any>;
  readonly properties?: Record<string, CueSchema>;
  readonly items?: CueSchema;
  readonly required?: readonly string[];
  readonly enum?: readonly any[];
  readonly format?: string;
  readonly minimum?: number;
  readonly maximum?: number;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly pattern?: string;
}

export interface ContractCondition {
  readonly name: string;
  readonly description: string;
  readonly expression: string;
  readonly schema?: CueSchema;
  readonly severity: 'error' | 'warning' | 'info';
  readonly metadata?: Record<string, any>;
}

export interface MetamorphicLaw {
  readonly name: string;
  readonly description: string;
  readonly sourceExpression: string;
  readonly targetExpression: string;
  readonly transformation: string;
  readonly invariants?: readonly string[];
  readonly examples?: readonly MetamorphicExample[];
}

export interface MetamorphicExample {
  readonly input: any;
  readonly transformedInput: any;
  readonly expectedRelation: string;
}

export interface ContractInvariant {
  readonly name: string;
  readonly description: string;
  readonly expression: string;
  readonly scope: 'global' | 'local' | 'function';
  readonly checkFrequency: 'always' | 'periodic' | 'on-change';
}

export interface ContractDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly version: string;
  readonly target: string; // Function, class, or system being contracted
  readonly inputSchema: CueSchema;
  readonly outputSchema: CueSchema;
  readonly preConditions: readonly ContractCondition[];
  readonly postConditions: readonly ContractCondition[];
  readonly metamorphicLaws: readonly MetamorphicLaw[];
  readonly invariants: readonly ContractInvariant[];
  readonly metadata: Record<string, any>;
  readonly tags: readonly string[];
}

export interface ContractViolation {
  readonly id: string;
  readonly contractId: string;
  readonly violationType: 'pre-condition' | 'post-condition' | 'metamorphic-law' | 'invariant';
  readonly conditionName: string;
  readonly severity: 'error' | 'warning' | 'info';
  readonly message: string;
  readonly input?: any;
  readonly output?: any;
  readonly expected?: any;
  readonly actual?: any;
  readonly context: Record<string, any>;
  readonly timestamp: Date;
  readonly stackTrace?: string;
}

export interface ContractExecutionResult {
  readonly contractId: string;
  readonly success: boolean;
  readonly violations: readonly ContractViolation[];
  readonly metrics: ContractMetrics;
  readonly duration: number;
  readonly timestamp: Date;
}

export interface ContractMetrics {
  readonly totalTests: number;
  readonly passedTests: number;
  readonly failedTests: number;
  readonly coverage: number;
  readonly preConditionChecks: number;
  readonly postConditionChecks: number;
  readonly metamorphicLawChecks: number;
  readonly invariantChecks: number;
}

export interface PropertyTestResult {
  readonly success: boolean;
  readonly numTests: number;
  readonly numShrinks: number;
  readonly seed: number;
  readonly counterExample?: any;
  readonly shrunkCounterExample?: any;
  readonly error?: string;
}

export interface PropertyTestConfig {
  readonly numRuns?: number;
  readonly timeout?: number;
  readonly seed?: number;
  readonly maxShrinks?: number;
  readonly skipAllAfterTimeLimit?: number;
  readonly interruptAfterTimeLimit?: number;
  readonly markInterruptAsFailure?: boolean;
}

export interface ContractTestSuite {
  readonly contractId: string;
  readonly properties: readonly GeneratedProperty[];
  readonly config: PropertyTestConfig;
}

export interface GeneratedProperty {
  readonly name: string;
  readonly description: string;
  readonly type: 'pre-condition' | 'post-condition' | 'metamorphic-law' | 'invariant';
  readonly arbitrary: any; // fast-check Arbitrary
  readonly predicate: (input: any, output?: any) => boolean;
  readonly shrinkable: boolean;
}

export interface ContractCoverage {
  readonly contractId: string;
  readonly conditionCoverage: Map<string, number>;
  readonly lawCoverage: Map<string, number>;
  readonly invariantCoverage: Map<string, number>;
  readonly overallCoverage: number;
}

export interface ContractExecutionContext {
  readonly contractId: string;
  readonly functionName: string;
  readonly input: any;
  readonly output?: any;
  readonly state?: Record<string, any>;
  readonly metadata: Record<string, any>;
  readonly startTime: Date;
  readonly endTime?: Date;
}

export interface ContractValidationOptions {
  readonly validatePreConditions?: boolean;
  readonly validatePostConditions?: boolean;
  readonly validateMetamorphicLaws?: boolean;
  readonly validateInvariants?: boolean;
  readonly generateTests?: boolean;
  readonly runTests?: boolean;
  readonly parallel?: boolean;
  readonly maxConcurrency?: number;
  readonly timeout?: number;
  readonly continueOnError?: boolean;
}

export interface ViolationReport {
  readonly id: string;
  readonly contractId: string;
  readonly summary: ViolationSummary;
  readonly violations: readonly ContractViolation[];
  readonly metrics: ContractMetrics;
  readonly recommendations: readonly string[];
  readonly generatedAt: Date;
}

export interface ViolationSummary {
  readonly totalViolations: number;
  readonly errorCount: number;
  readonly warningCount: number;
  readonly infoCount: number;
  readonly affectedContracts: number;
  readonly topViolationTypes: readonly [string, number][];
}

// Zod schemas for runtime validation
export const ContractConditionSchema = z.object({
  name: z.string(),
  description: z.string(),
  expression: z.string(),
  schema: z.any().optional(),
  severity: z.enum(['error', 'warning', 'info']),
  metadata: z.record(z.any()).optional(),
});

export const MetamorphicLawSchema = z.object({
  name: z.string(),
  description: z.string(),
  sourceExpression: z.string(),
  targetExpression: z.string(),
  transformation: z.string(),
  invariants: z.array(z.string()).optional(),
  examples: z.array(z.object({
    input: z.any(),
    transformedInput: z.any(),
    expectedRelation: z.string(),
  })).optional(),
});

export const ContractDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  version: z.string(),
  target: z.string(),
  inputSchema: z.any(),
  outputSchema: z.any(),
  preConditions: z.array(ContractConditionSchema),
  postConditions: z.array(ContractConditionSchema),
  metamorphicLaws: z.array(MetamorphicLawSchema),
  invariants: z.array(z.object({
    name: z.string(),
    description: z.string(),
    expression: z.string(),
    scope: z.enum(['global', 'local', 'function']),
    checkFrequency: z.enum(['always', 'periodic', 'on-change']),
  })),
  metadata: z.record(z.any()),
  tags: z.array(z.string()),
});

export type ContractConditionType = z.infer<typeof ContractConditionSchema>;
export type MetamorphicLawType = z.infer<typeof MetamorphicLawSchema>;
export type ContractDefinitionType = z.infer<typeof ContractDefinitionSchema>;

// Error types
export class ContractError extends Error {
  constructor(
    message: string,
    public readonly contractId: string,
    public readonly violationType: string,
    public readonly context?: Record<string, any>
  ) {
    super(message);
    this.name = 'ContractError';
  }
}

export class ContractParsingError extends ContractError {
  constructor(message: string, contractId: string, context?: Record<string, any>) {
    super(message, contractId, 'parsing', context);
    this.name = 'ContractParsingError';
  }
}

export class ContractValidationError extends ContractError {
  constructor(message: string, contractId: string, context?: Record<string, any>) {
    super(message, contractId, 'validation', context);
    this.name = 'ContractValidationError';
  }
}

export class ContractExecutionError extends ContractError {
  constructor(message: string, contractId: string, context?: Record<string, any>) {
    super(message, contractId, 'execution', context);
    this.name = 'ContractExecutionError';
  }
}
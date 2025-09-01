/**
 * Intermediate Representation (IR) Types for Test Generation
 * 
 * Provides a normalized, language-agnostic representation of CUE schemas
 * that can be safely transformed into TypeScript test files with validation.
 */

export interface TestGenerationIR {
  version: string;
  sourceFile: string;
  timestamp: string;
  scenarios: ScenarioIR[];
  metadata: IRMetadata;
}

export interface ScenarioIR {
  id: string;
  name: string;
  description: string;
  priority: 'p0' | 'p1' | 'p2';
  type: 'unit' | 'integration' | 'e2e';
  framework: 'bun' | 'playwright' | 'vitest';
  schema: SchemaIR;
  assertions: AssertionIR[];
  setup?: SetupIR;
  teardown?: TeardownIR;
}

export interface SchemaIR {
  kind: 'primitive' | 'object' | 'array' | 'union' | 'intersection';
  type: string;
  required: boolean;
  open: boolean; // CUE ellipsis (...) indicator
  nullable: boolean;
  fields?: Record<string, SchemaIR>;
  items?: SchemaIR; // For arrays
  alternatives?: SchemaIR[]; // For unions
  constraints?: ConstraintIR;
  metadata?: Record<string, unknown>;
}

export interface ConstraintIR {
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  pattern?: string;
  format?: string;
  enum?: unknown[];
  uniqueItems?: boolean;
}

export interface AssertionIR {
  type: 'schema-validation' | 'property-based' | 'metamorphic' | 'edge-case';
  description: string;
  predicate: string; // Safe, serializable predicate expression
  params: Record<string, unknown>;
  negated?: boolean;
}

export interface SetupIR {
  before: string[];
  beforeEach: string[];
  fixtures: FixtureIR[];
}

export interface TeardownIR {
  after: string[];
  afterEach: string[];
  cleanup: string[];
}

export interface FixtureIR {
  name: string;
  type: string;
  value: unknown;
  generator?: string; // Reference to fast-check generator
}

export interface IRMetadata {
  generator: string;
  generatedAt: string;
  sourceSchema: string;
  targetLanguage: 'typescript';
  testFramework: string;
  validationGates: ValidationGate[];
}

export interface ValidationGate {
  name: string;
  status: 'pending' | 'passed' | 'failed';
  error?: string;
  timestamp?: string;
}

/**
 * Test file artifact with validation status
 */
export interface ValidatedTestArtifact {
  filename: string;
  relativePath: string;
  content: string;
  sourceIR: ScenarioIR;
  validation: {
    prettier: ValidationGate;
    typescript: ValidationGate;
    framework: ValidationGate;
    syntax: ValidationGate;
  };
  dependencies: string[];
  framework: 'bun' | 'playwright' | 'vitest';
  category: 'unit' | 'integration' | 'e2e';
}

/**
 * NDJSON test vectors for runtime validation
 */
export interface TestVector {
  scenarioId: string;
  schemaRef: string;
  sample: unknown;
  expectValid: boolean;
  description: string;
  tags: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Import resolution configuration
 */
export interface ImportResolver {
  framework: 'bun' | 'playwright' | 'vitest';
  imports: {
    test: string; // e.g., "import { test, expect } from 'bun:test'"
    expect: string;
    additional: string[];
  };
  dependencies: string[];
}

/**
 * Template rendering context
 */
export interface TemplateContext {
  scenario: ScenarioIR;
  imports: ImportResolver;
  helpers: {
    emitString: (value: unknown) => string;
    emitType: (schema: SchemaIR) => string;
    emitAssertion: (assertion: AssertionIR) => string;
  };
  config: {
    strict: boolean;
    coverage: boolean;
    timeout: number;
  };
}

/**
 * CUE-specific constructs that need special handling
 */
export interface CUEConstructs {
  openStructs: boolean; // Has ... (ellipsis)
  disjunctions: SchemaIR[]; // A | B patterns  
  defaults: Record<string, unknown>; // *value syntax
  constraints: ConstraintIR[];
  references: string[]; // #Ref patterns
}

/**
 * Error types for IR processing
 */
export class IRProcessingError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'IRProcessingError';
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly gate: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}
import path from 'path';
import { performance } from 'perf_hooks';
import { globalConstraintEnforcer, ConstraintViolationError } from './core.js';
import type { CLIConfig } from '../types.js';

/**
 * Operation types that must use server endpoints
 */
export type SandboxedOperation = 
  | 'validate'
  | 'analyze' 
  | 'export'
  | 'transform'
  | 'check'
  | 'import'
  | 'diff'
  | 'migrate';

/**
 * Server endpoint configuration for sandboxed operations
 */
export interface ServerEndpoint {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  requiresPayload: boolean;
  maxResponseTime: number;
}

/**
 * Mapping of operations to their required server endpoints
 */
export const REQUIRED_ENDPOINTS: Record<SandboxedOperation, ServerEndpoint> = {
  validate: {
    path: '/api/v1/validate',
    method: 'POST',
    requiresPayload: true,
    maxResponseTime: 500, // Must be within 750ms total constraint
  },
  analyze: {
    path: '/api/v1/analyze',
    method: 'POST',
    requiresPayload: true,
    maxResponseTime: 600,
  },
  export: {
    path: '/api/v1/export',
    method: 'POST',
    requiresPayload: true,
    maxResponseTime: 700,
  },
  transform: {
    path: '/api/v1/transform',
    method: 'POST',
    requiresPayload: true,
    maxResponseTime: 600,
  },
  check: {
    path: '/api/v1/check',
    method: 'POST',
    requiresPayload: true,
    maxResponseTime: 500,
  },
  import: {
    path: '/api/v1/import',
    method: 'POST',
    requiresPayload: true,
    maxResponseTime: 400,
  },
  diff: {
    path: '/api/v1/diff',
    method: 'POST',
    requiresPayload: true,
    maxResponseTime: 300,
  },
  migrate: {
    path: '/api/v1/migrate',
    method: 'POST',
    requiresPayload: true,
    maxResponseTime: 700,
  },
};

/**
 * Execution context tracking for sandbox validation
 */
interface ExecutionContext {
  operation: SandboxedOperation;
  startTime: number;
  endpointUsed?: string;
  isDirectExecution: boolean;
  callStack: string[];
}

/**
 * Sandbox compliance validator
 * Ensures all operations go through server endpoints, not direct tool execution
 */
export class SandboxValidator {
  private readonly executionStack: ExecutionContext[] = [];
  private readonly config: CLIConfig;
  private readonly allowedDirectOperations = new Set<string>([
    // Only these operations can execute directly (non-sandboxed)
    'init',
    'config',
    'help',
    'version',
    'template',
  ]);

  constructor(config: CLIConfig) {
    this.config = config;
  }

  /**
   * Start tracking a potentially sandboxed operation
   */
  startOperation(operation: SandboxedOperation, callStack: string[] = []): string {
    const operationId = globalConstraintEnforcer.startOperation(`sandbox:${operation}`, {
      operation,
      callStack,
    });

    const context: ExecutionContext = {
      operation,
      startTime: performance.now(),
      isDirectExecution: false,
      callStack,
    };

    this.executionStack.push(context);

    return operationId;
  }

  /**
   * Mark that an operation is using server endpoint (compliant)
   */
  markServerEndpointUsage(operation: SandboxedOperation, endpoint: string, operationId: string): void {
    const context = this.executionStack.find(ctx => ctx.operation === operation);
    if (!context) {
      throw new Error(`No active context found for operation: ${operation}`);
    }

    context.endpointUsed = endpoint;
    context.isDirectExecution = false;

    // Validate that the correct endpoint is being used
    const requiredEndpoint = REQUIRED_ENDPOINTS[operation];
    const expectedPath = requiredEndpoint.path;
    
    if (!endpoint.includes(expectedPath)) {
      const violation = new ConstraintViolationError(
        'sandboxCompliance',
        `endpoint: ${endpoint}`,
        `endpoint containing: ${expectedPath}`,
        {
          operationId,
          operation,
          providedEndpoint: endpoint,
          expectedEndpoint: expectedPath,
        }
      );

      globalConstraintEnforcer.emit('constraint:violation', {
        constraint: 'sandboxCompliance',
        violation,
        operation,
      });

      throw violation;
    }

    // Validate endpoint compliance with global constraint enforcer
    globalConstraintEnforcer.validateSandboxCompliance(
      operation,
      false, // Not direct execution
      operationId
    );
  }

  /**
   * Mark that an operation is attempting direct execution (violation)
   */
  markDirectExecution(operation: SandboxedOperation, toolName: string, operationId: string): void {
    const context = this.executionStack.find(ctx => ctx.operation === operation);
    if (!context) {
      throw new Error(`No active context found for operation: ${operation}`);
    }

    context.isDirectExecution = true;

    // This will throw a ConstraintViolationError
    globalConstraintEnforcer.validateSandboxCompliance(
      operation,
      true, // Direct execution detected
      operationId
    );
  }

  /**
   * End operation tracking and validate compliance
   */
  endOperation(operation: SandboxedOperation, operationId: string): void {
    const contextIndex = this.executionStack.findIndex(ctx => ctx.operation === operation);
    if (contextIndex === -1) {
      throw new Error(`No active context found for operation: ${operation}`);
    }

    const context = this.executionStack[contextIndex];
    
    // Validate that server endpoint was used
    if (!context.endpointUsed && !context.isDirectExecution) {
      const violation = new ConstraintViolationError(
        'sandboxCompliance',
        'no endpoint usage detected',
        'server endpoint usage',
        {
          operationId,
          operation,
          message: 'Operation completed without using required server endpoint',
        }
      );

      globalConstraintEnforcer.emit('constraint:violation', {
        constraint: 'sandboxCompliance',
        violation,
        operation,
      });

      throw violation;
    }

    // Remove context from stack
    this.executionStack.splice(contextIndex, 1);
    
    // End global constraint tracking
    globalConstraintEnforcer.endOperation(operationId);
  }

  /**
   * Validate that a function/tool call is allowed to execute directly
   */
  validateDirectExecution(functionName: string, operation?: string): void {
    if (operation && this.isOperationSandboxed(operation as SandboxedOperation)) {
      throw new ConstraintViolationError(
        'sandboxCompliance',
        `direct execution of ${functionName}`,
        'server endpoint usage',
        {
          operation,
          functionName,
          message: `Function ${functionName} cannot be called directly during sandboxed operation ${operation}`,
        }
      );
    }

    if (!this.allowedDirectOperations.has(functionName)) {
      const currentOperations = this.executionStack.map(ctx => ctx.operation);
      if (currentOperations.some(op => this.isOperationSandboxed(op))) {
        throw new ConstraintViolationError(
          'sandboxCompliance',
          `direct execution of ${functionName}`,
          'server endpoint usage',
          {
            functionName,
            activeOperations: currentOperations,
            message: `Function ${functionName} cannot be called directly during active sandboxed operations`,
          }
        );
      }
    }
  }

  /**
   * Check if an operation requires sandboxing
   */
  isOperationSandboxed(operation: string): operation is SandboxedOperation {
    return Object.keys(REQUIRED_ENDPOINTS).includes(operation);
  }

  /**
   * Get required endpoint information for an operation
   */
  getRequiredEndpoint(operation: SandboxedOperation): ServerEndpoint {
    return REQUIRED_ENDPOINTS[operation];
  }

  /**
   * Construct full endpoint URL for an operation
   */
  getEndpointUrl(operation: SandboxedOperation): string {
    const endpoint = REQUIRED_ENDPOINTS[operation];
    const baseUrl = this.config.apiUrl.replace(/\/+$/, ''); // Remove trailing slashes
    return `${baseUrl}${endpoint.path}`;
  }

  /**
   * Get current sandbox status
   */
  getSandboxStatus(): {
    activeOperations: ExecutionContext[];
    violations: number;
    complianceRate: number;
  } {
    const violations = this.executionStack.filter(ctx => ctx.isDirectExecution).length;
    const total = this.executionStack.length;
    const complianceRate = total > 0 ? ((total - violations) / total) * 100 : 100;

    return {
      activeOperations: [...this.executionStack],
      violations,
      complianceRate,
    };
  }
}

/**
 * Decorator to automatically enforce sandbox compliance
 */
export function sandboxed(operation: SandboxedOperation) {
  return function <T extends (...args: any[]) => Promise<any>>(
    target: any,
    propertyName: string,
    descriptor: TypedPropertyDescriptor<T>
  ) {
    const method = descriptor.value!;

    descriptor.value = async function (this: any, ...args: any[]) {
      // Get sandbox validator from context or create new one
      const config = this.config || globalSandboxConfig;
      const validator = new SandboxValidator(config);
      
      const callStack = new Error().stack?.split('\n').slice(2, 6) || [];
      const operationId = validator.startOperation(operation, callStack);

      try {
        const result = await method.apply(this, args);
        validator.endOperation(operation, operationId);
        return result;
      } catch (error) {
        validator.endOperation(operation, operationId);
        throw error;
      }
    } as T;

    return descriptor;
  };
}

/**
 * Global sandbox configuration - should be set by CLI initialization
 */
let globalSandboxConfig: CLIConfig;

/**
 * Initialize global sandbox configuration
 */
export function initializeSandboxConfig(config: CLIConfig): void {
  globalSandboxConfig = config;
}

/**
 * Create a sandbox validator instance
 */
export function createSandboxValidator(config: CLIConfig): SandboxValidator {
  return new SandboxValidator(config);
}

/**
 * Utility to wrap API client calls with automatic endpoint tracking
 */
export function withEndpointTracking<T>(
  validator: SandboxValidator,
  operation: SandboxedOperation,
  operationId: string,
  apiCall: () => Promise<T>
): Promise<T> {
  return new Promise(async (resolve, reject) => {
    try {
      // Track that we're using the server endpoint
      const endpoint = validator.getEndpointUrl(operation);
      validator.markServerEndpointUsage(operation, endpoint, operationId);
      
      // Execute the API call
      const result = await apiCall();
      resolve(result);
    } catch (error) {
      reject(error);
    }
  });
}
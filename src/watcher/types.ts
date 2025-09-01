/**
 * TypeScript interfaces and types for the file watcher system
 */

import { z } from 'zod';
import type { ContractExecutionResult, ContractViolation } from '../contracts/types.js';

// File system event types
export type FileEventType = 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir';

export interface FileEvent {
  readonly type: FileEventType;
  readonly path: string;
  readonly stats?: {
    readonly size: number;
    readonly mtime: Date;
    readonly ctime: Date;
  };
  readonly timestamp: Date;
}

// Validation result types
export type ValidationStatus = 'success' | 'error' | 'warning' | 'skipped';
export type ValidationType = 'syntax' | 'semantic' | 'contract' | 'schema' | 'dependency';

export interface ValidationError {
  readonly type: ValidationType;
  readonly severity: 'error' | 'warning' | 'info';
  readonly message: string;
  readonly line?: number;
  readonly column?: number;
  readonly offset?: number;
  readonly length?: number;
  readonly code?: string;
  readonly context?: Record<string, any>;
}

export interface ValidationResult {
  readonly filePath: string;
  readonly status: ValidationStatus;
  readonly validationType: ValidationType;
  readonly errors: readonly ValidationError[];
  readonly warnings: readonly ValidationError[];
  readonly info: readonly ValidationError[];
  readonly duration: number;
  readonly timestamp: Date;
  readonly contractResults?: readonly ContractExecutionResult[];
  readonly dependencies?: readonly string[];
  readonly metadata?: Record<string, any>;
}

// NDJSON output types
export interface NDJSONEvent {
  readonly type: 'file-event' | 'validation-result' | 'error' | 'heartbeat' | 'status';
  readonly timestamp: Date;
  readonly data: any;
}

export interface NDJSONFileEvent extends NDJSONEvent {
  readonly type: 'file-event';
  readonly data: FileEvent;
}

export interface NDJSONValidationResult extends NDJSONEvent {
  readonly type: 'validation-result';
  readonly data: ValidationResult;
}

export interface NDJSONError extends NDJSONEvent {
  readonly type: 'error';
  readonly data: {
    readonly message: string;
    readonly error?: string;
    readonly context?: Record<string, any>;
  };
}

export interface NDJSONHeartbeat extends NDJSONEvent {
  readonly type: 'heartbeat';
  readonly data: {
    readonly uptime: number;
    readonly filesWatched: number;
    readonly validationsRun: number;
    readonly errorsCount: number;
  };
}

export interface NDJSONStatus extends NDJSONEvent {
  readonly type: 'status';
  readonly data: {
    readonly status: 'starting' | 'running' | 'stopping' | 'stopped' | 'error';
    readonly message?: string;
    readonly watchedPaths: readonly string[];
    readonly activeValidations: number;
  };
}

// Configuration types
export interface WatcherConfig {
  readonly watchPaths: readonly string[];
  readonly watchOptions: {
    readonly ignored?: readonly string[];
    readonly ignoreInitial?: boolean;
    readonly followSymlinks?: boolean;
    readonly depth?: number;
    readonly awaitWriteFinish?: {
      readonly stabilityThreshold?: number;
      readonly pollInterval?: number;
    };
  };
  readonly validation: {
    readonly debounceMs: number;
    readonly batchSize: number;
    readonly timeout: number;
    readonly enableContracts: boolean;
    readonly enableDependencyCheck: boolean;
    readonly parallelValidations: number;
  };
  readonly output: {
    readonly format: 'ndjson' | 'json' | 'text';
    readonly stream: NodeJS.WritableStream;
    readonly bufferSize: number;
    readonly flushInterval: number;
  };
  readonly heartbeat: {
    readonly enabled: boolean;
    readonly interval: number;
  };
}

// Change detection types
export interface ChangeSet {
  readonly files: readonly string[];
  readonly dependencies: readonly string[];
  readonly validationType: 'full' | 'incremental';
  readonly reason: string;
  readonly timestamp: Date;
}

export interface DependencyGraph {
  readonly dependencies: Map<string, Set<string>>;
  readonly dependents: Map<string, Set<string>>;
  readonly lastModified: Map<string, Date>;
}

export interface FileState {
  readonly path: string;
  readonly hash: string;
  readonly mtime: Date;
  readonly size: number;
  readonly dependencies: readonly string[];
}

// Watcher internal state types
export interface WatcherState {
  status: 'starting' | 'running' | 'stopping' | 'stopped' | 'error';
  startTime: Date;
  filesWatched: number;
  validationsRun: number;
  errorsCount: number;
  activeValidations: number;
  lastHeartbeat: Date;
  fileStates: Map<string, FileState>;
  dependencyGraph: DependencyGraph;
}

// Performance metrics
export interface ValidationMetrics {
  readonly filePath: string;
  readonly validationType: ValidationType;
  readonly duration: number;
  readonly memoryUsed?: number;
  readonly cacheHit?: boolean;
  readonly timestamp: Date;
}

export interface WatcherMetrics {
  readonly totalValidations: number;
  readonly averageValidationTime: number;
  readonly validationsByType: Map<ValidationType, number>;
  readonly errorRate: number;
  readonly throughput: number; // validations per second
  readonly memoryUsage: {
    readonly used: number;
    readonly total: number;
    readonly external: number;
  };
}

// Error types
export class WatcherError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, any>
  ) {
    super(message);
    this.name = 'WatcherError';
  }
}

export class ValidationEngineError extends WatcherError {
  constructor(
    message: string,
    public readonly filePath: string,
    public readonly validationType: ValidationType,
    context?: Record<string, any>
  ) {
    super(message, 'VALIDATION_ENGINE_ERROR', { filePath, validationType, ...context });
    this.name = 'ValidationEngineError';
  }
}

export class FileSystemError extends WatcherError {
  constructor(
    message: string,
    public readonly operation: string,
    public readonly filePath?: string,
    context?: Record<string, any>
  ) {
    super(message, 'FILESYSTEM_ERROR', { operation, filePath, ...context });
    this.name = 'FileSystemError';
  }
}

// Zod schemas for validation
export const FileEventSchema = z.object({
  type: z.enum(['add', 'change', 'unlink', 'addDir', 'unlinkDir']),
  path: z.string(),
  stats: z.object({
    size: z.number(),
    mtime: z.date(),
    ctime: z.date(),
  }).optional(),
  timestamp: z.date(),
});

export const ValidationErrorSchema = z.object({
  type: z.enum(['syntax', 'semantic', 'contract', 'schema', 'dependency']),
  severity: z.enum(['error', 'warning', 'info']),
  message: z.string(),
  line: z.number().optional(),
  column: z.number().optional(),
  offset: z.number().optional(),
  length: z.number().optional(),
  code: z.string().optional(),
  context: z.record(z.any()).optional(),
});

export const ValidationResultSchema = z.object({
  filePath: z.string(),
  status: z.enum(['success', 'error', 'warning', 'skipped']),
  validationType: z.enum(['syntax', 'semantic', 'contract', 'schema', 'dependency']),
  errors: z.array(ValidationErrorSchema),
  warnings: z.array(ValidationErrorSchema),
  info: z.array(ValidationErrorSchema),
  duration: z.number(),
  timestamp: z.date(),
  contractResults: z.array(z.any()).optional(),
  dependencies: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional(),
});

export const WatcherConfigSchema = z.object({
  watchPaths: z.array(z.string()),
  watchOptions: z.object({
    ignored: z.array(z.string()).optional(),
    ignoreInitial: z.boolean().optional(),
    followSymlinks: z.boolean().optional(),
    depth: z.number().optional(),
    awaitWriteFinish: z.object({
      stabilityThreshold: z.number().optional(),
      pollInterval: z.number().optional(),
    }).optional(),
  }),
  validation: z.object({
    debounceMs: z.number().min(0),
    batchSize: z.number().min(1),
    timeout: z.number().min(1000),
    enableContracts: z.boolean(),
    enableDependencyCheck: z.boolean(),
    parallelValidations: z.number().min(1),
  }),
  output: z.object({
    format: z.enum(['ndjson', 'json', 'text']),
    stream: z.any(), // NodeJS.WritableStream
    bufferSize: z.number().min(1),
    flushInterval: z.number().min(100),
  }),
  heartbeat: z.object({
    enabled: z.boolean(),
    interval: z.number().min(1000),
  }),
});
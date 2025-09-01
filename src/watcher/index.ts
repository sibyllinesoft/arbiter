/**
 * File watcher system for arbiter - Main exports
 */

export { FileWatcher, createFileWatcher, startFileWatcherCLI } from './watcher.js';
export { NDJSONReporter, NDJSONAggregator } from './ndjson-reporter.js';
export { LiveValidator } from './validator.js';
export { ChangeDetector } from './change-detector.js';

export type {
  // Core types
  WatcherConfig,
  WatcherState,
  WatcherMetrics,
  FileEvent,
  ValidationResult,
  ValidationError,
  ChangeSet,
  DependencyGraph,
  FileState,
  
  // NDJSON event types
  NDJSONEvent,
  NDJSONFileEvent,
  NDJSONValidationResult,
  NDJSONError,
  NDJSONHeartbeat,
  NDJSONStatus,
  
  // Configuration types
  ValidatorOptions,
  ChangeDetectorOptions,
  NDJSONReporterOptions,
  
  // Error types
  WatcherError,
  ValidationEngineError,
  FileSystemError,
  
  // Enum types
  FileEventType,
  ValidationStatus,
  ValidationType,
} from './types.js';

// Re-export commonly used utility functions
export {
  ValidationErrorSchema,
  ValidationResultSchema,
  WatcherConfigSchema,
  FileEventSchema,
} from './types.js';
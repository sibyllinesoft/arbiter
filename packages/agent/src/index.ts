/**
 * Arbiter Agent - Implementation Agent following Operating Prompt v1
 * 
 * Main exports for the agent system that makes CUE files executable contracts
 * with deterministic, idempotent operations within strict constraints.
 */

// Core commands
export { scanCommand } from './commands/scan.js';
export { assembleCommand } from './commands/assemble.js';
export { executeCommand } from './commands/execute.js';

// Versioning system
export {
  type EnvelopedResource,
  type AssemblyV1,
  type EpicV1,
  type MigrationPatch,
  loadAndMigrateResource,
  detectEnvelope,
  migrateToLatest,
  validateEnvelopedResource,
  serializeResource,
  generateMigrationPatch,
  CURRENT_API_VERSION,
  SUPPORTED_VERSIONS,
} from './versioning.js';

// Rate limiting utilities
export { RateLimiter, rateLimitedFetch } from './rate-limiter.js';

// Type definitions for commands
export type {
  ScanOptions,
  ScanResult,
  AssembleOptions,
  AssembleResult,
  ProjectMapping,
  ExecuteOptions,
  ExecutionResult,
  ExecutionPlan,
  FileOperation,
} from './commands/scan.js';

export type {
  AssembleOptions,
  AssembleResult,
  ProjectMapping,
} from './commands/assemble.js';

export type {
  ExecuteOptions,
  ExecutionResult,
  ExecutionPlan,
  FileOperation,
} from './commands/execute.js';
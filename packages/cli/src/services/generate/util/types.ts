/**
 * @packageDocumentation
 * Type definitions for the code generation system.
 *
 * Provides interfaces for:
 * - Generation options and configuration
 * - Reporter interface for progress output
 * - Result types for generation operations
 */

export interface GenerateOptions {
  projectDir?: string;
  force?: boolean;
  dryRun?: boolean;
  verbose?: boolean;
  spec?: string;
  syncGithub?: boolean;
  githubDryRun?: boolean;
  reporter?: GenerationReporter;
  color?: boolean;
  /** Generate tests (default: true, use --no-tests to disable) */
  tests?: boolean;
  /** Generate docs (default: true, use --no-docs to disable) */
  docs?: boolean;
  /** Generate code artifacts (default: true, use --no-code to disable) */
  code?: boolean;
}

export interface GenerationReporter {
  info: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  error: (...args: any[]) => void;
  createChild?: (scope: string) => GenerationReporter;
}

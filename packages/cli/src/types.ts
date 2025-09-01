import type { z } from 'zod';

/**
 * CLI configuration schema and types
 */
export interface CLIConfig {
  /** API endpoint URL */
  apiUrl: string;
  /** Default timeout in milliseconds */
  timeout: number;
  /** Default output format */
  format: 'table' | 'json' | 'yaml';
  /** Enable colored output */
  color: boolean;
  /** Default project directory */
  projectDir: string;
}

/**
 * Command result interface for consistent error handling
 */
export interface CommandResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  exitCode: number;
}

/**
 * Validation result for pretty table output
 */
export interface ValidationResult {
  file: string;
  status: 'valid' | 'invalid' | 'error';
  errors: Array<{
    line: number;
    column: number;
    message: string;
    severity: 'error' | 'warning';
    category: string;
  }>;
  warnings: Array<{
    line: number;
    column: number;
    message: string;
    category: string;
  }>;
  processingTime: number;
}

/**
 * Export format options
 */
export type ExportFormat = 'openapi' | 'types' | 'k8s' | 'terraform' | 'json-schema' | 'json' | 'yaml';

/**
 * Progress indicator options
 */
export interface ProgressOptions {
  text: string;
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'cyan' | 'magenta';
  spinner?: string;
}

/**
 * Project template types
 */
export interface ProjectTemplate {
  name: string;
  description: string;
  files: Record<string, string>;
  dependencies?: string[];
}

/**
 * Init command options
 */
export interface InitOptions {
  template?: string;
  name?: string;
  directory?: string;
  force?: boolean;
}

/**
 * Check command options
 */
export interface CheckOptions {
  recursive?: boolean;
  watch?: boolean;
  format?: 'table' | 'json';
  verbose?: boolean;
  failFast?: boolean;
}

/**
 * Validate command options
 */
export interface ValidateOptions {
  schema?: string;
  config?: string;
  format?: 'table' | 'json';
  strict?: boolean;
  verbose?: boolean;
}

/**
 * Export command options
 */
export interface ExportOptions {
  format: ExportFormat[];
  output?: string;
  schema?: string;
  config?: string;
  minify?: boolean;
  strict?: boolean;
  verbose?: boolean;
}

/**
 * Template command options
 */
export interface TemplateOptions {
  output?: string;
  format?: 'cue' | 'json';
  list?: boolean;
  interactive?: boolean;
}

/**
 * Create command options
 */
export interface CreateOptions {
  interactive?: boolean;
  template?: string;
  output?: string;
  name?: string;
}

/**
 * Import command options
 */
export interface ImportOptions {
  global?: boolean;
  list?: boolean;
  remove?: boolean;
  validate?: boolean;
  allow?: string[];
}

/**
 * Diff command options
 */
export interface DiffOptions {
  migration?: boolean;
  format?: 'text' | 'json';
  context?: number;
  summary?: boolean;
}

/**
 * Migrate command options
 */
export interface MigrateOptions {
  from?: string;
  to?: string;
  dryRun?: boolean;
  backup?: boolean;
  patterns?: string[];
  force?: boolean;
}

/**
 * Execute command options for Epic v2 deterministic execution
 */
export interface ExecuteOptions {
  epic: string;
  dryRun?: boolean;
  workspace?: string;
  timeout?: number;
  junit?: string;
  verbose?: boolean;
}

/**
 * Test command options for unified test harness
 */
export interface TestOptions {
  epic?: string;
  types?: string[];
  junit?: string;
  timeout?: number;
  verbose?: boolean;
  parallel?: boolean;
  updateGolden?: boolean;
}

/**
 * Watch command options for file monitoring
 */
export interface WatchOptions {
  path?: string;
  agentMode?: boolean;
  debounce?: number;
  patterns?: string[];
  validate?: boolean;
  plan?: boolean;
}

/**
 * Surface command options for API extraction
 */
export interface SurfaceOptions {
  language: 'typescript' | 'python' | 'rust' | 'go' | 'bash';
  output?: string;
  diff?: boolean;
  includePrivate?: boolean;
  verbose?: boolean;
}

/**
 * Tests command options for scaffolding and coverage
 */
export interface TestsOptions {
  language?: 'python' | 'typescript' | 'rust' | 'go' | 'bash';
  framework?: string;
  property?: boolean;
  output?: string;
  outputDir?: string;
  threshold?: number;
  junit?: string;
  force?: boolean;
  verbose?: boolean;
}

/**
 * Version plan command options
 */
export interface VersionPlanOptions {
  /** Current surface file path */
  current?: string;
  /** Previous surface file path for comparison */
  previous?: string;
  /** Output file for version plan */
  output?: string;
  /** Enable strict mode for library compliance */
  strict?: boolean;
  /** Include all changes in analysis */
  verbose?: boolean;
}

/**
 * Version release command options
 */
export interface VersionReleaseOptions {
  /** Version plan file to execute */
  plan?: string;
  /** Specific version to set (overrides plan) */
  version?: string;
  /** Changelog output file */
  changelog?: string;
  /** Enable dry-run mode (default) */
  dryRun?: boolean;
  /** Apply changes (disables dry-run) */
  apply?: boolean;
  /** Verbose output */
  verbose?: boolean;
}

/**
 * IDE recommendation command options
 */
export interface IDEOptions {
  /** Editor type to generate config for */
  editor?: 'vscode' | 'idea' | 'vim' | 'all';
  /** Force overwrite existing configuration */
  force?: boolean;
  /** Only detect project languages, don't generate config */
  detect?: boolean;
  /** Output directory for IDE configs */
  output?: string;
  /** Output directory for IDE configs (alias for output) */
  outputDir?: string;
}

/**
 * Sync command options for manifest synchronization
 */
export interface SyncOptions {
  /** Language manifests to sync */
  language?: 'python' | 'typescript' | 'rust' | 'bash' | 'all';
  /** Sync all detected languages */
  all?: boolean;
  /** Dry run - show what would be changed */
  dryRun?: boolean;
  /** Create backup before modifying files */
  backup?: boolean;
  /** Force overwrite conflicting sections */
  force?: boolean;
}

/**
 * Integrate command options for CI/CD generation
 */
export interface IntegrateOptions {
  /** CI provider to generate workflows for */
  provider?: 'github' | 'gitlab' | 'azure' | 'all';
  /** Workflow type to generate */
  type?: 'pr' | 'main' | 'release' | 'all';
  /** Output directory for CI files */
  output?: string;
  /** Force overwrite existing workflows */
  force?: boolean;
  /** Use build matrix from assembly file */
  matrix?: boolean;
}

/**
 * Docs command options for documentation generation
 */
export interface DocsOptions {
  /** Output format */
  format?: 'markdown' | 'html' | 'json';
  /** Output file path */
  output?: string;
  /** Template to use */
  template?: string;
  /** Interactive mode */
  interactive?: boolean;
  /** Generate examples */
  examples?: boolean;
}

/**
 * Examples command options for project generation
 */
export interface ExamplesOptions {
  /** Example type */
  type?: 'profile' | 'language';
  /** Specific profile to generate */
  profile?: string;
  /** Specific language to generate */
  language?: string;
  /** Output directory */
  output?: string;
  /** Generate minimal examples */
  minimal?: boolean;
  /** Generate complete examples */
  complete?: boolean;
}

/**
 * Explain command options for assembly explanation
 */
export interface ExplainOptions {
  /** Output format */
  format?: 'text' | 'json';
  /** Output file path */
  output?: string;
  /** Verbose explanation */
  verbose?: boolean;
  /** Show helpful hints */
  hints?: boolean;
}

/**
 * Generate command options for code generation
 */
export interface GenerateOptions {
  /** Output directory */
  output?: string;
  /** Output directory (alternative) */
  outputDir?: string;
  /** Include CI/CD files */
  includeCi?: boolean;
  /** Force overwrite existing files */
  force?: boolean;
  /** Dry run - show what would be generated */
  dryRun?: boolean;
  /** Verbose output */
  verbose?: boolean;
  /** Output format */
  format?: 'auto' | 'json' | 'yaml' | 'typescript' | 'python' | 'rust' | 'go' | 'shell';
}

/**
 * Preview command options for deterministic planning
 */
export interface PreviewOptions {
  /** Output format */
  format?: 'json' | 'yaml' | 'text';
  /** Output file path */
  output?: string;
  /** Output directory for plan file */
  outputDir?: string;
  /** Verbose output */
  verbose?: boolean;
  /** Include file content in preview */
  includeContent?: boolean;
}
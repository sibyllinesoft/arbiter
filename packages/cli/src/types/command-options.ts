/**
 * Command options type definitions
 *
 * This module contains option interfaces for CLI commands.
 */

import type { SpinnerName } from "cli-spinners";
import type { Spinner } from "ora";

/**
 * Export format options
 */
export type ExportFormat =
  | "openapi"
  | "types"
  | "k8s"
  | "terraform"
  | "json-schema"
  | "json"
  | "yaml";

/**
 * Progress indicator options
 */
export interface ProgressOptions {
  text: string;
  color?: "blue" | "green" | "yellow" | "red" | "cyan" | "magenta";
  spinner?: Spinner | SpinnerName;
}

/**
 * Step-based progress options for multi-step operations
 */
export interface StepProgressOptions {
  title: string;
  steps: string[];
  color?: "blue" | "green" | "yellow" | "red" | "cyan" | "magenta";
  spinner?: Spinner | SpinnerName;
}

/**
 * Progress bar options for operations with known progress
 */
export interface ProgressBarOptions {
  title: string;
  total?: number;
  completeMessage?: string;
}

/**
 * Init command options
 */
export interface InitOptions {
  preset?: string;
  name?: string;
  listPresets?: boolean;
}

/**
 * Check command options
 */
export interface CheckOptions {
  recursive?: boolean;
  watch?: boolean;
  format?: "table" | "json";
  verbose?: boolean;
  failFast?: boolean;
}

/**
 * Validate command options
 */
export interface ValidateOptions {
  schema?: string;
  config?: string;
  format?: "table" | "json";
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
  format?: "cue" | "json";
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
  format?: "text" | "json";
  context?: number;
  summary?: boolean;
}

/**
 * Execute command options for deterministic group execution
 */
export interface ExecuteOptions {
  group: string;
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
  group?: string;
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
  debounce?: number;
  patterns?: string[];
  validate?: boolean;
  plan?: boolean;
}

/**
 * Surface command options for API extraction
 */
export interface SurfaceOptions {
  language: "typescript" | "python" | "rust" | "go" | "bash";
  output?: string;
  diff?: boolean;
  includePrivate?: boolean;
  projectName?: string;
  verbose?: boolean;
  format?: string;
}

/**
 * Tests command options for scaffolding and coverage
 */
export interface TestsOptions {
  language?: "python" | "typescript" | "rust" | "go" | "bash";
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
  editor?: "vscode" | "idea" | "vim" | "all";
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
  language?: "python" | "typescript" | "rust" | "bash" | "all";
  /** Sync all detected languages */
  all?: boolean;
  /** Dry run - show what would be changed */
  dryRun?: boolean;
  /** Create backup before modifying files */
  backup?: boolean;
  /** Force overwrite conflicting sections */
  force?: boolean;
  /** Verbose logging */
  verbose?: boolean;
  /** Enable GitHub issue sync (syncs tasks to GitHub issues) */
  github?: boolean;
}

/**
 * Integrate command options for CI/CD generation
 */
export interface IntegrateOptions {
  /** CI provider to generate workflows for */
  provider?: "github" | "gitlab" | "azure" | "all";
  /** Alias for provider to match legacy flag */
  platform?: "github" | "gitlab" | "azure" | "all";
  /** Workflow type to generate */
  type?: "pr" | "main" | "release" | "all";
  /** Output directory for CI files */
  output?: string;
  /** Force overwrite existing workflows */
  force?: boolean;
  /** Use build matrix from assembly file */
  matrix?: boolean;
  /** Generate GitHub issue templates and configuration */
  templates?: boolean;
  /** Simulate writes without touching the filesystem */
  dryRun?: boolean;
}

/**
 * Docs command options for documentation generation
 */
export interface DocsOptions {
  /** Output format */
  format?: "markdown" | "html" | "json";
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
  type?: "profile" | "language";
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
 * Template management command options
 */
export interface TemplateManagementOptions {
  /** Template type */
  type?: "group" | "issue" | "bug" | "feature";
  /** Template name */
  name?: string;
  /** List available templates */
  list?: boolean;
  /** Add new template */
  add?: boolean;
  /** Remove template */
  remove?: boolean;
  /** Validate template configuration */
  validate?: boolean;
  /** Show template details */
  show?: boolean;
  /** Output format */
  format?: "table" | "json" | "yaml";
  /** Initialize/scaffold template files */
  init?: boolean;
  /** Scaffold template files */
  scaffold?: boolean;
  /** Generate template example */
  generate?: string;
  /** Output directory for templates */
  outputDir?: string;
  /** Force overwrite existing files */
  force?: boolean;
  /** Verbose output */
  verbose?: boolean;
}

/**
 * Explain command options for assembly explanation
 */
export interface ExplainOptions {
  /** Output format */
  format?: "text" | "json";
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
  /** Project directory to sync generated artifacts into */
  projectDir?: string;
  /** Include CI/CD files */
  includeCi?: boolean;
  /** Force overwrite existing files */
  force?: boolean;
  /** Dry run - show what would be generated */
  dryRun?: boolean;
  /** Verbose output */
  verbose?: boolean;
  /** Output format */
  format?: "auto" | "json" | "yaml" | "typescript" | "python" | "rust" | "go" | "shell";
  /** Sync with GitHub */
  syncGithub?: boolean;
  /** Use configuration file */
  useConfig?: boolean;
  /** Use Git remote for repository detection */
  useGitRemote?: boolean;
  /** Webhook URL */
  url?: string;
  /** Disable/enable colorized output */
  color?: boolean;
}

/**
 * Preview command options for deterministic planning
 */
export interface PreviewOptions {
  /** Output format */
  format?: "json" | "yaml" | "text";
  /** Output file path */
  output?: string;
  /** Output directory for plan file */
  outputDir?: string;
  /** Verbose output */
  verbose?: boolean;
  /** Include file content in preview */
  includeContent?: boolean;
}

/**
 * Rename command options for file naming migration
 */
export interface RenameOptions {
  /** Show what would be renamed without doing it */
  dryRun?: boolean;
  /** Apply the renaming changes */
  apply?: boolean;
  /** Force overwrite existing files */
  force?: boolean;
  /** Show verbose output */
  verbose?: boolean;
  /** Specific file types to rename */
  types?: string[];
}

/**
 * Health response from API
 */
export interface HealthResponse {
  status: string;
  timestamp: string;
  issues?: string[];
}

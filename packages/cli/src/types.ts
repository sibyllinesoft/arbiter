/**
 * @packageDocumentation
 * Shared type definitions for the Arbiter CLI.
 */

import type { SpinnerName } from "cli-spinners";
import type { Spinner } from "ora";

// Re-export issue types from shared package
export type {
  IssueSpec,
  ChecklistItem,
  IssueValidationConfig,
  IssueValidationResult,
} from "@arbiter/shared";
export {
  DEFAULT_ISSUE_VALIDATION,
  validateIssue,
  createIssue,
  createChecklistItem,
} from "@arbiter/shared";
/**
 * GitHub repository metadata used by the synchronization subsystem.
 *
 * @public
 */
export interface GitHubRepo {
  /** GitHub repository owner/organization (auto-detected from Git remote if not specified) */
  owner?: string;
  /** GitHub repository name (auto-detected from Git remote if not specified) */
  repo?: string;
  /** Base URL for GitHub API (defaults to github.com) */
  baseUrl?: string;
  /** Environment variable name for GitHub token (defaults to GITHUB_TOKEN) */
  tokenEnv?: string;
}

/**
 * Configuration that controls how project artifacts synchronize to GitHub.
 *
 * @public
 */
export interface GitHubSyncConfig {
  /** GitHub repository configuration */
  repository?: GitHubRepo;
  /** Mapping configuration for syncing */
  mapping?: {
    /** Epic to GitHub issue label mappings */
    epicLabels?: Record<string, string[]>;
    /** Task to GitHub issue label mappings */
    taskLabels?: Record<string, string[]>;
    /** Default labels to apply to all synced issues */
    defaultLabels?: string[];
    /** Prefix for epic issues */
    epicPrefix?: string;
    /** Prefix for task issues */
    taskPrefix?: string;
  };
  /** Sync behavior configuration */
  behavior?: {
    /** Create GitHub milestones for epics */
    createMilestones?: boolean;
    /** Close GitHub issues when tasks/epics are completed */
    autoClose?: boolean;
    /** Update GitHub issue descriptions with acceptance criteria */
    syncAcceptanceCriteria?: boolean;
    /** Sync assignees between systems */
    syncAssignees?: boolean;
  };
  /** GitHub templates configuration */
  templates?: GitHubTemplatesConfig;
}

import type { UIOptionCatalog, UIOptionGeneratorMap } from "@arbiter/shared";

/**
 * Primary configuration object consumed by the CLI.
 *
 * @public
 */

/**
 * Persisted OAuth session information for CLI authentication.
 */
export interface AuthSession {
  accessToken: string;
  refreshToken?: string;
  tokenType?: string;
  scope?: string;
  expiresAt?: string;
  obtainedAt: string;
  metadata?: {
    tokenEndpoint?: string;
    authorizationEndpoint?: string;
    clientId?: string;
    redirectUri?: string | null;
    provider?: string;
  };
}

export interface CLIConfig {
  /** API endpoint URL */
  apiUrl: string;
  /** Default timeout in milliseconds */
  timeout: number;
  /** Default output format */
  format: "table" | "json" | "yaml";
  /** Enable colored output */
  color: boolean;
  /** Operate in offline/local CUE mode */
  localMode: boolean;
  /** Verbose output flag */
  verbose?: boolean;
  /** Default project directory */
  projectDir: string;
  /** Project ID for API requests */
  projectId?: string;
  /** Optional path to the loaded configuration file */
  configFilePath?: string;
  /** Optional directory of the loaded configuration file */
  configDir?: string;
  /** Saved authentication session for API access */
  authSession?: AuthSession;
  /** GitHub sync configuration */
  github?: GitHubSyncConfig;
  /** Default project structure directories */
  projectStructure: ProjectStructureConfig;
  /** UI option catalog used by CLI tooling and frontend integrations */
  uiOptions?: UIOptionCatalog;
  /** Optional generator scripts that can provide UI options dynamically */
  uiOptionGenerators?: UIOptionGeneratorMap;
  /** Code generation customization */
  generator?: GeneratorConfig;
}

/**
 * Lifecycle hook identifiers emitted by the generator.
 */
export type GeneratorHookEvent =
  | "before:generate"
  | "after:generate"
  | "before:fileWrite"
  | "after:fileWrite";

/**
 * Mapping of generator hooks to shell commands executed during scaffolding.
 */
export type GeneratorHookMap = Partial<Record<GeneratorHookEvent, string>>;

/**
 * Customization points for the code generation pipeline.
 *
 * @public
 */
export interface DockerTemplateConfig {
  dockerfile?: string;
  dockerignore?: string;
}

export interface DockerGeneratorDefaultsConfig {
  service?: DockerTemplateConfig;
  client?: DockerTemplateConfig;
}

export interface DockerGeneratorConfig {
  defaults?: DockerGeneratorDefaultsConfig;
  services?: Record<string, DockerTemplateConfig>;
  clients?: Record<string, DockerTemplateConfig>;
}

export interface GeneratorConfig {
  /** Mapping of language identifiers to template override directories */
  templateOverrides?: Record<string, string>;
  /** Language-specific plugin configuration objects */
  plugins?: Record<string, Record<string, unknown>>;
  /** Lifecycle hook commands executed around generation */
  hooks?: GeneratorHookMap;
  /** Testing configuration (frameworks, output paths, master runner, etc.) */
  testing?: GeneratorTestingConfig;
  /** Docker artifact configuration */
  docker?: DockerGeneratorConfig;
}

/**
 * Testing configuration for a specific language.
 *
 * @public
 */
export interface LanguageTestingConfig {
  /** Preferred test framework identifier (e.g., vitest, jest, pytest). */
  framework?: string;
  /** Optional override for where generated test files should be written (relative to project root). */
  outputDir?: string;
  /** Optional custom command or script to execute generated tests. */
  command?: string;
  /** Optional arbitrary options consumed by language plugins or generators. */
  options?: Record<string, unknown>;
}

export interface MasterTestRunnerConfig {
  /** Runner type for aggregating tests. Defaults to "make". */
  type?: "make" | "node";
  /** Custom output path for the generated runner (relative to output dir). */
  output?: string;
}

export type GeneratorTestingConfig = {
  master?: MasterTestRunnerConfig;
} & Record<string, LanguageTestingConfig>;

/**
 * Directory layout hints used by the CLI when scaffolding or resolving files.
 *
 * @public
 */
export interface ProjectStructureConfig {
  /** Primary location for client-facing applications */
  clientsDirectory: string;
  /** Primary location for backend and API services */
  servicesDirectory: string;
  /** Shared modules and domain libraries */
  modulesDirectory: string;
  /** Developer tooling, CLIs, and automation scripts */
  toolsDirectory: string;
  /** Project documentation output */
  docsDirectory: string;
  /** Shared test suites and golden fixtures */
  testsDirectory: string;
  /** Infrastructure as code and deployment assets */
  infraDirectory: string;
  /** Optional legacy endpoint directory support */
  endpointDirectory?: string;
}

/**
 * Standardized result wrapper returned by CLI operations.
 *
 * @typeParam T - Shape of the payload returned on success.
 * @public
 */
export interface CommandResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  exitCode: number;
}

/**
 * Summary of validation feedback suitable for downstream presentation.
 *
 * @public
 */
export interface ValidationResult {
  file: string;
  status: "valid" | "invalid" | "error";
  errors: Array<{
    line: number;
    column: number;
    message: string;
    severity: "error" | "warning";
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
 * Canonical representation of a UI route extracted from project specifications.
 *
 * @public
 */
export interface UIRoute {
  id: string;
  path?: string;
  name?: string | null;
  summary?: string | null;
  description?: string | null;
  capabilities?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Container for UI route definitions that form part of a project specification.
 *
 * @public
 */
export interface UISpec {
  routes: UIRoute[];
}

/**
 * Flow definition describing a behavioural path through the system.
 *
 * @public
 */
export interface FlowSpec {
  id: string;
  description?: string | null;
  steps?: Array<Record<string, unknown>>;
}

export interface CapabilitySpec {
  name?: string | null;
  description?: string | null;
  owner?: string | null;
  gherkin?: string | null;
  depends_on?: string[];
  tags?: string[];
}

/**
 * Lightweight service descriptor derived from specification metadata.
 *
 * @public
 */
export interface ServiceConfig {
  description?: string | null;
  technology?: string | null;
  [key: string]: unknown;
}

/**
 * Captures automation tooling and notes for operations teams.
 *
 * @public
 */
export interface OpsAutomationSpec {
  tools?: string[];
  notes?: string[];
}

/**
 * Collection of operational characteristics for the project.
 *
 * @public
 */
export interface OpsSpec {
  automation?: OpsAutomationSpec;
}

/**
 * High-level product definition summarizing goals and positioning.
 *
 * @public
 */
export interface ProductSpec {
  name: string;
  description?: string | null;
  goals?: string[];
}

export interface AppSpec {
  product: ProductSpec;
  config?: {
    language?: string;
    description?: string | null;
    technology?: string | null;
  } | null;
  ui: UISpec;
  services?: Record<string, ServiceConfig>;
  flows: FlowSpec[];
  ops?: OpsSpec | null;
  capabilities?: Record<string, CapabilitySpec> | null;
  tests?: any[];
  epics?: any[];
  docs?: any;
  security?: any;
  performance?: any;
  observability?: any;
  environments?: any;
  locators?: any;
  data?: any;
  metadata?: Record<string, unknown>;
  components?: any;
  paths?: any;
  testability?: any;
  stateModels?: any;
}

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
  schema?: string;
  name?: string;
  force?: boolean;
  listTemplates?: boolean;
  directory?: string;
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
}

/**
 * Integrate command options for CI/CD generation
 */
export interface IntegrateOptions {
  /** CI provider to generate workflows for */
  provider?: "github" | "gitlab" | "azure" | "all";
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
 * GitHub Templates Configuration
 */
export type GitHubTemplateSetSource =
  | GitHubTemplateSet
  | GitHubFileTemplateRef
  | {
      name?: string;
      description?: string | null;
      sections?: {
        description?: string | null;
        details?: Array<Partial<GitHubTemplateField>>;
        acceptanceCriteria?: string;
        dependencies?: string;
        additional?: Record<string, string>;
      };
      labels?: string[];
      validation?: GitHubTemplateValidation;
    };

export interface GitHubTemplatesConfig {
  /** Base templates that can be inherited from */
  base?: GitHubTemplateSetSource;
  /** Epic template configuration */
  epic?: GitHubTemplateConfig | GitHubFileTemplateRef;
  /** Task template configuration */
  task?: GitHubTemplateConfig | GitHubFileTemplateRef;
  /** Bug report template configuration */
  bugReport?: GitHubTemplateConfig | GitHubFileTemplateRef;
  /** Feature request template configuration */
  featureRequest?: GitHubTemplateConfig | GitHubFileTemplateRef;
  /** GitHub repository configuration files */
  repositoryConfig?: GitHubRepoConfig;
  /** Template discovery paths - directories to search for template files */
  discoveryPaths?: string[];
  /** Default template file extension */
  defaultExtension?: string;
}

/** Reference to a file-based template */
export interface GitHubFileTemplateRef {
  /** Path to template file (relative or absolute) */
  file: string;
  /** Optional metadata for the file template */
  metadata?: {
    name?: string;
    description?: string | null;
    labels?: string[];
    assignees?: string[];
  };
  /** Template to inherit from (file path or template name) */
  inherits?: string;
  /** Template generation options */
  options?: GitHubTemplateOptions;
}

export interface GitHubTemplateSet {
  /** Template name/identifier */
  name: string;
  /** Template description */
  description?: string | null;
  /** Template content sections */
  sections: GitHubTemplateSections;
  /** Default labels to apply */
  labels?: string[];
  /** Template validation rules */
  validation?: GitHubTemplateValidation;
}

export interface GitHubTemplateConfig {
  /** Inherit from base template (template name or file path) */
  inherits?: string;
  /** Template name/identifier */
  name?: string;
  /** Template title format */
  title?: string;
  /** Template description */
  description?: string | null;
  /** Custom template sections */
  sections?: Partial<GitHubTemplateSections>;
  /** Labels to apply */
  labels?: string[];
  /** Default assignees */
  assignees?: string[];
  /** Template validation rules */
  validation?: GitHubTemplateValidation;
  /** Template generation options */
  options?: GitHubTemplateOptions;
  /** Path to template file (if using file-based template) */
  templateFile?: string;
}

export interface GitHubTemplateSections {
  /** Description section content */
  description: string;
  /** Details table fields */
  details?: GitHubTemplateField[];
  /** Acceptance criteria section */
  acceptanceCriteria?: string;
  /** Dependencies section */
  dependencies?: string;
  /** Additional sections */
  additional?: Record<string, string>;
}

export interface GitHubTemplateField {
  /** Field name */
  name: string;
  /** Field label for display */
  label: string;
  /** Whether field is required */
  required?: boolean;
  /** Field type */
  type?: "text" | "number" | "date" | "select" | "boolean";
  /** Default value */
  default?: string;
  /** Validation pattern */
  pattern?: string;
  /** Allowed values for select type */
  enum?: string[];
  /** Help text */
  help?: string;
}

export interface GitHubTemplateValidation {
  /** Field validation rules */
  fields?: GitHubFieldValidation[];
  /** Custom validation functions */
  custom?: string[];
}

export interface GitHubFieldValidation {
  /** Field name to validate */
  field: string;
  /** Whether field is required */
  required?: boolean;
  /** Minimum length */
  minLength?: number;
  /** Maximum length */
  maxLength?: number;
  /** Regex pattern */
  pattern?: string;
  /** Allowed values */
  enum?: string[];
  /** Custom validation function name */
  validator?: string;
  /** Error message */
  errorMessage?: string;
}

export interface GitHubRepoConfig {
  /** Issue template chooser configuration */
  issueConfig?: {
    /** Allow blank issues */
    blankIssuesEnabled?: boolean;
    /** Contact links */
    contactLinks?: Array<{
      name: string;
      url: string;
      about: string;
    }>;
  };
  /** Labels configuration */
  labels?: GitHubLabel[];
  /** Pull request template */
  pullRequestTemplate?: string;
}

export interface GitHubLabel {
  /** Label name */
  name: string;
  /** Label color (hex without #) */
  color: string;
  /** Label description */
  description?: string | null;
}

export interface GitHubTemplateOptions {
  /** Include metadata in templates */
  includeMetadata?: boolean;
  /** Include Arbiter IDs for tracking */
  includeArbiterIds?: boolean;
  /** Include acceptance criteria */
  includeAcceptanceCriteria?: boolean;
  /** Include dependencies */
  includeDependencies?: boolean;
  /** Include time estimations */
  includeEstimations?: boolean;
  /** Custom field values */
  customFields?: Record<string, string>;
}

/**
 * Template management command options
 */
export interface TemplateManagementOptions {
  /** Template type */
  type?: "epic" | "task" | "bug" | "feature";
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
  format?: "auto" | "json" | "yaml" | "typescript" | "python" | "rust" | "go" | "shell";
  /** Sync with GitHub */
  syncGithub?: boolean;
  /** Use configuration file */
  useConfig?: boolean;
  /** Use Git remote for repository detection */
  useGitRemote?: boolean;
  /** Webhook URL */
  url?: string;
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

export interface HealthResponse {
  status: string;
  timestamp: string;
  issues?: string[];
}

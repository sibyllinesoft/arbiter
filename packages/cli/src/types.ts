/**
 * @packageDocumentation
 * Shared type definitions for the Arbiter CLI.
 */

// Re-export command options types
export type {
  ExportFormat,
  ProgressOptions,
  StepProgressOptions,
  ProgressBarOptions,
  InitOptions,
  CheckOptions,
  ValidateOptions,
  ExportOptions,
  TemplateOptions,
  CreateOptions,
  ImportOptions,
  DiffOptions,
  ExecuteOptions,
  TestOptions,
  WatchOptions,
  SurfaceOptions,
  TestsOptions,
  VersionPlanOptions,
  VersionReleaseOptions,
  IDEOptions,
  SyncOptions,
  IntegrateOptions,
  DocsOptions,
  ExamplesOptions,
  TemplateManagementOptions,
  ExplainOptions,
  GenerateOptions,
  PreviewOptions,
  RenameOptions,
  HealthResponse,
} from "./types/command-options.js";

// Re-export issue types from shared package
export type {
  IssueSpec,
  ChecklistItem,
  IssueValidationConfig,
  IssueValidationResult,
} from "@arbiter/specification";
export {
  DEFAULT_ISSUE_VALIDATION,
  validateIssue,
  createIssue,
  createChecklistItem,
} from "@arbiter/specification";

// Re-export GitHub types
export type {
  GitHubRepo,
  GitHubSyncConfig,
  GitHubTemplateSetSource,
  GitHubTemplatesConfig,
  GitHubFileTemplateRef,
  GitHubTemplateSet,
  GitHubTemplateConfig,
  GitHubTemplateSections,
  GitHubTemplateField,
  GitHubTemplateValidation,
  GitHubFieldValidation,
  GitHubRepoConfig,
  GitHubLabel,
  GitHubTemplateOptions,
} from "./types/github.js";

import type { UIOptionCatalog, UIOptionGeneratorMap } from "@arbiter/specification";
// Import types used within this file
import type { GitHubSyncConfig } from "./types/github.js";

/**
 * Configuration for a single default group.
 *
 * @public
 */
export interface DefaultGroupConfig {
  /** Display name for the group */
  name: string;
  /** Optional description of the group's purpose */
  description?: string;
  /** Directory name (defaults to the group key if not specified) */
  directory?: string;
  /** Artifact types that default to this group when no parent is specified */
  defaultFor?: Array<"service" | "client" | "tool" | "package">;
}

/**
 * Membership mapping from artifact kinds to default group IDs
 */
export interface DefaultMembershipConfig {
  /** Default group for services */
  service?: string;
  /** Default group for clients/frontends */
  client?: string;
  /** Default group for tools */
  tool?: string;
  /** Default group for shared packages */
  package?: string;
}

/**
 * Configuration for default groups that organize project artifacts.
 * Groups are hierarchical containers for organizing artifacts.
 *
 * @public
 */
export interface DefaultConfig {
  /** Map of group key to group configuration */
  groups: Record<string, DefaultGroupConfig>;
  /** Maps artifact kinds to their default group */
  membership?: DefaultMembershipConfig;
}

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
  /** Whether localMode was explicitly set by the user (not derived) */
  localModeExplicitlySet?: boolean;
  /** Whether apiUrl was explicitly configured (file, env, or CLI flag) */
  apiUrlExplicitlyConfigured?: boolean;
  /** Verbose output flag */
  verbose?: boolean;
  /** Default project directory */
  projectDir: string;
  /** Optional explicit path to the assembly/spec file */
  specPath?: string;
  /** Project ID for API requests */
  projectId?: string;
  /** Optional path to the loaded configuration file */
  configFilePath?: string;
  /** Optional directory of the loaded configuration file */
  configDir?: string;
  /** Paths to all config files that were loaded and merged (in order from least to most specific) */
  loadedConfigPaths?: string[];
  /** Optional friendly project name used in scaffolding */
  projectName?: string;
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
  /** Default groups configuration for artifact organization */
  default?: DefaultConfig;
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

export interface LanguagePluginConfig {
  /** Optional testing configuration owned by the language plugin */
  testing?: LanguageTestingConfig;
  /** Arbitrary plugin-specific options */
  [key: string]: unknown;
}

/**
 * Configuration for the path routing system.
 *
 * @public
 */
export interface RoutingConfig {
  /** Routing mode: 'by-type' (default) organizes by artifact type, 'by-group' organizes by group, 'parent-based' uses default config membership */
  mode?: "by-type" | "by-group" | "parent-based";
  /** Path to a custom router module (exports a PathRouter) */
  customRouter?: string;
  /** Emit warnings when artifacts lack a parent field (useful for enforcing grouping) */
  warnOnUngrouped?: boolean;
}

export interface GeneratorConfig {
  /** Mapping of language identifiers to template override directories */
  templateOverrides?: Record<string, string | string[]>;
  /** Language-specific plugin configuration objects */
  plugins?: Record<string, LanguagePluginConfig>;
  /** Lifecycle hook commands executed around generation */
  hooks?: GeneratorHookMap;
  /** Testing configuration (frameworks, output paths, master runner, etc.) */
  testing?: GeneratorTestingConfig;
  /** Docker artifact configuration */
  docker?: DockerGeneratorConfig;
  /** Path routing configuration for artifact organization */
  routing?: RoutingConfig;
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

export interface GeneratorTestingConfig {
  /** Optional master test runner settings */
  master?: MasterTestRunnerConfig;
}

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
  /** Shared packages and domain libraries */
  packagesDirectory: string;
  /** Developer tooling, CLIs, and automation scripts */
  toolsDirectory: string;
  /** Project documentation output */
  docsDirectory: string;
  /** Shared test suites and golden fixtures */
  testsDirectory: string;
  /** Infrastructure as code and deployment assets */
  infraDirectory: string;
  /** Flags that force certain artifact directories to live inside their owning package */
  packageRelative?: {
    docsDirectory?: boolean;
    testsDirectory?: boolean;
    infraDirectory?: boolean;
  };
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
export interface BehaviorSpec {
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
  flows: BehaviorSpec[];
  ops?: OpsSpec | null;
  capabilities?: Record<string, CapabilitySpec> | null;
  tests?: any[];
  docs?: any;
  security?: any;
  performance?: any;
  observability?: any;
  environments?: any;
  enums?: Record<string, string[]>;
  permissions?: Record<string, string[]>;
  locators?: any;
  data?: any;
  metadata?: Record<string, unknown>;
  components?: any;
  paths?: any;
  testability?: any;
  processes?: any;
  operations?: Record<string, any>;
  /**
   * @deprecated use processes
   */
  stateModels?: any;
  /**
   * @deprecated use environments
   */
  deployments?: any;
  /**
   * @deprecated use environments
   */
  deployment?: any;
}

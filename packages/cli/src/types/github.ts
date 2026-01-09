/**
 * GitHub-related type definitions.
 *
 * Types for GitHub synchronization, templates, and repository configuration.
 * Extracted from types.ts for modularity.
 */

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
  /** Issue title prefixes */
  prefixes?: {
    /** Prefix applied to group issues */
    group?: string;
    /** Prefix applied to issue items */
    issue?: string;
  };
  /** Label configuration */
  labels?: {
    /** Labels applied to all synced issues */
    default?: string[];
    /** Group priority → labels */
    groups?: Record<string, string[]>;
    /** Issue type → labels */
    issues?: Record<string, string[]>;
  };
  /** Sync automation behavior */
  automation?: {
    /** Create GitHub milestones for groups */
    createMilestones?: boolean;
    /** Close GitHub issues when issues/groups are completed */
    autoClose?: boolean;
    /** Update GitHub issue descriptions with acceptance criteria */
    syncAcceptanceCriteria?: boolean;
    /** Sync assignees between systems */
    syncAssignees?: boolean;
  };
  /** GitHub templates configuration */
  templates?: GitHubTemplatesConfig;
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
  /** Group template configuration */
  group?: GitHubTemplateConfig | GitHubFileTemplateRef;
  /** Issue template configuration */
  issue?: GitHubTemplateConfig | GitHubFileTemplateRef;
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

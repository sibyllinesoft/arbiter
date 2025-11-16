/**
 * Type definitions for CLI documentation generation
 */

/**
 * Configuration options for documentation generation
 */
export interface DocGenerationOptions {
  /** Output directory for generated documentation */
  outputDir: string;
  /** Formats to generate (markdown, json, html) */
  formats: ("markdown" | "json" | "html")[];
  /** Include examples in documentation */
  includeExamples?: boolean;
  /** Include internal commands */
  includeInternal?: boolean;
  /** Custom template directory */
  templateDir?: string;
  /** Additional metadata to include */
  metadata?: Record<string, any>;
}

/**
 * Metadata about a command
 */
export interface CommandMetadata {
  /** CLI version when command was added */
  version: string;
  /** Command category for organization */
  category: string;
  /** Tags for filtering and organization */
  tags: string[];
  /** Stability level */
  stability: "experimental" | "beta" | "stable" | "deprecated";
  /** When the command was deprecated (if applicable) */
  deprecatedSince?: string;
  /** Replacement command (if deprecated) */
  replacement?: string;
}

/**
 * Information about a command argument
 */
export interface ArgumentInfo {
  /** Argument name */
  name: string;
  /** Whether the argument is required */
  required: boolean;
  /** Whether the argument accepts multiple values */
  variadic: boolean;
  /** Argument description */
  description?: string;
  /** Accepted values */
  choices?: string[];
  /** Default value */
  defaultValue?: any;
}

/**
 * Information about a command option
 */
export interface OptionInfo {
  /** Option flags (-v, --verbose) */
  flags: string;
  /** Option description */
  description: string;
  /** Whether the option is required */
  required: boolean;
  /** Default value */
  defaultValue?: any;
  /** Possible values for the option */
  choices?: string[];
  /** Environment variable that can set this option */
  envVar?: string;
}

/**
 * Complete information about a parsed command
 */
export interface ParsedCommandInfo {
  /** Command name */
  name: string;
  /** Full command path (e.g., "add service") */
  fullName: string;
  /** Parent command names */
  parentNames: string[];
  /** Command description */
  description: string;
  /** Usage string */
  usage: string;
  /** Command arguments */
  arguments: ArgumentInfo[];
  /** Command options */
  options: OptionInfo[];
  /** Usage examples */
  examples: string[];
  /** Command metadata */
  metadata: CommandMetadata;
  /** Subcommand names */
  subcommands: string[];
  /** Whether the command is executable */
  isExecutable: boolean;
  /** Raw help text */
  help: string;
  /** TSDoc comments if available */
  docs?: {
    summary?: string;
    description?: string;
    examples?: string[];
    seeAlso?: string[];
    since?: string;
    deprecated?: string;
  };
}

/**
 * Template data for documentation generation
 */
export interface TemplateData {
  /** Generation metadata */
  metadata: {
    generatedAt: string;
    version: string;
    commandCount: number;
  };
  /** Commands organized by category */
  categories: Record<string, ParsedCommandInfo[]>;
  /** All commands in a flat list */
  commands: ParsedCommandInfo[];
  /** Global options */
  globalOptions: OptionInfo[];
}

/**
 * Configuration for built-in templates
 */
export interface TemplateConfig {
  /** Template format */
  format: "markdown" | "html" | "json";
  /** Template content or path */
  template: string;
  /** Output filename */
  filename: string;
  /** Custom rendering options */
  options?: {
    /** Include table of contents */
    includeToc?: boolean;
    /** Include search functionality */
    includeSearch?: boolean;
    /** Custom CSS for HTML output */
    customCss?: string;
    /** Include command examples */
    includeExamples?: boolean;
  };
}

/**
 * Documentation extraction configuration
 */
export interface ExtractionConfig {
  /** Paths to source files to analyze for TSDoc */
  sourcePaths?: string[];
  /** Include private/internal commands */
  includeInternal?: boolean;
  /** Extract examples from test files */
  extractTestExamples?: boolean;
  /** Pattern for example extraction */
  examplePatterns?: string[];
}

/**
 * Build integration configuration
 */
export interface BuildConfig {
  /** Whether to run as part of build process */
  enabled: boolean;
  /** Output directory relative to project root */
  outputDir: string;
  /** Formats to generate */
  formats: ("markdown" | "json" | "html")[];
  /** Whether to fail build on documentation errors */
  failOnError: boolean;
  /** Watch mode for development */
  watch?: boolean;
  /** Git integration */
  git?: {
    /** Commit generated docs */
    autoCommit: boolean;
    /** Commit message template */
    commitMessage: string;
    /** Branch to commit to */
    targetBranch?: string;
  };
}

/**
 * Analysis result for command structure
 */
export interface AnalysisResult {
  /** All discovered commands */
  commands: ParsedCommandInfo[];
  /** Commands by category */
  categories: Record<string, ParsedCommandInfo[]>;
  /** Validation errors */
  errors: string[];
  /** Warnings about missing documentation */
  warnings: string[];
  /** Statistics */
  stats: {
    totalCommands: number;
    executableCommands: number;
    subcommands: number;
    averageOptionsPerCommand: number;
    categoryCounts: Record<string, number>;
  };
}

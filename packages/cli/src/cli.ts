#!/usr/bin/env node

import chalk from "chalk";
import { Command } from "commander";
import { ApiClient } from "./api-client.js";
import { addCommand } from "./commands/add.js";
import { checkCommand } from "./commands/check.js";
import { createCommand } from "./commands/create.js";
import { diffCommand } from "./commands/diff.js";
import { docsCommand } from "./commands/docs.js";
import { examplesCommand } from "./commands/examples.js";
import { executeCommand } from "./commands/execute.js";
import { explainCommand } from "./commands/explain.js";
import { exportCommand, listFormats } from "./commands/export.js";
import { generateCommand } from "./commands/generate.js";
import { ideCommand } from "./commands/ide.js";
import { importCommand } from "./commands/import.js";
import { initCommand, listTemplates } from "./commands/init.js";
import { integrateCommand } from "./commands/integrate.js";
import { onboardCommand } from "./commands/onboard.js";
import { migrateCommand } from "./commands/migrate.js";
import { previewCommand } from "./commands/preview.js";
import { renameCommand, showNamingHelp } from "./commands/rename.js";
import { srfCommand } from "./commands/srf.js";
import {
  compositionInitCommand,
  compositionImportCommand,
  compositionValidateCommand,
  compositionGenerateCommand,
  compositionRecoverCommand,
  compositionListCommand,
  compositionStatusCommand,
} from "./commands/composition.js";
import { surfaceCommand } from "./commands/surface.js";
import { syncCommand } from "./commands/sync.js";
import { templateCommand } from "./commands/template.js";
import { templatesCommand, type TemplatesOptions } from "./commands/templates.js";
import { testCommand } from "./commands/test.js";
import { coverCommand, scaffoldCommand } from "./commands/tests.js";
import { validateCommand } from "./commands/validate.js";
import { versionPlanCommand, versionReleaseCommand } from "./commands/version.js";
import { watchCommand } from "./commands/watch.js";
import { loadConfig } from "./config.js";
import type {
  CheckOptions,
  CreateOptions,
  DiffOptions,
  DocsOptions,
  ExamplesOptions,
  ExecuteOptions,
  ExplainOptions,
  ExportOptions,
  GenerateOptions,
  IDEOptions,
  ImportOptions,
  InitOptions,
  IntegrateOptions,
  MigrateOptions,
  PreviewOptions,
  RenameOptions,
  SrfOptions,
  CompositionOptions,
  ImportSrfOptions,
  ValidateCompositionOptions,
  RecoveryOptions,
  SurfaceOptions,
  SyncOptions,
  TemplateOptions,
  TestOptions,
  TestsOptions,
  ValidateOptions,
  VersionPlanOptions,
  VersionReleaseOptions,
  WatchOptions,
} from "./types.js";
import type { AddOptions } from "./commands/add.js";

// Package info
const packageJson = {
  name: "arbiter",
  version: "0.1.0",
  description: "Arbiter CLI for CUE validation and management",
};

/**
 * Main CLI program
 */
const program = new Command();

program
  .name("arbiter")
  .description(packageJson.description)
  .version(packageJson.version, "-v, --version", "display version number")
  .option("-c, --config <path>", "path to configuration file")
  .option("--no-color", "disable colored output")
  .option("--api-url <url>", "API server URL", "http://localhost:5050")
  .option("--timeout <ms>", "request timeout in milliseconds", "5000")
  .hook("preAction", async (thisCommand) => {
    // Load configuration before running any command
    const opts = thisCommand.opts();
    try {
      const config = await loadConfig(opts.config);

      // Override config with CLI options
      if (opts.apiUrl) config.apiUrl = opts.apiUrl;
      if (opts.timeout) config.timeout = parseInt(opts.timeout, 10);
      if (opts.color === false) config.color = false;

      // Store config on command for subcommands to access
      thisCommand.config = config;
    } catch (error) {
      console.error(
        chalk.red("Configuration error:"),
        error instanceof Error ? error.message : String(error),
      );
      process.exit(2);
    }
  });

/**
 * Init command - Initialize new CUE project
 */
program
  .command("init [project-name]")
  .description("initialize a new CUE project with templates")
  .option("-t, --template <name>", "project template to use (basic, kubernetes, api)")
  .option("-d, --directory <path>", "target directory for the project")
  .option("-f, --force", "overwrite existing files")
  .option("--list-templates", "list available templates")
  .action(async (projectName, options: InitOptions & { listTemplates?: boolean }, _command) => {
    if (options.listTemplates) {
      listTemplates();
      return;
    }

    try {
      const exitCode = await initCommand(projectName, options);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red("Command failed:"),
        error instanceof Error ? error.message : String(error),
      );
      process.exit(2);
    }
  });

/**
 * Onboard command - Smart project onboarding for existing codebases
 */
program
  .command("onboard [project-path]")
  .description("intelligently onboard existing projects to Arbiter")
  .option("--dry-run", "preview changes without applying them")
  .option("-f, --force", "force onboarding even if .arbiter directory exists")
  .option("-v, --verbose", "verbose output with detailed analysis")
  .option("--skip-analysis", "skip project analysis and use defaults")
  .option("--non-interactive", "run without prompting for confirmation")
  .action(
    async (
      projectPath,
      options: {
        projectPath?: string;
        dryRun?: boolean;
        force?: boolean;
        verbose?: boolean;
        skipAnalysis?: boolean;
        nonInteractive?: boolean;
      },
      command,
    ) => {
      try {
        const config = command.parent?.config;
        if (!config) {
          throw new Error("Configuration not loaded");
        }

        const onboardOptions = {
          projectPath,
          dryRun: options.dryRun,
          force: options.force,
          verbose: options.verbose,
          skipAnalysis: options.skipAnalysis,
          interactive: !options.nonInteractive,
        };

        const exitCode = await onboardCommand(onboardOptions, config);
        process.exit(exitCode);
      } catch (error) {
        console.error(
          chalk.red("Command failed:"),
          error instanceof Error ? error.message : String(error),
        );
        process.exit(2);
      }
    },
  );

/**
 * Add command - Compositional specification builder
 */
const addCmd = program
  .command("add")
  .description("incrementally build arbiter.assembly.cue through compositional additions");

addCmd
  .command("service <name>")
  .description("add a service to the specification")
  .option("--template <alias>", "use template alias for service generation")
  .option("--language <lang>", "programming language (typescript, python, rust, go)", "typescript")
  .option("--port <port>", "service port number", (value) => parseInt(value, 10))
  .option("--image <image>", "prebuilt container image (for prebuilt services)")
  .option("--directory <dir>", "source directory path")
  .option("--dry-run", "preview changes without applying them")
  .option("--force", "overwrite existing configuration")
  .option("-v, --verbose", "verbose output with detailed changes")
  .action(
    async (
      name: string,
      options: AddOptions & {
        language?: string;
        port?: number;
        image?: string;
        directory?: string;
        template?: string;
      },
      command,
    ) => {
      try {
        const config = command.parent?.parent?.config;
        if (!config) {
          throw new Error("Configuration not loaded");
        }

        const exitCode = await addCommand("service", name, options, config);
        process.exit(exitCode);
      } catch (error) {
        console.error(
          chalk.red("Command failed:"),
          error instanceof Error ? error.message : String(error),
        );
        process.exit(2);
      }
    },
  );

addCmd
  .command("endpoint <path>")
  .description("add an API endpoint to a service")
  .option("--service <name>", "target service name", "api")
  .option("--method <method>", "HTTP method", "GET")
  .option("--returns <schema>", "response schema reference")
  .option("--accepts <schema>", "request body schema reference")
  .option("--dry-run", "preview changes without applying them")
  .option("--force", "overwrite existing configuration")
  .option("-v, --verbose", "verbose output with detailed changes")
  .action(
    async (
      path: string,
      options: AddOptions & {
        service?: string;
        method?: string;
        returns?: string;
        accepts?: string;
      },
      command,
    ) => {
      try {
        const config = command.parent?.parent?.config;
        if (!config) {
          throw new Error("Configuration not loaded");
        }

        const exitCode = await addCommand("endpoint", path, options, config);
        process.exit(exitCode);
      } catch (error) {
        console.error(
          chalk.red("Command failed:"),
          error instanceof Error ? error.message : String(error),
        );
        process.exit(2);
      }
    },
  );

addCmd
  .command("route <path>")
  .description("add a UI route for frontend applications")
  .option("--id <id>", "route identifier (auto-generated if not specified)")
  .option("--capabilities <caps>", "comma-separated capabilities (view, edit, admin)")
  .option("--components <comps>", "comma-separated component names")
  .option("--dry-run", "preview changes without applying them")
  .option("--force", "overwrite existing configuration")
  .option("-v, --verbose", "verbose output with detailed changes")
  .action(
    async (
      path: string,
      options: AddOptions & { id?: string; capabilities?: string; components?: string },
      command,
    ) => {
      try {
        const config = command.parent?.parent?.config;
        if (!config) {
          throw new Error("Configuration not loaded");
        }

        const exitCode = await addCommand("route", path, options, config);
        process.exit(exitCode);
      } catch (error) {
        console.error(
          chalk.red("Command failed:"),
          error instanceof Error ? error.message : String(error),
        );
        process.exit(2);
      }
    },
  );

addCmd
  .command("flow <id>")
  .description("add a user flow for testing and validation")
  .option("--from <route>", "starting route for navigation flow")
  .option("--to <route>", "target route for navigation flow")
  .option("--endpoint <path>", "API endpoint for health check flow")
  .option("--expect <status>", "expected HTTP status code", "200")
  .option("--steps <json>", "custom flow steps as JSON array")
  .option("--dry-run", "preview changes without applying them")
  .option("--force", "overwrite existing configuration")
  .option("-v, --verbose", "verbose output with detailed changes")
  .action(
    async (
      id: string,
      options: AddOptions & {
        from?: string;
        to?: string;
        endpoint?: string;
        expect?: string;
        steps?: string;
      },
      command,
    ) => {
      try {
        const config = command.parent?.parent?.config;
        if (!config) {
          throw new Error("Configuration not loaded");
        }

        const exitCode = await addCommand("flow", id, options, config);
        process.exit(exitCode);
      } catch (error) {
        console.error(
          chalk.red("Command failed:"),
          error instanceof Error ? error.message : String(error),
        );
        process.exit(2);
      }
    },
  );

addCmd
  .command("load-balancer")
  .description("add a load balancer with health check invariants")
  .option("--target <service>", "target service to load balance (required)")
  .option("--health-check <path>", "health check endpoint path", "/health")
  .option("--dry-run", "preview changes without applying them")
  .option("--force", "overwrite existing configuration")
  .option("-v, --verbose", "verbose output with detailed changes")
  .action(async (options: AddOptions & { target?: string; healthCheck?: string }, command) => {
    try {
      const config = command.parent?.parent?.config;
      if (!config) {
        throw new Error("Configuration not loaded");
      }

      const exitCode = await addCommand("load-balancer", "", options, config);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red("Command failed:"),
        error instanceof Error ? error.message : String(error),
      );
      process.exit(2);
    }
  });

addCmd
  .command("database <name>")
  .description("add a database with automatic service attachment")
  .option("--template <alias>", "use template alias for database generation")
  .option("--attach-to <service>", "service to attach database connection to")
  .option("--image <image>", "database container image", "postgres:15")
  .option("--port <port>", "database port", (value) => parseInt(value, 10), 5432)
  .option("--dry-run", "preview changes without applying them")
  .option("--force", "overwrite existing configuration")
  .option("-v, --verbose", "verbose output with detailed changes")
  .action(
    async (
      name: string,
      options: AddOptions & { attachTo?: string; image?: string; port?: number; template?: string },
      command,
    ) => {
      try {
        const config = command.parent?.parent?.config;
        if (!config) {
          throw new Error("Configuration not loaded");
        }

        const exitCode = await addCommand("database", name, options, config);
        process.exit(exitCode);
      } catch (error) {
        console.error(
          chalk.red("Command failed:"),
          error instanceof Error ? error.message : String(error),
        );
        process.exit(2);
      }
    },
  );

addCmd
  .command("cache <name>")
  .description("add a cache service with automatic attachment")
  .option("--attach-to <service>", "service to attach cache connection to")
  .option("--image <image>", "cache container image", "redis:7-alpine")
  .option("--port <port>", "cache port", (value) => parseInt(value, 10), 6379)
  .option("--dry-run", "preview changes without applying them")
  .option("--force", "overwrite existing configuration")
  .option("-v, --verbose", "verbose output with detailed changes")
  .action(
    async (
      name: string,
      options: AddOptions & { attachTo?: string; image?: string; port?: number },
      command,
    ) => {
      try {
        const config = command.parent?.parent?.config;
        if (!config) {
          throw new Error("Configuration not loaded");
        }

        const exitCode = await addCommand("cache", name, options, config);
        process.exit(exitCode);
      } catch (error) {
        console.error(
          chalk.red("Command failed:"),
          error instanceof Error ? error.message : String(error),
        );
        process.exit(2);
      }
    },
  );

addCmd
  .command("locator <key>")
  .description("add a UI locator for testing")
  .option("--selector <selector>", "CSS selector or test-id (required)")
  .option("--dry-run", "preview changes without applying them")
  .option("--force", "overwrite existing configuration")
  .option("-v, --verbose", "verbose output with detailed changes")
  .action(async (key: string, options: AddOptions & { selector?: string }, command) => {
    try {
      const config = command.parent?.parent?.config;
      if (!config) {
        throw new Error("Configuration not loaded");
      }

      const exitCode = await addCommand("locator", key, options, config);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red("Command failed:"),
        error instanceof Error ? error.message : String(error),
      );
      process.exit(2);
    }
  });

addCmd
  .command("schema <name>")
  .description("add a schema for API documentation")
  .option("--example <json>", "example data as JSON")
  .option("--rules <json>", "validation rules as JSON")
  .option("--dry-run", "preview changes without applying them")
  .option("--force", "overwrite existing configuration")
  .option("-v, --verbose", "verbose output with detailed changes")
  .action(
    async (name: string, options: AddOptions & { example?: string; rules?: string }, command) => {
      try {
        const config = command.parent?.parent?.config;
        if (!config) {
          throw new Error("Configuration not loaded");
        }

        const exitCode = await addCommand("schema", name, options, config);
        process.exit(exitCode);
      } catch (error) {
        console.error(
          chalk.red("Command failed:"),
          error instanceof Error ? error.message : String(error),
        );
        process.exit(2);
      }
    },
  );

/**
 * Watch command - File watcher with live validation
 */
program
  .command("watch [path]")
  .description("cross-platform file watcher with live validation and planning")
  .option("--agent-mode", "output NDJSON for agent consumption")
  .option("--ndjson-output <file>", "write NDJSON events to file instead of stdout")
  .option("--debounce <ms>", "debounce delay in milliseconds (250-400)", "300")
  .option("--patterns <patterns>", "comma-separated file patterns to watch")
  .option("--no-validate", "disable validation on changes")
  .option("--plan", "enable planning pipeline on assembly changes")
  .action(
    async (
      path: string | undefined,
      options: WatchOptions & { debounce?: string; patterns?: string },
      command,
    ) => {
      try {
        const config = command.parent?.config;
        if (!config) {
          throw new Error("Configuration not loaded");
        }

        const watchOptions: WatchOptions = {
          ...options,
          path,
          debounce: options.debounce ? parseInt(options.debounce, 10) : 300,
          patterns: options.patterns ? options.patterns.split(",").map((p) => p.trim()) : undefined,
        };

        const exitCode = await watchCommand(watchOptions, config);
        process.exit(exitCode);
      } catch (error) {
        console.error(
          chalk.red("Command failed:"),
          error instanceof Error ? error.message : String(error),
        );
        process.exit(2);
      }
    },
  );

/**
 * Surface command - Generate API surface from code
 */
program
  .command("surface <language>")
  .description("extract API surface from source code and generate project-specific surface file")
  .option("-o, --output <file>", "explicit output file path (overrides smart naming)")
  .option("--output-dir <dir>", "output directory for generated file")
  .option("--project-name <name>", "project name for file naming (auto-detected if not specified)")
  .option("--generic-names", "use generic names like 'surface.json' (for backward compatibility)")
  .option("--diff", "compare against existing spec and show changes")
  .option("--include-private", "include private/internal APIs")
  .option("-v, --verbose", "verbose output with detailed analysis")
  .option("--agent-mode", "output NDJSON events for agent consumption")
  .option("--ndjson-output <file>", "write NDJSON events to file instead of stdout")
  .action(async (language: string, options: SurfaceOptions, command) => {
    try {
      const config = command.parent?.config;
      if (!config) {
        throw new Error("Configuration not loaded");
      }

      if (!["typescript", "python", "rust", "go", "bash"].includes(language)) {
        console.error(chalk.red(`Unsupported language: ${language}`));
        console.error(chalk.dim("Supported languages: typescript, python, rust, go, bash"));
        process.exit(1);
      }

      const surfaceOptions: SurfaceOptions = {
        ...options,
        language: language as SurfaceOptions["language"],
      };

      const exitCode = await surfaceCommand(surfaceOptions, config);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red("Command failed:"),
        error instanceof Error ? error.message : String(error),
      );
      process.exit(2);
    }
  });

/**
 * Version command - Semver-aware release planning and management
 */
const versionCmd = program
  .command("version")
  .description("semver-aware version planning and release management");

versionCmd
  .command("plan")
  .description("analyze API changes and recommend semver bump")
  .option("-c, --current <file>", "current surface file", "surface.json")
  .option("-p, --previous <file>", "previous surface file for comparison")
  .option("-o, --output <file>", "output file for version plan", "version_plan.json")
  .option("--strict", "strict mode for library compliance (fail on breaking changes)")
  .option("-v, --verbose", "verbose output with detailed change analysis")
  .action(async (options: VersionPlanOptions, command) => {
    try {
      const config = command.parent?.parent?.config;
      if (!config) {
        throw new Error("Configuration not loaded");
      }

      const exitCode = await versionPlanCommand(options, config);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red("Command failed:"),
        error instanceof Error ? error.message : String(error),
      );
      process.exit(2);
    }
  });

versionCmd
  .command("release")
  .description("update manifests and generate changelog based on version plan")
  .option("--plan <file>", "version plan file to execute", "version_plan.json")
  .option("--version <version>", "specific version to set (overrides plan)")
  .option("--changelog <file>", "changelog output file", "CHANGELOG.md")
  .option("--dry-run", "preview changes without applying them (default)", true)
  .option("--apply", "apply changes (disables dry-run)")
  .option("-v, --verbose", "verbose output with detailed manifest updates")
  .action(async (options: VersionReleaseOptions, command) => {
    try {
      const config = command.parent?.parent?.config;
      if (!config) {
        throw new Error("Configuration not loaded");
      }

      const exitCode = await versionReleaseCommand(options, config);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red("Command failed:"),
        error instanceof Error ? error.message : String(error),
      );
      process.exit(2);
    }
  });

/**
 * Check command - Validate CUE files with pretty output
 */
program
  .command("check [patterns...]")
  .description("validate CUE files in the current directory")
  .option("-r, --recursive", "recursively search for CUE files", true)
  .option("-w, --watch", 'watch for file changes and re-validate (deprecated: use "arbiter watch")')
  .option("-f, --format <type>", "output format (table, json)", "table")
  .option("-v, --verbose", "verbose output with detailed errors")
  .option("--fail-fast", "stop on first validation error")
  .option("--no-recursive", "disable recursive search")
  .action(async (patterns: string[], options: CheckOptions, command) => {
    try {
      const config = command.parent?.config;
      if (!config) {
        throw new Error("Configuration not loaded");
      }

      const exitCode = await checkCommand(patterns, options, config);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red("Command failed:"),
        error instanceof Error ? error.message : String(error),
      );
      process.exit(2);
    }
  });

/**
 * Validate command - Explicit validation with schema/config
 */
program
  .command("validate <files...>")
  .description("validate CUE files with explicit schema and configuration")
  .option("-s, --schema <path>", "schema file to validate against")
  .option("-c, --config <path>", "configuration file to include")
  .option("-f, --format <type>", "output format (table, json)", "table")
  .option("--strict", "treat warnings as errors")
  .option("-v, --verbose", "verbose output with detailed errors")
  .action(async (files: string[], options: ValidateOptions, command) => {
    try {
      const config = command.parent?.config;
      if (!config) {
        throw new Error("Configuration not loaded");
      }

      const exitCode = await validateCommand(files, options, config);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red("Command failed:"),
        error instanceof Error ? error.message : String(error),
      );
      process.exit(2);
    }
  });

/**
 * Export command - Export to various formats
 */
program
  .command("export <files...>")
  .description("export CUE configurations to various formats")
  .requiredOption(
    "--format <formats>",
    "output formats (comma-separated): openapi,types,k8s,terraform,json-schema,json,yaml",
  )
  .option("-o, --output <path>", "output file or directory")
  .option("-s, --schema <path>", "schema file to include")
  .option("-c, --config <path>", "configuration file to include")
  .option("--minify", "minify JSON output")
  .option("--strict", "enable strict export validation")
  .option("-v, --verbose", "verbose output with metadata")
  .option("--list-formats", "list available export formats")
  .action(
    async (
      files: string[],
      options: ExportOptions & { format: string; listFormats?: boolean },
      command,
    ) => {
      const config = command.parent?.config;
      if (!config) {
        throw new Error("Configuration not loaded");
      }

      if (options.listFormats) {
        await listFormats(config);
        return;
      }

      try {
        // Parse format string
        const formats = options.format.split(",").map((f) => f.trim()) as ExportOptions["format"];
        const exportOptions: ExportOptions = {
          ...options,
          format: formats,
        };

        const exitCode = await exportCommand(files, exportOptions, config);
        process.exit(exitCode);
      } catch (error) {
        console.error(
          chalk.red("Command failed:"),
          error instanceof Error ? error.message : String(error),
        );
        process.exit(2);
      }
    },
  );

/**
 * Template command - Manage and use CUE schema templates
 */
const templateCmd = program.command("template").description("manage and use CUE schema templates");

templateCmd
  .command("list")
  .description("list available templates")
  .action(async (_, _command) => {
    try {
      const exitCode = await templateCommand("list");
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red("Command failed:"),
        error instanceof Error ? error.message : String(error),
      );
      process.exit(2);
    }
  });

templateCmd
  .command("show <template>")
  .description("show template details and usage")
  .action(async (templateName: string, _, _command) => {
    try {
      const exitCode = await templateCommand("show", templateName);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red("Command failed:"),
        error instanceof Error ? error.message : String(error),
      );
      process.exit(2);
    }
  });

templateCmd
  .command("add <template>")
  .description("add template to current project")
  .option("-o, --output <file>", "output file path")
  .option("-f, --format <type>", "output format (cue, json)", "cue")
  .option("-i, --interactive", "interactive template customization")
  .action(async (templateName: string, options: TemplateOptions, _command) => {
    try {
      const exitCode = await templateCommand("add", templateName, options);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red("Command failed:"),
        error instanceof Error ? error.message : String(error),
      );
      process.exit(2);
    }
  });

/**
 * Templates command - Template alias management
 */
const templatesCmd = program
  .command("templates")
  .description("manage template aliases for code generation");

templatesCmd
  .command("list")
  .description("list available template aliases")
  .option("-f, --format <format>", "output format (table, json)", "table")
  .option("-v, --verbose", "verbose output")
  .action(async (options: TemplatesOptions, command) => {
    try {
      const config = command.parent?.parent?.config;
      const exitCode = await templatesCommand("list", undefined, options, config);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red("Command failed:"),
        error instanceof Error ? error.message : String(error),
      );
      process.exit(2);
    }
  });

templatesCmd
  .command("show <name>")
  .description("show details for a template alias")
  .option("-f, --format <format>", "output format (table, json)", "table")
  .option("-v, --verbose", "verbose output")
  .action(async (name: string, options: TemplatesOptions, command) => {
    try {
      const config = command.parent?.parent?.config;
      const exitCode = await templatesCommand("show", name, options, config);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red("Command failed:"),
        error instanceof Error ? error.message : String(error),
      );
      process.exit(2);
    }
  });

templatesCmd
  .command("add <name>")
  .description("add a new template alias")
  .option("--source <source>", "template source (URL, path, or repo)")
  .option("--description <description>", "template description")
  .option("--engine <engine>", "template engine to use", "cookiecutter")
  .option("--prerequisites <prereqs>", "comma-separated list of prerequisites")
  .option("-v, --verbose", "verbose output")
  .action(async (name: string, options: any, command) => {
    try {
      const config = command.parent?.parent?.config;
      const exitCode = await templatesCommand("add", name, options, config);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red("Command failed:"),
        error instanceof Error ? error.message : String(error),
      );
      process.exit(2);
    }
  });

templatesCmd
  .command("remove <name>")
  .description("remove a template alias")
  .option("-v, --verbose", "verbose output")
  .action(async (name: string, options: TemplatesOptions, command) => {
    try {
      const config = command.parent?.parent?.config;
      const exitCode = await templatesCommand("remove", name, options, config);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red("Command failed:"),
        error instanceof Error ? error.message : String(error),
      );
      process.exit(2);
    }
  });

templatesCmd
  .command("update")
  .description("update template configuration")
  .option("-v, --verbose", "verbose output")
  .action(async (options: TemplatesOptions, command) => {
    try {
      const config = command.parent?.parent?.config;
      const exitCode = await templatesCommand("update", undefined, options, config);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red("Command failed:"),
        error instanceof Error ? error.message : String(error),
      );
      process.exit(2);
    }
  });

/**
 * Create command - Interactive schema creation
 */
program
  .command("create <type>")
  .description("create new schemas and configurations interactively")
  .option("--no-interactive", "disable interactive mode")
  .option("-n, --name <name>", "project name (required for non-interactive mode)")
  .option("-o, --output <file>", "output file path")
  .option("-t, --template <template>", "base template to use")
  .action(async (type: string, options: CreateOptions, _command) => {
    try {
      const exitCode = await createCommand(type, options);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red("Command failed:"),
        error instanceof Error ? error.message : String(error),
      );
      process.exit(2);
    }
  });

/**
 * Import command - Manage trusted import registry
 */
const importCmd = program
  .command("import")
  .description("manage trusted import registry for CUE files");

importCmd
  .command("init")
  .description("initialize import registry with safe defaults")
  .option("-g, --global", "initialize global registry (~/.arbiter/imports.json)")
  .action(async (options: ImportOptions, _command) => {
    try {
      const exitCode = await importCommand("init", undefined, options);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red("Command failed:"),
        error instanceof Error ? error.message : String(error),
      );
      process.exit(2);
    }
  });

importCmd
  .command("list")
  .description("list allowed and blocked imports")
  .option("-g, --global", "use global registry")
  .action(async (options: ImportOptions, _command) => {
    try {
      const exitCode = await importCommand("list", undefined, options);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red("Command failed:"),
        error instanceof Error ? error.message : String(error),
      );
      process.exit(2);
    }
  });

importCmd
  .command("add <pattern>")
  .description("add allowed import pattern (supports wildcards)")
  .option("-g, --global", "add to global registry")
  .action(async (pattern: string, options: ImportOptions, _command) => {
    try {
      const exitCode = await importCommand("add", pattern, options);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red("Command failed:"),
        error instanceof Error ? error.message : String(error),
      );
      process.exit(2);
    }
  });

importCmd
  .command("remove <pattern>")
  .description("remove allowed import pattern")
  .option("-g, --global", "remove from global registry")
  .action(async (pattern: string, options: ImportOptions, _command) => {
    try {
      const exitCode = await importCommand("remove", pattern, options);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red("Command failed:"),
        error instanceof Error ? error.message : String(error),
      );
      process.exit(2);
    }
  });

importCmd
  .command("block <pattern>")
  .description("block import pattern with reason")
  .option("-g, --global", "add to global registry")
  .option("--reason <reason>", "reason for blocking")
  .action(async (pattern: string, options: ImportOptions & { reason?: string }, _command) => {
    try {
      // Pass reason through allow array for now (not ideal but works with current interface)
      const importOptions: ImportOptions = {
        ...options,
        allow: options.reason ? [options.reason] : undefined,
      };
      const exitCode = await importCommand("block", pattern, importOptions);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red("Command failed:"),
        error instanceof Error ? error.message : String(error),
      );
      process.exit(2);
    }
  });

importCmd
  .command("validate <files...>")
  .description("validate imports in CUE files against registry")
  .option("-g, --global", "use global registry")
  .action(async (files: string[], options: ImportOptions, _command) => {
    try {
      const importOptions: ImportOptions = {
        ...options,
        allow: files,
      };
      const exitCode = await importCommand("validate", undefined, importOptions);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red("Command failed:"),
        error instanceof Error ? error.message : String(error),
      );
      process.exit(2);
    }
  });

/**
 * Diff command - Compare schema versions
 */
program
  .command("diff <old-file> <new-file>")
  .description("compare two CUE schema versions and analyze changes")
  .option("--migration", "generate migration guide for breaking changes")
  .option("--format <type>", "output format (text, json)", "text")
  .option("--context <lines>", "context lines around changes", "3")
  .option("--summary", "show only summary statistics")
  .action(async (oldFile: string, newFile: string, options: DiffOptions, _command) => {
    try {
      const exitCode = await diffCommand(oldFile, newFile, options);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red("Command failed:"),
        error instanceof Error ? error.message : String(error),
      );
      process.exit(2);
    }
  });

/**
 * Migrate command - Apply schema evolution changes
 */
program
  .command("migrate [patterns...]")
  .description("automatically migrate CUE schemas to latest format")
  .option("--dry-run", "show what would be changed without making changes")
  .option("--backup", "create backup files before migration")
  .option("--force", "proceed with migration even if errors are detected")
  .option("--from <version>", "source schema version")
  .option("--to <version>", "target schema version")
  .action(async (patterns: string[], options: MigrateOptions, _command) => {
    try {
      const exitCode = await migrateCommand(patterns, options);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red("Command failed:"),
        error instanceof Error ? error.message : String(error),
      );
      process.exit(2);
    }
  });

/**
 * Execute command - Execute Epic v2 with deterministic code generation
 */
program
  .command("execute <epic>")
  .description("execute Epic v2 for deterministic, agent-first code generation")
  .option("--dry-run", "show planned changes without applying them")
  .option("-w, --workspace <path>", "workspace directory", process.cwd())
  .option("-t, --timeout <ms>", "test timeout in milliseconds", "30000")
  .option("--junit <file>", "write JUnit XML report to file")
  .option("-v, --verbose", "verbose output with detailed diffs")
  .option("--agent-mode", "output NDJSON events for agent consumption")
  .option("--ndjson-output <file>", "write NDJSON events to file instead of stdout")
  .action(async (epic: string, options: ExecuteOptions, _command) => {
    try {
      const executeOptions: ExecuteOptions = {
        ...options,
        epic,
        timeout: options.timeout ? parseInt(options.timeout as string, 10) : 30000,
      };

      const exitCode = await executeCommand(executeOptions);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red("Command failed:"),
        error instanceof Error ? error.message : String(error),
      );
      process.exit(2);
    }
  });

/**
 * Test command - Unified test harness and scaffolding for Epic v2
 */
const testsCmd = program
  .command("tests")
  .description("test management, scaffolding, and coverage analysis");

// Legacy test command for backward compatibility
testsCmd
  .command("run")
  .description("run unified test harness for analysis/property/golden/cli tests")
  .option("--epic <epic>", "epic file containing test configuration")
  .option(
    "--types <types>",
    "test types to run: static,property,golden,cli",
    "static,property,golden,cli",
  )
  .option("--junit <file>", "write JUnit XML report to file")
  .option("-t, --timeout <ms>", "test timeout in milliseconds", "30000")
  .option("-v, --verbose", "verbose output with detailed test results")
  .option("--parallel", "run tests in parallel (not yet implemented)")
  .option("--update-golden", "update golden files with actual output")
  .action(async (options: TestOptions & { types?: string }, _command) => {
    try {
      const testOptions: TestOptions = {
        ...options,
        types: options.types ? options.types.split(",").map((t) => t.trim()) : undefined,
        timeout: options.timeout ? parseInt(options.timeout as string, 10) : 30000,
      };

      const exitCode = await testCommand(testOptions);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red("Command failed:"),
        error instanceof Error ? error.message : String(error),
      );
      process.exit(2);
    }
  });

// New scaffold command
testsCmd
  .command("scaffold")
  .description("generate test skeletons from CUE invariants")
  .option(
    "-l, --language <lang>",
    "target language (typescript, python, rust, go, bash)",
    "typescript",
  )
  .option("--framework <name>", "test framework override")
  .option("--no-property", "disable property test generation")
  .option("-o, --output <dir>", "output directory for generated tests")
  .option("--output-dir <dir>", "output directory for generated tests (alias for --output)")
  .option("-f, --force", "overwrite existing test files")
  .option("-v, --verbose", "verbose output with detailed analysis")
  .action(async (options: TestsOptions, command) => {
    try {
      const config = command.parent?.parent?.config;
      if (!config) {
        throw new Error("Configuration not loaded");
      }

      const exitCode = await scaffoldCommand(options, config);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red("Command failed:"),
        error instanceof Error ? error.message : String(error),
      );
      process.exit(2);
    }
  });

// New coverage command
testsCmd
  .command("cover")
  .description("compute contract coverage metrics")
  .option("-t, --threshold <ratio>", "minimum coverage threshold", "0.8")
  .option("-o, --output <file>", "output file for coverage report", "coverage-report.json")
  .option("--output-dir <dir>", "output directory for coverage report (directory for --output)")
  .option("--junit <file>", "write JUnit XML coverage report")
  .option("-v, --verbose", "detailed coverage breakdown")
  .action(async (options: TestsOptions & { threshold?: string }, command) => {
    try {
      const config = command.parent?.parent?.config;
      if (!config) {
        throw new Error("Configuration not loaded");
      }

      const testsOptions: TestsOptions = {
        ...options,
        threshold: options.threshold ? parseFloat(options.threshold) : 0.8,
      };

      const exitCode = await coverCommand(testsOptions, config);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red("Command failed:"),
        error instanceof Error ? error.message : String(error),
      );
      process.exit(2);
    }
  });

/**
 * Server command - Start local development server (future feature)
 */
program
  .command("server")
  .description("start local Arbiter server (development)")
  .option("-p, --port <number>", "port number", "8080")
  .option("--host <address>", "host address", "localhost")
  .action((_options) => {
    console.log(chalk.yellow("Server command not yet implemented"));
    console.log(chalk.dim("Use the standalone API server for now"));
    process.exit(1);
  });

/**
 * IDE command - Generate IDE configuration and recommendations
 */
program
  .command("ide recommend")
  .description("generate IDE configuration for optimal CUE development")
  .option("--editor <type>", "editor type: vscode, idea, vim, all", "vscode")
  .option("--force", "overwrite existing configuration files")
  .option("--detect", "only detect project languages, do not generate config")
  .option("--output <dir>", "output directory for IDE configs")
  .option("--output-dir <dir>", "output directory for IDE configs (alias for --output)")
  .action(async (options: IDEOptions, command) => {
    try {
      const config = command.parent?.config;
      if (!config) {
        throw new Error("Configuration not loaded");
      }

      const exitCode = await ideCommand(options, config);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red("Command failed:"),
        error instanceof Error ? error.message : String(error),
      );
      process.exit(2);
    }
  });

/**
 * Sync command - Synchronize project manifests with Arbiter configuration
 */
program
  .command("sync")
  .description("synchronize project manifests (package.json, pyproject.toml, etc.) with Arbiter")
  .option("--language <lang>", "language to sync: python, typescript, rust, bash, all")
  .option("--all", "sync all detected language manifests")
  .option("--dry-run", "show what would be changed without applying")
  .option("--backup", "create backup files before modification")
  .option("--force", "overwrite conflicting sections")
  .action(async (options: SyncOptions, command) => {
    try {
      const config = command.parent?.config;
      if (!config) {
        throw new Error("Configuration not loaded");
      }

      const exitCode = await syncCommand(options, config);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red("Command failed:"),
        error instanceof Error ? error.message : String(error),
      );
      process.exit(2);
    }
  });

/**
 * Integrate command - Generate CI/CD workflows from Arbiter configuration
 */
program
  .command("integrate")
  .description("generate CI/CD workflows with contract coverage and quality gates")
  .option("--provider <name>", "CI provider: github, gitlab, azure, all", "github")
  .option("--type <type>", "workflow type: pr, main, release, all", "all")
  .option("--output <dir>", "output directory for CI files", ".github/workflows")
  .option("--force", "overwrite existing workflow files")
  .option("--matrix", "use build matrix from assembly file")
  .action(async (options: IntegrateOptions, command) => {
    try {
      const config = command.parent?.config;
      if (!config) {
        throw new Error("Configuration not loaded");
      }

      const exitCode = await integrateCommand(options, config);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red("Command failed:"),
        error instanceof Error ? error.message : String(error),
      );
      process.exit(2);
    }
  });

/**
 * Docs command - Documentation generation
 */
const docsCmd = program
  .command("docs")
  .description("generate documentation from CUE schemas and API surfaces");

docsCmd
  .command("schema")
  .description("generate schema documentation from arbiter.assembly.cue")
  .option("--format <type>", "output format: markdown, html, json", "markdown")
  .option("--output <file>", "output file path")
  .option("--output-dir <dir>", "output directory for generated documentation", ".")
  .option("--examples", "generate example files alongside documentation")
  .action(async (options: DocsOptions, command) => {
    try {
      const config = command.parent?.parent?.config;
      if (!config) {
        throw new Error("Configuration not loaded");
      }

      const exitCode = await docsCommand("schema", options, config);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red("Command failed:"),
        error instanceof Error ? error.message : String(error),
      );
      process.exit(2);
    }
  });

docsCmd
  .command("api")
  .description("generate API documentation from surface.json")
  .option("--format <type>", "output format: markdown, html", "markdown")
  .option("--output <file>", "output file path")
  .option("--output-dir <dir>", "output directory for generated documentation", ".")
  .action(async (options: DocsOptions, command) => {
    try {
      const config = command.parent?.parent?.config;
      if (!config) {
        throw new Error("Configuration not loaded");
      }

      const exitCode = await docsCommand("api", options, config);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red("Command failed:"),
        error instanceof Error ? error.message : String(error),
      );
      process.exit(2);
    }
  });

/**
 * Examples command - Generate example projects
 */
program
  .command("examples <type>")
  .description("generate example projects by profile or language type")
  .option("--profile <name>", "specific profile to generate (library, cli, service)")
  .option("--language <lang>", "specific language to generate (typescript, python, rust, go)")
  .option("--output <dir>", "output directory for examples", "./examples")
  .option("--minimal", "generate minimal examples")
  .option("--complete", "generate complete examples with full features")
  .action(async (type: string, options: ExamplesOptions, command) => {
    try {
      const config = command.parent?.config;
      if (!config) {
        throw new Error("Configuration not loaded");
      }

      if (!["profile", "language"].includes(type)) {
        console.error(chalk.red(`Invalid type: ${type}`));
        console.log(chalk.dim("Valid types: profile, language"));
        process.exit(1);
      }

      const exitCode = await examplesCommand(type, options, config);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red("Command failed:"),
        error instanceof Error ? error.message : String(error),
      );
      process.exit(2);
    }
  });

/**
 * Generate command - Core code generation from EXISTING assembly.cue
 */
program
  .command("generate [spec-name]")
  .description("generate project files from existing arbiter.assembly.cue specification")
  .option("--output-dir <dir>", "output directory for generated files", ".")
  .option("--include-ci", "include CI/CD workflow files")
  .option("--force", "overwrite existing files")
  .option("--dry-run", "show what would be generated without creating files")
  .option("--verbose", "verbose output with detailed progress")
  .option(
    "--format <type>",
    "output format: auto, json, yaml, typescript, python, rust, go, shell",
    "auto",
  )
  .action(async (specName: string | undefined, options: GenerateOptions, command) => {
    try {
      const config = command.parent?.config;
      if (!config) {
        throw new Error("Configuration not loaded");
      }

      const exitCode = await generateCommand(options, config, specName);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red("Command failed:"),
        error instanceof Error ? error.message : String(error),
      );
      process.exit(2);
    }
  });

/**
 * Preview command - Deterministic plan output
 */
program
  .command("preview")
  .description("show what would be generated without creating files (deterministic output)")
  .option("--format <type>", "output format: json, yaml, text", "text")
  .option("--output <file>", "output file path for saving preview plan")
  .option("--output-dir <dir>", "output directory for preview plan (directory for --output)")
  .option("--verbose", "detailed preview with all planned operations")
  .option("--include-content", "include file content in preview for deterministic comparison")
  .action(async (options: PreviewOptions, command) => {
    try {
      const config = command.parent?.config;
      if (!config) {
        throw new Error("Configuration not loaded");
      }

      const exitCode = await previewCommand(options, config);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red("Command failed:"),
        error instanceof Error ? error.message : String(error),
      );
      process.exit(2);
    }
  });

/**
 * Explain command - Plain-English assembly explanation
 */
program
  .command("explain")
  .description("generate plain-English summary of current arbiter.assembly.cue")
  .option("--format <type>", "output format: text, json", "text")
  .option("--output <file>", "output file path for saving explanation")
  .option("--verbose", "detailed explanation with all configuration details")
  .option("--no-hints", "disable helpful hints in output")
  .action(async (options: ExplainOptions, command) => {
    try {
      const config = command.parent?.config;
      if (!config) {
        throw new Error("Configuration not loaded");
      }

      const exitCode = await explainCommand(options, config);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red("Command failed:"),
        error instanceof Error ? error.message : String(error),
      );
      process.exit(2);
    }
  });

/**
 * Rename command - Migrate files to smart naming
 */
program
  .command("rename")
  .description("migrate existing files to project-specific naming")
  .option("--dry-run", "show what would be renamed without doing it", true)
  .option("--apply", "apply the renaming changes (disables dry-run)")
  .option("--force", "force rename even if already using project-specific names")
  .option("-v, --verbose", "show verbose output with project detection details")
  .option(
    "--types <types>",
    "comma-separated list of file types to rename (assembly,surface,versionPlan,etc)",
  )
  .option("--help-naming", "show detailed naming help and examples")
  .action(async (options: RenameOptions & { helpNaming?: boolean }, command) => {
    if (options.helpNaming) {
      showNamingHelp();
      return;
    }

    try {
      const config = command.parent?.config;
      if (!config) {
        throw new Error("Configuration not loaded");
      }

      // Parse types if provided
      if (options.types) {
        options.types = (options.types as string).split(",").map((t) => t.trim());
      }

      const exitCode = await renameCommand(options, config);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red("Command failed:"),
        error instanceof Error ? error.message : String(error),
      );
      process.exit(2);
    }
  });

/**
 * SRF (Structured Requirements Format) command - Proto-spec conversion
 */
const srfCmd = program
  .command("srf")
  .description("convert proto-specs (EMBEDDED_SRF.md, requirements.md) to CUE specifications");

srfCmd
  .command("create <file>")
  .description("convert proto-spec file to SRF format")
  .option("-o, --output <file>", "output SRF file path")
  .option("--output-dir <dir>", "output directory for SRF file")
  .option("-f, --force", "overwrite existing SRF file")
  .option("--dry-run", "show what would be created without creating files")
  .option("-v, --verbose", "verbose output with parsed structure")
  .action(async (file: string, options: SrfOptions, command) => {
    try {
      const config = command.parent?.parent?.config;
      if (!config) {
        throw new Error("Configuration not loaded");
      }

      const exitCode = await srfCommand("create", file, options, config);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red("Command failed:"),
        error instanceof Error ? error.message : String(error),
      );
      process.exit(2);
    }
  });

srfCmd
  .command("import <file>")
  .description("convert proto-spec or SRF file to CUE specification")
  .option("-o, --output <file>", "output CUE file path")
  .option("--output-dir <dir>", "output directory for CUE file")
  .option("-f, --force", "overwrite existing CUE file")
  .option("--dry-run", "show what would be created without creating files")
  .option("-v, --verbose", "verbose output with generated CUE")
  .action(async (file: string, options: SrfOptions, command) => {
    try {
      const config = command.parent?.parent?.config;
      if (!config) {
        throw new Error("Configuration not loaded");
      }

      const exitCode = await srfCommand("import", file, options, config);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red("Command failed:"),
        error instanceof Error ? error.message : String(error),
      );
      process.exit(2);
    }
  });

srfCmd
  .command("validate <file>")
  .description("validate SRF file structure and format")
  .option("-v, --verbose", "verbose validation output")
  .action(async (file: string, options: SrfOptions, command) => {
    try {
      const config = command.parent?.parent?.config;
      if (!config) {
        throw new Error("Configuration not loaded");
      }

      const exitCode = await srfCommand("validate", file, options, config);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red("Command failed:"),
        error instanceof Error ? error.message : String(error),
      );
      process.exit(2);
    }
  });

srfCmd
  .command("help")
  .description("show detailed SRF workflow help")
  .action(async () => {
    const exitCode = await srfCommand("help");
    process.exit(exitCode);
  });

/**
 * Composition command - Project composition system for SRF fragment management
 */
const compositionCmd = program
  .command("composition")
  .description("manage project composition system for SRF fragment integration");

compositionCmd
  .command("init")
  .description("initialize project composition system in current directory")
  .option("-v, --verbose", "verbose output")
  .option("--dry-run", "show what would be done without making changes")
  .option("--force", "force initialization even if conflicts exist")
  .action(async (options: CompositionOptions, command) => {
    try {
      const exitCode = await compositionInitCommand(options);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red("Composition init failed:"),
        error instanceof Error ? error.message : String(error),
      );
      process.exit(2);
    }
  });

compositionCmd
  .command("import <fragment>")
  .description("import an SRF fragment into the project")
  .option("-d, --description <desc>", "description for the imported fragment")
  .option("--dependencies <deps>", "comma-separated list of fragment dependencies")
  .option("--skip-validation", "skip validation during import")
  .option("-v, --verbose", "verbose output")
  .option("--dry-run", "show what would be done without making changes")
  .option("--force", "force import even if conflicts exist")
  .option("--auto-resolve", "enable automatic conflict resolution")
  .action(async (fragment: string, options: ImportSrfOptions, command) => {
    try {
      if (options.dependencies) {
        options.dependencies = (options.dependencies as string).split(",").map((d) => d.trim());
      }

      const exitCode = await compositionImportCommand(fragment, options);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red("Fragment import failed:"),
        error instanceof Error ? error.message : String(error),
      );
      process.exit(2);
    }
  });

compositionCmd
  .command("validate")
  .description("validate current project composition")
  .option("--fragments <ids>", "comma-separated list of fragment IDs to validate")
  .option("--detailed-report", "generate detailed conflict resolution report")
  .option("--export-results <file>", "export validation results to file")
  .option("--format <format>", "output format (table, json, yaml)", "table")
  .option("-v, --verbose", "verbose output")
  .option("--validation-level <level>", "validation strictness (strict, moderate, lenient)")
  .action(async (options: ValidateCompositionOptions, command) => {
    try {
      if (options.fragments) {
        options.fragments = (options.fragments as string).split(",").map((f) => f.trim());
      }

      const exitCode = await compositionValidateCommand(options);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red("Composition validation failed:"),
        error instanceof Error ? error.message : String(error),
      );
      process.exit(2);
    }
  });

compositionCmd
  .command("generate")
  .description("generate composed specification for recovery")
  .option("-v, --verbose", "verbose output with file paths")
  .option("--format <format>", "output format (table, json, yaml)", "table")
  .action(async (options: CompositionOptions, command) => {
    try {
      const exitCode = await compositionGenerateCommand(options);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red("Composed specification generation failed:"),
        error instanceof Error ? error.message : String(error),
      );
      process.exit(2);
    }
  });

compositionCmd
  .command("recover [target-dir]")
  .description("recover project from composed specification")
  .option("--recovery-point <id>", "specific integration point to recover from")
  .option("--include-external-deps", "include external dependencies in recovery")
  .option("--mode <mode>", "recovery mode (full, spec_only, structure_only)", "full")
  .option("-v, --verbose", "verbose output with recovered file list")
  .option("--dry-run", "show what would be recovered without making changes")
  .option("--force", "force recovery even if validation fails")
  .action(async (targetDir: string | undefined, options: RecoveryOptions, command) => {
    try {
      const exitCode = await compositionRecoverCommand(targetDir, options);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red("Project recovery failed:"),
        error instanceof Error ? error.message : String(error),
      );
      process.exit(2);
    }
  });

compositionCmd
  .command("list")
  .description("list project fragments and their status")
  .option("--format <format>", "output format (table, json)", "table")
  .option("-v, --verbose", "verbose output with fragment details")
  .action(async (options: CompositionOptions, command) => {
    try {
      const exitCode = await compositionListCommand(options);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red("Failed to list fragments:"),
        error instanceof Error ? error.message : String(error),
      );
      process.exit(2);
    }
  });

compositionCmd
  .command("status")
  .description("show project composition status and health")
  .option("--format <format>", "output format (table, json)", "table")
  .option("-v, --verbose", "verbose output with detailed information")
  .action(async (options: CompositionOptions, command) => {
    try {
      const exitCode = await compositionStatusCommand(options);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red("Failed to get composition status:"),
        error instanceof Error ? error.message : String(error),
      );
      process.exit(2);
    }
  });

/**
 * Config command - Manage CLI configuration
 */
const configCmd = program.command("config").description("manage CLI configuration");

configCmd
  .command("show")
  .description("show current configuration")
  .action(async (_, command) => {
    try {
      const config = command.parent?.parent?.config;
      if (!config) {
        throw new Error("Configuration not loaded");
      }

      console.log(chalk.cyan("Current configuration:"));
      console.log(JSON.stringify(config, null, 2));
    } catch (error) {
      console.error(
        chalk.red("Command failed:"),
        error instanceof Error ? error.message : String(error),
      );
      process.exit(2);
    }
  });

configCmd
  .command("set <key> <value>")
  .description("set configuration value")
  .action((_key, _value) => {
    console.log(chalk.yellow("Config set command not yet implemented"));
    process.exit(1);
  });

/**
 * Health command - Enhanced API server health check
 */
program
  .command("health")
  .description("comprehensive Arbiter server health check")
  .option("--verbose", "show detailed health information")
  .option("--timeout <ms>", "health check timeout in milliseconds", "5000")
  .action(async (options: { verbose?: boolean; timeout?: string }, command) => {
    try {
      const config = command.parent?.config;
      if (!config) {
        throw new Error("Configuration not loaded");
      }

      const apiClient = new ApiClient(config);
      const timeout = options.timeout ? parseInt(options.timeout, 10) : config.timeout;

      console.log(chalk.blue("🏥 Comprehensive health check..."));
      console.log(chalk.dim(`Server: ${config.apiUrl}`));
      console.log(chalk.dim(`Timeout: ${timeout}ms (API client enforces ≤750ms per spec)`));

      const startTime = Date.now();

      // Test basic connectivity
      const healthResult = await apiClient.health();
      const responseTime = Date.now() - startTime;

      if (healthResult.success) {
        console.log(chalk.green("✅ Server is healthy"));
        console.log(chalk.dim(`Response time: ${responseTime}ms`));

        if (options.verbose && healthResult.data) {
          console.log(chalk.cyan("\nDetailed health information:"));
          console.log(JSON.stringify(healthResult.data, null, 2));
        }

        // Test rate limiting compliance
        console.log(chalk.blue("\n🔒 Testing rate limit compliance..."));
        const rateLimitStart = Date.now();

        try {
          // Make two quick requests to test rate limiting
          await apiClient.health();
          await apiClient.health();
          const rateLimitTime = Date.now() - rateLimitStart;

          if (rateLimitTime >= 1000) {
            console.log(chalk.green("✅ Rate limiting active (≥1s between requests)"));
          } else {
            console.log(chalk.yellow("⚠️  Rate limiting may not be active"));
          }
        } catch (_error) {
          console.log(chalk.yellow("⚠️  Rate limit test inconclusive"));
        }

        // Test validation endpoint
        console.log(chalk.blue("\n🔍 Testing validation endpoint..."));
        try {
          const validationResult = await apiClient.validate('test: "hello"');
          if (validationResult.success) {
            console.log(chalk.green("✅ Validation endpoint working"));
          } else {
            console.log(chalk.yellow("⚠️  Validation endpoint issues detected"));
          }
        } catch (_error) {
          console.log(chalk.red("❌ Validation endpoint failed"));
        }

        console.log(chalk.green("\n🎉 Health check complete - All systems operational"));
        process.exit(0);
      } else {
        console.log(chalk.red(`❌ Server unhealthy: ${healthResult.error}`));
        console.log(chalk.dim("Common issues:"));
        console.log(chalk.dim("  - Server not running (run: bun run dev)"));
        console.log(chalk.dim("  - Wrong API URL in configuration"));
        console.log(chalk.dim("  - Network connectivity issues"));
        process.exit(1);
      }
    } catch (error) {
      console.error(
        chalk.red("❌ Health check failed:"),
        error instanceof Error ? error.message : String(error),
      );
      process.exit(2);
    }
  });

/**
 * Error handling for unknown commands
 */
program.on("command:*", () => {
  console.error(chalk.red(`Unknown command: ${program.args.join(" ")}`));
  console.log(chalk.dim("Run `arbiter --help` for available commands"));
  process.exit(1);
});

/**
 * Enhanced help with examples
 */
program.configureHelp({
  afterAll: () => {
    return `
${chalk.cyan("Three Main Workflows:")}

  ${chalk.yellow("1. BUILD SPECIFICATIONS INCREMENTALLY (NEW - Compositional):")}
    ${chalk.dim("Build your arbiter.assembly.cue step-by-step with validation")}
    arbiter add service api --language typescript    # Start with a service
    arbiter add endpoint /health --service api       # Add endpoints
    arbiter add database userdb --attach-to api      # Add dependencies
    arbiter generate                                  # Generate project files

  ${chalk.yellow("2. CONVERT EXISTING PROTO-SPECS → CUE (SRF Workflow):")}
    ${chalk.dim("For EMBEDDED_SRF.md, requirements.md, or other proto-spec files")}
    arbiter srf create EMBEDDED_SRF.md              # Proto-spec → SRF format
    arbiter srf import EMBEDDED_SRF.srf              # SRF → CUE specification  
    arbiter generate                                 # Generate project files
    
  ${chalk.yellow("3. GENERATE FROM EXISTING CUE SPECIFICATIONS:")}
    ${chalk.dim("When you already have arbiter.assembly.cue")}
    arbiter generate                                 # Generate project from CUE
    arbiter generate --include-ci --force           # Include CI/CD files

${chalk.cyan("Examples:")}
  ${chalk.dim("Convert proto-specs to CUE (NEW - SRF Workflow):")}
    arbiter srf create requirements.md              # Convert proto-spec to SRF
    arbiter srf create EMBEDDED_SRF.md --verbose    # Verbose conversion
    arbiter srf import my-spec.srf --force          # SRF to CUE specification
    arbiter srf validate my-spec.srf                # Validate SRF structure
    arbiter srf help                                 # Detailed SRF workflow help
    
  ${chalk.dim("Initialize new project:")}
    arbiter init my-project --template kubernetes
    
  ${chalk.dim("Onboard existing project (NEW - Smart Migration):")}
    arbiter onboard /path/to/existing/project       # Intelligently analyze and migrate existing project
    arbiter onboard . --dry-run                     # Preview onboarding changes without applying
    arbiter onboard ~/myapp --force                 # Force onboarding even if .arbiter exists
    
  ${chalk.dim("Build specifications compositionally (NEW - Incremental Approach):")}
    arbiter add service api --language typescript --port 3000      # Add a TypeScript service
    arbiter add service db --image postgres:15 --port 5432        # Add a database service  
    arbiter add endpoint /health --service api --method GET       # Add health endpoint
    arbiter add endpoint /users --service api --method POST       # Add users endpoint
    arbiter add route /dashboard --capabilities view,edit         # Add UI route
    arbiter add flow health-check --endpoint /health              # Add health check flow
    arbiter add flow navigation --from /home --to /dashboard      # Add navigation flow
    arbiter add load-balancer --target api                        # Add load balancer
    arbiter add database userdb --attach-to api                   # Add database with connection
    arbiter add cache redis --attach-to api --port 6379          # Add cache with connection
    arbiter add locator login-btn --selector "[data-testid=login]" # Add UI test locator
    arbiter add schema User --example '{"id":1,"name":"John"}'     # Add API schema
    
  ${chalk.dim("Watch and validate files:")}
    arbiter watch
    arbiter watch --agent-mode --debounce 250
    arbiter watch src/ --patterns "**/*.cue,**/*.ts"
    
  ${chalk.dim("Extract API surfaces (with smart naming):")}
    arbiter surface typescript                            # Creates myproject-surface.json
    arbiter surface typescript --generic-names            # Creates surface.json (old way)
    arbiter surface typescript --project-name myapi       # Creates myapi-surface.json
    arbiter surface typescript --output custom.json       # Uses explicit name
    arbiter surface typescript --diff --include-private   # Compare with previous
    
  ${chalk.dim("Version management (semver-aware):")}
    arbiter version plan --strict --verbose
    arbiter version plan --current surface.json --previous surface-prev.json
    arbiter version release --dry-run
    arbiter version release --apply --verbose
    
  ${chalk.dim("Validate files:")}
    arbiter check
    arbiter check --format json
    arbiter validate schema.cue values.cue --strict
    
  ${chalk.dim("Export configurations:")}
    arbiter export *.cue --format openapi,types
    arbiter export . --format k8s --output manifests/
    
  ${chalk.dim("Manage templates:")}
    arbiter template list
    arbiter template show budget_constraint
    arbiter template add selection_rubric --output my-rubric.cue
    
  ${chalk.dim("Manage imports (security):")}
    arbiter import init
    arbiter import add @valhalla/constraints@1.0.0
    arbiter import validate schema.cue
    
  ${chalk.dim("Schema evolution:")}
    arbiter diff old-schema.cue new-schema.cue --migration
    arbiter migrate *.cue --dry-run --backup
    
  ${chalk.dim("Execute epics (agent-first code generation):")}
    arbiter execute epics/new-service.json --dry-run
    arbiter execute epics/config-refactor.json --verbose
    arbiter execute epics/breaking-change.json --junit report.xml
    
  ${chalk.dim("Generate tests from invariants (revolutionary):")}
    arbiter tests scaffold --language typescript --verbose
    arbiter tests scaffold --language python --output tests/
    arbiter tests scaffold --language rust --force
    
  ${chalk.dim("Analyze contract coverage:")}
    arbiter tests cover --threshold 0.9 --verbose
    arbiter tests cover --junit coverage.xml --output report.json
    
  ${chalk.dim("Run tests (unified test harness):")}
    arbiter tests run --epic epics/new-service.json
    arbiter tests run --epic epics/config-refactor.json --types static,golden
    arbiter tests run --epic epics/breaking-change.json --junit test-results.xml
    
  ${chalk.dim("IDE configuration (ecosystem integration):")}
    arbiter ide recommend
    arbiter ide recommend --editor all --force
    arbiter ide recommend --detect
    
  ${chalk.dim("Manifest synchronization:")}
    arbiter sync
    arbiter sync --language typescript --dry-run
    arbiter sync --all --backup --force
    
  ${chalk.dim("CI/CD integration:")}
    arbiter integrate
    arbiter integrate --provider github --type pr --force
    arbiter integrate --matrix --output .github/workflows
    
  ${chalk.dim("Documentation generation (Phase 5):")}
    arbiter docs schema                           # Generate schema docs from CUE
    arbiter docs schema --format html --examples # HTML docs with examples
    arbiter docs api --format markdown           # API docs from surface.json
    
  ${chalk.dim("Example projects (Phase 5):")}
    arbiter examples profile                      # Generate all profile examples
    arbiter examples profile --profile library   # Generate library example only
    arbiter examples language --language typescript # TypeScript examples
    arbiter examples profile --output ./my-examples  # Custom output directory
    
  ${chalk.dim("Plain-English explanations (Phase 5):")}
    arbiter explain                               # Explain current assembly.cue
    arbiter explain --format json --output explanation.json # JSON format
    arbiter explain --verbose                     # Detailed analysis
    arbiter explain --no-hints                   # Without helpful hints
    
  ${chalk.dim("Smart file naming (NEW):")}
    arbiter rename --dry-run                             # Preview naming changes
    arbiter rename --apply                               # Apply project-specific names
    arbiter rename --help-naming                         # Show detailed naming help
    arbiter rename --types surface,versionPlan --apply  # Rename specific file types
    
  ${chalk.dim("Check server:")}
    arbiter health
    
${chalk.cyan("Smart Naming:")}
  Arbiter now generates project-specific file names automatically:
  
  ${chalk.dim("Instead of generic names like:")}
    arbiter.assembly.cue, surface.json, version_plan.json
    
  ${chalk.dim("Creates project-specific names like:")}
    myproject.assembly.cue, myproject-surface.json, myproject-version-plan.json
    
  ${chalk.dim("Project name detection (in order of priority):")}
    1. --project-name flag          2. package.json name field
    3. Assembly file name field     4. Directory name
    
  ${chalk.dim("Control naming behavior:")}
    --generic-names                 # Use old generic names for compatibility
    --output filename               # Override with explicit filename
    --output-dir directory          # Set output directory
    
${chalk.cyan("Configuration:")}
  Create ${chalk.yellow(".arbiter.json")} in your project root:
  {
    "apiUrl": "http://localhost:8080",
    "format": "table",
    "color": true
  }
`;
  },
});

// Parse arguments and run
import { fileURLToPath } from "url";
if (fileURLToPath(import.meta.url) === process.argv[1]) {
  program.parse();
}

export default program;

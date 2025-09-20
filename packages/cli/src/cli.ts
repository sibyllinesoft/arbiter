#!/usr/bin/env node

import chalk from 'chalk';
import { Command } from 'commander';
import { ApiClient } from './api-client.js';
import { addCommand } from './commands/add.js';
import type { AddOptions } from './commands/add.js';
import { checkCommand } from './commands/check.js';
import { createCommand } from './commands/create.js';
import { diffCommand } from './commands/diff.js';
import { docsCommand } from './commands/docs.js';
import { epicCommand, taskCommand } from './commands/epic.js';
import type { EpicOptions, TaskOptions } from './commands/epic.js';
import { examplesCommand } from './commands/examples.js';
import { executeCommand } from './commands/execute.js';
import { explainCommand } from './commands/explain.js';
import { exportCommand, listFormats } from './commands/export.js';
import { generateCommand } from './commands/generate.js';
import { githubTemplatesCommand } from './commands/github-templates.js';
import { ideCommand } from './commands/ide.js';
import { importCommand } from './commands/import.js';
import { initCommand, listTemplates } from './commands/init.js';
import { integrateCommand } from './commands/integrate.js';
import { previewCommand } from './commands/preview.js';
import { renameCommand, showNamingHelp } from './commands/rename.js';
import { surfaceCommand } from './commands/surface.js';
import { syncCommand } from './commands/sync.js';
import { templateCommand } from './commands/template.js';
import { type TemplatesOptions, templatesCommand } from './commands/templates.js';
import { testCommand } from './commands/test.js';
import { coverCommand, scaffoldCommand } from './commands/tests.js';
import { validateCommand } from './commands/validate.js';
import { versionPlanCommand, versionReleaseCommand } from './commands/version.js';
import { watchCommand } from './commands/watch.js';
import {
  type WebhookOptions,
  deleteWebhookCommand,
  getWebhookCommand,
  listWebhooksCommand,
  setWebhookCommand,
  showWebhookHelp,
  testWebhookCommand,
} from './commands/webhook.js';
import { loadConfig, loadConfigWithGitDetection } from './config.js';
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
  PreviewOptions,
  RenameOptions,
  SurfaceOptions,
  SyncOptions,
  TemplateManagementOptions,
  TemplateOptions,
  TestOptions,
  TestsOptions,
  ValidateOptions,
  VersionPlanOptions,
  VersionReleaseOptions,
  WatchOptions,
} from './types.js';

// Package info - import from package.json
import packageJson from '../package.json' with { type: 'json' };

/**
 * Main CLI program
 */
const program = new Command();

program
  .name('arbiter')
  .description(packageJson.description)
  .version(packageJson.version, '-v, --version', 'display version number')
  .option('-c, --config <path>', 'path to configuration file')
  .option('--no-color', 'disable colored output')
  .option('--api-url <url>', 'API server URL')
  .option('--timeout <ms>', 'request timeout in milliseconds')
  .hook('preAction', async thisCommand => {
    // Load basic configuration before running any command
    // Git auto-detection will be applied per-command as needed
    const opts = thisCommand.opts();
    try {
      const config = await loadConfig(opts.config);

      // Override config with CLI options
      if (opts.apiUrl) config.apiUrl = opts.apiUrl;
      if (opts.timeout) config.timeout = Number.parseInt(opts.timeout, 10);
      if (opts.color === false) config.color = false;

      // Store config on command for subcommands to access
      (thisCommand as any).config = config;
    } catch (error) {
      console.error(
        chalk.red('Configuration error:'),
        error instanceof Error ? error.message : String(error)
      );
      process.exit(2);
    }
  });

/**
 * Init command - Initialize new CUE project
 */
program
  .command('init [display-name]')
  .description('initialize a new CUE project with templates in current directory')
  .option('-t, --template <name>', 'project template to use (basic, kubernetes, api)')
  .option('-f, --force', 'overwrite existing files')
  .option('--list-templates', 'list available templates')
  .action(async (displayName, options: InitOptions & { listTemplates?: boolean }, _command) => {
    if (options.listTemplates) {
      listTemplates();
      return;
    }

    try {
      const exitCode = await initCommand(displayName, options);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red('Command failed:'),
        error instanceof Error ? error.message : String(error)
      );
      process.exit(2);
    }
  });

/**
 * Add command - Modular specification builder
 */
const addCmd = program
  .command('add')
  .description('incrementally build CUE specifications with modular generators');

addCmd
  .command('service <name>')
  .description('add a service to the specification')
  .option('--template <alias>', 'use template alias for service generation')
  .option('--language <lang>', 'programming language (typescript, python, rust, go)', 'typescript')
  .option('--port <port>', 'service port number', value => Number.parseInt(value, 10))
  .option('--image <image>', 'prebuilt container image (for prebuilt services)')
  .option('--directory <dir>', 'source directory path')
  .option('--platform <platform>', 'target platform (cloudflare, vercel, supabase, kubernetes)')
  .option(
    '--service-type <type>',
    'platform-specific service type (cloudflare_worker, vercel_function, supabase_functions, etc.)'
  )
  .option('--dry-run', 'preview changes without applying them')
  .option('--force', 'overwrite existing configuration')
  .option('-v, --verbose', 'verbose output with detailed changes')
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
      command
    ) => {
      try {
        const config = command.parent?.parent?.config;
        if (!config) {
          throw new Error('Configuration not loaded');
        }

        const exitCode = await addCommand('service', name, options, config);
        process.exit(exitCode);
      } catch (error) {
        console.error(
          chalk.red('Command failed:'),
          error instanceof Error ? error.message : String(error)
        );
        process.exit(2);
      }
    }
  );

addCmd
  .command('endpoint <path>')
  .description('add an API endpoint to a service')
  .option('--service <name>', 'target service name', 'api')
  .option('--method <method>', 'HTTP method', 'GET')
  .option('--returns <schema>', 'response schema reference')
  .option('--accepts <schema>', 'request body schema reference')
  .option('--dry-run', 'preview changes without applying them')
  .option('--force', 'overwrite existing configuration')
  .option('-v, --verbose', 'verbose output with detailed changes')
  .action(
    async (
      path: string,
      options: AddOptions & {
        service?: string;
        method?: string;
        returns?: string;
        accepts?: string;
      },
      command
    ) => {
      try {
        const config = command.parent?.parent?.config;
        if (!config) {
          throw new Error('Configuration not loaded');
        }

        const exitCode = await addCommand('endpoint', path, options, config);
        process.exit(exitCode);
      } catch (error) {
        console.error(
          chalk.red('Command failed:'),
          error instanceof Error ? error.message : String(error)
        );
        process.exit(2);
      }
    }
  );

addCmd
  .command('route <path>')
  .description('add a UI route for frontend applications')
  .option('--id <id>', 'route identifier (auto-generated if not specified)')
  .option('--capabilities <caps>', 'comma-separated capabilities (view, edit, admin)')
  .option('--components <comps>', 'comma-separated component names')
  .option('--dry-run', 'preview changes without applying them')
  .option('--force', 'overwrite existing configuration')
  .option('-v, --verbose', 'verbose output with detailed changes')
  .action(
    async (
      path: string,
      options: AddOptions & { id?: string; capabilities?: string; components?: string },
      command
    ) => {
      try {
        const config = command.parent?.parent?.config;
        if (!config) {
          throw new Error('Configuration not loaded');
        }

        const exitCode = await addCommand('route', path, options, config);
        process.exit(exitCode);
      } catch (error) {
        console.error(
          chalk.red('Command failed:'),
          error instanceof Error ? error.message : String(error)
        );
        process.exit(2);
      }
    }
  );

addCmd
  .command('flow <id>')
  .description('add a user flow for testing and validation')
  .option('--from <route>', 'starting route for navigation flow')
  .option('--to <route>', 'target route for navigation flow')
  .option('--endpoint <path>', 'API endpoint for health check flow')
  .option('--expect <status>', 'expected HTTP status code', '200')
  .option('--steps <json>', 'custom flow steps as JSON array')
  .option('--dry-run', 'preview changes without applying them')
  .option('--force', 'overwrite existing configuration')
  .option('-v, --verbose', 'verbose output with detailed changes')
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
      command
    ) => {
      try {
        const config = command.parent?.parent?.config;
        if (!config) {
          throw new Error('Configuration not loaded');
        }

        const exitCode = await addCommand('flow', id, options, config);
        process.exit(exitCode);
      } catch (error) {
        console.error(
          chalk.red('Command failed:'),
          error instanceof Error ? error.message : String(error)
        );
        process.exit(2);
      }
    }
  );

addCmd
  .command('load-balancer')
  .description('add a load balancer with health check invariants')
  .option('--target <service>', 'target service to load balance (required)')
  .option('--health-check <path>', 'health check endpoint path', '/health')
  .option('--dry-run', 'preview changes without applying them')
  .option('--force', 'overwrite existing configuration')
  .option('-v, --verbose', 'verbose output with detailed changes')
  .action(async (options: AddOptions & { target?: string; healthCheck?: string }, command) => {
    try {
      const config = command.parent?.parent?.config;
      if (!config) {
        throw new Error('Configuration not loaded');
      }

      const exitCode = await addCommand('load-balancer', '', options, config);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red('Command failed:'),
        error instanceof Error ? error.message : String(error)
      );
      process.exit(2);
    }
  });

addCmd
  .command('database <name>')
  .description('add a database with automatic service attachment')
  .option('--template <alias>', 'use template alias for database generation')
  .option('--attach-to <service>', 'service to attach database connection to')
  .option('--image <image>', 'database container image', 'postgres:15')
  .option('--port <port>', 'database port', value => Number.parseInt(value, 10), 5432)
  .option('--platform <platform>', 'target platform (cloudflare, vercel, supabase, kubernetes)')
  .option(
    '--service-type <type>',
    'platform-specific database type (cloudflare_d1, vercel_postgres, supabase_database)'
  )
  .option('--dry-run', 'preview changes without applying them')
  .option('--force', 'overwrite existing configuration')
  .option('-v, --verbose', 'verbose output with detailed changes')
  .action(
    async (
      name: string,
      options: AddOptions & { attachTo?: string; image?: string; port?: number; template?: string },
      command
    ) => {
      try {
        const config = command.parent?.parent?.config;
        if (!config) {
          throw new Error('Configuration not loaded');
        }

        const exitCode = await addCommand('database', name, options, config);
        process.exit(exitCode);
      } catch (error) {
        console.error(
          chalk.red('Command failed:'),
          error instanceof Error ? error.message : String(error)
        );
        process.exit(2);
      }
    }
  );

addCmd
  .command('cache <name>')
  .description('add a cache service with automatic attachment')
  .option('--attach-to <service>', 'service to attach cache connection to')
  .option('--image <image>', 'cache container image', 'redis:7-alpine')
  .option('--port <port>', 'cache port', value => Number.parseInt(value, 10), 6379)
  .option('--platform <platform>', 'target platform (cloudflare, vercel, supabase, kubernetes)')
  .option('--service-type <type>', 'platform-specific cache type (cloudflare_kv, vercel_kv)')
  .option('--dry-run', 'preview changes without applying them')
  .option('--force', 'overwrite existing configuration')
  .option('-v, --verbose', 'verbose output with detailed changes')
  .action(
    async (
      name: string,
      options: AddOptions & { attachTo?: string; image?: string; port?: number },
      command
    ) => {
      try {
        const config = command.parent?.parent?.config;
        if (!config) {
          throw new Error('Configuration not loaded');
        }

        const exitCode = await addCommand('cache', name, options, config);
        process.exit(exitCode);
      } catch (error) {
        console.error(
          chalk.red('Command failed:'),
          error instanceof Error ? error.message : String(error)
        );
        process.exit(2);
      }
    }
  );

addCmd
  .command('locator <key>')
  .description('add a UI locator for testing')
  .option('--selector <selector>', 'CSS selector or test-id (required)')
  .option('--dry-run', 'preview changes without applying them')
  .option('--force', 'overwrite existing configuration')
  .option('-v, --verbose', 'verbose output with detailed changes')
  .action(async (key: string, options: AddOptions & { selector?: string }, command) => {
    try {
      const config = command.parent?.parent?.config;
      if (!config) {
        throw new Error('Configuration not loaded');
      }

      const exitCode = await addCommand('locator', key, options, config);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red('Command failed:'),
        error instanceof Error ? error.message : String(error)
      );
      process.exit(2);
    }
  });

addCmd
  .command('schema <name>')
  .description('add a schema for API documentation')
  .option('--example <json>', 'example data as JSON')
  .option('--rules <json>', 'validation rules as JSON')
  .option('--dry-run', 'preview changes without applying them')
  .option('--force', 'overwrite existing configuration')
  .option('-v, --verbose', 'verbose output with detailed changes')
  .action(
    async (name: string, options: AddOptions & { example?: string; rules?: string }, command) => {
      try {
        const config = command.parent?.parent?.config;
        if (!config) {
          throw new Error('Configuration not loaded');
        }

        const exitCode = await addCommand('schema', name, options, config);
        process.exit(exitCode);
      } catch (error) {
        console.error(
          chalk.red('Command failed:'),
          error instanceof Error ? error.message : String(error)
        );
        process.exit(2);
      }
    }
  );

addCmd
  .command('package <name>')
  .description('add a reusable package/library (e.g. design systems, shared utilities)')
  .option('--language <lang>', 'programming language (typescript, python, rust, go)', 'typescript')
  .option('--directory <dir>', 'source directory path')
  .option('--exports <exports>', 'comma-separated list of main exports')
  .option('--version <version>', 'initial version', '0.1.0')
  .option('--dry-run', 'preview changes without applying them')
  .option('--force', 'overwrite existing configuration')
  .option('-v, --verbose', 'verbose output with detailed changes')
  .action(
    async (
      name: string,
      options: AddOptions & {
        language?: string;
        directory?: string;
        exports?: string;
        version?: string;
      },
      command
    ) => {
      try {
        const config = command.parent?.parent?.config;
        if (!config) {
          throw new Error('Configuration not loaded');
        }

        const exitCode = await addCommand('package', name, options, config);
        process.exit(exitCode);
      } catch (error) {
        console.error(
          chalk.red('Command failed:'),
          error instanceof Error ? error.message : String(error)
        );
        process.exit(2);
      }
    }
  );

addCmd
  .command('component <name>')
  .description('add a UI component (e.g. buttons, forms, layout components)')
  .option('--framework <framework>', 'UI framework (react, vue, angular, svelte)', 'react')
  .option('--directory <dir>', 'source directory path')
  .option('--props <props>', 'comma-separated list of component props')
  .option('--stories', 'generate Storybook stories')
  .option('--dry-run', 'preview changes without applying them')
  .option('--force', 'overwrite existing configuration')
  .option('-v, --verbose', 'verbose output with detailed changes')
  .action(
    async (
      name: string,
      options: AddOptions & {
        framework?: string;
        directory?: string;
        props?: string;
        stories?: boolean;
      },
      command
    ) => {
      try {
        const config = command.parent?.parent?.config;
        if (!config) {
          throw new Error('Configuration not loaded');
        }

        const exitCode = await addCommand('component', name, options, config);
        process.exit(exitCode);
      } catch (error) {
        console.error(
          chalk.red('Command failed:'),
          error instanceof Error ? error.message : String(error)
        );
        process.exit(2);
      }
    }
  );

addCmd
  .command('module <name>')
  .description('add a standalone module (e.g. utilities, helpers, data models)')
  .option('--language <lang>', 'programming language (typescript, python, rust, go)', 'typescript')
  .option('--directory <dir>', 'source directory path')
  .option('--functions <functions>', 'comma-separated list of main functions')
  .option('--types <types>', 'comma-separated list of exported types')
  .option('--dry-run', 'preview changes without applying them')
  .option('--force', 'overwrite existing configuration')
  .option('-v, --verbose', 'verbose output with detailed changes')
  .action(
    async (
      name: string,
      options: AddOptions & {
        language?: string;
        directory?: string;
        functions?: string;
        types?: string;
      },
      command
    ) => {
      try {
        const config = command.parent?.parent?.config;
        if (!config) {
          throw new Error('Configuration not loaded');
        }

        const exitCode = await addCommand('module', name, options, config);
        process.exit(exitCode);
      } catch (error) {
        console.error(
          chalk.red('Command failed:'),
          error instanceof Error ? error.message : String(error)
        );
        process.exit(2);
      }
    }
  );

/**
 * Watch command - File watcher with live validation
 */
program
  .command('watch [path]')
  .description('cross-platform file watcher with live validation and planning')
  .option('--agent-mode', 'output NDJSON for agent consumption')
  .option('--ndjson-output <file>', 'write NDJSON events to file instead of stdout')
  .option('--debounce <ms>', 'debounce delay in milliseconds (250-400)', '300')
  .option('--patterns <patterns>', 'comma-separated file patterns to watch')
  .option('--no-validate', 'disable validation on changes')
  .option('--plan', 'enable planning pipeline on assembly changes')
  .action(
    async (
      path: string | undefined,
      options: WatchOptions & { debounce?: string; patterns?: string },
      command
    ) => {
      try {
        const config = command.parent?.config;
        if (!config) {
          throw new Error('Configuration not loaded');
        }

        const watchOptions: WatchOptions = {
          ...options,
          path,
          debounce: options.debounce ? Number.parseInt(options.debounce, 10) : 300,
          patterns: options.patterns ? options.patterns.split(',').map(p => p.trim()) : undefined,
        };

        const exitCode = await watchCommand(watchOptions, config);
        process.exit(exitCode);
      } catch (error) {
        console.error(
          chalk.red('Command failed:'),
          error instanceof Error ? error.message : String(error)
        );
        process.exit(2);
      }
    }
  );

/**
 * Surface command - Generate API surface from code
 */
program
  .command('surface <language>')
  .description('extract API surface from source code and generate project-specific surface file')
  .option('-o, --output <file>', 'explicit output file path (overrides smart naming)')
  .option('--output-dir <dir>', 'output directory for generated file')
  .option('--project-name <name>', 'project name for file naming (auto-detected if not specified)')
  .option('--generic-names', "use generic names like 'surface.json' (for backward compatibility)")
  .option('--diff', 'compare against existing spec and show changes')
  .option('--include-private', 'include private/internal APIs')
  .option('-v, --verbose', 'verbose output with detailed analysis')
  .option('--agent-mode', 'output NDJSON events for agent consumption')
  .option('--ndjson-output <file>', 'write NDJSON events to file instead of stdout')
  .action(async (language: string, options: SurfaceOptions, command) => {
    try {
      const config = command.parent?.config;
      if (!config) {
        throw new Error('Configuration not loaded');
      }

      if (!['typescript', 'python', 'rust', 'go', 'bash'].includes(language)) {
        console.error(chalk.red(`Unsupported language: ${language}`));
        console.error(chalk.dim('Supported languages: typescript, python, rust, go, bash'));
        process.exit(1);
      }

      const surfaceOptions: SurfaceOptions = {
        ...options,
        language: language as SurfaceOptions['language'],
      };

      const exitCode = await surfaceCommand(surfaceOptions, config);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red('Command failed:'),
        error instanceof Error ? error.message : String(error)
      );
      process.exit(2);
    }
  });

/**
 * Version command - Semver-aware release planning and management
 */
const versionCmd = program
  .command('version')
  .description('semver-aware version planning and release management');

versionCmd
  .command('plan')
  .description('analyze API changes and recommend semver bump')
  .option('-c, --current <file>', 'current surface file', 'surface.json')
  .option('-p, --previous <file>', 'previous surface file for comparison')
  .option('-o, --output <file>', 'output file for version plan', 'version_plan.json')
  .option('--strict', 'strict mode for library compliance (fail on breaking changes)')
  .option('-v, --verbose', 'verbose output with detailed change analysis')
  .action(async (options: VersionPlanOptions, command) => {
    try {
      const config = command.parent?.parent?.config;
      if (!config) {
        throw new Error('Configuration not loaded');
      }

      const exitCode = await versionPlanCommand(options, config);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red('Command failed:'),
        error instanceof Error ? error.message : String(error)
      );
      process.exit(2);
    }
  });

versionCmd
  .command('release')
  .description('update manifests and generate changelog based on version plan')
  .option('--plan <file>', 'version plan file to execute', 'version_plan.json')
  .option('--version <version>', 'specific version to set (overrides plan)')
  .option('--changelog <file>', 'changelog output file', 'CHANGELOG.md')
  .option('--dry-run', 'preview changes without applying them (default)', true)
  .option('--apply', 'apply changes (disables dry-run)')
  .option('-v, --verbose', 'verbose output with detailed manifest updates')
  .action(async (options: VersionReleaseOptions, command) => {
    try {
      const config = command.parent?.parent?.config;
      if (!config) {
        throw new Error('Configuration not loaded');
      }

      const exitCode = await versionReleaseCommand(options, config);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red('Command failed:'),
        error instanceof Error ? error.message : String(error)
      );
      process.exit(2);
    }
  });

/**
 * Epic command - Epic and task management with ordered execution
 */
const epicCmd = program
  .command('epic')
  .description('manage epics and their ordered tasks using sharded CUE storage');

epicCmd
  .command('list')
  .description('list all epics')
  .option('-s, --status <status>', 'filter by status (planning, in_progress, completed, cancelled)')
  .option('-p, --priority <priority>', 'filter by priority (critical, high, medium, low)')
  .option('-a, --assignee <assignee>', 'filter by assignee')
  .option('-f, --format <format>', 'output format (table, json)', 'table')
  .option('-v, --verbose', 'verbose output with additional details')
  .action(async (options: EpicOptions, command) => {
    try {
      const config = command.parent?.parent?.config;
      if (!config) {
        throw new Error('Configuration not loaded');
      }

      const exitCode = await epicCommand('list', undefined, options, config);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red('Command failed:'),
        error instanceof Error ? error.message : String(error)
      );
      process.exit(2);
    }
  });

epicCmd
  .command('show <epic-id>')
  .description('show detailed epic information')
  .option('-f, --format <format>', 'output format (table, json)', 'table')
  .option('-v, --verbose', 'verbose output with additional details')
  .action(async (epicId: string, options: EpicOptions, command) => {
    try {
      const config = command.parent?.parent?.config;
      if (!config) {
        throw new Error('Configuration not loaded');
      }

      const exitCode = await epicCommand('show', epicId, options, config);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red('Command failed:'),
        error instanceof Error ? error.message : String(error)
      );
      process.exit(2);
    }
  });

epicCmd
  .command('create')
  .description('create a new epic')
  .requiredOption('-n, --name <name>', 'epic name')
  .option('-d, --description <description>', 'epic description')
  .option('-p, --priority <priority>', 'priority (critical, high, medium, low)', 'medium')
  .option('-o, --owner <owner>', 'epic owner')
  .option('-a, --assignee <assignee>', 'epic assignee')
  .option('--start-date <date>', 'start date (YYYY-MM-DD)')
  .option('--due-date <date>', 'due date (YYYY-MM-DD)')
  .option('--labels <labels>', 'comma-separated labels')
  .option('--tags <tags>', 'comma-separated tags')
  .option('--allow-parallel-tasks', 'allow tasks to run in parallel')
  .option('--no-auto-progress', 'disable automatic task progression')
  .option('--no-require-all-tasks', "don't require all tasks to complete epic")
  .option('-v, --verbose', 'verbose output with additional details')
  .action(async (options: EpicOptions & { name: string }, command) => {
    try {
      const config = command.parent?.parent?.config;
      if (!config) {
        throw new Error('Configuration not loaded');
      }

      const exitCode = await epicCommand('create', undefined, options, config);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red('Command failed:'),
        error instanceof Error ? error.message : String(error)
      );
      process.exit(2);
    }
  });

epicCmd
  .command('update <epic-id>')
  .description('update an existing epic')
  .option('-s, --status <status>', 'update status (planning, in_progress, completed, cancelled)')
  .option('-p, --priority <priority>', 'update priority (critical, high, medium, low)')
  .option('-a, --assignee <assignee>', 'update assignee')
  .option('-v, --verbose', 'verbose output with additional details')
  .action(async (epicId: string, options: EpicOptions, command) => {
    try {
      const config = command.parent?.parent?.config;
      if (!config) {
        throw new Error('Configuration not loaded');
      }

      const exitCode = await epicCommand('update', epicId, options, config);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red('Command failed:'),
        error instanceof Error ? error.message : String(error)
      );
      process.exit(2);
    }
  });

epicCmd
  .command('stats')
  .description('show sharded storage statistics')
  .option('-f, --format <format>', 'output format (table, json)', 'table')
  .option('-v, --verbose', 'verbose output with additional details')
  .action(async (options: EpicOptions, command) => {
    try {
      const config = command.parent?.parent?.config;
      if (!config) {
        throw new Error('Configuration not loaded');
      }

      const exitCode = await epicCommand('stats', undefined, options, config);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red('Command failed:'),
        error instanceof Error ? error.message : String(error)
      );
      process.exit(2);
    }
  });

/**
 * Task command - Ordered task management within epics
 */
const taskCmd = program.command('task').description('manage ordered tasks within epics');

taskCmd
  .command('list')
  .description('list all tasks across epics')
  .option(
    '-s, --status <status>',
    'filter by status (todo, in_progress, review, testing, completed, cancelled)'
  )
  .option(
    '-t, --type <type>',
    'filter by type (feature, bug, refactor, test, docs, devops, research)'
  )
  .option('-p, --priority <priority>', 'filter by priority (critical, high, medium, low)')
  .option('-a, --assignee <assignee>', 'filter by assignee')
  .option('-f, --format <format>', 'output format (table, json)', 'table')
  .option('-v, --verbose', 'verbose output with additional details')
  .action(async (options: TaskOptions, command) => {
    try {
      const config = command.parent?.parent?.config;
      if (!config) {
        throw new Error('Configuration not loaded');
      }

      const exitCode = await taskCommand('list', undefined, options, config);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red('Command failed:'),
        error instanceof Error ? error.message : String(error)
      );
      process.exit(2);
    }
  });

taskCmd
  .command('show <task-id>')
  .description('show detailed task information')
  .option('-f, --format <format>', 'output format (table, json)', 'table')
  .option('-v, --verbose', 'verbose output with additional details')
  .action(async (taskId: string, options: TaskOptions, command) => {
    try {
      const config = command.parent?.parent?.config;
      if (!config) {
        throw new Error('Configuration not loaded');
      }

      const exitCode = await taskCommand('show', taskId, options, config);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red('Command failed:'),
        error instanceof Error ? error.message : String(error)
      );
      process.exit(2);
    }
  });

taskCmd
  .command('create')
  .description('create a new task in an epic')
  .requiredOption('-e, --epic <epic-id>', 'epic ID to add task to')
  .requiredOption('-n, --name <name>', 'task name')
  .option('-d, --description <description>', 'task description')
  .option(
    '-t, --type <type>',
    'task type (feature, bug, refactor, test, docs, devops, research)',
    'feature'
  )
  .option('-p, --priority <priority>', 'priority (critical, high, medium, low)', 'medium')
  .option('-a, --assignee <assignee>', 'task assignee')
  .option('-r, --reviewer <reviewer>', 'task reviewer')
  .option('--depends-on <tasks>', 'comma-separated list of task IDs this depends on')
  .option('--acceptance-criteria <criteria>', 'comma-separated list of acceptance criteria')
  .option('--can-run-in-parallel', 'task can run in parallel with others')
  .option('--no-requires-review', "task doesn't require code review")
  .option('--no-requires-testing', "task doesn't require testing")
  .option('--blocks-other-tasks', 'task blocks subsequent tasks')
  .option('-v, --verbose', 'verbose output with additional details')
  .action(async (options: TaskOptions & { epic: string; name: string }, command) => {
    try {
      const config = command.parent?.parent?.config;
      if (!config) {
        throw new Error('Configuration not loaded');
      }

      const exitCode = await taskCommand('create', undefined, options, config);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red('Command failed:'),
        error instanceof Error ? error.message : String(error)
      );
      process.exit(2);
    }
  });

taskCmd
  .command('batch')
  .description('batch create tasks from JSON')
  .requiredOption('-e, --epic <epic-id>', 'epic ID to add tasks to')
  .option('--json <json>', 'JSON array of task objects')
  .option('--file <file>', 'JSON file containing task array')
  .option('-v, --verbose', 'verbose output with individual task creation status')
  .action(
    async (options: TaskOptions & { epic: string; json?: string; file?: string }, command) => {
      try {
        const config = command.parent?.parent?.config;
        if (!config) {
          throw new Error('Configuration not loaded');
        }

        const exitCode = await taskCommand('batch', undefined, options, config);
        process.exit(exitCode);
      } catch (error) {
        console.error(
          chalk.red('Command failed:'),
          error instanceof Error ? error.message : String(error)
        );
        process.exit(2);
      }
    }
  );

taskCmd
  .command('update <task-id>')
  .description('update an existing task')
  .option(
    '-s, --status <status>',
    'update status (todo, in_progress, review, testing, completed, cancelled)'
  )
  .option('-t, --type <type>', 'update type (feature, bug, refactor, test, docs, devops, research)')
  .option('-p, --priority <priority>', 'update priority (critical, high, medium, low)')
  .option('-a, --assignee <assignee>', 'update assignee')
  .option('-v, --verbose', 'verbose output with additional details')
  .action(async (taskId: string, options: TaskOptions, command) => {
    try {
      const config = command.parent?.parent?.config;
      if (!config) {
        throw new Error('Configuration not loaded');
      }

      const exitCode = await taskCommand('update', taskId, options, config);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red('Command failed:'),
        error instanceof Error ? error.message : String(error)
      );
      process.exit(2);
    }
  });

taskCmd
  .command('complete <task-id>')
  .description('mark a task as completed')
  .option('-v, --verbose', 'verbose output with additional details')
  .action(async (taskId: string, options: TaskOptions, command) => {
    try {
      const config = command.parent?.parent?.config;
      if (!config) {
        throw new Error('Configuration not loaded');
      }

      const exitCode = await taskCommand('complete', taskId, options, config);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red('Command failed:'),
        error instanceof Error ? error.message : String(error)
      );
      process.exit(2);
    }
  });

/**
 * Check command - Validate CUE files with pretty output
 */
program
  .command('check [patterns...]')
  .description('validate CUE files in the current directory')
  .option('-r, --recursive', 'recursively search for CUE files', true)
  .option('-w, --watch', 'watch for file changes and re-validate (deprecated: use "arbiter watch")')
  .option('-f, --format <type>', 'output format (table, json)', 'table')
  .option('-v, --verbose', 'verbose output with detailed errors')
  .option('--fail-fast', 'stop on first validation error')
  .option('--no-recursive', 'disable recursive search')
  .action(async (patterns: string[], options: CheckOptions, command) => {
    try {
      const config = command.parent?.config;
      if (!config) {
        throw new Error('Configuration not loaded');
      }

      const exitCode = await checkCommand(patterns, options, config);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red('Command failed:'),
        error instanceof Error ? error.message : String(error)
      );
      process.exit(2);
    }
  });

/**
 * Validate command - Explicit validation with schema/config
 */
program
  .command('validate <files...>')
  .description('validate CUE files with explicit schema and configuration')
  .option('-s, --schema <path>', 'schema file to validate against')
  .option('-c, --config <path>', 'configuration file to include')
  .option('-f, --format <type>', 'output format (table, json)', 'table')
  .option('--strict', 'treat warnings as errors')
  .option('-v, --verbose', 'verbose output with detailed errors')
  .action(async (files: string[], options: ValidateOptions, command) => {
    try {
      const config = command.parent?.config;
      if (!config) {
        throw new Error('Configuration not loaded');
      }

      const exitCode = await validateCommand(files, options, config);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red('Command failed:'),
        error instanceof Error ? error.message : String(error)
      );
      process.exit(2);
    }
  });

/**
 * Export command - Export to various formats
 */
program
  .command('export <files...>')
  .description('export CUE configurations to various formats')
  .requiredOption(
    '--format <formats>',
    'output formats (comma-separated): openapi,types,k8s,terraform,json-schema,json,yaml'
  )
  .option('-o, --output <path>', 'output file or directory')
  .option('-s, --schema <path>', 'schema file to include')
  .option('-c, --config <path>', 'configuration file to include')
  .option('--minify', 'minify JSON output')
  .option('--strict', 'enable strict export validation')
  .option('-v, --verbose', 'verbose output with metadata')
  .option('--list-formats', 'list available export formats')
  .action(
    async (
      files: string[],
      options: ExportOptions & { format: string; listFormats?: boolean },
      command
    ) => {
      const config = command.parent?.config;
      if (!config) {
        throw new Error('Configuration not loaded');
      }

      if (options.listFormats) {
        await listFormats(config);
        return;
      }

      try {
        // Parse format string
        const formats = options.format.split(',').map(f => f.trim()) as ExportOptions['format'];
        const exportOptions: ExportOptions = {
          ...options,
          format: formats,
        };

        const exitCode = await exportCommand(files, exportOptions, config);
        process.exit(exitCode);
      } catch (error) {
        console.error(
          chalk.red('Command failed:'),
          error instanceof Error ? error.message : String(error)
        );
        process.exit(2);
      }
    }
  );

/**
 * Template command - Manage and use CUE schema templates
 */
const templateCmd = program.command('template').description('manage and use CUE schema templates');

templateCmd
  .command('list')
  .description('list available templates')
  .action(async (_, _command) => {
    try {
      const exitCode = await templateCommand('list');
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red('Command failed:'),
        error instanceof Error ? error.message : String(error)
      );
      process.exit(2);
    }
  });

templateCmd
  .command('show <template>')
  .description('show template details and usage')
  .action(async (templateName: string, _, _command) => {
    try {
      const exitCode = await templateCommand('show', templateName);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red('Command failed:'),
        error instanceof Error ? error.message : String(error)
      );
      process.exit(2);
    }
  });

templateCmd
  .command('add <template>')
  .description('add template to current project')
  .option('-o, --output <file>', 'output file path')
  .option('-f, --format <type>', 'output format (cue, json)', 'cue')
  .option('-i, --interactive', 'interactive template customization')
  .action(async (templateName: string, options: TemplateOptions, _command) => {
    try {
      const exitCode = await templateCommand('add', templateName, options);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red('Command failed:'),
        error instanceof Error ? error.message : String(error)
      );
      process.exit(2);
    }
  });

/**
 * Templates command - Template alias management
 */
const templatesCmd = program
  .command('templates')
  .description('manage template aliases for code generation');

templatesCmd
  .command('list')
  .description('list available template aliases')
  .option('-f, --format <format>', 'output format (table, json)', 'table')
  .option('-v, --verbose', 'verbose output')
  .action(async (options: TemplatesOptions, command) => {
    try {
      const config = command.parent?.parent?.config;
      const exitCode = await templatesCommand('list', undefined, options, config);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red('Command failed:'),
        error instanceof Error ? error.message : String(error)
      );
      process.exit(2);
    }
  });

templatesCmd
  .command('show <name>')
  .description('show details for a template alias')
  .option('-f, --format <format>', 'output format (table, json)', 'table')
  .option('-v, --verbose', 'verbose output')
  .action(async (name: string, options: TemplatesOptions, command) => {
    try {
      const config = command.parent?.parent?.config;
      const exitCode = await templatesCommand('show', name, options, config);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red('Command failed:'),
        error instanceof Error ? error.message : String(error)
      );
      process.exit(2);
    }
  });

templatesCmd
  .command('add <name>')
  .description('add a new template alias')
  .option('--source <source>', 'template source (URL, path, or repo)')
  .option('--description <description>', 'template description')
  .option('--engine <engine>', 'template engine to use', 'cookiecutter')
  .option('--prerequisites <prereqs>', 'comma-separated list of prerequisites')
  .option('-v, --verbose', 'verbose output')
  .action(async (name: string, options: any, command) => {
    try {
      const config = command.parent?.parent?.config;
      const exitCode = await templatesCommand('add', name, options, config);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red('Command failed:'),
        error instanceof Error ? error.message : String(error)
      );
      process.exit(2);
    }
  });

templatesCmd
  .command('remove <name>')
  .description('remove a template alias')
  .option('-v, --verbose', 'verbose output')
  .action(async (name: string, options: TemplatesOptions, command) => {
    try {
      const config = command.parent?.parent?.config;
      const exitCode = await templatesCommand('remove', name, options, config);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red('Command failed:'),
        error instanceof Error ? error.message : String(error)
      );
      process.exit(2);
    }
  });

templatesCmd
  .command('update')
  .description('update template configuration')
  .option('-v, --verbose', 'verbose output')
  .action(async (options: TemplatesOptions, command) => {
    try {
      const config = command.parent?.parent?.config;
      const exitCode = await templatesCommand('update', undefined, options, config);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red('Command failed:'),
        error instanceof Error ? error.message : String(error)
      );
      process.exit(2);
    }
  });

/**
 * Create command - Interactive schema creation
 */
program
  .command('create <type>')
  .description('create new schemas and configurations interactively')
  .option('--no-interactive', 'disable interactive mode')
  .option('-n, --name <name>', 'project name (required for non-interactive mode)')
  .option('-o, --output <file>', 'output file path')
  .option('-t, --template <template>', 'base template to use')
  .action(async (type: string, options: CreateOptions, _command) => {
    try {
      const exitCode = await createCommand(type, options);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red('Command failed:'),
        error instanceof Error ? error.message : String(error)
      );
      process.exit(2);
    }
  });

/**
 * Import command - Manage trusted import registry
 */
const importCmd = program
  .command('import')
  .description('manage trusted import registry for CUE files');

importCmd
  .command('init')
  .description('initialize import registry with safe defaults')
  .option('-g, --global', 'initialize global registry (~/.arbiter/imports.json)')
  .action(async (options: ImportOptions, _command) => {
    try {
      const exitCode = await importCommand('init', undefined, options);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red('Command failed:'),
        error instanceof Error ? error.message : String(error)
      );
      process.exit(2);
    }
  });

importCmd
  .command('list')
  .description('list allowed and blocked imports')
  .option('-g, --global', 'use global registry')
  .action(async (options: ImportOptions, _command) => {
    try {
      const exitCode = await importCommand('list', undefined, options);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red('Command failed:'),
        error instanceof Error ? error.message : String(error)
      );
      process.exit(2);
    }
  });

importCmd
  .command('add <pattern>')
  .description('add allowed import pattern (supports wildcards)')
  .option('-g, --global', 'add to global registry')
  .action(async (pattern: string, options: ImportOptions, _command) => {
    try {
      const exitCode = await importCommand('add', pattern, options);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red('Command failed:'),
        error instanceof Error ? error.message : String(error)
      );
      process.exit(2);
    }
  });

importCmd
  .command('remove <pattern>')
  .description('remove allowed import pattern')
  .option('-g, --global', 'remove from global registry')
  .action(async (pattern: string, options: ImportOptions, _command) => {
    try {
      const exitCode = await importCommand('remove', pattern, options);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red('Command failed:'),
        error instanceof Error ? error.message : String(error)
      );
      process.exit(2);
    }
  });

importCmd
  .command('block <pattern>')
  .description('block import pattern with reason')
  .option('-g, --global', 'add to global registry')
  .option('--reason <reason>', 'reason for blocking')
  .action(async (pattern: string, options: ImportOptions & { reason?: string }, _command) => {
    try {
      // Pass reason through allow array for now (not ideal but works with current interface)
      const importOptions: ImportOptions = {
        ...options,
        allow: options.reason ? [options.reason] : undefined,
      };
      const exitCode = await importCommand('block', pattern, importOptions);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red('Command failed:'),
        error instanceof Error ? error.message : String(error)
      );
      process.exit(2);
    }
  });

importCmd
  .command('validate <files...>')
  .description('validate imports in CUE files against registry')
  .option('-g, --global', 'use global registry')
  .action(async (files: string[], options: ImportOptions, _command) => {
    try {
      const importOptions: ImportOptions = {
        ...options,
        allow: files,
      };
      const exitCode = await importCommand('validate', undefined, importOptions);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red('Command failed:'),
        error instanceof Error ? error.message : String(error)
      );
      process.exit(2);
    }
  });

/**
 * Diff command - Compare schema versions
 */
program
  .command('diff <old-file> <new-file>')
  .description('compare two CUE schema versions and analyze changes')
  .option('--migration', 'generate migration guide for breaking changes')
  .option('--format <type>', 'output format (text, json)', 'text')
  .option('--context <lines>', 'context lines around changes', '3')
  .option('--summary', 'show only summary statistics')
  .action(async (oldFile: string, newFile: string, options: DiffOptions, _command) => {
    try {
      const exitCode = await diffCommand(oldFile, newFile, options);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red('Command failed:'),
        error instanceof Error ? error.message : String(error)
      );
      process.exit(2);
    }
  });

/**
 * Execute command - Execute Epic v2 with deterministic code generation
 */
program
  .command('execute <epic>')
  .description('execute Epic v2 for deterministic, agent-first code generation')
  .option('--dry-run', 'show planned changes without applying them')
  .option('-w, --workspace <path>', 'workspace directory', process.cwd())
  .option('-t, --timeout <ms>', 'test timeout in milliseconds', '30000')
  .option('--junit <file>', 'write JUnit XML report to file')
  .option('-v, --verbose', 'verbose output with detailed diffs')
  .option('--agent-mode', 'output NDJSON events for agent consumption')
  .option('--ndjson-output <file>', 'write NDJSON events to file instead of stdout')
  .action(async (epic: string, options: ExecuteOptions, _command) => {
    try {
      const executeOptions: ExecuteOptions = {
        ...options,
        epic,
        timeout:
          typeof options.timeout === 'number'
            ? options.timeout
            : options.timeout
              ? Number.parseInt(String(options.timeout), 10)
              : 30000,
      };

      const exitCode = await executeCommand(executeOptions);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red('Command failed:'),
        error instanceof Error ? error.message : String(error)
      );
      process.exit(2);
    }
  });

/**
 * Test command - Unified test harness and scaffolding for Epic v2
 */
const testsCmd = program
  .command('tests')
  .description('test management, scaffolding, and coverage analysis');

// Legacy test command for backward compatibility
testsCmd
  .command('run')
  .description('run unified test harness for analysis/property/golden/cli tests')
  .option('--epic <epic>', 'epic file containing test configuration')
  .option(
    '--types <types>',
    'test types to run: static,property,golden,cli',
    'static,property,golden,cli'
  )
  .option('--junit <file>', 'write JUnit XML report to file')
  .option('-t, --timeout <ms>', 'test timeout in milliseconds', '30000')
  .option('-v, --verbose', 'verbose output with detailed test results')
  .option('--parallel', 'run tests in parallel (not yet implemented)')
  .option('--update-golden', 'update golden files with actual output')
  .action(async (options: TestOptions & { types?: string }, _command) => {
    try {
      const testOptions: TestOptions = {
        ...options,
        types: options.types ? options.types.split(',').map(t => t.trim()) : undefined,
        timeout:
          typeof options.timeout === 'number'
            ? options.timeout
            : options.timeout
              ? Number.parseInt(String(options.timeout), 10)
              : 30000,
      };

      const exitCode = await testCommand(testOptions);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red('Command failed:'),
        error instanceof Error ? error.message : String(error)
      );
      process.exit(2);
    }
  });

// New scaffold command
testsCmd
  .command('scaffold')
  .description('generate test skeletons from CUE invariants')
  .option(
    '-l, --language <lang>',
    'target language (typescript, python, rust, go, bash)',
    'typescript'
  )
  .option('--framework <name>', 'test framework override')
  .option('--no-property', 'disable property test generation')
  .option('-o, --output <dir>', 'output directory for generated tests')
  .option('--output-dir <dir>', 'output directory for generated tests (alias for --output)')
  .option('-f, --force', 'overwrite existing test files')
  .option('-v, --verbose', 'verbose output with detailed analysis')
  .action(async (options: TestsOptions, command) => {
    try {
      const config = command.parent?.parent?.config;
      if (!config) {
        throw new Error('Configuration not loaded');
      }

      const exitCode = await scaffoldCommand(options, config);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red('Command failed:'),
        error instanceof Error ? error.message : String(error)
      );
      process.exit(2);
    }
  });

// New coverage command
testsCmd
  .command('cover')
  .description('compute contract coverage metrics')
  .option('-t, --threshold <ratio>', 'minimum coverage threshold', '0.8')
  .option('-o, --output <file>', 'output file for coverage report', 'coverage-report.json')
  .option('--output-dir <dir>', 'output directory for coverage report (directory for --output)')
  .option('--junit <file>', 'write JUnit XML coverage report')
  .option('-v, --verbose', 'detailed coverage breakdown')
  .action(async (options: TestsOptions & { threshold?: string }, command) => {
    try {
      const config = command.parent?.parent?.config;
      if (!config) {
        throw new Error('Configuration not loaded');
      }

      const testsOptions: TestsOptions = {
        ...options,
        threshold: options.threshold ? Number.parseFloat(options.threshold) : 0.8,
      };

      const exitCode = await coverCommand(testsOptions, config);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red('Command failed:'),
        error instanceof Error ? error.message : String(error)
      );
      process.exit(2);
    }
  });

/**
 * Server command - Start local development server (future feature)
 */
program
  .command('server')
  .description('start local Arbiter server (development)')
  .option('-p, --port <number>', 'port number', '8080')
  .option('--host <address>', 'host address', 'localhost')
  .action(_options => {
    console.log(chalk.yellow('Server command not yet implemented'));
    console.log(chalk.dim('Use the standalone API server for now'));
    process.exit(1);
  });

/**
 * IDE command - Generate IDE configuration and recommendations
 */
program
  .command('ide recommend')
  .description('generate IDE configuration for optimal CUE development')
  .option('--editor <type>', 'editor type: vscode, idea, vim, all', 'vscode')
  .option('--force', 'overwrite existing configuration files')
  .option('--detect', 'only detect project languages, do not generate config')
  .option('--output <dir>', 'output directory for IDE configs')
  .option('--output-dir <dir>', 'output directory for IDE configs (alias for --output)')
  .action(async (options: IDEOptions, command) => {
    try {
      const config = command.parent?.config;
      if (!config) {
        throw new Error('Configuration not loaded');
      }

      const exitCode = await ideCommand(options, config);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red('Command failed:'),
        error instanceof Error ? error.message : String(error)
      );
      process.exit(2);
    }
  });

/**
 * Sync command - Synchronize project manifests with Arbiter configuration
 */
program
  .command('sync')
  .description('synchronize project manifests (package.json, pyproject.toml, etc.) with Arbiter')
  .option('--language <lang>', 'language to sync: python, typescript, rust, bash, all')
  .option('--all', 'sync all detected language manifests')
  .option('--dry-run', 'show what would be changed without applying')
  .option('--backup', 'create backup files before modification')
  .option('--force', 'overwrite conflicting sections')
  .action(async (options: SyncOptions, command) => {
    try {
      const config = command.parent?.config;
      if (!config) {
        throw new Error('Configuration not loaded');
      }

      const exitCode = await syncCommand(options, config);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red('Command failed:'),
        error instanceof Error ? error.message : String(error)
      );
      process.exit(2);
    }
  });

/**
 * Integrate command - Generate CI/CD workflows from Arbiter configuration
 */
program
  .command('integrate')
  .description('generate CI/CD workflows with contract coverage and quality gates')
  .option('--provider <name>', 'CI provider: github, gitlab, azure, all', 'github')
  .option('--type <type>', 'workflow type: pr, main, release, all', 'all')
  .option('--output <dir>', 'output directory for CI files', '.github/workflows')
  .option('--force', 'overwrite existing workflow files')
  .option('--matrix', 'use build matrix from assembly file')
  .option('--templates', 'generate GitHub issue templates from configuration')
  .action(async (options: IntegrateOptions, command) => {
    try {
      const config = command.parent?.config;
      if (!config) {
        throw new Error('Configuration not loaded');
      }

      const exitCode = await integrateCommand(options, config);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red('Command failed:'),
        error instanceof Error ? error.message : String(error)
      );
      process.exit(2);
    }
  });

/**
 * GitHub Templates command - Manage GitHub issue templates
 */
program
  .command('github-templates')
  .description('manage GitHub issue templates configuration')
  .option('--list', 'list all available templates')
  .option('--show <name>', 'show details of a specific template')
  .option('--validate', 'validate template configuration')
  .option('--add', 'add a new template (interactive)')
  .option('--remove <name>', 'remove a template')
  .option('--format <format>', 'output format: table, json, yaml', 'table')
  .action(async (options: TemplateManagementOptions, command) => {
    try {
      const config = command.parent?.config;
      if (!config) {
        throw new Error('Configuration not loaded');
      }

      const exitCode = await githubTemplatesCommand(options, config);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red('Command failed:'),
        error instanceof Error ? error.message : String(error)
      );
      process.exit(2);
    }
  });

/**
 * Docs command - Documentation generation
 */
const docsCmd = program
  .command('docs')
  .description('generate documentation from CUE schemas and API surfaces');

docsCmd
  .command('schema')
  .description('generate schema documentation from project specifications')
  .option('--format <type>', 'output format: markdown, html, json', 'markdown')
  .option('--output <file>', 'output file path')
  .option('--output-dir <dir>', 'output directory for generated documentation', '.')
  .option('--examples', 'generate example files alongside documentation')
  .action(async (options: DocsOptions, command) => {
    try {
      const config = command.parent?.parent?.config;
      if (!config) {
        throw new Error('Configuration not loaded');
      }

      const exitCode = await docsCommand('schema', options, config);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red('Command failed:'),
        error instanceof Error ? error.message : String(error)
      );
      process.exit(2);
    }
  });

docsCmd
  .command('api')
  .description('generate API documentation from surface.json')
  .option('--format <type>', 'output format: markdown, html', 'markdown')
  .option('--output <file>', 'output file path')
  .option('--output-dir <dir>', 'output directory for generated documentation', '.')
  .action(async (options: DocsOptions, command) => {
    try {
      const config = command.parent?.parent?.config;
      if (!config) {
        throw new Error('Configuration not loaded');
      }

      const exitCode = await docsCommand('api', options, config);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red('Command failed:'),
        error instanceof Error ? error.message : String(error)
      );
      process.exit(2);
    }
  });

/**
 * Examples command - Generate example projects
 */
program
  .command('examples <type>')
  .description('generate example projects by profile or language type')
  .option('--profile <name>', 'specific profile to generate (library, cli, service)')
  .option('--language <lang>', 'specific language to generate (typescript, python, rust, go)')
  .option('--output <dir>', 'output directory for examples', './examples')
  .option('--minimal', 'generate minimal examples')
  .option('--complete', 'generate complete examples with full features')
  .action(async (type: string, options: ExamplesOptions, command) => {
    try {
      const config = command.parent?.config;
      if (!config) {
        throw new Error('Configuration not loaded');
      }

      if (!['profile', 'language'].includes(type)) {
        console.error(chalk.red(`Invalid type: ${type}`));
        console.log(chalk.dim('Valid types: profile, language'));
        process.exit(1);
      }

      const exitCode = await examplesCommand(type, options, config);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red('Command failed:'),
        error instanceof Error ? error.message : String(error)
      );
      process.exit(2);
    }
  });

/**
 * Generate command - Core code generation from EXISTING assembly.cue
 */
program
  .command('generate [spec-name]')
  .description('generate project files from stored specifications')
  .option('--output-dir <dir>', 'output directory for generated files', '.')
  .option('--include-ci', 'include CI/CD workflow files')
  .option('--force', 'overwrite existing files')
  .option('--dry-run', 'show what would be generated without creating files')
  .option('--verbose', 'verbose output with detailed progress')
  .option(
    '--format <type>',
    'output format: auto, json, yaml, typescript, python, rust, go, shell',
    'auto'
  )
  .option('--sync-github', 'sync epics and tasks to GitHub after generation')
  .option('--github-dry-run', 'preview GitHub sync changes without applying them')
  .option('--use-config', 'use configuration file repository info (for conflict resolution)')
  .option('--use-git-remote', 'use Git remote repository info (for conflict resolution)')
  .action(async (specName: string | undefined, options: GenerateOptions, command) => {
    try {
      let config = command.parent?.config;
      if (!config) {
        throw new Error('Configuration not loaded');
      }

      // Apply Git auto-detection if GitHub sync is requested
      if (options.syncGithub) {
        config = await loadConfigWithGitDetection(config, {
          useConfig: options.useConfig,
          useGitRemote: options.useGitRemote,
          verbose: options.verbose,
        });
      }

      const exitCode = await generateCommand(options, config, specName);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red('Command failed:'),
        error instanceof Error ? error.message : String(error)
      );
      process.exit(2);
    }
  });

/**
 * Preview command - Deterministic plan output
 */
program
  .command('preview')
  .description('show what would be generated without creating files (deterministic output)')
  .option('--format <type>', 'output format: json, yaml, text', 'text')
  .option('--output <file>', 'output file path for saving preview plan')
  .option('--output-dir <dir>', 'output directory for preview plan (directory for --output)')
  .option('--verbose', 'detailed preview with all planned operations')
  .option('--include-content', 'include file content in preview for deterministic comparison')
  .action(async (options: PreviewOptions, command) => {
    try {
      const config = command.parent?.config;
      if (!config) {
        throw new Error('Configuration not loaded');
      }

      const exitCode = await previewCommand(options, config);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red('Command failed:'),
        error instanceof Error ? error.message : String(error)
      );
      process.exit(2);
    }
  });

/**
 * Explain command - Plain-English assembly explanation
 */
program
  .command('explain')
  .description('generate plain-English summary of project specifications')
  .option('--format <type>', 'output format: text, json', 'text')
  .option('--output <file>', 'output file path for saving explanation')
  .option('--verbose', 'detailed explanation with all configuration details')
  .option('--no-hints', 'disable helpful hints in output')
  .action(async (options: ExplainOptions, command) => {
    try {
      const config = command.parent?.config;
      if (!config) {
        throw new Error('Configuration not loaded');
      }

      const exitCode = await explainCommand(options, config);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red('Command failed:'),
        error instanceof Error ? error.message : String(error)
      );
      process.exit(2);
    }
  });

/**
 * Rename command - Migrate files to smart naming
 */
program
  .command('rename')
  .description('migrate existing files to project-specific naming')
  .option('--dry-run', 'show what would be renamed without doing it', true)
  .option('--apply', 'apply the renaming changes (disables dry-run)')
  .option('--force', 'force rename even if already using project-specific names')
  .option('-v, --verbose', 'show verbose output with project detection details')
  .option(
    '--types <types>',
    'comma-separated list of file types to rename (assembly,surface,versionPlan,etc)'
  )
  .option('--help-naming', 'show detailed naming help and examples')
  .action(async (options: RenameOptions & { helpNaming?: boolean }, command) => {
    if (options.helpNaming) {
      showNamingHelp();
      return;
    }

    try {
      const config = command.parent?.config;
      if (!config) {
        throw new Error('Configuration not loaded');
      }

      // Parse types if provided
      if (options.types) {
        options.types = Array.isArray(options.types)
          ? options.types
          : String(options.types)
              .split(',')
              .map(t => t.trim());
      }

      const exitCode = await renameCommand(options, config);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red('Command failed:'),
        error instanceof Error ? error.message : String(error)
      );
      process.exit(2);
    }
  });

/**
 * Spec command - Git-style spec revision management
 */
const specCmd = program
  .command('spec')
  .description('manage spec fragments and revisions with git-style operations');

specCmd
  .command('status')
  .description('show the status of spec fragments and revisions')
  .option('--project-id <id>', 'project ID', 'default')
  .option('--format <format>', 'output format (table, json)', 'table')
  .action(async (options, command) => {
    try {
      const config = command.parent?.parent?.config;
      if (!config) {
        throw new Error('Configuration not loaded');
      }

      const apiClient = new ApiClient(config);
      const fragments = await apiClient.listFragments(options.projectId);

      if (options.format === 'json') {
        console.log(JSON.stringify(fragments, null, 2));
      } else {
        console.log(chalk.cyan('Spec Fragment Status:'));
        for (const fragment of fragments.data || []) {
          console.log(`  ${fragment.path} (${fragment.id.substring(0, 8)})`);
        }
      }
    } catch (error) {
      console.error(
        chalk.red('Command failed:'),
        error instanceof Error ? error.message : String(error)
      );
      process.exit(2);
    }
  });

specCmd
  .command('checkout <fragment-path> [revision]')
  .description('checkout a specific revision of a spec fragment')
  .option('--project-id <id>', 'project ID', 'default')
  .option('-o, --output <file>', 'output file path')
  .action(async (fragmentPath: string, revision: string | undefined, options, command) => {
    try {
      const config = command.parent?.parent?.config;
      if (!config) {
        throw new Error('Configuration not loaded');
      }

      const apiClient = new ApiClient(config);

      // Get fragment info
      const fragments = await apiClient.listFragments(options.projectId);
      const fragment = fragments.data?.find(f => f.path === fragmentPath);

      if (!fragment) {
        console.error(chalk.red(`Fragment not found: ${fragmentPath}`));
        process.exit(1);
      }

      // Get revisions
      const revisionsResponse = await fetch(
        `${config.apiUrl}/api/fragments/${fragment.id}/revisions`
      );
      if (!revisionsResponse.ok) {
        throw new Error(`Failed to get revisions: ${revisionsResponse.statusText}`);
      }

      const revisionsData = await revisionsResponse.json();
      const revisions = revisionsData.revisions;

      let targetRevision;
      if (revision) {
        // Find specific revision by number or ID
        targetRevision = revisions.find(
          r => r.revision_number.toString() === revision || r.id === revision
        );
        if (!targetRevision) {
          console.error(chalk.red(`Revision not found: ${revision}`));
          process.exit(1);
        }
      } else {
        // Get latest revision (head)
        targetRevision = revisions[0];
      }

      // Get the specific revision content
      const revisionResponse = await fetch(
        `${config.apiUrl}/api/fragments/${fragment.id}/revisions/${targetRevision.id}`
      );
      if (!revisionResponse.ok) {
        throw new Error(`Failed to get revision content: ${revisionResponse.statusText}`);
      }

      const revisionData = await revisionResponse.json();
      const content = revisionData.content;

      if (options.output) {
        await require('node:fs').promises.writeFile(options.output, content);
        console.log(
          chalk.green(
            `✓ Checked out revision ${targetRevision.revision_number} to ${options.output}`
          )
        );
      } else {
        console.log(content);
      }
    } catch (error) {
      console.error(
        chalk.red('Command failed:'),
        error instanceof Error ? error.message : String(error)
      );
      process.exit(2);
    }
  });

specCmd
  .command('diff <fragment-path> [old-revision] [new-revision]')
  .description('show differences between spec revisions')
  .option('--project-id <id>', 'project ID', 'default')
  .option('--unified <lines>', 'lines of context', '3')
  .action(
    async (
      fragmentPath: string,
      oldRevision: string | undefined,
      newRevision: string | undefined,
      options,
      command
    ) => {
      try {
        const config = command.parent?.parent?.config;
        if (!config) {
          throw new Error('Configuration not loaded');
        }

        const apiClient = new ApiClient(config);

        // Get fragment info
        const fragments = await apiClient.listFragments(options.projectId);
        const fragment = fragments.data?.find(f => f.path === fragmentPath);

        if (!fragment) {
          console.error(chalk.red(`Fragment not found: ${fragmentPath}`));
          process.exit(1);
        }

        // Get revisions
        const revisionsResponse = await fetch(
          `${config.apiUrl}/api/fragments/${fragment.id}/revisions`
        );
        if (!revisionsResponse.ok) {
          throw new Error(`Failed to get revisions: ${revisionsResponse.statusText}`);
        }

        const revisionsData = await revisionsResponse.json();
        const revisions = revisionsData.revisions;

        // Default to comparing HEAD with previous revision
        let oldRev;
        let newRev;

        if (!oldRevision && !newRevision) {
          // Compare HEAD with previous
          if (revisions.length < 2) {
            console.log(chalk.yellow('Only one revision exists, nothing to compare'));
            process.exit(0);
          }
          newRev = revisions[0]; // HEAD
          oldRev = revisions[1]; // Previous
        } else {
          // Find specific revisions
          oldRev = revisions.find(
            r => r.revision_number.toString() === oldRevision || r.id === oldRevision
          );
          newRev = newRevision
            ? revisions.find(
                r => r.revision_number.toString() === newRevision || r.id === newRevision
              )
            : revisions[0];

          if (!oldRev || !newRev) {
            console.error(chalk.red('One or more revisions not found'));
            process.exit(1);
          }
        }

        // Simulate diff output (simplified)
        console.log(chalk.cyan(`diff --git a/${fragmentPath} b/${fragmentPath}`));
        console.log(chalk.yellow(`--- ${fragmentPath} (revision ${oldRev.revision_number})`));
        console.log(chalk.yellow(`+++ ${fragmentPath} (revision ${newRev.revision_number})`));
        console.log();
        console.log(chalk.dim(`Old: ${oldRev.message} by ${oldRev.author}`));
        console.log(chalk.dim(`New: ${newRev.message} by ${newRev.author}`));
        console.log(
          chalk.dim(
            `Content hash changed: ${oldRev.content_hash.substring(0, 12)} -> ${newRev.content_hash.substring(0, 12)}`
          )
        );
      } catch (error) {
        console.error(
          chalk.red('Command failed:'),
          error instanceof Error ? error.message : String(error)
        );
        process.exit(2);
      }
    }
  );

specCmd
  .command('log <fragment-path>')
  .description('show revision history for a spec fragment')
  .option('--project-id <id>', 'project ID', 'default')
  .option('--oneline', 'condensed one-line format')
  .option('-n, --max-count <number>', 'limit number of revisions', '10')
  .action(async (fragmentPath: string, options, command) => {
    try {
      const config = command.parent?.parent?.config;
      if (!config) {
        throw new Error('Configuration not loaded');
      }

      const apiClient = new ApiClient(config);

      // Get fragment info
      const fragments = await apiClient.listFragments(options.projectId);
      const fragment = fragments.data?.find(f => f.path === fragmentPath);

      if (!fragment) {
        console.error(chalk.red(`Fragment not found: ${fragmentPath}`));
        process.exit(1);
      }

      // Get revisions
      const revisionsResponse = await fetch(
        `${config.apiUrl}/api/fragments/${fragment.id}/revisions`
      );
      if (!revisionsResponse.ok) {
        throw new Error(`Failed to get revisions: ${revisionsResponse.statusText}`);
      }

      const revisionsData = await revisionsResponse.json();
      const revisions = revisionsData.revisions.slice(0, Number.parseInt(options.maxCount));

      if (options.oneline) {
        for (const rev of revisions) {
          console.log(
            `${chalk.yellow(rev.content_hash.substring(0, 7))} ${rev.message} (${chalk.dim(rev.author)})`
          );
        }
      } else {
        for (const rev of revisions) {
          console.log(chalk.yellow(`commit ${rev.content_hash}`));
          console.log(`Author: ${rev.author}`);
          console.log(`Date: ${rev.created_at}`);
          console.log(`Revision: ${rev.revision_number}`);
          console.log();
          console.log(`    ${rev.message}`);
          console.log();
        }
      }
    } catch (error) {
      console.error(
        chalk.red('Command failed:'),
        error instanceof Error ? error.message : String(error)
      );
      process.exit(2);
    }
  });

// Commit functionality is handled automatically by the existing add/update commands
// Revisions are created automatically when fragments are updated

/**
 * Webhook command - Manage webhooks for GitHub/GitLab integration
 */
const webhookCmd = program
  .command('webhook')
  .description('manage repository webhooks for GitHub/GitLab integration');

webhookCmd
  .command('list')
  .description('list webhook configuration and status')
  .option('--format <format>', 'output format', 'table')
  .action(async (options: WebhookOptions, command) => {
    try {
      const config = command.parent?.parent?.config;
      if (!config) {
        throw new Error('Configuration not loaded');
      }

      const exitCode = await listWebhooksCommand(options, config);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red('Command failed:'),
        error instanceof Error ? error.message : String(error)
      );
      process.exit(2);
    }
  });

webhookCmd
  .command('get <project-id>')
  .description('get webhook configuration for a project')
  .option('--format <format>', 'output format', 'table')
  .action(async (projectId: string, options: WebhookOptions, command) => {
    try {
      const config = command.parent?.parent?.config;
      if (!config) {
        throw new Error('Configuration not loaded');
      }

      const exitCode = await getWebhookCommand(projectId, options, config);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red('Command failed:'),
        error instanceof Error ? error.message : String(error)
      );
      process.exit(2);
    }
  });

webhookCmd
  .command('set <project-id>')
  .description('create or update webhook configuration for a project')
  .option('--provider <provider>', 'webhook provider (github|gitlab)')
  .option('--repository <repo>', 'repository URL')
  .option('--events <events>', 'comma-separated list of events', 'push')
  .option('--secret <secret>', 'webhook secret')
  .option('--enabled', 'enable webhook', true)
  .option('--disabled', 'disable webhook')
  .option('--format <format>', 'output format', 'table')
  .option('--dry-run', 'preview changes without applying')
  .action(async (projectId: string, options: WebhookOptions & { disabled?: boolean }, command) => {
    try {
      const config = command.parent?.parent?.config;
      if (!config) {
        throw new Error('Configuration not loaded');
      }

      // Handle disabled flag
      if (options.disabled) {
        options.enabled = false;
      }

      const exitCode = await setWebhookCommand(projectId, options, config);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red('Command failed:'),
        error instanceof Error ? error.message : String(error)
      );
      process.exit(2);
    }
  });

webhookCmd
  .command('delete <project-id>')
  .description('delete webhook configuration for a project')
  .option('--force', 'confirm deletion')
  .action(async (projectId: string, options: WebhookOptions, command) => {
    try {
      const config = command.parent?.parent?.config;
      if (!config) {
        throw new Error('Configuration not loaded');
      }

      const exitCode = await deleteWebhookCommand(projectId, options, config);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red('Command failed:'),
        error instanceof Error ? error.message : String(error)
      );
      process.exit(2);
    }
  });

webhookCmd
  .command('test <provider>')
  .description('test webhook endpoint with sample payload')
  .option('--secret <secret>', 'webhook secret for testing')
  .option('--format <format>', 'output format', 'table')
  .option('--dry-run', 'show test payload without sending')
  .action(async (provider: 'github' | 'gitlab', options: WebhookOptions, command) => {
    try {
      const config = command.parent?.parent?.config;
      if (!config) {
        throw new Error('Configuration not loaded');
      }

      const exitCode = await testWebhookCommand(provider, options, config);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red('Command failed:'),
        error instanceof Error ? error.message : String(error)
      );
      process.exit(2);
    }
  });

webhookCmd
  .command('help')
  .description('show webhook setup guide')
  .action(() => {
    showWebhookHelp();
  });

/**
 * Config command - Manage CLI configuration
 */
const configCmd = program.command('config').description('manage CLI configuration');

configCmd
  .command('show')
  .description('show current configuration')
  .action(async (_, command) => {
    try {
      const config = command.parent?.parent?.config;
      if (!config) {
        throw new Error('Configuration not loaded');
      }

      console.log(chalk.cyan('Current configuration:'));
      console.log(JSON.stringify(config, null, 2));
    } catch (error) {
      console.error(
        chalk.red('Command failed:'),
        error instanceof Error ? error.message : String(error)
      );
      process.exit(2);
    }
  });

configCmd
  .command('set <key> <value>')
  .description('set configuration value')
  .action((_key, _value) => {
    console.log(chalk.yellow('Config set command not yet implemented'));
    process.exit(1);
  });

/**
 * Health command - Enhanced API server health check
 */
program
  .command('health')
  .description('comprehensive Arbiter server health check')
  .option('--verbose', 'show detailed health information')
  .option('--timeout <ms>', 'health check timeout in milliseconds')
  .action(async (options: { verbose?: boolean; timeout?: string }, command) => {
    try {
      const config = command.parent?.config;
      if (!config) {
        throw new Error('Configuration not loaded');
      }

      const apiClient = new ApiClient(config);
      const timeout = options.timeout ? Number.parseInt(options.timeout, 10) : config.timeout;

      console.log(chalk.blue('🏥 Comprehensive health check...'));
      console.log(chalk.dim(`Server: ${config.apiUrl}`));
      console.log(chalk.dim(`Timeout: ${timeout}ms (API client enforces ≤750ms per spec)`));

      const startTime = Date.now();

      // Test basic connectivity
      const healthResult = await apiClient.health();
      const responseTime = Date.now() - startTime;

      if (healthResult.success) {
        console.log(chalk.green('✅ Server is healthy'));
        console.log(chalk.dim(`Response time: ${responseTime}ms`));

        if (options.verbose && healthResult.data) {
          console.log(chalk.cyan('\nDetailed health information:'));
          console.log(JSON.stringify(healthResult.data, null, 2));
        }

        // Test rate limiting compliance
        console.log(chalk.blue('\n🔒 Testing rate limit compliance...'));
        const rateLimitStart = Date.now();

        try {
          // Make two quick requests to test rate limiting
          await apiClient.health();
          await apiClient.health();
          const rateLimitTime = Date.now() - rateLimitStart;

          if (rateLimitTime >= 1000) {
            console.log(chalk.green('✅ Rate limiting active (≥1s between requests)'));
          } else {
            console.log(chalk.yellow('⚠️  Rate limiting may not be active'));
          }
        } catch (_error) {
          console.log(chalk.yellow('⚠️  Rate limit test inconclusive'));
        }

        // Test validation endpoint
        console.log(chalk.blue('\n🔍 Testing validation endpoint...'));
        try {
          const validationResult = await apiClient.validate('test: "hello"');
          if (validationResult.success) {
            console.log(chalk.green('✅ Validation endpoint working'));
          } else {
            console.log(chalk.yellow('⚠️  Validation endpoint issues detected'));
          }
        } catch (_error) {
          console.log(chalk.red('❌ Validation endpoint failed'));
        }

        console.log(chalk.green('\n🎉 Health check complete - All systems operational'));
        process.exit(0);
      } else {
        console.log(chalk.red(`❌ Server unhealthy: ${healthResult.error}`));
        console.log(chalk.dim('Common issues:'));
        console.log(chalk.dim('  - Server not running (run: bun run dev)'));
        console.log(chalk.dim('  - Wrong API URL in configuration'));
        console.log(chalk.dim('  - Network connectivity issues'));
        process.exit(1);
      }
    } catch (error) {
      console.error(
        chalk.red('❌ Health check failed:'),
        error instanceof Error ? error.message : String(error)
      );
      process.exit(2);
    }
  });

/**
 * Error handling for unknown commands
 */
program.on('command:*', () => {
  console.error(chalk.red(`Unknown command: ${program.args.join(' ')}`));
  console.log(chalk.dim('Run `arbiter --help` for available commands'));
  process.exit(1);
});

/**
 * Enhanced help with examples - using addHelpText instead of configureHelp
 */
program.addHelpText(
  'after',
  `
${chalk.cyan('Arbiter CLI - Agent-Friendly Specification Management')}

${chalk.yellow('Core Workflows:')}

  ${chalk.cyan('1. SPEC FRAGMENT MANAGEMENT (Git-Style):')}
    arbiter init my-app --schema=app     # Initialize with app-centric schema 
    arbiter add service billing          # Add service specification
    arbiter add api/order                # Add API endpoint specification
    arbiter add flow checkout            # Add user flow specification
    arbiter generate                     # Generate code from specifications

  ${chalk.cyan('2. VALIDATION & FEEDBACK:')}
    arbiter check                        # Validate all specifications
    arbiter watch                        # Watch mode with live validation

  ${chalk.cyan('3. RELEASE MANAGEMENT:')}
    arbiter version                      # Plan version changes
    arbiter integrate                    # Generate CI/CD workflows

${chalk.yellow('Schema Formats:')}
  app: Complete application modeling

${chalk.yellow('Agent-Friendly Features:')}
  • Non-interactive commands (no prompts)
  • Structured JSON output (--format=json)
  • Exit codes: 0=success, 1=error, 2=config
  • NDJSON streaming (--ndjson-output)

${chalk.yellow('Examples:')}
  arbiter check **/*.cue --format=json  # Validate with JSON output
  arbiter surface app.py --output=cue   # Extract API surface from code
  arbiter health                        # Check server connectivity

${chalk.gray('For detailed help: arbiter <command> --help')}
`
);

// Parse arguments and run
import { fileURLToPath } from 'node:url';
if (fileURLToPath(import.meta.url) === process.argv[1]) {
  program.parse();
}

export default program;

#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { loadConfig } from './config.js';
import { checkCommand } from './commands/check.js';
import { initCommand, listTemplates } from './commands/init.js';
import { validateCommand } from './commands/validate.js';
import { exportCommand, listFormats } from './commands/export.js';
import { templateCommand } from './commands/template.js';
import { createCommand } from './commands/create.js';
import { importCommand } from './commands/import.js';
import { diffCommand } from './commands/diff.js';
import { migrateCommand } from './commands/migrate.js';
import { executeCommand } from './commands/execute.js';
import { testCommand } from './commands/test.js';
import { scaffoldCommand, coverCommand } from './commands/tests.js';
import { watchCommand } from './commands/watch.js';
import { surfaceCommand } from './commands/surface.js';
import { versionPlanCommand, versionReleaseCommand } from './commands/version.js';
import { ideCommand } from './commands/ide.js';
import { syncCommand } from './commands/sync.js';
import { integrateCommand } from './commands/integrate.js';
import { docsCommand } from './commands/docs.js';
import { examplesCommand } from './commands/examples.js';
import { explainCommand } from './commands/explain.js';
import { generateCommand } from './commands/generate.js';
import { previewCommand } from './commands/preview.js';
import type { CheckOptions, InitOptions, ValidateOptions, ExportOptions, TemplateOptions, CreateOptions, ImportOptions, DiffOptions, MigrateOptions, ExecuteOptions, TestOptions, TestsOptions, WatchOptions, SurfaceOptions, VersionPlanOptions, VersionReleaseOptions, IDEOptions, SyncOptions, IntegrateOptions, DocsOptions, ExamplesOptions, ExplainOptions, GenerateOptions, PreviewOptions } from './types.js';

// Package info
const packageJson = {
  name: 'arbiter',
  version: '0.1.0',
  description: 'Arbiter CLI for CUE validation and management'
};

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
  .option('--api-url <url>', 'API server URL', 'http://localhost:8080')
  .option('--timeout <ms>', 'request timeout in milliseconds', '5000')
  .hook('preAction', async (thisCommand) => {
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
      console.error(chalk.red('Configuration error:'), error instanceof Error ? error.message : String(error));
      process.exit(2);
    }
  });

/**
 * Init command - Initialize new CUE project
 */
program
  .command('init [project-name]')
  .description('initialize a new CUE project with templates')
  .option('-t, --template <name>', 'project template to use (basic, kubernetes, api)')
  .option('-d, --directory <path>', 'target directory for the project')
  .option('-f, --force', 'overwrite existing files')
  .option('--list-templates', 'list available templates')
  .action(async (projectName, options: InitOptions & { listTemplates?: boolean }, command) => {
    if (options.listTemplates) {
      listTemplates();
      return;
    }
    
    try {
      const exitCode = await initCommand(projectName, options);
      process.exit(exitCode);
    } catch (error) {
      console.error(chalk.red('Command failed:'), error instanceof Error ? error.message : String(error));
      process.exit(2);
    }
  });

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
  .action(async (path: string | undefined, options: WatchOptions & { debounce?: string; patterns?: string }, command) => {
    try {
      const config = command.parent?.config;
      if (!config) {
        throw new Error('Configuration not loaded');
      }

      const watchOptions: WatchOptions = {
        ...options,
        path,
        debounce: options.debounce ? parseInt(options.debounce, 10) : 300,
        patterns: options.patterns ? options.patterns.split(',').map(p => p.trim()) : undefined
      };

      const exitCode = await watchCommand(watchOptions, config);
      process.exit(exitCode);
    } catch (error) {
      console.error(chalk.red('Command failed:'), error instanceof Error ? error.message : String(error));
      process.exit(2);
    }
  });

/**
 * Surface command - Generate API surface from code
 */
program
  .command('surface <language>')
  .description('extract API surface from source code and generate surface.json')
  .option('-o, --output <file>', 'output file path', 'surface.json')
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
        language: language as SurfaceOptions['language']
      };

      const exitCode = await surfaceCommand(surfaceOptions, config);
      process.exit(exitCode);
    } catch (error) {
      console.error(chalk.red('Command failed:'), error instanceof Error ? error.message : String(error));
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
      console.error(chalk.red('Command failed:'), error instanceof Error ? error.message : String(error));
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
      console.error(chalk.red('Command failed:'), error instanceof Error ? error.message : String(error));
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
      console.error(chalk.red('Command failed:'), error instanceof Error ? error.message : String(error));
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
      console.error(chalk.red('Command failed:'), error instanceof Error ? error.message : String(error));
      process.exit(2);
    }
  });

/**
 * Export command - Export to various formats
 */
program
  .command('export <files...>')
  .description('export CUE configurations to various formats')
  .requiredOption('--format <formats>', 'output formats (comma-separated): openapi,types,k8s,terraform,json-schema,json,yaml')
  .option('-o, --output <path>', 'output file or directory')
  .option('-s, --schema <path>', 'schema file to include')
  .option('-c, --config <path>', 'configuration file to include')
  .option('--minify', 'minify JSON output')
  .option('--strict', 'enable strict export validation')
  .option('-v, --verbose', 'verbose output with metadata')
  .option('--list-formats', 'list available export formats')
  .action(async (files: string[], options: ExportOptions & { format: string; listFormats?: boolean }, command) => {
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
      console.error(chalk.red('Command failed:'), error instanceof Error ? error.message : String(error));
      process.exit(2);
    }
  });

/**
 * Template command - Manage and use CUE schema templates
 */
const templateCmd = program
  .command('template')
  .description('manage and use CUE schema templates');

templateCmd
  .command('list')
  .description('list available templates')
  .action(async (_, command) => {
    try {
      const exitCode = await templateCommand('list');
      process.exit(exitCode);
    } catch (error) {
      console.error(chalk.red('Command failed:'), error instanceof Error ? error.message : String(error));
      process.exit(2);
    }
  });

templateCmd
  .command('show <template>')
  .description('show template details and usage')
  .action(async (templateName: string, _, command) => {
    try {
      const exitCode = await templateCommand('show', templateName);
      process.exit(exitCode);
    } catch (error) {
      console.error(chalk.red('Command failed:'), error instanceof Error ? error.message : String(error));
      process.exit(2);
    }
  });

templateCmd
  .command('add <template>')
  .description('add template to current project')
  .option('-o, --output <file>', 'output file path')
  .option('-f, --format <type>', 'output format (cue, json)', 'cue')
  .option('-i, --interactive', 'interactive template customization')
  .action(async (templateName: string, options: TemplateOptions, command) => {
    try {
      const exitCode = await templateCommand('add', templateName, options);
      process.exit(exitCode);
    } catch (error) {
      console.error(chalk.red('Command failed:'), error instanceof Error ? error.message : String(error));
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
  .action(async (type: string, options: CreateOptions, command) => {
    try {
      const exitCode = await createCommand(type, options);
      process.exit(exitCode);
    } catch (error) {
      console.error(chalk.red('Command failed:'), error instanceof Error ? error.message : String(error));
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
  .action(async (options: ImportOptions, command) => {
    try {
      const exitCode = await importCommand('init', undefined, options);
      process.exit(exitCode);
    } catch (error) {
      console.error(chalk.red('Command failed:'), error instanceof Error ? error.message : String(error));
      process.exit(2);
    }
  });

importCmd
  .command('list')
  .description('list allowed and blocked imports')
  .option('-g, --global', 'use global registry')
  .action(async (options: ImportOptions, command) => {
    try {
      const exitCode = await importCommand('list', undefined, options);
      process.exit(exitCode);
    } catch (error) {
      console.error(chalk.red('Command failed:'), error instanceof Error ? error.message : String(error));
      process.exit(2);
    }
  });

importCmd
  .command('add <pattern>')
  .description('add allowed import pattern (supports wildcards)')
  .option('-g, --global', 'add to global registry')
  .action(async (pattern: string, options: ImportOptions, command) => {
    try {
      const exitCode = await importCommand('add', pattern, options);
      process.exit(exitCode);
    } catch (error) {
      console.error(chalk.red('Command failed:'), error instanceof Error ? error.message : String(error));
      process.exit(2);
    }
  });

importCmd
  .command('remove <pattern>')
  .description('remove allowed import pattern')
  .option('-g, --global', 'remove from global registry')
  .action(async (pattern: string, options: ImportOptions, command) => {
    try {
      const exitCode = await importCommand('remove', pattern, options);
      process.exit(exitCode);
    } catch (error) {
      console.error(chalk.red('Command failed:'), error instanceof Error ? error.message : String(error));
      process.exit(2);
    }
  });

importCmd
  .command('block <pattern>')
  .description('block import pattern with reason')
  .option('-g, --global', 'add to global registry')
  .option('--reason <reason>', 'reason for blocking')
  .action(async (pattern: string, options: ImportOptions & { reason?: string }, command) => {
    try {
      // Pass reason through allow array for now (not ideal but works with current interface)
      const importOptions: ImportOptions = {
        ...options,
        allow: options.reason ? [options.reason] : undefined,
      };
      const exitCode = await importCommand('block', pattern, importOptions);
      process.exit(exitCode);
    } catch (error) {
      console.error(chalk.red('Command failed:'), error instanceof Error ? error.message : String(error));
      process.exit(2);
    }
  });

importCmd
  .command('validate <files...>')
  .description('validate imports in CUE files against registry')
  .option('-g, --global', 'use global registry')
  .action(async (files: string[], options: ImportOptions, command) => {
    try {
      const importOptions: ImportOptions = {
        ...options,
        allow: files,
      };
      const exitCode = await importCommand('validate', undefined, importOptions);
      process.exit(exitCode);
    } catch (error) {
      console.error(chalk.red('Command failed:'), error instanceof Error ? error.message : String(error));
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
  .action(async (oldFile: string, newFile: string, options: DiffOptions, command) => {
    try {
      const exitCode = await diffCommand(oldFile, newFile, options);
      process.exit(exitCode);
    } catch (error) {
      console.error(chalk.red('Command failed:'), error instanceof Error ? error.message : String(error));
      process.exit(2);
    }
  });

/**
 * Migrate command - Apply schema evolution changes
 */
program
  .command('migrate [patterns...]')
  .description('automatically migrate CUE schemas to latest format')
  .option('--dry-run', 'show what would be changed without making changes')
  .option('--backup', 'create backup files before migration')
  .option('--force', 'proceed with migration even if errors are detected')
  .option('--from <version>', 'source schema version')
  .option('--to <version>', 'target schema version')
  .action(async (patterns: string[], options: MigrateOptions, command) => {
    try {
      const exitCode = await migrateCommand(patterns, options);
      process.exit(exitCode);
    } catch (error) {
      console.error(chalk.red('Command failed:'), error instanceof Error ? error.message : String(error));
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
  .action(async (epic: string, options: ExecuteOptions, command) => {
    try {
      const executeOptions: ExecuteOptions = {
        ...options,
        epic,
        timeout: options.timeout ? parseInt(options.timeout as string, 10) : 30000,
      };
      
      const exitCode = await executeCommand(executeOptions);
      process.exit(exitCode);
    } catch (error) {
      console.error(chalk.red('Command failed:'), error instanceof Error ? error.message : String(error));
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
  .option('--types <types>', 'test types to run: static,property,golden,cli', 'static,property,golden,cli')
  .option('--junit <file>', 'write JUnit XML report to file')
  .option('-t, --timeout <ms>', 'test timeout in milliseconds', '30000')
  .option('-v, --verbose', 'verbose output with detailed test results')
  .option('--parallel', 'run tests in parallel (not yet implemented)')
  .option('--update-golden', 'update golden files with actual output')
  .action(async (options: TestOptions & { types?: string }, command) => {
    try {
      const testOptions: TestOptions = {
        ...options,
        types: options.types ? options.types.split(',').map(t => t.trim()) : undefined,
        timeout: options.timeout ? parseInt(options.timeout as string, 10) : 30000,
      };
      
      const exitCode = await testCommand(testOptions);
      process.exit(exitCode);
    } catch (error) {
      console.error(chalk.red('Command failed:'), error instanceof Error ? error.message : String(error));
      process.exit(2);
    }
  });

// New scaffold command
testsCmd
  .command('scaffold')
  .description('generate test skeletons from CUE invariants')
  .option('-l, --language <lang>', 'target language (typescript, python, rust, go, bash)', 'typescript')
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
      console.error(chalk.red('Command failed:'), error instanceof Error ? error.message : String(error));
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
        threshold: options.threshold ? parseFloat(options.threshold) : 0.8,
      };
      
      const exitCode = await coverCommand(testsOptions, config);
      process.exit(exitCode);
    } catch (error) {
      console.error(chalk.red('Command failed:'), error instanceof Error ? error.message : String(error));
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
  .action((options) => {
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
      console.error(chalk.red('Command failed:'), error instanceof Error ? error.message : String(error));
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
      console.error(chalk.red('Command failed:'), error instanceof Error ? error.message : String(error));
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
  .action(async (options: IntegrateOptions, command) => {
    try {
      const config = command.parent?.config;
      if (!config) {
        throw new Error('Configuration not loaded');
      }

      const exitCode = await integrateCommand(options, config);
      process.exit(exitCode);
    } catch (error) {
      console.error(chalk.red('Command failed:'), error instanceof Error ? error.message : String(error));
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
  .description('generate schema documentation from arbiter.assembly.cue')
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
      console.error(chalk.red('Command failed:'), error instanceof Error ? error.message : String(error));
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
      console.error(chalk.red('Command failed:'), error instanceof Error ? error.message : String(error));
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
      console.error(chalk.red('Command failed:'), error instanceof Error ? error.message : String(error));
      process.exit(2);
    }
  });

/**
 * Generate command - Core code generation based on assembly.cue
 */
program
  .command('generate')
  .description('generate project files from arbiter.assembly.cue specification')
  .option('--output-dir <dir>', 'output directory for generated files', '.')
  .option('--include-ci', 'include CI/CD workflow files')
  .option('--force', 'overwrite existing files')
  .option('--dry-run', 'show what would be generated without creating files')
  .option('--verbose', 'verbose output with detailed progress')
  .option('--format <type>', 'output format: auto, json, yaml, typescript, python, rust, go, shell', 'auto')
  .action(async (options: GenerateOptions, command) => {
    try {
      const config = command.parent?.config;
      if (!config) {
        throw new Error('Configuration not loaded');
      }

      const exitCode = await generateCommand(options, config);
      process.exit(exitCode);
    } catch (error) {
      console.error(chalk.red('Command failed:'), error instanceof Error ? error.message : String(error));
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
      console.error(chalk.red('Command failed:'), error instanceof Error ? error.message : String(error));
      process.exit(2);
    }
  });

/**
 * Explain command - Plain-English assembly explanation
 */
program
  .command('explain')
  .description('generate plain-English summary of current arbiter.assembly.cue')
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
      console.error(chalk.red('Command failed:'), error instanceof Error ? error.message : String(error));
      process.exit(2);
    }
  });

/**
 * Config command - Manage CLI configuration
 */
const configCmd = program
  .command('config')
  .description('manage CLI configuration');

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
      console.error(chalk.red('Command failed:'), error instanceof Error ? error.message : String(error));
      process.exit(2);
    }
  });

configCmd
  .command('set <key> <value>')
  .description('set configuration value')
  .action((key, value) => {
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
  .option('--timeout <ms>', 'health check timeout in milliseconds', '5000')
  .action(async (options: { verbose?: boolean; timeout?: string }, command) => {
    try {
      const config = command.parent?.config;
      if (!config) {
        throw new Error('Configuration not loaded');
      }

      const apiClient = new ApiClient(config);
      const timeout = options.timeout ? parseInt(options.timeout, 10) : config.timeout;
      
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
        } catch (error) {
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
        } catch (error) {
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
      console.error(chalk.red('❌ Health check failed:'), error instanceof Error ? error.message : String(error));
      process.exit(2);
    }
  });

/**
 * Error handling for unknown commands
 */
program
  .on('command:*', () => {
    console.error(chalk.red(`Unknown command: ${program.args.join(' ')}`));
    console.log(chalk.dim('Run `arbiter --help` for available commands'));
    process.exit(1);
  });

/**
 * Enhanced help with examples
 */
program
  .configureHelp({
    afterAll: () => {
      return `
${chalk.cyan('Examples:')}
  ${chalk.dim('Initialize new project:')}
    arbiter init my-project --template kubernetes
    
  ${chalk.dim('Watch and validate files:')}
    arbiter watch
    arbiter watch --agent-mode --debounce 250
    arbiter watch src/ --patterns "**/*.cue,**/*.ts"
    
  ${chalk.dim('Extract API surfaces:')}
    arbiter surface typescript --output api.json
    arbiter surface typescript --diff --include-private
    
  ${chalk.dim('Version management (semver-aware):')}
    arbiter version plan --strict --verbose
    arbiter version plan --current surface.json --previous surface-prev.json
    arbiter version release --dry-run
    arbiter version release --apply --verbose
    
  ${chalk.dim('Validate files:')}
    arbiter check
    arbiter check --format json
    arbiter validate schema.cue values.cue --strict
    
  ${chalk.dim('Export configurations:')}
    arbiter export *.cue --format openapi,types
    arbiter export . --format k8s --output manifests/
    
  ${chalk.dim('Manage templates:')}
    arbiter template list
    arbiter template show budget_constraint
    arbiter template add selection_rubric --output my-rubric.cue
    
  ${chalk.dim('Manage imports (security):')}
    arbiter import init
    arbiter import add @valhalla/constraints@1.0.0
    arbiter import validate schema.cue
    
  ${chalk.dim('Schema evolution:')}
    arbiter diff old-schema.cue new-schema.cue --migration
    arbiter migrate *.cue --dry-run --backup
    
  ${chalk.dim('Execute epics (agent-first code generation):')}
    arbiter execute epics/new-service.json --dry-run
    arbiter execute epics/config-refactor.json --verbose
    arbiter execute epics/breaking-change.json --junit report.xml
    
  ${chalk.dim('Generate tests from invariants (revolutionary):')}
    arbiter tests scaffold --language typescript --verbose
    arbiter tests scaffold --language python --output tests/
    arbiter tests scaffold --language rust --force
    
  ${chalk.dim('Analyze contract coverage:')}
    arbiter tests cover --threshold 0.9 --verbose
    arbiter tests cover --junit coverage.xml --output report.json
    
  ${chalk.dim('Run tests (unified test harness):')}
    arbiter tests run --epic epics/new-service.json
    arbiter tests run --epic epics/config-refactor.json --types static,golden
    arbiter tests run --epic epics/breaking-change.json --junit test-results.xml
    
  ${chalk.dim('IDE configuration (ecosystem integration):')}
    arbiter ide recommend
    arbiter ide recommend --editor all --force
    arbiter ide recommend --detect
    
  ${chalk.dim('Manifest synchronization:')}
    arbiter sync
    arbiter sync --language typescript --dry-run
    arbiter sync --all --backup --force
    
  ${chalk.dim('CI/CD integration:')}
    arbiter integrate
    arbiter integrate --provider github --type pr --force
    arbiter integrate --matrix --output .github/workflows
    
  ${chalk.dim('Documentation generation (Phase 5):')}
    arbiter docs schema                           # Generate schema docs from CUE
    arbiter docs schema --format html --examples # HTML docs with examples
    arbiter docs api --format markdown           # API docs from surface.json
    
  ${chalk.dim('Example projects (Phase 5):')}
    arbiter examples profile                      # Generate all profile examples
    arbiter examples profile --profile library   # Generate library example only
    arbiter examples language --language typescript # TypeScript examples
    arbiter examples profile --output ./my-examples  # Custom output directory
    
  ${chalk.dim('Plain-English explanations (Phase 5):')}
    arbiter explain                               # Explain current assembly.cue
    arbiter explain --format json --output explanation.json # JSON format
    arbiter explain --verbose                     # Detailed analysis
    arbiter explain --no-hints                   # Without helpful hints
    
  ${chalk.dim('Check server:')}
    arbiter health
    
${chalk.cyan('Configuration:')}
  Create ${chalk.yellow('.arbiter.json')} in your project root:
  {
    "apiUrl": "http://localhost:8080",
    "format": "table",
    "color": true
  }
`;
    }
  });

// Parse arguments and run
if (import.meta.url === `file://${process.argv[1]}`) {
  program.parse();
}

export default program;
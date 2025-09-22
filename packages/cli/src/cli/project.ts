/**
 * Project commands module - Project management and validation
 */

import chalk from 'chalk';
import { Command } from 'commander';
import { checkCommand } from '../commands/check.js';
import { diffCommand } from '../commands/diff.js';
import { initCommand, listTemplates } from '../commands/init.js';
import { listCommand } from '../commands/list.js';
import { statusCommand } from '../commands/status.js';
import { surfaceCommand } from '../commands/surface.js';
import { watchCommand } from '../commands/watch.js';
import { loadConfig } from '../config.js';
import type { SurfaceLanguage } from '../surface-extraction/types.js';
import type { CheckOptions, InitOptions, SurfaceOptions, WatchOptions } from '../types.js';

export function createProjectCommands(program: Command): void {
  // Init command
  program
    .command('init [display-name]')
    .description('initialize a new CUE project with templates in current directory')
    .option('--schema <type>', 'schema type to use (app)', 'app')
    .option('--list-templates', 'list available templates')
    .action(async (displayName: string | undefined, options: InitOptions, command) => {
      try {
        if (options.listTemplates) {
          listTemplates();
          return;
        }

        const config = command.parent?.config;
        if (!config) {
          throw new Error('Configuration not loaded');
        }

        const exitCode = await initCommand(displayName, options, config);
        process.exit(exitCode);
      } catch (error) {
        console.error(
          chalk.red('Command failed:'),
          error instanceof Error ? error.message : String(error)
        );
        process.exit(2);
      }
    });

  // Watch command
  program
    .command('watch [path]')
    .description('cross-platform file watcher with live validation and planning')
    .option('--agent-mode', 'output NDJSON for agent consumption')
    .option('--no-validate', 'disable validation on changes')
    .action(async (path: string | undefined, options, command) => {
      try {
        const config = command.parent?.config;
        if (!config) {
          throw new Error('Configuration not loaded');
        }

        const watchOptions: WatchOptions = {
          agentMode: options.agentMode,
          validate: options.validate !== false,
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
    });

  // Surface command
  program
    .command('surface <language>')
    .description('extract API surface from source code and generate project-specific surface file')
    .option('-o, --output <file>', 'explicit output file path (overrides smart naming)')
    .option('--format <format>', 'output format (cue, json, yaml)', 'cue')
    .option(
      '--project-name <name>',
      'project name for file naming (auto-detected if not specified)'
    )
    .option('--include-private', 'include private methods and properties')
    .option('--diff', 'compare against existing spec and show changes')
    .action(async (language: string, options, command) => {
      try {
        const config = command.parent?.config;
        if (!config) {
          throw new Error('Configuration not loaded');
        }

        const surfaceOptions: SurfaceOptions = {
          language: language as SurfaceLanguage,
          output: options.output,
          format: options.format,
          projectName: options.projectName,
          includePrivate: options.includePrivate,
          diff: options.diff,
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

  // Check command
  program
    .command('check [patterns...]')
    .description('validate CUE files in the current directory')
    .option('-f, --format <format>', 'output format (table, json)', 'table')
    .option(
      '-w, --watch',
      'watch for file changes and re-validate (deprecated: use "arbiter watch")'
    )
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

  // List command
  program
    .command('list <type>')
    .description('list components of a specific type in the project')
    .option('-f, --format <format>', 'output format (table, json)', 'table')
    .option('-v, --verbose', 'verbose output with additional details')
    .action(async (type: string, options, command) => {
      try {
        const config = await loadConfig();
        if (!config) {
          throw new Error('Configuration not loaded');
        }

        const exitCode = await listCommand(type, options, config);
        process.exit(exitCode);
      } catch (error) {
        console.error(
          chalk.red('Command failed:'),
          error instanceof Error ? error.message : String(error)
        );
        process.exit(2);
      }
    });

  // Status command
  program
    .command('status')
    .description('show project status overview')
    .option('-f, --format <format>', 'output format (table, json)', 'table')
    .option('-v, --verbose', 'verbose output with additional details')
    .action(async (options, command) => {
      try {
        const config = await loadConfig();
        if (!config) {
          throw new Error('Configuration not loaded');
        }

        const exitCode = await statusCommand(options, config);
        process.exit(exitCode);
      } catch (error) {
        console.error(
          chalk.red('Command failed:'),
          error instanceof Error ? error.message : String(error)
        );
        process.exit(2);
      }
    });

  // Diff command
  program
    .command('diff <old-file> <new-file>')
    .description('compare two CUE schema versions and analyze changes')
    .option('-f, --format <format>', 'output format (table, json)', 'table')
    .option('--context <lines>', 'number of context lines', value => Number.parseInt(value, 10), 3)
    .action(async (oldFile: string, newFile: string, options) => {
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

  // Health command
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

        const ApiClient = (await import('../api-client.js')).ApiClient;
        const apiClient = new ApiClient(config);
        const timeout = options.timeout ? Number.parseInt(options.timeout, 10) : config.timeout;

        console.log(chalk.blue('🏥 Comprehensive health check...'));
        console.log(chalk.dim(`Server: ${config.apiUrl}`));
        console.log(chalk.dim(`Timeout: ${timeout}ms (API client enforces ≤750ms per spec)`));

        if (options.verbose) {
          console.log(chalk.cyan('\n🔍 Detailed validation:'));
        }

        try {
          const health = await apiClient.health(timeout);

          if (health.status === 'healthy') {
            console.log(chalk.green('✅ Server is healthy'));
            if (options.verbose) {
              console.log(chalk.dim('  - API endpoints responding'));
              console.log(chalk.dim('  - Database connections active'));
            }
          } else {
            console.log(chalk.yellow('⚠️  Server has issues'));
            if (health.issues) {
              for (const issue of health.issues) {
                console.log(chalk.yellow(`  - ${issue}`));
              }
            }
          }

          // Test basic validation
          if (options.verbose) {
            const validationResult = await apiClient.validate('test: "hello"');
            if (validationResult.valid) {
              console.log(chalk.green('  ✅ CUE validation working'));
            } else {
              console.log(chalk.red('  ❌ CUE validation failed'));
            }
          }

          process.exit(0);
        } catch (error) {
          console.log(chalk.red('❌ Server unreachable or not responding'));
          if (options.verbose) {
            console.log(chalk.dim('  Possible causes:'));
            console.log(chalk.dim('  - Server not running (run: bun run dev)'));
            console.log(chalk.dim('  - Wrong API URL in configuration'));
            console.log(chalk.dim('  - Network connectivity issues'));
          }
          process.exit(1);
        }
      } catch (error) {
        console.error(
          chalk.red('Health check failed:'),
          error instanceof Error ? error.message : String(error)
        );
        process.exit(2);
      }
    });
}

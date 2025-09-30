/**
 * Add commands module - Modular specification builder
 */

import chalk from 'chalk';
import { Command } from 'commander';
import { addCommand } from '../commands/add.js';
import type { AddOptions } from '../commands/add.js';

export function createAddCommands(program: Command): Command {
  const addCmd = program
    .command('add')
    .description('incrementally build CUE specifications with modular generators');

  addCmd
    .command('service <name>')
    .description('add a service to the specification')
    .option('--template <alias>', 'use template alias for service generation')
    .option(
      '--language <lang>',
      'programming language (typescript, python, rust, go)',
      'typescript'
    )
    .option('--port <port>', 'service port number', value => Number.parseInt(value, 10))
    .option(
      '--service-type <type>',
      'platform-specific service type (cloudflare_worker, vercel_function, supabase_functions, etc.)'
    )
    .option('--dry-run', 'preview changes without applying them')
    .option('--force', 'overwrite existing configuration')
    .action(async (name: string, options, command) => {
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
    });

  addCmd
    .command('endpoint <path>')
    .description('add an API endpoint to a service')
    .option('--method <method>', 'HTTP method (GET, POST, PUT, DELETE, PATCH)', 'GET')
    .option('--service <service>', 'target service name')
    .option('--response-type <type>', 'response content type (json, xml, text)', 'json')
    .option('--auth <auth>', 'authentication requirement (none, bearer, basic, api-key)', 'none')
    .option('--dry-run', 'preview changes without applying them')
    .option('--force', 'overwrite existing configuration')
    .action(async (path: string, options, command) => {
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
    });

  addCmd
    .command('route <path>')
    .description('add a UI route for frontend applications')
    .option('--component <component>', 'React component name')
    .option('--id <id>', 'route identifier (auto-generated if not specified)')
    .option('--layout <layout>', 'layout component to use')
    .option('--auth <auth>', 'authentication requirement (none, required)', 'none')
    .option('--dry-run', 'preview changes without applying them')
    .option('--force', 'overwrite existing configuration')
    .action(async (path: string, options, command) => {
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
    });

  addCmd
    .command('flow <id>')
    .description('add a user flow for testing and validation')
    .option('--description <description>', 'flow description')
    .option('--steps <steps>', 'JSON array of flow steps (e.g. "[{"visit":"/"}]")')
    .option('--expected-outcome <outcome>', 'expected outcome of the flow')
    .option('--dry-run', 'preview changes without applying them')
    .option('--force', 'overwrite existing configuration')
    .action(async (id: string, options, command) => {
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
    });

  addCmd
    .command('load-balancer')
    .description('add a load balancer with health check invariants')
    .option(
      '--algorithm <algorithm>',
      'load balancing algorithm (round_robin, least_connections, ip_hash)',
      'round_robin'
    )
    .option('--health-check-path <path>', 'health check endpoint path', '/health')
    .option('--dry-run', 'preview changes without applying them')
    .option('--force', 'overwrite existing configuration')
    .action(async (options, command) => {
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
    .option('--type <type>', 'database type (postgres, mysql, mongodb, redis)', 'postgres')
    .option(
      '--service-type <type>',
      'platform-specific database type (cloudflare_d1, vercel_postgres, supabase_database)'
    )
    .option('--dry-run', 'preview changes without applying them')
    .option('--force', 'overwrite existing configuration')
    .action(async (name: string, options, command) => {
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
    });

  addCmd
    .command('cache <name>')
    .description('add a cache service with automatic attachment')
    .option('--ttl <ttl>', 'default time-to-live in seconds', value => Number.parseInt(value, 10))
    .option('--service-type <type>', 'platform-specific cache type (cloudflare_kv, vercel_kv)')
    .option('--dry-run', 'preview changes without applying them')
    .option('--force', 'overwrite existing configuration')
    .action(async (name: string, options, command) => {
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
    });

  addCmd
    .command('locator <key>')
    .description('add a UI locator for testing')
    .option('--selector <selector>', 'CSS selector or XPath')
    .option('--description <description>', 'locator description')
    .option('--dry-run', 'preview changes without applying them')
    .option('--force', 'overwrite existing configuration')
    .action(async (key: string, options, command) => {
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
    .option('--type <type>', 'schema type (request, response, model)', 'model')
    .option('--format <format>', 'schema format (json-schema, openapi)', 'json-schema')
    .option('--dry-run', 'preview changes without applying them')
    .option('--force', 'overwrite existing configuration')
    .action(async (name: string, options, command) => {
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
    });

  addCmd
    .command('package <name>')
    .description('add a reusable package/library (e.g. design systems, shared utilities)')
    .option(
      '--language <lang>',
      'programming language (typescript, python, rust, go)',
      'typescript'
    )
    .option('--directory <dir>', 'source directory path')
    .option('--exports <exports>', 'comma-separated list of main exports')
    .option('--version <version>', 'initial version number', '1.0.0')
    .option('--dry-run', 'preview changes without applying them')
    .option('--force', 'overwrite existing configuration')
    .action(async (name: string, options, command) => {
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
    });

  addCmd
    .command('component <name>')
    .description('add a UI component (e.g. buttons, forms, layout components)')
    .option('--type <type>', 'component type (functional, class)', 'functional')
    .option('--framework <framework>', 'UI framework (react, vue, angular, svelte)', 'react')
    .option('--directory <dir>', 'source directory path')
    .option('--props <props>', 'comma-separated list of component props')
    .option('--dry-run', 'preview changes without applying them')
    .option('--force', 'overwrite existing configuration')
    .action(async (name: string, options, command) => {
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
    });

  addCmd
    .command('module <name>')
    .description('add a standalone module (e.g. utilities, helpers, data models)')
    .option(
      '--language <lang>',
      'programming language (typescript, python, rust, go)',
      'typescript'
    )
    .option('--directory <dir>', 'source directory path')
    .option('--functions <functions>', 'comma-separated list of main functions')
    .option('--types <types>', 'comma-separated list of exported types')
    .option('--dry-run', 'preview changes without applying them')
    .option('--force', 'overwrite existing configuration')
    .action(async (name: string, options, command) => {
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
    });

  return addCmd;
}

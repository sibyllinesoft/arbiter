/**
 * Integration commands module - CI/CD, webhooks, and external integrations
 */

import chalk from 'chalk';
import { Command } from 'commander';
import { githubTemplatesCommand } from '../commands/github-templates.js';
import { integrateCommand } from '../commands/integrate.js';
import { syncCommand } from '../commands/sync.js';
import {
  type WebhookOptions,
  deleteWebhookCommand,
  getWebhookCommand,
  listWebhooksCommand,
  setWebhookCommand,
  showWebhookHelp,
  testWebhookCommand,
} from '../commands/webhook.js';
import type { IntegrateOptions, SyncOptions } from '../types.js';

export function createIntegrationCommands(program: Command): void {
  // Sync command
  program
    .command('sync')
    .description('synchronize project manifests (package.json, pyproject.toml, etc.) with Arbiter')
    .option('--dry-run', 'preview changes without applying them')
    .option('--force', 'overwrite existing manifest entries')
    .option('--backup', 'create backup files before modification')
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

  // Integrate command
  program
    .command('integrate')
    .description('generate CI/CD workflows with contract coverage and quality gates')
    .option('--platform <platform>', 'CI platform: github, gitlab, azure, all', 'github')
    .option('--provider <name>', 'CI provider: github, gitlab, azure, all', 'github')
    .option('--force', 'overwrite existing workflow files')
    .option('--dry-run', 'preview changes without applying them')
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

  // GitHub Templates command
  program
    .command('github-templates')
    .description('manage GitHub issue templates configuration')
    .option('--list', 'list all available templates')
    .option('--show <name>', 'show details of a specific template')
    .option('--validate', 'validate template configuration')
    .option('--generate', 'generate templates from configuration')
    .option('--force', 'overwrite existing template files')
    .action(async (options, command) => {
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

  // Webhook commands
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
    .option('--url <url>', 'webhook URL')
    .option('--secret <secret>', 'webhook secret')
    .option('--events <events>', 'comma-separated list of events')
    .option('--active', 'set webhook as active')
    .option('--format <format>', 'output format', 'table')
    .option('--dry-run', 'preview changes without applying')
    .action(async (projectId: string, options: WebhookOptions, command) => {
      try {
        const config = command.parent?.parent?.config;
        if (!config) {
          throw new Error('Configuration not loaded');
        }

        // Validate required options
        if (!options.provider || !options.url) {
          throw new Error('--provider and --url are required');
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
    .option('--format <format>', 'output format', 'table')
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
}

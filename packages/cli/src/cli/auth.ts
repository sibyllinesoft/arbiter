import chalk from 'chalk';
import { Command } from 'commander';
import { getAuthStorePath, loadAuthSession } from '../auth-store.js';
import { runAuthCommand } from '../commands/auth.js';
import type { CLIConfig } from '../types.js';

export function createAuthCommand(program: Command): void {
  program
    .command('auth')
    .description('Authenticate the Arbiter CLI using OAuth')
    .option('--status', 'show authentication status and token details')
    .option('--logout', 'clear cached credentials')
    .option('--output-url', 'print only the authorization URL (no prompts)', false)
    .action(async (options, command) => {
      const root: Command & { config?: CLIConfig } = command.parent as Command & {
        config?: CLIConfig;
      };
      const config = root.config;

      if (!config) {
        console.error(chalk.red('Configuration error: configuration not loaded.'));
        process.exit(2);
        return;
      }

      try {
        if (options.status) {
          const session = await loadAuthSession();
          if (!session) {
            console.log(chalk.yellow('Not authenticated. Run `arbiter auth` to sign in.'));
          } else {
            console.log(chalk.green('Authenticated with Arbiter.'));
            console.log(`  Provider: ${session.metadata?.provider ?? 'unknown'}`);
            if (session.metadata?.clientId) {
              console.log(`  Client ID: ${session.metadata.clientId}`);
            }
            if (session.expiresAt) {
              console.log(`  Expires: ${new Date(session.expiresAt).toLocaleString()}`);
            }
            if (session.scope) {
              console.log(`  Scope: ${session.scope}`);
            }
            console.log(chalk.dim(`  Credential store: ${getAuthStorePath()}`));
          }
          return;
        }

        await runAuthCommand(options, config);
      } catch (error) {
        console.error(
          chalk.red('Authentication error:'),
          error instanceof Error ? error.message : String(error)
        );
        process.exit(1);
      }
    });
}

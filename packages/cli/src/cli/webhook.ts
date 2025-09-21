/**
 * Webhook management commands
 */

import chalk from "chalk";
import { Command } from "commander";
import { ApiClient } from "../api-client.js";
import type { CLIConfig } from "../types.js";

export function createWebhookCommands(): Command {
  const webhook = new Command("webhook");
  webhook.description("Webhook automation and management");

  // GitHub webhook setup
  webhook
    .command("setup-github")
    .description("Automatically setup a GitHub webhook for a repository")
    .argument("<repo>", 'Repository in format "owner/repo" (e.g., "username/my-repo")')
    .option("-e, --events <events...>", "Webhook events to listen for", ["push", "pull_request"])
    .option(
      "-u, --tunnel-url <url>",
      "Override tunnel URL (uses environment variable if not provided)",
    )
    .option("--dry-run", "Show what would be done without making changes")
    .action(async (repo: string, options, command) => {
      const config = (command.parent as any).config;
      const api = new ApiClient(config);

      // Parse repository
      const [repoOwner, repoName] = repo.split("/");
      if (!repoOwner || !repoName) {
        console.error(chalk.red('Error: Repository must be in format "owner/repo"'));
        process.exit(1);
      }

      // Check for GitHub token
      if (!process.env.GITHUB_TOKEN) {
        console.error(chalk.red("Error: GITHUB_TOKEN environment variable is required"));
        console.log(
          chalk.yellow('Please set a GitHub Personal Access Token with "repo" permissions:'),
        );
        console.log(chalk.cyan("export GITHUB_TOKEN=ghp_your_token_here"));
        process.exit(1);
      }

      // Get tunnel URL
      const tunnelUrl = options.tunnelUrl || process.env.TUNNEL_URL;
      if (!tunnelUrl && !options.dryRun) {
        console.error(chalk.red("Error: Tunnel URL is required"));
        console.log(
          chalk.yellow("Either provide --tunnel-url or set TUNNEL_URL environment variable:"),
        );
        console.log(chalk.cyan("export TUNNEL_URL=https://your-tunnel.cfargotunnel.com"));
        process.exit(1);
      }

      if (options.dryRun) {
        console.log(chalk.blue("Dry run - would create webhook with:"));
        console.log(chalk.gray(`  Repository: ${repoOwner}/${repoName}`));
        console.log(chalk.gray(`  Events: ${options.events.join(", ")}`));
        console.log(chalk.gray(`  URL: ${tunnelUrl || "TUNNEL_URL"}/webhooks/github`));
        return;
      }

      try {
        console.log(chalk.blue(`Setting up GitHub webhook for ${repoOwner}/${repoName}...`));

        const result = await api.setupGitHubWebhook({
          repoOwner,
          repoName,
          events: options.events,
          tunnelUrl,
        });

        if (result.success && result.webhook) {
          console.log(chalk.green("✓ Webhook created successfully!"));
          console.log(chalk.gray(`  ID: ${result.webhook.id}`));
          console.log(chalk.gray(`  URL: ${result.webhook.url}`));
          console.log(chalk.gray(`  Events: ${result.webhook.events.join(", ")}`));
          console.log(chalk.gray(`  Active: ${result.webhook.active}`));
        } else {
          console.error(chalk.red(`Failed to create webhook: ${result.error}`));
          process.exit(1);
        }
      } catch (error) {
        console.error(
          chalk.red("Failed to setup webhook:"),
          error instanceof Error ? error.message : error,
        );
        process.exit(1);
      }
    });

  // List GitHub webhooks
  webhook
    .command("list-github")
    .description("List existing GitHub webhooks for a repository")
    .argument("<repo>", 'Repository in format "owner/repo"')
    .action(async (repo: string, command) => {
      const config = (command.parent as any).config;
      const api = new ApiClient(config);

      const [repoOwner, repoName] = repo.split("/");
      if (!repoOwner || !repoName) {
        console.error(chalk.red('Error: Repository must be in format "owner/repo"'));
        process.exit(1);
      }

      if (!process.env.GITHUB_TOKEN) {
        console.error(chalk.red("Error: GITHUB_TOKEN environment variable is required"));
        process.exit(1);
      }

      try {
        console.log(chalk.blue(`Listing webhooks for ${repoOwner}/${repoName}...`));

        const result = await api.listGitHubWebhooks(repoOwner, repoName);

        if (result.success && result.webhooks) {
          if (result.webhooks.length === 0) {
            console.log(chalk.yellow("No webhooks found"));
            return;
          }

          console.log(chalk.green(`Found ${result.webhooks.length} webhook(s):`));
          result.webhooks.forEach((hook, index) => {
            console.log(`\n${index + 1}. ${chalk.cyan(hook.name)} (ID: ${hook.id})`);
            console.log(chalk.gray(`   URL: ${hook.url}`));
            console.log(chalk.gray(`   Events: ${hook.events.join(", ")}`));
            console.log(chalk.gray(`   Active: ${hook.active}`));
            console.log(chalk.gray(`   Created: ${new Date(hook.created_at).toLocaleString()}`));
          });
        } else {
          console.error(chalk.red(`Failed to list webhooks: ${result.error}`));
          process.exit(1);
        }
      } catch (error) {
        console.error(
          chalk.red("Failed to list webhooks:"),
          error instanceof Error ? error.message : error,
        );
        process.exit(1);
      }
    });

  // Delete GitHub webhook
  webhook
    .command("delete-github")
    .description("Delete a GitHub webhook")
    .argument("<repo>", 'Repository in format "owner/repo"')
    .argument("<hookId>", "Webhook ID to delete")
    .option("--confirm", "Skip confirmation prompt")
    .action(async (repo: string, hookId: string, options, command) => {
      const config = (command.parent as any).config;
      const api = new ApiClient(config);

      const [repoOwner, repoName] = repo.split("/");
      if (!repoOwner || !repoName) {
        console.error(chalk.red('Error: Repository must be in format "owner/repo"'));
        process.exit(1);
      }

      if (!process.env.GITHUB_TOKEN) {
        console.error(chalk.red("Error: GITHUB_TOKEN environment variable is required"));
        process.exit(1);
      }

      if (!options.confirm) {
        console.log(
          chalk.yellow(`This will delete webhook ${hookId} from ${repoOwner}/${repoName}`),
        );
        console.log(chalk.yellow("Use --confirm to skip this prompt"));
        return;
      }

      try {
        console.log(chalk.blue(`Deleting webhook ${hookId} from ${repoOwner}/${repoName}...`));

        const result = await api.deleteGitHubWebhook(repoOwner, repoName, parseInt(hookId));

        if (result.success) {
          console.log(chalk.green("✓ Webhook deleted successfully!"));
        } else {
          console.error(chalk.red(`Failed to delete webhook: ${result.error}`));
          process.exit(1);
        }
      } catch (error) {
        console.error(
          chalk.red("Failed to delete webhook:"),
          error instanceof Error ? error.message : error,
        );
        process.exit(1);
      }
    });

  return webhook;
}

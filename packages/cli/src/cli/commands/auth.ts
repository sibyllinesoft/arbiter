/**
 * @packageDocumentation
 * Authentication commands module - OAuth authentication and session management.
 *
 * Provides commands for:
 * - OAuth authentication flow
 * - Authentication status checking
 * - Credential logout/clearing
 */

import { requireCommandConfig } from "@/cli/context.js";
import { type AuthSession, getAuthStorePath, loadAuthSession } from "@/io/api/auth-store.js";
import { runAuthCommand } from "@/services/auth/index.js";
import chalk from "chalk";
import { Command } from "commander";

/**
 * Display session detail if value is present.
 */
function displaySessionDetail(label: string, value: string | number | undefined): void {
  if (value !== undefined) {
    console.log(`  ${label}: ${value}`);
  }
}

/**
 * Display authenticated session details.
 */
function displaySessionInfo(session: AuthSession): void {
  console.log(chalk.green("Authenticated with Arbiter."));
  displaySessionDetail("Provider", session.metadata?.provider ?? "unknown");
  displaySessionDetail("Client ID", session.metadata?.clientId);
  if (session.expiresAt) {
    displaySessionDetail("Expires", new Date(session.expiresAt).toLocaleString());
  }
  displaySessionDetail("Scope", session.scope);
  console.log(chalk.dim(`  Credential store: ${getAuthStorePath()}`));
}

/**
 * Handle the auth status subcommand.
 */
async function handleAuthStatus(): Promise<void> {
  const session = await loadAuthSession();
  if (!session) {
    console.log(chalk.yellow("Not authenticated. Run `arbiter auth` to sign in."));
    return;
  }
  displaySessionInfo(session);
}

/**
 * Creates and registers the authentication command for the CLI program.
 * @param program - The Commander program instance to add the auth command to
 */
export function createAuthCommand(program: Command): void {
  program
    .command("auth")
    .description("Authenticate the Arbiter CLI using OAuth")
    .option("--status", "show authentication status and token details")
    .option("--logout", "clear cached credentials")
    .option("--output-url", "print only the authorization URL (no prompts)", false)
    .action(async (options, command) => {
      const config = requireCommandConfig(command);

      try {
        if (options.status) {
          await handleAuthStatus();
          return;
        }

        await runAuthCommand(options, config);
      } catch (error) {
        console.error(
          chalk.red("Authentication error:"),
          error instanceof Error ? error.message : String(error),
        );
        process.exit(1);
      }
    });
}

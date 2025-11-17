import chalk from "chalk";
import type { Command } from "commander";
import { ApiClient } from "../api-client.js";
import { loadAuthSession } from "../auth-store.js";
import { applyEnvironmentOverrides, loadConfig } from "../config.js";
import type { CLIConfig, ProjectStructureConfig } from "../types.js";

export interface CliContext {
  config: CLIConfig;
}

/**
 * Resolves the CLI context (configuration, auth session, environment overrides)
 * based on the root command's global options.
 */
export async function resolveCliContext(options: Record<string, any>): Promise<CliContext> {
  const config = await loadConfig(options.config);

  const cliUrl = options.arbiterUrl ?? options.apiUrl;
  if (cliUrl) config.apiUrl = cliUrl;
  if (options.timeout) config.timeout = Number.parseInt(options.timeout, 10);
  if (options.color === false) config.color = false;
  if (typeof options.local === "boolean") config.localMode = options.local;

  const finalConfig = applyEnvironmentOverrides(config);
  const authSession = await loadAuthSession();
  if (authSession) {
    finalConfig.authSession = authSession;
  } else if (finalConfig.authSession) {
    delete finalConfig.authSession;
  }

  const normalizedUrl = finalConfig.apiUrl.trim().replace(/\/+$/, "");
  finalConfig.apiUrl = normalizedUrl || finalConfig.apiUrl.trim();
  finalConfig.localMode = Boolean(finalConfig.localMode);

  await hydrateRemoteProjectStructure(finalConfig);

  return { config: finalConfig };
}

/**
 * Hydrates the current command graph with a resolved CLI context, making the
 * configuration accessible to command handlers.
 */
export async function hydrateCliContext(
  thisCommand: Command,
  actionCommand: Command,
): Promise<void> {
  const context = await resolveCliContext(thisCommand.opts());
  (thisCommand as any).config = context.config;
  (actionCommand as any).config = context.config;
}

function shouldLogRemoteConfig(): boolean {
  const flag = process.env.ARBITER_DEBUG_CONFIG;
  return typeof flag === "string" && /^(1|true|verbose)$/i.test(flag.trim());
}

function logRemoteConfig(message: string): void {
  if (shouldLogRemoteConfig()) {
    console.warn(chalk.dim(`[remote-config] ${message}`));
  }
}

function coerceDirectoryValue(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeRemoteStructure(
  remote: Record<string, unknown>,
): Partial<ProjectStructureConfig> {
  const normalized: Partial<ProjectStructureConfig> = {};

  const clients =
    coerceDirectoryValue(remote.clientsDirectory) ?? coerceDirectoryValue(remote.appsDirectory);
  if (clients) {
    normalized.clientsDirectory = clients;
  }

  const services = coerceDirectoryValue(remote.servicesDirectory);
  if (services) {
    normalized.servicesDirectory = services;
  }

  const modules =
    coerceDirectoryValue(remote.modulesDirectory) ?? coerceDirectoryValue(remote.packagesDirectory);
  if (modules) {
    normalized.modulesDirectory = modules;
  }

  const tools = coerceDirectoryValue(remote.toolsDirectory);
  if (tools) {
    normalized.toolsDirectory = tools;
  }

  const docs = coerceDirectoryValue(remote.docsDirectory);
  if (docs) {
    normalized.docsDirectory = docs;
  }

  const tests = coerceDirectoryValue(remote.testsDirectory);
  if (tests) {
    normalized.testsDirectory = tests;
  }

  const infra = coerceDirectoryValue(remote.infraDirectory);
  if (infra) {
    normalized.infraDirectory = infra;
  }

  const endpoint = coerceDirectoryValue(remote.endpointDirectory);
  if (endpoint) {
    normalized.endpointDirectory = endpoint;
  }

  return normalized;
}

async function hydrateRemoteProjectStructure(config: CLIConfig): Promise<void> {
  if (config.localMode) {
    return;
  }

  try {
    const client = new ApiClient(config);
    const response = await client.fetchProjectStructureConfig();

    if (response.success && response.projectStructure) {
      const normalized = normalizeRemoteStructure(response.projectStructure);
      if (Object.keys(normalized).length > 0) {
        config.projectStructure = {
          ...config.projectStructure,
          ...normalized,
        };
        logRemoteConfig(
          `Updated project structure from server (${Object.keys(normalized).join(", ")})`,
        );
      }
    } else if (response.error) {
      logRemoteConfig(`Server config unavailable: ${response.error}`);
    }
  } catch (error) {
    logRemoteConfig(
      `Failed to fetch remote project structure: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

/**
 * Traverses the command tree to retrieve the resolved configuration. Throws if
 * the configuration has not been attached (which indicates CLI bootstrap failed).
 */
export function requireCommandConfig(command: Command): CLIConfig {
  let cursor: Command | null = command;
  while (cursor) {
    const cfg = (cursor as any).config as CLIConfig | undefined;
    if (cfg) {
      return cfg;
    }
    cursor = cursor.parent ?? null;
  }

  throw new Error(
    chalk.red(
      "Configuration not loaded. Ensure the CLI preAction hook executed before invoking this command.",
    ),
  );
}

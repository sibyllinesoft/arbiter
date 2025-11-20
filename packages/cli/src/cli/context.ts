import chalk from "chalk";
import type { Command } from "commander";
import { ApiClient } from "../api-client.js";
import { loadAuthSession } from "../auth-store.js";
import { applyCliOverrides, applyEnvironmentOverrides, loadConfig } from "../config.js";
import type { CLIConfig, ProjectStructureConfig } from "../types.js";

export interface CliContext {
  config: CLIConfig;
}

/**
 * Resolves the CLI context (configuration, auth session, environment overrides)
 * based on the root command's global options.
 */
export async function resolveCliContext(options: Record<string, any>): Promise<CliContext> {
  const baseConfig = await loadConfig(options.config);
  const overridden = applyCliOverrides(baseConfig, {
    apiUrl: options.apiUrl,
    arbiterUrl: options.arbiterUrl,
    timeout: options.timeout,
    color: options.color,
    local: options.local,
    verbose: options.verbose,
  });

  const finalConfig = applyEnvironmentOverrides(overridden);
  const authSession = await loadAuthSession();
  if (authSession) {
    finalConfig.authSession = authSession;
  } else if (finalConfig.authSession) {
    delete finalConfig.authSession;
  }

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

function coercePackageRelative(
  value: unknown,
): ProjectStructureConfig["packageRelative"] | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const allowedKeys = ["docsDirectory", "testsDirectory", "infraDirectory"] as const;
  const result: Record<string, boolean> = {};
  for (const key of allowedKeys) {
    const raw = (value as Record<string, unknown>)[key];
    if (typeof raw === "boolean") {
      result[key] = raw;
    }
  }

  return Object.keys(result).length > 0
    ? (result as ProjectStructureConfig["packageRelative"])
    : undefined;
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

  const packagesDir =
    coerceDirectoryValue(remote.packagesDirectory) ?? coerceDirectoryValue(remote.modulesDirectory);
  if (packagesDir) {
    normalized.packagesDirectory = packagesDir;
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

  const packageRelative = coercePackageRelative(remote.packageRelative);
  if (packageRelative) {
    normalized.packageRelative = {
      ...(normalized.packageRelative ?? {}),
      ...packageRelative,
    };
  }

  return normalized;
}

async function hydrateRemoteProjectStructure(config: CLIConfig): Promise<void> {
  if (config.localMode) {
    return;
  }

  try {
    const client = new ApiClient(config);
    const response = await client.getProjectStructureConfig();

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

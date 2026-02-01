/**
 * @packageDocumentation
 * CLI Context module - Manages CLI configuration resolution and context.
 *
 * This module handles:
 * - Loading and merging configuration from files, environment, and CLI options
 * - Authentication session management
 * - Remote project structure hydration
 * - Configuration access for command handlers
 */

import { ApiClient } from "@/io/api/api-client.js";
import { loadAuthSession } from "@/io/api/auth-store.js";
import {
  applyCliOverrides,
  applyEnvironmentOverrides,
  deriveLocalMode,
  loadConfig,
} from "@/io/config/config.js";
import { ProjectRepository } from "@/repositories/project-repository.js";
import type { AuthSession, CLIConfig, ProjectStructureConfig } from "@/types.js";
import chalk from "chalk";
import type { Command } from "commander";

/**
 * Check if an auth session has a valid (non-expired) token.
 * Returns true if the token exists and is not expired.
 */
function isAuthSessionValid(session: AuthSession | null): boolean {
  if (!session?.accessToken) {
    return false;
  }

  // If no expiry is set, assume valid
  if (!session.expiresAt) {
    return true;
  }

  try {
    const expiresAt = new Date(session.expiresAt);
    const now = new Date();
    // Add 30 second buffer to avoid edge cases
    return expiresAt.getTime() > now.getTime() + 30000;
  } catch {
    // If we can't parse the date, assume invalid
    return false;
  }
}

/**
 * Container for resolved CLI context including configuration.
 */
export interface CliContext {
  /** The resolved CLI configuration */
  config: CLIConfig;
}

/** Currently active configuration, set during context resolution */
let activeConfig: CLIConfig | null = null;

/**
 * Resolves the CLI context (configuration, auth session, environment overrides)
 * based on the root command's global options.
 */
export async function resolveCliContext(
  options: Record<string, any>,
  { skipRemoteConfig = false }: { skipRemoteConfig?: boolean } = {},
): Promise<CliContext> {
  const baseConfig = await loadConfig(options.config);
  const overridden = applyCliOverrides(baseConfig, {
    apiUrl: options.apiUrl,
    timeout: options.timeout,
    color: options.color,
    local: options.local,
    verbose: options.verbose,
  });

  const withEnvOverrides = applyEnvironmentOverrides(overridden);

  // Load auth session first to determine default mode
  const authSession = await loadAuthSession();
  const hasValidAuth = isAuthSessionValid(authSession);

  // Derive localMode based on auth status and explicit configuration:
  // - If --local was explicitly passed, respect that
  // - If auth is valid (token exists and not expired), default to remote mode
  // - Otherwise, default to local/file-based mode
  let finalConfig = deriveLocalMode(withEnvOverrides);

  // If local mode wasn't explicitly set and we have valid auth, switch to remote
  if (!finalConfig.localModeExplicitlySet && hasValidAuth) {
    finalConfig = { ...finalConfig, localMode: false };
  }

  if (authSession) {
    finalConfig.authSession = authSession;
  } else if (finalConfig.authSession) {
    delete finalConfig.authSession;
  }

  if (!skipRemoteConfig) {
    await hydrateRemoteProjectStructure(finalConfig);
  }

  activeConfig = finalConfig;

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
  const actionOpts = actionCommand?.opts?.() ?? {};
  const skipRemoteConfig = actionCommand?.name?.() === "init" && Boolean(actionOpts.listPresets);

  const context = await resolveCliContext(thisCommand.opts(), { skipRemoteConfig });
  activeConfig = context.config;
}

/**
 * Check if remote config debugging is enabled via ARBITER_DEBUG_CONFIG env var.
 * @returns True if debug logging should be enabled
 */
function shouldLogRemoteConfig(): boolean {
  const flag = process.env.ARBITER_DEBUG_CONFIG;
  return typeof flag === "string" && /^(1|true|verbose)$/i.test(flag.trim());
}

/**
 * Log a remote config debug message if debugging is enabled.
 * @param message - The message to log
 */
function logRemoteConfig(message: string): void {
  if (shouldLogRemoteConfig()) {
    console.warn(chalk.dim(`[remote-config] ${message}`));
  }
}

/**
 * Coerce an unknown value to a trimmed string or undefined.
 * @param value - The value to coerce
 * @returns Trimmed string or undefined if not a valid non-empty string
 */
function coerceDirectoryValue(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Coerce package-relative configuration from an unknown value.
 * @param value - The value to coerce
 * @returns Package relative config or undefined if invalid
 */
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

/**
 * Mapping of local directory keys to remote source keys (primary, fallback).
 */
const DIRECTORY_KEY_MAPPINGS: Array<{
  localKey: keyof ProjectStructureConfig;
  remoteKeys: string[];
}> = [
  { localKey: "clientsDirectory", remoteKeys: ["clientsDirectory", "appsDirectory"] },
  { localKey: "servicesDirectory", remoteKeys: ["servicesDirectory"] },
  { localKey: "packagesDirectory", remoteKeys: ["packagesDirectory", "modulesDirectory"] },
  { localKey: "toolsDirectory", remoteKeys: ["toolsDirectory"] },
  { localKey: "docsDirectory", remoteKeys: ["docsDirectory"] },
  { localKey: "testsDirectory", remoteKeys: ["testsDirectory"] },
  { localKey: "infraDirectory", remoteKeys: ["infraDirectory"] },
];

/**
 * Extract a directory value from remote config, trying multiple keys.
 */
function extractDirectory(remote: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = coerceDirectoryValue(remote[key]);
    if (value) return value;
  }
  return undefined;
}

/**
 * Normalize remote project structure configuration to local format.
 * @param remote - Remote configuration object
 * @returns Normalized project structure configuration
 */
function normalizeRemoteStructure(
  remote: Record<string, unknown>,
): Partial<ProjectStructureConfig> {
  const normalized: Partial<ProjectStructureConfig> = {};

  for (const { localKey, remoteKeys } of DIRECTORY_KEY_MAPPINGS) {
    const value = extractDirectory(remote, remoteKeys);
    if (value) {
      (normalized as Record<string, string>)[localKey] = value;
    }
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

function applyRemoteProjectStructure(
  config: CLIConfig,
  projectStructure: Record<string, unknown>,
): void {
  const normalized = normalizeRemoteStructure(projectStructure);
  if (Object.keys(normalized).length === 0) {
    return;
  }
  config.projectStructure = {
    ...config.projectStructure,
    ...normalized,
  };
  logRemoteConfig(`Updated project structure from server (${Object.keys(normalized).join(", ")})`);
}

/**
 * Handle project structure response
 */
function handleProjectStructureResponse(
  config: CLIConfig,
  response: { success: boolean; projectStructure?: any; error?: string },
): void {
  if (response.success && response.projectStructure) {
    applyRemoteProjectStructure(config, response.projectStructure);
  } else if (response.error) {
    logRemoteConfig(`Server config unavailable: ${response.error}`);
  }
}

/**
 * Fetch and merge remote project structure into the local configuration.
 * @param config - The CLI configuration to hydrate
 */
async function hydrateRemoteProjectStructure(config: CLIConfig): Promise<void> {
  if (config.localMode) {
    return;
  }

  try {
    const client = new ApiClient(config);
    const projectRepo = new ProjectRepository(client);
    const response = await projectRepo.fetchProjectStructure();
    handleProjectStructureResponse(config, response);
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
  if (activeConfig) {
    return activeConfig;
  }

  // Backward compatibility: fall back to command-attached config if tests set it manually
  let cursor: Command | null = command;
  while (cursor) {
    const cfg = (cursor as any).config as CLIConfig | undefined;
    if (cfg) {
      activeConfig = cfg;
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

// Testing/diagnostics surface
export const __contextTesting = {
  getActiveConfig: () => activeConfig,
  setActiveConfig: (config: CLIConfig | null) => {
    activeConfig = config;
  },
};

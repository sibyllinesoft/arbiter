/**
 * @packageDocumentation
 * Status command - Display project specification status.
 *
 * Provides functionality to:
 * - Show current specification health
 * - Display component status overview
 * - Output in table, JSON, or YAML format
 */

import path from "node:path";
import { getCueManipulator } from "@/constraints/cli-integration.js";
import { validateCUE } from "@/cue/index.js";
import { ApiClient } from "@/io/api/api-client.js";
import type { Config } from "@/io/config/config.js";
import { withProgress } from "@/utils/api/progress.js";
import { formatJson, formatStatusTable, formatYaml } from "@/utils/util/output/formatting.js";
import chalk from "chalk";
import fs from "fs-extra";
import jsyaml from "js-yaml";

/** Options for the status command. */
export interface StatusOptions {
  /** Whether to show detailed specification information. */
  detailed?: boolean;
}

/** Project status information structure. */
interface ProjectStatus {
  /** Overall project health status. */
  health: "healthy" | "degraded" | "error";
  /** Additional details about the health status. */
  healthDetails?: string;
  /** ISO timestamp of last update. */
  lastUpdated?: string;
  /** List of project components with their statuses. */
  components?: Array<{
    type: string;
    name: string;
    status: "active" | "inactive" | "error";
    lastModified?: string;
    dependencies?: string[];
  }>;
  /** Validation result summary. */
  validations?: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
  };
  /** List of specification files with validation results. */
  specifications?: Array<{
    path: string;
    valid: boolean;
    errors: number;
    warnings: number;
    lastValidated?: string;
  }>;
}

/**
 * Create an empty project status for missing specifications.
 * @returns ProjectStatus with error state
 */
function createEmptyStatus(): ProjectStatus {
  return {
    health: "error",
    healthDetails: "Local specification not found",
    components: [],
    validations: { total: 0, passed: 0, failed: 0, warnings: 0 },
    specifications: [],
  };
}

/**
 * Parse a CUE specification with proper cleanup.
 * @param content - CUE specification content
 * @returns Parsed spec or error message
 */
async function parseSpecWithCleanup(content: string): Promise<{ spec: unknown; error?: string }> {
  const manipulator = getCueManipulator();
  try {
    const spec = await manipulator.parse(content);
    return { spec };
  } catch (error) {
    return { spec: null, error: error instanceof Error ? error.message : String(error) };
  } finally {
    await manipulator.cleanup();
  }
}

/**
 * Extract component information from a parsed specification.
 * @param parsedSpec - Parsed CUE specification
 * @param mtime - File modification time
 * @returns Array of component status objects
 */
function extractComponents(parsedSpec: unknown, mtime: Date): ProjectStatus["components"] {
  const services = (parsedSpec as Record<string, unknown>)?.services as
    | Record<string, unknown>
    | undefined;
  if (!services) return [];

  return Object.entries(services).map(([name, service]) => ({
    type: "service",
    name,
    status: "active" as const,
    lastModified: mtime.toISOString(),
    dependencies: Object.keys((service as Record<string, unknown>)?.dependencies ?? {}),
  }));
}

/**
 * Determine project health based on validation results.
 * @param validation - CUE validation result
 * @param parseError - Optional parse error message
 * @returns Health status and detail message
 */
function determineHealth(
  validation: { valid: boolean; errors: string[] },
  parseError?: string,
): { health: ProjectStatus["health"]; details: string } {
  if (!validation.valid)
    return { health: "error", details: validation.errors[0] || "Validation failed" };
  if (parseError) return { health: "error", details: parseError };
  return { health: "healthy", details: "Specification valid" };
}

/**
 * Get project status from local specification files.
 * @param config - CLI configuration
 * @returns Promise resolving to ProjectStatus
 */
async function getLocalProjectStatus(config: Config): Promise<ProjectStatus> {
  const projectDir = config.projectDir || process.cwd();
  const assemblyPath = path.resolve(projectDir, ".arbiter", "assembly.cue");

  if (!(await fs.pathExists(assemblyPath))) return createEmptyStatus();

  const stats = await fs.stat(assemblyPath);
  const content = await fs.readFile(assemblyPath, "utf-8");
  const validation = await validateCUE(content);
  const { spec, error: parseError } = await parseSpecWithCleanup(content);

  const components = extractComponents(spec, stats.mtime);
  const { health, details } = determineHealth(validation, parseError);

  return {
    health,
    healthDetails: details,
    lastUpdated: stats.mtime.toISOString(),
    components,
    validations: {
      total: 1,
      passed: validation.valid ? 1 : 0,
      failed: validation.valid ? 0 : 1,
      warnings: 0,
    },
    specifications: [
      {
        path: path.relative(projectDir, assemblyPath) || "assembly.cue",
        valid: validation.valid && !parseError,
        errors: validation.valid ? 0 : validation.errors.length || 1,
        warnings: 0,
        lastValidated: new Date().toISOString(),
      },
    ],
  };
}

/**
 * Get colored status text for display.
 * @param status - Component status value
 * @returns Colored status string
 */
function getStatusText(status: "active" | "inactive" | "error"): string {
  const statusColors = { active: chalk.green, inactive: chalk.yellow, error: chalk.red };
  return statusColors[status](status);
}

/**
 * Display the project health header to the console.
 * @param status - Project status object
 */
function displayHealthHeader(status: ProjectStatus): void {
  const health = status.health ?? "degraded";
  console.log(
    `${getHealthIcon(health)} Project Health: ${getHealthColor(health)(health.toUpperCase())}`,
  );
  if (status.lastUpdated) {
    console.log(chalk.gray(`Last Updated: ${new Date(status.lastUpdated).toLocaleString()}`));
  }
  console.log();
}

/**
 * Display component list to the console.
 * @param components - Array of component status objects
 */
function displayComponents(components: NonNullable<ProjectStatus["components"]>): void {
  console.log(chalk.bold("Components:"));
  if (components.length === 0) {
    console.log(chalk.gray("  No components discovered"));
    return;
  }
  for (const c of components) {
    console.log(`  • ${c.type}: ${chalk.bold(c.name)} (${getStatusText(c.status)})`);
    if (c.lastModified) console.log(chalk.gray(`    Last modified: ${c.lastModified}`));
    if (c.dependencies?.length)
      console.log(chalk.gray(`    Dependencies: ${c.dependencies.join(", ")}`));
  }
}

/**
 * Display validation summary to the console.
 * @param v - Validation counts object
 */
function displayValidations(v: NonNullable<ProjectStatus["validations"]>): void {
  console.log(chalk.bold("Validations:"));
  console.log(`  Total: ${v.total}`);
  console.log(`  Passed: ${chalk.green(v.passed)}`);
  console.log(`  Failed: ${v.failed > 0 ? chalk.red(v.failed) : v.failed}`);
  console.log(`  Warnings: ${v.warnings > 0 ? chalk.yellow(v.warnings) : v.warnings}`);
}

/**
 * Display specification file list to the console.
 * @param specs - Array of specification status objects
 */
function displaySpecifications(specs: NonNullable<ProjectStatus["specifications"]>): void {
  console.log();
  console.log(chalk.bold("Specifications:"));
  for (const spec of specs) {
    console.log(`  • ${spec.path}: ${spec.valid ? chalk.green("valid") : chalk.red("invalid")}`);
    console.log(`    Errors: ${spec.errors}, Warnings: ${spec.warnings}`);
    if (spec.lastValidated) console.log(chalk.gray(`    Last validated: ${spec.lastValidated}`));
  }
}

/**
 * Display full status table to the console.
 * @param status - Project status object
 * @param detailed - Whether to include specification details
 */
function displayStatusTable(status: ProjectStatus, detailed: boolean): void {
  displayHealthHeader(status);
  displayComponents(status.components || []);
  console.log();
  displayValidations(status.validations || { total: 0, passed: 0, failed: 0, warnings: 0 });
  if (detailed && status.specifications?.length) displaySpecifications(status.specifications);
}

/** Mapping of health status to chalk colors. */
const HEALTH_COLORS: Record<string, typeof chalk.green> = {
  healthy: chalk.green,
  degraded: chalk.yellow,
  error: chalk.red,
};

/** Mapping of health status to display icons. */
const HEALTH_ICONS: Record<string, string> = {
  healthy: "✅",
  degraded: "⚠️",
  error: "❌",
};

/**
 * Get the chalk color function for a health status.
 * @param health - Health status value
 * @returns Chalk color function
 */
export function getHealthColor(health: ProjectStatus["health"]): typeof chalk.green {
  return HEALTH_COLORS[health] || chalk.gray;
}

/**
 * Get the display icon for a health status.
 * @param health - Health status value
 * @returns Unicode icon string
 */
export function getHealthIcon(health: ProjectStatus["health"]): string {
  return HEALTH_ICONS[health] || "ℹ️";
}

/**
 * Normalize a component from API response
 */
function normalizeComponent(component: any): ProjectStatus["components"][number] {
  return {
    type: component.type || "unknown",
    name: component.name || "unnamed",
    status: component.status || "degraded",
    lastModified: component.updatedAt,
    dependencies: component.dependencies || [],
  };
}

/**
 * Normalize a specification from API response
 */
function normalizeSpecification(spec: any): ProjectStatus["specifications"][number] {
  return {
    path: spec.path || "unknown",
    valid: Boolean(spec.valid),
    errors: spec.errors || 0,
    warnings: spec.warnings || 0,
    lastValidated: spec.lastValidated,
  };
}

/**
 * Build validations summary from specs or existing data
 */
function buildValidationsSummary(data: any, specs: any[]): ProjectStatus["validations"] {
  return (
    data?.validations || {
      total: specs.length,
      passed: specs.filter((s: any) => s.valid).length,
      failed: specs.filter((s: any) => !s.valid).length,
      warnings: 0,
    }
  );
}

/**
 * Normalize remote API response into ProjectStatus format.
 * @param data - Raw API response data
 * @param projectId - Optional project identifier
 * @returns Normalized ProjectStatus object
 */
export function normalizeRemoteProjectStatus(data: any, projectId?: string): ProjectStatus {
  const isValid = data?.status === "healthy";
  const components = Array.isArray(data?.components) ? data.components : [];
  const specs = Array.isArray(data?.specifications) ? data.specifications : [];

  return {
    health: isValid ? "healthy" : "degraded",
    healthDetails: data?.message || data?.error,
    lastUpdated: data?.timestamp || new Date().toISOString(),
    components: components.map(normalizeComponent),
    validations: buildValidationsSummary(data, specs),
    specifications: specs.map(normalizeSpecification),
  };
}

/**
 * Execute the status command.
 * @param options - Status command options
 * @param config - CLI configuration
 * @param injectedClient - Optional pre-created ApiClient (for testing)
 * @returns Exit code (0=healthy, 1=error, 2=command failure)
 */
export async function statusCommand(
  options: StatusOptions,
  config: Config,
  injectedClient?: ApiClient,
): Promise<number> {
  try {
    const status = await fetchProjectStatus(options, config, injectedClient);
    outputStatus(status, config.format, options.detailed ?? false);
    return status.health === "error" ? 1 : 0;
  } catch (error) {
    console.error(
      chalk.red("Status command failed:"),
      error instanceof Error ? error.message : String(error),
    );
    return 2;
  }
}

/**
 * Fetch project status from local or remote source.
 * @param options - Status command options
 * @param config - CLI configuration
 * @param injectedClient - Optional pre-created ApiClient (for testing)
 * @returns Promise resolving to ProjectStatus
 */
async function fetchProjectStatus(
  options: StatusOptions,
  config: Config,
  injectedClient?: ApiClient,
): Promise<ProjectStatus> {
  if (config.localMode) {
    return await getLocalProjectStatus(config);
  }
  return await fetchRemoteOrFallbackStatus(config, injectedClient);
}

/**
 * Fetch status from remote API with local fallback.
 * @param config - CLI configuration
 * @param injectedClient - Optional pre-created ApiClient (for testing)
 * @returns Promise resolving to ProjectStatus
 */
async function fetchRemoteOrFallbackStatus(
  config: Config,
  injectedClient?: ApiClient,
): Promise<ProjectStatus> {
  const structuredJson = config.format === "json";
  const client = injectedClient ?? new ApiClient(config);

  const result = structuredJson
    ? await client.getProjectStatus(config.projectId)
    : await withProgress({ text: "Getting project status..." }, () =>
        client.getProjectStatus(config.projectId),
      );

  if (!result.success) {
    return await handleRemoteStatusFailure(config, result.error, structuredJson);
  }

  return normalizeRemoteProjectStatus(result.data, config.projectId);
}

/**
 * Handle remote status failure by falling back to local.
 * @param config - CLI configuration
 * @param error - Error message from remote API
 * @param structuredJson - Whether output is JSON format
 * @returns Promise resolving to local ProjectStatus
 */
async function handleRemoteStatusFailure(
  config: Config,
  error: string | undefined,
  structuredJson: boolean,
): Promise<ProjectStatus> {
  if (!structuredJson) {
    console.error(chalk.red("Status check failed:"), error);
    console.log(chalk.yellow("Falling back to local specification status...\n"));
  }
  return await getLocalProjectStatus(config);
}

/**
 * Output project status in the specified format.
 * @param status - Project status object
 * @param format - Output format (json, yaml, or table)
 * @param detailed - Whether to include detailed information
 */
function outputStatus(status: ProjectStatus, format: string | undefined, detailed: boolean): void {
  switch (format) {
    case "json":
      console.log(JSON.stringify(status, null, 2));
      break;
    case "yaml":
      console.log(jsyaml.dump(status, { indent: 2 }));
      break;
    case "table":
    default:
      displayStatusTable(status, detailed);
      break;
  }
}

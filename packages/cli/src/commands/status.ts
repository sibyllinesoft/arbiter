import path from "node:path";
import chalk from "chalk";
import fs from "fs-extra";
import jsyaml from "js-yaml"; // Add if not installed: bun add js-yaml
import { ApiClient } from "../api-client.js";
import type { Config } from "../config.js";
import { getCueManipulator } from "../constraints/cli-integration.js";
import { validateCUE } from "../cue/index.js";
import { formatJson, formatStatusTable, formatYaml } from "../utils/formatting.js";
import { withProgress } from "../utils/progress.js";

export interface StatusOptions {
  detailed?: boolean;
}

interface ProjectStatus {
  health: "healthy" | "degraded" | "error";
  healthDetails?: string;
  lastUpdated?: string;
  components?: Array<{
    type: string;
    name: string;
    status: "active" | "inactive" | "error";
    lastModified?: string;
    dependencies?: string[];
  }>;
  validations?: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
  };
  specifications?: Array<{
    path: string;
    valid: boolean;
    errors: number;
    warnings: number;
    lastValidated?: string;
  }>;
}

async function getLocalProjectStatus(config: Config): Promise<ProjectStatus> {
  const assemblyPath = path.resolve(config.projectDir || process.cwd(), ".arbiter", "assembly.cue");

  if (!(await fs.pathExists(assemblyPath))) {
    return {
      health: "error",
      healthDetails: "Local specification not found",
      components: [],
      validations: { total: 0, passed: 0, failed: 0, warnings: 0 },
      specifications: [],
    };
  }

  const stats = await fs.stat(assemblyPath);
  const content = await fs.readFile(assemblyPath, "utf-8");
  const validation = await validateCUE(content);

  let parsedSpec: any = null;
  let parseError: string | undefined;
  const manipulator = getCueManipulator();
  try {
    parsedSpec = await manipulator.parse(content);
  } catch (error) {
    parseError = error instanceof Error ? error.message : String(error);
  } finally {
    await manipulator.cleanup();
  }

  const components =
    Object.entries(parsedSpec?.services ?? {}).map(([name, service]: [string, any]) => ({
      type: "service",
      name,
      status: "active" as const,
      lastModified: stats.mtime.toISOString(),
      dependencies: Object.keys(service?.dependencies ?? {}),
    })) ?? [];

  const health = validation.valid && !parseError ? "healthy" : "error";
  const healthDetails = !validation.valid
    ? validation.errors[0] || "Validation failed"
    : parseError
      ? parseError
      : "Specification valid";

  return {
    health,
    healthDetails,
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
        path: path.relative(config.projectDir || process.cwd(), assemblyPath) || "assembly.cue",
        valid: validation.valid && !parseError,
        errors: validation.valid ? 0 : validation.errors.length || 1,
        warnings: 0,
        lastValidated: new Date().toISOString(),
      },
    ],
  };
}

export async function statusCommand(options: StatusOptions, config: Config): Promise<number> {
  try {
    const structuredJson = config.format === "json";
    if (config.localMode) {
      const status = await getLocalProjectStatus(config);

      switch (config.format) {
        case "json":
          console.log(JSON.stringify(status, null, 2));
          break;
        case "yaml":
          console.log(jsyaml.dump(status, { indent: 2 }));
          break;
        case "table":
        default:
          displayStatusTable(status, options.detailed ?? false);
          break;
      }

      if (status.health === "error") {
        return 1;
      }
      return 0;
    }

    const client = new ApiClient(config);

    // Get project status with progress indicator
    const result = structuredJson
      ? await client.getProjectStatus(config.projectId)
      : await withProgress({ text: "Getting project status..." }, () =>
          client.getProjectStatus(config.projectId),
        );

    if (!result.success) {
      if (!structuredJson) {
        console.error(chalk.red("Status check failed:"), result.error);
        console.log(chalk.yellow("Falling back to local specification status...\n"));
      }
      const fallbackStatus = await getLocalProjectStatus(config);
      if (structuredJson) {
        console.log(JSON.stringify(fallbackStatus, null, 2));
      } else if (config.format === "yaml") {
        console.log(jsyaml.dump(fallbackStatus, { indent: 2 }));
      } else {
        displayStatusTable(fallbackStatus, options.detailed ?? false);
      }
      return fallbackStatus.health === "error" ? 1 : 0;
    }

    const status = normalizeRemoteProjectStatus(result.data, config.projectId);

    // Format and display results based on output format
    switch (config.format) {
      case "json":
        console.log(JSON.stringify(status, null, 2));
        break;
      case "yaml":
        console.log(jsyaml.dump(status, { indent: 2 }));
        break;
      case "table":
      default:
        displayStatusTable(status, options.detailed);
        break;
    }

    // Return appropriate exit code based on project health
    if (status.health === "error") {
      return 1;
    }

    return 0;
  } catch (error) {
    console.error(chalk.red("Status command failed:"), error.message);
    return 2;
  }
}

function displayStatusTable(status: ProjectStatus, detailed: boolean): void {
  // Project health header
  const normalizedHealth = status.health ?? "degraded";
  const healthColor = getHealthColor(normalizedHealth);
  const healthIcon = getHealthIcon(normalizedHealth);
  console.log(`${healthIcon} Project Health: ${healthColor(normalizedHealth.toUpperCase())}`);

  if (status.lastUpdated) {
    console.log(chalk.gray(`Last Updated: ${new Date(status.lastUpdated).toLocaleString()}`));
  }

  console.log(); // Empty line

  // Component summary
  if (status.components?.length) {
    console.log(chalk.bold("Components Summary:"));
    const componentSummary = summarizeComponents(status.components);
    console.log(formatStatusSummaryTable(componentSummary));
    console.log();
  }

  // Validation summary
  if (status.validations) {
    console.log(chalk.bold("Validation Summary:"));
    const validationSummary = {
      "Total Validations": status.validations.total || 0,
      Passed: chalk.green(`${status.validations.passed || 0}`),
      Failed:
        status.validations.failed > 0
          ? chalk.red(`${status.validations.failed}`)
          : `${status.validations.failed || 0}`,
      Warnings:
        status.validations.warnings > 0
          ? chalk.yellow(`${status.validations.warnings}`)
          : `${status.validations.warnings || 0}`,
    };
    console.log(formatStatusSummaryTable(validationSummary));
    console.log();
  }

  // Detailed view
  if (detailed) {
    if (status.specifications?.length) {
      console.log(chalk.bold("Specifications:"));
      const specRows = status.specifications.map((spec) => [
        spec.path || "unknown",
        spec.valid ? chalk.green("✓") : chalk.red("✗"),
        `${spec.errors || 0}`,
        `${spec.warnings || 0}`,
        spec.lastValidated ? new Date(spec.lastValidated).toLocaleDateString() : "never",
      ]);

      console.log(
        formatTable([["Path", "Valid", "Errors", "Warnings", "Last Validated"], ...specRows]),
      );
      console.log();
    }

    if (status.components?.length) {
      console.log(chalk.bold("Component Details:"));
      const componentRows = status.components.map((comp) => [
        comp.type || "unknown",
        comp.name || "unknown",
        getStatusIndicator(comp.status),
        comp.lastModified ? new Date(comp.lastModified).toLocaleDateString() : "unknown",
        (comp.dependencies || []).length.toString(),
      ]);

      console.log(
        formatTable([["Type", "Name", "Status", "Modified", "Dependencies"], ...componentRows]),
      );
    }
  }
}

function summarizeComponents(components: ProjectStatus["components"]): Record<string, any> {
  const summary: Record<string, any> = {};

  // Count by type
  const typeCounts: Record<string, number> = {};
  const statusCounts = { active: 0, inactive: 0, error: 0 };

  for (const comp of components) {
    const type = comp.type || "unknown";
    typeCounts[type] = (typeCounts[type] || 0) + 1;

    const status = comp.status || "unknown";
    if (status in statusCounts) {
      statusCounts[status as keyof typeof statusCounts]++;
    }
  }

  // Format counts for display
  Object.entries(typeCounts).forEach(([type, count]) => {
    summary[`${type}s`] = count;
  });

  summary["Total Components"] = components.length;
  summary["Active"] = chalk.green(`${statusCounts.active}`);
  summary["Inactive"] = chalk.yellow(`${statusCounts.inactive}`);
  summary["Errors"] =
    statusCounts.error > 0 ? chalk.red(`${statusCounts.error}`) : `${statusCounts.error}`;

  return summary;
}

function getHealthColor(health: string): (text: string) => string {
  switch (health) {
    case "healthy":
      return chalk.green;
    case "degraded":
      return chalk.yellow;
    case "error":
      return chalk.red;
    default:
      return chalk.gray;
  }
}

function getHealthIcon(health: string): string {
  switch (health) {
    case "healthy":
      return chalk.green("✓");
    case "degraded":
      return chalk.yellow("⚠");
    case "error":
      return chalk.red("✗");
    default:
      return chalk.gray("?");
  }
}

function getStatusIndicator(status: string): string {
  switch (status) {
    case "active":
      return chalk.green("●");
    case "inactive":
      return chalk.yellow("○");
    case "error":
      return chalk.red("●");
    default:
      return chalk.gray("?");
  }
}

/**
 * Format key-value summary object as a two-column table
 */
function formatStatusSummaryTable(summary: Record<string, any>): string {
  const headerRow: string[] = ["Metric", "Value"];
  const dataRows: string[][] = Object.entries(summary).map(([key, value]) => [key, String(value)]);

  // Calculate widths considering ANSI codes
  const allRows = [headerRow, ...dataRows];
  const widths = headerRow.map((_, i) =>
    Math.max(...allRows.map((row) => stripAnsi(row[i] || "").length)),
  );

  let output = allRows
    .map((row, idx) => {
      const formattedRow = row
        .map((cell, colIdx) => {
          const content = cell || "";
          const padding = widths[colIdx] - stripAnsi(content).length;
          return content + " ".repeat(Math.max(0, padding));
        })
        .join("  ");

      if (idx === 0) {
        const separator = widths.map((w) => "─".repeat(w)).join("  ");
        return formattedRow + "\n" + separator;
      }
      return formattedRow;
    })
    .join("\n");

  return output;
}

// Simple table formatter for status command
function formatTable(rows: string[][]): string {
  if (rows.length === 0) return "";

  // Calculate column widths
  const widths = rows[0].map((_, colIndex) =>
    Math.max(...rows.map((row) => stripAnsi(row[colIndex] || "").length)),
  );

  return rows
    .map((row, rowIndex) => {
      const formattedRow = row
        .map((cell, colIndex) => {
          const content = cell || "";
          const padding = widths[colIndex] - stripAnsi(content).length;
          return content + " ".repeat(Math.max(0, padding));
        })
        .join("  ");

      // Add separator after header
      if (rowIndex === 0) {
        const separator = widths.map((width) => "─".repeat(width)).join("  ");
        return formattedRow + "\n" + separator;
      }

      return formattedRow;
    })
    .join("\n");
}

// Helper to strip ANSI codes for length calculation
function stripAnsi(text: string): string {
  return text.replace(/\u001b\[[0-9;]*m/g, "");
}

function extractDependencyNames(input: unknown): string[] {
  if (!input) {
    return [];
  }

  if (Array.isArray(input)) {
    return input.map((entry) => String(entry));
  }

  if (typeof input === "object") {
    return Object.entries(input as Record<string, { service?: string; version?: string }>).map(
      ([alias, spec]) => {
        if (spec && typeof spec === "object" && typeof spec.service === "string") {
          const version = spec.version ? ` (${spec.version})` : "";
          return `${alias}: ${spec.service}${version}`;
        }
        return alias;
      },
    );
  }

  return [];
}

function normalizeRemoteProjectStatus(payload: any, projectId?: string): ProjectStatus {
  if (!payload || typeof payload !== "object") {
    return buildFallbackStatus("Remote status payload was empty");
  }

  const resolvedRoot = payload.resolved ?? payload;
  const project = resolvedRoot.project ?? payload.project ?? null;
  const services = resolvedRoot.services;
  const lastUpdated =
    project?.lastActivity ??
    project?.updatedAt ??
    resolvedRoot.updatedAt ??
    resolvedRoot.timestamp ??
    null;

  const components: ProjectStatus["components"] = [];

  if (services && typeof services === "object") {
    for (const [serviceName, serviceSpec] of Object.entries<any>(services)) {
      const dependencyList = [
        serviceSpec?.dependencies,
        serviceSpec?.metadata?.dependencies,
        serviceSpec?.metadata?.depends_on,
      ];
      const dependencyNames = Array.from(
        new Set(dependencyList.flatMap((entry) => extractDependencyNames(entry))),
      );
      components.push({
        type: "service",
        name: serviceName,
        status: "active",
        lastModified: project?.lastActivity ?? new Date().toISOString(),
        dependencies: dependencyNames,
      });
    }
  }

  const entityCounts = project?.entities ?? {};
  const health = components.length > 0 || (entityCounts.services ?? 0) > 0 ? "healthy" : "degraded";

  return {
    health,
    healthDetails:
      components.length > 0
        ? `Detected ${components.length} services and ${entityCounts.databases ?? 0} databases in ${
            project?.name ?? projectId ?? "project"
          }.`
        : "Remote project responded without service metadata.",
    lastUpdated: lastUpdated ?? undefined,
    components,
    validations: {
      total: 0,
      passed: 0,
      failed: 0,
      warnings: 0,
    },
    specifications: [],
  };
}

function buildFallbackStatus(reason: string): ProjectStatus {
  return {
    health: "degraded",
    healthDetails: reason,
    components: [],
    validations: { total: 0, passed: 0, failed: 0, warnings: 0 },
    specifications: [],
  };
}

// Remove unused import once formatting.js is handled separately if needed
// Note: If js-yaml not installed, remove yaml case or install via bun add js-yaml

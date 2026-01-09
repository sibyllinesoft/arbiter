import type { ValidationResult } from "@/types.js";
import chalk from "chalk";
import Table from "cli-table3";
import yaml from "yaml";

/**
 * Format a small table using cli-table3 with optional header coloring.
 * Returns a dimmed message when there is no data to show.
 */
export function formatTable(
  headers: string[],
  rows: string[][],
  headerColor: (value: string) => string = chalk.cyan,
): string {
  if (rows.length === 0) {
    return chalk.dim("No data to display");
  }

  const table = new Table({
    head: headers.map((header) => headerColor(header)),
    style: {
      head: [],
      border: ["dim"],
    },
  });

  rows.forEach((row) => {
    table.push(row);
  });

  return table.toString();
}

/**
 * Format validation results as a pretty table
 */
export function formatValidationTable(results: ValidationResult[]): string {
  if (results.length === 0) {
    return chalk.green("✓ No files to validate");
  }

  const table = new Table({
    head: [
      chalk.cyan("File"),
      chalk.cyan("Status"),
      chalk.cyan("Errors"),
      chalk.cyan("Warnings"),
      chalk.cyan("Time (ms)"),
    ],
    style: {
      head: [],
      border: ["dim"],
    },
  });

  results.forEach((result) => {
    const statusColor =
      result.status === "valid" ? "green" : result.status === "invalid" ? "red" : "yellow";
    const statusSymbol = result.status === "valid" ? "✓" : result.status === "invalid" ? "✗" : "!";

    table.push([
      result.file,
      chalk[statusColor](`${statusSymbol} ${result.status}`),
      result.errors.length > 0 ? chalk.red(result.errors.length.toString()) : chalk.dim("0"),
      result.warnings.length > 0 ? chalk.yellow(result.warnings.length.toString()) : chalk.dim("0"),
      formatTime(result.processingTime),
    ]);
  });

  return table.toString();
}

/**
 * Format detailed error information
 */
export function formatErrorDetails(results: ValidationResult[]): string {
  const errorResults = results.filter((r) => r.errors.length > 0);

  if (errorResults.length === 0) {
    return "";
  }

  let output = `\n${chalk.red.bold("Validation Errors:")}\n`;

  errorResults.forEach((result) => {
    output += `\n${chalk.underline(result.file)}:\n`;

    result.errors.forEach((error) => {
      const location = `${error.line}:${error.column}`;
      const category = chalk.dim(`[${error.category}]`);
      output += `  ${chalk.red("error")} ${category} ${location} ${error.message}\n`;
    });
  });

  return output;
}

/**
 * Format warning information
 */
export function formatWarningDetails(results: ValidationResult[]): string {
  const warningResults = results.filter((r) => r.warnings.length > 0);

  if (warningResults.length === 0) {
    return "";
  }

  let output = `\n${chalk.yellow.bold("Validation Warnings:")}\n`;

  warningResults.forEach((result) => {
    output += `\n${chalk.underline(result.file)}:\n`;

    result.warnings.forEach((warning) => {
      const location = `${warning.line}:${warning.column}`;
      const category = chalk.dim(`[${warning.category}]`);
      output += `  ${chalk.yellow("warning")} ${category} ${location} ${warning.message}\n`;
    });
  });

  return output;
}

/**
 * Calculate summary statistics from validation results
 */
function calculateSummaryStats(results: ValidationResult[]): {
  valid: number;
  invalid: number;
  errors: number;
  totalErrors: number;
  totalWarnings: number;
  totalTime: number;
} {
  return {
    valid: results.filter((r) => r.status === "valid").length,
    invalid: results.filter((r) => r.status === "invalid").length,
    errors: results.filter((r) => r.status === "error").length,
    totalErrors: results.reduce((sum, r) => sum + r.errors.length, 0),
    totalWarnings: results.reduce((sum, r) => sum + r.warnings.length, 0),
    totalTime: results.reduce((sum, r) => sum + r.processingTime, 0),
  };
}

/**
 * Build the status counts portion of summary
 */
function buildStatusSummary(valid: number, invalid: number, errors: number): string {
  const parts: string[] = [];
  if (valid > 0) parts.push(chalk.green(`${valid} valid`));
  if (invalid > 0) parts.push(chalk.red(`${invalid} invalid`));
  if (errors > 0) parts.push(chalk.yellow(`${errors} errors`));
  return parts.join(", ");
}

/**
 * Build the issues portion of summary
 */
function buildIssuesSummary(totalErrors: number, totalWarnings: number): string {
  const parts: string[] = [];
  if (totalErrors > 0) parts.push(chalk.red(`${totalErrors} errors`));
  if (totalWarnings > 0) parts.push(chalk.yellow(`${totalWarnings} warnings`));
  return parts.length > 0 ? `\n${parts.join(", ")}` : "";
}

/**
 * Format summary statistics
 */
export function formatSummary(results: ValidationResult[]): string {
  if (results.length === 0) {
    return chalk.dim("No files processed");
  }

  const stats = calculateSummaryStats(results);
  const statusSummary = buildStatusSummary(stats.valid, stats.invalid, stats.errors);
  const issuesSummary = buildIssuesSummary(stats.totalErrors, stats.totalWarnings);

  return [
    `\n${chalk.bold("Summary:")} ${statusSummary} (${results.length} total)`,
    issuesSummary,
    `\nProcessed in ${formatTime(stats.totalTime)}`,
  ].join("");
}

/**
 * Format time in milliseconds with appropriate units
 */
export function formatTime(ms: number): string {
  if (ms < 1000) {
    return chalk.dim(`${ms}ms`);
  }
  if (ms < 60000) {
    return chalk.dim(`${(ms / 1000).toFixed(2)}s`);
  }
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(0);
  return chalk.dim(`${minutes}m ${seconds}s`);
}

/**
 * Format JSON output with colors
 */
export function formatJson(data: any, color = true): string {
  const json = JSON.stringify(data, null, 2);

  if (!color) {
    return json;
  }

  // Basic JSON syntax highlighting
  return json
    .replace(/(".*?")\s*:/g, (_, key) => `${chalk.blue(key)}:`)
    .replace(/:\s*(".*?")/g, (_, value) => `: ${chalk.green(value)}`)
    .replace(/:\s*(true|false|null)/g, (_, value) => `: ${chalk.yellow(value)}`)
    .replace(/:\s*(\d+\.?\d*)/g, (_, value) => `: ${chalk.magenta(value)}`);
}

/**
 * Format file size in human readable format
 */
export function formatFileSize(bytes: number): string {
  const sizes = ["B", "KB", "MB", "GB"];
  if (bytes === 0) return "0 B";

  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = (bytes / 1024 ** i).toFixed(1);

  return chalk.dim(`${size} ${sizes[i]}`);
}

/**
 * Create a textual progress bar representation
 */
export function createTextProgressBar(current: number, total: number, width = 40): string {
  const percentage = Math.round((current / total) * 100);
  const filled = Math.round((current / total) * width);
  const empty = width - filled;

  const bar = "█".repeat(filled) + "░".repeat(empty);

  return `${chalk.cyan(bar)} ${chalk.bold(`${percentage}%`)} (${current}/${total})`;
}

/**
 * Format exit code message
 */
export function formatExitMessage(exitCode: number, operation: string): string {
  switch (exitCode) {
    case 0:
      return chalk.green(`✓ ${operation} completed successfully`);
    case 1:
      return chalk.red(`✗ ${operation} failed with validation errors`);
    case 2:
      return chalk.red(`✗ ${operation} failed with system errors`);
    default:
      return chalk.red(`✗ ${operation} failed with unknown error (exit code: ${exitCode})`);
  }
}

/**
 * Format data as a table with headers and rows
 */
export function formatYaml(data: any, color = true): string {
  const yamlString = yaml.stringify(data, {
    indent: 2,
    lineWidth: 0,
  });

  if (!color) {
    return yamlString;
  }

  // Basic YAML syntax highlighting
  return yamlString
    .replace(/^(\s*)([^:\s]+):/gm, (_, indent, key) => `${indent}${chalk.blue(key)}:`)
    .replace(/:\s*(["`'].*["`'])/g, (_, value) => `: ${chalk.green(value)}`)
    .replace(/:\s*(true|false|null)/g, (_, value) => `: ${chalk.yellow(value)}`)
    .replace(/:\s*(\d+\.?\d*)/g, (_, value) => `: ${chalk.magenta(value)}`);
}

/**
 * Format components as a table
 */
export function formatComponentTable(components: any[]): string {
  if (components.length === 0) {
    return chalk.dim("No components found");
  }

  const table = new Table({
    head: [chalk.cyan("Name"), chalk.cyan("Type"), chalk.cyan("Status"), chalk.cyan("Description")],
    style: {
      head: [],
      border: ["dim"],
    },
  });

  components.forEach((component) => {
    const statusColor =
      component.status === "active" ? "green" : component.status === "inactive" ? "red" : "yellow";
    const statusSymbol =
      component.status === "active" ? "●" : component.status === "inactive" ? "○" : "◐";

    table.push([
      component.name || "",
      chalk.cyan(component.type || ""),
      chalk[statusColor](`${statusSymbol} ${component.status || "unknown"}`),
      chalk.dim(component.description || ""),
    ]);
  });

  return table.toString();
}

type StatusColorKey = "healthy" | "unhealthy" | "valid" | "invalid" | string;

/** Mapping of status keys to chalk colors. */
const STATUS_COLORS: Record<StatusColorKey, "green" | "red" | "yellow"> = {
  healthy: "green",
  valid: "green",
  unhealthy: "red",
  invalid: "red",
};

/** Mapping of status keys to display symbols. */
const STATUS_SYMBOLS: Record<StatusColorKey, string> = {
  healthy: "✓",
  valid: "✓",
  unhealthy: "✗",
  invalid: "✗",
};

/**
 * Get the chalk color for a status.
 * @param status - Status key
 * @returns Chalk color name
 */
function getStatusColor(status: StatusColorKey): "green" | "red" | "yellow" {
  return STATUS_COLORS[status] || "yellow";
}

/**
 * Get the display symbol for a status.
 * @param status - Status key
 * @returns Unicode symbol string
 */
function getStatusSymbol(status: StatusColorKey): string {
  return STATUS_SYMBOLS[status] || "!";
}

/**
 * Format component status counts for display.
 * @param components - Array of components with status
 * @returns Object with formatted text and count
 */
function formatComponentStatus(components: Array<{ status?: string }>): {
  text: string;
  count: string;
} {
  /** Count of active components. */
  const activeCount = components.filter((c) => c.status === "active").length;
  const totalCount = components.length;
  const text =
    activeCount === totalCount
      ? "All Active"
      : activeCount === 0
        ? "None Active"
        : `${activeCount}/${totalCount} Active`;
  return { text, count: `${totalCount} total components` };
}

/**
 * Create a new status table with standard headers.
 * @returns Configured table instance
 */
function createStatusTable(): Table.Table {
  return new Table({
    head: [chalk.cyan("Category"), chalk.cyan("Status"), chalk.cyan("Details")],
    style: { head: [], border: ["dim"] },
  });
}

/**
 * Format project status as a table
 */
export function formatStatusTable(status: Record<string, unknown>): string {
  const table = createStatusTable();
  const health = (status.health as string) || "unknown";

  table.push([
    "Health",
    chalk[getStatusColor(health)](`${getStatusSymbol(health)} ${health}`),
    chalk.dim((status.healthDetails as string) || ""),
  ]);

  if (status.components) {
    const { text, count } = formatComponentStatus(status.components as Array<{ status?: string }>);
    table.push(["Components", chalk.cyan(text), chalk.dim(count)]);
  }

  if (status.validation) {
    const validation = status.validation as { status?: string; summary?: string };
    const valStatus = validation.status || "unknown";
    table.push([
      "Validation",
      chalk[getStatusColor(valStatus)](`${getStatusSymbol(valStatus)} ${valStatus}`),
      chalk.dim(validation.summary || ""),
    ]);
  }

  return table.toString();
}

import chalk from "chalk";
import Table from "cli-table3";
import yaml from "yaml";
import type { ValidationResult } from "../types.js";

/**
 * Format a small table without external dependencies
 */
export function formatTable(
  headers: string[],
  rows: string[][],
  headerColor: (value: string) => string = chalk.cyan,
): string {
  const table = [headers, ...rows];
  const colWidths = headers.map((_, colIndex) =>
    Math.max(...table.map((row) => (row[colIndex] || "").length)),
  );

  const formatRow = (row: string[], isHeader = false) => {
    const formattedCells = row.map((cell, idx) => (cell || "").padEnd(colWidths[idx])).join(" | ");
    return isHeader ? headerColor(formattedCells) : formattedCells;
  };

  const lines = [
    formatRow(headers, true),
    colWidths.map((w) => "-".repeat(w)).join("-|-"),
    ...rows.map((row) => formatRow(row)),
  ];

  return lines.join("\n");
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
 * Format summary statistics
 */
export function formatSummary(results: ValidationResult[]): string {
  if (results.length === 0) {
    return chalk.dim("No files processed");
  }

  const valid = results.filter((r) => r.status === "valid").length;
  const invalid = results.filter((r) => r.status === "invalid").length;
  const errors = results.filter((r) => r.status === "error").length;

  const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);
  const totalWarnings = results.reduce((sum, r) => sum + r.warnings.length, 0);
  const totalTime = results.reduce((sum, r) => sum + r.processingTime, 0);

  let summary = `\n${chalk.bold("Summary:")} `;

  if (valid > 0) {
    summary += chalk.green(`${valid} valid`);
  }

  if (invalid > 0) {
    if (valid > 0) summary += ", ";
    summary += chalk.red(`${invalid} invalid`);
  }

  if (errors > 0) {
    if (valid > 0 || invalid > 0) summary += ", ";
    summary += chalk.yellow(`${errors} errors`);
  }

  summary += ` (${results.length} total)`;

  if (totalErrors > 0) {
    summary += `\n${chalk.red(`${totalErrors} errors`)}`;
  }

  if (totalWarnings > 0) {
    summary += `${totalErrors > 0 ? ", " : "\n"}${chalk.yellow(`${totalWarnings} warnings`)}`;
  }

  summary += `\nProcessed in ${formatTime(totalTime)}`;

  return summary;
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
export function formatTable(headers: string[], rows: string[][]): string {
  if (rows.length === 0) {
    return chalk.dim("No data to display");
  }

  const table = new Table({
    head: headers.map((header) => chalk.cyan(header)),
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
 * Format YAML output with colors
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

/**
 * Format project status as a table
 */
export function formatStatusTable(status: any): string {
  const table = new Table({
    head: [chalk.cyan("Category"), chalk.cyan("Status"), chalk.cyan("Details")],
    style: {
      head: [],
      border: ["dim"],
    },
  });

  // Health status
  const healthColor =
    status.health === "healthy" ? "green" : status.health === "unhealthy" ? "red" : "yellow";
  const healthSymbol =
    status.health === "healthy" ? "✓" : status.health === "unhealthy" ? "✗" : "!";

  table.push([
    "Health",
    chalk[healthColor](`${healthSymbol} ${status.health || "unknown"}`),
    chalk.dim(status.healthDetails || ""),
  ]);

  // Components
  if (status.components) {
    const activeCount = status.components.filter((c: any) => c.status === "active").length;
    const totalCount = status.components.length;
    const componentStatus =
      activeCount === totalCount
        ? "All Active"
        : activeCount === 0
          ? "None Active"
          : `${activeCount}/${totalCount} Active`;

    table.push([
      "Components",
      chalk.cyan(componentStatus),
      chalk.dim(`${totalCount} total components`),
    ]);
  }

  // Validation
  if (status.validation) {
    const validationColor =
      status.validation.status === "valid"
        ? "green"
        : status.validation.status === "invalid"
          ? "red"
          : "yellow";
    const validationSymbol =
      status.validation.status === "valid"
        ? "✓"
        : status.validation.status === "invalid"
          ? "✗"
          : "!";

    table.push([
      "Validation",
      chalk[validationColor](`${validationSymbol} ${status.validation.status || "unknown"}`),
      chalk.dim(status.validation.summary || ""),
    ]);
  }

  return table.toString();
}

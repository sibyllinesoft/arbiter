import chalk from "chalk";
import Table from "cli-table3";
import type { ValidationResult } from "../types.js";

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
  } else if (ms < 60000) {
    return chalk.dim(`${(ms / 1000).toFixed(2)}s`);
  } else {
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(0);
    return chalk.dim(`${minutes}m ${seconds}s`);
  }
}

/**
 * Format JSON output with colors
 */
export function formatJson(data: any, color: boolean = true): string {
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
 * Create a progress bar representation
 */
export function createProgressBar(current: number, total: number, width: number = 40): string {
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

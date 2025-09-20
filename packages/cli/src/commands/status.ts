import chalk from 'chalk';
import { ApiClient } from '../api-client.js';
import type { CLIConfig } from '../config.js';
import { formatJson, formatStatusTable, formatYaml } from '../utils/formatting.js';
import { withProgress } from '../utils/progress.js';

export interface StatusOptions {
  detailed?: boolean;
}

export async function statusCommand(options: StatusOptions, config: CLIConfig): Promise<number> {
  try {
    const client = new ApiClient(config);

    // Get project status with progress indicator
    const result = await withProgress('Getting project status...', () => client.getProjectStatus());

    if (!result.success) {
      console.error(chalk.red('Status check failed:'), result.error);
      return 1;
    }

    const status = result.data;

    // Format and display results based on output format
    switch (config.format) {
      case 'json':
        console.log(formatJson(status));
        break;
      case 'yaml':
        console.log(formatYaml(status));
        break;
      case 'table':
      default:
        displayStatusTable(status, options.detailed || config.verbose);
        break;
    }

    // Return appropriate exit code based on project health
    if (status.health === 'error') {
      return 1;
    } else if (status.health === 'degraded') {
      return 0; // Still successful, just with warnings
    }

    return 0;
  } catch (error) {
    console.error(chalk.red('Status command failed:'), error.message);
    return 2;
  }
}

function displayStatusTable(status: any, detailed: boolean): void {
  // Project health header
  const healthColor = getHealthColor(status.health);
  const healthIcon = getHealthIcon(status.health);
  console.log(`${healthIcon} Project Health: ${healthColor(status.health.toUpperCase())}`);

  if (status.lastUpdated) {
    console.log(chalk.gray(`Last Updated: ${new Date(status.lastUpdated).toLocaleString()}`));
  }

  console.log(); // Empty line

  // Component summary
  if (status.components && Array.isArray(status.components)) {
    console.log(chalk.bold('Components Summary:'));
    const componentSummary = summarizeComponents(status.components);
    console.log(formatStatusTable(componentSummary));
    console.log();
  }

  // Validation summary
  if (status.validations) {
    console.log(chalk.bold('Validation Summary:'));
    const validationSummary = {
      'Total Validations': status.validations.total || 0,
      Passed: chalk.green(status.validations.passed || 0),
      Failed:
        status.validations.failed > 0
          ? chalk.red(status.validations.failed)
          : status.validations.failed || 0,
      Warnings:
        status.validations.warnings > 0
          ? chalk.yellow(status.validations.warnings)
          : status.validations.warnings || 0,
    };
    console.log(formatStatusTable(validationSummary));
    console.log();
  }

  // Detailed view
  if (detailed) {
    if (status.specifications && Array.isArray(status.specifications)) {
      console.log(chalk.bold('Specifications:'));
      const specRows = status.specifications.map((spec: any) => [
        spec.path || 'unknown',
        spec.valid ? chalk.green('✓') : chalk.red('✗'),
        spec.errors || 0,
        spec.warnings || 0,
        spec.lastValidated ? new Date(spec.lastValidated).toLocaleDateString() : 'never',
      ]);

      console.log(
        formatTable([['Path', 'Valid', 'Errors', 'Warnings', 'Last Validated'], ...specRows])
      );
      console.log();
    }

    if (status.components && Array.isArray(status.components)) {
      console.log(chalk.bold('Component Details:'));
      const componentRows = status.components.map((comp: any) => [
        comp.type || 'unknown',
        comp.name || 'unknown',
        getStatusIndicator(comp.status),
        comp.lastModified ? new Date(comp.lastModified).toLocaleDateString() : 'unknown',
        (comp.dependencies || []).length.toString(),
      ]);

      console.log(
        formatTable([['Type', 'Name', 'Status', 'Modified', 'Dependencies'], ...componentRows])
      );
    }
  }
}

function summarizeComponents(components: any[]): Record<string, any> {
  const summary: Record<string, any> = {};

  // Count by type
  const typeCounts: Record<string, number> = {};
  const statusCounts = { active: 0, inactive: 0, error: 0 };

  for (const comp of components) {
    const type = comp.type || 'unknown';
    typeCounts[type] = (typeCounts[type] || 0) + 1;

    const status = comp.status || 'unknown';
    if (status in statusCounts) {
      statusCounts[status as keyof typeof statusCounts]++;
    }
  }

  // Format counts for display
  Object.entries(typeCounts).forEach(([type, count]) => {
    summary[`${type}s`] = count;
  });

  summary['Total Components'] = components.length;
  summary['Active'] = chalk.green(statusCounts.active);
  summary['Inactive'] = chalk.yellow(statusCounts.inactive);
  summary['Errors'] = statusCounts.error > 0 ? chalk.red(statusCounts.error) : statusCounts.error;

  return summary;
}

function getHealthColor(health: string): (text: string) => string {
  switch (health) {
    case 'healthy':
      return chalk.green;
    case 'degraded':
      return chalk.yellow;
    case 'error':
      return chalk.red;
    default:
      return chalk.gray;
  }
}

function getHealthIcon(health: string): string {
  switch (health) {
    case 'healthy':
      return chalk.green('✓');
    case 'degraded':
      return chalk.yellow('⚠');
    case 'error':
      return chalk.red('✗');
    default:
      return chalk.gray('?');
  }
}

function getStatusIndicator(status: string): string {
  switch (status) {
    case 'active':
      return chalk.green('●');
    case 'inactive':
      return chalk.yellow('○');
    case 'error':
      return chalk.red('●');
    default:
      return chalk.gray('?');
  }
}

// Simple table formatter for status command
function formatTable(rows: string[][]): string {
  if (rows.length === 0) return '';

  // Calculate column widths
  const widths = rows[0].map((_, colIndex) =>
    Math.max(...rows.map(row => stripAnsi(row[colIndex] || '').length))
  );

  return rows
    .map((row, rowIndex) => {
      const formattedRow = row
        .map((cell, colIndex) => {
          const content = cell || '';
          const padding = widths[colIndex] - stripAnsi(content).length;
          return content + ' '.repeat(Math.max(0, padding));
        })
        .join('  ');

      // Add separator after header
      if (rowIndex === 0) {
        const separator = widths.map(width => '─'.repeat(width)).join('  ');
        return formattedRow + '\n' + separator;
      }

      return formattedRow;
    })
    .join('\n');
}

// Helper to strip ANSI codes for length calculation
function stripAnsi(text: string): string {
  return text.replace(/\u001b\[[0-9;]*m/g, '');
}

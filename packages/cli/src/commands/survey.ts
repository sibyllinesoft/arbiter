/**
 * Survey command implementation
 *
 * Provides commands for interacting with skald survey data:
 * - View usage reports
 * - Query survey data
 * - Health check
 * - Configuration management
 */

import chalk from "chalk";
import Table from "cli-table3";
import type { Config } from "../types.js";
import {
  cleanupSurveyData,
  getSkaldIntegration,
  getSurveyReport,
} from "../utils/skald-integration.js";

/**
 * Survey command options
 */
export interface SurveyOptions {
  command?: "report" | "query" | "health" | "cleanup" | "config" | "enable" | "disable";
  limit?: number;
  format?: "table" | "json" | "text";
  verbose?: boolean;
  days?: number;
}

/**
 * Show survey usage report
 */
export async function showSurveyReport(options: SurveyOptions): Promise<void> {
  console.log(chalk.cyan("\n📊 Generating skald survey report...\n"));

  try {
    const report = await getSurveyReport();

    if (options.format === "json") {
      const skald = getSkaldIntegration();
      const data = await skald.querySurveyData(options.limit || 100);
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.log(report);
    }
  } catch (error) {
    console.error(chalk.red("Failed to generate survey report:"), error);
  }
}

/**
 * Query survey data
 */
export async function querySurveyData(options: SurveyOptions): Promise<void> {
  console.log(chalk.cyan("\n📋 Querying survey data...\n"));

  try {
    const skald = getSkaldIntegration();
    const data = await skald.querySurveyData(options.limit || 50);

    if (options.format === "json") {
      console.log(JSON.stringify(data, null, 2));
      return;
    }

    if (data.length === 0) {
      console.log(chalk.gray("No survey data available yet."));
      console.log(chalk.dim("Run some arbiter commands to collect survey data."));
      return;
    }

    // Display as table
    const table = new Table({
      head: [
        chalk.cyan("Tool"),
        chalk.cyan("Status"),
        chalk.cyan("Latency"),
        chalk.cyan("Timestamp"),
        chalk.cyan("Feedback"),
      ],
      colWidths: [25, 10, 12, 20, 30],
    });

    for (const item of data.slice(0, options.limit || 20)) {
      const statusColor = item.status === "success" ? chalk.green : chalk.red;
      const feedbackText = item.feedback
        ? `${item.feedback.helpfulness}/5 (${(item.feedback.confidence * 100).toFixed(0)}%)`
        : chalk.gray("No feedback");

      table.push([
        item.tool_name,
        statusColor(item.status),
        `${item.latency_ms.toFixed(0)}ms`,
        new Date(item.timestamp).toLocaleString(),
        feedbackText,
      ]);
    }

    console.log(table.toString());

    if (options.verbose && data.length > 0) {
      console.log(
        chalk.dim(
          `\nShowing ${Math.min(data.length, options.limit || 20)} of ${data.length} entries`,
        ),
      );
    }
  } catch (error) {
    console.error(chalk.red("Failed to query survey data:"), error);
  }
}

/**
 * Check survey system health
 */
export async function checkSurveyHealth(options: SurveyOptions): Promise<void> {
  console.log(chalk.cyan("\n🔍 Checking survey system health...\n"));

  try {
    const skald = getSkaldIntegration();
    const status = skald.getStatus();
    const healthy = await checkSurveyHealth();

    console.log(chalk.bold("Survey System Status:"));
    console.log(`  Enabled: ${status.enabled ? chalk.green("✓") : chalk.red("✗")}`);
    console.log(
      `  Skald Library: ${healthy ? chalk.green("✓ Available") : chalk.red("✗ Not found")}`,
    );
    console.log(`  Storage: ${status.storePath}`);
    console.log(`  Active Executions: ${status.activeExecutions}`);

    if (options.verbose) {
      console.log("\nConfiguration:");
      console.log(`  Store Path: ${status.config.storePath}`);
      console.log(
        `  Max Verbosity: ${status.config.maxVerbosity ? chalk.green("✓") : chalk.red("✗")}`,
      );
      console.log(
        `  Always Report: ${status.config.alwaysReport ? chalk.green("✓") : chalk.red("✗")}`,
      );
      console.log(`  Sample Rate: ${(status.config.sampleNeutral * 100).toFixed(0)}%`);
      console.log(`  TTL Hours: ${status.config.ttlHours}`);
      console.log("\nInvite Policy:");
      console.log(
        `  On Error: ${status.config.invitePolicy.error ? chalk.green("✓") : chalk.red("✗")}`,
      );
      console.log(
        `  On Timeout: ${status.config.invitePolicy.timeout ? chalk.green("✓") : chalk.red("✗")}`,
      );
      console.log(`  Latency Threshold: ${status.config.invitePolicy.p95_ms}ms`);
      console.log(`  Output Size Threshold: ${status.config.invitePolicy.large_output_kb}KB`);
    }

    console.log(
      `\nOverall Status: ${healthy && status.enabled ? chalk.green("✅ Healthy") : chalk.yellow("⚠️  Issues detected")}`,
    );
  } catch (error) {
    console.error(chalk.red("Health check failed:"), error);
  }
}

/**
 * Cleanup old survey data
 */
export async function cleanupSurvey(_options: SurveyOptions): Promise<void> {
  console.log(chalk.cyan("\n🧹 Cleaning up old survey data...\n"));

  try {
    const cleaned = await cleanupSurveyData();

    if (cleaned > 0) {
      console.log(chalk.green(`✅ Cleaned up ${cleaned} expired records`));
    } else {
      console.log(chalk.gray("No expired records found to clean up"));
    }
  } catch (error) {
    console.error(chalk.red("Cleanup failed:"), error);
  }
}

/**
 * Manage survey configuration
 */
export async function manageSurveyConfig(
  action: "enable" | "disable" | "config",
  options: SurveyOptions,
): Promise<void> {
  try {
    const skald = getSkaldIntegration();

    switch (action) {
      case "enable":
        skald.setEnabled(true);
        console.log(chalk.green("✅ Survey collection enabled"));
        break;

      case "disable":
        skald.setEnabled(false);
        console.log(chalk.gray("❌ Survey collection disabled"));
        break;

      case "config": {
        const status = skald.getStatus();
        if (options.format === "json") {
          console.log(JSON.stringify(status.config, null, 2));
        } else {
          console.log(chalk.cyan("\n📋 Survey Configuration:\n"));
          console.log(`Enabled: ${status.config.enabled}`);
          console.log(`Store Path: ${status.config.storePath}`);
          console.log(`Max Verbosity: ${status.config.maxVerbosity}`);
          console.log(`Always Report: ${status.config.alwaysReport}`);
          console.log(`Sample Rate: ${(status.config.sampleNeutral * 100).toFixed(0)}%`);
          console.log(`TTL Hours: ${status.config.ttlHours}`);
          console.log("\nInvite Policy:");
          console.log(`  Error: ${status.config.invitePolicy.error}`);
          console.log(`  Timeout: ${status.config.invitePolicy.timeout}`);
          console.log(`  P95 Latency Threshold: ${status.config.invitePolicy.p95_ms}ms`);
          console.log(`  Large Output Threshold: ${status.config.invitePolicy.large_output_kb}KB`);
        }
        break;
      }
    }
  } catch (error) {
    console.error(chalk.red(`Failed to ${action} survey:`, error));
  }
}

/**
 * Main survey command dispatcher
 */
export async function surveyCommand(options: SurveyOptions, _config: Config): Promise<number> {
  const subcommand = options.command || "report";

  try {
    switch (subcommand) {
      case "report":
        await showSurveyReport(options);
        break;

      case "query":
        await querySurveyData(options);
        break;

      case "health":
        await checkSurveyHealth(options);
        break;

      case "cleanup":
        await cleanupSurvey(options);
        break;

      case "enable":
        await manageSurveyConfig("enable", options);
        break;

      case "disable":
        await manageSurveyConfig("disable", options);
        break;

      case "config":
        await manageSurveyConfig("config", options);
        break;

      default:
        console.error(chalk.red(`Unknown survey subcommand: ${subcommand}`));
        console.log(
          chalk.dim(
            "\nAvailable subcommands: report, query, health, cleanup, enable, disable, config",
          ),
        );
        return 1;
    }

    return 0;
  } catch (error) {
    console.error(chalk.red("Survey command failed:"), error);
    return 1;
  }
}

/**
 * Show survey help
 */
export function showSurveyHelp(): void {
  console.log(chalk.cyan("\n📊 Skald Survey System Help\n"));

  console.log(chalk.bold("Commands:"));
  console.log("  survey report     Show usage statistics and feedback report");
  console.log("  survey query      Query raw survey data");
  console.log("  survey health     Check survey system status");
  console.log("  survey cleanup    Remove expired survey data");
  console.log("  survey enable     Enable survey collection");
  console.log("  survey disable    Disable survey collection");
  console.log("  survey config     Show current configuration");

  console.log(chalk.bold("\nOptions:"));
  console.log("  --limit <n>       Limit results (default: 50 for query, 100 for report)");
  console.log("  --format <type>   Output format: table, json, text (default: table)");
  console.log("  --verbose         Show detailed information");
  console.log("  --days <n>        Filter by number of days (future enhancement)");

  console.log(chalk.bold("\nExamples:"));
  console.log("  arbiter survey report --verbose");
  console.log("  arbiter survey query --limit 20 --format json");
  console.log("  arbiter survey health --verbose");
  console.log("  arbiter survey cleanup");

  console.log(chalk.dim("\nSurvey collection runs automatically with maximum verbosity."));
  console.log(chalk.dim("Data is stored locally and helps improve tool effectiveness."));
}

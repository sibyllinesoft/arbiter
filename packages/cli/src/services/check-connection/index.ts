import { ConnectionValidator } from "@/core/connection-validator.js";
import { ApiClient } from "@/io/api/api-client.js";
import { type CLIConfig, loadConfig } from "@/io/config/config.js";
import chalk from "chalk";
import { Command } from "commander";

interface ConnectionValidation {
  success: boolean;
  url?: string;
  error?: string;
  dnsResolved?: boolean;
  tlsHandshake?: boolean;
  latencyMs?: number;
}

function logConfiguration(config: CLIConfig): void {
  console.log(chalk.cyan("Configuration:"));
  console.log(`  API URL: ${config.apiUrl}`);
  console.log(`  Timeout: ${config.timeout}ms\n`);
}

async function logHealthStatus(apiClient: ApiClient): Promise<void> {
  const health = await apiClient.health();
  if (health.success) {
    console.log(`   Server status: ${health.data?.status || "healthy"}`);
    console.log(`   Timestamp: ${health.data?.timestamp || new Date().toISOString()}`);
  } else {
    console.log(chalk.yellow("Health endpoint not available"));
  }
}

function logConnectionResult(validation: ConnectionValidation, apiClient: ApiClient): void {
  if (validation.success) {
    console.log(chalk.green("Connection successful!"));
    console.log(`   Server found at: ${validation.url}`);
    logHealthStatus(apiClient);
  } else {
    console.log(chalk.red("Connection failed:"));
    console.log(`   ${validation.error || "Unknown error"}`);
  }
}

function logDiagnostics(validation: ConnectionValidation): void {
  const check = (value: boolean | undefined) => (value ? "passed" : "failed");
  console.log("\nDiagnostics:");
  console.log(`  DNS:    ${check(validation.dnsResolved)}`);
  console.log(`  TLS:    ${check(validation.tlsHandshake)}`);
  console.log(`  Latency:${validation.latencyMs ? ` ${validation.latencyMs}ms` : " N/A"}`);
}

async function checkConnection(options: { detailed?: boolean; config?: string }): Promise<void> {
  try {
    const config = await loadConfig(options.config);
    const validator = new ConnectionValidator(config);
    const apiClient = new ApiClient(config);

    console.log(chalk.blue("Checking Arbiter server connection...\n"));
    logConfiguration(config);

    const validation = await validator.validateConnection();
    logConnectionResult(validation, apiClient);

    if (options.detailed) {
      logDiagnostics(validation);
    }
  } catch (error) {
    console.error(
      chalk.red("Check failed:"),
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  }
}

export function createCheckConnectionCommand(): Command {
  return new Command("check")
    .description("Check server connectivity and diagnose connection issues")
    .option("--detailed", "Show detailed diagnostics")
    .option("--config <path>", "Path to configuration file")
    .action(checkConnection);
}

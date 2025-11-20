import chalk from "chalk";
import { Command } from "commander";
import { ApiClient } from "../../api-client.js";
import { loadConfig } from "../../config.js";
import { ConnectionValidator } from "../../connection-validator.js";

/**
 * Command to check server connectivity and diagnose connection issues
 */
export function createCheckConnectionCommand(): Command {
  const cmd = new Command("check")
    .description("Check server connectivity and diagnose connection issues")
    .option("--detailed", "Show detailed diagnostics")
    .option("--config <path>", "Path to configuration file")
    .action(async (options) => {
      try {
        const config = await loadConfig(options.config);
        const validator = new ConnectionValidator(config);
        const apiClient = new ApiClient(config);

        console.log(chalk.blue("🔍 Checking Arbiter server connection...\n"));

        // Test current configuration
        console.log(chalk.cyan("Configuration:"));
        console.log(`  API URL: ${config.apiUrl}`);
        console.log(`  Timeout: ${config.timeout}ms\n`);

        // Validate connection
        const validation = await validator.validateConnection();

        if (validation.success) {
          console.log(chalk.green("✅ Connection successful!"));
          console.log(`   Server found at: ${validation.url}`);

          // Test health endpoint
          const health = await apiClient.health();
          if (health.success) {
            console.log(`   Server status: ${health.data?.status || "healthy"}`);
            console.log(`   Timestamp: ${health.data?.timestamp || new Date().toISOString()}`);
          } else {
            console.log(chalk.yellow("⚠️  Health endpoint not available"));
          }
        } else {
          console.log(chalk.red("❌ Connection failed:"));
          console.log(`   ${validation.error || "Unknown error"}`);
        }

        // Detailed diagnostics
        if (options.detailed) {
          console.log("\nDiagnostics:");
          console.log(`  DNS:    ${validation.dnsResolved ? "✅" : "❌"}`);
          console.log(`  TLS:    ${validation.tlsHandshake ? "✅" : "❌"}`);
          console.log(`  Latency:${validation.latencyMs ? ` ${validation.latencyMs}ms` : " N/A"}`);
        }
      } catch (error) {
        console.error(
          chalk.red("Check failed:"),
          error instanceof Error ? error.message : String(error),
        );
        process.exit(1);
      }
    });

  return cmd;
}

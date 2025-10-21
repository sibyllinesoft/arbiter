import chalk from "chalk";
import { Command } from "commander";
import { ApiClient } from "../api-client.js";
import { loadConfig } from "../config.js";
import { ConnectionValidator } from "../connection-validator.js";

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
          }

          const url = new URL(config.apiUrl);
          const configuredPort = url.port || (url.protocol === "https:" ? "443" : "80");
          const detectedPort = validation.port ? String(validation.port) : undefined;

          if (detectedPort && detectedPort !== configuredPort) {
            console.log(
              chalk.yellow(
                `\n💡 Note: Server found on port ${detectedPort}, but your config uses ${configuredPort}`,
              ),
            );
            console.log(
              `   Consider updating your config: arbiter config set apiUrl http://localhost:${detectedPort}`,
            );
          }
        } else {
          console.log(chalk.red("❌ Connection failed"));
          console.log(`   ${validation.error}\n`);

          if (validation.suggestions && validation.suggestions.length > 0) {
            console.log(chalk.yellow("💡 Troubleshooting suggestions:"));
            for (const suggestion of validation.suggestions) {
              console.log(`   • ${suggestion}`);
            }
          }
        }

        // Show detailed diagnostics if requested
        if (options.detailed) {
          console.log(chalk.blue("\n🔬 Detailed Diagnostics:"));

          const diagnostics = await validator.getDiagnostics();

          console.log(`\nTesting common ports on ${new URL(diagnostics.configuredUrl).hostname}:`);

          for (const test of diagnostics.networkTests) {
            const icon =
              test.status === "success"
                ? "✅"
                : test.status === "timeout"
                  ? "⏱️"
                  : test.status === "refused"
                    ? "🚫"
                    : "❌";

            const statusColor =
              test.status === "success"
                ? chalk.green
                : test.status === "timeout"
                  ? chalk.yellow
                  : test.status === "refused"
                    ? chalk.red
                    : chalk.red;

            console.log(
              `  ${icon} Port ${test.port}: ${statusColor(test.status)} (${test.responseTime}ms)`,
            );
            if (test.error) {
              console.log(`     ${chalk.gray(test.error)}`);
            }
          }

          console.log(chalk.blue("\n🛠️  Quick Start Commands:"));
          console.log(`  Start development server: ${chalk.cyan("bun run dev")}`);
          console.log(`  Start with Docker:        ${chalk.cyan("docker-compose up")}`);
          console.log(
            `  Check server logs:        ${chalk.cyan("docker-compose logs spec-workbench")}`,
          );
        }

        process.exit(validation.success ? 0 : 1);
      } catch (error) {
        console.error(
          chalk.red("Error checking connection:"),
          error instanceof Error ? error.message : String(error),
        );
        process.exit(2);
      }
    });

  return cmd;
}

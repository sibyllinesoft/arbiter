import {
  type MonitoringConfig,
  createConstraintMonitor,
  globalConstraintMonitor,
} from "@/constraints/core/monitoring.js";
import {
  ConstraintViolationError,
  type Constraints,
  getGlobalConstraintSystem,
  initializeGlobalConstraintSystem,
} from "@/constraints/index.js";
import { type CUEManipulator, createCUEManipulator } from "@/cue/index.js";
import type { CLIConfig } from "@/types.js";
import chalk from "chalk";
import type { Command } from "commander";

/**
 * CLI constraint integration options
 */
export interface CLIConstraintOptions {
  /** Enable constraint enforcement (default: false; enabled automatically in agent mode) */
  enableConstraints?: boolean;
  /** Custom constraint configuration */
  constraints?: Partial<Constraints>;
  /** Monitoring configuration */
  monitoring?: Partial<MonitoringConfig>;
  /** Show constraint violations in real-time */
  showViolations?: boolean;
  /** Exit on constraint violations (default: true) */
  exitOnViolation?: boolean;
  /** Generate compliance report at end */
  complianceReport?: boolean;
}

/**
 * Initialize constraint system for CLI
 */
export function initializeCLIConstraints(
  config: CLIConfig,
  options: CLIConstraintOptions = {},
): void {
  const {
    enableConstraints = false,
    constraints = {},
    monitoring = {},
    showViolations = false,
    exitOnViolation = true,
    complianceReport = false,
  } = options;

  if (!enableConstraints) {
    console.log(
      chalk.dim("Constraint enforcement skipped (enable with --enable-constraints flag)"),
    );
    return;
  }

  // Initialize constraint system
  const constraintSystem = initializeGlobalConstraintSystem(config, constraints);

  // Initialize monitoring
  const monitor = createConstraintMonitor(monitoring);

  // Set up event handlers
  setupConstraintEventHandlers(constraintSystem, monitor, {
    showViolations,
    exitOnViolation,
    complianceReport,
  });

  console.log(chalk.dim("Constraint enforcement initialized"));
}

/**
 * Output constraint status based on options
 */
function outputConstraintStatus(
  constraintSystem: ReturnType<typeof getGlobalConstraintSystem>,
  options: { json?: boolean; report?: boolean; monitoring?: boolean },
): void {
  if (options.json) {
    console.log(JSON.stringify(constraintSystem.getSystemStatus(), null, 2));
  } else if (options.report) {
    console.log(constraintSystem.generateComplianceReport());
  } else if (options.monitoring) {
    console.log(globalConstraintMonitor.generateReport());
  } else {
    showQuickStatus(constraintSystem.getSystemStatus());
  }
}

/**
 * Handle constraints status command action
 */
async function handleConstraintsStatusAction(options: {
  json?: boolean;
  report?: boolean;
  monitoring?: boolean;
}): Promise<void> {
  try {
    const constraintSystem = getGlobalConstraintSystem();
    outputConstraintStatus(constraintSystem, options);
  } catch (error) {
    if (error instanceof Error && error.message.includes("not initialized")) {
      console.error(chalk.red("Constraint system not initialized. Run a command first."));
      process.exit(1);
    }
    throw error;
  }
}

/**
 * Handle constraints export command action
 */
async function handleConstraintsExportAction(options: { output: string }): Promise<void> {
  try {
    await globalConstraintMonitor.exportData(options.output);
    console.log(chalk.green(`Monitoring data exported to ${options.output}`));
  } catch (error) {
    console.error(
      chalk.red("Export failed:"),
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  }
}

/**
 * Handle constraints reset command action
 */
function handleConstraintsResetAction(options: { force?: boolean }): void {
  if (!options.force) {
    console.log("This will reset all constraint monitoring data.");
    console.log("Use --force to confirm.");
    return;
  }

  globalConstraintMonitor.cleanup();
  console.log(chalk.green("Monitoring data reset"));
}

/**
 * Add constraint-related commands to CLI
 */
export function addConstraintCommands(program: Command): void {
  program
    .command("constraints")
    .description("Show constraint system status and compliance")
    .option("-r, --report", "Generate full compliance report")
    .option("-j, --json", "Output in JSON format")
    .option("-m, --monitoring", "Show monitoring data")
    .action(handleConstraintsStatusAction);

  program
    .command("constraints:export")
    .description("Export constraint monitoring data")
    .requiredOption("-o, --output <file>", "Output file path")
    .action(handleConstraintsExportAction);

  program
    .command("constraints:reset")
    .description("Reset constraint monitoring data")
    .option("-f, --force", "Force reset without confirmation")
    .action(handleConstraintsResetAction);
}

type CueManipulatorFactory = () => CUEManipulator;
let currentCueManipulatorFactory: CueManipulatorFactory = () => createCUEManipulator();

export function setCueManipulatorFactory(factory: CueManipulatorFactory): void {
  currentCueManipulatorFactory = factory;
}

export function getCueManipulator(): CUEManipulator {
  return currentCueManipulatorFactory();
}

// Testing surface
export const __cliIntegrationTesting = {
  setCueManipulatorFactory,
  getCueManipulator,
  withConstraintEnforcement,
  setupConstraintEventHandlers,
  showQuickStatus,
  formatBytes,
};

/**
 * Wrap command execution with constraint enforcement
 */
function recordSuccessfulOperation(
  commandName: string,
  startTime: number,
  argsLength: number,
  result: number,
): void {
  const duration = Date.now() - startTime;
  globalConstraintMonitor.recordOperation(commandName, duration, result === 0, {
    args: argsLength,
  });
}

function handleConstraintViolation(
  error: ConstraintViolationError,
  commandName: string,
  argsLength: number,
): number {
  globalConstraintMonitor.recordViolation({
    constraint: error.constraint,
    violation: error,
    timestamp: Date.now(),
    operation: commandName,
    context: { args: argsLength },
  });
  console.error(chalk.red("Constraint Violation:"));
  console.error(chalk.red(`  ${error.constraint}: ${error.message}`));
  console.error(chalk.dim("  Expected:"), error.expected);
  console.error(chalk.dim("  Actual:"), error.actual);
  if (error.details) console.error(chalk.dim("  Details:"), JSON.stringify(error.details, null, 2));
  return 2;
}

function recordFailedOperation(commandName: string, error: unknown): void {
  globalConstraintMonitor.recordOperation(commandName, Date.now(), false, {
    error: error instanceof Error ? error.message : String(error),
  });
}

export function withConstraintEnforcement<T extends any[]>(
  commandFn: (...args: T) => Promise<number>,
): (...args: T) => Promise<number> {
  return async (...args: T): Promise<number> => {
    const commandName = commandFn.name || "command";
    const startTime = Date.now();
    try {
      const result = await commandFn(...args);
      recordSuccessfulOperation(commandName, startTime, args.length, result);
      return result;
    } catch (error) {
      if (error instanceof ConstraintViolationError)
        return handleConstraintViolation(error, commandName, args.length);
      recordFailedOperation(commandName, error);
      throw error;
    }
  };
}

/**
 * Create violation event handler
 */
function createViolationHandler(
  monitor: ReturnType<typeof createConstraintMonitor>,
  options: { showViolations: boolean; exitOnViolation: boolean },
): (event: any) => void {
  return (event) => {
    monitor.recordViolation(event);

    if (options.showViolations) {
      console.error(chalk.red(`⚠️  ${event.constraint}: ${event.violation.message}`));
    }

    if (options.exitOnViolation) {
      console.error(chalk.red("Exiting due to constraint violation"));
      process.exit(2);
    }
  };
}

/**
 * Create alert event handler
 */
function createAlertHandler(): (alert: any) => void {
  return (alert) => {
    console.warn(chalk.yellow(`🚨 Alert: ${alert.message}`));

    if (alert.type === "system_health" && alert.issues) {
      console.warn(chalk.yellow("Issues:"));
      for (const issue of alert.issues) {
        console.warn(chalk.yellow(`  • ${issue}`));
      }
    }
  };
}

/**
 * Create compliance report handler for process exit
 */
function createComplianceReportHandler(
  constraintSystem: ReturnType<typeof getGlobalConstraintSystem>,
  monitor: ReturnType<typeof createConstraintMonitor>,
): () => void {
  return () => {
    try {
      const report = constraintSystem.generateComplianceReport();
      console.log(`\n${report}`);

      const monitoringReport = monitor.generateReport();
      console.log(`\n${monitoringReport}`);
    } catch (error) {
      console.error(chalk.red("Failed to generate compliance report:"), error);
    }
  };
}

/**
 * Create graceful shutdown handler
 */
function createShutdownHandler(
  constraintSystem: ReturnType<typeof getGlobalConstraintSystem>,
  monitor: ReturnType<typeof createConstraintMonitor>,
): () => Promise<void> {
  return async () => {
    console.log(chalk.dim("\nShutting down constraint system..."));

    try {
      await constraintSystem.shutdown();
      await monitor.exportData("@/constraints/constraint-data-export.json");
      console.log(chalk.dim("Constraint data exported to ./constraint-data-export.json"));
    } catch (error) {
      console.error(chalk.red("Shutdown error:"), error);
    }

    process.exit(0);
  };
}

/**
 * Set up global constraint event handlers
 */
function setupConstraintEventHandlers(
  constraintSystem: ReturnType<typeof getGlobalConstraintSystem>,
  monitor: ReturnType<typeof createConstraintMonitor>,
  options: {
    showViolations: boolean;
    exitOnViolation: boolean;
    complianceReport: boolean;
  },
): void {
  constraintSystem.on("violation", createViolationHandler(monitor, options));
  monitor.on("alert", createAlertHandler());

  if (options.complianceReport) {
    process.on("beforeExit", createComplianceReportHandler(constraintSystem, monitor));
  }

  process.on("SIGINT", createShutdownHandler(constraintSystem, monitor));
}

/**
 * Show quick constraint status
 */
type ConstraintStatus = ReturnType<ReturnType<typeof getGlobalConstraintSystem>["getSystemStatus"]>;

function getHealthIndicator(isHealthy: boolean): string {
  return isHealthy ? chalk.green("✅ HEALTHY") : chalk.red("❌ VIOLATIONS DETECTED");
}

function getComplianceColor(rate: number): typeof chalk.green {
  if (rate >= 95) return chalk.green;
  if (rate >= 80) return chalk.yellow;
  return chalk.red;
}

function printStatusHeader(status: ConstraintStatus): void {
  console.log(chalk.bold("🛡️  Constraint System Status\n"));
  console.log(`Status: ${getHealthIndicator(status.isHealthy)}`);
  const color = getComplianceColor(status.violations.complianceRate);
  console.log(`Compliance: ${color(`${status.violations.complianceRate.toFixed(1)}%`)}\n`);
}

function printQuickStats(status: ConstraintStatus): void {
  console.log(chalk.bold("Quick Stats:"));
  console.log(`  Total Violations: ${status.violations.totalViolations}`);
  console.log(`  Active Operations: ${status.sandbox.activeOperations}`);
  console.log(`  Sandbox Compliance: ${status.sandbox.complianceRate.toFixed(1)}%`);
  console.log(`  Schema Version: ${status.schema.latestVersion}\n`);
}

function printLimits(status: ConstraintStatus): void {
  console.log(chalk.bold("Current Limits:"));
  console.log(`  Max Payload: ${formatBytes(status.constraints.maxPayloadSize)}`);
  console.log(`  Max Duration: ${status.constraints.maxOperationTime}ms`);
  console.log(
    `  Rate Limit: ${status.constraints.rateLimit.requests}/${status.constraints.rateLimit.windowMs}ms\n`,
  );
}

function printCriticalViolations(violations: string[]): void {
  if (violations.length === 0) return;
  console.log(chalk.bold(chalk.red("Critical Issues:")));
  violations.slice(0, 3).forEach((v) => console.log(`  ${chalk.red("•")} ${v}`));
  if (violations.length > 3)
    console.log(
      `  ${chalk.dim("... and")} ${chalk.red(violations.length - 3)} ${chalk.dim("more")}`,
    );
  console.log("");
}

function printSuggestions(suggestions: string[]): void {
  if (suggestions.length === 0) return;
  console.log(chalk.bold("Top Suggestions:"));
  suggestions.slice(0, 2).forEach((s) => console.log(`  ${chalk.yellow("💡")} ${s}`));
  console.log("");
}

function showQuickStatus(status: ConstraintStatus): void {
  printStatusHeader(status);
  printQuickStats(status);
  printLimits(status);
  printCriticalViolations(status.violations.criticalViolations);
  printSuggestions(status.violations.suggestions);
  console.log(chalk.dim("Use --report for detailed analysis"));
  console.log(chalk.dim("Use --monitoring for performance data"));
}

/**
 * Format bytes in human-readable format
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
}

/**
 * Middleware to add constraint checking to all commands
 */
export function addConstraintMiddleware(program: Command, config: CLIConfig): void {
  // Initialize constraints for all commands
  program.hook("preAction", (_thisCommand) => {
    try {
      // Initialize constraint system if not already initialized
      initializeCLIConstraints(config, {
        enableConstraints: true,
        showViolations: false, // Don't show violations by default
        exitOnViolation: true, // Exit on violations for safety
        complianceReport: false, // Only show on explicit request
      });
    } catch (error) {
      // If already initialized, continue
      if (!(error instanceof Error && error.message.includes("already initialized"))) {
        throw error;
      }
    }
  });

  // Add constraint validation to all commands
  program.hook("postAction", async (thisCommand) => {
    // Record command execution
    const duration = Date.now() - ((thisCommand as any)._startTime || Date.now());

    globalConstraintMonitor.recordOperation(thisCommand.name(), duration, true);
  });
}

/**
 * Export constraint system integration for external use
 */
export { initializeGlobalConstraintSystem, getGlobalConstraintSystem, globalConstraintMonitor };

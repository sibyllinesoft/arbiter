import chalk from 'chalk';
import { Command } from 'commander';
import { 
  initializeGlobalConstraintSystem,
  getGlobalConstraintSystem,
  ConstraintViolationError,
  type Constraints,
} from './index.js';
import {
  globalConstraintMonitor,
  createConstraintMonitor,
  type MonitoringConfig,
} from './monitoring.js';
import type { CLIConfig } from '../types.js';

/**
 * CLI constraint integration options
 */
export interface CLIConstraintOptions {
  /** Enable constraint enforcement (default: true) */
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
  options: CLIConstraintOptions = {}
): void {
  const {
    enableConstraints = true,
    constraints = {},
    monitoring = {},
    showViolations = false,
    exitOnViolation = true,
    complianceReport = false,
  } = options;

  if (!enableConstraints) {
    console.log(chalk.dim('Constraint enforcement disabled'));
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

  console.log(chalk.dim('Constraint enforcement initialized'));
}

/**
 * Add constraint-related commands to CLI
 */
export function addConstraintCommands(program: Command): void {
  // Constraint status command
  program
    .command('constraints')
    .description('Show constraint system status and compliance')
    .option('-r, --report', 'Generate full compliance report')
    .option('-j, --json', 'Output in JSON format')
    .option('-m, --monitoring', 'Show monitoring data')
    .action(async (options) => {
      try {
        const constraintSystem = getGlobalConstraintSystem();
        
        if (options.json) {
          const status = constraintSystem.getSystemStatus();
          console.log(JSON.stringify(status, null, 2));
        } else if (options.report) {
          const report = constraintSystem.generateComplianceReport();
          console.log(report);
        } else if (options.monitoring) {
          const monitoringReport = globalConstraintMonitor.generateReport();
          console.log(monitoringReport);
        } else {
          // Show quick status
          const status = constraintSystem.getSystemStatus();
          showQuickStatus(status);
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes('not initialized')) {
          console.error(chalk.red('Constraint system not initialized. Run a command first.'));
          process.exit(1);
        }
        throw error;
      }
    });

  // Export monitoring data command
  program
    .command('constraints:export')
    .description('Export constraint monitoring data')
    .requiredOption('-o, --output <file>', 'Output file path')
    .action(async (options) => {
      try {
        await globalConstraintMonitor.exportData(options.output);
        console.log(chalk.green(`Monitoring data exported to ${options.output}`));
      } catch (error) {
        console.error(chalk.red('Export failed:'), error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  // Reset monitoring data command
  program
    .command('constraints:reset')
    .description('Reset constraint monitoring data')
    .option('-f, --force', 'Force reset without confirmation')
    .action(async (options) => {
      if (!options.force) {
        console.log('This will reset all constraint monitoring data.');
        console.log('Use --force to confirm.');
        return;
      }

      globalConstraintMonitor.cleanup();
      console.log(chalk.green('Monitoring data reset'));
    });
}

/**
 * Wrap command execution with constraint enforcement
 */
export function withConstraintEnforcement<T extends any[]>(
  commandFn: (...args: T) => Promise<number>
): (...args: T) => Promise<number> {
  return async (...args: T): Promise<number> => {
    try {
      // Record operation start
      const startTime = Date.now();
      
      // Execute command
      const result = await commandFn(...args);
      
      // Record operation metrics
      const duration = Date.now() - startTime;
      const success = result === 0;
      
      globalConstraintMonitor.recordOperation(
        commandFn.name || 'command',
        duration,
        success,
        { args: args.length }
      );

      return result;

    } catch (error) {
      if (error instanceof ConstraintViolationError) {
        // Record constraint violation
        globalConstraintMonitor.recordViolation({
          constraint: error.constraint,
          violation: error,
          timestamp: Date.now(),
          operation: commandFn.name || 'command',
          context: { args: args.length },
        });

        // Show violation details
        console.error(chalk.red('Constraint Violation:'));
        console.error(chalk.red(`  ${error.constraint}: ${error.message}`));
        console.error(chalk.dim('  Expected:'), error.expected);
        console.error(chalk.dim('  Actual:'), error.actual);
        
        if (error.details) {
          console.error(chalk.dim('  Details:'), JSON.stringify(error.details, null, 2));
        }

        return 2; // Constraint violation exit code
      }

      // Record generic failure
      globalConstraintMonitor.recordOperation(
        commandFn.name || 'command',
        Date.now(),
        false,
        { error: error instanceof Error ? error.message : String(error) }
      );

      throw error;
    }
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
  }
): void {
  // Handle constraint violations
  constraintSystem.on('violation', (event) => {
    monitor.recordViolation(event);
    
    if (options.showViolations) {
      console.error(chalk.red(`⚠️  ${event.constraint}: ${event.violation.message}`));
    }
    
    if (options.exitOnViolation) {
      console.error(chalk.red('Exiting due to constraint violation'));
      process.exit(2);
    }
  });

  // Handle monitoring alerts
  monitor.on('alert', (alert) => {
    console.warn(chalk.yellow(`🚨 Alert: ${alert.message}`));
    
    if (alert.type === 'system_health' && alert.issues) {
      console.warn(chalk.yellow('Issues:'));
      for (const issue of alert.issues) {
        console.warn(chalk.yellow(`  • ${issue}`));
      }
    }
  });

  // Handle process exit for compliance report
  if (options.complianceReport) {
    process.on('beforeExit', () => {
      try {
        const report = constraintSystem.generateComplianceReport();
        console.log('\n' + report);
        
        const monitoringReport = monitor.generateReport();
        console.log('\n' + monitoringReport);
      } catch (error) {
        console.error(chalk.red('Failed to generate compliance report:'), error);
      }
    });
  }

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log(chalk.dim('\nShutting down constraint system...'));
    
    try {
      await constraintSystem.shutdown();
      await monitor.exportData('./constraint-data-export.json');
      console.log(chalk.dim('Constraint data exported to ./constraint-data-export.json'));
    } catch (error) {
      console.error(chalk.red('Shutdown error:'), error);
    }
    
    process.exit(0);
  });
}

/**
 * Show quick constraint status
 */
function showQuickStatus(status: ReturnType<typeof getGlobalConstraintSystem>['getSystemStatus']): void {
  console.log(chalk.bold('🛡️  Constraint System Status'));
  console.log('');

  // Health indicator
  const healthIndicator = status.isHealthy ? 
    chalk.green('✅ HEALTHY') : 
    chalk.red('❌ VIOLATIONS DETECTED');
  console.log(`Status: ${healthIndicator}`);
  
  // Compliance rate
  const complianceColor = status.violations.complianceRate >= 95 ? 
    chalk.green : status.violations.complianceRate >= 80 ? 
    chalk.yellow : chalk.red;
  console.log(`Compliance: ${complianceColor(status.violations.complianceRate.toFixed(1) + '%')}`);
  console.log('');

  // Quick stats
  console.log(chalk.bold('Quick Stats:'));
  console.log(`  Total Violations: ${status.violations.totalViolations}`);
  console.log(`  Active Operations: ${status.sandbox.activeOperations}`);
  console.log(`  Sandbox Compliance: ${status.sandbox.complianceRate.toFixed(1)}%`);
  console.log(`  Schema Version: ${status.schema.latestVersion}`);
  console.log('');

  // Constraint limits
  console.log(chalk.bold('Current Limits:'));
  console.log(`  Max Payload: ${formatBytes(status.constraints.maxPayloadSize)}`);
  console.log(`  Max Duration: ${status.constraints.maxOperationTime}ms`);
  console.log(`  Rate Limit: ${status.constraints.rateLimit.requests}/${status.constraints.rateLimit.windowMs}ms`);
  console.log('');

  // Critical violations
  if (status.violations.criticalViolations.length > 0) {
    console.log(chalk.bold(chalk.red('Critical Issues:')));
    for (const critical of status.violations.criticalViolations.slice(0, 3)) {
      console.log(`  ${chalk.red('•')} ${critical}`);
    }
    
    if (status.violations.criticalViolations.length > 3) {
      console.log(`  ${chalk.dim('... and')} ${chalk.red(status.violations.criticalViolations.length - 3)} ${chalk.dim('more')}`);
    }
    console.log('');
  }

  // Suggestions
  if (status.violations.suggestions.length > 0) {
    console.log(chalk.bold('Top Suggestions:'));
    for (const suggestion of status.violations.suggestions.slice(0, 2)) {
      console.log(`  ${chalk.yellow('💡')} ${suggestion}`);
    }
    console.log('');
  }

  console.log(chalk.dim('Use --report for detailed analysis'));
  console.log(chalk.dim('Use --monitoring for performance data'));
}

/**
 * Format bytes in human-readable format
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Middleware to add constraint checking to all commands
 */
export function addConstraintMiddleware(program: Command, config: CLIConfig): void {
  // Initialize constraints for all commands
  program.hook('preAction', (thisCommand) => {
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
      if (!(error instanceof Error && error.message.includes('already initialized'))) {
        throw error;
      }
    }
  });

  // Add constraint validation to all commands
  program.hook('postAction', async (thisCommand, actionResult) => {
    // Record command execution
    const duration = Date.now() - (thisCommand as any)._startTime || 0;
    const success = actionResult === 0;
    
    globalConstraintMonitor.recordOperation(
      thisCommand.name(),
      duration,
      success
    );
  });
}

/**
 * Export constraint system integration for external use
 */
export {
  initializeGlobalConstraintSystem,
  getGlobalConstraintSystem,
  globalConstraintMonitor,
};
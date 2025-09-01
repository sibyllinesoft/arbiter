#!/usr/bin/env node

import { Command } from 'commander';
import { createLogger, Logger, transports } from 'winston';
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';

import { Orchestrator } from '../core/orchestrator.js';
import { GitHubWebhookHandler } from '../integration/github-webhook-handler.js';
import { ConfigManager, AgenticCIConfig } from '../config/agentic-ci-config.js';
import { SafetyController } from '../safety/safety-controller.js';
import { MetricsCollector } from '../monitoring/metrics-collector.js';
import { AuditLogger } from '../governance/audit-logger.js';

/**
 * CLI interface for the Agentic CI system
 * 
 * Provides commands to start, stop, configure, and manage the agentic CI system.
 */
class AgenticCICLI {
  private logger: Logger;
  private orchestrator?: Orchestrator;
  private webhookHandler?: GitHubWebhookHandler;
  private isRunning = false;
  
  constructor() {
    this.logger = createLogger({
      level: 'info',
      format: require('winston').format.combine(
        require('winston').format.timestamp(),
        require('winston').format.label({ label: 'AgenticCICLI' }),
        require('winston').format.colorize(),
        require('winston').format.simple()
      ),
      transports: [
        new transports.Console(),
      ],
    });
  }
  
  /**
   * Initialize the CLI application
   */
  public async initialize(): Promise<void> {
    const program = new Command();
    
    program
      .name('agentic-ci')
      .description('AI-powered CI/CD automation with auto-merge capabilities')
      .version('1.0.0');
    
    // Start command
    program
      .command('start')
      .description('Start the agentic CI system')
      .option('-c, --config <path>', 'Configuration file path', './agentic-ci.config.json')
      .option('-p, --port <port>', 'Webhook server port', '3000')
      .option('-d, --daemon', 'Run as daemon process')
      .action(async (options) => {
        await this.handleStart(options);
      });
    
    // Stop command
    program
      .command('stop')
      .description('Stop the agentic CI system')
      .action(async () => {
        await this.handleStop();
      });
    
    // Status command
    program
      .command('status')
      .description('Check system status and metrics')
      .option('-j, --json', 'Output in JSON format')
      .action(async (options) => {
        await this.handleStatus(options);
      });
    
    // Config commands
    const configCmd = program
      .command('config')
      .description('Configuration management');
    
    configCmd
      .command('init')
      .description('Initialize configuration file')
      .option('-f, --force', 'Overwrite existing configuration')
      .action(async (options) => {
        await this.handleConfigInit(options);
      });
    
    configCmd
      .command('validate')
      .description('Validate configuration file')
      .option('-c, --config <path>', 'Configuration file path', './agentic-ci.config.json')
      .action(async (options) => {
        await this.handleConfigValidate(options);
      });
    
    configCmd
      .command('show')
      .description('Show current configuration')
      .option('-c, --config <path>', 'Configuration file path', './agentic-ci.config.json')
      .option('-s, --section <section>', 'Show specific section')
      .action(async (options) => {
        await this.handleConfigShow(options);
      });
    
    // Emergency commands
    const emergencyCmd = program
      .command('emergency')
      .description('Emergency management commands');
    
    emergencyCmd
      .command('stop')
      .description('Trigger emergency stop')
      .option('-r, --reason <reason>', 'Reason for emergency stop', 'Manual intervention')
      .action(async (options) => {
        await this.handleEmergencyStop(options);
      });
    
    emergencyCmd
      .command('reset')
      .description('Reset emergency state')
      .action(async () => {
        await this.handleEmergencyReset();
      });
    
    // Metrics commands
    const metricsCmd = program
      .command('metrics')
      .description('System metrics and reporting');
    
    metricsCmd
      .command('show')
      .description('Show current metrics')
      .option('-j, --json', 'Output in JSON format')
      .action(async (options) => {
        await this.handleMetricsShow(options);
      });
    
    metricsCmd
      .command('report')
      .description('Generate comprehensive metrics report')
      .option('-o, --output <file>', 'Output file path')
      .option('-f, --format <format>', 'Output format (json|html)', 'json')
      .action(async (options) => {
        await this.handleMetricsReport(options);
      });
    
    // Audit commands
    const auditCmd = program
      .command('audit')
      .description('Audit log management');
    
    auditCmd
      .command('export')
      .description('Export audit logs')
      .option('-s, --start <date>', 'Start date (YYYY-MM-DD)')
      .option('-e, --end <date>', 'End date (YYYY-MM-DD)')
      .option('-o, --output <file>', 'Output file path')
      .action(async (options) => {
        await this.handleAuditExport(options);
      });
    
    auditCmd
      .command('compliance')
      .description('Generate compliance report')
      .option('-s, --start <date>', 'Start date (YYYY-MM-DD)')
      .option('-e, --end <date>', 'End date (YYYY-MM-DD)')
      .option('-o, --output <file>', 'Output file path')
      .action(async (options) => {
        await this.handleAuditCompliance(options);
      });
    
    await program.parseAsync(process.argv);
  }
  
  /**
   * Handle start command
   */
  private async handleStart(options: any): Promise<void> {
    try {
      if (this.isRunning) {
        this.logger.warn('Agentic CI is already running');
        return;
      }
      
      this.logger.info('Starting Agentic CI system...', {
        configPath: options.config,
        port: options.port,
        daemon: options.daemon,
      });
      
      // Load configuration
      const configManager = ConfigManager.getInstance(options.config);
      const config = configManager.getConfig();
      
      // Initialize components
      const auditLogger = new AuditLogger();
      const metricsCollector = new MetricsCollector();
      const safetyController = new SafetyController(config.safety);
      
      this.orchestrator = new Orchestrator(
        config,
        auditLogger,
        metricsCollector,
        safetyController
      );
      
      this.webhookHandler = new GitHubWebhookHandler(
        config.github.webhookSecret,
        this.orchestrator
      );
      
      // Start components
      await Promise.all([
        auditLogger.start(),
        metricsCollector.start(),
        safetyController.start(),
        this.orchestrator.start(),
        this.webhookHandler.start(),
      ]);
      
      // Start webhook server
      await this.startWebhookServer(parseInt(options.port, 10));
      
      this.isRunning = true;
      
      this.logger.info('🚀 Agentic CI system started successfully', {
        port: options.port,
        pid: process.pid,
      });
      
      // Setup graceful shutdown
      this.setupGracefulShutdown();
      
      // If not daemon mode, keep process alive
      if (!options.daemon) {
        this.logger.info('Running in foreground mode. Press Ctrl+C to stop.');
        await this.waitForShutdown();
      }
      
    } catch (error) {
      this.logger.error('Failed to start Agentic CI system', {
        error: error instanceof Error ? error.message : String(error),
      });
      process.exit(1);
    }
  }
  
  /**
   * Handle stop command
   */
  private async handleStop(): Promise<void> {
    try {
      if (!this.isRunning) {
        this.logger.warn('Agentic CI is not running');
        return;
      }
      
      this.logger.info('Stopping Agentic CI system...');
      
      if (this.orchestrator) {
        await this.orchestrator.stop();
      }
      
      if (this.webhookHandler) {
        await this.webhookHandler.stop();
      }
      
      this.isRunning = false;
      
      this.logger.info('✅ Agentic CI system stopped successfully');
      
    } catch (error) {
      this.logger.error('Error stopping Agentic CI system', {
        error: error instanceof Error ? error.message : String(error),
      });
      process.exit(1);
    }
  }
  
  /**
   * Handle status command
   */
  private async handleStatus(options: any): Promise<void> {
    try {
      const status = {
        running: this.isRunning,
        pid: process.pid,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString(),
      };
      
      if (options.json) {
        console.log(JSON.stringify(status, null, 2));
      } else {
        console.log('🔍 Agentic CI Status:');
        console.log(`  Running: ${status.running ? '✅' : '❌'}`);
        console.log(`  PID: ${status.pid}`);
        console.log(`  Uptime: ${Math.floor(status.uptime)}s`);
        console.log(`  Memory: ${Math.round(status.memory.rss / 1024 / 1024)}MB`);
      }
      
    } catch (error) {
      this.logger.error('Error getting status', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  
  /**
   * Handle config init command
   */
  private async handleConfigInit(options: any): Promise<void> {
    const configPath = './agentic-ci.config.json';
    
    if (existsSync(configPath) && !options.force) {
      this.logger.warn(`Configuration file already exists at ${configPath}`);
      this.logger.info('Use --force to overwrite existing configuration');
      return;
    }
    
    try {
      const defaultConfig = ConfigManager.getDefaultConfig();
      
      writeFileSync(
        configPath,
        JSON.stringify(defaultConfig, null, 2),
        'utf-8'
      );
      
      this.logger.info(`✅ Configuration file created at ${configPath}`);
      this.logger.info('Please update the configuration with your specific values');
      
    } catch (error) {
      this.logger.error('Error creating configuration file', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  
  /**
   * Handle config validate command
   */
  private async handleConfigValidate(options: any): Promise<void> {
    try {
      const configManager = ConfigManager.getInstance(options.config);
      
      if (configManager.validateConfig()) {
        this.logger.info('✅ Configuration is valid');
      } else {
        this.logger.error('❌ Configuration validation failed');
        process.exit(1);
      }
      
    } catch (error) {
      this.logger.error('❌ Configuration validation failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      process.exit(1);
    }
  }
  
  /**
   * Handle config show command
   */
  private async handleConfigShow(options: any): Promise<void> {
    try {
      const configManager = ConfigManager.getInstance(options.config);
      const config = configManager.getConfig();
      
      let output = config;
      if (options.section) {
        output = configManager.getSection(options.section as any);
      }
      
      // Mask sensitive values
      const maskedConfig = this.maskSensitiveValues(output);
      
      console.log(JSON.stringify(maskedConfig, null, 2));
      
    } catch (error) {
      this.logger.error('Error showing configuration', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  
  /**
   * Handle emergency stop command
   */
  private async handleEmergencyStop(options: any): Promise<void> {
    try {
      this.logger.warn('🚨 Triggering emergency stop', {
        reason: options.reason,
      });
      
      if (this.orchestrator) {
        // Trigger emergency stop through safety controller
        const safetyController = (this.orchestrator as any).safetyController;
        if (safetyController) {
          await safetyController.triggerEmergencyStop(options.reason, 'CLI');
        }
      }
      
      this.logger.info('✅ Emergency stop triggered');
      
    } catch (error) {
      this.logger.error('Error triggering emergency stop', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  
  /**
   * Handle emergency reset command
   */
  private async handleEmergencyReset(): Promise<void> {
    try {
      this.logger.info('🔄 Resetting emergency state');
      
      if (this.orchestrator) {
        const safetyController = (this.orchestrator as any).safetyController;
        if (safetyController) {
          await safetyController.reset();
        }
      }
      
      this.logger.info('✅ Emergency state reset');
      
    } catch (error) {
      this.logger.error('Error resetting emergency state', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  
  /**
   * Handle metrics show command
   */
  private async handleMetricsShow(options: any): Promise<void> {
    try {
      if (!this.orchestrator) {
        this.logger.error('Agentic CI is not running');
        return;
      }
      
      const metricsCollector = (this.orchestrator as any).metricsCollector;
      const metrics = metricsCollector.getCurrentMetrics();
      
      if (options.json) {
        console.log(JSON.stringify(metrics, null, 2));
      } else {
        console.log('📊 Current Metrics:');
        console.log(`  Agent Response Time: ${metrics.agentResponseTime}ms`);
        console.log(`  Decision Accuracy: ${metrics.decisionAccuracy}%`);
        console.log(`  False Positive Rate: ${metrics.falsePositiveRate}%`);
        console.log(`  System Uptime: ${metrics.systemUptime}%`);
        console.log(`  Pipelines Processed: ${metrics.throughput.pipelinesProcessed}`);
        console.log(`  Auto-merge Rate: ${metrics.throughput.autoMergeRate}%`);
      }
      
    } catch (error) {
      this.logger.error('Error showing metrics', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  
  /**
   * Handle metrics report command
   */
  private async handleMetricsReport(options: any): Promise<void> {
    try {
      if (!this.orchestrator) {
        this.logger.error('Agentic CI is not running');
        return;
      }
      
      const metricsCollector = (this.orchestrator as any).metricsCollector;
      const report = await metricsCollector.generateReport();
      
      const output = options.output || `metrics-report-${Date.now()}.${options.format}`;
      
      if (options.format === 'html') {
        const htmlReport = this.generateHTMLReport(report);
        writeFileSync(output, htmlReport, 'utf-8');
      } else {
        writeFileSync(output, JSON.stringify(report, null, 2), 'utf-8');
      }
      
      this.logger.info(`📊 Metrics report saved to ${output}`);
      
    } catch (error) {
      this.logger.error('Error generating metrics report', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  
  /**
   * Handle audit export command
   */
  private async handleAuditExport(options: any): Promise<void> {
    try {
      if (!this.orchestrator) {
        this.logger.error('Agentic CI is not running');
        return;
      }
      
      const startTime = options.start ? new Date(options.start) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endTime = options.end ? new Date(options.end) : new Date();
      
      const auditLogger = (this.orchestrator as any).auditLogger;
      const logs = await auditLogger.exportLogs(startTime, endTime);
      
      const output = options.output || `audit-logs-${Date.now()}.json`;
      writeFileSync(output, JSON.stringify(logs, null, 2), 'utf-8');
      
      this.logger.info(`📋 Audit logs exported to ${output}`);
      
    } catch (error) {
      this.logger.error('Error exporting audit logs', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  
  /**
   * Handle audit compliance command
   */
  private async handleAuditCompliance(options: any): Promise<void> {
    try {
      if (!this.orchestrator) {
        this.logger.error('Agentic CI is not running');
        return;
      }
      
      const startTime = options.start ? new Date(options.start) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endTime = options.end ? new Date(options.end) : new Date();
      
      const auditLogger = (this.orchestrator as any).auditLogger;
      const report = await auditLogger.generateComplianceReport(startTime, endTime);
      
      const output = options.output || `compliance-report-${Date.now()}.json`;
      writeFileSync(output, JSON.stringify(report, null, 2), 'utf-8');
      
      this.logger.info(`📋 Compliance report saved to ${output}`);
      
    } catch (error) {
      this.logger.error('Error generating compliance report', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  
  /**
   * Start webhook server
   */
  private async startWebhookServer(port: number): Promise<void> {
    const express = require('express');
    const app = express();
    
    app.use(express.raw({ type: 'application/json' }));
    
    app.post('/webhook', async (req: any, res: any) => {
      try {
        const signature = req.headers['x-hub-signature-256'];
        const eventName = req.headers['x-github-event'];
        
        if (this.webhookHandler) {
          await this.webhookHandler.processWebhook(eventName, req.body, signature);
        }
        
        res.status(200).send('OK');
      } catch (error) {
        this.logger.error('Webhook processing error', {
          error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).send('Internal Server Error');
      }
    });
    
    app.listen(port, () => {
      this.logger.info(`🌐 Webhook server listening on port ${port}`);
    });
  }
  
  /**
   * Setup graceful shutdown handlers
   */
  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      this.logger.info(`Received ${signal}, shutting down gracefully...`);
      await this.handleStop();
      process.exit(0);
    };
    
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGUSR2', () => shutdown('SIGUSR2')); // nodemon
  }
  
  /**
   * Wait for shutdown signal
   */
  private async waitForShutdown(): Promise<void> {
    return new Promise(() => {
      // Keep process alive
    });
  }
  
  /**
   * Mask sensitive values in configuration
   */
  private maskSensitiveValues(obj: any): any {
    const sensitiveKeys = ['token', 'secret', 'key', 'password', 'apiKey'];
    
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }
    
    const masked = { ...obj };
    
    for (const [key, value] of Object.entries(masked)) {
      if (sensitiveKeys.some(sensitiveKey => key.toLowerCase().includes(sensitiveKey))) {
        masked[key] = '***MASKED***';
      } else if (typeof value === 'object') {
        masked[key] = this.maskSensitiveValues(value);
      }
    }
    
    return masked;
  }
  
  /**
   * Generate HTML report from metrics
   */
  private generateHTMLReport(report: any): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Agentic CI Metrics Report</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .metric { margin: 10px 0; padding: 10px; border: 1px solid #ddd; }
            .success { background-color: #d4edda; }
            .warning { background-color: #fff3cd; }
            .error { background-color: #f8d7da; }
        </style>
    </head>
    <body>
        <h1>Agentic CI Metrics Report</h1>
        <p>Generated: ${new Date().toISOString()}</p>
        
        <div class="metric success">
            <h3>Decision Accuracy</h3>
            <p>${report.current.decisionAccuracy}%</p>
        </div>
        
        <div class="metric">
            <h3>Response Time</h3>
            <p>${report.current.agentResponseTime}ms</p>
        </div>
        
        <div class="metric">
            <h3>Auto-merge Rate</h3>
            <p>${report.current.throughput.autoMergeRate}%</p>
        </div>
        
        <h2>Recommendations</h2>
        <ul>
            ${report.recommendations.map((rec: string) => `<li>${rec}</li>`).join('')}
        </ul>
    </body>
    </html>
    `;
  }
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const cli = new AgenticCICLI();
  cli.initialize().catch((error) => {
    console.error('CLI initialization failed:', error);
    process.exit(1);
  });
}
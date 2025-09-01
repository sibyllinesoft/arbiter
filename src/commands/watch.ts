/**
 * CLI Command: Continuous Loop Watch System
 * 
 * Implements the `arbiter watch` command that provides continuous monitoring
 * with intelligent change detection, validation pipeline, NDJSON output,
 * and resource management according to TODO.md lines 186-191.
 */

// import { Command } from 'commander'; // Will be added when commander is available
import { createFileWatcher, FileWatcher } from '../watcher/index.js';
import { createValidationPipeline, ValidationPipeline } from '../lib/validation-pipeline.js';
import { createResourceManager, ResourceManager } from '../lib/resource-manager.js';
import { createOutputStreamer, OutputStreamer } from '../lib/output-streamer.js';
import { logger } from '../utils/logger.js';
import * as fs from 'fs/promises';
import * as path from 'path';

interface WatchCommandOptions {
  patterns?: string;
  debounce?: string;
  parallel?: string;
  output?: string;
  format?: 'ndjson' | 'json' | 'table';
  fast?: boolean;
  selective?: string;
  verbose?: boolean;
  timeout?: string;
  maxPayload?: string;
  maxRate?: string;
  bufferSize?: string;
}

interface ValidationPhase {
  name: string;
  ok: boolean;
  deltas: Array<{
    file: string;
    type: 'add' | 'change' | 'delete';
    timestamp: string;
  }>;
  coverage: {
    contracts: number;
    scenarios: number;
    ui: number;
    budgets: number;
  };
  processingTime: number;
  errors?: Array<{
    file: string;
    message: string;
    line?: number;
  }>;
}

/**
 * Create the watch command (mock for now - will use commander when available)
 */
export function createWatchCommand(): any {
  // Mock command object that matches commander interface
  return {
    name: () => 'watch',
    description: 'Continuous monitoring with validation pipeline and NDJSON output',
    options: [
      { flags: '-p, --patterns <patterns>', description: 'File patterns to watch (comma-separated)', defaultValue: '**/*.cue,**/*.json,**/*.yaml' },
      { flags: '-d, --debounce <ms>', description: 'Debounce delay in milliseconds', defaultValue: '300' },
      { flags: '--parallel <count>', description: 'Number of parallel validations', defaultValue: '4' },
      { flags: '-o, --output <path>', description: 'Output file for NDJSON (default: stdout)', defaultValue: '-' },
      { flags: '-f, --format <type>', description: 'Output format: ndjson, json, table', defaultValue: 'ndjson' },
      { flags: '--fast', description: 'Run in fast mode (incremental validation only)', defaultValue: false },
      { flags: '--selective <types>', description: 'Selective validation types (validate,surface,ui,contracts,budgets)', defaultValue: 'validate,surface,ui,contracts,budgets' },
      { flags: '--timeout <ms>', description: 'Maximum processing time per validation', defaultValue: '750' },
      { flags: '--max-payload <bytes>', description: 'Maximum payload size in bytes', defaultValue: '65536' },
      { flags: '--max-rate <rps>', description: 'Maximum validation rate per second', defaultValue: '1.0' },
      { flags: '--buffer-size <count>', description: 'Output buffer size', defaultValue: '50' },
      { flags: '-v, --verbose', description: 'Enable verbose logging', defaultValue: false },
    ],
    action: async (options: WatchCommandOptions) => {
      await executeWatchCommand(options);
    }
  };
}

/**
 * Execute the watch command
 */
export async function executeWatchCommand(options: WatchCommandOptions): Promise<void> {
  let watcher: FileWatcher | null = null;
  let validationPipeline: ValidationPipeline | null = null;
  let resourceManager: ResourceManager | null = null;
  let outputStreamer: OutputStreamer | null = null;

  try {
    // Configure logging
    if (options.verbose) {
      logger.level = 'debug';
    }

    logger.info('🔄 Starting Arbiter continuous loop system...');

    // Parse configuration
    const config = parseWatchOptions(options);
    logger.debug('Configuration:', config);

    // Initialize components
    resourceManager = createResourceManager({
      maxPayloadBytes: config.maxPayloadBytes,
      maxProcessingTimeMs: config.maxProcessingTimeMs,
      maxRatePerSecond: config.maxRatePerSecond,
      enableBackoff: true,
      enableBatching: true,
      batchSize: 10,
      backoffMultiplier: 1.5,
      maxBackoffMs: 30000,
    });

    outputStreamer = createOutputStreamer({
      outputPath: config.outputPath,
      format: config.format,
      bufferSize: config.bufferSize,
      flushInterval: 1000,
      enableCompression: false,
      enableValidation: true,
    });

    validationPipeline = createValidationPipeline({
      phases: config.validationPhases,
      parallel: config.parallelValidations,
      fastMode: config.fastMode,
      timeout: config.maxProcessingTimeMs,
      resourceManager,
      outputStreamer,
    });

    watcher = createFileWatcher(config.watchPaths, {
      watchOptions: {
        ignored: [
          '**/node_modules/**',
          '**/.git/**',
          '**/dist/**',
          '**/build/**',
          '**/coverage/**',
          '**/.arbiter/**',
        ],
        ignoreInitial: false,
        followSymlinks: true,
        awaitWriteFinish: {
          stabilityThreshold: config.debounceMs,
          pollInterval: 100,
        },
      },
      validation: {
        debounceMs: config.debounceMs,
        batchSize: 10,
        timeout: config.maxProcessingTimeMs,
        enableContracts: config.validationPhases.includes('contracts'),
        enableDependencyCheck: true,
        parallelValidations: config.parallelValidations,
      },
      output: {
        format: 'ndjson',
        stream: process.stdout,
        bufferSize: config.bufferSize,
        flushInterval: 500,
      },
      heartbeat: {
        enabled: true,
        interval: 30000,
      },
    });

    // Set up event handlers
    setupEventHandlers(watcher, validationPipeline, outputStreamer, resourceManager, config);

    // Start all components
    await outputStreamer.start();
    await validationPipeline.start();
    await watcher.start();

    // Report startup
    await outputStreamer.writeEvent({
      type: 'startup',
      timestamp: new Date().toISOString(),
      config: {
        watchPaths: config.watchPaths,
        validationPhases: config.validationPhases,
        fastMode: config.fastMode,
        resourceLimits: {
          maxPayload: `${config.maxPayloadBytes} bytes`,
          maxProcessingTime: `${config.maxProcessingTimeMs} ms`,
          maxRate: `${config.maxRatePerSecond} rps`,
        },
      },
    });

    logger.info(`✅ Watch system started successfully`);
    logger.info(`📁 Monitoring: ${config.watchPaths.join(', ')}`);
    logger.info(`🔍 Phases: ${config.validationPhases.join(' → ')}`);
    logger.info(`⚡ Fast mode: ${config.fastMode ? 'enabled' : 'disabled'}`);
    logger.info(`📊 Output: ${config.outputPath === '-' ? 'stdout' : config.outputPath}`);

    // Keep running until interrupted
    await new Promise<void>((resolve) => {
      const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGUSR2'];
      signals.forEach(signal => {
        process.on(signal, async () => {
          logger.info(`Received ${signal}, shutting down gracefully...`);
          resolve();
        });
      });
    });

  } catch (error) {
    logger.error('Failed to start watch system:', error);
    process.exit(1);
  } finally {
    // Cleanup
    logger.info('🛑 Shutting down watch system...');
    
    try {
      if (watcher) await watcher.stop();
      if (validationPipeline) await validationPipeline.stop();
      if (outputStreamer) await outputStreamer.stop();
      if (resourceManager) resourceManager.destroy();
      
      logger.info('✅ Watch system stopped gracefully');
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  }
}

/**
 * Parse watch command options into configuration
 */
function parseWatchOptions(options: WatchCommandOptions) {
  const patterns = options.patterns?.split(',') || ['**/*.cue', '**/*.json', '**/*.yaml'];
  const watchPaths = patterns.map(pattern => {
    // Convert glob patterns to base directories for watching
    if (pattern.includes('**')) {
      return '.';
    }
    const parts = pattern.split('/');
    return parts.slice(0, -1).join('/') || '.';
  });

  const validationPhases = options.selective?.split(',') || ['validate', 'surface', 'ui', 'contracts', 'budgets'];
  
  return {
    watchPaths: Array.from(new Set(watchPaths)), // Remove duplicates
    filePatterns: patterns,
    validationPhases,
    debounceMs: parseInt(options.debounce || '300'),
    parallelValidations: parseInt(options.parallel || '4'),
    outputPath: options.output || '-',
    format: options.format as 'ndjson' | 'json' | 'table',
    fastMode: options.fast || false,
    maxPayloadBytes: parseInt(options.maxPayload || '65536'),
    maxProcessingTimeMs: parseInt(options.timeout || '750'),
    maxRatePerSecond: parseFloat(options.maxRate || '1.0'),
    bufferSize: parseInt(options.bufferSize || '50'),
  };
}

/**
 * Set up event handlers for all components
 */
function setupEventHandlers(
  watcher: FileWatcher,
  validationPipeline: ValidationPipeline,
  outputStreamer: OutputStreamer,
  resourceManager: ResourceManager,
  config: any
): void {
  // File change events
  watcher.on('file-event', async (event) => {
    logger.debug('File event:', event);
    
    // Check if file matches our patterns
    if (!matchesAnyPattern(event.path, config.filePatterns)) {
      return;
    }

    // Check resource limits
    if (!resourceManager.checkResourceLimits()) {
      logger.warn('⚠️ Resource limits exceeded, deferring validation');
      return;
    }

    // Trigger validation pipeline
    await validationPipeline.processFileChange(event);
  });

  // Validation results
  validationPipeline.on('phase-complete', async (phase: ValidationPhase) => {
    await outputStreamer.writeEvent({
      type: 'validation-phase',
      timestamp: new Date().toISOString(),
      phase: phase.name,
      ok: phase.ok,
      deltas: phase.deltas,
      coverage: phase.coverage,
      processingTime: phase.processingTime,
      errors: phase.errors,
    });

    if (config.format !== 'ndjson') {
      // Also log human-readable output
      const status = phase.ok ? '✅' : '❌';
      const timing = `${phase.processingTime}ms`;
      logger.info(`${status} ${phase.name} (${timing}): ${phase.deltas.length} changes`);
      
      if (phase.errors && phase.errors.length > 0) {
        phase.errors.forEach(error => {
          logger.error(`  ${error.file}: ${error.message}`);
        });
      }
    }
  });

  // Batch completion
  validationPipeline.on('batch-complete', async (results) => {
    await outputStreamer.writeEvent({
      type: 'batch-complete',
      timestamp: new Date().toISOString(),
      batchId: results.batchId,
      totalPhases: results.phases.length,
      successfulPhases: results.phases.filter(p => p.ok).length,
      totalProcessingTime: results.totalProcessingTime,
      overallCoverage: results.overallCoverage,
    });

    // Update resource manager with batch metrics
    resourceManager.recordBatch(results);
  });

  // Error handling
  watcher.on('error', (error) => {
    outputStreamer.writeEvent({
      type: 'error',
      timestamp: new Date().toISOString(),
      component: 'watcher',
      error: {
        message: error.message,
        stack: error.stack,
      },
    }).catch(() => {}); // Ignore write errors during error handling
  });

  validationPipeline.on('error', (error) => {
    outputStreamer.writeEvent({
      type: 'error',
      timestamp: new Date().toISOString(),
      component: 'validation-pipeline',
      error: {
        message: error.message,
        stack: error.stack,
      },
    }).catch(() => {});
  });

  // Resource warnings
  resourceManager.on('resource-warning', (warning) => {
    outputStreamer.writeEvent({
      type: 'resource-warning',
      timestamp: new Date().toISOString(),
      warning: warning.message,
      currentUsage: warning.currentUsage,
      limits: warning.limits,
    }).catch(() => {});
  });

  // Heartbeat
  watcher.on('heartbeat', async (metrics) => {
    await outputStreamer.writeEvent({
      type: 'heartbeat',
      timestamp: new Date().toISOString(),
      uptime: metrics.uptime,
      filesWatched: metrics.filesWatched,
      validationsRun: metrics.validationsRun,
      errorsCount: metrics.errorsCount,
      memoryUsage: process.memoryUsage(),
      resourceUsage: resourceManager.getUsageStats(),
    });
  });
}

/**
 * Check if a file path matches any of the given patterns
 */
function matchesAnyPattern(filePath: string, patterns: string[]): boolean {
  return patterns.some(pattern => {
    // Simple glob pattern matching (can be enhanced with a proper glob library)
    const regex = pattern
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '.');
    
    return new RegExp(`^${regex}$`).test(filePath);
  });
}

/**
 * Help text for the watch command
 */
export function getWatchCommandHelp(): string {
  return `
ARBITER WATCH - Continuous Validation Loop

The watch command provides real-time monitoring and validation of your project files
with intelligent change detection, resource management, and structured NDJSON output.

VALIDATION PIPELINE:
  validate   → CUE file validation and syntax checking
  surface    → API surface analysis and compatibility
  ui         → UI profile validation and accessibility checks  
  contracts  → Contract validation and coverage analysis
  budgets    → Resource budget compliance checking

RESOURCE LIMITS:
  • Maximum payload size: 64 KB per validation
  • Maximum processing time: 750 ms per phase
  • Maximum rate: ~1 validation per second
  • Automatic batching and backoff strategies

NDJSON OUTPUT FORMAT:
  Each line contains: { phase, ok, deltas, coverage }
  
EXAMPLES:
  arbiter watch                                    # Watch all CUE/JSON/YAML files
  arbiter watch --patterns="**/*.cue"             # Only CUE files
  arbiter watch --fast --selective=validate,ui    # Fast mode, only validate and UI
  arbiter watch --output=validation.ndjson        # Save to file
  arbiter watch --timeout=1000 --max-rate=2       # Custom resource limits
  arbiter watch --parallel=8 --buffer-size=100    # Performance tuning

INTEGRATION:
  The NDJSON output can be consumed by external tools and AI agents for
  automated analysis, reporting, and decision-making.
  `;
}

export default createWatchCommand;
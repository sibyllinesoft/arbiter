/**
 * Main file watcher that monitors CUE files and performs real-time validation
 * with NDJSON output for agent consumption
 */

import { watch, FSWatcher } from 'chokidar';
import { EventEmitter } from 'events';
import { resolve, relative } from 'path';
import { 
  WatcherConfig, 
  WatcherState, 
  WatcherMetrics, 
  FileEvent, 
  ValidationResult, 
  WatcherError, 
  FileSystemError,
  WatcherConfigSchema 
} from './types.js';
import { NDJSONReporter, NDJSONReporterOptions } from './ndjson-reporter.js';
import { LiveValidator, ValidatorOptions } from './validator.js';
import { ChangeDetector, ChangeDetectorOptions } from './change-detector.js';

export interface FileWatcherEvents {
  'file-event': (event: FileEvent) => void;
  'validation-result': (result: ValidationResult) => void;
  'validation-batch': (results: ValidationResult[], batchId: string) => void;
  'error': (error: Error) => void;
  'ready': () => void;
  'status-change': (status: WatcherState['status']) => void;
}

export declare interface FileWatcher {
  on<K extends keyof FileWatcherEvents>(event: K, listener: FileWatcherEvents[K]): this;
  off<K extends keyof FileWatcherEvents>(event: K, listener: FileWatcherEvents[K]): this;
  emit<K extends keyof FileWatcherEvents>(event: K, ...args: Parameters<FileWatcherEvents[K]>): boolean;
}

export class FileWatcher extends EventEmitter {
  private fsWatcher: FSWatcher | null = null;
  private reporter: NDJSONReporter;
  private validator: LiveValidator;
  private changeDetector: ChangeDetector;
  private state: WatcherState;
  private debounceTimers = new Map<string, NodeJS.Timeout>();
  private validationBatches = new Map<string, { files: string[], timer: NodeJS.Timeout }>();
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private metricsTimer: NodeJS.Timeout | null = null;
  private shutdownSignal: AbortController = new AbortController();

  constructor(private readonly config: WatcherConfig) {
    super();
    
    // Validate configuration
    const validation = WatcherConfigSchema.safeParse(config);
    if (!validation.success) {
      throw new WatcherError(
        `Invalid watcher configuration: ${validation.error.message}`,
        'INVALID_CONFIG',
        { zodError: validation.error }
      );
    }

    // Initialize state
    this.state = {
      status: 'starting',
      startTime: new Date(),
      filesWatched: 0,
      validationsRun: 0,
      errorsCount: 0,
      activeValidations: 0,
      lastHeartbeat: new Date(),
      fileStates: new Map(),
      dependencyGraph: {
        dependencies: new Map(),
        dependents: new Map(),
        lastModified: new Map(),
      },
    };

    // Initialize components
    this.reporter = new NDJSONReporter({
      stream: config.output.stream,
      bufferSize: config.output.bufferSize,
      flushInterval: config.output.flushInterval,
      enableFiltering: false,
    });

    this.validator = new LiveValidator({
      cueExecutablePath: 'cue',
      contractsPath: './contracts',
      timeout: config.validation.timeout,
      enableContracts: config.validation.enableContracts,
      enableDependencyCheck: config.validation.enableDependencyCheck,
      cueModuleRoot: process.cwd(),
      maxFileSize: 10 * 1024 * 1024,
      parallelValidations: config.validation.parallelValidations,
    });

    this.changeDetector = new ChangeDetector({
      cacheSize: 10000,
      hashAlgorithm: 'sha256',
      dependencyPatterns: [
        /import\s+.*\s+from\s+["']([^"']+)["']/g,
        /require\s*\(\s*["']([^"']+)["']\s*\)/g,
        /package\s+([a-zA-Z_][a-zA-Z0-9_]*)/g,
        /#import\s+["']([^"']+)["']/g,
      ],
      exclusionPatterns: [
        /node_modules/,
        /\.git/,
        /dist/,
        /build/,
        /coverage/,
      ],
      trackContent: true,
    });

    // Set up event handlers
    this.setupEventHandlers();
  }

  /**
   * Start the file watcher
   */
  async start(): Promise<void> {
    try {
      this.updateStatus('starting');
      this.reporter.reportStatus('starting', 'Initializing file watcher');

      // Validate watch paths
      await this.validateWatchPaths();

      // Initialize file watcher
      this.fsWatcher = watch([...this.config.watchPaths], {
        ignored: this.config.watchOptions.ignored,
        ignoreInitial: this.config.watchOptions.ignoreInitial ?? false,
        followSymlinks: this.config.watchOptions.followSymlinks ?? true,
        depth: this.config.watchOptions.depth,
        awaitWriteFinish: this.config.watchOptions.awaitWriteFinish,
        persistent: true,
        usePolling: false,
        interval: 100,
        binaryInterval: 300,
      });

      // Set up file watcher event handlers
      this.setupFileWatcherEvents();

      // Start heartbeat if enabled
      if (this.config.heartbeat.enabled) {
        this.startHeartbeat();
      }

      // Start metrics collection
      this.startMetricsCollection();

      // Wait for initial scan to complete
      await new Promise<void>((resolve) => {
        this.fsWatcher!.on('ready', () => {
          this.updateStatus('running');
          this.reporter.reportStatus('running', 'File watcher is running');
          this.emit('ready');
          resolve();
        });
      });

      console.log(`File watcher started, monitoring ${this.config.watchPaths.length} path(s)`);

    } catch (error) {
      this.updateStatus('error');
      const watcherError = error instanceof WatcherError ? error : 
        new WatcherError(
          `Failed to start file watcher: ${error instanceof Error ? error.message : String(error)}`,
          'START_FAILED',
          { originalError: error }
        );
      
      this.reporter.reportError('Failed to start file watcher', watcherError);
      this.emit('error', watcherError);
      throw watcherError;
    }
  }

  /**
   * Stop the file watcher gracefully
   */
  async stop(): Promise<void> {
    try {
      this.updateStatus('stopping');
      this.reporter.reportStatus('stopping', 'Shutting down file watcher');
      
      // Signal shutdown to all async operations
      this.shutdownSignal.abort();

      // Clear all timers
      this.clearAllTimers();

      // Wait for active validations to complete (with timeout)
      await this.waitForActiveValidations(10000);

      // Close file system watcher
      if (this.fsWatcher) {
        await this.fsWatcher.close();
        this.fsWatcher = null;
      }

      // Cleanup components
      this.validator.destroy();
      this.reporter.stop();

      this.updateStatus('stopped');
      this.reporter.reportStatus('stopped', 'File watcher stopped');

      console.log('File watcher stopped gracefully');

    } catch (error) {
      const watcherError = error instanceof WatcherError ? error :
        new WatcherError(
          `Error during shutdown: ${error instanceof Error ? error.message : String(error)}`,
          'SHUTDOWN_ERROR',
          { originalError: error }
        );
      
      this.reporter.reportError('Error during shutdown', watcherError);
      this.emit('error', watcherError);
      throw watcherError;
    }
  }

  /**
   * Get current watcher state
   */
  getState(): WatcherState {
    return { ...this.state };
  }

  /**
   * Get current metrics
   */
  getMetrics(): WatcherMetrics {
    const validationStats = this.validator.getStats();
    
    return {
      totalValidations: this.state.validationsRun,
      averageValidationTime: this.calculateAverageValidationTime(),
      validationsByType: new Map(), // Would need to track this
      errorRate: this.state.errorsCount / Math.max(this.state.validationsRun, 1),
      throughput: this.calculateThroughput(),
      memoryUsage: {
        used: process.memoryUsage().heapUsed,
        total: process.memoryUsage().heapTotal,
        external: process.memoryUsage().external,
      },
    };
  }

  /**
   * Validate that watch paths exist and are accessible
   */
  private async validateWatchPaths(): Promise<void> {
    const { access } = await import('fs/promises');
    
    for (const watchPath of this.config.watchPaths) {
      try {
        await access(resolve(watchPath));
      } catch (error) {
        throw new FileSystemError(
          `Watch path not accessible: ${watchPath}`,
          'validate-watch-path',
          watchPath
        );
      }
    }
  }

  /**
   * Set up file watcher event handlers
   */
  private setupFileWatcherEvents(): void {
    if (!this.fsWatcher) return;

    this.fsWatcher.on('add', (path, stats) => 
      this.handleFileSystemEvent('add', path, stats)
    );
    
    this.fsWatcher.on('change', (path, stats) => 
      this.handleFileSystemEvent('change', path, stats)
    );
    
    this.fsWatcher.on('unlink', (path) => 
      this.handleFileSystemEvent('unlink', path)
    );
    
    this.fsWatcher.on('addDir', (path, stats) => 
      this.handleFileSystemEvent('addDir', path, stats)
    );
    
    this.fsWatcher.on('unlinkDir', (path) => 
      this.handleFileSystemEvent('unlinkDir', path)
    );

    this.fsWatcher.on('error', (error) => {
      this.state.errorsCount++;
      const watcherError = new FileSystemError(
        `File system watcher error: ${error.message}`,
        'fs-watcher-error',
        undefined,
        { originalError: error }
      );
      
      this.reporter.reportError('File system watcher error', watcherError);
      this.emit('error', watcherError);
    });
  }

  /**
   * Set up internal event handlers
   */
  private setupEventHandlers(): void {
    // Handle process signals for graceful shutdown
    const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT', 'SIGUSR2'];
    signals.forEach(signal => {
      process.on(signal, async () => {
        console.log(`Received ${signal}, shutting down gracefully...`);
        try {
          await this.stop();
          process.exit(0);
        } catch (error) {
          console.error('Error during graceful shutdown:', error);
          process.exit(1);
        }
      });
    });

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      this.state.errorsCount++;
      this.reporter.reportError('Uncaught exception', error);
      this.emit('error', error);
    });

    process.on('unhandledRejection', (reason) => {
      this.state.errorsCount++;
      const error = reason instanceof Error ? reason : new Error(String(reason));
      this.reporter.reportError('Unhandled promise rejection', error);
      this.emit('error', error);
    });
  }

  /**
   * Handle file system events
   */
  private async handleFileSystemEvent(
    eventType: 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir',
    path: string,
    stats?: import('fs').Stats
  ): Promise<void> {
    try {
      const fileEvent: FileEvent = {
        type: eventType,
        path: relative(process.cwd(), path),
        stats: stats ? {
          size: stats.size,
          mtime: stats.mtime,
          ctime: stats.ctime,
        } : undefined,
        timestamp: new Date(),
      };

      // Report the file event
      this.reporter.reportFileEvent(fileEvent);
      this.emit('file-event', fileEvent);

      // Only process relevant file types for validation
      if (!this.shouldValidateFile(path)) {
        return;
      }

      // Use debouncing to avoid excessive validations
      this.debounceValidation(path, fileEvent);

    } catch (error) {
      this.state.errorsCount++;
      const watcherError = new FileSystemError(
        `Error handling file system event: ${error instanceof Error ? error.message : String(error)}`,
        'handle-fs-event',
        path,
        { eventType, originalError: error }
      );
      
      this.reporter.reportError('File system event handling error', watcherError);
      this.emit('error', watcherError);
    }
  }

  /**
   * Check if a file should be validated
   */
  private shouldValidateFile(path: string): boolean {
    const ext = path.split('.').pop()?.toLowerCase();
    return ext === 'cue' || ext === 'json' || ext === 'yaml' || ext === 'yml';
  }

  /**
   * Debounce validation to avoid excessive processing
   */
  private debounceValidation(path: string, event: FileEvent): void {
    // Clear existing timer for this file
    const existingTimer = this.debounceTimers.get(path);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer
    const timer = setTimeout(async () => {
      this.debounceTimers.delete(path);
      await this.processFileForValidation(path, event);
    }, this.config.validation.debounceMs);

    this.debounceTimers.set(path, timer);
  }

  /**
   * Process a file for validation
   */
  private async processFileForValidation(path: string, event: FileEvent): Promise<void> {
    try {
      // Use change detector to determine what needs validation
      const changeSet = await this.changeDetector.processFileEvent(event);
      
      if (changeSet.files.length === 0) {
        return; // No validation needed
      }

      // Create batch for validation
      const batchId = this.createBatchId();
      await this.processBatchValidation(changeSet.files, changeSet.dependencies, batchId);

    } catch (error) {
      this.state.errorsCount++;
      const validationError = new WatcherError(
        `Error processing file for validation: ${error instanceof Error ? error.message : String(error)}`,
        'VALIDATION_PROCESSING_ERROR',
        { path, event, originalError: error }
      );
      
      this.reporter.reportError('Validation processing error', validationError);
      this.emit('error', validationError);
    }
  }

  /**
   * Process batch validation
   */
  private async processBatchValidation(
    files: string[], 
    dependencies: string[], 
    batchId: string
  ): Promise<void> {
    const startTime = Date.now();
    
    try {
      this.state.activeValidations++;
      
      // Create dependency map
      const dependencyMap = new Map<string, string[]>();
      for (const file of files) {
        const fileDeps = this.changeDetector.getDependencyChain(file);
        dependencyMap.set(file, fileDeps);
      }

      // Validate files in batch
      const results = await this.validator.validateBatch([...files], dependencyMap);
      
      // Update metrics
      this.state.validationsRun += results.length;
      this.state.errorsCount += results.reduce((sum, r) => sum + r.errors.length, 0);

      // Report individual results
      for (const result of results) {
        this.reporter.reportValidationResult(result);
        this.emit('validation-result', result);
      }

      // Report batch summary
      const processingTime = Date.now() - startTime;
      this.reporter.reportBatch(results, batchId, processingTime);
      this.emit('validation-batch', results, batchId);

    } catch (error) {
      this.state.errorsCount++;
      const batchError = new WatcherError(
        `Batch validation failed: ${error instanceof Error ? error.message : String(error)}`,
        'BATCH_VALIDATION_ERROR',
        { files, batchId, originalError: error }
      );
      
      this.reporter.reportError('Batch validation error', batchError);
      this.emit('error', batchError);
    } finally {
      this.state.activeValidations--;
    }
  }

  /**
   * Start heartbeat reporting
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      const uptime = Date.now() - this.state.startTime.getTime();
      this.reporter.reportHeartbeat(
        uptime,
        this.state.filesWatched,
        this.state.validationsRun,
        this.state.errorsCount
      );
      this.state.lastHeartbeat = new Date();
    }, this.config.heartbeat.interval);
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    this.metricsTimer = setInterval(() => {
      const metrics = this.getMetrics();
      this.reporter.reportMetrics(metrics);
    }, 60000); // Report metrics every minute
  }

  /**
   * Clear all timers
   */
  private clearAllTimers(): void {
    // Clear debounce timers
    for (const timer of Array.from(this.debounceTimers.values())) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    // Clear batch timers
    for (const batch of Array.from(this.validationBatches.values())) {
      clearTimeout(batch.timer);
    }
    this.validationBatches.clear();

    // Clear heartbeat timer
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    // Clear metrics timer
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
      this.metricsTimer = null;
    }
  }

  /**
   * Wait for active validations to complete
   */
  private async waitForActiveValidations(timeoutMs: number): Promise<void> {
    const startTime = Date.now();
    
    while (this.state.activeValidations > 0 && Date.now() - startTime < timeoutMs) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (this.state.activeValidations > 0) {
      console.warn(`Timed out waiting for ${this.state.activeValidations} active validations to complete`);
    }
  }

  /**
   * Update watcher status
   */
  private updateStatus(status: WatcherState['status']): void {
    const previousStatus = this.state.status;
    this.state.status = status;
    
    if (previousStatus !== status) {
      this.emit('status-change', status);
    }
  }

  /**
   * Create unique batch ID
   */
  private createBatchId(): string {
    return `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Calculate average validation time (placeholder)
   */
  private calculateAverageValidationTime(): number {
    // This would need to be tracked over time
    return 0;
  }

  /**
   * Calculate throughput (placeholder)
   */
  private calculateThroughput(): number {
    const uptimeSeconds = (Date.now() - this.state.startTime.getTime()) / 1000;
    return this.state.validationsRun / Math.max(uptimeSeconds, 1);
  }
}

/**
 * Create and configure a file watcher instance
 */
export function createFileWatcher(
  watchPaths: string[],
  options: Partial<WatcherConfig> = {}
): FileWatcher {
  const defaultConfig: WatcherConfig = {
    watchPaths,
    watchOptions: {
      ignored: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**'],
      ignoreInitial: false,
      followSymlinks: true,
      depth: undefined,
      awaitWriteFinish: {
        stabilityThreshold: 2000,
        pollInterval: 100,
      },
    },
    validation: {
      debounceMs: 300,
      batchSize: 10,
      timeout: 30000,
      enableContracts: true,
      enableDependencyCheck: true,
      parallelValidations: 4,
    },
    output: {
      format: 'ndjson',
      stream: process.stdout,
      bufferSize: 100,
      flushInterval: 1000,
    },
    heartbeat: {
      enabled: true,
      interval: 30000,
    },
  };

  const config = { ...defaultConfig, ...options };
  return new FileWatcher(config);
}

/**
 * CLI entry point for the file watcher
 */
export async function startFileWatcherCLI(args: string[] = process.argv.slice(2)): Promise<void> {
  const watchPaths = args.length > 0 ? args : ['.'];
  
  const watcher = createFileWatcher(watchPaths, {
    output: {
      format: 'ndjson',
      stream: process.stdout,
      bufferSize: 50,
      flushInterval: 500,
    },
  });

  try {
    await watcher.start();
    console.error('File watcher started successfully'); // Use stderr for control messages
    
    // Keep the process running
    await new Promise(() => {}); // Run indefinitely
    
  } catch (error) {
    console.error('Failed to start file watcher:', error);
    process.exit(1);
  }
}

// Export types for external usage
export type {
  WatcherConfig,
  WatcherState,
  WatcherMetrics,
  FileEvent,
  ValidationResult,
  NDJSONEvent,
} from './types.js';
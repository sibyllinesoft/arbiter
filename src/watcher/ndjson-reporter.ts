/**
 * NDJSON output formatter for structured validation results and agent consumption
 */

import { 
  NDJSONEvent, 
  NDJSONFileEvent, 
  NDJSONValidationResult, 
  NDJSONError,
  NDJSONHeartbeat,
  NDJSONStatus,
  ValidationResult, 
  FileEvent,
  WatcherMetrics
} from './types.js';

export interface NDJSONReporterOptions {
  readonly stream: NodeJS.WritableStream;
  readonly bufferSize: number;
  readonly flushInterval: number;
  readonly enableFiltering: boolean;
  readonly filterPatterns?: readonly string[];
}

export class NDJSONReporter {
  private buffer: string[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private totalEventsWritten = 0;
  private bytesWritten = 0;
  private lastFlush = new Date();
  
  constructor(private readonly options: NDJSONReporterOptions) {
    this.startPeriodicFlush();
  }

  /**
   * Report a file system event
   */
  reportFileEvent(event: FileEvent): void {
    const ndjsonEvent: NDJSONFileEvent = {
      type: 'file-event',
      timestamp: new Date(),
      data: event,
    };

    this.writeEvent(ndjsonEvent);
  }

  /**
   * Report a validation result
   */
  reportValidationResult(result: ValidationResult): void {
    const ndjsonEvent: NDJSONValidationResult = {
      type: 'validation-result',
      timestamp: new Date(),
      data: result,
    };

    this.writeEvent(ndjsonEvent);
  }

  /**
   * Report an error
   */
  reportError(message: string, error?: Error, context?: Record<string, any>): void {
    const ndjsonEvent: NDJSONError = {
      type: 'error',
      timestamp: new Date(),
      data: {
        message,
        error: error?.message,
        context: {
          ...context,
          stack: error?.stack,
        },
      },
    };

    this.writeEvent(ndjsonEvent);
  }

  /**
   * Report system heartbeat
   */
  reportHeartbeat(
    uptime: number, 
    filesWatched: number, 
    validationsRun: number, 
    errorsCount: number
  ): void {
    const ndjsonEvent: NDJSONHeartbeat = {
      type: 'heartbeat',
      timestamp: new Date(),
      data: {
        uptime,
        filesWatched,
        validationsRun,
        errorsCount,
      },
    };

    this.writeEvent(ndjsonEvent);
  }

  /**
   * Report watcher status change
   */
  reportStatus(
    status: 'starting' | 'running' | 'stopping' | 'stopped' | 'error',
    message?: string,
    watchedPaths: readonly string[] = [],
    activeValidations = 0
  ): void {
    const ndjsonEvent: NDJSONStatus = {
      type: 'status',
      timestamp: new Date(),
      data: {
        status,
        message,
        watchedPaths,
        activeValidations,
      },
    };

    this.writeEvent(ndjsonEvent);
  }

  /**
   * Report performance metrics
   */
  reportMetrics(metrics: WatcherMetrics): void {
    const ndjsonEvent: NDJSONEvent = {
      type: 'metrics' as any,
      timestamp: new Date(),
      data: {
        totalValidations: metrics.totalValidations,
        averageValidationTime: metrics.averageValidationTime,
        validationsByType: Object.fromEntries(metrics.validationsByType),
        errorRate: metrics.errorRate,
        throughput: metrics.throughput,
        memoryUsage: metrics.memoryUsage,
      },
    };

    this.writeEvent(ndjsonEvent);
  }

  /**
   * Report aggregated validation results for a batch of files
   */
  reportBatch(
    results: readonly ValidationResult[], 
    batchId: string,
    processingTime: number
  ): void {
    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'error').length;
    const warningCount = results.filter(r => r.status === 'warning').length;

    const ndjsonEvent: NDJSONEvent = {
      type: 'batch-result' as any,
      timestamp: new Date(),
      data: {
        batchId,
        filesProcessed: results.length,
        successCount,
        errorCount,
        warningCount,
        processingTime,
        results: results.map(r => ({
          filePath: r.filePath,
          status: r.status,
          validationType: r.validationType,
          errorCount: r.errors.length,
          warningCount: r.warnings.length,
          duration: r.duration,
        })),
      },
    };

    this.writeEvent(ndjsonEvent);
  }

  /**
   * Write a generic event to the stream
   */
  private writeEvent(event: NDJSONEvent): void {
    try {
      // Apply filtering if enabled
      if (this.options.enableFiltering && !this.shouldIncludeEvent(event)) {
        return;
      }

      const jsonLine = JSON.stringify(event, this.jsonReplacer) + '\n';
      
      // Add to buffer
      this.buffer.push(jsonLine);
      this.bytesWritten += Buffer.byteLength(jsonLine);

      // Flush if buffer is full
      if (this.buffer.length >= this.options.bufferSize) {
        this.flush();
      }

    } catch (error) {
      // Fallback error reporting directly to stream
      const errorLine = JSON.stringify({
        type: 'error',
        timestamp: new Date().toISOString(),
        data: {
          message: 'Failed to serialize event',
          error: error instanceof Error ? error.message : String(error),
          originalEventType: event.type,
        },
      }) + '\n';

      this.options.stream.write(errorLine);
    }
  }

  /**
   * Check if event should be included based on filter patterns
   */
  private shouldIncludeEvent(event: NDJSONEvent): boolean {
    if (!this.options.filterPatterns || this.options.filterPatterns.length === 0) {
      return true;
    }

    // Simple pattern matching - can be extended with more sophisticated filtering
    const eventString = JSON.stringify(event);
    return this.options.filterPatterns.some(pattern => {
      if (pattern.startsWith('/') && pattern.endsWith('/')) {
        // Regex pattern
        const regex = new RegExp(pattern.slice(1, -1));
        return regex.test(eventString);
      } else {
        // Simple string contains
        return eventString.includes(pattern);
      }
    });
  }

  /**
   * Custom JSON replacer for handling special types
   */
  private jsonReplacer(key: string, value: any): any {
    // Handle Date objects
    if (value instanceof Date) {
      return value.toISOString();
    }

    // Handle Map objects
    if (value instanceof Map) {
      return Object.fromEntries(value);
    }

    // Handle Set objects
    if (value instanceof Set) {
      return Array.from(value);
    }

    // Handle circular references (basic detection)
    if (value && typeof value === 'object') {
      try {
        JSON.stringify(value);
      } catch {
        return '[Circular Reference]';
      }
    }

    return value;
  }

  /**
   * Flush buffered events to stream
   */
  flush(): void {
    if (this.buffer.length === 0) {
      return;
    }

    try {
      const content = this.buffer.join('');
      this.buffer = [];
      
      this.options.stream.write(content);
      this.totalEventsWritten += this.buffer.length;
      this.lastFlush = new Date();

    } catch (error) {
      // Try to report the error
      const errorLine = JSON.stringify({
        type: 'error',
        timestamp: new Date().toISOString(),
        data: {
          message: 'Failed to flush buffer to stream',
          error: error instanceof Error ? error.message : String(error),
          bufferSize: this.buffer.length,
        },
      }) + '\n';

      try {
        this.options.stream.write(errorLine);
      } catch {
        // Silent fail - stream is likely broken
      }

      // Clear buffer to prevent memory leak
      this.buffer = [];
    }
  }

  /**
   * Start periodic buffer flushing
   */
  private startPeriodicFlush(): void {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.options.flushInterval);
  }

  /**
   * Stop periodic flushing and do final flush
   */
  stop(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    // Final flush
    this.flush();
  }

  /**
   * Get reporter statistics
   */
  getStats(): {
    totalEventsWritten: number;
    bytesWritten: number;
    bufferSize: number;
    lastFlush: Date;
  } {
    return {
      totalEventsWritten: this.totalEventsWritten,
      bytesWritten: this.bytesWritten,
      bufferSize: this.buffer.length,
      lastFlush: this.lastFlush,
    };
  }

  /**
   * Create a child reporter with additional filtering
   */
  createFilteredReporter(
    filterPatterns: readonly string[],
    stream?: NodeJS.WritableStream
  ): NDJSONReporter {
    return new NDJSONReporter({
      ...this.options,
      stream: stream || this.options.stream,
      enableFiltering: true,
      filterPatterns: [...(this.options.filterPatterns || []), ...filterPatterns],
    });
  }

  /**
   * Create aggregation helpers for common patterns
   */
  createAggregator(): NDJSONAggregator {
    return new NDJSONAggregator(this);
  }
}

/**
 * Helper class for aggregating and analyzing NDJSON events
 */
export class NDJSONAggregator {
  private stats = {
    fileEvents: 0,
    validationResults: 0,
    errors: 0,
    warnings: 0,
    byFilePath: new Map<string, number>(),
    byValidationType: new Map<string, number>(),
  };

  constructor(private readonly reporter: NDJSONReporter) {}

  /**
   * Process validation results and emit aggregated statistics
   */
  processValidationBatch(results: readonly ValidationResult[]): void {
    results.forEach(result => {
      this.stats.validationResults++;
      this.stats.errors += result.errors.length;
      this.stats.warnings += result.warnings.length;
      
      // Track by file path
      const pathCount = this.stats.byFilePath.get(result.filePath) || 0;
      this.stats.byFilePath.set(result.filePath, pathCount + 1);
      
      // Track by validation type
      const typeCount = this.stats.byValidationType.get(result.validationType) || 0;
      this.stats.byValidationType.set(result.validationType, typeCount + 1);
    });

    // Report aggregated stats
    const aggregatedEvent: NDJSONEvent = {
      type: 'aggregated-stats' as any,
      timestamp: new Date(),
      data: {
        totalValidations: this.stats.validationResults,
        totalErrors: this.stats.errors,
        totalWarnings: this.stats.warnings,
        filePathStats: Object.fromEntries(this.stats.byFilePath),
        validationTypeStats: Object.fromEntries(this.stats.byValidationType),
        topErrorFiles: Array.from(this.stats.byFilePath.entries())
          .sort(([, a], [, b]) => b - a)
          .slice(0, 10)
          .map(([path, count]) => ({ path, validationCount: count })),
      },
    };

    // Write directly to avoid recursive calls
    this.reporter['writeEvent'](aggregatedEvent);
  }

  /**
   * Get current aggregation statistics
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  reset(): void {
    this.stats = {
      fileEvents: 0,
      validationResults: 0,
      errors: 0,
      warnings: 0,
      byFilePath: new Map(),
      byValidationType: new Map(),
    };
  }
}
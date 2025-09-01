/**
 * NDJSON Output Streamer
 * 
 * Handles structured output streaming with format: { phase, ok, deltas, coverage }
 * Supports buffering, compression, validation, and multiple output formats.
 */

import { EventEmitter } from 'events';
import { createWriteStream, WriteStream } from 'fs';
import { logger } from '../utils/logger.js';
import * as path from 'path';

export interface OutputStreamerConfig {
  outputPath: string; // '-' for stdout
  format: 'ndjson' | 'json' | 'table';
  bufferSize: number;
  flushInterval: number;
  enableCompression: boolean;
  enableValidation: boolean;
}

export interface NDJSONEvent {
  type: string;
  timestamp: string;
  [key: string]: any;
}

export interface ValidationPhaseEvent extends NDJSONEvent {
  type: 'validation-phase';
  phase: string;
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

export interface OutputStreamerEvents {
  'event-written': (event: NDJSONEvent) => void;
  'buffer-flushed': (eventCount: number) => void;
  'error': (error: Error) => void;
  'stream-ready': () => void;
  'stream-closed': () => void;
}

export declare interface OutputStreamer {
  on<K extends keyof OutputStreamerEvents>(event: K, listener: OutputStreamerEvents[K]): this;
  off<K extends keyof OutputStreamerEvents>(event: K, listener: OutputStreamerEvents[K]): this;
  emit<K extends keyof OutputStreamerEvents>(event: K, ...args: Parameters<OutputStreamerEvents[K]>): boolean;
}

export class OutputStreamer extends EventEmitter {
  private config: OutputStreamerConfig;
  private outputStream: WriteStream | NodeJS.WriteStream | null = null;
  private eventBuffer: NDJSONEvent[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private isReady = false;
  private totalEventsWritten = 0;
  private lastFlushTime = Date.now();

  constructor(config: OutputStreamerConfig) {
    super();
    this.config = config;
  }

  /**
   * Start the output streamer
   */
  async start(): Promise<void> {
    logger.debug('🚀 Starting output streamer...');
    
    try {
      await this.initializeOutputStream();
      this.startFlushTimer();
      this.isReady = true;
      
      this.emit('stream-ready');
      logger.info(`✅ Output streamer ready (format: ${this.config.format}, output: ${this.config.outputPath})`);
      
    } catch (error) {
      logger.error('❌ Failed to start output streamer:', error);
      throw error;
    }
  }

  /**
   * Stop the output streamer
   */
  async stop(): Promise<void> {
    logger.debug('🛑 Stopping output streamer...');
    
    this.isReady = false;
    
    // Stop flush timer
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    // Flush remaining events
    await this.flushBuffer();

    // Close output stream if it's a file stream
    if (this.outputStream && this.outputStream !== process.stdout && this.outputStream !== process.stderr) {
      await new Promise<void>((resolve, reject) => {
        (this.outputStream as WriteStream).end((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    }

    this.outputStream = null;
    this.emit('stream-closed');
    
    logger.info(`✅ Output streamer stopped (${this.totalEventsWritten} events written)`);
  }

  /**
   * Write a single event
   */
  async writeEvent(event: NDJSONEvent): Promise<void> {
    if (!this.isReady) {
      throw new Error('OutputStreamer is not ready');
    }

    // Validate event if enabled
    if (this.config.enableValidation) {
      this.validateEvent(event);
    }

    // Add to buffer
    this.eventBuffer.push(event);

    // Flush if buffer is full
    if (this.eventBuffer.length >= this.config.bufferSize) {
      await this.flushBuffer();
    }

    this.emit('event-written', event);
  }

  /**
   * Write multiple events
   */
  async writeEvents(events: NDJSONEvent[]): Promise<void> {
    for (const event of events) {
      await this.writeEvent(event);
    }
  }

  /**
   * Get streaming statistics
   */
  getStats(): {
    totalEventsWritten: number;
    bufferSize: number;
    lastFlushTime: number;
    isReady: boolean;
    outputPath: string;
    format: string;
  } {
    return {
      totalEventsWritten: this.totalEventsWritten,
      bufferSize: this.eventBuffer.length,
      lastFlushTime: this.lastFlushTime,
      isReady: this.isReady,
      outputPath: this.config.outputPath,
      format: this.config.format,
    };
  }

  /**
   * Force flush the buffer
   */
  async flush(): Promise<void> {
    await this.flushBuffer();
  }

  /**
   * Initialize the output stream
   */
  private async initializeOutputStream(): Promise<void> {
    if (this.config.outputPath === '-') {
      // Use stdout
      this.outputStream = process.stdout;
      logger.debug('📤 Using stdout for output');
    } else {
      // Create file stream
      const outputDir = path.dirname(this.config.outputPath);
      
      // Ensure directory exists (would need to import fs.mkdir for real implementation)
      try {
        await import('fs/promises').then(fs => fs.mkdir(outputDir, { recursive: true }));
      } catch (error) {
        // Directory might already exist
      }

      this.outputStream = createWriteStream(this.config.outputPath, {
        flags: 'a', // Append mode
        encoding: 'utf8',
      });

      // Handle stream errors
      this.outputStream.on('error', (error) => {
        logger.error('❌ Output stream error:', error);
        this.emit('error', error);
      });

      logger.debug(`📤 Using file output: ${this.config.outputPath}`);
    }
  }

  /**
   * Start the flush timer
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(async () => {
      if (this.eventBuffer.length > 0) {
        await this.flushBuffer();
      }
    }, this.config.flushInterval);
  }

  /**
   * Flush the event buffer
   */
  private async flushBuffer(): Promise<void> {
    if (this.eventBuffer.length === 0 || !this.outputStream) {
      return;
    }

    const eventsToFlush = [...this.eventBuffer];
    this.eventBuffer = [];

    try {
      const output = this.formatEvents(eventsToFlush);
      
      await new Promise<void>((resolve, reject) => {
        this.outputStream!.write(output, (error) => {
          if (error) reject(error);
          else resolve();
        });
      });

      this.totalEventsWritten += eventsToFlush.length;
      this.lastFlushTime = Date.now();
      
      this.emit('buffer-flushed', eventsToFlush.length);
      
      logger.debug(`📤 Flushed ${eventsToFlush.length} events`);

    } catch (error) {
      logger.error('❌ Error flushing buffer:', error);
      
      // Put events back in buffer for retry
      this.eventBuffer = [...eventsToFlush, ...this.eventBuffer];
      
      this.emit('error', error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Format events according to the configured format
   */
  private formatEvents(events: NDJSONEvent[]): string {
    switch (this.config.format) {
      case 'ndjson':
        return events.map(event => JSON.stringify(event)).join('\n') + '\n';
      
      case 'json':
        return JSON.stringify(events, null, 2) + '\n';
      
      case 'table':
        return this.formatAsTable(events);
      
      default:
        throw new Error(`Unknown output format: ${this.config.format}`);
    }
  }

  /**
   * Format events as a human-readable table
   */
  private formatAsTable(events: NDJSONEvent[]): string {
    let output = '';
    
    for (const event of events) {
      const timestamp = new Date(event.timestamp).toLocaleTimeString();
      
      switch (event.type) {
        case 'validation-phase':
          const phaseEvent = event as ValidationPhaseEvent;
          const status = phaseEvent.ok ? '✅' : '❌';
          const deltas = phaseEvent.deltas.length;
          const timing = `${phaseEvent.processingTime}ms`;
          const coverage = `C:${(phaseEvent.coverage.contracts * 100).toFixed(0)}% S:${(phaseEvent.coverage.scenarios * 100).toFixed(0)}% U:${(phaseEvent.coverage.ui * 100).toFixed(0)}% B:${(phaseEvent.coverage.budgets * 100).toFixed(0)}%`;
          
          output += `${timestamp} ${status} ${phaseEvent.phase.padEnd(10)} ${timing.padStart(6)} ${deltas.toString().padStart(3)}Δ ${coverage}\n`;
          
          if (phaseEvent.errors && phaseEvent.errors.length > 0) {
            phaseEvent.errors.forEach(error => {
              output += `           ⚠️  ${error.file}: ${error.message}\n`;
            });
          }
          break;
          
        case 'batch-complete':
          output += `${timestamp} 📦 BATCH ${event.batchId} - ${event.successfulPhases}/${event.totalPhases} phases OK (${event.totalProcessingTime}ms)\n`;
          break;
          
        case 'startup':
          output += `${timestamp} 🚀 STARTED - watching ${event.config.watchPaths.length} paths\n`;
          break;
          
        case 'error':
          output += `${timestamp} ❌ ERROR ${event.component}: ${event.error.message}\n`;
          break;
          
        case 'heartbeat':
          output += `${timestamp} 💓 ${event.validationsRun} validations, ${event.errorsCount} errors (${Math.round(event.uptime / 1000)}s uptime)\n`;
          break;
          
        default:
          output += `${timestamp} 📋 ${event.type}: ${JSON.stringify(event, null, 0)}\n`;
          break;
      }
    }
    
    return output;
  }

  /**
   * Validate an event structure
   */
  private validateEvent(event: NDJSONEvent): void {
    if (!event.type) {
      throw new Error('Event missing required "type" field');
    }
    
    if (!event.timestamp) {
      throw new Error('Event missing required "timestamp" field');
    }

    // Validate timestamp format
    if (isNaN(Date.parse(event.timestamp))) {
      throw new Error('Event has invalid timestamp format');
    }

    // Additional validation based on event type
    switch (event.type) {
      case 'validation-phase':
        const phaseEvent = event as ValidationPhaseEvent;
        if (!phaseEvent.phase) {
          throw new Error('validation-phase event missing "phase" field');
        }
        if (typeof phaseEvent.ok !== 'boolean') {
          throw new Error('validation-phase event missing or invalid "ok" field');
        }
        if (!Array.isArray(phaseEvent.deltas)) {
          throw new Error('validation-phase event missing or invalid "deltas" field');
        }
        if (!phaseEvent.coverage) {
          throw new Error('validation-phase event missing "coverage" field');
        }
        break;
    }

    // Check payload size
    const eventSize = Buffer.byteLength(JSON.stringify(event), 'utf8');
    if (eventSize > 10 * 1024) { // 10KB per event limit
      logger.warn(`⚠️ Large event size: ${eventSize} bytes`);
    }
  }
}

/**
 * Create and configure an output streamer
 */
export function createOutputStreamer(config: OutputStreamerConfig): OutputStreamer {
  return new OutputStreamer(config);
}

export type { 
  OutputStreamerConfig, 
  NDJSONEvent, 
  ValidationPhaseEvent 
};
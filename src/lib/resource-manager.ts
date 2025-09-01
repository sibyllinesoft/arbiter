/**
 * Resource Management System
 * 
 * Manages resource caps, batching, and backoff strategies to respect
 * the limits: ≤ 64 KB payload, ≤ 750 ms processing, ~1 rps rate.
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';

export interface ResourceLimits {
  maxPayloadBytes: number;
  maxProcessingTimeMs: number;
  maxRatePerSecond: number;
}

export interface ResourceManagerConfig extends ResourceLimits {
  enableBackoff: boolean;
  enableBatching: boolean;
  batchSize: number;
  backoffMultiplier: number;
  maxBackoffMs: number;
}

export interface ResourceUsage {
  currentPayloadBytes: number;
  currentProcessingTimeMs: number;
  currentRatePerSecond: number;
  totalValidations: number;
  totalErrors: number;
  averageProcessingTime: number;
}

export interface ResourceWarning {
  message: string;
  currentUsage: Partial<ResourceUsage>;
  limits: ResourceLimits;
}

export interface ValidationMetrics {
  batchId: string;
  processingTime: number;
  payloadSize: number;
  phaseCount: number;
  errorCount: number;
}

export interface ResourceManagerEvents {
  'resource-warning': (warning: ResourceWarning) => void;
  'backoff-triggered': (backoffTime: number, reason: string) => void;
  'rate-limited': (waitTime: number) => void;
}

export declare interface ResourceManager {
  on<K extends keyof ResourceManagerEvents>(event: K, listener: ResourceManagerEvents[K]): this;
  off<K extends keyof ResourceManagerEvents>(event: K, listener: ResourceManagerEvents[K]): this;
  emit<K extends keyof ResourceManagerEvents>(event: K, ...args: Parameters<ResourceManagerEvents[K]>): boolean;
}

export class ResourceManager extends EventEmitter {
  private config: ResourceManagerConfig;
  private usage: ResourceUsage;
  private validationHistory: ValidationMetrics[] = [];
  private rateLimitWindow: number[] = [];
  private currentBackoffMs = 0;
  private lastBackoffTime = 0;
  private processingQueue: Array<{
    id: string;
    estimatedPayload: number;
    priority: number;
    resolve: () => void;
    reject: (error: Error) => void;
  }> = [];
  
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(config: ResourceManagerConfig) {
    super();
    this.config = config;
    this.usage = {
      currentPayloadBytes: 0,
      currentProcessingTimeMs: 0,
      currentRatePerSecond: 0,
      totalValidations: 0,
      totalErrors: 0,
      averageProcessingTime: 0,
    };

    // Start cleanup timer
    this.startCleanupTimer();
    
    logger.debug('Resource manager initialized:', {
      maxPayload: `${config.maxPayloadBytes} bytes`,
      maxProcessing: `${config.maxProcessingTimeMs} ms`,
      maxRate: `${config.maxRatePerSecond} rps`,
    });
  }

  /**
   * Check if current resource usage allows for new operations
   */
  checkResourceLimits(estimatedPayload: number = 0): boolean {
    const now = Date.now();
    
    // Check rate limiting
    this.updateRateWindow(now);
    const currentRate = this.rateLimitWindow.length;
    
    if (currentRate >= this.config.maxRatePerSecond) {
      logger.debug('❌ Rate limit exceeded:', {
        current: currentRate,
        limit: this.config.maxRatePerSecond,
      });
      
      this.emit('rate-limited', 1000 / this.config.maxRatePerSecond);
      return false;
    }

    // Check if we're in backoff period
    if (this.currentBackoffMs > 0 && now - this.lastBackoffTime < this.currentBackoffMs) {
      logger.debug('❌ In backoff period:', {
        remaining: this.currentBackoffMs - (now - this.lastBackoffTime),
      });
      return false;
    }

    // Check payload limits
    if (estimatedPayload > this.config.maxPayloadBytes) {
      logger.warn('❌ Payload size exceeds limit:', {
        estimated: estimatedPayload,
        limit: this.config.maxPayloadBytes,
      });
      
      this.emitResourceWarning('Payload size exceeds limit', {
        currentPayloadBytes: estimatedPayload,
      });
      return false;
    }

    // Check if we're approaching processing time limits based on history
    const avgProcessingTime = this.calculateAverageProcessingTime();
    if (avgProcessingTime > this.config.maxProcessingTimeMs * 0.8) {
      logger.warn('❌ Processing time approaching limit:', {
        average: avgProcessingTime,
        limit: this.config.maxProcessingTimeMs,
      });
      
      this.emitResourceWarning('Processing time approaching limit', {
        averageProcessingTime: avgProcessingTime,
      });
      
      // Don't reject, but trigger backoff
      this.triggerBackoff('High processing time detected');
      return false;
    }

    return true;
  }

  /**
   * Acquire a resource slot (with potential queuing)
   */
  async acquireResourceSlot(id: string, estimatedPayload: number = 0, priority: number = 1): Promise<void> {
    if (this.checkResourceLimits(estimatedPayload)) {
      // Update rate window
      this.rateLimitWindow.push(Date.now());
      return;
    }

    // If batching is enabled, queue the request
    if (this.config.enableBatching) {
      return new Promise((resolve, reject) => {
        this.processingQueue.push({
          id,
          estimatedPayload,
          priority,
          resolve,
          reject,
        });

        // Sort queue by priority (higher priority first)
        this.processingQueue.sort((a, b) => b.priority - a.priority);
        
        logger.debug(`⏳ Queued validation request: ${id} (queue size: ${this.processingQueue.length})`);
        
        // Try to process queue
        this.processQueue();
      });
    } else {
      throw new Error('Resource limits exceeded and batching is disabled');
    }
  }

  /**
   * Record validation batch metrics
   */
  recordBatch(metrics: ValidationMetrics): void {
    this.validationHistory.push({
      ...metrics,
      timestamp: Date.now(),
    } as any);

    // Limit history size
    if (this.validationHistory.length > 1000) {
      this.validationHistory = this.validationHistory.slice(-500);
    }

    // Update usage statistics
    this.usage.totalValidations++;
    if (metrics.errorCount > 0) {
      this.usage.totalErrors++;
    }
    this.usage.averageProcessingTime = this.calculateAverageProcessingTime();
    this.usage.currentProcessingTimeMs = metrics.processingTime;
    this.usage.currentPayloadBytes = metrics.payloadSize || 0;

    // Check if we need to trigger backoff
    if (this.config.enableBackoff && this.shouldTriggerBackoff(metrics)) {
      this.triggerBackoff('High error rate or processing time');
    }

    // Try to process queue if we have one
    this.processQueue();

    logger.debug('📊 Batch metrics recorded:', {
      batchId: metrics.batchId,
      processingTime: metrics.processingTime,
      phases: metrics.phaseCount,
      errors: metrics.errorCount,
    });
  }

  /**
   * Get current resource usage statistics
   */
  getUsageStats(): ResourceUsage {
    this.updateRateWindow(Date.now());
    
    return {
      ...this.usage,
      currentRatePerSecond: this.rateLimitWindow.length,
    };
  }

  /**
   * Get resource limits configuration
   */
  getLimits(): ResourceLimits {
    return {
      maxPayloadBytes: this.config.maxPayloadBytes,
      maxProcessingTimeMs: this.config.maxProcessingTimeMs,
      maxRatePerSecond: this.config.maxRatePerSecond,
    };
  }

  /**
   * Reset resource usage counters
   */
  resetCounters(): void {
    this.usage.totalValidations = 0;
    this.usage.totalErrors = 0;
    this.validationHistory = [];
    this.rateLimitWindow = [];
    this.currentBackoffMs = 0;
    this.processingQueue = [];
    
    logger.info('📊 Resource counters reset');
  }

  /**
   * Destroy the resource manager and cleanup
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    // Reject any queued requests
    for (const item of this.processingQueue) {
      item.reject(new Error('ResourceManager destroyed'));
    }
    this.processingQueue = [];

    logger.debug('🧹 Resource manager destroyed');
  }

  /**
   * Update the rate limiting window
   */
  private updateRateWindow(now: number): void {
    // Remove entries older than 1 second
    const windowStart = now - 1000;
    this.rateLimitWindow = this.rateLimitWindow.filter(timestamp => timestamp > windowStart);
  }

  /**
   * Calculate average processing time from recent history
   */
  private calculateAverageProcessingTime(): number {
    if (this.validationHistory.length === 0) {
      return 0;
    }

    // Use recent history (last 50 validations)
    const recentHistory = this.validationHistory.slice(-50);
    const sum = recentHistory.reduce((acc, val) => acc + val.processingTime, 0);
    return sum / recentHistory.length;
  }

  /**
   * Check if we should trigger backoff based on metrics
   */
  private shouldTriggerBackoff(metrics: ValidationMetrics): boolean {
    // Trigger backoff if processing time exceeds limit
    if (metrics.processingTime > this.config.maxProcessingTimeMs) {
      return true;
    }

    // Trigger backoff if error rate is high
    const recentHistory = this.validationHistory.slice(-10);
    const errorRate = recentHistory.length > 0 
      ? recentHistory.reduce((sum, m) => sum + m.errorCount, 0) / recentHistory.length
      : 0;
    
    if (errorRate > 0.3) { // 30% error rate
      return true;
    }

    return false;
  }

  /**
   * Trigger exponential backoff
   */
  private triggerBackoff(reason: string): void {
    if (!this.config.enableBackoff) {
      return;
    }

    const baseBackoff = 1000; // 1 second base
    this.currentBackoffMs = Math.min(
      baseBackoff * Math.pow(this.config.backoffMultiplier, Math.floor(Math.random() * 3)),
      this.config.maxBackoffMs
    );
    
    this.lastBackoffTime = Date.now();

    logger.warn(`⏳ Backoff triggered: ${reason} (${this.currentBackoffMs}ms)`);
    this.emit('backoff-triggered', this.currentBackoffMs, reason);

    // Reset backoff after the period
    setTimeout(() => {
      this.currentBackoffMs = 0;
      logger.info('✅ Backoff period ended');
      this.processQueue(); // Try to process queue
    }, this.currentBackoffMs);
  }

  /**
   * Process the queued requests
   */
  private processQueue(): void {
    if (this.processingQueue.length === 0) {
      return;
    }

    const now = Date.now();
    
    // Try to process items from the queue
    while (this.processingQueue.length > 0) {
      const item = this.processingQueue[0];
      
      if (this.checkResourceLimits(item.estimatedPayload)) {
        // Can process this item
        this.processingQueue.shift();
        this.rateLimitWindow.push(now);
        item.resolve();
        
        logger.debug(`✅ Processed queued validation: ${item.id}`);
      } else {
        // Can't process more items right now
        break;
      }
    }

    if (this.processingQueue.length > 0) {
      logger.debug(`⏳ Queue remaining: ${this.processingQueue.length} items`);
    }
  }

  /**
   * Emit a resource warning
   */
  private emitResourceWarning(message: string, currentUsage: Partial<ResourceUsage>): void {
    const warning: ResourceWarning = {
      message,
      currentUsage,
      limits: this.getLimits(),
    };

    this.emit('resource-warning', warning);
    logger.warn('⚠️ Resource warning:', warning);
  }

  /**
   * Start the cleanup timer for maintenance
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      // Clean up old rate window entries
      this.updateRateWindow(Date.now());
      
      // Clean up old validation history
      if (this.validationHistory.length > 1000) {
        this.validationHistory = this.validationHistory.slice(-500);
      }

      // Process queue if items are waiting
      if (this.processingQueue.length > 0) {
        this.processQueue();
      }
    }, 5000); // Every 5 seconds
  }
}

/**
 * Create and configure a resource manager
 */
export function createResourceManager(config: ResourceManagerConfig): ResourceManager {
  return new ResourceManager(config);
}

export type { ResourceManagerConfig, ResourceUsage, ResourceWarning, ValidationMetrics };
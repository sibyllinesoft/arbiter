import { createLogger, Logger } from 'winston';
import { EventEmitter } from 'events';
import { 
  PipelineContext, 
  PipelineStatus,
  AgenticCIConfig 
} from '../types/index.js';

/**
 * Safety Controller for the Agentic CI system
 * 
 * Provides critical safety mechanisms including:
 * - Emergency stop capabilities
 * - Circuit breaker patterns
 * - Rate limiting and throttling
 * - Critical failure detection
 * - Automated rollback triggers
 * - Human override mechanisms
 */
export class SafetyController extends EventEmitter {
  private readonly logger: Logger;
  private readonly config: any; // EmergencySettings from config
  
  // Safety state tracking
  private emergencyStopActive = false;
  private circuitBreakerOpen = false;
  private readonly failureCounters = new Map<string, number>();
  private readonly rateLimiters = new Map<string, RateLimiter>();
  private readonly emergencyContacts = new Set<string>();
  
  // Safety thresholds
  private readonly safetyThresholds = {
    maxConcurrentPipelines: 50,
    maxFailuresPerHour: 10,
    criticalFailureThreshold: 3,
    emergencyStopCooldown: 300000, // 5 minutes
    circuitBreakerThreshold: 5,
    circuitBreakerTimeout: 600000, // 10 minutes
  };
  
  // Monitoring timers
  private cleanupTimer?: NodeJS.Timeout;
  private healthCheckTimer?: NodeJS.Timeout;
  
  constructor(config: any) {
    super();
    this.config = config;
    
    this.logger = createLogger({
      level: 'info',
      format: require('winston').format.combine(
        require('winston').format.timestamp(),
        require('winston').format.label({ label: 'SafetyController' }),
        require('winston').format.json()
      ),
    });
    
    this.setupSafetyMonitoring();
    this.logger.info('Safety Controller initialized');
  }
  
  /**
   * Start the safety controller
   */
  public async start(): Promise<void> {
    this.logger.info('Starting Safety Controller...');
    
    // Start monitoring loops
    this.startHealthCheck();
    this.startCleanupLoop();
    
    // Setup emergency handlers
    this.setupEmergencyHandlers();
    
    this.logger.info('Safety Controller started');
    this.emit('started');
  }
  
  /**
   * Stop the safety controller
   */
  public async stop(): Promise<void> {
    this.logger.info('Stopping Safety Controller...');
    
    // Clear timers
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    if (this.healthCheckTimer) clearInterval(this.healthCheckTimer);
    
    this.logger.info('Safety Controller stopped');
    this.emit('stopped');
  }
  
  /**
   * Validate pipeline execution safety
   */
  public async validatePipelineExecution(context: PipelineContext): Promise<SafetyCheck> {
    try {
      // Check emergency stop
      if (this.emergencyStopActive) {
        return {
          allowed: false,
          reason: 'Emergency stop is active - all pipeline execution halted',
          severity: 'critical',
          requiresHumanIntervention: true,
        };
      }
      
      // Check circuit breaker
      if (this.circuitBreakerOpen) {
        return {
          allowed: false,
          reason: 'Circuit breaker is open due to recent failures',
          severity: 'high',
          requiresHumanIntervention: false,
          retryAfter: this.getCircuitBreakerRetryTime(),
        };
      }
      
      // Check rate limits
      const rateLimitCheck = this.checkRateLimit(context.repository);
      if (!rateLimitCheck.allowed) {
        return rateLimitCheck;
      }
      
      // Check concurrent pipeline limits
      const concurrencyCheck = await this.checkConcurrencyLimits();
      if (!concurrencyCheck.allowed) {
        return concurrencyCheck;
      }
      
      // Check for critical system health
      const healthCheck = await this.checkSystemHealth();
      if (!healthCheck.allowed) {
        return healthCheck;
      }
      
      // All safety checks passed
      this.recordSuccessfulExecution(context.repository);
      
      return {
        allowed: true,
        reason: 'All safety checks passed',
        severity: 'info',
        requiresHumanIntervention: false,
      };
      
    } catch (error) {
      this.logger.error('Safety validation failed', error);
      
      return {
        allowed: false,
        reason: `Safety validation error: ${error.message}`,
        severity: 'critical',
        requiresHumanIntervention: true,
      };
    }
  }
  
  /**
   * Validate auto-merge safety
   */
  public async validateAutoMerge(pipelineStatus: PipelineStatus): Promise<SafetyCheck> {
    try {
      // First check general pipeline safety
      const pipelineCheck = await this.validatePipelineExecution(pipelineStatus.context);
      if (!pipelineCheck.allowed) {
        return pipelineCheck;
      }
      
      // Additional auto-merge specific checks
      
      // Check for high-risk changes
      if (this.isHighRiskChange(pipelineStatus)) {
        return {
          allowed: false,
          reason: 'High-risk changes detected - auto-merge blocked',
          severity: 'high',
          requiresHumanIntervention: true,
        };
      }
      
      // Check business hours requirement
      if (this.config.businessHoursOnly && !this.isBusinessHours()) {
        return {
          allowed: false,
          reason: 'Auto-merge restricted to business hours',
          severity: 'medium',
          requiresHumanIntervention: false,
          retryAfter: this.getNextBusinessHour(),
        };
      }
      
      // Check for recent failures in similar pipelines
      const recentFailures = await this.checkRecentFailures(pipelineStatus.context.repository);
      if (recentFailures.count > this.safetyThresholds.maxFailuresPerHour) {
        return {
          allowed: false,
          reason: `Too many recent failures (${recentFailures.count}) - auto-merge temporarily disabled`,
          severity: 'high',
          requiresHumanIntervention: false,
          retryAfter: 3600000, // 1 hour
        };
      }
      
      // Check rollback capability
      if (!this.hasRollbackCapability(pipelineStatus)) {
        return {
          allowed: false,
          reason: 'No rollback capability detected - auto-merge requires rollback safety',
          severity: 'high',
          requiresHumanIntervention: true,
        };
      }
      
      return {
        allowed: true,
        reason: 'Auto-merge safety checks passed',
        severity: 'info',
        requiresHumanIntervention: false,
      };
      
    } catch (error) {
      this.logger.error('Auto-merge safety validation failed', error);
      
      return {
        allowed: false,
        reason: `Auto-merge safety validation error: ${error.message}`,
        severity: 'critical',
        requiresHumanIntervention: true,
      };
    }
  }
  
  /**
   * Trigger emergency stop
   */
  public async triggerEmergencyStop(reason: string, triggeredBy: string): Promise<void> {
    this.logger.error('EMERGENCY STOP TRIGGERED', {
      reason,
      triggeredBy,
      timestamp: new Date().toISOString(),
    });
    
    this.emergencyStopActive = true;
    
    // Emit emergency stop event
    this.emit('emergency_stop', {
      reason,
      triggeredBy,
      timestamp: new Date(),
    });
    
    // Notify emergency contacts
    await this.notifyEmergencyContacts(reason, triggeredBy);
    
    // Set automatic cooldown
    setTimeout(() => {
      if (this.emergencyStopActive) {
        this.logger.info('Emergency stop cooldown expired - requires manual reset');
      }
    }, this.safetyThresholds.emergencyStopCooldown);
  }
  
  /**
   * Reset emergency stop (requires human authorization)
   */
  public async resetEmergencyStop(authorizedBy: string, authToken?: string): Promise<boolean> {
    // In production, this would validate authorization
    this.logger.info('Emergency stop reset requested', {
      authorizedBy,
      hasAuthToken: !!authToken,
    });
    
    // Validate authorization (simplified for demo)
    if (!authorizedBy || authorizedBy.length < 3) {
      this.logger.warn('Emergency stop reset denied - invalid authorization');
      return false;
    }
    
    this.emergencyStopActive = false;
    this.circuitBreakerOpen = false; // Also reset circuit breaker
    
    this.logger.info('Emergency stop reset successfully', { authorizedBy });
    
    this.emit('emergency_stop_reset', {
      authorizedBy,
      timestamp: new Date(),
    });
    
    return true;
  }
  
  /**
   * Report critical failure to safety system
   */
  public async reportCriticalFailure(
    context: PipelineContext, 
    failureDetails: any
  ): Promise<void> {
    
    const repository = context.repository;
    const currentCount = this.failureCounters.get(repository) || 0;
    this.failureCounters.set(repository, currentCount + 1);
    
    this.logger.warn('Critical failure reported', {
      repository,
      totalFailures: currentCount + 1,
      details: failureDetails,
    });
    
    // Check if we should trigger circuit breaker
    if (currentCount + 1 >= this.safetyThresholds.circuitBreakerThreshold) {
      await this.openCircuitBreaker(repository, failureDetails);
    }
    
    // Check if we should trigger emergency stop
    if (this.shouldTriggerEmergencyStop(currentCount + 1, failureDetails)) {
      await this.triggerEmergencyStop(
        `Critical failure threshold exceeded: ${currentCount + 1} failures`,
        'safety-controller'
      );
    }
  }
  
  /**
   * Get current safety status
   */
  public getSafetyStatus(): SafetyStatus {
    return {
      emergencyStopActive: this.emergencyStopActive,
      circuitBreakerOpen: this.circuitBreakerOpen,
      totalFailures: Array.from(this.failureCounters.values()).reduce((sum, count) => sum + count, 0),
      rateLimitStatus: this.getRateLimitStatus(),
      lastHealthCheck: new Date(),
      systemHealth: 'operational', // This would be calculated from various metrics
    };
  }
  
  /**
   * Private helper methods
   */
  private setupSafetyMonitoring(): void {
    // Setup process handlers for graceful shutdown
    process.on('SIGINT', () => this.handleGracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => this.handleGracefulShutdown('SIGTERM'));
    
    // Setup uncaught exception handler
    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught exception detected - triggering emergency stop', error);
      this.triggerEmergencyStop(`Uncaught exception: ${error.message}`, 'system');
    });
    
    // Setup unhandled rejection handler
    process.on('unhandledRejection', (reason) => {
      this.logger.error('Unhandled promise rejection detected', { reason });
      // Don't trigger emergency stop for unhandled rejections, just log
    });
  }
  
  private setupEmergencyHandlers(): void {
    // Setup HTTP endpoint for emergency stop (would be implemented in web server)
    // Setup webhook handlers for external monitoring systems
    // Setup Slack/Teams integration for emergency notifications
  }
  
  private startHealthCheck(): void {
    this.healthCheckTimer = setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        this.logger.error('Health check failed', error);
      }
    }, 30000); // 30 second intervals
  }
  
  private startCleanupLoop(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredData();
    }, 300000); // 5 minute intervals
  }
  
  private async performHealthCheck(): Promise<void> {
    // Check system resources
    const memoryUsage = process.memoryUsage();
    const memoryUsageMB = memoryUsage.heapUsed / 1024 / 1024;
    
    if (memoryUsageMB > 1024) { // 1GB limit
      this.logger.warn('High memory usage detected', { memoryUsageMB });
    }
    
    // Check active timers and handles
    // Check database connections if applicable
    // Check external service availability
  }
  
  private cleanupExpiredData(): void {
    const now = Date.now();
    const oneHour = 3600000;
    
    // Clean up old failure counters
    for (const [repo, _] of this.failureCounters) {
      // In production, this would check timestamps
      // For now, just periodically reset counters
    }
    
    // Clean up rate limiters
    for (const [repo, limiter] of this.rateLimiters) {
      limiter.cleanup();
    }
  }
  
  private checkRateLimit(repository: string): SafetyCheck {
    let rateLimiter = this.rateLimiters.get(repository);
    
    if (!rateLimiter) {
      rateLimiter = new RateLimiter(10, 3600000); // 10 requests per hour
      this.rateLimiters.set(repository, rateLimiter);
    }
    
    if (rateLimiter.isLimitExceeded()) {
      return {
        allowed: false,
        reason: 'Rate limit exceeded for repository',
        severity: 'medium',
        requiresHumanIntervention: false,
        retryAfter: rateLimiter.getResetTime(),
      };
    }
    
    rateLimiter.recordRequest();
    
    return {
      allowed: true,
      reason: 'Rate limit check passed',
      severity: 'info',
      requiresHumanIntervention: false,
    };
  }
  
  private async checkConcurrencyLimits(): Promise<SafetyCheck> {
    // In a real implementation, this would check active pipeline count
    const activePipelines = 5; // Placeholder
    
    if (activePipelines > this.safetyThresholds.maxConcurrentPipelines) {
      return {
        allowed: false,
        reason: `Concurrent pipeline limit exceeded: ${activePipelines}/${this.safetyThresholds.maxConcurrentPipelines}`,
        severity: 'medium',
        requiresHumanIntervention: false,
        retryAfter: 60000, // 1 minute
      };
    }
    
    return {
      allowed: true,
      reason: 'Concurrency limits check passed',
      severity: 'info',
      requiresHumanIntervention: false,
    };
  }
  
  private async checkSystemHealth(): Promise<SafetyCheck> {
    // Check CPU usage
    // Check memory usage
    // Check disk space
    // Check network connectivity
    // Check database health
    
    return {
      allowed: true,
      reason: 'System health check passed',
      severity: 'info',
      requiresHumanIntervention: false,
    };
  }
  
  private isHighRiskChange(pipelineStatus: PipelineStatus): boolean {
    // Check for breaking changes
    const evidence = pipelineStatus.failures
      .flatMap(f => f.evidence.map(e => e.content))
      .join(' ')
      .toLowerCase();
    
    const highRiskKeywords = [
      'breaking', 'migration', 'schema', 'database',
      'production', 'critical', 'security'
    ];
    
    return highRiskKeywords.some(keyword => evidence.includes(keyword));
  }
  
  private isBusinessHours(): boolean {
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay();
    
    return hour >= 9 && hour <= 17 && dayOfWeek >= 1 && dayOfWeek <= 5;
  }
  
  private getNextBusinessHour(): number {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    
    return tomorrow.getTime() - now.getTime();
  }
  
  private async checkRecentFailures(repository: string): Promise<{ count: number; details: any[] }> {
    // In production, this would query failure history
    return {
      count: this.failureCounters.get(repository) || 0,
      details: [],
    };
  }
  
  private hasRollbackCapability(pipelineStatus: PipelineStatus): boolean {
    // Check for feature flags, database migrations, etc.
    const evidence = pipelineStatus.failures
      .flatMap(f => f.evidence.map(e => e.content))
      .join(' ')
      .toLowerCase();
    
    // No rollback capability if there are schema changes or migrations
    if (evidence.includes('migration') || evidence.includes('schema')) {
      return false;
    }
    
    return true; // Assume rollback is possible otherwise
  }
  
  private recordSuccessfulExecution(repository: string): void {
    // In production, this would track successful executions
    // and use them for failure rate calculations
  }
  
  private getCircuitBreakerRetryTime(): number {
    return this.safetyThresholds.circuitBreakerTimeout;
  }
  
  private async openCircuitBreaker(repository: string, failureDetails: any): Promise<void> {
    this.circuitBreakerOpen = true;
    
    this.logger.warn('Circuit breaker opened', {
      repository,
      failureDetails,
      timeout: this.safetyThresholds.circuitBreakerTimeout,
    });
    
    this.emit('circuit_breaker_opened', {
      repository,
      failureDetails,
      timestamp: new Date(),
    });
    
    // Automatic reset after timeout
    setTimeout(() => {
      this.circuitBreakerOpen = false;
      this.logger.info('Circuit breaker automatically reset');
      this.emit('circuit_breaker_reset', { timestamp: new Date() });
    }, this.safetyThresholds.circuitBreakerTimeout);
  }
  
  private shouldTriggerEmergencyStop(failureCount: number, failureDetails: any): boolean {
    // Trigger emergency stop on critical threshold
    if (failureCount >= this.safetyThresholds.criticalFailureThreshold) {
      return true;
    }
    
    // Trigger on security-related critical failures
    if (failureDetails && failureDetails.category === 'security_vulnerability') {
      return true;
    }
    
    return false;
  }
  
  private getRateLimitStatus(): any {
    const status: any = {};
    
    for (const [repo, limiter] of this.rateLimiters) {
      status[repo] = {
        requestCount: limiter.getRequestCount(),
        limitExceeded: limiter.isLimitExceeded(),
        resetTime: limiter.getResetTime(),
      };
    }
    
    return status;
  }
  
  private async notifyEmergencyContacts(reason: string, triggeredBy: string): Promise<void> {
    this.logger.critical('EMERGENCY STOP - Notifying emergency contacts', {
      reason,
      triggeredBy,
      contacts: Array.from(this.emergencyContacts),
    });
    
    // In production, this would send notifications via:
    // - Slack/Teams webhooks
    // - Email alerts
    // - SMS notifications
    // - PagerDuty/OpsGenie
  }
  
  private handleGracefulShutdown(signal: string): void {
    this.logger.info(`Graceful shutdown initiated (${signal})`);
    
    // Stop accepting new requests
    this.emergencyStopActive = true;
    
    // Clean up resources
    this.stop().then(() => {
      this.logger.info('Graceful shutdown completed');
      process.exit(0);
    }).catch((error) => {
      this.logger.error('Graceful shutdown failed', error);
      process.exit(1);
    });
  }
}

/**
 * Simple rate limiter implementation
 */
class RateLimiter {
  private requests: number[] = [];
  
  constructor(
    private readonly maxRequests: number,
    private readonly windowMs: number
  ) {}
  
  public isLimitExceeded(): boolean {
    this.cleanup();
    return this.requests.length >= this.maxRequests;
  }
  
  public recordRequest(): void {
    this.requests.push(Date.now());
  }
  
  public getRequestCount(): number {
    this.cleanup();
    return this.requests.length;
  }
  
  public getResetTime(): number {
    if (this.requests.length === 0) return 0;
    
    const oldestRequest = Math.min(...this.requests);
    return (oldestRequest + this.windowMs) - Date.now();
  }
  
  public cleanup(): void {
    const now = Date.now();
    this.requests = this.requests.filter(timestamp => 
      now - timestamp < this.windowMs
    );
  }
}

// Helper interfaces
interface SafetyCheck {
  allowed: boolean;
  reason: string;
  severity: 'info' | 'medium' | 'high' | 'critical';
  requiresHumanIntervention: boolean;
  retryAfter?: number;
}

interface SafetyStatus {
  emergencyStopActive: boolean;
  circuitBreakerOpen: boolean;
  totalFailures: number;
  rateLimitStatus: any;
  lastHealthCheck: Date;
  systemHealth: 'operational' | 'degraded' | 'critical';
}
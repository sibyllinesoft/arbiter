import { EventEmitter } from 'events';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import { performance } from 'perf_hooks';
import type { ConstraintViolationError } from './core.js';

/**
 * Violation event data
 */
export interface ViolationEvent {
  constraint: string;
  violation: ConstraintViolationError;
  timestamp: number;
  operation?: string;
  context?: Record<string, unknown>;
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  operationCount: number;
  totalDuration: number;
  averageDuration: number;
  maxDuration: number;
  minDuration: number;
  violationsCount: number;
  successRate: number;
}

/**
 * Monitoring configuration
 */
export interface MonitoringConfig {
  enableMetrics: boolean;
  enableViolationTracking: boolean;
  metricsRetentionDays: number;
  violationLogPath?: string;
  metricsLogPath?: string;
  alertThresholds: {
    maxViolationsPerHour: number;
    maxAverageResponseTime: number;
    minSuccessRate: number;
  };
}

/**
 * Default monitoring configuration
 */
export const DEFAULT_MONITORING_CONFIG: MonitoringConfig = {
  enableMetrics: true,
  enableViolationTracking: true,
  metricsRetentionDays: 7,
  alertThresholds: {
    maxViolationsPerHour: 10,
    maxAverageResponseTime: 500, // 500ms
    minSuccessRate: 95, // 95%
  },
};

/**
 * Comprehensive constraint monitoring and reporting system
 */
export class ConstraintMonitor extends EventEmitter {
  private readonly config: MonitoringConfig;
  private readonly violations: ViolationEvent[] = [];
  private readonly operationMetrics = new Map<string, PerformanceMetrics>();
  private readonly startTime = Date.now();
  
  private violationCounts = {
    total: 0,
    lastHour: 0,
    byConstraint: new Map<string, number>(),
    byOperation: new Map<string, number>(),
  };

  constructor(config: Partial<MonitoringConfig> = {}) {
    super();
    this.config = { ...DEFAULT_MONITORING_CONFIG, ...config };
    
    if (this.config.enableMetrics || this.config.enableViolationTracking) {
      this.startMonitoring();
    }
  }

  /**
   * Record a constraint violation
   */
  recordViolation(event: ViolationEvent): void {
    if (!this.config.enableViolationTracking) return;

    // Store violation
    this.violations.push(event);
    
    // Update counts
    this.violationCounts.total++;
    this.violationCounts.lastHour++; // Will be reset hourly
    
    const constraintCount = this.violationCounts.byConstraint.get(event.constraint) || 0;
    this.violationCounts.byConstraint.set(event.constraint, constraintCount + 1);
    
    if (event.operation) {
      const operationCount = this.violationCounts.byOperation.get(event.operation) || 0;
      this.violationCounts.byOperation.set(event.operation, operationCount + 1);
    }

    // Emit alert if thresholds exceeded
    this.checkAlertThresholds();
    
    // Log violation
    this.logViolation(event);
    
    // Emit monitoring event
    this.emit('violation_recorded', event);
  }

  /**
   * Record operation performance metrics
   */
  recordOperation(
    operation: string, 
    duration: number, 
    success: boolean, 
    context?: Record<string, unknown>
  ): void {
    if (!this.config.enableMetrics) return;

    const metrics = this.operationMetrics.get(operation) || {
      operationCount: 0,
      totalDuration: 0,
      averageDuration: 0,
      maxDuration: 0,
      minDuration: Infinity,
      violationsCount: 0,
      successRate: 100,
    };

    // Update metrics
    metrics.operationCount++;
    metrics.totalDuration += duration;
    metrics.averageDuration = metrics.totalDuration / metrics.operationCount;
    metrics.maxDuration = Math.max(metrics.maxDuration, duration);
    metrics.minDuration = Math.min(metrics.minDuration, duration);
    
    if (!success) {
      metrics.violationsCount++;
    }
    
    metrics.successRate = ((metrics.operationCount - metrics.violationsCount) / metrics.operationCount) * 100;
    
    this.operationMetrics.set(operation, metrics);
    
    // Log performance data
    this.logPerformanceMetric(operation, duration, success, context);
    
    // Check performance alerts
    this.checkPerformanceAlerts(operation, metrics);
    
    // Emit monitoring event
    this.emit('operation_recorded', { operation, duration, success, metrics });
  }

  /**
   * Generate comprehensive monitoring report
   */
  generateReport(): string {
    const lines: string[] = [];
    const uptime = Date.now() - this.startTime;
    
    lines.push(chalk.bold('🔍 Constraint System Monitoring Report'));
    lines.push(chalk.dim(`Generated: ${new Date().toISOString()}`));
    lines.push(chalk.dim(`Uptime: ${this.formatDuration(uptime)}`));
    lines.push('');

    // Violation Summary
    lines.push(chalk.bold('Violations Summary:'));
    lines.push(`Total Violations: ${this.getViolationColor(this.violationCounts.total)}${this.violationCounts.total}`);
    lines.push(`Last Hour: ${this.getViolationColor(this.violationCounts.lastHour)}${this.violationCounts.lastHour}`);
    lines.push(`Violation Rate: ${this.calculateViolationRate()} violations/hour`);
    lines.push('');

    // Violations by Constraint
    if (this.violationCounts.byConstraint.size > 0) {
      lines.push(chalk.bold('Violations by Constraint:'));
      const sortedConstraints = Array.from(this.violationCounts.byConstraint.entries())
        .sort(([,a], [,b]) => b - a);
      
      for (const [constraint, count] of sortedConstraints) {
        const percentage = ((count / this.violationCounts.total) * 100).toFixed(1);
        lines.push(`  ${chalk.red(constraint)}: ${count} (${percentage}%)`);
      }
      lines.push('');
    }

    // Violations by Operation
    if (this.violationCounts.byOperation.size > 0) {
      lines.push(chalk.bold('Violations by Operation:'));
      const sortedOperations = Array.from(this.violationCounts.byOperation.entries())
        .sort(([,a], [,b]) => b - a);
      
      for (const [operation, count] of sortedOperations.slice(0, 10)) {
        lines.push(`  ${chalk.yellow(operation)}: ${count}`);
      }
      lines.push('');
    }

    // Performance Metrics
    if (this.operationMetrics.size > 0) {
      lines.push(chalk.bold('Performance Metrics:'));
      const sortedMetrics = Array.from(this.operationMetrics.entries())
        .sort(([,a], [,b]) => b.operationCount - a.operationCount);
      
      for (const [operation, metrics] of sortedMetrics.slice(0, 10)) {
        const successColor = metrics.successRate >= 95 ? chalk.green : metrics.successRate >= 80 ? chalk.yellow : chalk.red;
        const avgColor = metrics.averageDuration <= 500 ? chalk.green : metrics.averageDuration <= 750 ? chalk.yellow : chalk.red;
        
        lines.push(`  ${operation}:`);
        lines.push(`    Operations: ${metrics.operationCount}`);
        lines.push(`    Success Rate: ${successColor(metrics.successRate.toFixed(1) + '%')}`);
        lines.push(`    Avg Duration: ${avgColor(Math.round(metrics.averageDuration) + 'ms')}`);
        lines.push(`    Max Duration: ${Math.round(metrics.maxDuration)}ms`);
      }
      lines.push('');
    }

    // Recent Violations
    if (this.violations.length > 0) {
      lines.push(chalk.bold('Recent Violations (Last 10):'));
      const recentViolations = this.violations.slice(-10).reverse();
      
      for (const violation of recentViolations) {
        const timeAgo = this.formatTimeAgo(violation.timestamp);
        lines.push(`  ${chalk.red(violation.constraint)} - ${timeAgo}`);
        lines.push(`    ${chalk.dim(violation.violation.message)}`);
        if (violation.operation) {
          lines.push(`    Operation: ${chalk.yellow(violation.operation)}`);
        }
      }
      lines.push('');
    }

    // Health Status
    lines.push(chalk.bold('System Health:'));
    const healthStatus = this.getSystemHealth();
    const healthColor = healthStatus.isHealthy ? chalk.green : chalk.red;
    lines.push(`Overall Status: ${healthColor(healthStatus.isHealthy ? 'HEALTHY' : 'UNHEALTHY')}`);
    
    if (healthStatus.issues.length > 0) {
      lines.push('Issues:');
      for (const issue of healthStatus.issues) {
        lines.push(`  ${chalk.red('•')} ${issue}`);
      }
    }

    if (healthStatus.recommendations.length > 0) {
      lines.push('Recommendations:');
      for (const rec of healthStatus.recommendations) {
        lines.push(`  ${chalk.yellow('•')} ${rec}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Export monitoring data for external analysis
   */
  async exportData(outputPath: string): Promise<void> {
    const data = {
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      violationCounts: {
        total: this.violationCounts.total,
        lastHour: this.violationCounts.lastHour,
        byConstraint: Object.fromEntries(this.violationCounts.byConstraint),
        byOperation: Object.fromEntries(this.violationCounts.byOperation),
      },
      performanceMetrics: Object.fromEntries(this.operationMetrics),
      recentViolations: this.violations.slice(-100), // Last 100 violations
      systemHealth: this.getSystemHealth(),
    };

    await fs.ensureDir(path.dirname(outputPath));
    await fs.writeJson(outputPath, data, { spaces: 2 });
    
    this.emit('data_exported', { outputPath, recordCount: this.violations.length });
  }

  /**
   * Clear old data based on retention policy
   */
  cleanup(): void {
    const retentionMs = this.config.metricsRetentionDays * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - retentionMs;
    
    // Remove old violations
    const beforeCount = this.violations.length;
    const filtered = this.violations.filter(v => v.timestamp >= cutoff);
    this.violations.length = 0;
    this.violations.push(...filtered);
    
    const cleaned = beforeCount - this.violations.length;
    
    if (cleaned > 0) {
      this.emit('cleanup_completed', { recordsCleaned: cleaned, remaining: this.violations.length });
    }
  }

  /**
   * Get current system health status
   */
  getSystemHealth(): {
    isHealthy: boolean;
    issues: string[];
    recommendations: string[];
    scores: {
      violationScore: number;
      performanceScore: number;
      availabilityScore: number;
      overallScore: number;
    };
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    // Check violation rate
    const violationRate = this.calculateViolationRate();
    const violationScore = Math.max(0, 100 - (violationRate * 10));
    
    if (violationRate > this.config.alertThresholds.maxViolationsPerHour) {
      issues.push(`High violation rate: ${violationRate.toFixed(1)}/hour`);
      recommendations.push('Review constraint configurations and operation patterns');
    }

    // Check performance metrics
    let performanceScore = 100;
    for (const [operation, metrics] of this.operationMetrics.entries()) {
      if (metrics.averageDuration > this.config.alertThresholds.maxAverageResponseTime) {
        issues.push(`Slow operation: ${operation} (${Math.round(metrics.averageDuration)}ms avg)`);
        recommendations.push(`Optimize ${operation} performance`);
        performanceScore = Math.min(performanceScore, 80);
      }
      
      if (metrics.successRate < this.config.alertThresholds.minSuccessRate) {
        issues.push(`Low success rate: ${operation} (${metrics.successRate.toFixed(1)}%)`);
        recommendations.push(`Investigate ${operation} reliability issues`);
        performanceScore = Math.min(performanceScore, 70);
      }
    }

    // Calculate availability score
    const totalOperations = Array.from(this.operationMetrics.values())
      .reduce((sum, m) => sum + m.operationCount, 0);
    const successfulOperations = Array.from(this.operationMetrics.values())
      .reduce((sum, m) => sum + (m.operationCount - m.violationsCount), 0);
    
    const availabilityScore = totalOperations > 0 ? (successfulOperations / totalOperations) * 100 : 100;

    // Overall health score
    const overallScore = (violationScore + performanceScore + availabilityScore) / 3;
    
    return {
      isHealthy: issues.length === 0 && overallScore >= 90,
      issues,
      recommendations,
      scores: {
        violationScore,
        performanceScore,
        availabilityScore,
        overallScore,
      },
    };
  }

  /**
   * Start monitoring background tasks
   */
  private startMonitoring(): void {
    // Reset hourly counters
    setInterval(() => {
      this.violationCounts.lastHour = 0;
    }, 60 * 60 * 1000); // Every hour

    // Cleanup old data
    setInterval(() => {
      this.cleanup();
    }, 24 * 60 * 60 * 1000); // Daily

    // Performance monitoring
    setInterval(() => {
      this.checkSystemHealth();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * Check alert thresholds and emit alerts
   */
  private checkAlertThresholds(): void {
    const violationRate = this.calculateViolationRate();
    
    if (violationRate > this.config.alertThresholds.maxViolationsPerHour) {
      this.emit('alert', {
        type: 'high_violation_rate',
        message: `Violation rate exceeded threshold: ${violationRate.toFixed(1)}/hour`,
        threshold: this.config.alertThresholds.maxViolationsPerHour,
        actual: violationRate,
      });
    }
  }

  /**
   * Check performance alerts for specific operations
   */
  private checkPerformanceAlerts(operation: string, metrics: PerformanceMetrics): void {
    if (metrics.averageDuration > this.config.alertThresholds.maxAverageResponseTime) {
      this.emit('alert', {
        type: 'slow_operation',
        message: `${operation} average response time exceeded threshold`,
        operation,
        threshold: this.config.alertThresholds.maxAverageResponseTime,
        actual: metrics.averageDuration,
      });
    }

    if (metrics.successRate < this.config.alertThresholds.minSuccessRate) {
      this.emit('alert', {
        type: 'low_success_rate',
        message: `${operation} success rate below threshold`,
        operation,
        threshold: this.config.alertThresholds.minSuccessRate,
        actual: metrics.successRate,
      });
    }
  }

  /**
   * Check overall system health periodically
   */
  private checkSystemHealth(): void {
    const health = this.getSystemHealth();
    
    if (!health.isHealthy) {
      this.emit('alert', {
        type: 'system_health',
        message: 'System health degraded',
        issues: health.issues,
        score: health.scores.overallScore,
      });
    }
  }

  /**
   * Log violation to file
   */
  private async logViolation(event: ViolationEvent): Promise<void> {
    if (!this.config.violationLogPath) return;

    try {
      const logEntry = {
        timestamp: new Date(event.timestamp).toISOString(),
        constraint: event.constraint,
        message: event.violation.message,
        operation: event.operation,
        details: event.violation.details,
      };

      const logLine = JSON.stringify(logEntry) + '\n';
      await fs.appendFile(this.config.violationLogPath, logLine);
    } catch (error) {
      this.emit('error', { type: 'log_violation_failed', error });
    }
  }

  /**
   * Log performance metric to file
   */
  private async logPerformanceMetric(
    operation: string,
    duration: number,
    success: boolean,
    context?: Record<string, unknown>
  ): Promise<void> {
    if (!this.config.metricsLogPath) return;

    try {
      const logEntry = {
        timestamp: new Date().toISOString(),
        operation,
        duration,
        success,
        context,
      };

      const logLine = JSON.stringify(logEntry) + '\n';
      await fs.appendFile(this.config.metricsLogPath, logLine);
    } catch (error) {
      this.emit('error', { type: 'log_metric_failed', error });
    }
  }

  /**
   * Calculate current violation rate per hour
   */
  private calculateViolationRate(): number {
    const uptimeHours = (Date.now() - this.startTime) / (1000 * 60 * 60);
    return uptimeHours > 0 ? this.violationCounts.total / uptimeHours : 0;
  }

  /**
   * Get appropriate color for violation count
   */
  private getViolationColor(count: number): typeof chalk.green {
    if (count === 0) return chalk.green;
    if (count <= 5) return chalk.yellow;
    return chalk.red;
  }

  /**
   * Format duration in human-readable format
   */
  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  /**
   * Format time ago in human-readable format
   */
  private formatTimeAgo(timestamp: number): string {
    const elapsed = Date.now() - timestamp;
    const seconds = Math.floor(elapsed / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return `${seconds}s ago`;
  }
}

/**
 * Global monitoring instance
 */
export const globalConstraintMonitor = new ConstraintMonitor();

/**
 * Create monitoring instance with configuration
 */
export function createConstraintMonitor(config?: Partial<MonitoringConfig>): ConstraintMonitor {
  return new ConstraintMonitor(config);
}
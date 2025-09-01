import { createLogger, Logger } from 'winston';
import { EventEmitter } from 'events';
import { SystemMetrics, SystemMetricsSchema } from '../types/index.js';

/**
 * Metrics collection and monitoring for the Agentic CI system
 * 
 * Collects and analyzes:
 * - Agent performance metrics (response time, accuracy)
 * - System throughput and capacity
 * - Decision quality and false positive/negative rates
 * - Resource usage and costs
 * - Auto-merge success rates
 * - User satisfaction and adoption metrics
 */
export class MetricsCollector extends EventEmitter {
  private readonly logger: Logger;
  
  // Metric storage
  private readonly metrics: SystemMetrics[] = [];
  private readonly maxMetricsHistory = 10000;
  
  // Real-time counters
  private pipelinesProcessed = 0;
  private autoMergesCompleted = 0;
  private autoMergesBlocked = 0;
  private decisionsCorrect = 0;
  private decisionsIncorrect = 0;
  private falsePositives = 0;
  private falseNegatives = 0;
  
  // Performance tracking
  private readonly responseTimes: number[] = [];
  private readonly apiCallCounts = new Map<string, number>();
  private startTime = Date.now();
  
  // Monitoring intervals
  private metricsTimer?: NodeJS.Timeout;
  private reportingTimer?: NodeJS.Timeout;
  
  constructor() {
    super();
    
    this.logger = createLogger({
      level: 'info',
      format: require('winston').format.combine(
        require('winston').format.timestamp(),
        require('winston').format.label({ label: 'MetricsCollector' }),
        require('winston').format.json()
      ),
    });
    
    this.logger.info('Metrics Collector initialized');
  }
  
  /**
   * Start metrics collection
   */
  public async start(): Promise<void> {
    this.logger.info('Starting Metrics Collector...');
    
    this.startMetricsCollection();
    this.startPeriodicReporting();
    
    this.logger.info('Metrics Collector started');
    this.emit('started');
  }
  
  /**
   * Stop metrics collection
   */
  public async stop(): Promise<void> {
    this.logger.info('Stopping Metrics Collector...');
    
    if (this.metricsTimer) clearInterval(this.metricsTimer);
    if (this.reportingTimer) clearInterval(this.reportingTimer);
    
    // Generate final report
    await this.generateReport();
    
    this.logger.info('Metrics Collector stopped');
    this.emit('stopped');
  }
  
  /**
   * Record pipeline processing metrics
   */
  public async recordPipelineProcessed(processingTime: number): Promise<void> {
    this.pipelinesProcessed++;
    this.responseTimes.push(processingTime);
    
    // Keep response times array manageable
    if (this.responseTimes.length > 1000) {
      this.responseTimes.splice(0, 500);
    }
    
    this.emit('pipeline_processed', {
      count: this.pipelinesProcessed,
      processingTime,
    });
  }
  
  /**
   * Record auto-merge completion
   */
  public async recordAutoMergeCompleted(successful: boolean): Promise<void> {
    if (successful) {
      this.autoMergesCompleted++;
    } else {
      this.autoMergesBlocked++;
    }
    
    this.emit('auto_merge_recorded', {
      successful,
      totalCompleted: this.autoMergesCompleted,
      totalBlocked: this.autoMergesBlocked,
    });
  }
  
  /**
   * Record decision accuracy
   */
  public async recordDecisionAccuracy(wasCorrect: boolean, isFalsePositive?: boolean, isFalseNegative?: boolean): Promise<void> {
    if (wasCorrect) {
      this.decisionsCorrect++;
    } else {
      this.decisionsIncorrect++;
      
      if (isFalsePositive) this.falsePositives++;
      if (isFalseNegative) this.falseNegatives++;
    }
    
    this.emit('decision_accuracy_recorded', {
      wasCorrect,
      totalCorrect: this.decisionsCorrect,
      totalIncorrect: this.decisionsIncorrect,
    });
  }
  
  /**
   * Record API call usage
   */
  public async recordAPICall(provider: string, model?: string, tokens?: number): Promise<void> {
    const key = `${provider}${model ? `:${model}` : ''}`;
    const currentCount = this.apiCallCounts.get(key) || 0;
    this.apiCallCounts.set(key, currentCount + 1);
    
    this.emit('api_call_recorded', {
      provider,
      model,
      tokens,
      totalCalls: currentCount + 1,
    });
  }
  
  /**
   * Get current metrics snapshot
   */
  public getCurrentMetrics(): SystemMetrics {
    const now = new Date();
    const uptime = (Date.now() - this.startTime) / 1000;
    
    const metrics: SystemMetrics = {
      timestamp: now,
      agentResponseTime: this.calculateAverageResponseTime(),
      decisionAccuracy: this.calculateDecisionAccuracy(),
      falsePositiveRate: this.calculateFalsePositiveRate(),
      falseNegativeRate: this.calculateFalseNegativeRate(),
      systemUptime: Math.min((uptime / 86400) * 100, 100), // Percentage of day
      throughput: {
        pipelinesProcessed: this.pipelinesProcessed,
        decisionsPerMinute: this.calculateDecisionsPerMinute(),
        autoMergeRate: this.calculateAutoMergeRate(),
      },
      resourceUsage: {
        cpuUsage: this.getCPUUsage(),
        memoryUsage: this.getMemoryUsage(),
        apiCalls: this.getTotalAPICalls(),
        costs: this.estimateCosts(),
      },
    };
    
    return SystemMetricsSchema.parse(metrics);
  }
  
  /**
   * Get metrics history
   */
  public getMetricsHistory(hours: number = 24): SystemMetrics[] {
    const cutoff = new Date(Date.now() - (hours * 60 * 60 * 1000));
    return this.metrics.filter(m => m.timestamp >= cutoff);
  }
  
  /**
   * Generate comprehensive metrics report
   */
  public async generateReport(): Promise<MetricsReport> {
    const current = this.getCurrentMetrics();
    const history = this.getMetricsHistory(24);
    
    const report: MetricsReport = {
      timestamp: new Date(),
      current,
      trends: this.calculateTrends(history),
      performance: this.analyzePerformance(history),
      quality: this.analyzeQuality(history),
      efficiency: this.analyzeEfficiency(history),
      recommendations: this.generateRecommendations(current, history),
    };
    
    this.logger.info('Metrics report generated', {
      metricsCount: history.length,
      uptime: current.systemUptime,
      accuracy: current.decisionAccuracy,
    });
    
    return report;
  }
  
  /**
   * Private helper methods
   */
  private startMetricsCollection(): void {
    this.metricsTimer = setInterval(() => {
      try {
        const metrics = this.getCurrentMetrics();
        this.metrics.push(metrics);
        
        // Keep metrics history manageable
        if (this.metrics.length > this.maxMetricsHistory) {
          this.metrics.splice(0, this.metrics.length - this.maxMetricsHistory);
        }
        
        this.emit('metrics_collected', metrics);
        
      } catch (error) {
        this.logger.error('Error collecting metrics', error);
      }
    }, 60000); // Collect every minute
  }
  
  private startPeriodicReporting(): void {
    this.reportingTimer = setInterval(async () => {
      try {
        const report = await this.generateReport();
        this.emit('metrics_report', report);
        
        // Check for performance alerts
        await this.checkPerformanceAlerts(report);
        
      } catch (error) {
        this.logger.error('Error generating periodic report', error);
      }
    }, 300000); // Report every 5 minutes
  }
  
  private calculateAverageResponseTime(): number {
    if (this.responseTimes.length === 0) return 0;
    
    const sum = this.responseTimes.reduce((acc, time) => acc + time, 0);
    return Math.round(sum / this.responseTimes.length);
  }
  
  private calculateDecisionAccuracy(): number {
    const total = this.decisionsCorrect + this.decisionsIncorrect;
    if (total === 0) return 100;
    
    return Math.round((this.decisionsCorrect / total) * 100);
  }
  
  private calculateFalsePositiveRate(): number {
    const total = this.decisionsCorrect + this.decisionsIncorrect;
    if (total === 0) return 0;
    
    return Math.round((this.falsePositives / total) * 100);
  }
  
  private calculateFalseNegativeRate(): number {
    const total = this.decisionsCorrect + this.decisionsIncorrect;
    if (total === 0) return 0;
    
    return Math.round((this.falseNegatives / total) * 100);
  }
  
  private calculateDecisionsPerMinute(): number {
    const total = this.decisionsCorrect + this.decisionsIncorrect;
    const uptime = (Date.now() - this.startTime) / 60000; // Minutes
    
    if (uptime === 0) return 0;
    return Math.round(total / uptime);
  }
  
  private calculateAutoMergeRate(): number {
    const total = this.autoMergesCompleted + this.autoMergesBlocked;
    if (total === 0) return 0;
    
    return Math.round((this.autoMergesCompleted / total) * 100);
  }
  
  private getCPUUsage(): number {
    // In production, this would use actual CPU monitoring
    return Math.round(Math.random() * 30 + 20); // 20-50% simulated
  }
  
  private getMemoryUsage(): number {
    const memoryUsage = process.memoryUsage();
    const usedMB = memoryUsage.heapUsed / 1024 / 1024;
    const totalMB = memoryUsage.heapTotal / 1024 / 1024;
    
    return Math.round((usedMB / totalMB) * 100);
  }
  
  private getTotalAPICalls(): number {
    return Array.from(this.apiCallCounts.values()).reduce((sum, count) => sum + count, 0);
  }
  
  private estimateCosts(): number {
    // Estimate costs based on API calls
    // This would use actual pricing from providers
    const totalCalls = this.getTotalAPICalls();
    const costPerCall = 0.002; // $0.002 per API call estimate
    
    return Math.round(totalCalls * costPerCall * 100) / 100; // Round to cents
  }
  
  private calculateTrends(history: SystemMetrics[]): any {
    if (history.length < 2) return {};
    
    const recent = history.slice(-10); // Last 10 data points
    const older = history.slice(0, Math.min(10, history.length - 10));
    
    return {
      responseTime: this.calculateTrend(older.map(m => m.agentResponseTime), recent.map(m => m.agentResponseTime)),
      accuracy: this.calculateTrend(older.map(m => m.decisionAccuracy), recent.map(m => m.decisionAccuracy)),
      throughput: this.calculateTrend(older.map(m => m.throughput.pipelinesProcessed), recent.map(m => m.throughput.pipelinesProcessed)),
      autoMergeRate: this.calculateTrend(older.map(m => m.throughput.autoMergeRate), recent.map(m => m.throughput.autoMergeRate)),
    };
  }
  
  private calculateTrend(older: number[], recent: number[]): string {
    if (older.length === 0 || recent.length === 0) return 'stable';
    
    const oldAvg = older.reduce((sum, val) => sum + val, 0) / older.length;
    const recentAvg = recent.reduce((sum, val) => sum + val, 0) / recent.length;
    
    const change = ((recentAvg - oldAvg) / oldAvg) * 100;
    
    if (change > 10) return 'improving';
    if (change < -10) return 'degrading';
    return 'stable';
  }
  
  private analyzePerformance(history: SystemMetrics[]): any {
    const current = history[history.length - 1];
    if (!current) return {};
    
    return {
      status: current.agentResponseTime < 2000 ? 'good' : current.agentResponseTime < 5000 ? 'fair' : 'poor',
      avgResponseTime: this.calculateAverageResponseTime(),
      p95ResponseTime: this.calculatePercentile(this.responseTimes, 95),
      p99ResponseTime: this.calculatePercentile(this.responseTimes, 99),
      throughputTrend: this.calculateTrends(history).throughput,
    };
  }
  
  private analyzeQuality(history: SystemMetrics[]): any {
    const current = history[history.length - 1];
    if (!current) return {};
    
    return {
      status: current.decisionAccuracy > 90 ? 'excellent' : current.decisionAccuracy > 80 ? 'good' : 'needs_improvement',
      accuracy: current.decisionAccuracy,
      falsePositiveRate: current.falsePositiveRate,
      falseNegativeRate: current.falseNegativeRate,
      accuracyTrend: this.calculateTrends(history).accuracy,
    };
  }
  
  private analyzeEfficiency(history: SystemMetrics[]): any {
    const current = history[history.length - 1];
    if (!current) return {};
    
    return {
      status: current.resourceUsage.costs < 10 ? 'excellent' : current.resourceUsage.costs < 25 ? 'good' : 'expensive',
      costPerPipeline: this.pipelinesProcessed > 0 ? current.resourceUsage.costs / this.pipelinesProcessed : 0,
      autoMergeRate: current.throughput.autoMergeRate,
      resourceUtilization: {
        cpu: current.resourceUsage.cpuUsage,
        memory: current.resourceUsage.memoryUsage,
      },
    };
  }
  
  private generateRecommendations(current: SystemMetrics, history: SystemMetrics[]): string[] {
    const recommendations: string[] = [];
    
    // Performance recommendations
    if (current.agentResponseTime > 5000) {
      recommendations.push('Consider optimizing agent response time - currently averaging over 5 seconds');
    }
    
    // Quality recommendations
    if (current.decisionAccuracy < 85) {
      recommendations.push('Decision accuracy is below 85% - review agent training and decision logic');
    }
    
    if (current.falsePositiveRate > 15) {
      recommendations.push('High false positive rate detected - consider adjusting sensitivity thresholds');
    }
    
    // Efficiency recommendations
    if (current.resourceUsage.costs > 20) {
      recommendations.push('API costs are high - consider optimizing model usage and implementing caching');
    }
    
    if (current.throughput.autoMergeRate < 60) {
      recommendations.push('Auto-merge rate is low - review risk assessment criteria and safety thresholds');
    }
    
    // Resource recommendations
    if (current.resourceUsage.memoryUsage > 80) {
      recommendations.push('Memory usage is high - consider implementing memory cleanup and optimization');
    }
    
    return recommendations;
  }
  
  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    
    return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
  }
  
  private async checkPerformanceAlerts(report: MetricsReport): Promise<void> {
    const alerts: string[] = [];
    
    // Response time alerts
    if (report.current.agentResponseTime > 10000) {
      alerts.push('CRITICAL: Agent response time exceeds 10 seconds');
    }
    
    // Accuracy alerts
    if (report.current.decisionAccuracy < 70) {
      alerts.push('CRITICAL: Decision accuracy below 70%');
    }
    
    // Resource alerts
    if (report.current.resourceUsage.memoryUsage > 90) {
      alerts.push('WARNING: Memory usage above 90%');
    }
    
    // Cost alerts
    if (report.current.resourceUsage.costs > 50) {
      alerts.push('WARNING: High API costs detected');
    }
    
    if (alerts.length > 0) {
      this.logger.warn('Performance alerts triggered', { alerts });
      this.emit('performance_alert', { alerts, report });
    }
  }
}

// Helper interfaces
interface MetricsReport {
  timestamp: Date;
  current: SystemMetrics;
  trends: any;
  performance: any;
  quality: any;
  efficiency: any;
  recommendations: string[];
}
/**
 * Rails & Guarantees v1.0 RC - Phase 7: Monitoring & SLO Implementation
 * Performance alerts, security monitoring, SLO tracking, incident response
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import { writeFile, appendFile, mkdir } from 'fs/promises';
import { join } from 'path';

// Monitoring Types
export interface SLODefinition {
  name: string;
  description: string;
  target: number; // Target value (e.g., 400 for 400ms, 99.9 for 99.9%)
  unit: string; // 'ms', '%', 'requests/sec', etc.
  window: string; // Time window for measurement (e.g., '5m', '1h', '1d')
  alertThreshold: number; // When to trigger alert (e.g., 1.2 for 20% above target)
  criticalThreshold: number; // When to trigger critical alert
}

export interface MetricSample {
  timestamp: number;
  value: number;
  labels: Record<string, string>;
  operation?: string;
}

export interface Alert {
  id: string;
  name: string;
  severity: 'warning' | 'critical' | 'fatal';
  message: string;
  timestamp: number;
  slo: string;
  currentValue: number;
  targetValue: number;
  details: Record<string, unknown>;
  resolved?: boolean;
  resolvedAt?: number;
}

export interface IncidentReport {
  id: string;
  title: string;
  status: 'open' | 'investigating' | 'resolved';
  severity: 'low' | 'medium' | 'high' | 'critical';
  startTime: number;
  endTime?: number;
  alerts: Alert[];
  timeline: IncidentEvent[];
  postMortem?: {
    summary: string;
    rootCause: string;
    actionItems: string[];
  };
}

export interface IncidentEvent {
  timestamp: number;
  type: 'alert' | 'action' | 'resolution' | 'escalation';
  message: string;
  actor?: string;
}

export interface SecurityEvent {
  id: string;
  type: 'replay_attempt' | 'invalid_signature' | 'rate_limit_exceeded' | 'suspicious_pattern';
  timestamp: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: {
    ip?: string;
    userAgent?: string;
    repoId?: string;
  };
  details: Record<string, unknown>;
  blocked: boolean;
}

// Monitoring Engine
export class MonitoringEngine extends EventEmitter {
  private slos = new Map<string, SLODefinition>();
  private metrics = new Map<string, MetricSample[]>();
  private alerts = new Map<string, Alert>();
  private incidents = new Map<string, IncidentReport>();
  private securityEvents: SecurityEvent[] = [];
  private logDir: string;
  
  // Performance tracking
  private responseTimeSamples: MetricSample[] = [];
  private ticketVerifySamples: MetricSample[] = [];
  private availabilitySamples: MetricSample[] = [];

  constructor(logDir = 'logs') {
    super();
    this.logDir = logDir;
    this.initializeDefaultSLOs();
    this.startPeriodicChecks();
  }

  // SLO Configuration
  private initializeDefaultSLOs(): void {
    // Core Rails & Guarantees SLOs
    this.addSLO({
      name: 'response_time_p95',
      description: 'P95 response time for all operations',
      target: 400, // 400ms
      unit: 'ms',
      window: '5m',
      alertThreshold: 1.2, // Alert at 480ms
      criticalThreshold: 2.0 // Critical at 800ms
    });

    this.addSLO({
      name: 'ticket_verify_p95',
      description: 'P95 ticket verification time',
      target: 25, // 25ms
      unit: 'ms',
      window: '5m',
      alertThreshold: 1.5, // Alert at 37.5ms
      criticalThreshold: 2.0 // Critical at 50ms
    });

    this.addSLO({
      name: 'availability',
      description: 'System availability percentage',
      target: 99.9, // 99.9%
      unit: '%',
      window: '1h',
      alertThreshold: 0.995, // Alert at 99.5%
      criticalThreshold: 0.99 // Critical at 99%
    });

    this.addSLO({
      name: 'error_rate',
      description: 'Error rate percentage',
      target: 0.1, // 0.1%
      unit: '%',
      window: '5m',
      alertThreshold: 5.0, // Alert at 0.5%
      criticalThreshold: 10.0 // Critical at 1%
    });
  }

  addSLO(slo: SLODefinition): void {
    this.slos.set(slo.name, slo);
    this.metrics.set(slo.name, []);
  }

  // Metric Collection
  recordResponseTime(operation: string, duration: number, labels: Record<string, string> = {}): void {
    const sample: MetricSample = {
      timestamp: Date.now(),
      value: duration,
      labels: { ...labels, operation },
      operation
    };

    this.responseTimeSamples.push(sample);
    this.recordMetric('response_time_p95', sample);

    // Keep only recent samples (last hour)
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    this.responseTimeSamples = this.responseTimeSamples.filter(s => s.timestamp > oneHourAgo);
  }

  recordTicketVerification(duration: number, labels: Record<string, string> = {}): void {
    const sample: MetricSample = {
      timestamp: Date.now(),
      value: duration,
      labels: { ...labels, operation: 'ticket_verify' }
    };

    this.ticketVerifySamples.push(sample);
    this.recordMetric('ticket_verify_p95', sample);

    // Keep only recent samples
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    this.ticketVerifySamples = this.ticketVerifySamples.filter(s => s.timestamp > oneHourAgo);
  }

  recordAvailability(isAvailable: boolean, labels: Record<string, string> = {}): void {
    const sample: MetricSample = {
      timestamp: Date.now(),
      value: isAvailable ? 1 : 0,
      labels
    };

    this.availabilitySamples.push(sample);
    this.recordMetric('availability', sample);

    // Keep only recent samples
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    this.availabilitySamples = this.availabilitySamples.filter(s => s.timestamp > oneHourAgo);
  }

  recordError(operation: string, error: Error, labels: Record<string, string> = {}): void {
    const sample: MetricSample = {
      timestamp: Date.now(),
      value: 1,
      labels: { ...labels, operation, error: error.name }
    };

    this.recordMetric('error_rate', sample);
    this.emit('error_recorded', { operation, error, labels });
  }

  private recordMetric(sloName: string, sample: MetricSample): void {
    const samples = this.metrics.get(sloName) || [];
    samples.push(sample);
    this.metrics.set(sloName, samples);

    // Keep only samples within the SLO window
    const slo = this.slos.get(sloName);
    if (slo) {
      const windowMs = this.parseTimeWindow(slo.window);
      const cutoff = Date.now() - windowMs;
      const recentSamples = samples.filter(s => s.timestamp > cutoff);
      this.metrics.set(sloName, recentSamples);
    }
  }

  // Alert Generation
  private startPeriodicChecks(): void {
    // Check SLOs every 30 seconds
    setInterval(() => {
      this.checkAllSLOs();
    }, 30000);

    // Check for stale alerts every 5 minutes
    setInterval(() => {
      this.checkStaleAlerts();
    }, 5 * 60 * 1000);

    // Generate availability samples every minute
    setInterval(() => {
      // Simple health check - in real implementation, this would ping the service
      this.recordAvailability(true, { source: 'periodic_check' });
    }, 60000);
  }

  private async checkAllSLOs(): Promise<void> {
    for (const [name, slo] of this.slos.entries()) {
      await this.checkSLO(name, slo);
    }
  }

  private async checkSLO(name: string, slo: SLODefinition): Promise<void> {
    const samples = this.metrics.get(name) || [];
    if (samples.length === 0) return;

    let currentValue: number;

    // Calculate current value based on SLO type
    switch (name) {
      case 'response_time_p95':
      case 'ticket_verify_p95':
        currentValue = this.calculatePercentile(samples.map(s => s.value), 95);
        break;
      
      case 'availability':
        const totalSamples = samples.length;
        const availableSamples = samples.filter(s => s.value === 1).length;
        currentValue = totalSamples > 0 ? (availableSamples / totalSamples) * 100 : 100;
        break;
      
      case 'error_rate':
        const windowMs = this.parseTimeWindow(slo.window);
        const recentSamples = samples.filter(s => s.timestamp > Date.now() - windowMs);
        const errorCount = recentSamples.length;
        const totalRequests = this.getTotalRequestsInWindow(windowMs);
        currentValue = totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0;
        break;
      
      default:
        currentValue = samples.length > 0 ? samples[samples.length - 1].value : 0;
    }

    // Check thresholds
    await this.checkThresholds(name, slo, currentValue);
  }

  private async checkThresholds(sloName: string, slo: SLODefinition, currentValue: number): Promise<void> {
    const alertId = `${sloName}_threshold`;
    const existingAlert = this.alerts.get(alertId);

    // Determine if we should alert
    let shouldAlert = false;
    let severity: 'warning' | 'critical' | 'fatal' = 'warning';

    if (sloName === 'availability') {
      // For availability, lower values are worse
      if (currentValue < slo.criticalThreshold * slo.target) {
        shouldAlert = true;
        severity = 'critical';
      } else if (currentValue < slo.alertThreshold * slo.target) {
        shouldAlert = true;
        severity = 'warning';
      }
    } else {
      // For response times and error rates, higher values are worse
      if (currentValue > slo.criticalThreshold * slo.target) {
        shouldAlert = true;
        severity = 'critical';
      } else if (currentValue > slo.alertThreshold * slo.target) {
        shouldAlert = true;
        severity = 'warning';
      }
    }

    if (shouldAlert && !existingAlert) {
      // Create new alert
      const alert: Alert = {
        id: alertId,
        name: `${slo.name} threshold exceeded`,
        severity,
        message: `${slo.description} is ${currentValue.toFixed(2)}${slo.unit}, target is ${slo.target}${slo.unit}`,
        timestamp: Date.now(),
        slo: sloName,
        currentValue,
        targetValue: slo.target,
        details: { window: slo.window }
      };

      this.alerts.set(alertId, alert);
      await this.handleNewAlert(alert);
      
    } else if (!shouldAlert && existingAlert) {
      // Resolve existing alert
      existingAlert.resolved = true;
      existingAlert.resolvedAt = Date.now();
      await this.handleResolvedAlert(existingAlert);
      this.alerts.delete(alertId);
    }
  }

  private async handleNewAlert(alert: Alert): Promise<void> {
    console.error(`🚨 ALERT [${alert.severity.toUpperCase()}]: ${alert.message}`);
    
    // Emit alert event
    this.emit('alert', alert);
    
    // Log alert
    await this.logAlert(alert);
    
    // Check if we need to create or escalate incident
    if (alert.severity === 'critical' || alert.severity === 'fatal') {
      await this.handleCriticalAlert(alert);
    }
  }

  private async handleResolvedAlert(alert: Alert): Promise<void> {
    console.log(`✅ RESOLVED: ${alert.name}`);
    
    // Emit resolution event
    this.emit('alert_resolved', alert);
    
    // Log resolution
    await this.logAlert(alert);
  }

  private async handleCriticalAlert(alert: Alert): Promise<void> {
    // Check if there's an existing incident for this SLO
    let incident = Array.from(this.incidents.values())
      .find(i => i.status !== 'resolved' && i.alerts.some(a => a.slo === alert.slo));

    if (!incident) {
      // Create new incident
      incident = {
        id: `incident-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        title: `${alert.slo} SLO violation`,
        status: 'open',
        severity: alert.severity === 'fatal' ? 'critical' : 'high',
        startTime: Date.now(),
        alerts: [alert],
        timeline: [
          {
            timestamp: Date.now(),
            type: 'alert',
            message: `Critical alert: ${alert.message}`,
          }
        ]
      };

      this.incidents.set(incident.id, incident);
      this.emit('incident_created', incident);
      
    } else {
      // Add alert to existing incident
      incident.alerts.push(alert);
      incident.timeline.push({
        timestamp: Date.now(),
        type: 'escalation',
        message: `Additional alert: ${alert.message}`
      });
      
      this.emit('incident_escalated', incident);
    }

    await this.logIncident(incident);
  }

  // Security Monitoring
  recordSecurityEvent(event: Omit<SecurityEvent, 'id' | 'timestamp'>): void {
    const securityEvent: SecurityEvent = {
      ...event,
      id: `sec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now()
    };

    this.securityEvents.push(securityEvent);
    
    // Keep only recent events (last 24 hours)
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    this.securityEvents = this.securityEvents.filter(e => e.timestamp > oneDayAgo);

    console.warn(`🔒 SECURITY EVENT [${securityEvent.severity.toUpperCase()}]: ${securityEvent.type}`);
    
    // Emit security event
    this.emit('security_event', securityEvent);
    
    // Check for attack patterns
    this.analyzeSecurityPattern(securityEvent);
    
    // Log security event
    this.logSecurityEvent(securityEvent);
  }

  private analyzeSecurityPattern(newEvent: SecurityEvent): void {
    const recentEvents = this.securityEvents.filter(
      e => e.timestamp > Date.now() - 5 * 60 * 1000 && e.type === newEvent.type
    );

    // Check for replay attack pattern
    if (newEvent.type === 'replay_attempt' && recentEvents.length >= 3) {
      this.recordSecurityEvent({
        type: 'suspicious_pattern',
        severity: 'high',
        source: newEvent.source,
        details: {
          pattern: 'multiple_replay_attempts',
          count: recentEvents.length,
          timeWindow: '5m'
        },
        blocked: true
      });
    }

    // Check for rate limiting violations
    if (newEvent.type === 'rate_limit_exceeded') {
      const sourceEvents = recentEvents.filter(
        e => e.source.ip === newEvent.source.ip
      );
      
      if (sourceEvents.length >= 5) {
        this.recordSecurityEvent({
          type: 'suspicious_pattern',
          severity: 'critical',
          source: newEvent.source,
          details: {
            pattern: 'persistent_rate_limit_violation',
            count: sourceEvents.length,
            blocked: true
          },
          blocked: true
        });
      }
    }
  }

  // Performance Analysis
  detectPerformanceDegradation(): { degradation: boolean; details?: Record<string, unknown> } {
    // Check if P99 > 2 * P95 (Rails & Guarantees alert condition)
    const p95 = this.calculatePercentile(this.responseTimeSamples.map(s => s.value), 95);
    const p99 = this.calculatePercentile(this.responseTimeSamples.map(s => s.value), 99);

    if (p99 > 2 * p95 && p95 > 0) {
      return {
        degradation: true,
        details: {
          p95,
          p99,
          ratio: p99 / p95,
          threshold: 2.0,
          message: 'P99 response time is more than 2x P95, indicating performance degradation'
        }
      };
    }

    return { degradation: false };
  }

  // Utility Methods
  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    
    const sorted = values.sort((a, b) => a - b);
    const index = (percentile / 100) * (sorted.length - 1);
    const floor = Math.floor(index);
    const ceil = Math.ceil(index);
    
    if (floor === ceil) {
      return sorted[floor];
    }
    
    const fraction = index - floor;
    return sorted[floor] * (1 - fraction) + sorted[ceil] * fraction;
  }

  private parseTimeWindow(window: string): number {
    const match = window.match(/^(\d+)([smhd])$/);
    if (!match) return 5 * 60 * 1000; // Default 5 minutes
    
    const [, num, unit] = match;
    const multipliers: Record<string, number> = {
      's': 1000,
      'm': 60 * 1000,
      'h': 60 * 60 * 1000,
      'd': 24 * 60 * 60 * 1000
    };
    
    return parseInt(num, 10) * (multipliers[unit] || 1000);
  }

  private getTotalRequestsInWindow(windowMs: number): number {
    // In a real implementation, this would query the request counter
    // For now, estimate based on response time samples
    const cutoff = Date.now() - windowMs;
    return this.responseTimeSamples.filter(s => s.timestamp > cutoff).length;
  }

  private checkStaleAlerts(): void {
    const staleThreshold = Date.now() - 60 * 60 * 1000; // 1 hour
    
    for (const [id, alert] of this.alerts.entries()) {
      if (alert.timestamp < staleThreshold && !alert.resolved) {
        console.warn(`⚠️  Stale alert detected: ${alert.name} (${id})`);
        // Could auto-resolve or escalate stale alerts here
      }
    }
  }

  // Logging Methods
  private async logAlert(alert: Alert): Promise<void> {
    await mkdir(this.logDir, { recursive: true });
    const logPath = join(this.logDir, 'alerts.ndjson');
    const logEntry = JSON.stringify({
      timestamp: new Date(alert.timestamp).toISOString(),
      level: alert.severity,
      type: 'alert',
      alert
    }) + '\n';
    
    await appendFile(logPath, logEntry);
  }

  private async logIncident(incident: IncidentReport): Promise<void> {
    await mkdir(this.logDir, { recursive: true });
    const logPath = join(this.logDir, 'incidents.ndjson');
    const logEntry = JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'error',
      type: 'incident',
      incident
    }) + '\n';
    
    await appendFile(logPath, logEntry);
  }

  private async logSecurityEvent(event: SecurityEvent): Promise<void> {
    await mkdir(this.logDir, { recursive: true });
    const logPath = join(this.logDir, 'security.ndjson');
    const logEntry = JSON.stringify({
      timestamp: new Date(event.timestamp).toISOString(),
      level: event.severity === 'critical' ? 'error' : 'warn',
      type: 'security_event',
      event
    }) + '\n';
    
    await appendFile(logPath, logEntry);
  }

  // Public Getters
  getSLOStatus(): Record<string, { current: number; target: number; status: 'ok' | 'warning' | 'critical' }> {
    const status: Record<string, any> = {};
    
    for (const [name, slo] of this.slos.entries()) {
      const samples = this.metrics.get(name) || [];
      let current = 0;
      
      if (samples.length > 0) {
        switch (name) {
          case 'response_time_p95':
          case 'ticket_verify_p95':
            current = this.calculatePercentile(samples.map(s => s.value), 95);
            break;
          case 'availability':
            const total = samples.length;
            const available = samples.filter(s => s.value === 1).length;
            current = total > 0 ? (available / total) * 100 : 100;
            break;
          default:
            current = samples[samples.length - 1]?.value || 0;
        }
      }
      
      let statusValue: 'ok' | 'warning' | 'critical' = 'ok';
      if (name === 'availability') {
        if (current < slo.criticalThreshold * slo.target) statusValue = 'critical';
        else if (current < slo.alertThreshold * slo.target) statusValue = 'warning';
      } else {
        if (current > slo.criticalThreshold * slo.target) statusValue = 'critical';
        else if (current > slo.alertThreshold * slo.target) statusValue = 'warning';
      }
      
      status[name] = { current, target: slo.target, status: statusValue };
    }
    
    return status;
  }

  getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values()).filter(a => !a.resolved);
  }

  getActiveIncidents(): IncidentReport[] {
    return Array.from(this.incidents.values()).filter(i => i.status !== 'resolved');
  }

  getRecentSecurityEvents(hours = 24): SecurityEvent[] {
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    return this.securityEvents.filter(e => e.timestamp > cutoff);
  }

  // Health Check
  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    slos: Record<string, any>;
    alerts: number;
    incidents: number;
    securityEvents: number;
  } {
    const sloStatus = this.getSLOStatus();
    const activeAlerts = this.getActiveAlerts();
    const activeIncidents = this.getActiveIncidents();
    const recentSecurityEvents = this.getRecentSecurityEvents(1); // Last hour
    
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    // Check if any SLOs are critical
    const criticalSLOs = Object.values(sloStatus).filter(s => s.status === 'critical');
    const warningSLOs = Object.values(sloStatus).filter(s => s.status === 'warning');
    
    if (criticalSLOs.length > 0 || activeIncidents.length > 0) {
      status = 'unhealthy';
    } else if (warningSLOs.length > 0 || activeAlerts.length > 0) {
      status = 'degraded';
    }
    
    return {
      status,
      slos: sloStatus,
      alerts: activeAlerts.length,
      incidents: activeIncidents.length,
      securityEvents: recentSecurityEvents.length
    };
  }
}

// Export factory function
export function createMonitoringEngine(logDir?: string): MonitoringEngine {
  return new MonitoringEngine(logDir);
}
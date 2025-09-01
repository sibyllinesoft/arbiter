import { createLogger, Logger } from 'winston';
import { EventEmitter } from 'events';
import { AuditEntry, AuditEntrySchema } from '../types/index.js';

/**
 * Comprehensive audit logging system for governance and compliance
 * 
 * Tracks all system activities including:
 * - Agent decisions and reasoning
 * - Auto-merge approvals and blocks
 * - Human interventions and overrides
 * - Safety controller actions
 * - System configuration changes
 * - Emergency procedures and escalations
 */
export class AuditLogger extends EventEmitter {
  private readonly logger: Logger;
  
  // Audit trail storage
  private readonly auditEntries: AuditEntry[] = [];
  private readonly maxAuditHistory = 50000;
  
  // Audit categories for compliance tracking
  private readonly complianceCategories = new Set([
    'auto_merge_decision',
    'human_override',
    'safety_action',
    'security_incident',
    'data_access',
    'system_configuration',
    'emergency_procedure',
  ]);
  
  // Performance metrics
  private auditEntriesLogged = 0;
  private complianceEntriesLogged = 0;
  
  // Storage and archiving
  private persistenceTimer?: NodeJS.Timeout;
  
  constructor() {
    super();
    
    this.logger = createLogger({
      level: 'info',
      format: require('winston').format.combine(
        require('winston').format.timestamp(),
        require('winston').format.label({ label: 'AuditLogger' }),
        require('winston').format.json()
      ),
      transports: [
        new (require('winston')).transports.File({
          filename: 'audit-trail.log',
          maxsize: 50 * 1024 * 1024, // 50MB
          maxFiles: 10,
          tailable: true,
        }),
        new (require('winston')).transports.File({
          filename: 'compliance-audit.log',
          maxsize: 20 * 1024 * 1024, // 20MB
          maxFiles: 20,
          tailable: true,
          level: 'warn', // Only compliance-relevant entries
        }),
      ],
    });
    
    this.logger.info('Audit Logger initialized');
  }
  
  /**
   * Start audit logging system
   */
  public async start(): Promise<void> {
    this.logger.info('Starting Audit Logger...');
    
    // Start persistence timer
    this.startPersistenceLoop();
    
    // Load existing audit history if available
    await this.loadAuditHistory();
    
    this.logger.info('Audit Logger started');
    this.emit('started');
  }
  
  /**
   * Stop audit logging system
   */
  public async stop(): Promise<void> {
    this.logger.info('Stopping Audit Logger...');
    
    if (this.persistenceTimer) {
      clearInterval(this.persistenceTimer);
    }
    
    // Final persistence of pending entries
    await this.persistAuditEntries();
    
    this.logger.info('Audit Logger stopped', {
      totalEntriesLogged: this.auditEntriesLogged,
      complianceEntriesLogged: this.complianceEntriesLogged,
    });
    
    this.emit('stopped');
  }
  
  /**
   * Log an audit entry
   */
  public async log(entry: Partial<AuditEntry>): Promise<string> {
    try {
      // Generate audit entry ID
      const auditId = this.generateAuditId();
      
      // Create complete audit entry
      const auditEntry: AuditEntry = {
        id: auditId,
        timestamp: entry.timestamp || new Date(),
        action: entry.action || 'unknown_action',
        actor: entry.actor || 'system',
        actorId: entry.actorId || 'unknown',
        pipelineId: entry.pipelineId || 'system',
        details: entry.details || {},
        outcome: entry.outcome || 'success',
        impact: entry.impact || 'none',
        complianceRelevant: entry.complianceRelevant || this.isComplianceRelevant(entry.action || ''),
      };
      
      // Validate audit entry
      const validatedEntry = AuditEntrySchema.parse(auditEntry);
      
      // Store in memory
      this.auditEntries.push(validatedEntry);
      this.auditEntriesLogged++;
      
      if (validatedEntry.complianceRelevant) {
        this.complianceEntriesLogged++;
      }
      
      // Log to winston (file storage)
      const logLevel = this.getLogLevel(validatedEntry);
      this.logger.log(logLevel, 'Audit Entry', {
        auditId,
        entry: validatedEntry,
      });
      
      // Emit event for real-time monitoring
      this.emit('audit_logged', validatedEntry);
      
      // Keep memory usage under control
      if (this.auditEntries.length > this.maxAuditHistory) {
        this.auditEntries.splice(0, this.auditEntries.length - this.maxAuditHistory);
      }
      
      return auditId;
      
    } catch (error) {
      this.logger.error('Failed to log audit entry', { error, entry });
      throw new Error(`Audit logging failed: ${error.message}`);
    }
  }
  
  /**
   * Log agent decision for audit trail
   */
  public async logAgentDecision(
    agentId: string,
    pipelineId: string,
    decision: string,
    reasoning: string,
    confidence: number,
    context: any = {}
  ): Promise<string> {
    
    return this.log({
      action: 'agent_decision',
      actor: 'agent',
      actorId: agentId,
      pipelineId,
      details: {
        decision,
        reasoning,
        confidence,
        context,
        timestamp: new Date().toISOString(),
      },
      outcome: 'success',
      impact: this.assessDecisionImpact(decision),
      complianceRelevant: true,
    });
  }
  
  /**
   * Log auto-merge action
   */
  public async logAutoMerge(
    pipelineId: string,
    approved: boolean,
    riskScore: number,
    qualityScore: number,
    reasoning: string,
    overrideReason?: string
  ): Promise<string> {
    
    return this.log({
      action: approved ? 'auto_merge_approved' : 'auto_merge_blocked',
      actor: 'system',
      actorId: 'agentic-ci',
      pipelineId,
      details: {
        approved,
        riskScore,
        qualityScore,
        reasoning,
        overrideReason,
        timestamp: new Date().toISOString(),
      },
      outcome: 'success',
      impact: approved ? 'high' : 'medium',
      complianceRelevant: true,
    });
  }
  
  /**
   * Log human intervention
   */
  public async logHumanIntervention(
    humanId: string,
    pipelineId: string,
    action: string,
    reasoning: string,
    overriddenDecision?: string
  ): Promise<string> {
    
    return this.log({
      action: 'human_intervention',
      actor: 'human',
      actorId: humanId,
      pipelineId,
      details: {
        interventionAction: action,
        reasoning,
        overriddenDecision,
        timestamp: new Date().toISOString(),
      },
      outcome: 'success',
      impact: 'high',
      complianceRelevant: true,
    });
  }
  
  /**
   * Log safety controller action
   */
  public async logSafetyAction(
    action: string,
    reason: string,
    triggeredBy: string,
    pipelineId?: string,
    details: any = {}
  ): Promise<string> {
    
    return this.log({
      action: `safety_${action}`,
      actor: 'system',
      actorId: 'safety_controller',
      pipelineId: pipelineId || 'system',
      details: {
        safetyAction: action,
        reason,
        triggeredBy,
        ...details,
        timestamp: new Date().toISOString(),
      },
      outcome: 'success',
      impact: this.assessSafetyImpact(action),
      complianceRelevant: true,
    });
  }
  
  /**
   * Log security incident
   */
  public async logSecurityIncident(
    incidentType: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    description: string,
    pipelineId?: string,
    detectedBy?: string,
    details: any = {}
  ): Promise<string> {
    
    return this.log({
      action: 'security_incident',
      actor: detectedBy ? 'agent' : 'system',
      actorId: detectedBy || 'security_scanner',
      pipelineId: pipelineId || 'system',
      details: {
        incidentType,
        severity,
        description,
        ...details,
        timestamp: new Date().toISOString(),
      },
      outcome: 'success', // Successfully detected
      impact: severity === 'critical' ? 'critical' : severity === 'high' ? 'high' : 'medium',
      complianceRelevant: true,
    });
  }
  
  /**
   * Get audit entries by criteria
   */
  public getAuditEntries(criteria: AuditSearchCriteria = {}): AuditEntry[] {
    let entries = [...this.auditEntries];
    
    // Filter by time range
    if (criteria.startTime) {
      entries = entries.filter(e => e.timestamp >= criteria.startTime!);
    }
    
    if (criteria.endTime) {
      entries = entries.filter(e => e.timestamp <= criteria.endTime!);
    }
    
    // Filter by actor
    if (criteria.actor) {
      entries = entries.filter(e => e.actor === criteria.actor);
    }
    
    if (criteria.actorId) {
      entries = entries.filter(e => e.actorId === criteria.actorId);
    }
    
    // Filter by pipeline
    if (criteria.pipelineId) {
      entries = entries.filter(e => e.pipelineId === criteria.pipelineId);
    }
    
    // Filter by action
    if (criteria.action) {
      entries = entries.filter(e => e.action.includes(criteria.action!));
    }
    
    // Filter by outcome
    if (criteria.outcome) {
      entries = entries.filter(e => e.outcome === criteria.outcome);
    }
    
    // Filter by impact
    if (criteria.impact) {
      entries = entries.filter(e => e.impact === criteria.impact);
    }
    
    // Filter compliance-relevant only
    if (criteria.complianceOnly) {
      entries = entries.filter(e => e.complianceRelevant);
    }
    
    // Sort by timestamp (newest first)
    entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    // Limit results
    if (criteria.limit && criteria.limit > 0) {
      entries = entries.slice(0, criteria.limit);
    }
    
    return entries;
  }
  
  /**
   * Generate compliance report
   */
  public async generateComplianceReport(
    startTime: Date,
    endTime: Date
  ): Promise<ComplianceReport> {
    
    const complianceEntries = this.getAuditEntries({
      startTime,
      endTime,
      complianceOnly: true,
    });
    
    const report: ComplianceReport = {
      reportId: this.generateAuditId(),
      generatedAt: new Date(),
      periodStart: startTime,
      periodEnd: endTime,
      totalEntries: complianceEntries.length,
      summary: this.generateComplianceSummary(complianceEntries),
      actions: this.categorizeActions(complianceEntries),
      actors: this.categorizeActors(complianceEntries),
      outcomes: this.categorizeOutcomes(complianceEntries),
      impacts: this.categorizeImpacts(complianceEntries),
      securityIncidents: this.extractSecurityIncidents(complianceEntries),
      humanInterventions: this.extractHumanInterventions(complianceEntries),
      autoMergeDecisions: this.extractAutoMergeDecisions(complianceEntries),
      recommendations: this.generateComplianceRecommendations(complianceEntries),
    };
    
    this.logger.info('Compliance report generated', {
      reportId: report.reportId,
      periodStart: startTime,
      periodEnd: endTime,
      entriesAnalyzed: complianceEntries.length,
    });
    
    return report;
  }
  
  /**
   * Export audit trail for external systems
   */
  public async exportAuditTrail(
    format: 'json' | 'csv' | 'xml',
    criteria: AuditSearchCriteria = {}
  ): Promise<string> {
    
    const entries = this.getAuditEntries(criteria);
    
    switch (format) {
      case 'json':
        return JSON.stringify(entries, null, 2);
      
      case 'csv':
        return this.convertToCSV(entries);
      
      case 'xml':
        return this.convertToXML(entries);
      
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }
  
  /**
   * Get audit statistics
   */
  public getAuditStatistics(): AuditStatistics {
    const totalEntries = this.auditEntries.length;
    const complianceEntries = this.auditEntries.filter(e => e.complianceRelevant).length;
    
    const last24Hours = this.getAuditEntries({
      startTime: new Date(Date.now() - 24 * 60 * 60 * 1000),
    });
    
    const actionCounts = new Map<string, number>();
    const actorCounts = new Map<string, number>();
    
    for (const entry of this.auditEntries) {
      actionCounts.set(entry.action, (actionCounts.get(entry.action) || 0) + 1);
      actorCounts.set(entry.actor, (actorCounts.get(entry.actor) || 0) + 1);
    }
    
    return {
      totalEntries,
      complianceEntries,
      entriesLast24Hours: last24Hours.length,
      mostCommonActions: Array.from(actionCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([action, count]) => ({ action, count })),
      actorBreakdown: Object.fromEntries(actorCounts),
      averageEntriesPerHour: totalEntries > 0 ? Math.round(totalEntries / ((Date.now() - this.auditEntries[0]?.timestamp.getTime()) / 3600000)) : 0,
    };
  }
  
  /**
   * Private helper methods
   */
  private generateAuditId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2);
    return `audit_${timestamp}_${random}`;
  }
  
  private isComplianceRelevant(action: string): boolean {
    return Array.from(this.complianceCategories).some(category => 
      action.includes(category.replace('_', ''))
    );
  }
  
  private getLogLevel(entry: AuditEntry): string {
    if (entry.impact === 'critical') return 'error';
    if (entry.impact === 'high') return 'warn';
    if (entry.complianceRelevant) return 'warn';
    return 'info';
  }
  
  private assessDecisionImpact(decision: string): 'none' | 'low' | 'medium' | 'high' | 'critical' {
    switch (decision) {
      case 'proceed': return 'medium';
      case 'retry': return 'low';
      case 'escalate': return 'high';
      case 'abort': return 'critical';
      default: return 'medium';
    }
  }
  
  private assessSafetyImpact(action: string): 'none' | 'low' | 'medium' | 'high' | 'critical' {
    if (action.includes('emergency')) return 'critical';
    if (action.includes('circuit_breaker')) return 'high';
    if (action.includes('rate_limit')) return 'medium';
    return 'low';
  }
  
  private startPersistenceLoop(): void {
    this.persistenceTimer = setInterval(async () => {
      try {
        await this.persistAuditEntries();
      } catch (error) {
        this.logger.error('Failed to persist audit entries', error);
      }
    }, 60000); // Persist every minute
  }
  
  private async persistAuditEntries(): Promise<void> {
    // In production, this would persist to external audit store
    // (database, S3, compliance system, etc.)
    this.logger.debug('Audit entries persisted', {
      count: this.auditEntries.length,
      compliance: this.auditEntries.filter(e => e.complianceRelevant).length,
    });
  }
  
  private async loadAuditHistory(): Promise<void> {
    // In production, this would load from persistent storage
    this.logger.info('Audit history loaded');
  }
  
  private generateComplianceSummary(entries: AuditEntry[]): any {
    return {
      totalActions: entries.length,
      humanInterventions: entries.filter(e => e.actor === 'human').length,
      systemActions: entries.filter(e => e.actor === 'system').length,
      agentActions: entries.filter(e => e.actor === 'agent').length,
      criticalEvents: entries.filter(e => e.impact === 'critical').length,
      securityIncidents: entries.filter(e => e.action === 'security_incident').length,
    };
  }
  
  private categorizeActions(entries: AuditEntry[]): any {
    const categories = new Map<string, number>();
    
    for (const entry of entries) {
      categories.set(entry.action, (categories.get(entry.action) || 0) + 1);
    }
    
    return Object.fromEntries(categories);
  }
  
  private categorizeActors(entries: AuditEntry[]): any {
    const actors = new Map<string, number>();
    
    for (const entry of entries) {
      actors.set(entry.actor, (actors.get(entry.actor) || 0) + 1);
    }
    
    return Object.fromEntries(actors);
  }
  
  private categorizeOutcomes(entries: AuditEntry[]): any {
    const outcomes = new Map<string, number>();
    
    for (const entry of entries) {
      outcomes.set(entry.outcome, (outcomes.get(entry.outcome) || 0) + 1);
    }
    
    return Object.fromEntries(outcomes);
  }
  
  private categorizeImpacts(entries: AuditEntry[]): any {
    const impacts = new Map<string, number>();
    
    for (const entry of entries) {
      impacts.set(entry.impact, (impacts.get(entry.impact) || 0) + 1);
    }
    
    return Object.fromEntries(impacts);
  }
  
  private extractSecurityIncidents(entries: AuditEntry[]): any[] {
    return entries
      .filter(e => e.action === 'security_incident')
      .map(e => ({
        timestamp: e.timestamp,
        severity: e.details.severity,
        type: e.details.incidentType,
        description: e.details.description,
      }));
  }
  
  private extractHumanInterventions(entries: AuditEntry[]): any[] {
    return entries
      .filter(e => e.action === 'human_intervention')
      .map(e => ({
        timestamp: e.timestamp,
        humanId: e.actorId,
        action: e.details.interventionAction,
        reasoning: e.details.reasoning,
      }));
  }
  
  private extractAutoMergeDecisions(entries: AuditEntry[]): any[] {
    return entries
      .filter(e => e.action.includes('auto_merge'))
      .map(e => ({
        timestamp: e.timestamp,
        approved: e.action === 'auto_merge_approved',
        riskScore: e.details.riskScore,
        qualityScore: e.details.qualityScore,
        reasoning: e.details.reasoning,
      }));
  }
  
  private generateComplianceRecommendations(entries: AuditEntry[]): string[] {
    const recommendations: string[] = [];
    
    // Analyze patterns and generate recommendations
    const humanInterventions = entries.filter(e => e.actor === 'human').length;
    const totalDecisions = entries.filter(e => e.action.includes('decision')).length;
    
    if (totalDecisions > 0) {
      const interventionRate = (humanInterventions / totalDecisions) * 100;
      
      if (interventionRate > 30) {
        recommendations.push('High human intervention rate detected - consider reviewing decision thresholds');
      }
    }
    
    const criticalEvents = entries.filter(e => e.impact === 'critical').length;
    if (criticalEvents > 5) {
      recommendations.push('Multiple critical events detected - review safety protocols');
    }
    
    return recommendations;
  }
  
  private convertToCSV(entries: AuditEntry[]): string {
    if (entries.length === 0) return '';
    
    const headers = ['id', 'timestamp', 'action', 'actor', 'actorId', 'pipelineId', 'outcome', 'impact', 'complianceRelevant'];
    const rows = entries.map(entry => [
      entry.id,
      entry.timestamp.toISOString(),
      entry.action,
      entry.actor,
      entry.actorId,
      entry.pipelineId,
      entry.outcome,
      entry.impact,
      entry.complianceRelevant.toString(),
    ]);
    
    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }
  
  private convertToXML(entries: AuditEntry[]): string {
    const xmlEntries = entries.map(entry => `
  <entry>
    <id>${entry.id}</id>
    <timestamp>${entry.timestamp.toISOString()}</timestamp>
    <action>${entry.action}</action>
    <actor>${entry.actor}</actor>
    <actorId>${entry.actorId}</actorId>
    <pipelineId>${entry.pipelineId}</pipelineId>
    <outcome>${entry.outcome}</outcome>
    <impact>${entry.impact}</impact>
    <complianceRelevant>${entry.complianceRelevant}</complianceRelevant>
    <details>${JSON.stringify(entry.details)}</details>
  </entry>`).join('');
    
    return `<?xml version="1.0" encoding="UTF-8"?>
<auditTrail>
  <exportedAt>${new Date().toISOString()}</exportedAt>
  <entryCount>${entries.length}</entryCount>
  <entries>${xmlEntries}
  </entries>
</auditTrail>`;
  }
}

// Helper interfaces
interface AuditSearchCriteria {
  startTime?: Date;
  endTime?: Date;
  actor?: 'agent' | 'human' | 'system';
  actorId?: string;
  pipelineId?: string;
  action?: string;
  outcome?: 'success' | 'failure' | 'partial';
  impact?: 'none' | 'low' | 'medium' | 'high' | 'critical';
  complianceOnly?: boolean;
  limit?: number;
}

interface ComplianceReport {
  reportId: string;
  generatedAt: Date;
  periodStart: Date;
  periodEnd: Date;
  totalEntries: number;
  summary: any;
  actions: any;
  actors: any;
  outcomes: any;
  impacts: any;
  securityIncidents: any[];
  humanInterventions: any[];
  autoMergeDecisions: any[];
  recommendations: string[];
}

interface AuditStatistics {
  totalEntries: number;
  complianceEntries: number;
  entriesLast24Hours: number;
  mostCommonActions: { action: string; count: number }[];
  actorBreakdown: Record<string, number>;
  averageEntriesPerHour: number;
}
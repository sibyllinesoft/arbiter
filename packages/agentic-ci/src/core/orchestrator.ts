import { EventEmitter } from 'events';
import { createLogger, Logger } from 'winston';
import { Octokit } from '@octokit/rest';
import { 
  PipelineContext, 
  PipelineStatus, 
  QualityGate, 
  AgenticCIConfig, 
  Event,
  AuditEntry,
  SystemMetrics 
} from '../types/index.js';
import { FailureAnalyzer } from '../agents/failure-analyzer.js';
import { RiskAssessor } from '../agents/risk-assessor.js';
import { RemediationAgent } from '../agents/remediation-agent.js';
import { DecisionMaker } from '../agents/decision-maker.js';
import { SafetyController } from '../safety/safety-controller.js';
import { MetricsCollector } from '../monitoring/metrics-collector.js';
import { AuditLogger } from '../governance/audit-logger.js';

/**
 * Main orchestrator for the Agentic CI system
 * 
 * Coordinates AI agents to monitor CI/CD pipelines, analyze failures,
 * make intelligent auto-merge decisions, and ensure system safety.
 */
export class AgenticCIOrchestrator extends EventEmitter {
  private readonly logger: Logger;
  private readonly github: Octokit;
  private readonly config: AgenticCIConfig;
  
  // AI Agents
  private readonly failureAnalyzer: FailureAnalyzer;
  private readonly riskAssessor: RiskAssessor;
  private readonly remediationAgent: RemediationAgent;
  private readonly decisionMaker: DecisionMaker;
  
  // Safety and Governance
  private readonly safetyController: SafetyController;
  private readonly metricsCollector: MetricsCollector;
  private readonly auditLogger: AuditLogger;
  
  // State management
  private readonly activePipelines = new Map<string, PipelineStatus>();
  private readonly eventHistory: Event[] = [];
  private isShuttingDown = false;
  
  constructor(config: AgenticCIConfig) {
    super();
    this.config = config;
    
    this.logger = createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: require('winston').format.combine(
        require('winston').format.timestamp(),
        require('winston').format.errors({ stack: true }),
        require('winston').format.json()
      ),
      transports: [
        new (require('winston')).transports.Console(),
        new (require('winston')).transports.File({ 
          filename: 'agentic-ci.log',
          maxsize: 10 * 1024 * 1024, // 10MB
          maxFiles: 5,
        }),
      ],
    });
    
    this.github = new Octokit({ auth: config.github.token });
    
    // Initialize agents
    this.failureAnalyzer = new FailureAnalyzer(config.agents.failureAnalyzer, config.ai);
    this.riskAssessor = new RiskAssessor(config.agents.riskAssessor, config.ai);
    this.remediationAgent = new RemediationAgent(config.agents.remediationAgent, config.ai);
    this.decisionMaker = new DecisionMaker(config.agents.decisionMaker, config.ai);
    
    // Initialize safety and governance systems
    this.safetyController = new SafetyController(config.emergencySettings);
    this.metricsCollector = new MetricsCollector();
    this.auditLogger = new AuditLogger();
    
    this.setupEventHandlers();
    this.logger.info('Agentic CI Orchestrator initialized');
  }
  
  /**
   * Start the orchestrator and begin monitoring
   */
  public async start(): Promise<void> {
    try {
      this.logger.info('Starting Agentic CI Orchestrator...');
      
      // Validate configuration
      await this.validateConfiguration();
      
      // Start subsystems
      await this.safetyController.start();
      await this.metricsCollector.start();
      await this.auditLogger.start();
      
      // Setup webhook listener
      await this.setupWebhookListener();
      
      // Start monitoring loops
      this.startMonitoringLoop();
      this.startMetricsCollection();
      
      this.logger.info('Agentic CI Orchestrator started successfully');
      this.emit('started');
      
      await this.auditLogger.log({
        action: 'orchestrator_started',
        actor: 'system',
        actorId: 'orchestrator',
        pipelineId: 'system',
        details: { version: '1.0.0' },
        outcome: 'success',
        impact: 'medium',
        complianceRelevant: true,
      });
      
    } catch (error) {
      this.logger.error('Failed to start Agentic CI Orchestrator', error);
      throw error;
    }
  }
  
  /**
   * Stop the orchestrator gracefully
   */
  public async stop(): Promise<void> {
    this.logger.info('Stopping Agentic CI Orchestrator...');
    this.isShuttingDown = true;
    
    try {
      // Wait for active pipelines to complete or timeout
      await this.waitForActivePipelines(30000); // 30 second timeout
      
      // Stop subsystems
      await this.safetyController.stop();
      await this.metricsCollector.stop();
      await this.auditLogger.stop();
      
      this.logger.info('Agentic CI Orchestrator stopped successfully');
      this.emit('stopped');
      
    } catch (error) {
      this.logger.error('Error during shutdown', error);
      throw error;
    }
  }
  
  /**
   * Process a pipeline event (triggered by webhooks or manual invocation)
   */
  public async processPipelineEvent(context: PipelineContext): Promise<void> {
    const startTime = Date.now();
    
    try {
      this.logger.info(`Processing pipeline event for ${context.pipelineId}`, {
        repository: context.repository,
        sha: context.sha,
        event: context.eventName,
      });
      
      // Check if we're shutting down
      if (this.isShuttingDown) {
        this.logger.warn(`Ignoring pipeline event during shutdown: ${context.pipelineId}`);
        return;
      }
      
      // Safety check
      const safetyCheck = await this.safetyController.validatePipelineExecution(context);
      if (!safetyCheck.allowed) {
        this.logger.warn(`Pipeline execution blocked by safety controller: ${safetyCheck.reason}`);
        await this.handleSafetyBlock(context, safetyCheck.reason);
        return;
      }
      
      // Initialize or update pipeline status
      let pipelineStatus = this.activePipelines.get(context.pipelineId);
      if (!pipelineStatus) {
        pipelineStatus = await this.initializePipelineStatus(context);
        this.activePipelines.set(context.pipelineId, pipelineStatus);
      }
      
      // Update context if this is a new event for existing pipeline
      pipelineStatus.context = context;
      pipelineStatus.lastUpdated = new Date();
      
      // Execute the main pipeline orchestration logic
      await this.orchestratePipeline(pipelineStatus);
      
      const duration = Date.now() - startTime;
      this.logger.info(`Pipeline event processed in ${duration}ms`, {
        pipelineId: context.pipelineId,
        status: pipelineStatus.status,
      });
      
      // Record metrics
      await this.metricsCollector.recordPipelineProcessed(duration);
      
    } catch (error) {
      this.logger.error(`Error processing pipeline event: ${context.pipelineId}`, error);
      await this.handlePipelineError(context, error as Error);
      throw error;
    }
  }
  
  /**
   * Main pipeline orchestration logic
   */
  private async orchestratePipeline(pipelineStatus: PipelineStatus): Promise<void> {
    try {
      pipelineStatus.status = 'running';
      this.emit('pipeline_started', pipelineStatus);
      
      // Step 1: Monitor quality gates
      await this.monitorQualityGates(pipelineStatus);
      
      // Step 2: Analyze any failures
      if (pipelineStatus.failures.length > 0) {
        await this.analyzeFailures(pipelineStatus);
      }
      
      // Step 3: Assess risk for auto-merge
      if (this.isAutoMergeCandidate(pipelineStatus)) {
        await this.assessAutoMergeRisk(pipelineStatus);
      }
      
      // Step 4: Make decision
      const decision = await this.makeDecision(pipelineStatus);
      pipelineStatus.agentDecisions.push(decision);
      
      // Step 5: Execute decision
      await this.executeDecision(pipelineStatus, decision);
      
      // Step 6: Update final status
      this.updateFinalStatus(pipelineStatus);
      
      this.emit('pipeline_completed', pipelineStatus);
      
    } catch (error) {
      pipelineStatus.status = 'failure';
      this.logger.error(`Pipeline orchestration failed: ${pipelineStatus.context.pipelineId}`, error);
      throw error;
    }
  }
  
  /**
   * Monitor and evaluate quality gates
   */
  private async monitorQualityGates(pipelineStatus: PipelineStatus): Promise<void> {
    this.logger.info(`Monitoring quality gates for pipeline ${pipelineStatus.context.pipelineId}`);
    
    try {
      // Get current workflow runs for this SHA
      const workflowRuns = await this.getWorkflowRuns(pipelineStatus.context);
      
      // Initialize quality gates based on workflows
      const qualityGates = await this.initializeQualityGates(workflowRuns);
      pipelineStatus.qualityGates = qualityGates;
      
      // Monitor each quality gate
      for (const gate of qualityGates) {
        await this.evaluateQualityGate(pipelineStatus, gate);
      }
      
      // Calculate overall score
      pipelineStatus.overallScore = this.calculateOverallScore(qualityGates);
      
      this.logger.info(`Quality gates evaluation completed`, {
        pipelineId: pipelineStatus.context.pipelineId,
        overallScore: pipelineStatus.overallScore,
        passedGates: qualityGates.filter(g => g.status === 'passed').length,
        totalGates: qualityGates.length,
      });
      
    } catch (error) {
      this.logger.error('Error monitoring quality gates', error);
      throw error;
    }
  }
  
  /**
   * Analyze failures using AI agent
   */
  private async analyzeFailures(pipelineStatus: PipelineStatus): Promise<void> {
    if (pipelineStatus.failures.length === 0) return;
    
    this.logger.info(`Analyzing ${pipelineStatus.failures.length} failures with AI agent`);
    
    try {
      const analysisResults = await this.failureAnalyzer.analyzeFailures(
        pipelineStatus.failures,
        pipelineStatus.context
      );
      
      // Update failures with analysis results
      pipelineStatus.failures = analysisResults;
      
      // Try automated remediation for eligible failures
      await this.attemptAutomatedRemediation(pipelineStatus);
      
      this.logger.info('Failure analysis completed', {
        pipelineId: pipelineStatus.context.pipelineId,
        automatedFixesAttempted: analysisResults.filter(f => f.automatedFixAvailable).length,
      });
      
    } catch (error) {
      this.logger.error('Error analyzing failures', error);
      // Don't throw - we can continue without failure analysis
    }
  }
  
  /**
   * Assess risk for auto-merge decision
   */
  private async assessAutoMergeRisk(pipelineStatus: PipelineStatus): Promise<void> {
    this.logger.info(`Assessing auto-merge risk for pipeline ${pipelineStatus.context.pipelineId}`);
    
    try {
      const riskAssessment = await this.riskAssessor.assessRisk(pipelineStatus);
      pipelineStatus.riskAssessment = riskAssessment;
      
      // Determine auto-merge eligibility
      pipelineStatus.autoMergeEligible = this.isAutoMergeEligible(riskAssessment);
      
      this.logger.info('Risk assessment completed', {
        pipelineId: pipelineStatus.context.pipelineId,
        riskScore: riskAssessment.riskScore,
        recommendation: riskAssessment.recommendation,
        autoMergeEligible: pipelineStatus.autoMergeEligible,
      });
      
    } catch (error) {
      this.logger.error('Error assessing auto-merge risk', error);
      // Default to human review on error
      pipelineStatus.autoMergeEligible = false;
    }
  }
  
  /**
   * Make final decision using decision-making agent
   */
  private async makeDecision(pipelineStatus: PipelineStatus) {
    this.logger.info(`Making decision for pipeline ${pipelineStatus.context.pipelineId}`);
    
    return await this.decisionMaker.makeDecision(pipelineStatus);
  }
  
  /**
   * Execute the agent's decision
   */
  private async executeDecision(pipelineStatus: PipelineStatus, decision: any): Promise<void> {
    this.logger.info(`Executing decision: ${decision.decision}`, {
      pipelineId: pipelineStatus.context.pipelineId,
      reasoning: decision.reasoning,
    });
    
    switch (decision.decision) {
      case 'proceed':
        if (pipelineStatus.autoMergeEligible && this.config.autoMerge.enabled) {
          await this.executeAutoMerge(pipelineStatus);
        }
        break;
        
      case 'retry':
        await this.retryPipeline(pipelineStatus);
        break;
        
      case 'escalate':
        await this.escalateToHuman(pipelineStatus, decision.reasoning);
        break;
        
      case 'abort':
        await this.abortPipeline(pipelineStatus, decision.reasoning);
        break;
    }
    
    // Audit the decision
    await this.auditLogger.log({
      action: 'agent_decision_executed',
      actor: 'agent',
      actorId: decision.agentId,
      pipelineId: pipelineStatus.context.pipelineId,
      details: decision,
      outcome: 'success',
      impact: this.determineDecisionImpact(decision),
      complianceRelevant: true,
    });
  }
  
  /**
   * Execute auto-merge with safety checks
   */
  private async executeAutoMerge(pipelineStatus: PipelineStatus): Promise<void> {
    this.logger.info(`Executing auto-merge for ${pipelineStatus.context.pipelineId}`);
    
    try {
      // Final safety check
      const safetyCheck = await this.safetyController.validateAutoMerge(pipelineStatus);
      if (!safetyCheck.allowed) {
        this.logger.warn(`Auto-merge blocked by safety controller: ${safetyCheck.reason}`);
        await this.escalateToHuman(pipelineStatus, `Auto-merge blocked: ${safetyCheck.reason}`);
        return;
      }
      
      // Execute the merge
      if (pipelineStatus.context.isPullRequest && pipelineStatus.context.pullRequestNumber) {
        await this.github.rest.pulls.merge({
          owner: pipelineStatus.context.owner,
          repo: pipelineStatus.context.repository,
          pull_number: pipelineStatus.context.pullRequestNumber,
          merge_method: 'squash', // Use squash merge for cleaner history
          commit_title: `Auto-merge: ${pipelineStatus.context.sha.substring(0, 7)} [agentic-ci]`,
          commit_message: `Automatically merged by Agentic CI system\\n\\n` +
                         `Risk Score: ${pipelineStatus.riskAssessment?.riskScore}/100\\n` +
                         `Quality Score: ${pipelineStatus.overallScore}/100\\n` +
                         `Pipeline ID: ${pipelineStatus.context.pipelineId}`,
        });
        
        this.logger.info(`Auto-merge completed successfully for PR #${pipelineStatus.context.pullRequestNumber}`);
        
        // Start monitoring period
        await this.startPostMergeMonitoring(pipelineStatus);
        
        this.emit('auto_merge_completed', pipelineStatus);
      }
      
    } catch (error) {
      this.logger.error('Error executing auto-merge', error);
      await this.escalateToHuman(pipelineStatus, `Auto-merge failed: ${error.message}`);
    }
  }
  
  /**
   * Utility methods and setup
   */
  private setupEventHandlers(): void {
    this.on('pipeline_started', (status) => {
      this.logger.debug('Pipeline started event', { pipelineId: status.context.pipelineId });
    });
    
    this.on('pipeline_completed', (status) => {
      this.logger.debug('Pipeline completed event', { 
        pipelineId: status.context.pipelineId,
        status: status.status 
      });
    });
    
    this.on('auto_merge_completed', (status) => {
      this.logger.info('Auto-merge completed', { pipelineId: status.context.pipelineId });
    });
  }
  
  private async validateConfiguration(): Promise<void> {
    // Validate GitHub token
    try {
      await this.github.rest.users.getAuthenticated();
    } catch (error) {
      throw new Error('Invalid GitHub token');
    }
    
    // Validate AI configuration
    if (!this.config.ai.apiKey) {
      throw new Error('AI API key is required');
    }
    
    this.logger.info('Configuration validated successfully');
  }
  
  private async setupWebhookListener(): Promise<void> {
    // Implementation would setup webhook listener
    // For now, we'll assume external webhook handling
    this.logger.info('Webhook listener configured');
  }
  
  private startMonitoringLoop(): void {
    setInterval(async () => {
      if (this.isShuttingDown) return;
      
      try {
        await this.monitorActivePipelines();
        await this.cleanupCompletedPipelines();
      } catch (error) {
        this.logger.error('Error in monitoring loop', error);
      }
    }, 30000); // 30 second intervals
  }
  
  private startMetricsCollection(): void {
    setInterval(async () => {
      if (this.isShuttingDown) return;
      
      try {
        await this.collectSystemMetrics();
      } catch (error) {
        this.logger.error('Error collecting metrics', error);
      }
    }, 60000); // 1 minute intervals
  }
  
  // Additional helper methods would be implemented here...
  // This includes methods for:
  // - getWorkflowRuns()
  // - initializeQualityGates()
  // - evaluateQualityGate()
  // - calculateOverallScore()
  // - attemptAutomatedRemediation()
  // - isAutoMergeCandidate()
  // - isAutoMergeEligible()
  // - retryPipeline()
  // - escalateToHuman()
  // - abortPipeline()
  // - startPostMergeMonitoring()
  // - monitorActivePipelines()
  // - cleanupCompletedPipelines()
  // - collectSystemMetrics()
  // - etc.
  
  private async initializePipelineStatus(context: PipelineContext): Promise<PipelineStatus> {
    return {
      context,
      status: 'pending',
      qualityGates: [],
      overallScore: 0,
      failures: [],
      agentDecisions: [],
      autoMergeEligible: false,
      startTime: new Date(),
      retryCount: 0,
      lastUpdated: new Date(),
    };
  }
  
  private updateFinalStatus(pipelineStatus: PipelineStatus): void {
    const allGatesPassed = pipelineStatus.qualityGates.every(g => g.status === 'passed');
    const hasFailures = pipelineStatus.failures.some(f => f.severity === 'critical' || f.severity === 'high');
    
    if (allGatesPassed && !hasFailures) {
      pipelineStatus.status = 'success';
    } else if (hasFailures) {
      pipelineStatus.status = 'failure';
    } else {
      pipelineStatus.status = 'success'; // Warnings are ok
    }
    
    pipelineStatus.endTime = new Date();
    pipelineStatus.duration = pipelineStatus.endTime.getTime() - pipelineStatus.startTime.getTime();
  }
  
  private determineDecisionImpact(decision: any): 'none' | 'low' | 'medium' | 'high' | 'critical' {
    switch (decision.decision) {
      case 'proceed': return decision.confidence > 90 ? 'low' : 'medium';
      case 'retry': return 'medium';
      case 'escalate': return 'high';
      case 'abort': return 'critical';
      default: return 'low';
    }
  }
  
  private async waitForActivePipelines(timeoutMs: number): Promise<void> {
    const startTime = Date.now();
    
    while (this.activePipelines.size > 0 && Date.now() - startTime < timeoutMs) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    if (this.activePipelines.size > 0) {
      this.logger.warn(`${this.activePipelines.size} pipelines still active during shutdown`);
    }
  }
  
  private async handleSafetyBlock(context: PipelineContext, reason: string): Promise<void> {
    this.logger.warn(`Safety block activated: ${reason}`, { pipelineId: context.pipelineId });
    
    await this.auditLogger.log({
      action: 'safety_block_activated',
      actor: 'system',
      actorId: 'safety_controller',
      pipelineId: context.pipelineId,
      details: { reason, context },
      outcome: 'success',
      impact: 'high',
      complianceRelevant: true,
    });
  }
  
  private async handlePipelineError(context: PipelineContext, error: Error): Promise<void> {
    this.logger.error(`Pipeline error: ${context.pipelineId}`, error);
    
    await this.auditLogger.log({
      action: 'pipeline_error',
      actor: 'system',
      actorId: 'orchestrator',
      pipelineId: context.pipelineId,
      details: { error: error.message, stack: error.stack },
      outcome: 'failure',
      impact: 'high',
      complianceRelevant: true,
    });
  }
}
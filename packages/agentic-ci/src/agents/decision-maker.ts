import { OpenAI } from 'openai';
import { createLogger, Logger } from 'winston';
import { 
  AgentDecision, 
  PipelineStatus, 
  AgentConfig,
  AgentDecisionSchema 
} from '../types/index.js';

/**
 * AI-powered decision-making agent
 * 
 * Makes final decisions about pipeline actions based on:
 * - Quality gate results and overall score
 * - Failure analysis and remediation outcomes
 * - Risk assessment and auto-merge eligibility
 * - Historical patterns and success rates
 * - Business context and operational factors
 */
export class DecisionMaker {
  private readonly logger: Logger;
  private readonly openai: OpenAI;
  private readonly config: AgentConfig;
  private readonly aiConfig: { provider: string; apiKey: string; model: string };
  
  // Decision history for learning and pattern recognition
  private readonly decisionHistory: AgentDecision[] = [];
  private readonly maxHistorySize = 1000;
  
  // Decision thresholds and weights
  private readonly decisionThresholds = {
    proceed: {
      minOverallScore: 80,
      maxCriticalFailures: 0,
      maxHighFailures: 1,
      maxRiskScore: 30,
    },
    retry: {
      maxRetryCount: 3,
      minRemediationSuccess: 0.7,
      cooldownPeriod: 300000, // 5 minutes
    },
    escalate: {
      humanInterventionThreshold: 70,
      complexityThreshold: 80,
      businessImpactThreshold: 75,
    },
    abort: {
      criticalSecurityIssues: true,
      irreversibleFailures: true,
      maxRiskScore: 90,
    },
  };
  
  constructor(config: AgentConfig, aiConfig: { provider: string; apiKey: string; model: string }) {
    this.config = config;
    this.aiConfig = aiConfig;
    
    this.logger = createLogger({
      level: 'info',
      format: require('winston').format.combine(
        require('winston').format.timestamp(),
        require('winston').format.label({ label: 'DecisionMaker' }),
        require('winston').format.json()
      ),
    });
    
    this.openai = new OpenAI({
      apiKey: aiConfig.apiKey,
    });
    
    this.loadDecisionHistory();
  }
  
  /**
   * Make the final decision for pipeline progression
   */
  public async makeDecision(pipelineStatus: PipelineStatus): Promise<AgentDecision> {
    const startTime = Date.now();
    
    this.logger.info(`Making decision for pipeline ${pipelineStatus.context.pipelineId}`, {
      overallScore: pipelineStatus.overallScore,
      failureCount: pipelineStatus.failures.length,
      autoMergeEligible: pipelineStatus.autoMergeEligible,
    });
    
    try {
      // Step 1: Analyze current pipeline state
      const analysisContext = await this.analyzeCurrentState(pipelineStatus);
      
      // Step 2: Apply rule-based decision logic
      const ruleBasedDecision = this.applyRuleBasedLogic(pipelineStatus, analysisContext);
      
      // Step 3: Get AI validation and reasoning
      const aiDecision = await this.getAIDecision(pipelineStatus, analysisContext, ruleBasedDecision);
      
      // Step 4: Combine rule-based and AI decisions
      const finalDecision = this.combineDecisions(ruleBasedDecision, aiDecision, pipelineStatus);
      
      // Step 5: Validate and create final decision object
      const decision = this.createFinalDecision(finalDecision, pipelineStatus, startTime);
      
      // Step 6: Learn from this decision
      await this.recordDecision(decision, pipelineStatus);
      
      this.logger.info('Decision made', {
        pipelineId: pipelineStatus.context.pipelineId,
        decision: decision.decision,
        confidence: decision.confidence,
        reasoning: decision.reasoning,
        executionTime: decision.executionTime,
      });
      
      return decision;
      
    } catch (error) {
      this.logger.error('Decision making failed', error);
      
      // Return safe default decision on error
      return this.createEmergencyDecision(pipelineStatus, error as Error, startTime);
    }
  }
  
  /**
   * Analyze the current pipeline state for decision context
   */
  private async analyzeCurrentState(pipelineStatus: PipelineStatus): Promise<DecisionContext> {
    const context: DecisionContext = {
      qualityScore: pipelineStatus.overallScore,
      failureAnalysis: this.analyzeFailures(pipelineStatus.failures),
      riskLevel: pipelineStatus.riskAssessment?.riskScore || 100,
      remediationSuccess: this.calculateRemediationSuccess(pipelineStatus),
      historicalPattern: await this.getHistoricalPattern(pipelineStatus),
      businessContext: this.assessBusinessContext(pipelineStatus),
      operationalFactors: this.assessOperationalFactors(pipelineStatus),
    };
    
    return context;
  }
  
  /**
   * Apply rule-based decision logic
   */
  private applyRuleBasedLogic(
    pipelineStatus: PipelineStatus, 
    context: DecisionContext
  ): RuleBasedDecision {
    
    // Check for ABORT conditions first (highest priority)
    if (this.shouldAbort(pipelineStatus, context)) {
      return {
        decision: 'abort',
        confidence: 95,
        reasoning: 'Critical issues detected that require immediate abort',
        factors: ['critical_security', 'irreversible_failure', 'extreme_risk'],
      };
    }
    
    // Check for ESCALATE conditions
    if (this.shouldEscalate(pipelineStatus, context)) {
      return {
        decision: 'escalate',
        confidence: 85,
        reasoning: 'Complex issues require human intervention',
        factors: ['complexity', 'business_impact', 'uncertainty'],
      };
    }
    
    // Check for RETRY conditions
    if (this.shouldRetry(pipelineStatus, context)) {
      return {
        decision: 'retry',
        confidence: 75,
        reasoning: 'Transient failures detected, retry likely to succeed',
        factors: ['transient_failure', 'remediation_available', 'retry_budget'],
      };
    }
    
    // Check for PROCEED conditions
    if (this.shouldProceed(pipelineStatus, context)) {
      return {
        decision: 'proceed',
        confidence: 90,
        reasoning: 'All quality gates passed, low risk, good to proceed',
        factors: ['quality_gates_passed', 'low_risk', 'auto_merge_eligible'],
      };
    }
    
    // Default to human review if uncertain
    return {
      decision: 'escalate',
      confidence: 50,
      reasoning: 'Uncertain conditions - defaulting to human review for safety',
      factors: ['uncertainty', 'default_safety'],
    };
  }
  
  /**
   * Get AI decision and reasoning
   */
  private async getAIDecision(
    pipelineStatus: PipelineStatus,
    context: DecisionContext,
    ruleBasedDecision: RuleBasedDecision
  ): Promise<AIDecision> {
    
    try {
      const prompt = this.buildDecisionPrompt(pipelineStatus, context, ruleBasedDecision);
      
      const response = await this.openai.chat.completions.create({
        model: this.aiConfig.model,
        messages: [
          {
            role: 'system',
            content: this.getDecisionSystemPrompt(),
          },
          {
            role: 'user',
            content: prompt,
          }
        ],
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
        response_format: { type: 'json_object' },
      });
      
      const aiResponse = JSON.parse(response.choices[0]?.message?.content || '{}');
      
      return {
        decision: this.validateDecision(aiResponse.decision) || ruleBasedDecision.decision,
        confidence: this.validateConfidence(aiResponse.confidence) || 50,
        reasoning: aiResponse.reasoning || 'AI reasoning unavailable',
        factors: Array.isArray(aiResponse.factors) ? aiResponse.factors : [],
        agrees: aiResponse.decision === ruleBasedDecision.decision,
      };
      
    } catch (error) {
      this.logger.warn('AI decision failed, using rule-based decision', error);
      
      return {
        decision: ruleBasedDecision.decision,
        confidence: Math.max(ruleBasedDecision.confidence - 20, 30), // Reduce confidence
        reasoning: `AI decision failed: ${error.message}. Using rule-based decision.`,
        factors: ruleBasedDecision.factors,
        agrees: true,
      };
    }
  }
  
  /**
   * Combine rule-based and AI decisions
   */
  private combineDecisions(
    ruleBasedDecision: RuleBasedDecision,
    aiDecision: AIDecision,
    pipelineStatus: PipelineStatus
  ): CombinedDecision {
    
    // If AI and rules agree, use higher confidence
    if (aiDecision.agrees) {
      return {
        decision: ruleBasedDecision.decision,
        confidence: Math.max(ruleBasedDecision.confidence, aiDecision.confidence),
        reasoning: `Rule-based and AI analysis agree: ${aiDecision.reasoning}`,
        factors: [...new Set([...ruleBasedDecision.factors, ...aiDecision.factors])],
        agreement: true,
      };
    }
    
    // If they disagree, apply conflict resolution
    const resolvedDecision = this.resolveDecisionConflict(
      ruleBasedDecision, 
      aiDecision, 
      pipelineStatus
    );
    
    return resolvedDecision;
  }
  
  /**
   * Resolve conflicts between rule-based and AI decisions
   */
  private resolveDecisionConflict(
    ruleBasedDecision: RuleBasedDecision,
    aiDecision: AIDecision,
    pipelineStatus: PipelineStatus
  ): CombinedDecision {
    
    // Safety first - prefer more conservative decision
    const decisionSafety = {
      'abort': 4,     // Most conservative
      'escalate': 3,  
      'retry': 2,
      'proceed': 1,   // Least conservative
    };
    
    const ruleSafety = decisionSafety[ruleBasedDecision.decision] || 0;
    const aiSafety = decisionSafety[aiDecision.decision] || 0;
    
    // Choose more conservative decision
    const finalDecision = ruleSafety >= aiSafety ? ruleBasedDecision.decision : aiDecision.decision;
    
    // Reduce confidence due to disagreement
    const confidence = Math.min(
      (ruleBasedDecision.confidence + aiDecision.confidence) / 2 - 10,
      70 // Cap at 70% when there's disagreement
    );
    
    return {
      decision: finalDecision,
      confidence: Math.max(confidence, 30), // Minimum 30% confidence
      reasoning: `Conflict resolved: Rule-based suggested ${ruleBasedDecision.decision}, AI suggested ${aiDecision.decision}. Chose more conservative option: ${finalDecision}. Rule reasoning: ${ruleBasedDecision.reasoning}. AI reasoning: ${aiDecision.reasoning}`,
      factors: [...new Set([...ruleBasedDecision.factors, ...aiDecision.factors, 'conflict_resolved'])],
      agreement: false,
    };
  }
  
  /**
   * Create the final decision object
   */
  private createFinalDecision(
    combinedDecision: CombinedDecision,
    pipelineStatus: PipelineStatus,
    startTime: number
  ): AgentDecision {
    
    const executionTime = Date.now() - startTime;
    
    const decision: AgentDecision = {
      agentId: 'decision-maker',
      agentVersion: '1.0.0',
      decision: combinedDecision.decision,
      confidence: combinedDecision.confidence,
      reasoning: combinedDecision.reasoning,
      context: {
        pipelineId: pipelineStatus.context.pipelineId,
        overallScore: pipelineStatus.overallScore,
        failureCount: pipelineStatus.failures.length,
        riskScore: pipelineStatus.riskAssessment?.riskScore || 100,
        autoMergeEligible: pipelineStatus.autoMergeEligible,
        factors: combinedDecision.factors,
        agreement: combinedDecision.agreement,
      },
      recommendedActions: this.generateRecommendedActions(combinedDecision, pipelineStatus),
      escalationRequired: combinedDecision.decision === 'escalate',
      humanInterventionNeeded: ['escalate', 'abort'].includes(combinedDecision.decision),
      timestamp: new Date(),
      executionTime,
    };
    
    // Validate with schema
    return AgentDecisionSchema.parse(decision);
  }
  
  /**
   * Create emergency decision on error
   */
  private createEmergencyDecision(
    pipelineStatus: PipelineStatus,
    error: Error,
    startTime: number
  ): AgentDecision {
    
    return {
      agentId: 'decision-maker',
      agentVersion: '1.0.0',
      decision: 'escalate',
      confidence: 20,
      reasoning: `Emergency decision due to decision-making failure: ${error.message}. Defaulting to human escalation for safety.`,
      context: {
        pipelineId: pipelineStatus.context.pipelineId,
        error: error.message,
        emergency: true,
      },
      recommendedActions: [
        'Review decision-making agent logs',
        'Manual assessment of pipeline status',
        'Investigate decision-making system failure',
      ],
      escalationRequired: true,
      humanInterventionNeeded: true,
      timestamp: new Date(),
      executionTime: Date.now() - startTime,
    };
  }
  
  /**
   * Decision condition checks
   */
  private shouldAbort(pipelineStatus: PipelineStatus, context: DecisionContext): boolean {
    // Critical security vulnerabilities
    const criticalSecurityFailures = pipelineStatus.failures.filter(f => 
      f.category === 'security_vulnerability' && f.severity === 'critical'
    );
    
    if (criticalSecurityFailures.length > 0) return true;
    
    // Extremely high risk score
    if (context.riskLevel > this.decisionThresholds.abort.maxRiskScore) return true;
    
    // Irreversible failures (database migrations, breaking changes)
    const irreversibleFailures = pipelineStatus.failures.filter(f =>
      f.evidence.some(e => 
        e.content.toLowerCase().includes('migration') ||
        e.content.toLowerCase().includes('breaking') ||
        e.content.toLowerCase().includes('irreversible')
      )
    );
    
    if (irreversibleFailures.length > 0 && context.riskLevel > 70) return true;
    
    return false;
  }
  
  private shouldEscalate(pipelineStatus: PipelineStatus, context: DecisionContext): boolean {
    // High business impact
    if (context.businessContext.impact > this.decisionThresholds.escalate.businessImpactThreshold) {
      return true;
    }
    
    // High complexity
    if (context.businessContext.complexity > this.decisionThresholds.escalate.complexityThreshold) {
      return true;
    }
    
    // Human intervention threshold exceeded
    if (context.riskLevel > this.decisionThresholds.escalate.humanInterventionThreshold) {
      return true;
    }
    
    // Multiple unresolved high severity failures
    const highSeverityFailures = pipelineStatus.failures.filter(f => 
      f.severity === 'high' || f.severity === 'critical'
    );
    
    if (highSeverityFailures.length > 2) return true;
    
    // Performance regressions in production
    const performanceRegressions = pipelineStatus.failures.filter(f =>
      f.category === 'performance_regression'
    );
    
    if (performanceRegressions.length > 0 && pipelineStatus.context.environment === 'production') {
      return true;
    }
    
    return false;
  }
  
  private shouldRetry(pipelineStatus: PipelineStatus, context: DecisionContext): boolean {
    // Already exceeded retry limit
    if (pipelineStatus.retryCount >= this.decisionThresholds.retry.maxRetryCount) {
      return false;
    }
    
    // High remediation success rate
    if (context.remediationSuccess >= this.decisionThresholds.retry.minRemediationSuccess) {
      return true;
    }
    
    // Transient failures (infrastructure, flaky tests)
    const transientFailures = pipelineStatus.failures.filter(f =>
      f.category === 'flaky_test' || 
      f.category === 'infrastructure' ||
      f.category === 'external_service'
    );
    
    if (transientFailures.length > 0 && transientFailures.length === pipelineStatus.failures.length) {
      return true;
    }
    
    return false;
  }
  
  private shouldProceed(pipelineStatus: PipelineStatus, context: DecisionContext): boolean {
    // Overall score threshold
    if (pipelineStatus.overallScore < this.decisionThresholds.proceed.minOverallScore) {
      return false;
    }
    
    // Critical failures
    const criticalFailures = pipelineStatus.failures.filter(f => f.severity === 'critical');
    if (criticalFailures.length > this.decisionThresholds.proceed.maxCriticalFailures) {
      return false;
    }
    
    // High severity failures
    const highFailures = pipelineStatus.failures.filter(f => f.severity === 'high');
    if (highFailures.length > this.decisionThresholds.proceed.maxHighFailures) {
      return false;
    }
    
    // Risk score
    if (context.riskLevel > this.decisionThresholds.proceed.maxRiskScore) {
      return false;
    }
    
    // All quality gates must pass
    const failedGates = pipelineStatus.qualityGates.filter(g => g.status === 'failed');
    if (failedGates.length > 0) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Helper methods
   */
  private analyzeFailures(failures: any[]): any {
    const categories = new Map<string, number>();
    const severities = new Map<string, number>();
    
    for (const failure of failures) {
      categories.set(failure.category, (categories.get(failure.category) || 0) + 1);
      severities.set(failure.severity, (severities.get(failure.severity) || 0) + 1);
    }
    
    return {
      total: failures.length,
      categories: Object.fromEntries(categories),
      severities: Object.fromEntries(severities),
      criticalCount: severities.get('critical') || 0,
      highCount: severities.get('high') || 0,
    };
  }
  
  private calculateRemediationSuccess(pipelineStatus: PipelineStatus): number {
    // In a real implementation, this would track remediation success rates
    // For now, return a placeholder based on failure categories
    const automatableFailures = pipelineStatus.failures.filter(f => f.automatedFixAvailable);
    return automatableFailures.length > 0 ? 0.7 : 0.3;
  }
  
  private async getHistoricalPattern(pipelineStatus: PipelineStatus): Promise<any> {
    // In a real implementation, this would analyze historical pipeline patterns
    return {
      similarPipelines: 10,
      successRate: 0.85,
      averageFixTime: 300000, // 5 minutes
    };
  }
  
  private assessBusinessContext(pipelineStatus: PipelineStatus): any {
    let impact = 50; // Medium impact baseline
    let complexity = 50; // Medium complexity baseline
    
    // Assess based on branch and context
    if (pipelineStatus.context.branch === 'main') impact += 30;
    if (pipelineStatus.context.isPullRequest) impact -= 10;
    if (pipelineStatus.context.environment === 'production') impact += 40;
    
    // Assess complexity based on failures and changes
    if (pipelineStatus.failures.length > 3) complexity += 20;
    if (pipelineStatus.qualityGates.length > 10) complexity += 15;
    
    return {
      impact: Math.min(impact, 100),
      complexity: Math.min(complexity, 100),
    };
  }
  
  private assessOperationalFactors(pipelineStatus: PipelineStatus): any {
    const now = new Date();
    const isBusinessHours = now.getHours() >= 9 && now.getHours() <= 17;
    const isWeekend = now.getDay() === 0 || now.getDay() === 6;
    
    return {
      timing: {
        isBusinessHours,
        isWeekend,
        hour: now.getHours(),
      },
      supportAvailability: isBusinessHours && !isWeekend ? 'high' : 'low',
    };
  }
  
  private generateRecommendedActions(
    decision: CombinedDecision, 
    pipelineStatus: PipelineStatus
  ): string[] {
    const actions: string[] = [];
    
    switch (decision.decision) {
      case 'proceed':
        if (pipelineStatus.autoMergeEligible) {
          actions.push('Execute automated merge');
          actions.push('Monitor post-merge metrics');
        } else {
          actions.push('Manual merge approval required');
        }
        break;
        
      case 'retry':
        actions.push('Retry failed operations with exponential backoff');
        actions.push('Apply available automated fixes');
        actions.push('Monitor retry success rate');
        break;
        
      case 'escalate':
        actions.push('Notify human reviewers');
        actions.push('Provide detailed failure analysis');
        actions.push('Prepare rollback plan if needed');
        break;
        
      case 'abort':
        actions.push('Immediately halt pipeline execution');
        actions.push('Notify emergency response team');
        actions.push('Document critical issues found');
        actions.push('Initiate incident response procedure');
        break;
    }
    
    return actions;
  }
  
  private buildDecisionPrompt(
    pipelineStatus: PipelineStatus,
    context: DecisionContext,
    ruleBasedDecision: RuleBasedDecision
  ): string {
    return `Make a final decision for this CI/CD pipeline:

PIPELINE STATUS:
- Overall Score: ${pipelineStatus.overallScore}/100
- Auto-merge Eligible: ${pipelineStatus.autoMergeEligible}
- Retry Count: ${pipelineStatus.retryCount}

FAILURES (${pipelineStatus.failures.length}):
${pipelineStatus.failures.map(f => `- ${f.category}: ${f.severity} - ${f.rootCause}`).join('\n')}

QUALITY GATES:
${pipelineStatus.qualityGates.map(g => `- ${g.name}: ${g.status}`).join('\n')}

RISK ASSESSMENT:
- Risk Score: ${pipelineStatus.riskAssessment?.riskScore || 100}/100
- Recommendation: ${pipelineStatus.riskAssessment?.recommendation || 'unknown'}

CONTEXT:
- Repository: ${pipelineStatus.context.repository}
- Branch: ${pipelineStatus.context.branch}
- Environment: ${pipelineStatus.context.environment}
- Business Hours: ${context.operationalFactors.timing.isBusinessHours}

RULE-BASED DECISION: ${ruleBasedDecision.decision} (confidence: ${ruleBasedDecision.confidence}%)
REASONING: ${ruleBasedDecision.reasoning}

Please provide your decision and reasoning.`;
  }
  
  private getDecisionSystemPrompt(): string {
    return `You are an expert CI/CD decision-making agent. Your job is to make final decisions about pipeline progression.

DECISION OPTIONS:
- proceed: Continue with deployment/merge (low risk, all gates pass)
- retry: Retry failed operations (transient failures, fixes available)  
- escalate: Require human review (complex issues, medium-high risk)
- abort: Stop immediately (critical issues, extreme risk)

DECISION CRITERIA:
- Safety first - prefer conservative decisions when uncertain
- Consider business impact and user-facing consequences
- Account for operational context (time, support availability)
- Validate that supporting evidence aligns with decision
- Provide clear, actionable reasoning

RESPONSE FORMAT (JSON):
{
  "decision": "proceed|retry|escalate|abort",
  "confidence": confidence_score_0_to_100,
  "reasoning": "Clear reasoning for this decision",
  "factors": ["key_factor_1", "key_factor_2", ...],
  "risks": ["potential_risk_1", "potential_risk_2", ...],
  "mitigations": ["mitigation_1", "mitigation_2", ...]
}

QUALITY STANDARDS:
- High confidence (80-100%): Clear evidence, low risk, straightforward case
- Medium confidence (50-79%): Some uncertainty, moderate risk, requires judgment
- Low confidence (20-49%): High uncertainty, should escalate to human review
- Very low confidence (<20%): Critical uncertainty, must escalate or abort`;
  }
  
  private validateDecision(decision: any): string | null {
    const validDecisions = ['proceed', 'retry', 'escalate', 'abort'];
    return validDecisions.includes(decision) ? decision : null;
  }
  
  private validateConfidence(confidence: any): number | null {
    const num = Number(confidence);
    return (!isNaN(num) && num >= 0 && num <= 100) ? num : null;
  }
  
  private async recordDecision(decision: AgentDecision, pipelineStatus: PipelineStatus): Promise<void> {
    // Add to decision history
    this.decisionHistory.push(decision);
    
    // Keep history size manageable
    if (this.decisionHistory.length > this.maxHistorySize) {
      this.decisionHistory.splice(0, this.decisionHistory.length - this.maxHistorySize);
    }
    
    this.logger.debug('Decision recorded in history', {
      historySize: this.decisionHistory.length,
      decision: decision.decision,
      confidence: decision.confidence,
    });
  }
  
  private loadDecisionHistory(): void {
    // In production, this would load from persistent storage
    this.logger.info('Decision history loaded');
  }
}

// Helper interfaces
interface DecisionContext {
  qualityScore: number;
  failureAnalysis: any;
  riskLevel: number;
  remediationSuccess: number;
  historicalPattern: any;
  businessContext: any;
  operationalFactors: any;
}

interface RuleBasedDecision {
  decision: 'proceed' | 'retry' | 'escalate' | 'abort';
  confidence: number;
  reasoning: string;
  factors: string[];
}

interface AIDecision {
  decision: 'proceed' | 'retry' | 'escalate' | 'abort';
  confidence: number;
  reasoning: string;
  factors: string[];
  agrees: boolean;
}

interface CombinedDecision {
  decision: 'proceed' | 'retry' | 'escalate' | 'abort';
  confidence: number;
  reasoning: string;
  factors: string[];
  agreement: boolean;
}
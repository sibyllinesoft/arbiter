import { OpenAI } from 'openai';
import { createLogger, Logger } from 'winston';
import { Octokit } from '@octokit/rest';
import { 
  RiskAssessment, 
  PipelineStatus, 
  AgentConfig,
  RiskAssessmentSchema 
} from '../types/index.js';

/**
 * AI-powered risk assessment agent for auto-merge decisions
 * 
 * Analyzes multiple risk factors to determine the safety of automatic merging:
 * - Change size and complexity
 * - Test coverage and quality
 * - Historical stability patterns  
 * - Author experience and track record
 * - Timing and operational context
 * - Feature flag and rollback capabilities
 */
export class RiskAssessor {
  private readonly logger: Logger;
  private readonly openai: OpenAI;
  private readonly config: AgentConfig;
  private readonly aiConfig: { provider: string; apiKey: string; model: string };
  
  // Risk calculation weights and thresholds
  private readonly riskWeights = {
    changeSize: 0.20,
    testCoverage: 0.25,
    historicalStability: 0.20,
    authorExperience: 0.15,
    timeOfDay: 0.10,
    featureFlags: 0.10,
  };
  
  private readonly riskThresholds = {
    autoMerge: 30,    // Risk score <= 30 for auto-merge
    humanReview: 70,  // Risk score <= 70 for human review
    block: 100,       // Risk score > 70 blocks merge
  };
  
  constructor(config: AgentConfig, aiConfig: { provider: string; apiKey: string; model: string }) {
    this.config = config;
    this.aiConfig = aiConfig;
    
    this.logger = createLogger({
      level: 'info',
      format: require('winston').format.combine(
        require('winston').format.timestamp(),
        require('winston').format.label({ label: 'RiskAssessor' }),
        require('winston').format.json()
      ),
    });
    
    this.openai = new OpenAI({
      apiKey: aiConfig.apiKey,
    });
  }
  
  /**
   * Assess overall risk for auto-merge decision
   */
  public async assessRisk(pipelineStatus: PipelineStatus): Promise<RiskAssessment> {
    this.logger.info(`Assessing auto-merge risk for pipeline ${pipelineStatus.context.pipelineId}`);
    
    const startTime = Date.now();
    
    try {
      // Calculate individual risk factors
      const changeSizeRisk = await this.assessChangeSize(pipelineStatus);
      const testCoverageRisk = await this.assessTestCoverage(pipelineStatus);
      const historicalStabilityRisk = await this.assessHistoricalStability(pipelineStatus);
      const authorExperienceRisk = await this.assessAuthorExperience(pipelineStatus);
      const timeOfDayRisk = await this.assessTimeOfDay(pipelineStatus);
      const featureFlagsRisk = await this.assessFeatureFlags(pipelineStatus);
      
      // Calculate weighted overall risk score
      const overallRiskScore = this.calculateOverallRisk({
        changeSize: changeSizeRisk,
        testCoverage: testCoverageRisk,
        historicalStability: historicalStabilityRisk,
        authorExperience: authorExperienceRisk,
        timeOfDay: timeOfDayRisk,
        featureFlags: featureFlagsRisk,
      });
      
      // Generate recommendation based on risk score
      const recommendation = this.generateRecommendation(overallRiskScore);
      
      // Use AI to generate reasoning and validate decision
      const aiValidation = await this.validateWithAI(pipelineStatus, overallRiskScore, recommendation);
      
      const riskAssessment: RiskAssessment = {
        riskScore: overallRiskScore,
        factors: {
          changeSize: changeSizeRisk,
          testCoverage: testCoverageRisk,
          historicalStability: historicalStabilityRisk,
          authorExperience: authorExperienceRisk,
          timeOfDay: timeOfDayRisk,
          featureFlags: featureFlagsRisk,
        },
        recommendation: aiValidation.recommendation || recommendation,
        reasoning: aiValidation.reasoning,
        requiredApprovals: this.calculateRequiredApprovals(overallRiskScore),
        rolloutStrategy: this.recommendRolloutStrategy(overallRiskScore),
      };
      
      const duration = Date.now() - startTime;
      this.logger.info('Risk assessment completed', {
        pipelineId: pipelineStatus.context.pipelineId,
        riskScore: overallRiskScore,
        recommendation: riskAssessment.recommendation,
        duration: `${duration}ms`,
      });
      
      // Validate result with schema
      return RiskAssessmentSchema.parse(riskAssessment);
      
    } catch (error) {
      this.logger.error('Risk assessment failed', error);
      
      // Return safe default on error
      return {
        riskScore: 100,
        factors: this.getDefaultRiskFactors(),
        recommendation: 'human_review',
        reasoning: `Risk assessment failed: ${error.message}. Defaulting to human review for safety.`,
        requiredApprovals: 2,
        rolloutStrategy: 'manual',
      };
    }
  }
  
  /**
   * Assess risk based on change size and complexity
   */
  private async assessChangeSize(pipelineStatus: PipelineStatus): Promise<any> {
    try {
      // This would integrate with GitHub API to get diff stats
      // For now, we'll simulate based on available context
      
      const context = pipelineStatus.context;
      let linesChanged = 0;
      let filesChanged = 0;
      
      // In a real implementation, get actual diff stats from GitHub
      // For simulation, estimate based on pipeline context
      if (context.isPullRequest) {
        // Simulate getting PR diff stats
        linesChanged = Math.floor(Math.random() * 500); // 0-500 lines
        filesChanged = Math.floor(Math.random() * 20);  // 0-20 files
      }
      
      // Calculate risk score based on change size
      let score = 0;
      
      // Lines changed risk (0-40 points)
      if (linesChanged > 200) score += 40;
      else if (linesChanged > 100) score += 25;
      else if (linesChanged > 50) score += 15;
      else score += Math.floor(linesChanged / 5); // 1 point per 5 lines
      
      // Files changed risk (0-30 points)
      if (filesChanged > 10) score += 30;
      else if (filesChanged > 5) score += 20;
      else score += filesChanged * 3;
      
      // Additional complexity factors (0-30 points)
      const evidenceText = pipelineStatus.failures
        .flatMap(f => f.evidence.map(e => e.content))
        .join(' ')
        .toLowerCase();
      
      if (evidenceText.includes('migration') || evidenceText.includes('schema')) score += 15;
      if (evidenceText.includes('config') || evidenceText.includes('environment')) score += 10;
      if (evidenceText.includes('api') || evidenceText.includes('breaking')) score += 10;
      
      return {
        linesChanged,
        filesChanged,
        score: Math.min(score, 100),
      };
      
    } catch (error) {
      this.logger.warn('Failed to assess change size risk', error);
      return {
        linesChanged: 0,
        filesChanged: 0,
        score: 50, // Default to medium risk
      };
    }
  }
  
  /**
   * Assess risk based on test coverage and quality
   */
  private async assessTestCoverage(pipelineStatus: PipelineStatus): Promise<any> {
    try {
      // Extract test coverage from quality gates
      const testGates = pipelineStatus.qualityGates.filter(g => 
        g.category === 'testing' || g.name.toLowerCase().includes('test')
      );
      
      let coverageScore = 100; // Start with full coverage assumption
      let coverageDelta = 0;
      
      // Analyze test quality gates
      for (const gate of testGates) {
        if (gate.status === 'failed') {
          coverageScore -= 20;
        } else if (gate.status === 'passed' && gate.result) {
          // Extract actual coverage if available
          if (gate.result.metrics.coverage) {
            coverageScore = Number(gate.result.metrics.coverage);
            break;
          }
        }
      }
      
      // Calculate risk score (inverted - higher coverage = lower risk)
      let score = 0;
      if (coverageScore < 70) score += 40;
      else if (coverageScore < 80) score += 25;
      else if (coverageScore < 90) score += 15;
      else score += Math.max(0, (100 - coverageScore) * 2);
      
      // Coverage delta risk
      if (coverageDelta < -5) score += 20; // Significant coverage drop
      else if (coverageDelta < -2) score += 10; // Minor coverage drop
      
      return {
        current: coverageScore,
        delta: coverageDelta,
        score: Math.min(score, 100),
      };
      
    } catch (error) {
      this.logger.warn('Failed to assess test coverage risk', error);
      return {
        current: 80,
        delta: 0,
        score: 20, // Assume reasonable coverage
      };
    }
  }
  
  /**
   * Assess risk based on historical stability
   */
  private async assessHistoricalStability(pipelineStatus: PipelineStatus): Promise<any> {
    try {
      // This would analyze historical pipeline success rates
      // For simulation, we'll use failure patterns
      
      const recentFailures = pipelineStatus.failures.length;
      const criticalFailures = pipelineStatus.failures.filter(f => 
        f.severity === 'critical' || f.severity === 'high'
      ).length;
      
      // Simulate historical data
      const successRate = Math.max(60, 100 - (recentFailures * 10) - (criticalFailures * 15));
      const avgFixTime = recentFailures > 0 ? 300000 : 120000; // 5min vs 2min in ms
      
      // Calculate risk score
      let score = 0;
      if (successRate < 80) score += 30;
      else if (successRate < 90) score += 20;
      else if (successRate < 95) score += 10;
      
      if (avgFixTime > 600000) score += 20; // >10 minutes
      else if (avgFixTime > 300000) score += 10; // >5 minutes
      
      return {
        successRate,
        avgFixTime,
        score: Math.min(score, 100),
      };
      
    } catch (error) {
      this.logger.warn('Failed to assess historical stability risk', error);
      return {
        successRate: 90,
        avgFixTime: 180000,
        score: 15,
      };
    }
  }
  
  /**
   * Assess risk based on author experience and track record
   */
  private async assessAuthorExperience(pipelineStatus: PipelineStatus): Promise<any> {
    try {
      const author = pipelineStatus.context.actor;
      
      // In production, this would query GitHub API for author stats
      // Simulate based on available context
      const commitsInRepo = Math.floor(Math.random() * 200) + 10; // 10-210 commits
      const recentFailureRate = Math.random() * 20; // 0-20% failure rate
      
      // Calculate risk score (experienced authors = lower risk)
      let score = 0;
      if (commitsInRepo < 5) score += 30;       // New contributor
      else if (commitsInRepo < 20) score += 20; // Junior contributor
      else if (commitsInRepo < 50) score += 10; // Regular contributor
      // else score += 0; // Experienced contributor
      
      if (recentFailureRate > 15) score += 25;  // High failure rate
      else if (recentFailureRate > 10) score += 15; // Medium failure rate
      else if (recentFailureRate > 5) score += 5;   // Low failure rate
      
      return {
        commitsInRepo,
        recentFailureRate,
        score: Math.min(score, 100),
      };
      
    } catch (error) {
      this.logger.warn('Failed to assess author experience risk', error);
      return {
        commitsInRepo: 50,
        recentFailureRate: 5,
        score: 10,
      };
    }
  }
  
  /**
   * Assess risk based on timing (business hours, weekends, etc.)
   */
  private assessTimeOfDay(pipelineStatus: PipelineStatus): any {
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay();
    
    const isBusinessHours = hour >= 9 && hour <= 17; // 9 AM - 5 PM
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday
    
    let score = 0;
    
    if (isWeekend) score += 30;           // Higher risk on weekends
    else if (!isBusinessHours) score += 15; // Higher risk outside business hours
    
    // Additional considerations
    if (hour >= 22 || hour <= 6) score += 15; // Very late/early hours
    if (dayOfWeek === 5 && hour >= 15) score += 10; // Friday afternoon
    
    return {
      isBusinessHours,
      isWeekend,
      score: Math.min(score, 100),
    };
  }
  
  /**
   * Assess risk based on feature flags and rollback capabilities
   */
  private async assessFeatureFlags(pipelineStatus: PipelineStatus): Promise<any> {
    try {
      // In production, this would check for feature flag configurations
      // and deployment strategies
      
      // Simulate feature flag detection from context
      const evidenceText = pipelineStatus.failures
        .flatMap(f => f.evidence.map(e => e.content))
        .join(' ')
        .toLowerCase();
      
      const canRollback = !evidenceText.includes('migration') && 
                         !evidenceText.includes('schema') &&
                         !evidenceText.includes('breaking');
                         
      const hasGradualRollout = evidenceText.includes('feature') ||
                               evidenceText.includes('flag') ||
                               pipelineStatus.context.branch.includes('feature');
      
      let score = 0;
      
      if (!canRollback) score += 40;        // No rollback capability
      if (!hasGradualRollout) score += 30;  // No gradual rollout
      
      return {
        canRollback,
        hasGradualRollout,
        score: Math.min(score, 100),
      };
      
    } catch (error) {
      this.logger.warn('Failed to assess feature flags risk', error);
      return {
        canRollback: true,
        hasGradualRollout: false,
        score: 30,
      };
    }
  }
  
  /**
   * Calculate overall weighted risk score
   */
  private calculateOverallRisk(factors: any): number {
    const weightedScore = 
      factors.changeSize.score * this.riskWeights.changeSize +
      factors.testCoverage.score * this.riskWeights.testCoverage +
      factors.historicalStability.score * this.riskWeights.historicalStability +
      factors.authorExperience.score * this.riskWeights.authorExperience +
      factors.timeOfDay.score * this.riskWeights.timeOfDay +
      factors.featureFlags.score * this.riskWeights.featureFlags;
    
    return Math.round(Math.min(weightedScore, 100));
  }
  
  /**
   * Generate recommendation based on risk score
   */
  private generateRecommendation(riskScore: number): 'auto_merge' | 'human_review' | 'block' {
    if (riskScore <= this.riskThresholds.autoMerge) {
      return 'auto_merge';
    } else if (riskScore <= this.riskThresholds.humanReview) {
      return 'human_review';
    } else {
      return 'block';
    }
  }
  
  /**
   * Validate decision with AI and generate reasoning
   */
  private async validateWithAI(
    pipelineStatus: PipelineStatus, 
    riskScore: number, 
    recommendation: string
  ): Promise<{ recommendation?: string; reasoning: string }> {
    
    try {
      const prompt = this.buildValidationPrompt(pipelineStatus, riskScore, recommendation);
      
      const response = await this.openai.chat.completions.create({
        model: this.aiConfig.model,
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt(),
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
        recommendation: aiResponse.recommendation === recommendation ? undefined : aiResponse.recommendation,
        reasoning: aiResponse.reasoning || this.generateDefaultReasoning(riskScore, recommendation),
      };
      
    } catch (error) {
      this.logger.warn('AI validation failed, using default reasoning', error);
      return {
        reasoning: this.generateDefaultReasoning(riskScore, recommendation),
      };
    }
  }
  
  private buildValidationPrompt(
    pipelineStatus: PipelineStatus, 
    riskScore: number, 
    recommendation: string
  ): string {
    return `Validate this auto-merge risk assessment and recommendation:

PIPELINE CONTEXT:
- Repository: ${pipelineStatus.context.repository}
- Branch: ${pipelineStatus.context.branch}
- Event: ${pipelineStatus.context.eventName}
- Pull Request: ${pipelineStatus.context.isPullRequest ? `#${pipelineStatus.context.pullRequestNumber}` : 'N/A'}

RISK ASSESSMENT:
- Overall Risk Score: ${riskScore}/100
- Calculated Recommendation: ${recommendation}

QUALITY GATES:
${pipelineStatus.qualityGates.map(g => `- ${g.name}: ${g.status} (${g.category})`).join('\n')}

FAILURES:
${pipelineStatus.failures.map(f => `- ${f.category}: ${f.severity} - ${f.rootCause}`).join('\n')}

Please validate the recommendation and provide detailed reasoning.`;
  }
  
  private getSystemPrompt(): string {
    return `You are an expert DevOps risk assessment validator. Your job is to validate auto-merge recommendations and provide clear reasoning.

VALIDATION CRITERIA:
- Safety first - prefer human review over automation when uncertain
- Consider business impact and user-facing changes
- Account for deployment timing and operational context
- Validate that risk factors align with recommendation
- Provide clear, actionable reasoning

RESPONSE FORMAT (JSON):
{
  "recommendation": "auto_merge|human_review|block",
  "reasoning": "Detailed reasoning for the recommendation",
  "concerns": ["List of specific concerns if any"],
  "mitigations": ["Suggested risk mitigations if applicable"]
}

DECISION GUIDELINES:
- auto_merge: Low risk, high confidence, good coverage, experienced author
- human_review: Medium risk or uncertainty, complex changes, timing concerns  
- block: High risk, critical issues, insufficient testing, deployment concerns`;
  }
  
  private generateDefaultReasoning(riskScore: number, recommendation: string): string {
    const reasons = [];
    
    if (riskScore <= 30) {
      reasons.push(`Low risk score (${riskScore}/100) indicates safe auto-merge conditions`);
    } else if (riskScore <= 70) {
      reasons.push(`Medium risk score (${riskScore}/100) suggests human oversight is appropriate`);
    } else {
      reasons.push(`High risk score (${riskScore}/100) indicates significant concerns that require attention`);
    }
    
    return reasons.join('. ') + '.';
  }
  
  private calculateRequiredApprovals(riskScore: number): number {
    if (riskScore <= 30) return 0;      // Auto-merge
    if (riskScore <= 50) return 1;      // One approval
    if (riskScore <= 70) return 2;      // Two approvals
    return 3;                           // Three approvals for high risk
  }
  
  private recommendRolloutStrategy(riskScore: number): 'immediate' | 'gradual' | 'canary' | 'manual' {
    if (riskScore <= 20) return 'immediate';
    if (riskScore <= 40) return 'gradual';
    if (riskScore <= 70) return 'canary';
    return 'manual';
  }
  
  private getDefaultRiskFactors(): any {
    return {
      changeSize: { linesChanged: 0, filesChanged: 0, score: 50 },
      testCoverage: { current: 80, delta: 0, score: 20 },
      historicalStability: { successRate: 90, avgFixTime: 180000, score: 15 },
      authorExperience: { commitsInRepo: 50, recentFailureRate: 5, score: 10 },
      timeOfDay: { isBusinessHours: true, isWeekend: false, score: 0 },
      featureFlags: { canRollback: true, hasGradualRollout: false, score: 30 },
    };
  }
}
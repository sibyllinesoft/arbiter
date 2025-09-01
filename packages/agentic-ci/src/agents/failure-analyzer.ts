import { OpenAI } from 'openai';
import { createLogger, Logger } from 'winston';
import { 
  FailureAnalysis, 
  PipelineContext, 
  AgentConfig,
  FailureAnalysisSchema 
} from '../types/index.js';

/**
 * AI-powered failure analysis agent
 * 
 * Analyzes CI/CD pipeline failures, classifies them, identifies root causes,
 * and suggests automated fixes where possible.
 */
export class FailureAnalyzer {
  private readonly logger: Logger;
  private readonly openai: OpenAI;
  private readonly config: AgentConfig;
  private readonly aiConfig: { provider: string; apiKey: string; model: string };
  
  // Historical failure patterns for learning
  private readonly failurePatterns = new Map<string, FailureAnalysis[]>();
  private readonly knownFlakytests = new Set<string>();
  
  constructor(config: AgentConfig, aiConfig: { provider: string; apiKey: string; model: string }) {
    this.config = config;
    this.aiConfig = aiConfig;
    
    this.logger = createLogger({
      level: 'info',
      format: require('winston').format.combine(
        require('winston').format.timestamp(),
        require('winston').format.label({ label: 'FailureAnalyzer' }),
        require('winston').format.json()
      ),
    });
    
    this.openai = new OpenAI({
      apiKey: aiConfig.apiKey,
    });
    
    this.loadHistoricalPatterns();
  }
  
  /**
   * Analyze multiple failures and provide comprehensive analysis
   */
  public async analyzeFailures(
    failures: FailureAnalysis[], 
    context: PipelineContext
  ): Promise<FailureAnalysis[]> {
    this.logger.info(`Analyzing ${failures.length} failures for pipeline ${context.pipelineId}`);
    
    const analyzedFailures: FailureAnalysis[] = [];
    
    for (const failure of failures) {
      try {
        const analysis = await this.analyzeIndividualFailure(failure, context);
        analyzedFailures.push(analysis);
        
        // Update historical patterns
        this.updateFailurePatterns(analysis);
        
      } catch (error) {
        this.logger.error(`Error analyzing failure ${failure.failureId}`, error);
        // Return original failure if analysis fails
        analyzedFailures.push(failure);
      }
    }
    
    // Perform cross-failure correlation analysis
    await this.performCorrelationAnalysis(analyzedFailures, context);
    
    this.logger.info(`Failure analysis completed`, {
      pipelineId: context.pipelineId,
      totalFailures: analyzedFailures.length,
      automatedFixesAvailable: analyzedFailures.filter(f => f.automatedFixAvailable).length,
    });
    
    return analyzedFailures;
  }
  
  /**
   * Analyze an individual failure using AI
   */
  private async analyzeIndividualFailure(
    failure: FailureAnalysis, 
    context: PipelineContext
  ): Promise<FailureAnalysis> {
    
    // Check if this is a known flaky test
    if (this.isKnownFlakyTest(failure)) {
      return {
        ...failure,
        category: 'flaky_test',
        confidence: 95,
        rootCause: 'Known flaky test - identified from historical patterns',
        suggestedFix: 'Retry test execution or investigate test stability',
        automatedFixAvailable: true,
        severity: 'low',
      };
    }
    
    // Check for known patterns
    const historicalMatch = this.findHistoricalMatch(failure);
    if (historicalMatch) {
      return {
        ...failure,
        ...historicalMatch,
        confidence: Math.max(historicalMatch.confidence - 10, 70), // Slight reduction for historical match
      };
    }
    
    // Use AI analysis for new/unknown failures
    return await this.performAIAnalysis(failure, context);
  }
  
  /**
   * Perform AI-powered failure analysis
   */
  private async performAIAnalysis(
    failure: FailureAnalysis, 
    context: PipelineContext
  ): Promise<FailureAnalysis> {
    
    const prompt = this.buildAnalysisPrompt(failure, context);
    
    try {
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
      
      const analysisResult = JSON.parse(response.choices[0]?.message?.content || '{}');
      
      // Validate and parse the AI response
      const validatedAnalysis = this.validateAIResponse(analysisResult, failure);
      
      this.logger.debug('AI analysis completed', {
        failureId: failure.failureId,
        category: validatedAnalysis.category,
        confidence: validatedAnalysis.confidence,
      });
      
      return validatedAnalysis;
      
    } catch (error) {
      this.logger.error('AI analysis failed, falling back to rule-based analysis', error);
      return this.performRuleBasedAnalysis(failure, context);
    }
  }
  
  /**
   * Rule-based analysis as fallback
   */
  private performRuleBasedAnalysis(
    failure: FailureAnalysis, 
    context: PipelineContext
  ): FailureAnalysis {
    
    // Extract error indicators from evidence
    const evidence = failure.evidence.map(e => e.content.toLowerCase()).join(' ');
    
    // Infrastructure failures
    if (this.matchesPattern(evidence, [
      'connection refused', 'timeout', 'network error', 'dns', 'connection reset'
    ])) {
      return {
        ...failure,
        category: 'infrastructure',
        severity: 'high',
        confidence: 80,
        rootCause: 'Network or infrastructure connectivity issue',
        suggestedFix: 'Retry with exponential backoff, check service health',
        automatedFixAvailable: true,
      };
    }
    
    // Dependency issues
    if (this.matchesPattern(evidence, [
      'module not found', 'import error', 'dependency', 'package not found'
    ])) {
      return {
        ...failure,
        category: 'dependency',
        severity: 'high',
        confidence: 85,
        rootCause: 'Missing or incompatible dependency',
        suggestedFix: 'Update dependency versions, clear cache, reinstall',
        automatedFixAvailable: true,
      };
    }
    
    // Test failures
    if (this.matchesPattern(evidence, [
      'assertion failed', 'expected', 'actual', 'test failed', 'spec failed'
    ])) {
      return {
        ...failure,
        category: 'code_quality',
        severity: 'medium',
        confidence: 75,
        rootCause: 'Test assertion failure - possible logic error or test issue',
        suggestedFix: 'Review test logic and implementation',
        automatedFixAvailable: false,
      };
    }
    
    // Performance issues
    if (this.matchesPattern(evidence, [
      'timeout', 'slow', 'performance', 'memory', 'cpu', 'exceeded limit'
    ])) {
      return {
        ...failure,
        category: 'performance_regression',
        severity: 'high',
        confidence: 80,
        rootCause: 'Performance degradation or resource exhaustion',
        suggestedFix: 'Investigate performance bottlenecks, optimize resource usage',
        automatedFixAvailable: false,
      };
    }
    
    // Security issues
    if (this.matchesPattern(evidence, [
      'vulnerability', 'security', 'cve', 'audit', 'malicious', 'injection'
    ])) {
      return {
        ...failure,
        category: 'security_vulnerability',
        severity: 'critical',
        confidence: 90,
        rootCause: 'Security vulnerability detected',
        suggestedFix: 'Update vulnerable dependencies, apply security patches',
        automatedFixAvailable: true,
      };
    }
    
    // Configuration issues
    if (this.matchesPattern(evidence, [
      'configuration', 'config', 'environment', 'variable', 'missing key'
    ])) {
      return {
        ...failure,
        category: 'configuration',
        severity: 'medium',
        confidence: 75,
        rootCause: 'Configuration or environment variable issue',
        suggestedFix: 'Verify configuration settings and environment variables',
        automatedFixAvailable: true,
      };
    }
    
    // Default to unknown
    return {
      ...failure,
      category: 'unknown',
      severity: 'medium',
      confidence: 50,
      rootCause: 'Unable to classify failure automatically',
      suggestedFix: 'Manual investigation required',
      automatedFixAvailable: false,
    };
  }
  
  /**
   * Perform correlation analysis across multiple failures
   */
  private async performCorrelationAnalysis(
    failures: FailureAnalysis[], 
    context: PipelineContext
  ): Promise<void> {
    
    if (failures.length < 2) return;
    
    this.logger.debug('Performing correlation analysis', {
      pipelineId: context.pipelineId,
      failureCount: failures.length,
    });
    
    // Group failures by category
    const categoryGroups = new Map<string, FailureAnalysis[]>();
    for (const failure of failures) {
      const category = failure.category;
      if (!categoryGroups.has(category)) {
        categoryGroups.set(category, []);
      }
      categoryGroups.get(category)!.push(failure);
    }
    
    // Look for cascade failures
    await this.identifyCascadeFailures(failures, context);
    
    // Look for common root causes
    await this.identifyCommonRootCauses(failures, context);
    
    // Update confidence scores based on correlations
    this.updateConfidenceScoresWithCorrelation(failures);
  }
  
  /**
   * System prompt for AI analysis
   */
  private getSystemPrompt(): string {
    return `You are an expert CI/CD failure analysis agent. Your job is to analyze pipeline failures and provide structured insights.

ANALYSIS REQUIREMENTS:
- Classify failures into categories: flaky_test, infrastructure, dependency, code_quality, performance_regression, security_vulnerability, configuration, external_service, unknown
- Assess severity: critical, high, medium, low  
- Provide confidence score (0-100)
- Identify root cause with specific technical details
- Suggest concrete remediation steps
- Determine if automated fix is available

RESPONSE FORMAT (JSON):
{
  "category": "failure_category",
  "severity": "severity_level", 
  "confidence": confidence_score,
  "rootCause": "specific technical root cause",
  "suggestedFix": "concrete remediation steps",
  "automatedFixAvailable": boolean,
  "impact": {
    "userFacing": boolean,
    "performanceImpact": 0-100,
    "securityRisk": boolean,
    "deploymentBlocking": boolean
  }
}

ANALYSIS GUIDELINES:
- Be specific and technical in root cause identification
- Consider historical patterns and common failure modes
- Prioritize user impact and business criticality
- Suggest the most efficient remediation path
- Be conservative with automated fix recommendations`;
  }
  
  /**
   * Build analysis prompt for AI
   */
  private buildAnalysisPrompt(failure: FailureAnalysis, context: PipelineContext): string {
    return `Analyze this CI/CD pipeline failure:

PIPELINE CONTEXT:
- Repository: ${context.repository}
- Branch: ${context.branch}
- Event: ${context.eventName}
- Environment: ${context.environment}
- Pull Request: ${context.isPullRequest ? `#${context.pullRequestNumber}` : 'N/A'}

FAILURE DETAILS:
- Failure ID: ${failure.failureId}
- Current Category: ${failure.category}
- Current Severity: ${failure.severity}

EVIDENCE:
${failure.evidence.map((e, i) => `${i + 1}. [${e.type}] ${e.timestamp.toISOString()}: ${e.content}`).join('\n')}

HISTORICAL CONTEXT:
- Historical Occurrences: ${failure.historicalOccurrences}
- Last Occurrence: ${failure.lastOccurrence?.toISOString() || 'Never'}

Please provide a comprehensive analysis following the specified JSON format.`;
  }
  
  /**
   * Validate and sanitize AI response
   */
  private validateAIResponse(response: any, originalFailure: FailureAnalysis): FailureAnalysis {
    try {
      // Create validated analysis with fallbacks
      const analysis: FailureAnalysis = {
        ...originalFailure,
        category: this.validateCategory(response.category) || originalFailure.category,
        severity: this.validateSeverity(response.severity) || originalFailure.severity,
        confidence: this.validateConfidence(response.confidence) || 50,
        rootCause: typeof response.rootCause === 'string' 
          ? response.rootCause 
          : 'AI analysis failed to provide root cause',
        suggestedFix: typeof response.suggestedFix === 'string' 
          ? response.suggestedFix 
          : 'Manual investigation required',
        automatedFixAvailable: Boolean(response.automatedFixAvailable),
        impact: {
          userFacing: Boolean(response.impact?.userFacing),
          performanceImpact: this.validateScore(response.impact?.performanceImpact) || 0,
          securityRisk: Boolean(response.impact?.securityRisk),
          deploymentBlocking: Boolean(response.impact?.deploymentBlocking),
        },
      };
      
      // Validate with Zod schema
      return FailureAnalysisSchema.parse(analysis);
      
    } catch (error) {
      this.logger.warn('Failed to validate AI response, using fallback', error);
      return originalFailure;
    }
  }
  
  /**
   * Utility methods
   */
  private matchesPattern(text: string, patterns: string[]): boolean {
    return patterns.some(pattern => text.includes(pattern));
  }
  
  private isKnownFlakyTest(failure: FailureAnalysis): boolean {
    const evidence = failure.evidence.map(e => e.content).join(' ');
    return this.knownFlakytests.has(failure.failureId) ||
           failure.historicalOccurrences > 3 ||
           this.matchesPattern(evidence.toLowerCase(), ['flaky', 'intermittent', 'random']);
  }
  
  private findHistoricalMatch(failure: FailureAnalysis): FailureAnalysis | null {
    const category = failure.category;
    const historicalFailures = this.failurePatterns.get(category) || [];
    
    // Simple similarity matching - in production, use more sophisticated ML
    for (const historical of historicalFailures) {
      if (this.calculateSimilarity(failure, historical) > 0.8) {
        return historical;
      }
    }
    
    return null;
  }
  
  private calculateSimilarity(failure1: FailureAnalysis, failure2: FailureAnalysis): number {
    // Simplified similarity calculation
    const evidence1 = failure1.evidence.map(e => e.content).join(' ').toLowerCase();
    const evidence2 = failure2.evidence.map(e => e.content).join(' ').toLowerCase();
    
    const words1 = new Set(evidence1.split(/\s+/));
    const words2 = new Set(evidence2.split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size; // Jaccard similarity
  }
  
  private updateFailurePatterns(analysis: FailureAnalysis): void {
    const category = analysis.category;
    if (!this.failurePatterns.has(category)) {
      this.failurePatterns.set(category, []);
    }
    
    const patterns = this.failurePatterns.get(category)!;
    patterns.push(analysis);
    
    // Keep only recent patterns (last 100 per category)
    if (patterns.length > 100) {
      patterns.splice(0, patterns.length - 100);
    }
  }
  
  private async identifyCascadeFailures(
    failures: FailureAnalysis[], 
    context: PipelineContext
  ): Promise<void> {
    // Implementation for cascade failure detection
    // This would analyze timing and dependencies between failures
  }
  
  private async identifyCommonRootCauses(
    failures: FailureAnalysis[], 
    context: PipelineContext
  ): Promise<void> {
    // Implementation for common root cause analysis
    // This would look for shared infrastructure, dependencies, or timing
  }
  
  private updateConfidenceScoresWithCorrelation(failures: FailureAnalysis[]): void {
    // Implementation for updating confidence based on correlations
    // Multiple related failures increase confidence in analysis
  }
  
  private validateCategory(category: any): string | null {
    const validCategories = [
      'flaky_test', 'infrastructure', 'dependency', 'code_quality',
      'performance_regression', 'security_vulnerability', 'configuration',
      'external_service', 'unknown'
    ];
    return validCategories.includes(category) ? category : null;
  }
  
  private validateSeverity(severity: any): string | null {
    const validSeverities = ['critical', 'high', 'medium', 'low'];
    return validSeverities.includes(severity) ? severity : null;
  }
  
  private validateConfidence(confidence: any): number | null {
    const num = Number(confidence);
    return (!isNaN(num) && num >= 0 && num <= 100) ? num : null;
  }
  
  private validateScore(score: any): number | null {
    const num = Number(score);
    return (!isNaN(num) && num >= 0 && num <= 100) ? num : null;
  }
  
  private loadHistoricalPatterns(): void {
    // In production, this would load from persistent storage
    // For now, we'll initialize empty patterns
    this.logger.info('Historical failure patterns loaded');
  }
}
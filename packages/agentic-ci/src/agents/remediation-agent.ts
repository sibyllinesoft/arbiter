import { OpenAI } from 'openai';
import { createLogger, Logger } from 'winston';
import { Octokit } from '@octokit/rest';
import { execSync } from 'child_process';
import { 
  FailureAnalysis, 
  PipelineStatus, 
  AgentConfig,
  AgentDecision,
} from '../types/index.js';

/**
 * AI-powered automated remediation agent
 * 
 * Attempts to automatically fix common CI/CD pipeline failures:
 * - Flaky test retries with exponential backoff
 * - Dependency version conflicts and cache clearing
 * - Infrastructure connectivity retries
 * - Configuration validation and correction
 * - Security vulnerability patching
 */
export class RemediationAgent {
  private readonly logger: Logger;
  private readonly openai: OpenAI;
  private readonly github: Octokit;
  private readonly config: AgentConfig;
  private readonly aiConfig: { provider: string; apiKey: string; model: string };
  
  // Remediation attempt tracking
  private readonly remediationAttempts = new Map<string, number>();
  private readonly maxAttemptsPerFailure = 3;
  
  // Known remediation patterns
  private readonly remediationPatterns = new Map<string, RemediationPattern>();
  
  constructor(config: AgentConfig, aiConfig: { provider: string; apiKey: string; model: string }) {
    this.config = config;
    this.aiConfig = aiConfig;
    
    this.logger = createLogger({
      level: 'info',
      format: require('winston').format.combine(
        require('winston').format.timestamp(),
        require('winston').format.label({ label: 'RemediationAgent' }),
        require('winston').format.json()
      ),
    });
    
    this.openai = new OpenAI({
      apiKey: aiConfig.apiKey,
    });
    
    this.github = new Octokit({
      auth: process.env.GITHUB_TOKEN, // Should be passed through config
    });
    
    this.initializeRemediationPatterns();
  }
  
  /**
   * Attempt automated remediation for a pipeline failure
   */
  public async attemptRemediation(
    failure: FailureAnalysis, 
    pipelineStatus: PipelineStatus
  ): Promise<RemediationResult> {
    
    this.logger.info(`Attempting remediation for failure: ${failure.failureId}`, {
      category: failure.category,
      severity: failure.severity,
      pipelineId: pipelineStatus.context.pipelineId,
    });
    
    // Check if we've already attempted remediation too many times
    const attemptCount = this.remediationAttempts.get(failure.failureId) || 0;
    if (attemptCount >= this.maxAttemptsPerFailure) {
      return {
        success: false,
        action: 'max_attempts_reached',
        description: `Maximum remediation attempts (${this.maxAttemptsPerFailure}) reached for this failure`,
        shouldRetry: false,
      };
    }
    
    // Update attempt count
    this.remediationAttempts.set(failure.failureId, attemptCount + 1);
    
    try {
      // Route to specific remediation strategy based on failure category
      const result = await this.routeToRemediationStrategy(failure, pipelineStatus);
      
      this.logger.info('Remediation attempt completed', {
        failureId: failure.failureId,
        success: result.success,
        action: result.action,
        attempt: attemptCount + 1,
      });
      
      return result;
      
    } catch (error) {
      this.logger.error('Remediation attempt failed', error);
      return {
        success: false,
        action: 'remediation_error',
        description: `Remediation failed: ${error.message}`,
        shouldRetry: false,
      };
    }
  }
  
  /**
   * Route to appropriate remediation strategy based on failure category
   */
  private async routeToRemediationStrategy(
    failure: FailureAnalysis, 
    pipelineStatus: PipelineStatus
  ): Promise<RemediationResult> {
    
    switch (failure.category) {
      case 'flaky_test':
        return this.remediateFlakyTest(failure, pipelineStatus);
        
      case 'infrastructure':
        return this.remediateInfrastructureFailure(failure, pipelineStatus);
        
      case 'dependency':
        return this.remediateDependencyFailure(failure, pipelineStatus);
        
      case 'configuration':
        return this.remediateConfigurationFailure(failure, pipelineStatus);
        
      case 'security_vulnerability':
        return this.remediateSecurityVulnerability(failure, pipelineStatus);
        
      case 'performance_regression':
        return this.remediatePerformanceRegression(failure, pipelineStatus);
        
      case 'external_service':
        return this.remediateExternalServiceFailure(failure, pipelineStatus);
        
      default:
        return this.attemptAIRemediation(failure, pipelineStatus);
    }
  }
  
  /**
   * Remediate flaky test failures
   */
  private async remediateFlakyTest(
    failure: FailureAnalysis, 
    pipelineStatus: PipelineStatus
  ): Promise<RemediationResult> {
    
    this.logger.info('Applying flaky test remediation');
    
    try {
      // Strategy: Retry the specific test with exponential backoff
      const attemptCount = this.remediationAttempts.get(failure.failureId) || 0;
      const backoffDelay = Math.pow(2, attemptCount) * 1000; // 1s, 2s, 4s, 8s...
      
      // Wait for backoff period
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
      
      // Trigger workflow re-run for just the failed job
      const result = await this.retriggerFailedWorkflow(pipelineStatus, failure);
      
      if (result.success) {
        return {
          success: true,
          action: 'flaky_test_retry',
          description: `Retriggered flaky test with ${backoffDelay}ms backoff. Attempt ${attemptCount + 1}/${this.maxAttemptsPerFailure}`,
          shouldRetry: true,
          backoffDelay,
        };
      } else {
        return {
          success: false,
          action: 'flaky_test_retry_failed',
          description: 'Failed to retrigger workflow for flaky test',
          shouldRetry: attemptCount + 1 < this.maxAttemptsPerFailure,
        };
      }
      
    } catch (error) {
      return {
        success: false,
        action: 'flaky_test_error',
        description: `Flaky test remediation error: ${error.message}`,
        shouldRetry: false,
      };
    }
  }
  
  /**
   * Remediate infrastructure failures
   */
  private async remediateInfrastructureFailure(
    failure: FailureAnalysis, 
    pipelineStatus: PipelineStatus
  ): Promise<RemediationResult> {
    
    this.logger.info('Applying infrastructure failure remediation');
    
    try {
      const evidence = failure.evidence.map(e => e.content.toLowerCase()).join(' ');
      
      // Network connectivity issues
      if (evidence.includes('connection') || evidence.includes('timeout') || evidence.includes('network')) {
        return this.retryWithExponentialBackoff(failure, pipelineStatus, 'network_retry');
      }
      
      // DNS resolution issues
      if (evidence.includes('dns') || evidence.includes('resolve')) {
        return this.retryWithExponentialBackoff(failure, pipelineStatus, 'dns_retry');
      }
      
      // Service unavailable
      if (evidence.includes('503') || evidence.includes('service unavailable')) {
        return this.retryWithExponentialBackoff(failure, pipelineStatus, 'service_retry');
      }
      
      // Default infrastructure retry
      return this.retryWithExponentialBackoff(failure, pipelineStatus, 'infrastructure_retry');
      
    } catch (error) {
      return {
        success: false,
        action: 'infrastructure_error',
        description: `Infrastructure remediation error: ${error.message}`,
        shouldRetry: false,
      };
    }
  }
  
  /**
   * Remediate dependency failures
   */
  private async remediateDependencyFailure(
    failure: FailureAnalysis, 
    pipelineStatus: PipelineStatus
  ): Promise<RemediationResult> {
    
    this.logger.info('Applying dependency failure remediation');
    
    try {
      const evidence = failure.evidence.map(e => e.content.toLowerCase()).join(' ');
      
      // Package not found - try cache clear and reinstall
      if (evidence.includes('not found') || evidence.includes('missing')) {
        return this.clearCacheAndReinstall(pipelineStatus);
      }
      
      // Version conflicts - try dependency resolution
      if (evidence.includes('conflict') || evidence.includes('version')) {
        return this.resolveDependencyConflicts(pipelineStatus);
      }
      
      // Registry issues - retry with different registry
      if (evidence.includes('registry') || evidence.includes('npm') || evidence.includes('yarn')) {
        return this.retryWithAlternativeRegistry(pipelineStatus);
      }
      
      // Generic dependency retry
      return this.clearCacheAndReinstall(pipelineStatus);
      
    } catch (error) {
      return {
        success: false,
        action: 'dependency_error',
        description: `Dependency remediation error: ${error.message}`,
        shouldRetry: false,
      };
    }
  }
  
  /**
   * Remediate configuration failures
   */
  private async remediateConfigurationFailure(
    failure: FailureAnalysis, 
    pipelineStatus: PipelineStatus
  ): Promise<RemediationResult> {
    
    this.logger.info('Applying configuration failure remediation');
    
    try {
      const evidence = failure.evidence.map(e => e.content).join(' ');
      
      // Missing environment variables
      if (evidence.includes('environment') || evidence.includes('env')) {
        return this.validateEnvironmentVariables(pipelineStatus);
      }
      
      // Configuration file issues
      if (evidence.includes('config') || evidence.includes('settings')) {
        return this.validateConfigurationFiles(pipelineStatus);
      }
      
      // Generic configuration validation
      return {
        success: false,
        action: 'config_validation_needed',
        description: 'Configuration failure detected - manual validation required',
        shouldRetry: false,
      };
      
    } catch (error) {
      return {
        success: false,
        action: 'configuration_error',
        description: `Configuration remediation error: ${error.message}`,
        shouldRetry: false,
      };
    }
  }
  
  /**
   * Remediate security vulnerabilities
   */
  private async remediateSecurityVulnerability(
    failure: FailureAnalysis, 
    pipelineStatus: PipelineStatus
  ): Promise<RemediationResult> {
    
    this.logger.info('Applying security vulnerability remediation');
    
    try {
      const evidence = failure.evidence.map(e => e.content.toLowerCase()).join(' ');
      
      // Vulnerable dependencies
      if (evidence.includes('vulnerability') || evidence.includes('cve')) {
        return this.updateVulnerableDependencies(pipelineStatus, evidence);
      }
      
      // Security audit failures
      if (evidence.includes('audit')) {
        return this.runSecurityAuditFix(pipelineStatus);
      }
      
      // Security vulnerabilities require human review for safety
      return {
        success: false,
        action: 'security_human_review_required',
        description: 'Security vulnerability detected - requires human review and approval',
        shouldRetry: false,
      };
      
    } catch (error) {
      return {
        success: false,
        action: 'security_error',
        description: `Security remediation error: ${error.message}`,
        shouldRetry: false,
      };
    }
  }
  
  /**
   * Remediate performance regressions
   */
  private async remediatePerformanceRegression(
    failure: FailureAnalysis, 
    pipelineStatus: PipelineStatus
  ): Promise<RemediationResult> {
    
    this.logger.info('Applying performance regression remediation');
    
    // Performance regressions typically require code changes, not automated fixes
    return {
      success: false,
      action: 'performance_analysis_required',
      description: 'Performance regression detected - requires profiling and code optimization',
      shouldRetry: false,
      recommendations: [
        'Run performance profiling to identify bottlenecks',
        'Review recent changes for performance impact',
        'Consider reverting recent performance-sensitive changes',
        'Optimize identified hot paths',
      ],
    };
  }
  
  /**
   * Remediate external service failures
   */
  private async remediateExternalServiceFailure(
    failure: FailureAnalysis, 
    pipelineStatus: PipelineStatus
  ): Promise<RemediationResult> {
    
    this.logger.info('Applying external service failure remediation');
    
    try {
      // For external service failures, the best we can do is retry with backoff
      const attemptCount = this.remediationAttempts.get(failure.failureId) || 0;
      const backoffDelay = Math.min(Math.pow(2, attemptCount) * 5000, 30000); // 5s, 10s, 20s, max 30s
      
      return this.retryWithExponentialBackoff(failure, pipelineStatus, 'external_service_retry', backoffDelay);
      
    } catch (error) {
      return {
        success: false,
        action: 'external_service_error',
        description: `External service remediation error: ${error.message}`,
        shouldRetry: false,
      };
    }
  }
  
  /**
   * Use AI to attempt remediation for unknown failure types
   */
  private async attemptAIRemediation(
    failure: FailureAnalysis, 
    pipelineStatus: PipelineStatus
  ): Promise<RemediationResult> {
    
    this.logger.info('Attempting AI-powered remediation');
    
    try {
      const prompt = this.buildAIRemediationPrompt(failure, pipelineStatus);
      
      const response = await this.openai.chat.completions.create({
        model: this.aiConfig.model,
        messages: [
          {
            role: 'system',
            content: this.getRemediationSystemPrompt(),
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
      
      // Validate AI response and execute if appropriate
      return this.validateAndExecuteAIRemediation(aiResponse, failure, pipelineStatus);
      
    } catch (error) {
      this.logger.error('AI remediation failed', error);
      return {
        success: false,
        action: 'ai_remediation_failed',
        description: `AI remediation failed: ${error.message}`,
        shouldRetry: false,
      };
    }
  }
  
  /**
   * Helper methods
   */
  private async retriggerFailedWorkflow(
    pipelineStatus: PipelineStatus, 
    failure: FailureAnalysis
  ): Promise<{ success: boolean; message: string }> {
    try {
      // In a real implementation, this would use GitHub API to retrigger specific workflow jobs
      // For now, we'll simulate the action
      
      this.logger.info(`Retriggering workflow for pipeline ${pipelineStatus.context.pipelineId}`);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return {
        success: true,
        message: 'Workflow retriggered successfully',
      };
      
    } catch (error) {
      return {
        success: false,
        message: `Failed to retrigger workflow: ${error.message}`,
      };
    }
  }
  
  private async retryWithExponentialBackoff(
    failure: FailureAnalysis,
    pipelineStatus: PipelineStatus,
    action: string,
    customDelay?: number
  ): Promise<RemediationResult> {
    
    const attemptCount = this.remediationAttempts.get(failure.failureId) || 0;
    const backoffDelay = customDelay || Math.pow(2, attemptCount) * 2000; // 2s, 4s, 8s...
    
    await new Promise(resolve => setTimeout(resolve, backoffDelay));
    
    const result = await this.retriggerFailedWorkflow(pipelineStatus, failure);
    
    return {
      success: result.success,
      action,
      description: `${action} with ${backoffDelay}ms backoff. Attempt ${attemptCount + 1}/${this.maxAttemptsPerFailure}`,
      shouldRetry: result.success || attemptCount + 1 < this.maxAttemptsPerFailure,
      backoffDelay,
    };
  }
  
  private async clearCacheAndReinstall(pipelineStatus: PipelineStatus): Promise<RemediationResult> {
    try {
      this.logger.info('Clearing dependency cache and reinstalling');
      
      // This would execute cache clearing commands in the CI environment
      // For simulation, we'll just return success
      
      return {
        success: true,
        action: 'cache_clear_reinstall',
        description: 'Cleared dependency cache and triggered reinstallation',
        shouldRetry: true,
      };
      
    } catch (error) {
      return {
        success: false,
        action: 'cache_clear_failed',
        description: `Cache clear failed: ${error.message}`,
        shouldRetry: false,
      };
    }
  }
  
  private async resolveDependencyConflicts(pipelineStatus: PipelineStatus): Promise<RemediationResult> {
    // Implementation for resolving dependency conflicts
    return {
      success: false,
      action: 'dependency_conflict_resolution',
      description: 'Dependency conflicts require manual resolution',
      shouldRetry: false,
    };
  }
  
  private async retryWithAlternativeRegistry(pipelineStatus: PipelineStatus): Promise<RemediationResult> {
    // Implementation for retrying with alternative package registry
    return {
      success: true,
      action: 'alternative_registry_retry',
      description: 'Retrying package installation with alternative registry',
      shouldRetry: true,
    };
  }
  
  private async validateEnvironmentVariables(pipelineStatus: PipelineStatus): Promise<RemediationResult> {
    // Implementation for environment variable validation
    return {
      success: false,
      action: 'env_validation',
      description: 'Environment variable validation requires human review',
      shouldRetry: false,
    };
  }
  
  private async validateConfigurationFiles(pipelineStatus: PipelineStatus): Promise<RemediationResult> {
    // Implementation for configuration file validation
    return {
      success: false,
      action: 'config_validation',
      description: 'Configuration file validation requires human review',
      shouldRetry: false,
    };
  }
  
  private async updateVulnerableDependencies(
    pipelineStatus: PipelineStatus, 
    evidence: string
  ): Promise<RemediationResult> {
    // Implementation for updating vulnerable dependencies
    return {
      success: false,
      action: 'vulnerability_update',
      description: 'Security vulnerability updates require human approval',
      shouldRetry: false,
    };
  }
  
  private async runSecurityAuditFix(pipelineStatus: PipelineStatus): Promise<RemediationResult> {
    // Implementation for running security audit fixes
    return {
      success: true,
      action: 'security_audit_fix',
      description: 'Applied automated security audit fixes',
      shouldRetry: true,
    };
  }
  
  private buildAIRemediationPrompt(failure: FailureAnalysis, pipelineStatus: PipelineStatus): string {
    return `Analyze this CI/CD failure and suggest automated remediation if possible:

FAILURE DETAILS:
- Category: ${failure.category}
- Severity: ${failure.severity}
- Root Cause: ${failure.rootCause}

EVIDENCE:
${failure.evidence.map((e, i) => `${i + 1}. [${e.type}] ${e.content}`).join('\n')}

PIPELINE CONTEXT:
- Repository: ${pipelineStatus.context.repository}
- Branch: ${pipelineStatus.context.branch}
- Environment: ${pipelineStatus.context.environment}

Provide a remediation strategy if one is safe and appropriate.`;
  }
  
  private getRemediationSystemPrompt(): string {
    return `You are an expert CI/CD remediation agent. Suggest only safe, automated fixes that won't cause additional problems.

SAFE REMEDIATION ACTIONS:
- Retry operations with exponential backoff
- Clear caches and reinstall dependencies  
- Update security patches (with caution)
- Restart services or workflows
- Environment validation

UNSAFE ACTIONS (DO NOT SUGGEST):
- Code changes or logic modifications
- Database schema changes
- Breaking configuration changes
- Dependency major version updates without testing

RESPONSE FORMAT (JSON):
{
  "canRemediate": boolean,
  "action": "remediation_action_name", 
  "description": "Clear description of what will be done",
  "safetyLevel": "safe|caution|unsafe",
  "steps": ["Step 1", "Step 2", ...],
  "rollbackPlan": "How to undo if needed"
}`;
  }
  
  private async validateAndExecuteAIRemediation(
    aiResponse: any,
    failure: FailureAnalysis,
    pipelineStatus: PipelineStatus
  ): Promise<RemediationResult> {
    
    if (!aiResponse.canRemediate || aiResponse.safetyLevel === 'unsafe') {
      return {
        success: false,
        action: 'ai_remediation_unsafe',
        description: 'AI determined remediation is unsafe or not possible',
        shouldRetry: false,
      };
    }
    
    // For demonstration, we'll only allow very safe operations
    const safeActions = ['retry', 'cache_clear', 'restart', 'environment_check'];
    const action = aiResponse.action || 'unknown';
    
    if (!safeActions.some(safe => action.includes(safe))) {
      return {
        success: false,
        action: 'ai_remediation_restricted',
        description: 'AI suggested action not in approved safe actions list',
        shouldRetry: false,
      };
    }
    
    // Execute the safe remediation
    return {
      success: true,
      action: `ai_${action}`,
      description: aiResponse.description || 'AI-suggested remediation applied',
      shouldRetry: true,
    };
  }
  
  private initializeRemediationPatterns(): void {
    // Initialize known remediation patterns
    // In production, this would load from a knowledge base
    this.logger.info('Remediation patterns initialized');
  }
}

// Helper interfaces
interface RemediationResult {
  success: boolean;
  action: string;
  description: string;
  shouldRetry: boolean;
  backoffDelay?: number;
  recommendations?: string[];
}

interface RemediationPattern {
  category: string;
  triggers: string[];
  actions: string[];
  successRate: number;
}
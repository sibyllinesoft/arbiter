import { createLogger, Logger } from 'winston';
import { Octokit } from '@octokit/rest';
import { PipelineContext, QualityGate, FailureAnalysis } from '../types/index.js';
import { EventEmitter } from 'events';

/**
 * GitHub Actions integration for agentic CI system
 * 
 * Provides methods to interact with GitHub Actions API, retrieve workflow results,
 * manage check runs, and integrate with existing Arbiter CI infrastructure.
 */
export class GitHubActionsIntegration extends EventEmitter {
  private readonly logger: Logger;
  private readonly github: Octokit;
  
  constructor(githubToken: string) {
    super();
    
    this.github = new Octokit({
      auth: githubToken,
    });
    
    this.logger = createLogger({
      level: 'info',
      format: require('winston').format.combine(
        require('winston').format.timestamp(),
        require('winston').format.label({ label: 'GitHubActionsIntegration' }),
        require('winston').format.json()
      ),
    });
    
    this.logger.info('GitHub Actions Integration initialized');
  }
  
  /**
   * Get comprehensive workflow run details including all jobs and steps
   */
  public async getWorkflowRunDetails(
    owner: string,
    repo: string,
    runId: number
  ): Promise<WorkflowRunDetails> {
    try {
      // Get workflow run
      const workflowRun = await this.github.rest.actions.getWorkflowRun({
        owner,
        repo,
        run_id: runId,
      });
      
      // Get all jobs for this workflow run
      const jobs = await this.github.rest.actions.listJobsForWorkflowRun({
        owner,
        repo,
        run_id: runId,
      });
      
      // Get detailed job information with steps
      const detailedJobs = await Promise.all(
        jobs.data.jobs.map(async (job) => {
          const jobDetails = await this.github.rest.actions.getJobForWorkflowRun({
            owner,
            repo,
            job_id: job.id,
          });
          
          return {
            ...jobDetails.data,
            logs: await this.getJobLogs(owner, repo, job.id),
          };
        })
      );
      
      // Get artifacts
      const artifacts = await this.github.rest.actions.listWorkflowRunArtifacts({
        owner,
        repo,
        run_id: runId,
      });
      
      return {
        workflowRun: workflowRun.data,
        jobs: detailedJobs,
        artifacts: artifacts.data.artifacts,
        totalJobs: jobs.data.total_count,
        failedJobs: detailedJobs.filter(job => job.conclusion === 'failure').length,
        cancelledJobs: detailedJobs.filter(job => job.conclusion === 'cancelled').length,
      };
      
    } catch (error) {
      this.logger.error('Error getting workflow run details', {
        owner,
        repo,
        runId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
  
  /**
   * Get job logs for failure analysis
   */
  private async getJobLogs(owner: string, repo: string, jobId: number): Promise<string> {
    try {
      const response = await this.github.rest.actions.downloadJobLogsForWorkflowRun({
        owner,
        repo,
        job_id: jobId,
      });
      
      // Response contains log data as text
      return response.data as unknown as string;
      
    } catch (error) {
      this.logger.warn('Could not retrieve job logs', {
        owner,
        repo,
        jobId,
        error: error instanceof Error ? error.message : String(error),
      });
      return '';
    }
  }
  
  /**
   * Analyze workflow failures to extract quality gate violations
   */
  public async analyzeWorkflowFailures(
    owner: string,
    repo: string,
    runId: number
  ): Promise<QualityGate[]> {
    try {
      const details = await this.getWorkflowRunDetails(owner, repo, runId);
      const qualityGates: QualityGate[] = [];
      
      for (const job of details.jobs) {
        if (job.conclusion !== 'failure') continue;
        
        // Analyze job name and steps to determine quality gate type
        const gateType = this.inferQualityGateType(job.name, job.steps || []);
        
        // Extract failure details from steps
        const failureDetails = this.extractFailureDetails(job.steps || [], job.logs);
        
        qualityGates.push({
          type: gateType,
          status: 'failed',
          threshold: this.inferThreshold(gateType, failureDetails),
          actualValue: this.extractActualValue(failureDetails),
          details: {
            jobName: job.name,
            jobId: job.id.toString(),
            failureStep: failureDetails.failedStep,
            errorMessage: failureDetails.errorMessage,
            logSnippet: failureDetails.logSnippet,
            duration: this.calculateJobDuration(job),
          },
          severity: this.determineSeverity(gateType, failureDetails),
        });
      }
      
      return qualityGates;
      
    } catch (error) {
      this.logger.error('Error analyzing workflow failures', {
        owner,
        repo,
        runId,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }
  
  /**
   * Infer quality gate type from job name and steps
   */
  private inferQualityGateType(jobName: string, steps: any[]): string {
    const jobNameLower = jobName.toLowerCase();
    
    // Check job name first
    if (jobNameLower.includes('test')) return 'test';
    if (jobNameLower.includes('lint')) return 'code-quality';
    if (jobNameLower.includes('security') || jobNameLower.includes('audit')) return 'security';
    if (jobNameLower.includes('performance') || jobNameLower.includes('benchmark')) return 'performance';
    if (jobNameLower.includes('build')) return 'build';
    if (jobNameLower.includes('deploy')) return 'deployment';
    if (jobNameLower.includes('integration')) return 'integration';
    if (jobNameLower.includes('e2e') || jobNameLower.includes('end-to-end')) return 'e2e';
    
    // Check step names
    for (const step of steps) {
      const stepName = step.name?.toLowerCase() || '';
      
      if (stepName.includes('test') || stepName.includes('jest') || stepName.includes('vitest')) {
        return 'test';
      }
      if (stepName.includes('lint') || stepName.includes('eslint')) {
        return 'code-quality';
      }
      if (stepName.includes('security') || stepName.includes('snyk') || stepName.includes('audit')) {
        return 'security';
      }
      if (stepName.includes('performance') || stepName.includes('benchmark')) {
        return 'performance';
      }
    }
    
    return 'unknown';
  }
  
  /**
   * Extract detailed failure information from job steps
   */
  private extractFailureDetails(steps: any[], logs: string): FailureDetails {
    const failedStep = steps.find(step => step.conclusion === 'failure');
    
    // Extract error patterns from logs
    const errorPatterns = [
      /Error: (.+)/g,
      /FAIL (.+)/g,
      /✗ (.+)/g,
      /ERROR (.+)/g,
      /FAILED (.+)/g,
      /AssertionError: (.+)/g,
    ];
    
    let errorMessage = '';
    let logSnippet = '';
    
    if (logs) {
      // Get last 10 lines around failures
      const lines = logs.split('\n');
      const errorLines = lines.filter(line => 
        errorPatterns.some(pattern => pattern.test(line))
      );
      
      if (errorLines.length > 0) {
        errorMessage = errorLines[0];
        
        // Get context around first error
        const errorIndex = lines.indexOf(errorLines[0]);
        const start = Math.max(0, errorIndex - 5);
        const end = Math.min(lines.length, errorIndex + 5);
        logSnippet = lines.slice(start, end).join('\n');
      }
    }
    
    return {
      failedStep: failedStep?.name || 'Unknown',
      errorMessage: errorMessage || failedStep?.conclusion || 'Unknown error',
      logSnippet: logSnippet || logs.slice(-1000), // Last 1000 chars if no specific error found
    };
  }
  
  /**
   * Infer threshold values based on gate type and failure details
   */
  private inferThreshold(gateType: string, failureDetails: FailureDetails): any {
    const thresholds: Record<string, any> = {
      test: '90%',
      'code-quality': '0 errors',
      security: '0 high vulnerabilities',
      performance: '2s response time',
      build: 'successful',
      deployment: 'successful',
      integration: 'all services healthy',
      e2e: 'all scenarios pass',
    };
    
    return thresholds[gateType] || 'successful';
  }
  
  /**
   * Extract actual value from failure details
   */
  private extractActualValue(failureDetails: FailureDetails): any {
    const { errorMessage, logSnippet } = failureDetails;
    
    // Try to extract specific values from error messages
    const percentageMatch = errorMessage.match(/(\d+(?:\.\d+)?)%/);
    if (percentageMatch) {
      return `${percentageMatch[1]}%`;
    }
    
    const numberMatch = errorMessage.match(/(\d+(?:\.\d+)?)/);
    if (numberMatch) {
      return numberMatch[1];
    }
    
    return 'failed';
  }
  
  /**
   * Determine failure severity
   */
  private determineSeverity(gateType: string, failureDetails: FailureDetails): 'low' | 'medium' | 'high' | 'critical' {
    const { errorMessage } = failureDetails;
    
    // Critical failures
    if (gateType === 'security' && errorMessage.includes('high')) return 'critical';
    if (gateType === 'build' && errorMessage.includes('compile')) return 'critical';
    
    // High severity
    if (gateType === 'test' && errorMessage.includes('0%')) return 'high';
    if (gateType === 'security') return 'high';
    if (gateType === 'deployment') return 'high';
    
    // Medium severity
    if (gateType === 'test') return 'medium';
    if (gateType === 'integration') return 'medium';
    if (gateType === 'e2e') return 'medium';
    
    return 'low';
  }
  
  /**
   * Calculate job duration
   */
  private calculateJobDuration(job: any): number {
    if (!job.started_at || !job.completed_at) return 0;
    
    const start = new Date(job.started_at).getTime();
    const end = new Date(job.completed_at).getTime();
    
    return Math.round((end - start) / 1000); // Duration in seconds
  }
  
  /**
   * Create a check run for agentic CI status
   */
  public async createAgenticCICheckRun(
    owner: string,
    repo: string,
    headSha: string,
    status: 'queued' | 'in_progress' | 'completed',
    conclusion?: 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped' | 'timed_out' | 'action_required'
  ): Promise<number> {
    try {
      const response = await this.github.rest.checks.create({
        owner,
        repo,
        name: 'Agentic CI Analysis',
        head_sha: headSha,
        status,
        conclusion,
        started_at: new Date().toISOString(),
        output: {
          title: 'Agentic CI System',
          summary: 'AI-powered CI/CD analysis and auto-merge assessment',
        },
      });
      
      return response.data.id;
      
    } catch (error) {
      this.logger.error('Error creating check run', {
        owner,
        repo,
        headSha,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
  
  /**
   * Update agentic CI check run with analysis results
   */
  public async updateAgenticCICheckRun(
    owner: string,
    repo: string,
    checkRunId: number,
    conclusion: 'success' | 'failure' | 'neutral',
    summary: string,
    details: string
  ): Promise<void> {
    try {
      await this.github.rest.checks.update({
        owner,
        repo,
        check_run_id: checkRunId,
        status: 'completed',
        conclusion,
        completed_at: new Date().toISOString(),
        output: {
          title: 'Agentic CI Analysis Complete',
          summary,
          text: details,
        },
      });
      
    } catch (error) {
      this.logger.error('Error updating check run', {
        owner,
        repo,
        checkRunId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
  
  /**
   * Merge pull request with agentic CI approval
   */
  public async mergePullRequest(
    owner: string,
    repo: string,
    pullNumber: number,
    mergeMethod: 'merge' | 'squash' | 'rebase' = 'squash'
  ): Promise<boolean> {
    try {
      const response = await this.github.rest.pulls.merge({
        owner,
        repo,
        pull_number: pullNumber,
        merge_method: mergeMethod,
        commit_title: 'Auto-merge via Agentic CI',
        commit_message: 'Automatically merged after successful CI analysis and safety checks.',
      });
      
      this.logger.info('Pull request merged successfully', {
        owner,
        repo,
        pullNumber,
        sha: response.data.sha,
        merged: response.data.merged,
      });
      
      return response.data.merged;
      
    } catch (error) {
      this.logger.error('Error merging pull request', {
        owner,
        repo,
        pullNumber,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }
  
  /**
   * Get pull request details for risk assessment
   */
  public async getPullRequestDetails(
    owner: string,
    repo: string,
    pullNumber: number
  ): Promise<PullRequestDetails> {
    try {
      const [pr, files, commits, reviews] = await Promise.all([
        this.github.rest.pulls.get({ owner, repo, pull_number: pullNumber }),
        this.github.rest.pulls.listFiles({ owner, repo, pull_number: pullNumber }),
        this.github.rest.pulls.listCommits({ owner, repo, pull_number: pullNumber }),
        this.github.rest.pulls.listReviews({ owner, repo, pull_number: pullNumber }),
      ]);
      
      return {
        pullRequest: pr.data,
        files: files.data,
        commits: commits.data,
        reviews: reviews.data,
        changedFiles: files.data.length,
        linesChanged: files.data.reduce((total, file) => total + (file.changes || 0), 0),
        approvedReviews: reviews.data.filter(review => review.state === 'APPROVED').length,
        requestedChanges: reviews.data.filter(review => review.state === 'CHANGES_REQUESTED').length,
      };
      
    } catch (error) {
      this.logger.error('Error getting pull request details', {
        owner,
        repo,
        pullNumber,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
  
  /**
   * Check if PR is ready for auto-merge
   */
  public async isPullRequestReadyForAutoMerge(
    owner: string,
    repo: string,
    pullNumber: number
  ): Promise<AutoMergeReadiness> {
    try {
      const details = await this.getPullRequestDetails(owner, repo, pullNumber);
      const pr = details.pullRequest;
      
      const checks = {
        isApproved: details.approvedReviews > 0,
        hasNoRequestedChanges: details.requestedChanges === 0,
        isMergeable: pr.mergeable === true,
        isNotDraft: !pr.draft,
        hasPassingChecks: true, // Will be determined by checking status checks
        isTargetingMainBranch: ['main', 'master'].includes(pr.base.ref),
        authorHasPermission: true, // Would need to check repository permissions
      };
      
      // Check status checks
      const statusChecks = await this.github.rest.repos.getCombinedStatusForRef({
        owner,
        repo,
        ref: pr.head.sha,
      });
      
      checks.hasPassingChecks = statusChecks.data.state === 'success';
      
      const blockers = [];
      if (!checks.isApproved) blockers.push('Needs approval');
      if (checks.hasRequestedChanges) blockers.push('Has requested changes');
      if (!checks.isMergeable) blockers.push('Has merge conflicts');
      if (checks.isNotDraft) blockers.push('Is draft PR');
      if (!checks.hasPassingChecks) blockers.push('Status checks failing');
      if (!checks.isTargetingMainBranch) blockers.push('Not targeting main branch');
      
      return {
        ready: Object.values(checks).every(Boolean),
        checks,
        blockers,
        riskFactors: this.assessPullRequestRiskFactors(details),
      };
      
    } catch (error) {
      this.logger.error('Error checking auto-merge readiness', {
        owner,
        repo,
        pullNumber,
        error: error instanceof Error ? error.message : String(error),
      });
      
      return {
        ready: false,
        checks: {},
        blockers: ['Error checking readiness'],
        riskFactors: [],
      };
    }
  }
  
  /**
   * Assess risk factors for pull request
   */
  private assessPullRequestRiskFactors(details: PullRequestDetails): string[] {
    const riskFactors = [];
    
    if (details.linesChanged > 500) {
      riskFactors.push('Large change (>500 lines)');
    }
    
    if (details.changedFiles > 20) {
      riskFactors.push('Many files changed (>20)');
    }
    
    if (details.commits.length > 10) {
      riskFactors.push('Many commits (>10)');
    }
    
    // Check for sensitive file changes
    const sensitiveFiles = details.files.filter(file => 
      file.filename.includes('package.json') ||
      file.filename.includes('Dockerfile') ||
      file.filename.includes('.yml') ||
      file.filename.includes('.yaml') ||
      file.filename.includes('security') ||
      file.filename.includes('auth')
    );
    
    if (sensitiveFiles.length > 0) {
      riskFactors.push('Sensitive files changed');
    }
    
    return riskFactors;
  }
}

// Type definitions
interface WorkflowRunDetails {
  workflowRun: any;
  jobs: any[];
  artifacts: any[];
  totalJobs: number;
  failedJobs: number;
  cancelledJobs: number;
}

interface FailureDetails {
  failedStep: string;
  errorMessage: string;
  logSnippet: string;
}

interface PullRequestDetails {
  pullRequest: any;
  files: any[];
  commits: any[];
  reviews: any[];
  changedFiles: number;
  linesChanged: number;
  approvedReviews: number;
  requestedChanges: number;
}

interface AutoMergeReadiness {
  ready: boolean;
  checks: Record<string, boolean>;
  blockers: string[];
  riskFactors: string[];
}
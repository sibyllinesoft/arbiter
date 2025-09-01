import { createLogger, Logger } from 'winston';
import { EventEmitter } from 'events';
import { Webhooks } from '@octokit/webhooks';
import { PipelineContext, PipelineContextSchema } from '../types/index.js';
import { Orchestrator } from '../core/orchestrator.js';

/**
 * GitHub webhook handler for integrating agentic CI with GitHub events
 * 
 * Handles webhook events from GitHub Actions and triggers the orchestration pipeline
 * for intelligent CI/CD automation with auto-merge capabilities.
 */
export class GitHubWebhookHandler extends EventEmitter {
  private readonly logger: Logger;
  private readonly webhooks: Webhooks;
  private readonly orchestrator: Orchestrator;
  
  // Event tracking
  private readonly processedEvents = new Set<string>();
  private readonly eventMetrics = new Map<string, number>();
  
  constructor(
    webhookSecret: string,
    orchestrator: Orchestrator
  ) {
    super();
    
    this.orchestrator = orchestrator;
    this.webhooks = new Webhooks({
      secret: webhookSecret,
    });
    
    this.logger = createLogger({
      level: 'info',
      format: require('winston').format.combine(
        require('winston').format.timestamp(),
        require('winston').format.label({ label: 'GitHubWebhookHandler' }),
        require('winston').format.json()
      ),
    });
    
    this.setupWebhookHandlers();
    this.logger.info('GitHub Webhook Handler initialized');
  }
  
  /**
   * Start the webhook handler
   */
  public async start(): Promise<void> {
    this.logger.info('Starting GitHub Webhook Handler...');
    this.emit('started');
  }
  
  /**
   * Stop the webhook handler
   */
  public async stop(): Promise<void> {
    this.logger.info('Stopping GitHub Webhook Handler...');
    this.emit('stopped');
  }
  
  /**
   * Process incoming webhook payload
   */
  public async processWebhook(
    eventName: string,
    payload: any,
    signature: string
  ): Promise<void> {
    try {
      // Verify webhook signature
      if (!(await this.webhooks.verify(payload, signature))) {
        throw new Error('Invalid webhook signature');
      }
      
      this.logger.info('Processing webhook event', {
        eventName,
        repository: payload.repository?.full_name,
        action: payload.action,
      });
      
      // Track metrics
      const currentCount = this.eventMetrics.get(eventName) || 0;
      this.eventMetrics.set(eventName, currentCount + 1);
      
      // Emit the event through the webhooks handler
      await this.webhooks.receive({
        id: payload.delivery || Date.now().toString(),
        name: eventName as any,
        payload,
      });
      
    } catch (error) {
      this.logger.error('Error processing webhook', {
        eventName,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
  
  /**
   * Setup webhook event handlers
   */
  private setupWebhookHandlers(): void {
    // Handle workflow run events
    this.webhooks.on('workflow_run.completed', async ({ payload }) => {
      await this.handleWorkflowRunCompleted(payload);
    });
    
    this.webhooks.on('workflow_run.requested', async ({ payload }) => {
      await this.handleWorkflowRunRequested(payload);
    });
    
    // Handle check run events
    this.webhooks.on('check_run.completed', async ({ payload }) => {
      await this.handleCheckRunCompleted(payload);
    });
    
    // Handle pull request events
    this.webhooks.on('pull_request.opened', async ({ payload }) => {
      await this.handlePullRequestOpened(payload);
    });
    
    this.webhooks.on('pull_request.synchronize', async ({ payload }) => {
      await this.handlePullRequestSynchronized(payload);
    });
    
    // Handle push events for main branch
    this.webhooks.on('push', async ({ payload }) => {
      if (payload.ref === 'refs/heads/main' || payload.ref === 'refs/heads/master') {
        await this.handleMainBranchPush(payload);
      }
    });
    
    // Handle status events
    this.webhooks.on('status', async ({ payload }) => {
      await this.handleStatusChange(payload);
    });
    
    // Handle deployment status events
    this.webhooks.on('deployment_status', async ({ payload }) => {
      await this.handleDeploymentStatus(payload);
    });
  }
  
  /**
   * Handle workflow run completion
   */
  private async handleWorkflowRunCompleted(payload: any): Promise<void> {
    try {
      const eventId = `workflow_run_${payload.workflow_run.id}`;
      
      // Prevent duplicate processing
      if (this.processedEvents.has(eventId)) {
        return;
      }
      this.processedEvents.add(eventId);
      
      const context = this.createPipelineContext({
        eventType: 'workflow_run.completed',
        repository: payload.repository.full_name,
        branch: payload.workflow_run.head_branch,
        sha: payload.workflow_run.head_sha,
        pullRequest: payload.workflow_run.pull_requests[0] || null,
        workflow: {
          id: payload.workflow_run.id,
          name: payload.workflow_run.name,
          status: payload.workflow_run.conclusion,
          url: payload.workflow_run.html_url,
          runNumber: payload.workflow_run.run_number,
        },
        triggeredBy: payload.sender.login,
        timestamp: new Date(payload.workflow_run.updated_at),
        metadata: {
          workflowFile: payload.workflow_run.path,
          event: payload.workflow_run.event,
          previousAttemptUrl: payload.workflow_run.previous_attempt_url,
        },
      });
      
      // Process through orchestrator
      await this.orchestrator.processPipelineEvent(context);
      
    } catch (error) {
      this.logger.error('Error handling workflow run completed', {
        workflowRunId: payload.workflow_run.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  
  /**
   * Handle workflow run request
   */
  private async handleWorkflowRunRequested(payload: any): Promise<void> {
    try {
      const context = this.createPipelineContext({
        eventType: 'workflow_run.requested',
        repository: payload.repository.full_name,
        branch: payload.workflow_run.head_branch,
        sha: payload.workflow_run.head_sha,
        pullRequest: payload.workflow_run.pull_requests[0] || null,
        workflow: {
          id: payload.workflow_run.id,
          name: payload.workflow_run.name,
          status: 'requested',
          url: payload.workflow_run.html_url,
          runNumber: payload.workflow_run.run_number,
        },
        triggeredBy: payload.sender.login,
        timestamp: new Date(payload.workflow_run.created_at),
      });
      
      // Notify orchestrator of new workflow
      this.emit('workflow_requested', context);
      
    } catch (error) {
      this.logger.error('Error handling workflow run requested', {
        workflowRunId: payload.workflow_run.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  
  /**
   * Handle check run completion
   */
  private async handleCheckRunCompleted(payload: any): Promise<void> {
    try {
      const context = this.createPipelineContext({
        eventType: 'check_run.completed',
        repository: payload.repository.full_name,
        branch: payload.check_run.head_sha,
        sha: payload.check_run.head_sha,
        pullRequest: payload.check_run.pull_requests[0] || null,
        workflow: {
          id: payload.check_run.id,
          name: payload.check_run.name,
          status: payload.check_run.conclusion,
          url: payload.check_run.html_url,
        },
        triggeredBy: payload.sender?.login || 'system',
        timestamp: new Date(payload.check_run.completed_at),
        metadata: {
          checkSuite: payload.check_run.check_suite,
          app: payload.check_run.app?.name,
        },
      });
      
      // Process individual check results
      await this.orchestrator.processPipelineEvent(context);
      
    } catch (error) {
      this.logger.error('Error handling check run completed', {
        checkRunId: payload.check_run.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  
  /**
   * Handle pull request opened
   */
  private async handlePullRequestOpened(payload: any): Promise<void> {
    this.logger.info('PR opened - setting up monitoring', {
      prNumber: payload.pull_request.number,
      repository: payload.repository.full_name,
      author: payload.pull_request.user.login,
    });
    
    // Set up monitoring for this PR
    this.emit('pr_opened', {
      repository: payload.repository.full_name,
      prNumber: payload.pull_request.number,
      sha: payload.pull_request.head.sha,
      author: payload.pull_request.user.login,
    });
  }
  
  /**
   * Handle pull request synchronization (new commits)
   */
  private async handlePullRequestSynchronized(payload: any): Promise<void> {
    this.logger.info('PR synchronized - new commits pushed', {
      prNumber: payload.pull_request.number,
      repository: payload.repository.full_name,
      newSha: payload.pull_request.head.sha,
    });
    
    // Notify about PR updates
    this.emit('pr_updated', {
      repository: payload.repository.full_name,
      prNumber: payload.pull_request.number,
      sha: payload.pull_request.head.sha,
      author: payload.pull_request.user.login,
    });
  }
  
  /**
   * Handle main branch push
   */
  private async handleMainBranchPush(payload: any): Promise<void> {
    this.logger.info('Main branch push detected', {
      repository: payload.repository.full_name,
      sha: payload.head_commit?.id,
      pusher: payload.pusher.name,
    });
    
    // Monitor post-merge health
    this.emit('main_branch_push', {
      repository: payload.repository.full_name,
      sha: payload.head_commit?.id,
      commits: payload.commits,
      pusher: payload.pusher.name,
    });
  }
  
  /**
   * Handle status changes
   */
  private async handleStatusChange(payload: any): Promise<void> {
    // Track external CI status changes (from services like CircleCI, TravisCI, etc.)
    this.emit('external_status', {
      repository: payload.repository.full_name,
      sha: payload.sha,
      context: payload.context,
      state: payload.state,
      description: payload.description,
      targetUrl: payload.target_url,
    });
  }
  
  /**
   * Handle deployment status
   */
  private async handleDeploymentStatus(payload: any): Promise<void> {
    this.logger.info('Deployment status update', {
      repository: payload.repository.full_name,
      environment: payload.deployment.environment,
      state: payload.deployment_status.state,
    });
    
    // Track deployment success/failure for learning
    this.emit('deployment_status', {
      repository: payload.repository.full_name,
      environment: payload.deployment.environment,
      state: payload.deployment_status.state,
      sha: payload.deployment.sha,
      targetUrl: payload.deployment_status.target_url,
    });
  }
  
  /**
   * Create standardized pipeline context from webhook payload
   */
  private createPipelineContext(data: {
    eventType: string;
    repository: string;
    branch: string;
    sha: string;
    pullRequest?: any;
    workflow?: any;
    triggeredBy: string;
    timestamp: Date;
    metadata?: Record<string, any>;
  }): PipelineContext {
    const context = {
      repository: data.repository,
      branch: data.branch,
      sha: data.sha,
      pullRequest: data.pullRequest ? {
        number: data.pullRequest.number,
        title: data.pullRequest.title,
        author: data.pullRequest.user?.login || data.pullRequest.author,
        url: data.pullRequest.html_url,
        draft: data.pullRequest.draft || false,
        mergeable: data.pullRequest.mergeable,
        labels: data.pullRequest.labels?.map((l: any) => l.name) || [],
      } : undefined,
      workflow: data.workflow ? {
        id: data.workflow.id.toString(),
        name: data.workflow.name,
        status: data.workflow.status,
        url: data.workflow.url,
        runNumber: data.workflow.runNumber,
      } : undefined,
      triggeredBy: data.triggeredBy,
      timestamp: data.timestamp,
      eventType: data.eventType,
      metadata: data.metadata || {},
    };
    
    return PipelineContextSchema.parse(context);
  }
  
  /**
   * Get handler metrics
   */
  public getMetrics(): Record<string, any> {
    return {
      processedEvents: this.processedEvents.size,
      eventCounts: Object.fromEntries(this.eventMetrics),
      uptime: process.uptime(),
    };
  }
  
  /**
   * Clear processed events cache (for testing)
   */
  public clearCache(): void {
    this.processedEvents.clear();
    this.eventMetrics.clear();
  }
}
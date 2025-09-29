/**
 * Handler execution pipeline
 * Executes custom webhook handlers with sandboxing and error handling
 */

import { setTimeout } from 'node:timers/promises';
import type { SpecWorkbenchDB } from '../db.js';
import type { EventService } from '../events.js';
import { logger as defaultLogger, generateId, getCurrentTimestamp } from '../utils.js';
import type { HandlerDiscovery } from './discovery.js';
import { HandlerLoader } from './loader.js';
import { HandlerSecurityValidator } from './services.js';
import type {
  EnhancedWebhookPayload,
  HandlerContext,
  HandlerExecution,
  HandlerResult,
  HandlerServices,
  Logger,
  RegisteredHandler,
  WebhookHandler,
  WebhookPayload,
  WebhookRequest,
} from './types.ts';

export class HandlerExecutor {
  private activeExecutions = new Map<string, AbortController>();
  private executionHistory: HandlerExecution[] = [];
  private loader: HandlerLoader;

  constructor(
    private discovery: HandlerDiscovery,
    private services: HandlerServices,
    private logger: Logger = defaultLogger
  ) {
    this.loader = new HandlerLoader(this.logger);
  }

  /**
   * Execute handlers for a webhook event
   */
  async executeHandlers(projectId: string, request: WebhookRequest): Promise<HandlerResult[]> {
    const { provider, event } = request;

    // Get handlers for this event
    const handlers = this.discovery.getHandlersForEvent(provider, event);

    if (handlers.length === 0) {
      this.logger.debug('No handlers found for event', { provider, event });
      return [];
    }

    this.logger.info('Executing handlers for webhook event', {
      projectId,
      provider,
      event,
      handlerCount: handlers.length,
    });

    // Enhance payload with parsed data
    const enhancedPayload = await this.enhancePayload(request);

    // Execute handlers in parallel
    const executions = handlers.map(handler =>
      this.executeHandler(projectId, handler, enhancedPayload)
    );

    const results = await Promise.allSettled(executions);

    // Process results
    const handlerResults: HandlerResult[] = [];
    const notificationPromises: Array<Promise<void>> = [];
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const handler = handlers[i];

      if (result.status === 'fulfilled') {
        const handlerResult = result.value.result;
        handlerResults.push(handlerResult);
        this.updateHandlerStats(handler.id, handlerResult);
        notificationPromises.push(this.broadcastHandlerResult(projectId, handler, handlerResult));
      } else {
        const errorResult: HandlerResult = {
          success: false,
          message: `Handler execution failed: ${result.reason}`,
          errors: [
            {
              code: 'EXECUTION_FAILED',
              message: result.reason?.message || 'Unknown error',
              stack: result.reason?.stack,
            },
          ],
        };
        handlerResults.push(errorResult);
        this.updateHandlerStats(handler.id, errorResult);
        notificationPromises.push(this.broadcastHandlerResult(projectId, handler, errorResult));
      }
    }

    await Promise.allSettled(notificationPromises);

    return handlerResults;
  }

  private async broadcastHandlerResult(
    projectId: string,
    handler: RegisteredHandler,
    result: HandlerResult
  ): Promise<void> {
    try {
      await this.services.events.broadcastToProject(projectId, {
        project_id: projectId,
        event_type: 'handler_executed',
        data: {
          handlerId: handler.id,
          handlerName: handler.metadata?.name || handler.id,
          provider: handler.provider,
          event: handler.event,
          success: result.success,
          message: result.message,
          actions: result.actions ?? [],
          duration: result.duration ?? null,
          errors: result.errors ?? [],
        },
      });
    } catch (error) {
      this.logger.error('Failed to broadcast handler result', error as Error, {
        projectId,
        handlerId: handler.id,
        event: handler.event,
      });
    }
  }

  /**
   * Execute a single handler with timeout and error handling
   */
  private async executeHandler(
    projectId: string,
    handler: RegisteredHandler,
    payload: EnhancedWebhookPayload
  ): Promise<{ result: HandlerResult; execution: HandlerExecution }> {
    const executionId = generateId();
    const startTime = Date.now();
    const startedAt = getCurrentTimestamp();

    this.logger.debug('Starting handler execution', {
      executionId,
      handlerId: handler.id,
      handlerName: handler.metadata?.name,
      projectId,
    });

    // Create abort controller for timeout
    const abortController = new AbortController();
    this.activeExecutions.set(executionId, abortController);

    let result: HandlerResult;
    let completedAt: string;
    let duration: number;

    try {
      // Load handler module
      const handlerModule = await this.loadHandlerModule(handler);

      // Create execution context
      const context = await this.createHandlerContext(
        projectId,
        handler,
        executionId,
        abortController.signal
      );

      // Execute with timeout
      const timeoutPromise = setTimeout(handler.config.timeout, null, {
        signal: abortController.signal,
      });

      const executionPromise = this.executeWithRetries(
        handlerModule.handler,
        payload,
        context,
        handler.config.retries
      );

      const raceResult = await Promise.race([executionPromise, timeoutPromise]);

      if (raceResult === null) {
        throw new Error(`Handler execution timed out after ${handler.config.timeout}ms`);
      }

      result = raceResult as HandlerResult;

      // Add timing information
      const endTime = Date.now();
      duration = endTime - startTime;
      completedAt = getCurrentTimestamp();
      result.duration = duration;

      this.logger.info('Handler execution completed', {
        executionId,
        handlerId: handler.id,
        success: result.success,
        duration,
        actionsCount: result.actions?.length || 0,
      });
    } catch (error) {
      const endTime = Date.now();
      duration = endTime - startTime;
      completedAt = getCurrentTimestamp();

      this.logger.error('Handler execution failed', error as Error, {
        executionId,
        handlerId: handler.id,
        projectId,
        duration,
      });

      result = {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        duration,
        errors: [
          {
            code: 'HANDLER_EXECUTION_ERROR',
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
          },
        ],
      };
    } finally {
      // Clean up
      this.activeExecutions.delete(executionId);
      abortController.abort();
    }

    // Record execution
    const execution: HandlerExecution = {
      id: executionId,
      handlerId: handler.id,
      projectId,
      provider: handler.provider,
      event: payload.parsed.eventType,
      payload,
      result,
      startedAt,
      completedAt,
      duration,
    };

    this.executionHistory.push(execution);

    // Trim history to prevent memory leaks (keep last 1000 executions)
    if (this.executionHistory.length > 1000) {
      this.executionHistory = this.executionHistory.slice(-1000);
    }

    return { result, execution };
  }

  /**
   * Execute handler with retry logic
   */
  private async executeWithRetries(
    handler: WebhookHandler,
    payload: EnhancedWebhookPayload,
    context: HandlerContext,
    retries: number
  ): Promise<HandlerResult> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        if (attempt > 0) {
          const delay = Math.min(1000 * 2 ** (attempt - 1), 5000); // Exponential backoff
          await setTimeout(delay);

          this.logger.info('Retrying handler execution', {
            attempt,
            maxRetries: retries,
            delay,
          });
        }

        const result = await handler(payload, context);

        // If successful or explicitly non-retryable, return immediately
        if (result.success || !this.isRetryableError(result)) {
          return result;
        }

        lastError = new Error(result.message);
      } catch (error) {
        lastError = error as Error;

        // If not retryable, fail immediately
        if (!this.isRetryableError(error)) {
          throw error;
        }
      }
    }

    // All retries exhausted
    throw new Error(`Handler failed after ${retries + 1} attempts: ${lastError?.message}`);
  }

  /**
   * Check if an error is retryable
   */
  private isRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      // Network/timeout errors are retryable
      if (
        message.includes('timeout') ||
        message.includes('network') ||
        message.includes('connection') ||
        message.includes('econnreset') ||
        message.includes('enotfound')
      ) {
        return true;
      }

      // HTTP 5xx errors are retryable
      if (message.includes('5') && message.includes('error')) {
        return true;
      }
    }

    if (typeof error === 'object' && error !== null) {
      const result = error as HandlerResult;
      if (result.errors) {
        return result.errors.some(e =>
          ['TIMEOUT', 'NETWORK_ERROR', 'SERVICE_UNAVAILABLE'].includes(e.code)
        );
      }
    }

    return false;
  }

  /**
   * Load handler module dynamically
   */
  private async loadHandlerModule(handler: RegisteredHandler): Promise<any> {
    return this.loader.load(handler);
  }

  /**
   * Create handler execution context
   */
  private async createHandlerContext(
    projectId: string,
    handler: RegisteredHandler,
    executionId: string,
    abortSignal: AbortSignal
  ): Promise<HandlerContext> {
    const sanitizedEnvironment = HandlerSecurityValidator.sanitizeEnvironment(
      handler.config.environment
    );

    const secretsValidation = HandlerSecurityValidator.validateSecrets(handler.config.secrets);
    if (!secretsValidation.valid) {
      throw new Error(
        `Handler secrets configuration invalid: ${secretsValidation.errors.join(', ')}`
      );
    }

    const sanitizedConfig = {
      ...handler.config,
      environment: sanitizedEnvironment,
      secrets: { ...handler.config.secrets },
    } as HandlerContext['config'];

    return {
      projectId,
      provider: handler.provider,
      event: handler.event,
      config: sanitizedConfig,
      logger: this.createHandlerLogger(handler.id, executionId),
      services: this.services,
      metadata: {
        handlerPath: handler.handlerPath,
        version: handler.metadata?.version || '1.0.0',
        executionId,
        timestamp: getCurrentTimestamp(),
      },
    };
  }

  /**
   * Create scoped logger for handler
   */
  private createHandlerLogger(handlerId: string, executionId: string): Logger {
    return {
      info: (message: string, meta?: Record<string, unknown>) => {
        this.logger.info(message, { ...meta, handlerId, executionId });
      },
      warn: (message: string, meta?: Record<string, unknown>) => {
        this.logger.warn(message, { ...meta, handlerId, executionId });
      },
      error: (message: string, error?: Error, meta?: Record<string, unknown>) => {
        this.logger.error(message, error, { ...meta, handlerId, executionId });
      },
      debug: (message: string, meta?: Record<string, unknown>) => {
        this.logger.debug(message, { ...meta, handlerId, executionId });
      },
    };
  }

  /**
   * Enhance webhook payload with parsed data
   */
  private async enhancePayload(request: WebhookRequest): Promise<EnhancedWebhookPayload> {
    const { provider, event, payload } = request;

    // Parse payload based on provider and event type
    const parsed = await this.parsePayload(provider, event, payload);

    return {
      ...payload,
      parsed,
    };
  }

  /**
   * Parse webhook payload into standardized format
   */
  private async parsePayload(
    provider: 'github' | 'gitlab',
    event: string,
    payload: WebhookPayload
  ): Promise<EnhancedWebhookPayload['parsed']> {
    const parsed: EnhancedWebhookPayload['parsed'] = {
      eventType: event,
      author: {
        name: 'Unknown',
        email: undefined,
        username: undefined,
      },
      repository: {
        name: payload.repository?.full_name?.split('/').pop() || 'unknown',
        fullName: payload.repository?.full_name || 'unknown',
        owner: payload.repository?.full_name?.split('/')[0] || 'unknown',
        url: payload.repository?.clone_url || '',
        defaultBranch: payload.repository?.default_branch || 'main',
        isPrivate: false,
      },
    };

    // Provider-specific parsing
    if (provider === 'github') {
      await this.parseGitHubPayload(event, payload, parsed);
    } else if (provider === 'gitlab') {
      await this.parseGitLabPayload(event, payload, parsed);
    }

    return parsed;
  }

  /**
   * Parse GitHub webhook payload
   */
  private async parseGitHubPayload(
    event: string,
    payload: any,
    parsed: EnhancedWebhookPayload['parsed']
  ): Promise<void> {
    // Common GitHub fields
    if (payload.sender) {
      parsed.author.username = payload.sender.login;
      parsed.author.name = payload.sender.login;
    }

    if (payload.repository) {
      parsed.repository.isPrivate = payload.repository.private;
      parsed.repository.url = payload.repository.html_url;
    }

    // Event-specific parsing
    switch (event) {
      case 'push':
        if (payload.commits) {
          parsed.commits = payload.commits.map((commit: any) => ({
            sha: commit.id,
            message: commit.message,
            author: commit.author.name,
            url: commit.url,
            timestamp: commit.timestamp,
            added: commit.added || [],
            modified: commit.modified || [],
            removed: commit.removed || [],
          }));
        }
        break;

      case 'pull_request':
        if (payload.pull_request) {
          parsed.action = payload.action;
          parsed.pullRequest = {
            id: payload.pull_request.number,
            title: payload.pull_request.title,
            body: payload.pull_request.body || '',
            state: payload.pull_request.state,
            baseBranch: payload.pull_request.base.ref,
            headBranch: payload.pull_request.head.ref,
            url: payload.pull_request.html_url,
            merged: payload.pull_request.merged,
            mergeable: payload.pull_request.mergeable,
          };
        }
        break;

      case 'issues':
        if (payload.issue) {
          parsed.action = payload.action;
          parsed.issue = {
            id: payload.issue.number,
            title: payload.issue.title,
            body: payload.issue.body || '',
            state: payload.issue.state,
            labels: payload.issue.labels?.map((l: any) => l.name) || [],
            assignees: payload.issue.assignees?.map((a: any) => a.login) || [],
            url: payload.issue.html_url,
          };
        }
        break;
    }
  }

  /**
   * Parse GitLab webhook payload
   */
  private async parseGitLabPayload(
    event: string,
    payload: any,
    parsed: EnhancedWebhookPayload['parsed']
  ): Promise<void> {
    // Common GitLab fields
    if (payload.user) {
      parsed.author.username = payload.user.username;
      parsed.author.name = payload.user.name;
      parsed.author.email = payload.user.email;
    }

    if (payload.project) {
      parsed.repository.name = payload.project.name;
      parsed.repository.fullName = payload.project.path_with_namespace;
      parsed.repository.url = payload.project.web_url;
      parsed.repository.isPrivate = payload.project.visibility_level < 20;
      parsed.repository.defaultBranch = payload.project.default_branch;
    }

    // Event-specific parsing
    switch (event) {
      case 'Push Hook':
        if (payload.commits) {
          parsed.commits = payload.commits.map((commit: any) => ({
            sha: commit.id,
            message: commit.message,
            author: commit.author.name,
            url: commit.url,
            timestamp: commit.timestamp,
            added: commit.added || [],
            modified: commit.modified || [],
            removed: commit.removed || [],
          }));
        }
        break;

      case 'Merge Request Hook':
        if (payload.merge_request) {
          parsed.action = payload.action;
          parsed.pullRequest = {
            id: payload.merge_request.iid,
            title: payload.merge_request.title,
            body: payload.merge_request.description || '',
            state: payload.merge_request.state,
            baseBranch: payload.merge_request.target_branch,
            headBranch: payload.merge_request.source_branch,
            url: payload.merge_request.url,
            merged: payload.merge_request.state === 'merged',
            mergeable: payload.merge_request.merge_status === 'can_be_merged',
          };
        }
        break;
    }
  }

  /**
   * Update handler statistics
   */
  private updateHandlerStats(handlerId: string, result: HandlerResult): void {
    const handler = this.discovery.getHandler(handlerId);
    if (handler) {
      handler.executionCount++;
      handler.lastExecuted = getCurrentTimestamp();

      if (!result.success) {
        handler.errorCount++;
      }

      this.discovery.updateHandlerConfig(handlerId, {
        executionCount: handler.executionCount,
        errorCount: handler.errorCount,
        lastExecuted: handler.lastExecuted,
      });
    }
  }

  /**
   * Get execution history
   */
  getExecutionHistory(limit = 100): HandlerExecution[] {
    return this.executionHistory.slice(-limit);
  }

  /**
   * Get active executions count
   */
  getActiveExecutionCount(): number {
    return this.activeExecutions.size;
  }

  /**
   * Cancel all active executions
   */
  cancelAllExecutions(): void {
    for (const [executionId, controller] of this.activeExecutions) {
      controller.abort();
      this.logger.info('Cancelled handler execution', { executionId });
    }
    this.activeExecutions.clear();
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.cancelAllExecutions();
    this.executionHistory.length = 0;
  }
}

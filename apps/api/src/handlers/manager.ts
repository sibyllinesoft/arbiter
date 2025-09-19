/**
 * Handler Manager - Integrates custom handlers with existing webhook system
 * This is the main integration point that extends the WebhookService
 */

import { join } from 'node:path';
import type { SpecWorkbenchDB } from '../db.js';
import type { EventService } from '../events.js';
import type { ServerConfig } from '../types.js';
import { logger as defaultLogger } from '../utils.js';
import { HandlerDiscovery } from './discovery.js';
import { HandlerExecutor } from './executor.js';
import { HandlerGitService, HandlerHttpClient, HandlerNotificationService } from './services.js';
import type {
  HandlerDiscoveryConfig,
  HandlerExecution,
  HandlerResult,
  HandlerServices,
  Logger,
  RegisteredHandler,
  WebhookRequest,
} from './types.js';

export class CustomHandlerManager {
  private discovery: HandlerDiscovery;
  private executor: HandlerExecutor;
  private services: HandlerServices;
  private initialized = false;

  constructor(
    private config: ServerConfig,
    private events: EventService,
    private db: SpecWorkbenchDB,
    private logger: Logger = defaultLogger
  ) {
    // Initialize handler services
    this.services = {
      events: this.events,
      db: this.db,
      http: new HandlerHttpClient(this.logger),
      notifications: new HandlerNotificationService(this.logger),
      git: new HandlerGitService(this.logger),
    };

    // Configure discovery
    const discoveryConfig: HandlerDiscoveryConfig = {
      handlersDirectory: join(process.cwd(), 'arbiter', 'handlers'),
      enableAutoReload: this.config.handlers?.enableAutoReload ?? false,
      maxConcurrentExecutions: this.config.handlers?.maxConcurrentExecutions ?? 10,
      defaultTimeout: this.config.handlers?.defaultTimeout ?? 30000,
      defaultRetries: this.config.handlers?.defaultRetries ?? 2,
      sandboxEnabled: this.config.handlers?.sandboxEnabled ?? true,
      allowedModules: this.config.handlers?.allowedModules ?? [
        'node:crypto',
        'node:util',
        'node:url',
        'node:path',
      ],
      enableMetrics: this.config.handlers?.enableMetrics ?? true,
    };

    this.discovery = new HandlerDiscovery(discoveryConfig, this.logger);
    this.executor = new HandlerExecutor(this.discovery, this.services, this.logger);
  }

  /**
   * Initialize the handler system
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    this.logger.info('Initializing custom handler manager');

    try {
      // Discover and load all handlers
      const handlers = await this.discovery.discoverHandlers();

      this.logger.info('Custom handler manager initialized', {
        handlersCount: handlers.length,
        enabledHandlers: handlers.filter(h => h.enabled).length,
      });

      this.initialized = true;
    } catch (error) {
      this.logger.error('Failed to initialize custom handler manager', error as Error);
      throw error;
    }
  }

  /**
   * Process webhook with custom handlers (integrates with existing WebhookService)
   */
  async processWebhookWithCustomHandlers(
    projectId: string,
    request: WebhookRequest
  ): Promise<string[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    const actions: string[] = [];

    try {
      this.logger.info('Processing webhook with custom handlers', {
        projectId,
        provider: request.provider,
        event: request.event,
      });

      // Execute custom handlers
      const handlerResults = await this.executor.executeHandlers(projectId, request);

      // Process results and extract actions
      for (const result of handlerResults) {
        if (result.success && result.actions) {
          actions.push(...result.actions);
        } else if (!result.success) {
          actions.push(`Custom handler failed: ${result.message}`);

          // Log handler errors
          if (result.errors) {
            for (const error of result.errors) {
              this.logger.error('Custom handler error', new Error(error.message), {
                projectId,
                errorCode: error.code,
                errorDetails: error.details,
              });
            }
          }
        }
      }

      // Broadcast custom handler events
      if (handlerResults.length > 0) {
        await this.events.broadcastToProject(projectId, {
          project_id: projectId,
          event_type: 'webhook_received',
          data: {
            provider: request.provider,
            event: request.event,
            customHandlersExecuted: handlerResults.length,
            successfulHandlers: handlerResults.filter(r => r.success).length,
            failedHandlers: handlerResults.filter(r => !r.success).length,
            totalActions: actions.length,
          },
        });
      }
    } catch (error) {
      this.logger.error('Custom handler processing failed', error as Error, {
        projectId,
        provider: request.provider,
        event: request.event,
      });

      actions.push('Custom handler processing failed');
    }

    return actions;
  }

  /**
   * Get all registered handlers
   */
  getHandlers(): RegisteredHandler[] {
    return this.discovery.getHandlers();
  }

  /**
   * Get handlers for specific provider/event
   */
  getHandlersForEvent(provider: 'github' | 'gitlab', event: string): RegisteredHandler[] {
    return this.discovery.getHandlersForEvent(provider, event);
  }

  /**
   * Get handler by ID
   */
  getHandler(id: string): RegisteredHandler | undefined {
    return this.discovery.getHandler(id);
  }

  /**
   * Update handler configuration
   */
  updateHandlerConfig(id: string, updates: Partial<RegisteredHandler>): boolean {
    return this.discovery.updateHandlerConfig(id, updates);
  }

  /**
   * Enable/disable handler
   */
  setHandlerEnabled(id: string, enabled: boolean): boolean {
    return this.discovery.setHandlerEnabled(id, enabled);
  }

  /**
   * Remove handler
   */
  removeHandler(id: string): boolean {
    return this.discovery.removeHandler(id);
  }

  /**
   * Reload handler from file
   */
  async reloadHandler(id: string): Promise<boolean> {
    return await this.discovery.reloadHandler(id);
  }

  /**
   * Get execution history
   */
  getExecutionHistory(limit = 100): HandlerExecution[] {
    return this.executor.getExecutionHistory(limit);
  }

  /**
   * Get handler statistics
   */
  getHandlerStats(): {
    totalHandlers: number;
    enabledHandlers: number;
    activeExecutions: number;
    totalExecutions: number;
    failedExecutions: number;
  } {
    const handlers = this.discovery.getHandlers();
    const executions = this.executor.getExecutionHistory();

    return {
      totalHandlers: handlers.length,
      enabledHandlers: handlers.filter(h => h.enabled).length,
      activeExecutions: this.executor.getActiveExecutionCount(),
      totalExecutions: executions.length,
      failedExecutions: executions.filter(e => !e.result.success).length,
    };
  }

  /**
   * Create a new handler directory structure
   */
  async createHandlerStructure(): Promise<void> {
    const { promises: fs } = await import('node:fs');
    const path = await import('node:path');

    const handlersDir = path.join(process.cwd(), 'arbiter', 'handlers');

    try {
      // Create directory structure
      await fs.mkdir(path.join(handlersDir, 'github'), { recursive: true });
      await fs.mkdir(path.join(handlersDir, 'gitlab'), { recursive: true });
      await fs.mkdir(path.join(handlersDir, 'shared'), { recursive: true });
      await fs.mkdir(path.join(handlersDir, 'examples'), { recursive: true });

      // Create example configuration
      const configExample = {
        $schema: './handler-config.schema.json',
        defaults: {
          timeout: 30000,
          retries: 2,
          enabled: true,
        },
        handlers: {
          'github/push': {
            enabled: true,
            timeout: 15000,
            environment: {
              NODE_ENV: 'production',
            },
            secrets: {
              SLACK_WEBHOOK: '${HANDLER_SLACK_WEBHOOK}',
              JIRA_TOKEN: '${HANDLER_JIRA_TOKEN}',
            },
          },
        },
      };

      await fs.writeFile(
        path.join(handlersDir, '.handlers-config.json'),
        JSON.stringify(configExample, null, 2)
      );

      // Create shared utilities example
      const utilsExample = `/**
 * Shared utilities for webhook handlers
 */

export function formatSlackMessage(title: string, details: Record<string, unknown>) {
  return {
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: \`*\${title}*\`
        }
      },
      {
        type: 'section',
        fields: Object.entries(details).map(([key, value]) => ({
          type: 'mrkdwn',
          text: \`*\${key}:* \${value}\`
        }))
      }
    ]
  };
}

export function extractSpecFiles(filePaths: string[]): string[] {
  return filePaths.filter(path => path.endsWith('.cue') || path.endsWith('.spec.ts'));
}

export function shouldNotify(branch: string, defaultBranch: string): boolean {
  return branch === \`refs/heads/\${defaultBranch}\` || branch.includes('release');
}
`;

      await fs.writeFile(path.join(handlersDir, 'shared', 'utils.ts'), utilsExample);

      this.logger.info('Handler directory structure created', { path: handlersDir });
    } catch (error) {
      this.logger.error('Failed to create handler structure', error as Error);
      throw error;
    }
  }

  /**
   * Validate handler file
   */
  async validateHandler(filePath: string): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const result = {
      valid: true,
      errors: [] as string[],
      warnings: [] as string[],
    };

    try {
      // Basic file validation
      const { promises: fs } = await import('node:fs');
      const content = await fs.readFile(filePath, 'utf-8');

      // Check for required exports
      if (!content.includes('export default') && !content.includes('exports.handler')) {
        result.errors.push('Handler must export a default handler module');
        result.valid = false;
      }

      // Check for async handler function
      if (!content.includes('async') || !content.includes('Promise')) {
        result.warnings.push('Handler should be async and return a Promise<HandlerResult>');
      }

      // Check for proper error handling
      if (!content.includes('try') || !content.includes('catch')) {
        result.warnings.push('Handler should include proper error handling (try/catch)');
      }

      // Check for context usage
      if (!content.includes('context.logger') && !content.includes('logger')) {
        result.warnings.push('Handler should use context.logger for logging');
      }
    } catch (error) {
      result.errors.push(
        `Failed to read handler file: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      result.valid = false;
    }

    return result;
  }

  /**
   * Shutdown handler manager
   */
  async dispose(): Promise<void> {
    this.logger.info('Shutting down custom handler manager');

    this.executor.dispose();
    this.discovery.dispose();

    this.initialized = false;
  }
}

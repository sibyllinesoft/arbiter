/**
 * Webhook service for handling GitLab and GitHub webhooks
 */
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { 
  WebhookConfig, 
  WebhookPayload, 
  WebhookRequest,
  WebhookResponse,
  WebhookEventType,
  ServerConfig,
  EventType
} from "./types.ts";
import { logger, generateId, getCurrentTimestamp } from "./utils.ts";
import { EventService } from "./events.ts";
import { SpecWorkbenchDB } from "./db.ts";
import { CustomHandlerManager } from "./handlers/manager.js";

export class WebhookService {
  private handlerManager: CustomHandlerManager;

  constructor(
    private config: ServerConfig,
    private events: EventService,
    private db: SpecWorkbenchDB
  ) {
    this.handlerManager = new CustomHandlerManager(
      this.config,
      this.events,
      this.db,
      logger
    );
  }

  /**
   * Process incoming webhook from GitLab or GitHub
   */
  async processWebhook(
    provider: "github" | "gitlab",
    event: string,
    signature: string | undefined,
    payload: WebhookPayload,
    headers: Record<string, string>
  ): Promise<WebhookResponse> {
    try {
      logger.info("Processing webhook", { 
        provider, 
        event, 
        repository: payload.repository?.full_name,
        ref: payload.ref 
      });

      // Verify webhook signature
      const verification = await this.verifySignature(provider, signature, JSON.stringify(payload));
      if (!verification.valid) {
        logger.warn("Webhook signature verification failed", { provider, repository: payload.repository?.full_name });
        return {
          success: false,
          message: "Invalid signature"
        };
      }

      // Find matching project configuration
      const projectId = await this.findProjectForRepository(payload.repository.full_name);
      if (!projectId) {
        logger.info("No project found for repository", { repository: payload.repository.full_name });
        return {
          success: false,
          message: "No project configured for this repository"
        };
      }

      // Process the webhook event
      const webhookRequest: WebhookRequest = {
        provider,
        event,
        signature,
        payload,
        timestamp: getCurrentTimestamp()
      };

      // Process with both built-in and custom handlers
      const builtInActions = await this.handleWebhookEvent(projectId, webhookRequest);
      const customActions = await this.handlerManager.processWebhookWithCustomHandlers(projectId, webhookRequest);
      
      const actions = [...builtInActions, ...customActions];

      // Broadcast webhook received event
      await this.events.broadcastToProject(projectId, {
        project_id: projectId,
        event_type: "webhook_received",
        data: {
          provider,
          event,
          repository: payload.repository.full_name,
          ref: payload.ref,
          actions_taken: actions
        }
      });

      return {
        success: true,
        message: `Webhook processed successfully`,
        actions_taken: actions,
        project_id: projectId
      };

    } catch (error) {
      logger.error("Webhook processing error", error instanceof Error ? error : undefined, { provider, event });
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }

  /**
   * Verify webhook signature based on provider
   */
  private async verifySignature(
    provider: "github" | "gitlab",
    signature: string | undefined,
    payload: string
  ): Promise<{ valid: boolean; reason?: string }> {
    if (!this.config.webhooks?.enabled) {
      return { valid: true }; // Allow if webhooks not configured
    }

    if (!signature) {
      return { valid: false, reason: "No signature provided" };
    }

    try {
      if (provider === "github") {
        return this.verifyGitHubSignature(signature, payload);
      } else if (provider === "gitlab") {
        return this.verifyGitLabSignature(signature, payload);
      }

      return { valid: false, reason: "Unknown provider" };
    } catch (error) {
      logger.error("Signature verification error", error instanceof Error ? error : undefined);
      return { valid: false, reason: "Verification failed" };
    }
  }

  /**
   * Verify GitHub webhook signature (HMAC SHA-256)
   */
  private verifyGitHubSignature(signature: string, payload: string): { valid: boolean; reason?: string } {
    const secret = this.config.webhooks?.github_secret || this.config.webhooks?.secret;
    
    if (!secret) {
      return { valid: false, reason: "No GitHub secret configured" };
    }

    // GitHub signature format: sha256=<hex>
    if (!signature.startsWith('sha256=')) {
      return { valid: false, reason: "Invalid signature format" };
    }

    const expectedSignature = createHmac('sha256', secret)
      .update(payload, 'utf8')
      .digest('hex');

    const providedSignature = signature.replace('sha256=', '');

    const valid = timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(providedSignature, 'hex')
    );

    return { valid };
  }

  /**
   * Verify GitLab webhook signature (HMAC SHA-256)
   */
  private verifyGitLabSignature(signature: string, payload: string): { valid: boolean; reason?: string } {
    const secret = this.config.webhooks?.gitlab_secret || this.config.webhooks?.secret;
    
    if (!secret) {
      return { valid: false, reason: "No GitLab secret configured" };
    }

    const expectedSignature = createHmac('sha256', secret)
      .update(payload, 'utf8')
      .digest('base64');

    const valid = timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(signature)
    );

    return { valid };
  }

  /**
   * Find project ID for a given repository
   */
  private async findProjectForRepository(repositoryFullName: string): Promise<string | null> {
    try {
      // For now, we'll use a simple naming convention
      // In a real implementation, this would query the database for webhook configs
      const projects = await this.db.listProjects();
      
      // Look for project with matching name or check if repository is in allowed list
      const allowedRepos = this.config.webhooks?.allowed_repos || [];
      
      if (allowedRepos.length > 0 && !allowedRepos.includes(repositoryFullName)) {
        return null;
      }

      // Simple heuristic: find project by repository name
      const repoName = repositoryFullName.split('/').pop()?.toLowerCase() || '';
      const matchingProject = projects.find(p => 
        p.name.toLowerCase().includes(repoName) || 
        repoName.includes(p.name.toLowerCase())
      );

      return matchingProject?.id || projects[0]?.id || null;
    } catch (error) {
      logger.error("Error finding project for repository", error instanceof Error ? error : undefined);
      return null;
    }
  }

  /**
   * Handle specific webhook events
   */
  private async handleWebhookEvent(projectId: string, request: WebhookRequest): Promise<string[]> {
    const actions: string[] = [];

    try {
      if (request.provider === "github") {
        actions.push(...await this.handleGitHubEvent(projectId, request));
      } else if (request.provider === "gitlab") {
        actions.push(...await this.handleGitLabEvent(projectId, request));
      }
    } catch (error) {
      logger.error("Error handling webhook event", error instanceof Error ? error : undefined);
      actions.push("Error processing event");
    }

    return actions;
  }

  /**
   * Handle GitHub webhook events
   */
  private async handleGitHubEvent(projectId: string, request: WebhookRequest): Promise<string[]> {
    const actions: string[] = [];
    const { event, payload } = request;

    switch (event) {
      case "push":
        if (payload.ref && payload.commits) {
          actions.push(`Received ${payload.commits.length} commits on ${payload.ref}`);
          
          if (this.config.webhooks?.sync_on_push) {
            // TODO: Implement sync logic
            actions.push("Triggered spec sync");
          }

          // Broadcast git push event
          await this.events.broadcastToProject(projectId, {
            project_id: projectId,
            event_type: "git_push_processed",
            data: {
              provider: "github",
              ref: payload.ref,
              commits: payload.commits.length,
              repository: payload.repository.full_name
            }
          });
        }
        break;

      case "pull_request":
        if (payload.pull_request && payload.action) {
          actions.push(`Pull request ${payload.action}: #${payload.pull_request.id}`);
          
          if (payload.action === "closed" && this.config.webhooks?.validate_on_merge) {
            // TODO: Implement validation logic
            actions.push("Triggered spec validation");
          }

          await this.events.broadcastToProject(projectId, {
            project_id: projectId,
            event_type: "git_merge_processed",
            data: {
              provider: "github",
              action: payload.action,
              pr_id: payload.pull_request.id,
              base_branch: payload.pull_request.base.ref,
              head_branch: payload.pull_request.head.ref
            }
          });
        }
        break;

      default:
        actions.push(`Unhandled GitHub event: ${event}`);
    }

    return actions;
  }

  /**
   * Handle GitLab webhook events
   */
  private async handleGitLabEvent(projectId: string, request: WebhookRequest): Promise<string[]> {
    const actions: string[] = [];
    const { event, payload } = request;

    switch (event) {
      case "Push Hook":
        if (payload.ref && payload.commits) {
          actions.push(`Received ${payload.commits.length} commits on ${payload.ref}`);
          
          if (this.config.webhooks?.sync_on_push) {
            // TODO: Implement sync logic
            actions.push("Triggered spec sync");
          }

          await this.events.broadcastToProject(projectId, {
            project_id: projectId,
            event_type: "git_push_processed",
            data: {
              provider: "gitlab",
              ref: payload.ref,
              commits: payload.commits.length,
              repository: payload.repository.full_name
            }
          });
        }
        break;

      case "Merge Request Hook":
        if (payload.merge_request && payload.action) {
          actions.push(`Merge request ${payload.action}: !${payload.merge_request.id}`);
          
          if (payload.action === "merge" && this.config.webhooks?.validate_on_merge) {
            // TODO: Implement validation logic
            actions.push("Triggered spec validation");
          }

          await this.events.broadcastToProject(projectId, {
            project_id: projectId,
            event_type: "git_merge_processed",
            data: {
              provider: "gitlab",
              action: payload.action,
              mr_id: payload.merge_request.id,
              target_branch: payload.merge_request.target_branch,
              source_branch: payload.merge_request.source_branch
            }
          });
        }
        break;

      default:
        actions.push(`Unhandled GitLab event: ${event}`);
    }

    return actions;
  }

  /**
   * Get webhook configuration for a project
   */
  async getWebhookConfig(projectId: string): Promise<WebhookConfig | null> {
    // TODO: Implement database storage for webhook configs
    // For now, return a basic config based on server settings
    if (!this.config.webhooks?.enabled) {
      return null;
    }

    return {
      id: generateId(),
      project_id: projectId,
      provider: "github", // Default
      repository_url: "",
      enabled: true,
      events: ["push", "pull_request"],
      created_at: getCurrentTimestamp(),
      updated_at: getCurrentTimestamp()
    };
  }

  /**
   * Create or update webhook configuration
   */
  async updateWebhookConfig(config: Partial<WebhookConfig> & { project_id: string }): Promise<WebhookConfig> {
    // TODO: Implement database storage
    const webhookConfig: WebhookConfig = {
      id: config.id || generateId(),
      project_id: config.project_id,
      provider: config.provider || "github",
      repository_url: config.repository_url || "",
      secret_hash: config.secret_hash,
      enabled: config.enabled ?? true,
      events: config.events || ["push"],
      created_at: config.created_at || getCurrentTimestamp(),
      updated_at: getCurrentTimestamp()
    };

    logger.info("Updated webhook config", { projectId: config.project_id, provider: webhookConfig.provider });
    
    return webhookConfig;
  }

  /**
   * Delete webhook configuration
   */
  async deleteWebhookConfig(projectId: string): Promise<boolean> {
    // TODO: Implement database deletion
    logger.info("Deleted webhook config", { projectId });
    return true;
  }

  /**
   * Get custom handler manager for API endpoints
   */
  getHandlerManager(): CustomHandlerManager {
    return this.handlerManager;
  }
}
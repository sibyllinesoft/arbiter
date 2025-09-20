import type { HandlerResponse, WebhookEvent } from "../../shared/utils.js";
import { createResponse, logEvent, sanitizePayload } from "../../shared/utils.js";
import type { IHookAdapter } from "../adapters/base/IHookAdapter.js";
import type { AIAgentConfig, AICommand, AIProvider, AIProviderConfig } from "./types.js";

/**
 * Base class for AI-powered webhook handlers
 *
 * This class provides a foundation for creating AI agents that can process
 * webhook events with natural language understanding and automated actions.
 *
 * Features:
 * - Configurable AI provider integration (Claude, OpenAI, Gemini)
 * - Command-line style interface (/analyze, /review, etc.)
 * - Extensible adapter system for different event types
 * - Built-in error handling and logging
 * - Rate limiting and safety controls
 */
export abstract class AIAgentHandler {
  protected config: AIAgentConfig;
  protected provider: AIProvider;
  protected adapters: Map<string, IHookAdapter>;
  protected commands: Map<string, AICommand>;

  constructor(config: AIAgentConfig, provider: AIProvider) {
    this.config = config;
    this.provider = provider;
    this.adapters = new Map();
    this.commands = new Map();
    this.initializeCommands();
  }

  /**
   * Main entry point for handling webhook events
   */
  async handleEvent(event: WebhookEvent): Promise<HandlerResponse> {
    const startTime = Date.now();

    try {
      // Log the incoming event
      await this.logActivity({
        type: "ai.agent.event.received",
        timestamp: new Date().toISOString(),
        eventType: event.eventType,
        provider: event.provider,
        agentId: this.config.id,
      });

      // Check if agent is enabled
      if (!this.config.enabled) {
        return createResponse(true, "AI Agent is disabled", {
          skipped: true,
          reason: "disabled",
        });
      }

      // Get appropriate adapter for this event
      const adapter = this.getAdapter(event.provider, event.eventType);
      if (!adapter) {
        return createResponse(false, `No adapter found for ${event.provider}.${event.eventType}`);
      }

      // Extract structured data from the webhook
      const eventData = await adapter.extractEventData(event);
      if (!eventData.success) {
        return createResponse(false, `Failed to extract event data: ${eventData.error}`);
      }

      // Check for AI commands in the event
      const aiCommands = this.extractAICommands(eventData.data);

      // Process the event
      let result: HandlerResponse;

      if (aiCommands.length > 0) {
        // Handle AI commands
        result = await this.processAICommands(aiCommands, eventData.data, event);
      } else {
        // Process as standard event
        result = await this.processEvent(eventData.data, event);
      }

      // Log completion metrics
      const processingTime = Date.now() - startTime;
      await this.logActivity({
        type: "ai.agent.event.completed",
        timestamp: new Date().toISOString(),
        agentId: this.config.id,
        processingTimeMs: processingTime,
        success: result.success,
      });

      return result;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      await this.logActivity({
        type: "ai.agent.event.error",
        timestamp: new Date().toISOString(),
        agentId: this.config.id,
        error: errorMessage,
        processingTimeMs: processingTime,
      });

      return createResponse(false, `AI Agent error: ${errorMessage}`);
    }
  }

  /**
   * Process standard webhook events (without AI commands)
   */
  protected abstract processEvent(
    eventData: any,
    originalEvent: WebhookEvent,
  ): Promise<HandlerResponse>;

  /**
   * Initialize available AI commands
   */
  protected abstract initializeCommands(): void;

  /**
   * Get the appropriate adapter for a specific provider and event type
   */
  protected getAdapter(provider: string, eventType: string): IHookAdapter | undefined {
    const key = `${provider}.${eventType}`;
    return this.adapters.get(key);
  }

  /**
   * Register an adapter for handling specific event types
   */
  protected registerAdapter(provider: string, eventType: string, adapter: IHookAdapter): void {
    const key = `${provider}.${eventType}`;
    this.adapters.set(key, adapter);
  }

  /**
   * Register an AI command that can be triggered via comments/descriptions
   */
  protected registerCommand(name: string, command: AICommand): void {
    this.commands.set(name.toLowerCase(), command);
  }

  /**
   * Extract AI commands from event data (looks for /command patterns)
   */
  protected extractAICommands(
    eventData: any,
  ): Array<{ command: string; args: string[]; context: any }> {
    const commands: Array<{ command: string; args: string[]; context: any }> = [];
    const commandPattern = /\/([a-zA-Z-]+)(\s+(.+))?/g;

    // Look for commands in various text fields
    const textSources = [
      eventData.title,
      eventData.body,
      eventData.description,
      eventData.comment?.body,
    ].filter((text) => typeof text === "string");

    for (const text of textSources) {
      let match;
      while ((match = commandPattern.exec(text)) !== null) {
        const [, command, , argsString] = match;
        const args = argsString ? argsString.split(/\s+/).filter((arg) => arg.length > 0) : [];

        if (this.commands.has(command.toLowerCase())) {
          commands.push({
            command: command.toLowerCase(),
            args,
            context: { source: text, eventData },
          });
        }
      }
    }

    return commands;
  }

  /**
   * Process AI commands found in the event
   */
  protected async processAICommands(
    aiCommands: Array<{ command: string; args: string[]; context: any }>,
    eventData: any,
    originalEvent: WebhookEvent,
  ): Promise<HandlerResponse> {
    const results = [];

    for (const { command, args, context } of aiCommands) {
      const aiCommand = this.commands.get(command);
      if (!aiCommand) continue;

      try {
        const result = await this.executeAICommand(
          aiCommand,
          args,
          context,
          eventData,
          originalEvent,
        );
        results.push({ command, result });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        results.push({
          command,
          result: { success: false, message: `Command failed: ${errorMessage}` },
        });
      }
    }

    const successCount = results.filter((r) => r.result.success).length;
    const totalCount = results.length;

    return createResponse(
      successCount === totalCount,
      `Processed ${successCount}/${totalCount} AI commands`,
      { commands: results },
    );
  }

  /**
   * Execute a specific AI command
   */
  protected async executeAICommand(
    command: AICommand,
    args: string[],
    context: any,
    eventData: any,
    originalEvent: WebhookEvent,
  ): Promise<HandlerResponse> {
    await this.logActivity({
      type: "ai.agent.command.started",
      timestamp: new Date().toISOString(),
      agentId: this.config.id,
      command: command.name,
      args,
    });

    try {
      // Build context for AI processing
      const aiContext = {
        command: command.name,
        args,
        eventData,
        originalEvent: sanitizePayload(originalEvent),
        config: this.config,
      };

      // Call AI provider
      const aiResponse = await this.provider.processCommand(command, aiContext);

      if (!aiResponse.success) {
        return createResponse(false, `AI processing failed: ${aiResponse.error}`);
      }

      // Execute any actions returned by the AI
      let actionResults = [];
      if (aiResponse.actions && aiResponse.actions.length > 0) {
        actionResults = await this.executeActions(aiResponse.actions, eventData, originalEvent);
      }

      return createResponse(true, aiResponse.message || "AI command completed", {
        aiResponse: aiResponse.data,
        actions: actionResults,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return createResponse(false, `AI command execution failed: ${errorMessage}`);
    }
  }

  /**
   * Execute actions returned by the AI (post comments, create issues, etc.)
   */
  protected async executeActions(
    actions: any[],
    eventData: any,
    originalEvent: WebhookEvent,
  ): Promise<any[]> {
    const results = [];

    for (const action of actions) {
      try {
        const result = await this.executeAction(action, eventData, originalEvent);
        results.push({ action: action.type, success: true, result });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        results.push({
          action: action.type,
          success: false,
          error: errorMessage,
        });
      }
    }

    return results;
  }

  /**
   * Execute a single action (to be implemented by subclasses)
   */
  protected abstract executeAction(
    action: any,
    eventData: any,
    originalEvent: WebhookEvent,
  ): Promise<any>;

  /**
   * Log agent activity for debugging and monitoring
   */
  protected async logActivity(data: any): Promise<void> {
    try {
      await logEvent({
        ...data,
        agentId: this.config.id,
        agentType: this.config.type,
      });
    } catch (error) {
      console.error("Failed to log AI agent activity:", error);
    }
  }

  /**
   * Check if the agent should process this event (rate limiting, filters, etc.)
   */
  protected shouldProcessEvent(event: WebhookEvent): boolean {
    // Check rate limits
    if (this.config.rateLimits?.enabled) {
      // Implementation would track request counts and enforce limits
      // For now, return true as a stub
    }

    // Check event filters
    if (this.config.eventFilters && this.config.eventFilters.length > 0) {
      const eventKey = `${event.provider}.${event.eventType}`;
      if (!this.config.eventFilters.includes(eventKey)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get agent status for health checks
   */
  public getStatus(): {
    id: string;
    type: string;
    enabled: boolean;
    provider: string;
    commandCount: number;
    adapterCount: number;
    lastActivity?: string;
  } {
    return {
      id: this.config.id,
      type: this.config.type,
      enabled: this.config.enabled,
      provider: this.provider.getName(),
      commandCount: this.commands.size,
      adapterCount: this.adapters.size,
    };
  }
}

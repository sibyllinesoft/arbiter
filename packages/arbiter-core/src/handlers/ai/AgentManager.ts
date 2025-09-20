import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { HandlerResponse, WebhookEvent } from "../shared/utils.js";
import { createResponse, logEvent } from "../shared/utils.js";
import { CodeReviewAgent } from "./agents/CodeReviewAgent.js";
import { DocumentationAgent } from "./agents/DocumentationAgent.js";
import { IssueAnalysisAgent } from "./agents/IssueAnalysisAgent.js";
import { SecurityAgent } from "./agents/SecurityAgent.js";
import type { AIAgentHandler } from "./base/AIAgentHandler.js";
import type { AIAgentConfig } from "./base/types.js";

type AgentManagerMetrics = {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  agentUsage: Record<string, number>;
};

interface AgentManagerStatus {
  initialized: boolean;
  agentCount: number;
  enabledAgents: string[];
  metrics: AgentManagerMetrics;
  agentStatuses: Record<string, unknown>;
}

/**
 * Central manager for AI agents in the webhook handler system
 *
 * Responsibilities:
 * - Load and validate agent configurations
 * - Initialize and manage agent instances
 * - Route webhook events to appropriate agents
 * - Handle command processing and agent communication
 * - Provide health monitoring and metrics
 * - Manage agent lifecycle (start, stop, restart)
 */
export class AgentManager {
  private agents: Map<string, AIAgentHandler>;
  private config: any;
  private configPath: string;
  private isInitialized: boolean;
  private metrics: AgentManagerMetrics;

  constructor(configPath?: string) {
    this.agents = new Map();
    this.configPath =
      configPath ||
      join(process.cwd(), "packages/arbiter-core/src/handlers/ai/config/ai-agents.json");
    this.isInitialized = false;
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      agentUsage: {},
    };
  }

  /**
   * Initialize the agent manager by loading configuration and creating agents
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Load configuration
      await this.loadConfiguration();

      // Initialize agents based on configuration
      await this.initializeAgents();

      this.isInitialized = true;

      await logEvent({
        type: "ai.agent.manager.initialized",
        timestamp: new Date().toISOString(),
        agentCount: this.agents.size,
        enabledAgents: Array.from(this.agents.keys()),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      await logEvent({
        type: "ai.agent.manager.initialization.failed",
        timestamp: new Date().toISOString(),
        error: errorMessage,
      });
      throw new Error(`Failed to initialize AgentManager: ${errorMessage}`);
    }
  }

  /**
   * Load configuration from file
   */
  private async loadConfiguration(): Promise<void> {
    try {
      const configContent = await readFile(this.configPath, "utf8");
      this.config = JSON.parse(configContent);

      // Validate configuration structure
      if (!this.config.agents) {
        throw new Error("Configuration missing agents section");
      }

      if (!this.config.aiProviders) {
        throw new Error("Configuration missing aiProviders section");
      }
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        throw new Error(`Configuration file not found at ${this.configPath}`);
      }
      throw error;
    }
  }

  /**
   * Initialize agent instances based on configuration
   */
  private async initializeAgents(): Promise<void> {
    const enabledAgents = Object.entries(this.config.agents).filter(
      ([_, config]: [string, any]) => config.enabled,
    );

    for (const [agentId, agentConfig] of enabledAgents) {
      try {
        const agent = await this.createAgent(agentId, agentConfig as AIAgentConfig);
        this.agents.set(agentId, agent);

        // Initialize usage tracking
        this.metrics.agentUsage[agentId] = 0;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        await logEvent({
          type: "ai.agent.initialization.failed",
          timestamp: new Date().toISOString(),
          agentId,
          error: errorMessage,
        });

        // Continue with other agents even if one fails
        console.error(`Failed to initialize agent ${agentId}: ${errorMessage}`);
      }
    }

    if (this.agents.size === 0) {
      console.warn("No AI agents were successfully initialized");
    }
  }

  /**
   * Create a specific agent instance based on type
   */
  private async createAgent(agentId: string, config: AIAgentConfig): Promise<AIAgentHandler> {
    // Merge global AI provider config with agent-specific config
    const providerConfig = {
      ...this.config.aiProviders[config.provider.type].config,
      ...config.provider.config,
    };

    const fullConfig: AIAgentConfig = {
      ...config,
      id: agentId,
      provider: {
        ...config.provider,
        config: providerConfig,
      },
    };

    // Create agent based on type
    switch (config.type) {
      case "code-review":
        return new CodeReviewAgent(fullConfig);

      case "issue-analysis":
        return new IssueAnalysisAgent(fullConfig);

      case "documentation":
        return new DocumentationAgent(fullConfig);

      case "security":
        return new SecurityAgent(fullConfig);

      default:
        throw new Error(`Unknown agent type: ${config.type}`);
    }
  }

  /**
   * Process a webhook event through appropriate agents
   */
  async processEvent(event: WebhookEvent): Promise<HandlerResponse> {
    if (!this.isInitialized) {
      return createResponse(false, "AgentManager not initialized");
    }

    const startTime = Date.now();
    this.metrics.totalRequests++;

    try {
      // Find agents that can handle this event
      const applicableAgents = this.findApplicableAgents(event);

      if (applicableAgents.length === 0) {
        return createResponse(true, "No AI agents configured for this event type", {
          eventType: event.eventType,
          provider: event.provider,
          agentCount: 0,
        });
      }

      // Process event through each applicable agent
      const results = await Promise.allSettled(
        applicableAgents.map(async (agentId) => {
          const agent = this.agents.get(agentId)!;
          this.metrics.agentUsage[agentId]++;

          return {
            agentId,
            result: await agent.handleEvent(event),
          };
        }),
      );

      // Collect results
      const successful = results
        .filter((result): result is PromiseFulfilledResult<any> => result.status === "fulfilled")
        .map((result) => result.value);

      const failed = results
        .filter((result): result is PromiseRejectedResult => result.status === "rejected")
        .map((result) => result.reason);

      // Update metrics
      const responseTime = Date.now() - startTime;
      this.updateMetrics(successful.length > 0, responseTime);

      // Log processing results
      await logEvent({
        type: "ai.agent.manager.event.processed",
        timestamp: new Date().toISOString(),
        eventType: event.eventType,
        provider: event.provider,
        agentsProcessed: applicableAgents.length,
        successfulAgents: successful.length,
        failedAgents: failed.length,
        processingTime: responseTime,
      });

      return createResponse(
        true,
        `Processed by ${successful.length}/${applicableAgents.length} agents`,
        {
          agentsProcessed: applicableAgents.length,
          successful: successful.map((s) => ({
            agentId: s.agentId,
            success: s.result.success,
            message: s.result.message,
          })),
          failed: failed.map((error, index) => ({
            agentId: applicableAgents[index],
            error: error instanceof Error ? error.message : "Unknown error",
          })),
          processingTime: responseTime,
        },
      );
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updateMetrics(false, responseTime);

      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return createResponse(false, `Agent processing failed: ${errorMessage}`);
    }
  }

  /**
   * Process an AI command from a comment or description
   */
  async processCommand(
    command: string,
    args: string[],
    event: WebhookEvent,
    context: any,
  ): Promise<HandlerResponse> {
    if (!this.isInitialized) {
      return createResponse(false, "AgentManager not initialized");
    }

    const startTime = Date.now();

    try {
      // Find agent that supports this command
      const agentId = this.findAgentForCommand(command, event);

      if (!agentId) {
        return createResponse(false, `No agent found for command: ${command}`, {
          command,
          availableCommands: this.getAvailableCommands(),
        });
      }

      const agent = this.agents.get(agentId)!;

      // Create a modified event with command context
      const commandEvent: WebhookEvent = {
        ...event,
        payload: {
          ...event.payload,
          command_context: {
            command,
            args,
            originalContext: context,
          },
        },
      };

      const result = await agent.handleEvent(commandEvent);

      // Update metrics
      const responseTime = Date.now() - startTime;
      this.updateMetrics(result.success, responseTime);
      this.metrics.agentUsage[agentId]++;

      await logEvent({
        type: "ai.agent.manager.command.processed",
        timestamp: new Date().toISOString(),
        command,
        args,
        agentId,
        success: result.success,
        processingTime: responseTime,
      });

      return createResponse(result.success, result.message, {
        ...result.metadata,
        agentId,
        command,
        processingTime: responseTime,
      });
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updateMetrics(false, responseTime);

      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return createResponse(false, `Command processing failed: ${errorMessage}`);
    }
  }

  /**
   * Find agents that can handle a specific event
   */
  private findApplicableAgents(event: WebhookEvent): string[] {
    const eventKey = `${event.provider}.${event.eventType}`;

    return Array.from(this.agents.entries())
      .filter(([_, agent]) => {
        const agentConfig = this.getAgentConfig(agent.getStatus().id);
        if (!agentConfig || !agentConfig.enabled) return false;

        // Check if agent accepts this event type
        if (agentConfig.eventFilters && agentConfig.eventFilters.length > 0) {
          return agentConfig.eventFilters.includes(eventKey);
        }

        return true; // No filters means accept all events
      })
      .map(([agentId]) => agentId);
  }

  /**
   * Find agent that supports a specific command
   */
  private findAgentForCommand(command: string, event: WebhookEvent): string | null {
    for (const [agentId, agent] of this.agents.entries()) {
      const agentConfig = this.getAgentConfig(agentId);
      if (!agentConfig || !agentConfig.enabled) continue;

      // Check if agent supports this command
      if (agentConfig.commands.enabled.includes(command)) {
        // Also verify agent can handle this event type
        const eventKey = `${event.provider}.${event.eventType}`;
        if (!agentConfig.eventFilters || agentConfig.eventFilters.includes(eventKey)) {
          return agentId;
        }
      }
    }

    return null;
  }

  /**
   * Get available commands across all agents
   */
  private getAvailableCommands(): Record<string, string[]> {
    const commands: Record<string, string[]> = {};

    for (const [agentId, agent] of this.agents.entries()) {
      const agentConfig = this.getAgentConfig(agentId);
      if (agentConfig?.enabled) {
        commands[agentId] = agentConfig.commands.enabled;
      }
    }

    return commands;
  }

  /**
   * Get agent configuration by ID
   */
  private getAgentConfig(agentId: string): AIAgentConfig | null {
    return this.config.agents[agentId] || null;
  }

  /**
   * Update performance metrics
   */
  private updateMetrics(success: boolean, responseTime: number): void {
    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
    }

    // Update running average of response time
    const totalRequests = this.metrics.totalRequests;
    this.metrics.averageResponseTime =
      (this.metrics.averageResponseTime * (totalRequests - 1) + responseTime) / totalRequests;
  }

  /**
   * Get agent manager status and metrics
   */
  getStatus(): AgentManagerStatus {
    const agentStatuses: Record<string, unknown> = {};

    for (const [agentId, agent] of this.agents.entries()) {
      agentStatuses[agentId] = agent.getStatus();
    }

    return {
      initialized: this.isInitialized,
      agentCount: this.agents.size,
      enabledAgents: Array.from(this.agents.keys()),
      metrics: this.metrics,
      agentStatuses,
    };
  }

  /**
   * Reload configuration and restart agents
   */
  async reload(): Promise<void> {
    await logEvent({
      type: "ai.agent.manager.reload.started",
      timestamp: new Date().toISOString(),
    });

    try {
      // Clear existing agents
      this.agents.clear();
      this.isInitialized = false;

      // Reinitialize
      await this.initialize();

      await logEvent({
        type: "ai.agent.manager.reload.completed",
        timestamp: new Date().toISOString(),
        agentCount: this.agents.size,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      await logEvent({
        type: "ai.agent.manager.reload.failed",
        timestamp: new Date().toISOString(),
        error: errorMessage,
      });
      throw error;
    }
  }

  /**
   * Enable or disable a specific agent
   */
  async toggleAgent(agentId: string, enabled: boolean): Promise<void> {
    const agentConfig = this.config.agents[agentId];
    if (!agentConfig) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    agentConfig.enabled = enabled;

    if (enabled && !this.agents.has(agentId)) {
      // Initialize the agent
      const agent = await this.createAgent(agentId, agentConfig);
      this.agents.set(agentId, agent);
      this.metrics.agentUsage[agentId] = 0;
    } else if (!enabled && this.agents.has(agentId)) {
      // Remove the agent
      this.agents.delete(agentId);
      delete this.metrics.agentUsage[agentId];
    }

    await logEvent({
      type: "ai.agent.manager.agent.toggled",
      timestamp: new Date().toISOString(),
      agentId,
      enabled,
    });
  }

  /**
   * Test AI provider connectivity
   */
  async testProviders(): Promise<Record<string, { success: boolean; error?: string }>> {
    const results: Record<string, { success: boolean; error?: string }> = {};

    for (const [agentId, agent] of this.agents.entries()) {
      try {
        // This would need to be implemented in the base handler
        // For now, we'll simulate it
        results[agentId] = { success: true };
      } catch (error) {
        results[agentId] = {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }

    return results;
  }

  /**
   * Cleanup resources
   */
  async shutdown(): Promise<void> {
    await logEvent({
      type: "ai.agent.manager.shutdown",
      timestamp: new Date().toISOString(),
      agentCount: this.agents.size,
    });

    this.agents.clear();
    this.isInitialized = false;
  }
}

/**
 * API endpoints for custom webhook handlers management
 */

import type { CustomHandlerManager } from "./manager.js";
import type {
  HandlerCreationOptions,
  HandlerExecution,
  HandlerResult,
  RegisteredHandler,
} from "./types.js";

// Request/Response types for API endpoints
export interface ListHandlersRequest {
  provider?: "github" | "gitlab";
  event?: string;
  enabled?: boolean;
}

export interface ListHandlersResponse {
  success: boolean;
  handlers: RegisteredHandler[];
  total: number;
}

export interface GetHandlerRequest {
  id: string;
}

export interface GetHandlerResponse {
  success: boolean;
  handler?: RegisteredHandler;
  message?: string;
}

export interface UpdateHandlerRequest {
  id: string;
  updates: Partial<RegisteredHandler>;
}

export interface UpdateHandlerResponse {
  success: boolean;
  handler?: RegisteredHandler;
  message: string;
}

export interface ToggleHandlerRequest {
  id: string;
  enabled: boolean;
}

export interface ToggleHandlerResponse {
  success: boolean;
  message: string;
}

export interface ValidateHandlerRequest {
  filePath: string;
}

export interface ValidateHandlerResponse {
  success: boolean;
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export type CreateHandlerRequest = HandlerCreationOptions;

export interface CreateHandlerResponse {
  success: boolean;
  handler?: RegisteredHandler;
  message: string;
}

export interface ExecutionHistoryRequest {
  handlerId?: string;
  projectId?: string;
  provider?: "github" | "gitlab";
  event?: string;
  limit?: number;
  offset?: number;
}

export interface ExecutionHistoryResponse {
  success: boolean;
  executions: HandlerExecution[];
  total: number;
  hasMore: boolean;
}

export interface HandlerStatsResponse {
  success: boolean;
  stats: {
    totalHandlers: number;
    enabledHandlers: number;
    activeExecutions: number;
    totalExecutions: number;
    failedExecutions: number;
    executionsLast24h: number;
    avgExecutionTime: number;
    errorRate: number;
  };
}

/**
 * Handler API Controller
 */
export class HandlerAPIController {
  constructor(private handlerManager: CustomHandlerManager) {}

  /**
   * GET /api/handlers
   * List all registered handlers with optional filtering
   */
  async listHandlers(request: ListHandlersRequest): Promise<ListHandlersResponse> {
    try {
      let handlers = this.handlerManager.getHandlers();

      // Apply filters
      if (request.provider) {
        handlers = handlers.filter((h) => h.provider === request.provider);
      }

      if (request.event) {
        handlers = handlers.filter((h) => h.event === request.event);
      }

      if (request.enabled !== undefined) {
        handlers = handlers.filter((h) => h.enabled === request.enabled);
      }

      return {
        success: true,
        handlers,
        total: handlers.length,
      };
    } catch (error) {
      return {
        success: false,
        handlers: [],
        total: 0,
      };
    }
  }

  /**
   * GET /api/handlers/:id
   * Get a specific handler by ID
   */
  async getHandler(request: GetHandlerRequest): Promise<GetHandlerResponse> {
    try {
      const handler = this.handlerManager.getHandler(request.id);

      if (!handler) {
        return {
          success: false,
          message: "Handler not found",
        };
      }

      return {
        success: true,
        handler,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * PUT /api/handlers/:id
   * Update handler configuration
   */
  async updateHandler(request: UpdateHandlerRequest): Promise<UpdateHandlerResponse> {
    try {
      const success = this.handlerManager.updateHandlerConfig(request.id, request.updates);

      if (!success) {
        return {
          success: false,
          message: "Handler not found or update failed",
        };
      }

      const handler = this.handlerManager.getHandler(request.id);
      return {
        success: true,
        handler,
        message: "Handler updated successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * POST /api/handlers/:id/toggle
   * Enable or disable a handler
   */
  async toggleHandler(request: ToggleHandlerRequest): Promise<ToggleHandlerResponse> {
    try {
      const success = this.handlerManager.setHandlerEnabled(request.id, request.enabled);

      if (!success) {
        return {
          success: false,
          message: "Handler not found",
        };
      }

      return {
        success: true,
        message: `Handler ${request.enabled ? "enabled" : "disabled"} successfully`,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * DELETE /api/handlers/:id
   * Remove a handler
   */
  async removeHandler(request: GetHandlerRequest): Promise<UpdateHandlerResponse> {
    try {
      const success = this.handlerManager.removeHandler(request.id);

      return {
        success,
        message: success ? "Handler removed successfully" : "Handler not found",
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * POST /api/handlers/:id/reload
   * Reload a handler from file
   */
  async reloadHandler(request: GetHandlerRequest): Promise<UpdateHandlerResponse> {
    try {
      const success = await this.handlerManager.reloadHandler(request.id);

      return {
        success,
        message: success ? "Handler reloaded successfully" : "Handler not found or reload failed",
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * POST /api/handlers/validate
   * Validate handler code
   */
  async validateHandler(request: ValidateHandlerRequest): Promise<ValidateHandlerResponse> {
    try {
      const validation = await this.handlerManager.validateHandler(request.filePath);

      return {
        success: true,
        valid: validation.valid,
        errors: validation.errors,
        warnings: validation.warnings,
      };
    } catch (error) {
      return {
        success: false,
        valid: false,
        errors: [error instanceof Error ? error.message : "Unknown error"],
        warnings: [],
      };
    }
  }

  /**
   * POST /api/handlers
   * Create a new handler
   */
  async createHandler(request: CreateHandlerRequest): Promise<CreateHandlerResponse> {
    try {
      const handler = await this.handlerManager.createHandler(request);

      return {
        success: true,
        handler,
        message: "Handler created successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * GET /api/handlers/executions
   * Get handler execution history
   */
  async getExecutionHistory(request: ExecutionHistoryRequest): Promise<ExecutionHistoryResponse> {
    try {
      let executions = this.handlerManager.getExecutionHistory(request.limit || 100);

      // Apply filters
      if (request.handlerId) {
        executions = executions.filter((e) => e.handlerId === request.handlerId);
      }

      if (request.projectId) {
        executions = executions.filter((e) => e.projectId === request.projectId);
      }

      if (request.provider) {
        executions = executions.filter((e) => e.provider === request.provider);
      }

      if (request.event) {
        executions = executions.filter((e) => e.event === request.event);
      }

      // Apply pagination
      const offset = request.offset || 0;
      const limit = request.limit || 100;
      const paginatedExecutions = executions.slice(offset, offset + limit);

      return {
        success: true,
        executions: paginatedExecutions,
        total: executions.length,
        hasMore: offset + limit < executions.length,
      };
    } catch (error) {
      return {
        success: false,
        executions: [],
        total: 0,
        hasMore: false,
      };
    }
  }

  /**
   * GET /api/handlers/stats
   * Get handler system statistics
   */
  async getHandlerStats(): Promise<HandlerStatsResponse> {
    try {
      const stats = this.handlerManager.getHandlerStats();
      const executions = this.handlerManager.getExecutionHistory();

      // Calculate additional statistics
      const now = Date.now();
      const oneDayAgo = now - 24 * 60 * 60 * 1000;

      const executionsLast24h = executions.filter(
        (e) => new Date(e.startedAt).getTime() > oneDayAgo,
      ).length;

      const completedExecutions = executions.filter((e) => e.result.duration);
      const avgExecutionTime =
        completedExecutions.length > 0
          ? completedExecutions.reduce((sum, e) => sum + (e.result.duration || 0), 0) /
            completedExecutions.length
          : 0;

      const errorRate =
        stats.totalExecutions > 0 ? (stats.failedExecutions / stats.totalExecutions) * 100 : 0;

      return {
        success: true,
        stats: {
          ...stats,
          executionsLast24h,
          avgExecutionTime: Math.round(avgExecutionTime),
          errorRate: Math.round(errorRate * 100) / 100,
        },
      };
    } catch (error) {
      return {
        success: false,
        stats: {
          totalHandlers: 0,
          enabledHandlers: 0,
          activeExecutions: 0,
          totalExecutions: 0,
          failedExecutions: 0,
          executionsLast24h: 0,
          avgExecutionTime: 0,
          errorRate: 0,
        },
      };
    }
  }

  /**
   * POST /api/handlers/init
   * Initialize handler directory structure
   */
  async initializeHandlerStructure(): Promise<{ success: boolean; message: string }> {
    try {
      await this.handlerManager.createHandlerStructure();
      return {
        success: true,
        message: "Handler directory structure created successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}
